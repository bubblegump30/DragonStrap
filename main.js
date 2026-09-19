'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { SettingsStore } = require('./src/services/settings-store');
const { RobloxInstallationService } = require('./src/services/roblox-installation');
const { LaunchService } = require('./src/services/launch-service');
const { LaunchTargetService } = require('./src/services/launch-target-service');
const { LaunchHistoryStore } = require('./src/services/launch-history-store');
const { PerformanceService } = require('./src/services/performance-service');
const { FastFlagService } = require('./src/services/fastflag-service');
const { FastFlagPresetStore } = require('./src/services/fastflag-preset-store');
const { ServerIntelligenceService } = require('./src/services/server-intelligence-service');
const { StudioService } = require('./src/services/studio-service');
const { StudioProjectHistoryStore } = require('./src/services/studio-project-history-store');
const { ChannelVersionService } = require('./src/services/channel-version-service');
const { MaintenanceService } = require('./src/services/maintenance-service');
const { UpdateService } = require('./src/services/update-service');
const { ReliabilityService } = require('./src/services/reliability-service');

let settingsStore;
let robloxService;
let launchService;
let launchTargetService;
let launchHistoryStore;
let performanceService;
let fastFlagService;
let fastFlagPresetStore;
let serverIntelligenceService;
let studioService;
let studioProjectHistoryStore;
let channelVersionService;
let maintenanceService;
let updateService;
let reliabilityService;
let mainWindow = null;

function maybeMinimizeSourceWindow(event, launchResult) {
  if (!launchResult?.ok || !settingsStore.getAll().minimizeOnLaunch) return;
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) win.minimize();
}

