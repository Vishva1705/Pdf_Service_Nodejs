const express = require("express");
const fs = require("fs");
const path = require("path");
const util = require('util');
const moment = require('moment');
const schedule = require('node-schedule');
const PDFServicesSdk = require("@adobe/pdfservices-node-sdk");
const ILovePDFApi = require('@ilovepdf/ilovepdf-nodejs');
const ILovePDFFile = require('@ilovepdf/ilovepdf-nodejs/ILovePDFFile');
const { BlobServiceClient } = require('@azure/storage-blob');
const nodemailer = require('nodemailer');
const logger = require('./logger');



const app = express();

const mkdirAsync = util.promisify(fs.mkdir);

let taskStatus = 2;


//Blob Connection
const connectionString = ' <your Azure Blob Connection string> ';
const containerName = 'httepaper';



//---------- ----Configure email service--------------
const emailConfig = {
    service: 'outlook',
    auth: {
        user: '<Email id>', // Your email address
        pass: '<Email password>',  // Your email password or app password
    },
};


const transporter = nodemailer.createTransport(emailConfig);

// Define the sendEmail function
async function sendEmail(subject, message) {
    try {
        const mailOptions = {
            from: '<Email id>',
            to: '<Email id>',
            subject: subject,
            text: message,
        };

        // Send the email
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.response);
    } catch (error) {
        console.error('Error sending email:', error);
    }
}





//--------------------Adobe pdf compression----------------------------
async function compressPDFUsingAdobe(inputFilePath, outputFilePath) {

    try {
        // Create credentials using service principal authentication
        const credentials = PDFServicesSdk.Credentials.servicePrincipalCredentialsBuilder()
            .withClientId("<client id>")
            .withClientSecret("<client secret>")
            .build();

        // Create an ExecutionContext using credentials and create a new operation instance.
        const executionContext = PDFServicesSdk.ExecutionContext.create(credentials);
        const compressPDF = PDFServicesSdk.CompressPDF;
        const compressPDFOperation = compressPDF.Operation.createNew();


        const input = PDFServicesSdk.FileRef.createFromLocalFile(inputFilePath);
        compressPDFOperation.setInput(input);

        try {
            // Execute the operation and save the compressed PDF to the specified location.
            const result = await compressPDFOperation.execute(executionContext);
            await result.saveAsFile(outputFilePath);

            console.log(`Compressed PDF saved at: ${outputFilePath}`);
            logger.info(`Compressed PDF saved at: ${outputFilePath}`);
            console.log('-----------------------------------------------------');
            logger.info('-----------------------------------------------------');

        } catch (err) {
            console.log(`Exception encountered while compressing ${inputFilePath}:`, err);
            logger.error(`Exception encountered while compressing ${inputFilePath}:`, err);
        }

    } catch (err) {
        console.log("Exception encountered while executing operation", err);
        logger.error("Exception encountered while executing operation", err);
    }


}




//--------------------ILove pdf compression----------------------------

async function compressPDFUsingILovePDF(inputFilePath, outputFilePath) {
    try {

        const instance = new ILovePDFApi('<PUBLIC_KEY>', '<SECRET_KEY>');
        // Check if the file is not a directory

        const task = instance.newTask('compress');
        await task.start();
        console.log("Task started in ILovePDF");
        logger.info("Task started in ILovePDF")
        const file = new ILovePDFFile(inputFilePath);
        await task.addFile(file);
        logger.info("Task file added in ILovePDF")
        await task.process();
        const compressedData = await task.download();
        logger.info("file compressed")


        fs.writeFileSync(outputFilePath, compressedData);
        console.log(`compressed and saved as ${outputFilePath}`);
        logger.info(`compressed and saved as ${outputFilePath}`);
        console.log('-----------------------------------------------------');
        logger.info('-----------------------------------------------------');



    } catch (error) {
        console.error('An error occurred:', error);
        logger.error('An error occurred:', error);
    }

}







//--------------------pdf Comparision ----------------------------

