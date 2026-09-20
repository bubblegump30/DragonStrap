'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const required = [
  'main.js', 'preload.js', 'package.json',
  'renderer/index.html', 'renderer/styles.css', 'renderer/purple-dragon.css', 'renderer/dragon-2.css', 'renderer/reliability.css', 'renderer/update-center.css', 'renderer/fastflags.css', 'renderer/performance-center.css', 'renderer/servers.css', 'renderer/studio.css', 'renderer/profiles.css', 'renderer/channels.css', 'renderer/maintenance.css', 'renderer/app.js',
  'renderer/assets/logo.svg', 'renderer/assets/dragon-app-icon.png', 'assets/DragonStrap.ico', 'assets/DragonStrap.png', 'src/core/app-kernel.js', 'src/core/service-registry.js', 'src/core/operation-coordinator.js', 'src/core/bootstrap-pipeline.js', 'src/core/plugin-host.js', 'src/core/roblox-status-cache.js', 'src/core/api-contract.js', 'src/services/settings-store.js',
  'src/services/roblox-installation.js', 'src/services/launch-service.js', 'src/services/self-update-service.js', 'src/services/recovery-service.js',
  'src/services/configuration-profile-store.js', 'src/services/configuration-profile-service.js', 'src/services/fastflag-service.js', 'src/services/fastflag-preset-store.js', 'src/services/fastflag-snapshot-store.js', 'src/services/fastflag-metadata.js', 'src/services/performance-service.js', 'src/services/performance-center-service.js', 'src/services/performance-profile-store.js',
  'src/services/launch-target-service.js', 'src/services/launch-history-store.js', 'src/services/server-intelligence-service.js', 'src/services/server-intelligence-store.js',
  'src/services/studio-service.js', 'src/services/studio-project-history-store.js', 'src/services/studio-settings-store.js', 'src/services/studio-backup-service.js', 'src/services/studio-fastflag-service.js', 'src/services/channel-version-service.js', 'src/services/roblox-update-engine.js', 'src/services/maintenance-service.js', 'src/services/update-service.js', 'src/services/reliability-service.js', 'release.config.json'
];
const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`Missing required files:\n${missing.join('\n')}`);
  process.exit(1);
}
console.log('DragonStrap source check passed.');
