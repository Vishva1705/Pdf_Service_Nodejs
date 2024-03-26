var Service = require('node-windows').Service;

// Create a new service object
var svc = new Service({
  name:'Hindutamil_SingleView_paper',
  description: 'Pdf_service for VK newspaper',
  script: 'D:\\Node code\\Two_way\\compress.js',
  execPath: 'C:\\Program Files\\nodejs\\node.exe'
});


// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install',function(){
    console.log('install complete.');
    console.log('The service exists: ',svc.exists);
  });

// Uninstall the service.
svc.install();