async function processFolder(inputFolderPath, outputFolderPath) {  
    try {
        // Check if the input directory exists
        if (!fs.existsSync(inputFolderPath)) {
            console.log(`Input directory does not exist: ${inputFolderPath}`);
            logger.info(`Input directory does not exist: ${inputFolderPath}`);
            return;
        }

        // Check if the output directory exists
        if (!fs.existsSync(outputFolderPath)) {
            await mkdirAsync(outputFolderPath, { recursive: true });
            console.log(`Directory created: ${outputFolderPath}`);
            logger.info(`Directory created: ${outputFolderPath}`);
        } else {
            console.log(`Directory already exists: ${outputFolderPath}`);
            logger.info(`Directory already exists: ${outputFolderPath}`)
        }

        const files = fs.readdirSync(inputFolderPath);

        for (const file of files) {
            const filePath = `${inputFolderPath}/${file}`;
            const stats = fs.statSync(filePath);
            const fileSizeInBytes = stats.size;
            const outputFilePath = `${outputFolderPath}/${file}`;

            if (fileSizeInBytes < 97 * 1024 * 1024) {
                console.log(`PDF is less than 97MB, compressing using Adobe: ${file}`);
                logger.info(`PDF is less than 97MB, compressing using Adobe: ${file}`);
                await compressPDFUsingAdobe(filePath, outputFilePath);
            } else {
                console.log(`PDF is greater than 97MB, compressing using ILovePDF: ${file}`);
                logger.info(`PDF is greater than 97MB, compressing using ILovePDF: ${file}`);
                await compressPDFUsingILovePDF(filePath, outputFilePath);
            }
        }

        console.log(`All files in ${inputFolderPath} compressed and saved successfully to ${outputFolderPath}`);
        logger.info(`All files in ${inputFolderPath} compressed and saved successfully to ${outputFolderPath}`);
    } catch (error) {
        console.error(`An error occurred for ${inputFolderPath}:`, error.message);
        logger.error(`An error occurred for ${inputFolderPath}:`, error.message);
    }
}






//--------------------pdf uploading in blob----------------------------

async function uploadPDFs(outputFolderspath) {
    //Date
    const currentDate = moment().format('DD-MM-YYYY');
    //const currentDate ='28-10-2023';
    const tomorrowDate = moment().add(1, 'days').format('YYYY-MM-DD');

    const currentMonth = moment().format('MMMM');
    const nextMonth = moment().add(1, 'months').format('MMMM');

    const currentyear = moment().format('YYYY');
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const uploadedFileUrls = []; // Store the URLs of uploaded files

    for (const folderPath of outputFolderspath) {
        // Check if the output directory exists
        if (!fs.existsSync(folderPath)) {
            console.log(`Output directory does not exist: ${folderPath}`);
            logger.info(`Output directory does not exist: ${folderPath}`);
            continue; // Skip to the next folder if it doesn't exist
        }

        const folderName = path.basename(folderPath);
        const files = await fs.promises.readdir(folderPath);

        const pdfFiles = files.filter((file) => path.extname(file).toLowerCase() === '.pdf');

        if (pdfFiles.length > 0) {
            for (const pdfFile of pdfFiles) {
                const sourceFilePath = path.join(folderPath, pdfFile);
                const targetBlobName = `MultipleViewPdf/${currentDate}/${folderName}/${pdfFile}`;

                const blockBlobClient = containerClient.getBlockBlobClient(targetBlobName);

                try {
                    const fileData = await fs.promises.readFile(sourceFilePath);
                    await blockBlobClient.upload(fileData, fileData.length, {
                        blobHTTPHeaders: { blobContentType: 'application/pdf' }
                    });

                    console.log(`Uploaded ${pdfFile} to ${folderName} in Azure Blob Storage.`);
                    logger.info(`Uploaded ${pdfFile} to ${folderName} in Azure Blob Storage.`);

                    // Push the URL of the uploaded file to the array
                    uploadedFileUrls.push(blockBlobClient.url);
                } catch (error) {
                    console.error(`Error uploading ${pdfFile}:`, error);
                    logger.error(`Error uploading ${pdfFile}:`, error);
                }
            }
        } else {
            console.log(`No PDF files found in ${folderName}.`);
            logger.info(`No PDF files found in ${folderName}.`)
        }
    }

    return uploadedFileUrls; // Return the array of uploaded file URLs
}