function registerIpc() {
  ipcMain.handle('dragonstrap:app-info', () => ({
    name: 'DragonStrap', version: app.getVersion(), platform: process.platform, architecture: process.arch,
    packaged: app.isPackaged, electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node
  }));
  ipcMain.handle('dragonstrap:reliability-state', () => reliabilityService.getState());
  ipcMain.handle('dragonstrap:reliability-open-logs', async () => {
    const target = reliabilityService.getState().logsDir;
    const error = await shell.openPath(target);
    return error ? { ok:false, code:'OPEN_FAILED', message:error } : { ok:true, path:target };
  });
  ipcMain.handle('dragonstrap:updates-state', () => updateService.getState(settingsStore.getAll().updateChannel));
  ipcMain.handle('dragonstrap:updates-check', async () => {
    const result = await updateService.check(settingsStore.getAll().updateChannel);
    reliabilityService.log(result.ok ? 'info' : 'warn', 'update-check', { code:result.code || null, currentVersion:result.currentVersion, latestVersion:result.latestVersion || null, updateAvailable:result.updateAvailable === true });
    return result;
  });
  ipcMain.handle('dragonstrap:updates-open-release', async () => {
    const result = updateService.lastResult;
    if (!result?.releaseUrl || !/^https:\/\/github\.com\//i.test(result.releaseUrl)) return { ok:false, code:'RELEASE_URL_UNAVAILABLE', message:'No verified DragonStrap release page is available yet.' };
    await shell.openExternal(result.releaseUrl);
    return { ok:true, url:result.releaseUrl };
  });

  ipcMain.handle('dragonstrap:roblox-status', async () => {
    const status = await robloxService.getStatus();
    status.channel = channelVersionService.displayChannel(settingsStore.getAll().channel);
    return status;
  });
  ipcMain.handle('dragonstrap:settings-get', () => settingsStore.getAll());
  ipcMain.handle('dragonstrap:settings-update', (_event, patch) => settingsStore.update(patch));
  ipcMain.handle('dragonstrap:channel-version-state', async (_event, channel = null) => {
    const selected = channel === null || channel === undefined ? settingsStore.getAll().channel : channel;
    return channelVersionService.getState(await robloxService.getStatus(), selected);
  });
  ipcMain.handle('dragonstrap:channel-version-select', async (_event, channel) => {
    const validation = channelVersionService.validateChannel(channel);
    if (!validation.ok) return validation;
    const state = await channelVersionService.getState(await robloxService.getStatus(), validation.channel);
    if (!state.player?.ok) {
      return { ok:false, code:state.player?.code || 'CHANNEL_UNAVAILABLE', message:state.player?.message || 'The selected Player channel could not be verified.', state };
    }
    const settings = settingsStore.update({ channel:validation.channel });
    return { ok:true, channel:settings.channel, displayChannel:channelVersionService.displayChannel(settings.channel), state };
  });
  ipcMain.handle('dragonstrap:channel-open-install-folder', async (_event, kind) => {
    const status = await robloxService.getStatus();
    const filePath = kind === 'studio' ? status.studioPath : (kind === 'player' ? status.playerPath : null);
    if (!filePath || !fs.existsSync(filePath)) return { ok:false, code:'INSTALL_NOT_FOUND', message:'The requested Roblox installation was not detected.' };
    const folder = path.dirname(filePath);
    const error = await shell.openPath(folder);
    return error ? { ok:false, code:'OPEN_FAILED', message:error } : { ok:true, path:folder };
  });
  ipcMain.handle('dragonstrap:launch-history-get', () => launchHistoryStore.getAll());
  ipcMain.handle('dragonstrap:launch-history-clear', () => launchHistoryStore.clear());
  ipcMain.handle('dragonstrap:performance-state', async () => performanceService.getState(await robloxService.getStatus()));
  ipcMain.handle('dragonstrap:performance-apply', async () => performanceService.apply(await robloxService.getStatus(), settingsStore.getAll()));
  ipcMain.handle('dragonstrap:performance-restore', async () => performanceService.restore(await robloxService.getStatus()));


  ipcMain.handle('dragonstrap:server-intelligence-lookup', async (_event, target, options = {}) => {
    return serverIntelligenceService.lookup(target, { force:options?.force === true });
  });
  ipcMain.handle('dragonstrap:server-intelligence-clear-cache', (_event, placeId) => {
    serverIntelligenceService.clearCache(placeId || null);
    return { ok:true };
  });

  ipcMain.handle('dragonstrap:fastflags-state', async () => fastFlagService.getState(await robloxService.getStatus()));
  ipcMain.handle('dragonstrap:fastflags-apply', async (_event, patch) => fastFlagService.applyPatch(await robloxService.getStatus(), patch));
  ipcMain.handle('dragonstrap:fastflags-restore-backup', async () => fastFlagService.restoreBackup(await robloxService.getStatus()));
  ipcMain.handle('dragonstrap:fastflags-export', async event => {
    const status = await robloxService.getStatus();
    const result = fastFlagService.exportObject(status);
    if (!result.ok) return result;
    const win = BrowserWindow.fromWebContents(event.sender);
    const picked = await dialog.showSaveDialog(win, {
      title: 'Export DragonStrap FastFlags',
      defaultPath: 'DragonStrap-FastFlags.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (picked.canceled || !picked.filePath) return { ok:false, canceled:true };
    fs.writeFileSync(picked.filePath, `${JSON.stringify(result.data, null, 2)}
`, 'utf8');
    return { ok:true, filePath:picked.filePath, count:Object.keys(result.data).length };
  });
  ipcMain.handle('dragonstrap:fastflags-import', async event => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const picked = await dialog.showOpenDialog(win, {
      title: 'Import FastFlags',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (picked.canceled || picked.filePaths.length === 0) return { ok:false, canceled:true };
    try {
      const text = fs.readFileSync(picked.filePaths[0], 'utf8');
      if (text.length > 2_000_000) return { ok:false, code:'IMPORT_TOO_LARGE', message:'FastFlag import files are limited to 2 MB.' };
      const data = JSON.parse(text);
      const preview = fastFlagService.previewImport(data);
      return { ...preview, filePath:picked.filePaths[0] };
    } catch (error) {
      return { ok:false, code:'IMPORT_FAILED', message:error.message };
    }
  });
  ipcMain.handle('dragonstrap:fastflags-presets-list', () => fastFlagPresetStore.list());
  ipcMain.handle('dragonstrap:fastflags-preset-save', async (_event, name) => {
    const editable = fastFlagService.getEditableObject(await robloxService.getStatus());
    if (!editable.ok) return editable;
    try { return { ok:true, preset:fastFlagPresetStore.save(name, editable.data), items:fastFlagPresetStore.list() }; }
    catch(error){ return { ok:false, code:'PRESET_SAVE_FAILED', message:error.message }; }
  });
  ipcMain.handle('dragonstrap:fastflags-preset-get', (_event, id) => {
    const preset = fastFlagPresetStore.get(id);
    return preset ? { ok:true, preset } : { ok:false, code:'PRESET_NOT_FOUND', message:'FastFlag preset was not found.' };
  });
  ipcMain.handle('dragonstrap:fastflags-preset-delete', (_event, id) => fastFlagPresetStore.delete(id));
  ipcMain.handle('dragonstrap:fastflags-show-file', async () => {
    const state = fastFlagService.getState(await robloxService.getStatus());
    if (!state.ok) return state;
    if (fs.existsSync(state.path)) shell.showItemInFolder(state.path);
    else await shell.openPath(path.dirname(state.path));
    return { ok:true, path:state.path };
  });

  ipcMain.handle('dragonstrap:maintenance-state', async () => {
    const status = await robloxService.getStatus();
    return maintenanceService.getState(status, { name:'DragonStrap', version:app.getVersion(), platform:process.platform, architecture:process.arch });
  });
  ipcMain.handle('dragonstrap:maintenance-clear-cache', async (_event, scope = 'all') => {
    const result = maintenanceService.clearCache(String(scope || 'all'));
    return { ...result, state:maintenanceService.getState(await robloxService.getStatus(), { name:'DragonStrap', version:app.getVersion(), platform:process.platform, architecture:process.arch }) };
  });
  ipcMain.handle('dragonstrap:maintenance-clear-old-logs', async (_event, days = 7) => {
    const result = maintenanceService.clearOldLogs(days);
    return { ...result, state:maintenanceService.getState(await robloxService.getStatus(), { name:'DragonStrap', version:app.getVersion(), platform:process.platform, architecture:process.arch }) };
  });
  ipcMain.handle('dragonstrap:maintenance-repair-client-settings', async () => {
    const result = maintenanceService.repairClientSettings(await robloxService.getStatus());
    return { ...result, state:maintenanceService.getState(await robloxService.getStatus(), { name:'DragonStrap', version:app.getVersion(), platform:process.platform, architecture:process.arch }) };
  });
  ipcMain.handle('dragonstrap:maintenance-export-diagnostics', async event => {
    const status = await robloxService.getStatus();
    const report = maintenanceService.buildDiagnosticReport(status, { name:'DragonStrap', version:app.getVersion(), platform:process.platform, architecture:process.arch });
    const win = BrowserWindow.fromWebContents(event.sender);
    const picked = await dialog.showSaveDialog(win, {
      title:'Export DragonStrap Diagnostics',
      defaultPath:`DragonStrap-Diagnostics-${new Date().toISOString().slice(0,10)}.json`,
      filters:[{ name:'JSON', extensions:['json'] }]
    });
    if (picked.canceled || !picked.filePath) return { ok:false, canceled:true };
    fs.writeFileSync(picked.filePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return { ok:true, filePath:picked.filePath };
  });
  ipcMain.handle('dragonstrap:maintenance-open-location', async (_event, kind) => {
    const status = await robloxService.getStatus();
    const state = maintenanceService.getState(status, { name:'DragonStrap', version:app.getVersion(), platform:process.platform, architecture:process.arch });
    const targets = {
      roblox:state.paths.robloxRoot, logs:state.paths.logsRoot, data:state.paths.dragonStrapData,
      versions:state.paths.versionsRoot, player:status.playerPath ? path.dirname(status.playerPath) : null,
      studio:status.studioPath ? path.dirname(status.studioPath) : null
    };
    const target = targets[String(kind || '')] || null;
    if (!target || !fs.existsSync(target)) return { ok:false, code:'LOCATION_NOT_FOUND', message:'The requested folder is not available.' };
    const error = await shell.openPath(target);
    return error ? { ok:false, code:'OPEN_FAILED', message:error } : { ok:true, path:target };
  });

  ipcMain.handle('dragonstrap:studio-center-state', async () => {
    const status = await robloxService.getStatus();
    const locations = studioService.getLocations(status);
    const projects = studioProjectHistoryStore.getAll().map(item => ({
      ...item,
      exists: studioService.validateProjectPath(item.path).ok
    }));
    return { ok:true, installed:Boolean(status.studioInstalled), version:status.studioVersion, locations, projects };
  });

  ipcMain.handle('dragonstrap:studio-project-choose-launch', async event => {
    const status = await robloxService.getStatus();
    if (!status.studioInstalled) return { ok:false, code:'STUDIO_NOT_FOUND', message:'Roblox Studio was not detected.' };
    const win = BrowserWindow.fromWebContents(event.sender);
    const picked = await dialog.showOpenDialog(win, {
      title: 'Open Roblox Studio Project',
      properties: ['openFile'],
      filters: [
        { name: 'Roblox Studio Projects', extensions: ['rbxl', 'rbxlx'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    if (picked.canceled || picked.filePaths.length === 0) return { ok:false, canceled:true };
    const validation = studioService.validateProjectPath(picked.filePaths[0]);
    if (!validation.ok) return validation;
    const result = launchService.launchStudio(status, { projectPath:validation.path });
    const profile = settingsStore.getAll().launchProfile || 'studio';
    const historyItem = launchHistoryStore.add({
      type:'studio-project', label:validation.name, target:validation.path, profile, ok:result.ok,
      message:result.ok ? null : result.message
    });
    const projectItem = result.ok ? studioProjectHistoryStore.add(validation.path) : null;
    maybeMinimizeSourceWindow(event, result);
    return { ...result, project:projectItem, historyItem };
  });

  ipcMain.handle('dragonstrap:studio-project-launch-recent', async (event, id) => {
    const stored = studioProjectHistoryStore.get(String(id || ''));
    if (!stored) return { ok:false, code:'PROJECT_NOT_FOUND', message:'Recent Studio project was not found.' };
    const validation = studioService.validateProjectPath(stored.path);
    if (!validation.ok) return validation;
    const status = await robloxService.getStatus();
    const result = launchService.launchStudio(status, { projectPath:validation.path });
    const profile = settingsStore.getAll().launchProfile || 'studio';
    const historyItem = launchHistoryStore.add({
      type:'studio-project', label:validation.name, target:validation.path, profile, ok:result.ok,
      message:result.ok ? null : result.message
    });
    const projectItem = result.ok ? studioProjectHistoryStore.add(validation.path) : null;
    maybeMinimizeSourceWindow(event, result);
    return { ...result, project:projectItem, historyItem };
  });

  ipcMain.handle('dragonstrap:studio-history-clear', () => studioProjectHistoryStore.clear());

  ipcMain.handle('dragonstrap:studio-open-install-folder', async () => {
    const status = await robloxService.getStatus();
    const target = studioService.getLocations(status).installDir;
    if (!target || !fs.existsSync(target)) return { ok:false, code:'STUDIO_NOT_FOUND', message:'Studio install folder is unavailable.' };
    const error = await shell.openPath(target);
    return error ? { ok:false, code:'OPEN_FAILED', message:error } : { ok:true, path:target };
  });

  ipcMain.handle('dragonstrap:studio-open-logs-folder', async () => {
    const status = await robloxService.getStatus();
    const target = studioService.getLocations(status).logsDir;
    if (!target || !fs.existsSync(target)) return { ok:false, code:'LOGS_NOT_FOUND', message:'Roblox logs folder is unavailable.' };
    const error = await shell.openPath(target);
    return error ? { ok:false, code:'OPEN_FAILED', message:error } : { ok:true, path:target };
  });

  ipcMain.handle('dragonstrap:launch-player', async (event, options = {}) => {
    const normalized = launchTargetService.normalize(options.target, options.gameInstanceId);
    if (!normalized.ok) return normalized;

    const status = await robloxService.getStatus();
    const currentSettings = settingsStore.getAll();
    const performance = currentSettings.performanceAutoApply
      ? performanceService.apply(status, currentSettings)
      : { ok: true, skipped: true };
    const result = launchService.launchPlayer(status, { uri: normalized.uri });
    const profile = settingsStore.getAll().launchProfile || 'default';
    const historyItem = launchHistoryStore.add({
      type: normalized.kind,
      label: normalized.label,
      target: normalized.uri,
      profile,
      ok: result.ok,
      message: result.ok ? null : result.message
    });

    maybeMinimizeSourceWindow(event, result);
    return { ...result, target: normalized, historyItem, performance };
  });

  ipcMain.handle('dragonstrap:launch-studio', async event => {
    const status = await robloxService.getStatus();
    const result = launchService.launchStudio(status);
    const profile = settingsStore.getAll().launchProfile || 'default';
    const historyItem = launchHistoryStore.add({
      type: 'studio', label: 'Roblox Studio', target: null, profile, ok: result.ok,
      message: result.ok ? null : result.message
    });
    maybeMinimizeSourceWindow(event, result);
    return { ...result, historyItem };
  });

  ipcMain.handle('dragonstrap:open-data-folder', async () => {
    await shell.openPath(app.getPath('userData'));
    return { ok: true };
  });
}

function createWindow() {
  const appIcon = path.join(__dirname, 'assets', process.platform === 'win32' ? 'DragonStrap.ico' : 'DragonStrap.png');
  const win = new BrowserWindow({
    width: 1600, height: 980, minWidth: 1180, minHeight: 760,
    backgroundColor: '#09070f', title: 'DragonStrap', icon: appIcon,
    autoHideMenuBar: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  mainWindow = win;

  win.webContents.setWindowOpenHandler(() => ({ action:'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });
  win.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  win.webContents.on('render-process-gone', (_event, details) => reliabilityService?.log('error','render-process-gone',details));
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame) reliabilityService?.log('error','did-fail-load',{errorCode,errorDescription,validatedURL:String(validatedURL || '').slice(0,1000)});
  });
  win.on('unresponsive', () => reliabilityService?.log('warn','window-unresponsive'));
  win.on('responsive', () => reliabilityService?.log('info','window-responsive'));
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  return win;
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    if (process.platform === 'win32') app.setAppUserModelId('DragonStrap');
    const userData = app.getPath('userData');
    reliabilityService = new ReliabilityService(userData, { version:app.getVersion() });
    reliabilityService.initialize();
    process.on('uncaughtException', error => {
      reliabilityService?.recordError('uncaught-exception', error);
      app.exit(1);
    });
    process.on('unhandledRejection', reason => reliabilityService?.recordError('unhandled-rejection', reason instanceof Error ? reason : new Error(String(reason))));

    settingsStore = new SettingsStore(userData);
    robloxService = new RobloxInstallationService();
    launchService = new LaunchService();
    launchTargetService = new LaunchTargetService();
    launchHistoryStore = new LaunchHistoryStore(userData);
    performanceService = new PerformanceService();
    fastFlagService = new FastFlagService();
    fastFlagPresetStore = new FastFlagPresetStore(userData);
    serverIntelligenceService = new ServerIntelligenceService({ version:app.getVersion() });
    studioService = new StudioService();
    studioProjectHistoryStore = new StudioProjectHistoryStore(userData);
    channelVersionService = new ChannelVersionService();
    maintenanceService = new MaintenanceService({ userData });
    updateService = new UpdateService({ currentVersion:app.getVersion(), configPath:path.join(__dirname,'release.config.json') });
    registerIpc();
    createWindow();
    reliabilityService.log('info','app-ready',{packaged:app.isPackaged,electron:process.versions.electron,arch:process.arch});
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });

  app.on('before-quit', () => reliabilityService?.markCleanExit());
  app.on('child-process-gone', (_event, details) => reliabilityService?.log('error','child-process-gone',details));
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
