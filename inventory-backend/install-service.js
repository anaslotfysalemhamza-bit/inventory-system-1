const Service = require('node-windows').Service; 
 
const svc = new Service({ 
  name: 'InventoryBackend', 
  description: 'Inventory Management System Backend (with XAMPP MySQL)', 
  script: require('path').join(__dirname, 'server.js'), 
  nodeOptions: ['--harmony', '--max_old_space_size=4096'], 
  env: [{ 
    name: 'NODE_ENV', 
    value: 'production' 
  }], 
  wait: 5, 
  grow: 0.5 
}); 
 
svc.on('install', function() { 
  console.log('Backend service installed successfully!'); 
  console.log('Starting service...'); 
  svc.start(); 
}); 
 
svc.on('alreadyinstalled', function() { 
  console.log('Service already installed. Restarting...'); 
  svc.restart(); 
}); 
 
svc.on('start', function() { 
  console.log('Service started successfully!'); 
}); 
 
svc.install(); 