async function main() {
    try {

        //Date
        const currentDate = moment().format('DD-MM-YYYY');
        //const currentDate ='28-10-2023';
        const tomorrowDate = moment().add(1, 'days').format('YYYY-MM-DD');

        const currentMonth = moment().format('MMMM');
        const nextMonth = moment().add(1, 'months').format('MMMM');

        const currentyear = moment().format('YYYY');

        const inputFolders = [
            `D:\\Exact_files\\${currentyear}\\${currentMonth}\\${currentDate}\\TAMILTH\\Combined`,
            `D:\\Exact_files\\${currentyear}\\${currentMonth}\\${currentDate}\\TAMTHAF_Combined`,
            `D:\\Exact_files\\${currentyear}\\${currentMonth}\\${currentDate}\\TAMTHAF_Edition2_Combined`,
            `D:\\Exact_files\\${currentyear}\\${currentMonth}\\${currentDate}\\TAMTHEF_Combined`,
            `D:\\Exact_files\\${currentyear}\\${currentMonth}\\${currentDate}\\TAMTHEF_Edition2_Combined`,
            `D:\\Exact_files\\${currentyear}\\${currentMonth}\\${currentDate}\\TAMTHEdition_combined`,
        ];

        const outputFolders = [
            `D:\\website_dev\\Hindu_epaper\\server\\Hindu_Tamil\\${currentDate}\\HinduTamilThisai`,
            `D:\\website_dev\\Hindu_epaper\\server\\Hindu_Tamil\\${currentDate}\\Supplementary`,
            `D:\\website_dev\\Hindu_epaper\\server\\Hindu_Tamil\\${currentDate}\\Supplementary_2`,
            `D:\\website_dev\\Hindu_epaper\\server\\Hindu_Tamil\\${currentDate}\\Supplementary_1`,
            `D:\\website_dev\\Hindu_epaper\\server\\Hindu_Tamil\\${currentDate}\\Supplementary_3`,
            `D:\\website_dev\\Hindu_epaper\\server\\Hindu_Tamil\\${currentDate}\\HinduTamilThisai_1`,
        ];

        if (inputFolders.length !== outputFolders.length) {
            console.error('Input and output folder arrays must have the same length.');
            logger.error('Input and output folder arrays must have the same length.');
            return;
        }

        for (let i = 0; i < inputFolders.length; i++) {
            await processFolder(inputFolders[i], outputFolders[i]);
        }

        console.log('All folders processed successfully.');
        logger.info('All folders processed successfully.');

        // Upload PDFs to Azure Blob Storage and get the URLs
        const uploadedUrls = await uploadPDFs(outputFolders);

        console.log('All PDFs uploaded to Azure Blob Storage.');
        logger.info('All PDFs uploaded to Azure Blob Storage.');

        // Log the URLs
        for (const url of uploadedUrls) {
            console.log(`Uploaded File URL: ${url}`);
            logger.info(`Uploaded File URL: ${url}`);
        }

        await sendEmail("Regarding for HinduTamil pdf compressed & uploading Success", "All functions executed successfully!..Hindutamil epaper Compressed and uploaded sucessfully");
    } catch (error) {
        console.error('An error occurred:', error.message);
        logger.error('An error occurred:', error.message);
        await sendEmail("Regarding for HinduTamil pdf compressed & uploading Success", `Error during pdf compressing and uploading operation: ${error.message}`);

    }
    taskStatus=3;
}




const job = schedule.scheduleJob('07 13 * * *', async () => {
    console.log('Scheduled job is running...');
    main();
    taskStatus = 1; 
});


app.get('/', (req, res) => {
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleString(); // Format the date as a string
    let responseMessage = '';

    if (taskStatus === 1) {
        responseMessage = `<h1>Hindutamil Pdfcompression Operation is running...</h1>`;
    } else if (taskStatus === 2) {
        responseMessage = `<h1>Hindutamil Pdfcompression scheduled time is 3:35 AM</h1>`;
    } else if (taskStatus === 3) {
        responseMessage = `<h1>Hindutamil Pdfcompression Operation is completed Today..Please wait for the next day.</h1>`;
    }

    // Include the current date and time in the response
    responseMessage += `<h2>Current date and time: ${formattedDate}</h2>`;
    
    res.send(responseMessage);
});





const port = 7800;
app.listen(port, () => console.log(`Server is running on: http://localhost:${port}`));