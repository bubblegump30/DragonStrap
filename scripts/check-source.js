'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const required = [
  'main.js', 'preload.js', 'package.json',
  'renderer/index.html', 'renderer/styles.css', 'renderer/purple-dragon.css', 'renderer/reliability.css', 'renderer/fastflags.css', 'renderer/servers.css', 'renderer/studio.css', 'renderer/channels.css', 'renderer/maintenance.css', 'renderer/app.js',
  'renderer/assets/logo.svg', 'renderer/assets/dragon-app-icon.png', 'assets/DragonStrap.ico', 'assets/DragonStrap.png', 'src/services/settings-store.js',
  'src/services/roblox-installation.js', 'src/services/launch-service.js',
  'src/services/fastflag-service.js', 'src/services/fastflag-preset-store.js', 'src/services/performance-service.js',
  'src/services/launch-target-service.js', 'src/services/launch-history-store.js', 'src/services/server-intelligence-service.js',
  'src/services/studio-service.js', 'src/services/studio-project-history-store.js', 'src/services/channel-version-service.js', 'src/services/maintenance-service.js', 'src/services/update-service.js', 'src/services/reliability-service.js', 'release.config.json'
];
const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`Missing required files:\n${missing.join('\n')}`);
  process.exit(1);
}
console.log('DragonStrap source check passed.');
