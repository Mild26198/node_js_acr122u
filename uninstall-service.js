const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'NodeJS ACR122U Service',
  script: path.join(__dirname, 'server.js')
});

svc.on('uninstall', function() {
  console.log('Service uninstalled successfully');
});

svc.on('error', function(err) {
  console.log('Service error:', err);
});

console.log('Uninstalling service...');
svc.uninstall(); 