const Service = require('node-windows').Service;
const path = require('path');

// สร้าง service object
const svc = new Service({
  name: 'NodeJS ACR122U Service',
  description: 'NFC Access Control Service using ACR122U',
  script: path.join(__dirname, 'server.js'),
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ],
  log: path.join(__dirname, 'service.log'),
  logOnInstall: true,
  workingDirectory: __dirname
});

// เมื่อ service ถูก install
svc.on('install', function() {
  console.log('Service installed successfully');
  svc.start();
  console.log('Service started successfully');
});

// เมื่อ service ถูก uninstall
svc.on('uninstall', function() {
  console.log('Service uninstalled successfully');
});

// เมื่อ service error
svc.on('error', function(err) {
  console.log('Service error:', err);
});

// เมื่อ service start
svc.on('start', function() {
  console.log('Service started');
});

// เมื่อ service stop
svc.on('stop', function() {
  console.log('Service stopped');
});

// Install service
console.log('Installing service...');
svc.install(); 