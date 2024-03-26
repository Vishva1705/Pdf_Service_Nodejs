const express = require("express");
const fs = require("fs");
const path = require("path");
const util = require('util');
const moment = require('moment');
const PDFServicesSdk = require("@adobe/pdfservices-node-sdk");
const ILovePDFApi = require('@ilovepdf/ilovepdf-nodejs');
const ILovePDFFile = require('@ilovepdf/ilovepdf-nodejs/ILovePDFFile');
const { BlobServiceClient } = require('@azure/storage-blob');
const nodemailer = require('nodemailer');
const logger = require('./logger');


const app = express();

const mkdirAsync = util.promisify(fs.mkdir);


//Blob Connection
const connectionString = ' < your blob Connection string> ';
const containerName = 'httepaper';

//Date
//const currentDate = moment().format('DD-MM-YYYY');
const currentDate ='14-11-2023';
const tomorrowDate = moment().add(1, 'days').format('YYYY-MM-DD');

const currentMonth = moment().format('MMMM'); 
const nextMonth = moment().add(1, 'months').format('MMMM')


// async function uploadPDFs() {
//     const outputFolderspath = [
//         'D:\\website_dev\\Hindu_epaper\\server\\Hindu_Tamil\\22-09-2023\\HinduTamilThisai',
//         'D:\\website_dev\\Hindu_epaper\\server\\Hindu_Tamil\\22-09-2023\\Supplementary',
//         'D:\\website_dev\\Hindu_epaper\\server\\Hindu_Tamil\\22-09-2023\\SupplementaryOne',
//         'D:\\website_dev\\Hindu_epaper\\server\\Hindu_Tamil\\22-09-2023\\NewEdition',
//     ];

//     const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
//     const containerClient = blobServiceClient.getContainerClient(containerName);

//     for (const folderPath of outputFolderspath) {
//         const folderName = path.basename(folderPath);
//         const files = await fs.promises.readdir(folderPath);

//         const pdfFiles = files.filter((file) => path.extname(file).toLowerCase() === '.pdf');

//         if (pdfFiles.length > 0) {
//             for (const pdfFile of pdfFiles) {
//                 const sourceFilePath = path.join(folderPath, pdfFile);
//                 const targetBlobName = `HindutamilTesting/22-09-2023/${folderName}/${pdfFile}`;

//                 const blockBlobClient = containerClient.getBlockBlobClient(targetBlobName);

//                 try {
//                     const fileData = await fs.promises.readFile(sourceFilePath);
//                     await blockBlobClient.upload(fileData, fileData.length, {
//                         blobHTTPHeaders: { blobContentType: 'application/pdf' }
//                     });

//                     console.log(`Uploaded ${pdfFile} to ${folderName} in Azure Blob Storage.`);
//                 } catch (error) {
//                     console.error(`Error uploading ${pdfFile}:`, error);
//                 }
//             }
//         } else {
//             console.log(`No PDF files found in ${folderName}.`);
//         }
//     }
// }

// uploadPDFs().catch((error) => {
//     console.error('Error:', error);
// });


//--------------------pdf uploading in blob----------------------------

async function uploadPDFs(outputFolderspath) {
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

    const outputFolders = [
        `D:\\Htt_Epaper\\CompressHindupdf\\${currentDate}\\HinduTamilThisai`,
        `D:\\Htt_Epaper\\CompressHindupdf\\${currentDate}\\Supplementary`,
        `D:\\Htt_Epaper\\CompressHindupdf\\${currentDate}\\Supplementary_1`,
        `D:\\Htt_Epaper\\CompressHindupdf\\${currentDate}\\HinduTamilThisai_1`,
    ];

    // Upload PDFs to Azure Blob Storage and get the URLs
    const uploadedUrls = await uploadPDFs(outputFolders);

    console.log('All PDFs uploaded to Azure Blob Storage.');
    logger.info('All PDFs uploaded to Azure Blob Storage.');
    
    // Log the URLs
    for (const url of uploadedUrls) {
        console.log(`Uploaded File URL: ${url}`);
        logger.info(`Uploaded File URL: ${url}`);
    }
}


main()

app.get('/', (req, res) => {
    res.send("Hindu Tamil  PDF_compression is running ");
});

const port = 7700;
app.listen(port, () => console.log(`Server is running on...http://localhost:${port}`));
