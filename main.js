'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { AppKernel } = require('./src/core/app-kernel');
const { CORE_API_VERSION, CORE_CHANNELS } = require('./src/core/api-contract');

let kernel;
let operationCoordinator;
let bootstrapPipeline;
let statusCache;
let settingsStore;
let robloxService;
let launchService;
let launchTargetService;
let launchHistoryStore;
let performanceService;
let performanceProfileStore;
let performanceCenterService;
let configurationProfileStore;
let configurationProfileService;
let fastFlagService;
let fastFlagPresetStore;
let fastFlagSnapshotStore;
let serverIntelligenceService;
let serverIntelligenceStore;
let studioService;
let studioProjectHistoryStore;
let studioSettingsStore;
let studioBackupService;
let studioFastFlagService;
let channelVersionService;
let maintenanceService;
let updateService;
let selfUpdateService;
let reliabilityService;
let robloxUpdateEngine;
let recoveryService;
let mainWindow = null;

const CONFIGURATION_PROFILE_SETTING_KEYS = new Set(['launchProfile','fpsCap','renderMode','msaaMode','performanceAutoApply','channel','minimizeOnLaunch','serverSort','serverOccupancy','serverFavoritesOnly','serverHideFull']);
function invalidateConfigurationProfileForPatch(patch) {
  if (!configurationProfileStore || !patch || typeof patch !== 'object') return;
  if (Object.keys(patch).some(key => CONFIGURATION_PROFILE_SETTING_KEYS.has(key))) configurationProfileStore.setActive(null);
}
function invalidateConfigurationProfile() { configurationProfileStore?.setActive(null); }

async function getRobloxStatus(options = {}) {
  if (statusCache) return statusCache.get(options);
  return robloxService.getStatus();
}

function maybeMinimizeSourceWindow(event, launchResult) {
  if (!launchResult?.ok || !settingsStore.getAll().minimizeOnLaunch) return;
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) win.minimize();
}

function formatStudioProjectState(item, info, backups) {
  const lastModified = info?.modifiedAt || null;
  const changedSinceLastOpen = Boolean(info?.ok && item?.lastKnownModifiedAt && lastModified && item.lastKnownModifiedAt !== lastModified);
  return {
    ...item,
    exists:Boolean(info?.ok),
    size:info?.ok ? info.size : Number(item?.lastKnownSize || 0),
    modifiedAt:lastModified,
    directory:info?.directory || null,
    changedSinceLastOpen,
    backupCount:backups.length,
    latestBackup:backups[0] || null,
    backups:backups.slice(0,5)
  };
}

async function buildStudioCenterState() {
  const status = await getRobloxStatus();
  const studioSettings = studioSettingsStore.getAll();
  const locations = studioService.getLocations(status);
  const projects = studioProjectHistoryStore.getAll().map(item => {
    const info = studioService.getProjectInfo(item.path);
    return formatStudioProjectState(item, info, studioBackupService.list(item.path));
  });
  const deploymentState = await channelVersionService.getState(status, studioSettings.channel);
  return {
    ok:true,
    installed:Boolean(status.studioInstalled),
    version:status.studioVersion,
    locations,
    projects,
    settings:studioSettings,
    launchProfiles:studioSettingsStore.getProfiles(),
    deployment:deploymentState?.studio || null,
    selectedChannel:channelVersionService.displayChannel(studioSettings.channel),
    fastFlags:studioFastFlagService.getState(status, studioSettings.fastFlagsEnabled)
  };
}

function prepareStudioProjectLaunch(projectPath, status) {
  const settings=studioSettingsStore.getAll();
  const profile=studioSettingsStore.getProfile();
  const info=studioService.getProjectInfo(projectPath);
  if (!info.ok) return { ok:false, validation:info, profile, backup:null };
  const shouldBackup=profile.backupMode === 'always' || (profile.backupMode === 'setting' && settings.autoBackup);
  const backup=shouldBackup ? studioBackupService.create(info.path,{ retention:settings.backupRetention, reason:`pre-launch-${profile.id}` }) : { ok:true, skipped:true };
  if (!backup.ok) return { ok:false, validation:info, profile, backup };
  return { ok:true, validation:info, profile, backup };
}


async function buildMaintenanceState() {
  const status=await getRobloxStatus();
  const base=maintenanceService.getState(status,{ name:'DragonStrap', version:app.getVersion(), platform:process.platform, architecture:process.arch });
  const recovery=recoveryService.getState(status,robloxUpdateEngine.getState());
  const updateRecovery=selfUpdateService.getRecoveryState();
  const rollback=robloxUpdateEngine.getRollbackState(status);
  const extraChecks=[
    { id:'player-integrity', label:'Player installation integrity', level:recovery.integrity.level === 'critical' ? 'error' : (recovery.integrity.level === 'warning' ? 'warn' : 'ok'), detail:recovery.integrity.level === 'healthy' ? 'Core Player structure passed integrity checks.' : (recovery.integrity.level === 'warning' ? 'Player structure has non-critical warnings.' : 'Player corruption or an invalid installation structure was detected.') },
    { id:'update-recovery', label:'Update recovery state', level:updateRecovery.healthy ? 'ok' : 'warn', detail:updateRecovery.healthy ? 'No interrupted DragonStrap self-update artifacts detected.' : `${updateRecovery.issues.length} self-update recovery issue${updateRecovery.issues.length===1?'':'s'} detected.` }
  ];
  const checks=[...(base.checks || []),...extraChecks];
  const errors=checks.filter(item=>item.level==='error').length;
  const warnings=checks.filter(item=>item.level==='warn').length;
  return { ...base, health:errors?'attention':(warnings?'warning':'healthy'), checks, recovery:{ ...recovery, update:updateRecovery, rollback }, reliability:reliabilityService.getState() };
}

function buildUpdateCenterState(baseResult = null) {
  const settings = settingsStore.getAll();
  const base = baseResult || updateService.getState(settings.updateChannel);
  const last = updateService.lastResult;
  const release = base?.latestVersion ? base : (last?.channel === base?.channel ? last : null);
  const combined = release && base !== release ? { ...base, ...release } : { ...base };
  const latestVersion = release?.latestVersion || null;
  const deferred = Boolean(
    latestVersion &&
    settings.updateDeferredVersion === latestVersion &&
    Number(settings.updateDeferredUntil || 0) > Date.now()
  );
  return {
    ...combined,
    deferred,
    deferredUntil:deferred ? settings.updateDeferredUntil : 0,
    selfUpdate:selfUpdateService.getState(release)
  };
}

function registerIpc() {
  ipcMain.handle('dragonstrap:app-info', () => ({
    name: 'DragonStrap', version: app.getVersion(), platform: process.platform, architecture: process.arch, coreApiVersion:CORE_API_VERSION,
    packaged: app.isPackaged, distribution:selfUpdateService?.getRuntimeInfo()?.label || (app.isPackaged ? 'Packaged' : 'Source / Dev'), electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node
  }));
  ipcMain.handle(CORE_CHANNELS.STATE, async () => ({ ...kernel.describe(), pipeline:await bootstrapPipeline.getState() }));
  ipcMain.handle('dragonstrap:reliability-state', () => reliabilityService.getState());
  ipcMain.handle('dragonstrap:reliability-open-logs', async () => {
    const target = reliabilityService.getState().logsDir;
    const error = await shell.openPath(target);
    return error ? { ok:false, code:'OPEN_FAILED', message:error } : { ok:true, path:target };
  });
  ipcMain.handle('dragonstrap:updates-state', () => buildUpdateCenterState());
  ipcMain.handle('dragonstrap:updates-check', async () => {
    const result = await updateService.check(settingsStore.getAll().updateChannel);
    reliabilityService.log(result.ok ? 'info' : 'warn', 'update-check', { code:result.code || null, currentVersion:result.currentVersion, latestVersion:result.latestVersion || null, updateAvailable:result.updateAvailable === true });
    return buildUpdateCenterState(result);
  });
  ipcMain.handle('dragonstrap:updates-download', async () => {
    const release = updateService.lastResult;
    const result = await bootstrapPipeline.downloadSelfUpdate();
    reliabilityService.log(result.ok ? 'info' : (result.canceled ? 'info' : 'warn'), 'self-update-download', { code:result.code || null, version:release?.latestVersion || null, buildMode:selfUpdateService.getRuntimeInfo().mode });
    return { ...result, state:buildUpdateCenterState(release) };
  });
  ipcMain.handle('dragonstrap:updates-cancel-download', () => selfUpdateService.cancel());
  ipcMain.handle('dragonstrap:updates-apply', async () => {
    const release = updateService.lastResult;
    const result = await bootstrapPipeline.applySelfUpdate();
    reliabilityService.log(result.ok ? 'info' : 'warn', 'self-update-apply', { code:result.code || null, version:release?.latestVersion || null, buildMode:selfUpdateService.getRuntimeInfo().mode });
    if (result.ok && result.quitRequired) setTimeout(() => app.quit(), 650);
    return result;
  });
  ipcMain.handle('dragonstrap:updates-defer', (_event, hours) => {
    const allowed = new Set([1, 24, 168]);
    const duration = Number(hours);
    const release = updateService.lastResult;
    if (!allowed.has(duration) || !release?.updateAvailable || !release.latestVersion) return { ok:false, code:'DEFER_NOT_AVAILABLE', message:'No update is available to defer.' };
    const until = Date.now() + duration * 60 * 60 * 1000;
    settingsStore.update({ updateDeferredUntil:until, updateDeferredVersion:release.latestVersion });
    return { ok:true, deferredUntil:until, state:buildUpdateCenterState(release) };
  });
  ipcMain.handle('dragonstrap:updates-clear-defer', () => {
    settingsStore.update({ updateDeferredUntil:0, updateDeferredVersion:'' });
    return { ok:true, state:buildUpdateCenterState(updateService.lastResult) };
  });
  ipcMain.handle('dragonstrap:updates-open-folder', async () => {
    const folder = path.join(app.getPath('userData'), 'updates');
    fs.mkdirSync(folder, { recursive:true });
    const error = await shell.openPath(folder);
    return error ? { ok:false, code:'OPEN_FAILED', message:error } : { ok:true, path:folder };
  });
  ipcMain.handle('dragonstrap:updates-open-release', async () => {
    const result = updateService.lastResult;
    if (!result?.releaseUrl || !/^https:\/\/github\.com\//i.test(result.releaseUrl)) return { ok:false, code:'RELEASE_URL_UNAVAILABLE', message:'No verified DragonStrap release page is available yet.' };
    await shell.openExternal(result.releaseUrl);
    return { ok:true, url:result.releaseUrl };
  });

  ipcMain.handle('dragonstrap:roblox-status', async () => {
    const status = await getRobloxStatus();
    status.channel = channelVersionService.displayChannel(settingsStore.getAll().channel);
    return status;
  });
  ipcMain.handle('dragonstrap:settings-get', () => settingsStore.getAll());
  ipcMain.handle('dragonstrap:settings-update', (_event, patch) => { const result=settingsStore.update(patch); invalidateConfigurationProfileForPatch(patch); return result; });
  ipcMain.handle('dragonstrap:configuration-profiles-state', () => configurationProfileService.getState());
  ipcMain.handle('dragonstrap:configuration-profile-save-current', async (_event, name) => configurationProfileService.saveCurrent(await getRobloxStatus(), name));
  ipcMain.handle('dragonstrap:configuration-profile-clone', (_event, id, name) => configurationProfileService.clone(id, name));
  ipcMain.handle('dragonstrap:configuration-profile-delete', (_event, id) => configurationProfileService.delete(id));
  ipcMain.handle('dragonstrap:configuration-profile-preview', async (_event, id) => configurationProfileService.previewApply(await getRobloxStatus(), id));
  ipcMain.handle('dragonstrap:configuration-profile-apply', async (_event, id) => {
    const result = configurationProfileService.apply(await getRobloxStatus(), id);
    reliabilityService?.log(result.ok ? 'info' : 'error', 'configuration-profile-apply', { profileId:String(id || ''), code:result.code || null });
    return result;
  });
  ipcMain.handle('dragonstrap:configuration-profile-export', async (event, id) => {
    const exported = configurationProfileStore.exportDocument(id);
    if (!exported.ok) return exported;
    const profile = configurationProfileStore.get(id);
    const safeName = String(profile?.name || 'Profile').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'Profile';
    const win = BrowserWindow.fromWebContents(event.sender);
    const save = await dialog.showSaveDialog(win, { title:'Export DragonStrap Profile', defaultPath:`DragonStrap-${safeName}.dragonstrap-profile.json`, filters:[{ name:'DragonStrap Profile', extensions:['json'] }] });
    if (save.canceled || !save.filePath) return { ok:false, canceled:true };
    fs.writeFileSync(save.filePath, `${JSON.stringify(exported.document, null, 2)}\n`, 'utf8');
    return { ok:true, path:save.filePath, profile };
  });
  ipcMain.handle('dragonstrap:configuration-profile-import', async event => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const open = await dialog.showOpenDialog(win, { title:'Import DragonStrap Profile', properties:['openFile'], filters:[{ name:'DragonStrap Profile', extensions:['json'] }] });
    if (open.canceled || !open.filePaths?.[0]) return { ok:false, canceled:true };
    const filePath = open.filePaths[0];
    const stat = fs.statSync(filePath);
    if (stat.size > 1024 * 1024) return { ok:false, code:'PROFILE_FILE_TOO_LARGE', message:'DragonStrap profile files are limited to 1 MB.' };
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const result = configurationProfileStore.importDocument(parsed);
      return { ...result, path:filePath };
    } catch (error) { return { ok:false, code:'PROFILE_IMPORT_FAILED', message:error.message }; }
  });
  ipcMain.handle('dragonstrap:channel-version-state', async (_event, channel = null) => {
    const selected = channel === null || channel === undefined ? settingsStore.getAll().channel : channel;
    return channelVersionService.getState(await getRobloxStatus(), selected);
  });
  ipcMain.handle('dragonstrap:channel-version-select', async (_event, channel) => {
    const validation = channelVersionService.validateChannel(channel);
    if (!validation.ok) return validation;
    const state = await channelVersionService.getState(await getRobloxStatus(), validation.channel);
    if (!state.player?.ok) {
      return { ok:false, code:state.player?.code || 'CHANNEL_UNAVAILABLE', message:state.player?.message || 'The selected Player channel could not be verified.', state };
    }
    const settings = settingsStore.update({ channel:validation.channel });
    invalidateConfigurationProfile();
    return { ok:true, channel:settings.channel, displayChannel:channelVersionService.displayChannel(settings.channel), state };
  });
  ipcMain.handle('dragonstrap:channel-open-install-folder', async (_event, kind) => {
    const status = await getRobloxStatus();
    const filePath = kind === 'studio' ? status.studioPath : (kind === 'player' ? status.playerPath : null);
    if (!filePath || !fs.existsSync(filePath)) return { ok:false, code:'INSTALL_NOT_FOUND', message:'The requested Roblox installation was not detected.' };
    const folder = path.dirname(filePath);
    const error = await shell.openPath(folder);
    return error ? { ok:false, code:'OPEN_FAILED', message:error } : { ok:true, path:folder };
  });

  ipcMain.handle('dragonstrap:player-install-state', () => robloxUpdateEngine.getState());
  ipcMain.handle('dragonstrap:player-install-plan', async () => {
    return bootstrapPipeline.planPlayer();
  });
  ipcMain.handle('dragonstrap:player-install-start', async event => {
    const channel = settingsStore.getAll().channel;
    const result = await bootstrapPipeline.installPlayer();
    reliabilityService.log(result.ok ? 'info' : (result.canceled ? 'info' : 'error'), 'roblox-player-install', {
      code:result.code || null,
      versionGuid:result.versionGuid || null,
      previousVersionGuid:result.previousVersionGuid || null,
      channel
    });
    if (result.ok && event.sender && !event.sender.isDestroyed()) {
      const refreshed = await getRobloxStatus({ fresh:true });
      refreshed.channel = channelVersionService.displayChannel(channel);
      event.sender.send('dragonstrap:roblox-status-changed', refreshed);
    }
    return result;
  });
  ipcMain.handle('dragonstrap:player-install-cancel', () => robloxUpdateEngine.cancel());
  ipcMain.handle('dragonstrap:launch-history-get', () => launchHistoryStore.getAll());
  ipcMain.handle('dragonstrap:launch-history-clear', () => launchHistoryStore.clear());
  ipcMain.handle('dragonstrap:performance-state', async () => performanceService.getState(await getRobloxStatus()));
  ipcMain.handle('dragonstrap:performance-apply', async () => performanceService.apply(await getRobloxStatus(), settingsStore.getAll()));
  ipcMain.handle('dragonstrap:performance-restore', async () => performanceService.restore(await getRobloxStatus()));
  ipcMain.handle('dragonstrap:performance-center-state', async () => performanceCenterService.getState(await getRobloxStatus(), settingsStore.getAll()));
  ipcMain.handle('dragonstrap:performance-profiles-state', () => performanceProfileStore.getState());
  ipcMain.handle('dragonstrap:performance-profile-save', (_event, name) => performanceProfileStore.saveCustomProfile(name, settingsStore.getAll()));
  ipcMain.handle('dragonstrap:performance-profile-delete', (_event, id) => performanceProfileStore.deleteCustomProfile(id));
  ipcMain.handle('dragonstrap:performance-experience-assign', (_event, placeId, profileId) => performanceProfileStore.assignExperience(placeId, profileId));
  ipcMain.handle('dragonstrap:performance-experience-remove', (_event, placeId) => performanceProfileStore.removeExperience(placeId));


  ipcMain.handle('dragonstrap:server-intelligence-lookup', async (_event, target, options = {}) => {
    return serverIntelligenceService.lookup(target, { force:options?.force === true });
  });
  ipcMain.handle('dragonstrap:server-intelligence-clear-cache', (_event, placeId) => {
    serverIntelligenceService.clearCache(placeId || null);
    return { ok:true };
  });
  ipcMain.handle('dragonstrap:server-intelligence-saved-state', (_event, placeId = null) => serverIntelligenceService.getSavedState(placeId));
  ipcMain.handle('dragonstrap:server-intelligence-toggle-favorite', (_event, placeId, server) => serverIntelligenceService.toggleFavorite(placeId, server));
  ipcMain.handle('dragonstrap:server-intelligence-record-join', (_event, placeId, server) => serverIntelligenceService.recordJoin(placeId, server));
  ipcMain.handle('dragonstrap:server-intelligence-clear-recent', () => ({ ok:true, recent:serverIntelligenceService.clearRecent() }));

  ipcMain.handle('dragonstrap:fastflags-state', async () => fastFlagService.getState(await getRobloxStatus()));
  ipcMain.handle('dragonstrap:fastflags-preview', async (_event, patch) => fastFlagService.previewPatch(await getRobloxStatus(), patch));
  ipcMain.handle('dragonstrap:fastflags-apply', async (_event, patch) => { const result=fastFlagService.applyPatch(await getRobloxStatus(), patch); if(result.ok && !result.noChanges) invalidateConfigurationProfile(); return result; });
  ipcMain.handle('dragonstrap:fastflags-restore-backup', async () => { const result=fastFlagService.restoreBackup(await getRobloxStatus()); if(result.ok && result.restored) invalidateConfigurationProfile(); return result; });
  ipcMain.handle('dragonstrap:fastflags-export', async event => {
    const status = await getRobloxStatus();
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
    const editable = fastFlagService.getEditableObject(await getRobloxStatus());
    if (!editable.ok) return editable;
    try { return { ok:true, preset:fastFlagPresetStore.save(name, editable.data), items:fastFlagPresetStore.list() }; }
    catch(error){ return { ok:false, code:'PRESET_SAVE_FAILED', message:error.message }; }
  });
  ipcMain.handle('dragonstrap:fastflags-preset-get', (_event, id) => {
    const preset = fastFlagPresetStore.get(id);
    return preset ? { ok:true, preset } : { ok:false, code:'PRESET_NOT_FOUND', message:'FastFlag preset was not found.' };
  });
  ipcMain.handle('dragonstrap:fastflags-preset-delete', (_event, id) => fastFlagPresetStore.delete(id));
  ipcMain.handle('dragonstrap:fastflags-preset-export-share', async (event, id) => {
    const document = fastFlagPresetStore.exportDocument(id, app.getVersion());
    if (!document) return { ok:false, code:'PRESET_NOT_FOUND', message:'FastFlag preset was not found.' };
    const win = BrowserWindow.fromWebContents(event.sender);
    const safeName = document.preset.name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'FastFlag-Preset';
    const picked = await dialog.showSaveDialog(win, {
      title:'Share FastFlag Preset', defaultPath:`DragonStrap-${safeName}.fastflags.json`,
      filters:[{ name:'DragonStrap FastFlag Preset', extensions:['json'] }]
    });
    if (picked.canceled || !picked.filePath) return { ok:false, canceled:true };
    fs.writeFileSync(picked.filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    return { ok:true, filePath:picked.filePath, count:Object.keys(document.preset.flags).length };
  });
  ipcMain.handle('dragonstrap:fastflags-preset-import-share', async event => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const picked = await dialog.showOpenDialog(win, {
      title:'Import Shared FastFlag Preset', properties:['openFile'],
      filters:[{ name:'DragonStrap FastFlag Preset', extensions:['json'] }]
    });
    if (picked.canceled || picked.filePaths.length === 0) return { ok:false, canceled:true };
    try {
      const text=fs.readFileSync(picked.filePaths[0],'utf8');
      if (text.length > 2_000_000) return { ok:false, code:'PRESET_TOO_LARGE', message:'Shared preset files are limited to 2 MB.' };
      const parsed=fastFlagPresetStore.parseSharedDocument(JSON.parse(text));
      if (!parsed.ok) return parsed;
      const preview=fastFlagService.previewImport(parsed.flags);
      if (!preview.ok) return preview;
      if (preview.errors.length) return { ok:false, code:'INVALID_SHARED_PRESET_FLAGS', message:`Shared preset contains ${preview.errors.length} invalid flag entr${preview.errors.length===1?'y':'ies'}.`, errors:preview.errors };
      const flags=Object.fromEntries(preview.entries.map(item=>[item.key,item.value]));
      const preset=fastFlagPresetStore.save(parsed.name,flags,{shared:true,importedFrom:parsed.exportedByVersion || 'shared file'});
      return { ok:true, preset, items:fastFlagPresetStore.list(), ignoredProtected:preview.ignoredProtected };
    } catch(error) { return { ok:false, code:'PRESET_IMPORT_FAILED', message:error.message }; }
  });
  ipcMain.handle('dragonstrap:fastflags-snapshots-list', () => fastFlagService.listSnapshots());
  ipcMain.handle('dragonstrap:fastflags-snapshot-restore', async (_event, id) => { const result=fastFlagService.restoreSnapshot(await getRobloxStatus(), id); if(result.ok && result.restored) invalidateConfigurationProfile(); return result; });
  ipcMain.handle('dragonstrap:fastflags-show-file', async () => {
    const state = fastFlagService.getState(await getRobloxStatus());
    if (!state.ok) return state;
    if (fs.existsSync(state.path)) shell.showItemInFolder(state.path);
    else await shell.openPath(path.dirname(state.path));
    return { ok:true, path:state.path };
  });

  ipcMain.handle('dragonstrap:maintenance-state', () => buildMaintenanceState());
  ipcMain.handle('dragonstrap:maintenance-create-restore-point', async (_event, label) => {
    const status=await getRobloxStatus();
    const result=recoveryService.createRestorePoint(String(label || 'Manual restore point'),status);
    reliabilityService.log(result.ok?'info':'warn','recovery-create-restore-point',{code:result.code||null,fileCount:result.restorePoint?.fileCount||0});
    return { ...result, state:await buildMaintenanceState() };
  });
  ipcMain.handle('dragonstrap:maintenance-restore-point', async (_event, id) => operationCoordinator.run('recovery.configuration-restore', { label:'Configuration restore' }, async () => {
    const status=await getRobloxStatus({ fresh:true });
    const result=recoveryService.restorePoint(String(id || ''),status);
    reliabilityService.log(result.ok?'info':'error','recovery-restore-point',{code:result.code||null,restoredCount:result.restoredCount||0});
    return { ...result, state:await buildMaintenanceState() };
  }));
  ipcMain.handle('dragonstrap:maintenance-delete-restore-point', async (_event, id) => {
    const result=recoveryService.deleteRestorePoint(String(id || ''));
    return { ...result, state:await buildMaintenanceState() };
  });
  ipcMain.handle('dragonstrap:maintenance-rollback-player', async () => {
    const result=await bootstrapPipeline.rollbackPlayer();
    reliabilityService.log(result.ok?'info':'error','roblox-player-rollback',{code:result.code||null,fromVersion:result.fromVersion||null,toVersion:result.toVersion||null});
    return { ...result, state:await buildMaintenanceState() };
  });
  ipcMain.handle('dragonstrap:maintenance-repair-update-state', async () => {
    const result=await selfUpdateService.repairRecovery();
    reliabilityService.log(result.ok?'info':'warn','self-update-recovery',{code:result.code||null,stateAction:result.stateAction||null,removed:result.removed||0});
    return { ...result, state:await buildMaintenanceState() };
  });
  ipcMain.handle('dragonstrap:maintenance-safe-repair', async () => operationCoordinator.run('recovery.safe-repair', { label:'Safe Repair' }, async () => {
    let status=await getRobloxStatus();
    const safety=recoveryService.createRestorePoint('Automatic point before Safe Repair',status);
    if (!safety.ok) return { ...safety, state:await buildMaintenanceState() };
    const actions=[];
    const config=maintenanceService.getState(status,{name:'DragonStrap',version:app.getVersion()}).clientSettings;
    if (config?.repairAvailable) {
      const repaired=maintenanceService.repairClientSettings(status);
      actions.push({ action:'client-settings', ok:repaired.ok, detail:repaired.repaired?`Repaired from ${repaired.source}.`:repaired.message });
    }
    const staging=recoveryService.clearAbandonedStaging(robloxUpdateEngine.getState());
    if (staging.removed) actions.push({ action:'staging', ok:true, detail:`Removed ${staging.removed} abandoned staging director${staging.removed===1?'y':'ies'}.` });
    const updateRepair=await selfUpdateService.repairRecovery();
    if (updateRepair.removed || updateRepair.stateAction !== 'preserved') actions.push({ action:'update-state', ok:updateRepair.ok, detail:`Update recovery: ${updateRepair.stateAction}; removed ${updateRepair.removed} leftover file(s).` });
    status=await getRobloxStatus();
    const integrity=recoveryService.inspectPlayer(status);
    let rollback=null;
    if (integrity.corrupted) {
      const candidate=robloxUpdateEngine.getRollbackState(status);
      if (candidate.available) {
        rollback=await robloxUpdateEngine.rollback(status);
        if (rollback.ok) statusCache?.invalidate();
        actions.push({ action:'player-rollback', ok:rollback.ok, detail:rollback.ok?rollback.message:(rollback.message||'Rollback failed.') });
      } else actions.push({ action:'player-integrity', ok:false, detail:'Player corruption was detected, but no verified rollback candidate is available. Use the Installation Engine to reinstall Player.' });
    }
    const ok=actions.every(item=>item.ok !== false);
    reliabilityService.log(ok?'info':'warn','safe-repair',{actions:actions.map(item=>item.action),rollback:rollback?.ok===true});
    return { ok, code:ok?'SAFE_REPAIR_COMPLETE':'SAFE_REPAIR_PARTIAL', message:actions.length?'Safe Repair completed.':'No repairable issues were found.', actions, safetyRestorePoint:safety.restorePoint, state:await buildMaintenanceState() };
  }));
  ipcMain.handle('dragonstrap:maintenance-clear-cache', async (_event, scope = 'all') => {
    if (robloxUpdateEngine.getState().active) return { ok:false, code:'INSTALL_BUSY', message:'Cache cleanup is disabled while a Roblox Player installation is running.' };
    const result = maintenanceService.clearCache(String(scope || 'all'));
    return { ...result, state:await buildMaintenanceState() };
  });
  ipcMain.handle('dragonstrap:maintenance-clear-old-logs', async (_event, days = 7) => {
    const result = maintenanceService.clearOldLogs(days);
    return { ...result, state:await buildMaintenanceState() };
  });
  ipcMain.handle('dragonstrap:maintenance-repair-client-settings', async () => {
    const result = maintenanceService.repairClientSettings(await getRobloxStatus());
    return { ...result, state:await buildMaintenanceState() };
  });
  ipcMain.handle('dragonstrap:maintenance-export-diagnostics', async event => {
    const status = await getRobloxStatus();
    const report = maintenanceService.buildDiagnosticReport(status, { name:'DragonStrap', version:app.getVersion(), platform:process.platform, architecture:process.arch });
    report.schemaVersion=2;
    report.recovery={
      integrity:recoveryService.inspectPlayer(status),
      restorePointCount:recoveryService.listRestorePoints().length,
      staging:recoveryService.inspectAbandonedStaging(robloxUpdateEngine.getState()),
      update:selfUpdateService.getRecoveryState(),
      rollback:robloxUpdateEngine.getRollbackState(status)
    };
    report.reliability=reliabilityService.getState();
    report.core=kernel.describe();
    const win = BrowserWindow.fromWebContents(event.sender);
    const picked = await dialog.showSaveDialog(win, {
      title:'Export DragonStrap Diagnostics',
      defaultPath:`DragonStrap-Diagnostics-${new Date().toISOString().slice(0,10)}.json`,
      filters:[{ name:'JSON', extensions:['json'] }]
    });
    if (picked.canceled || !picked.filePath) return { ok:false, canceled:true };
    fs.writeFileSync(picked.filePath, `${JSON.stringify(report, null, 2)}
`, 'utf8');
    return { ok:true, filePath:picked.filePath };
  });
  ipcMain.handle('dragonstrap:maintenance-open-location', async (_event, kind) => {
    const status = await getRobloxStatus();
    const state = maintenanceService.getState(status, { name:'DragonStrap', version:app.getVersion(), platform:process.platform, architecture:process.arch });
    const targets = {
      roblox:state.paths.robloxRoot, logs:state.paths.logsRoot, data:state.paths.dragonStrapData,
      versions:state.paths.versionsRoot, player:status.playerPath ? path.dirname(status.playerPath) : null,
      studio:status.studioPath ? path.dirname(status.studioPath) : null,
      recovery:recoveryService.root
    };
    const target = targets[String(kind || '')] || null;
    if (!target) return { ok:false, code:'LOCATION_NOT_FOUND', message:'The requested folder is not available.' };
    if (!fs.existsSync(target) && kind === 'recovery') fs.mkdirSync(target,{recursive:true});
    if (!fs.existsSync(target)) return { ok:false, code:'LOCATION_NOT_FOUND', message:'The requested folder is not available.' };
    const error = await shell.openPath(target);
    return error ? { ok:false, code:'OPEN_FAILED', message:error } : { ok:true, path:target };
  });

  ipcMain.handle('dragonstrap:studio-center-state', () => buildStudioCenterState());
  ipcMain.handle('dragonstrap:studio-settings-update', async (_event, patch) => {
    const settings=studioSettingsStore.update(patch);
    return { ok:true, settings, state:await buildStudioCenterState() };
  });
  ipcMain.handle('dragonstrap:studio-channel-check', async (_event, channel) => {
    const validation=channelVersionService.validateChannel(channel);
    if (!validation.ok) return validation;
    const status=await getRobloxStatus();
    const state=await channelVersionService.getState(status,validation.channel);
    return { ok:Boolean(state?.studio?.ok), channel:validation.channel, displayChannel:validation.displayChannel, studio:state?.studio || null, state };
  });
  ipcMain.handle('dragonstrap:studio-channel-select', async (_event, channel) => {
    const validation=channelVersionService.validateChannel(channel);
    if (!validation.ok) return validation;
    const status=await getRobloxStatus();
    const state=await channelVersionService.getState(status,validation.channel);
    if (!state?.studio?.ok) return { ok:false, code:state?.studio?.code || 'STUDIO_CHANNEL_UNAVAILABLE', message:state?.studio?.message || 'The selected Studio channel could not be verified.', state };
    const settings=studioSettingsStore.update({ channel:validation.channel });
    return { ok:true, settings, state:await buildStudioCenterState() };
  });

  ipcMain.handle('dragonstrap:studio-project-choose-launch', async event => {
    const status = await getRobloxStatus();
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
    const preparation = prepareStudioProjectLaunch(picked.filePaths[0], status);
    if (!preparation.ok) return preparation.validation?.ok === false ? preparation.validation : (preparation.backup || { ok:false, code:'STUDIO_PREPARE_FAILED', message:'Studio project preparation failed.' });
    const validation=preparation.validation;
    const result = launchService.launchStudio(status, { projectPath:validation.path });
    const profile = preparation.profile.name;
    const historyItem = launchHistoryStore.add({
      type:'studio-project', label:validation.name, target:validation.path, profile, ok:result.ok,
      message:result.ok ? null : result.message
    });
    const projectItem = result.ok ? studioProjectHistoryStore.add(validation.path,{ size:validation.size, modifiedAt:validation.modifiedAt, launchProfile:preparation.profile.id }) : null;
    maybeMinimizeSourceWindow(event, result);
    return { ...result, project:projectItem, historyItem, studioProfile:preparation.profile, projectBackup:preparation.backup };
  });

  ipcMain.handle('dragonstrap:studio-project-launch-recent', async (event, id) => {
    const stored = studioProjectHistoryStore.get(String(id || ''));
    if (!stored) return { ok:false, code:'PROJECT_NOT_FOUND', message:'Recent Studio project was not found.' };
    const status = await getRobloxStatus();
    const preparation=prepareStudioProjectLaunch(stored.path,status);
    if (!preparation.ok) return preparation.validation?.ok === false ? preparation.validation : (preparation.backup || { ok:false, code:'STUDIO_PREPARE_FAILED', message:'Studio project preparation failed.' });
    const validation=preparation.validation;
    const result = launchService.launchStudio(status, { projectPath:validation.path });
    const profile=preparation.profile.name;
    const historyItem = launchHistoryStore.add({
      type:'studio-project', label:validation.name, target:validation.path, profile, ok:result.ok,
      message:result.ok ? null : result.message
    });
    const projectItem = result.ok ? studioProjectHistoryStore.add(validation.path,{ size:validation.size, modifiedAt:validation.modifiedAt, launchProfile:preparation.profile.id }) : null;
    maybeMinimizeSourceWindow(event, result);
    return { ...result, project:projectItem, historyItem, studioProfile:preparation.profile, projectBackup:preparation.backup };
  });

  ipcMain.handle('dragonstrap:studio-history-clear', () => studioProjectHistoryStore.clear());
  ipcMain.handle('dragonstrap:studio-project-backup', async (_event, id) => {
    const stored=studioProjectHistoryStore.get(String(id || ''));
    if (!stored) return { ok:false, code:'PROJECT_NOT_FOUND', message:'Recent Studio project was not found.' };
    const info=studioService.getProjectInfo(stored.path);
    if (!info.ok) return info;
    const result=studioBackupService.create(info.path,{retention:studioSettingsStore.getAll().backupRetention,reason:'manual'});
    return { ...result, state:await buildStudioCenterState() };
  });
  ipcMain.handle('dragonstrap:studio-project-restore-copy', async (event, id, backupId) => {
    const stored=studioProjectHistoryStore.get(String(id || ''));
    if (!stored) return { ok:false, code:'PROJECT_NOT_FOUND', message:'Recent Studio project was not found.' };
    const backup=studioBackupService.get(stored.path,String(backupId || ''));
    if (!backup) return { ok:false, code:'BACKUP_NOT_FOUND', message:'Studio backup was not found.' };
    const win=BrowserWindow.fromWebContents(event.sender);
    const ext=path.extname(stored.path).toLowerCase() || '.rbxl';
    const base=path.basename(stored.path,ext);
    const picked=await dialog.showSaveDialog(win,{title:'Restore Studio Backup as Copy',defaultPath:path.join(path.dirname(stored.path),`${base}-restored${ext}`),filters:[{name:'Roblox Studio Projects',extensions:['rbxl','rbxlx']}]});
    if (picked.canceled || !picked.filePath) return { ok:false, canceled:true };
    return studioBackupService.restoreCopy(stored.path,backup.id,picked.filePath);
  });
  ipcMain.handle('dragonstrap:studio-project-open-backups', async (_event, id) => {
    const stored=studioProjectHistoryStore.get(String(id || ''));
    if (!stored) return { ok:false, code:'PROJECT_NOT_FOUND', message:'Recent Studio project was not found.' };
    const target=studioBackupService.openFolderForProject(stored.path);
    const error=await shell.openPath(target);
    return error ? {ok:false,code:'OPEN_FAILED',message:error} : {ok:true,path:target};
  });
  ipcMain.handle('dragonstrap:studio-fastflags-toggle', async (_event, enabled) => {
    const status=await getRobloxStatus();
    if (enabled && !studioFastFlagService.isIsolated(status)) return { ok:false, code:'STUDIO_NOT_ISOLATED', message:'Studio and Player share a ClientSettings path, so isolated Studio FastFlags cannot be enabled.' };
    const settings=studioSettingsStore.update({fastFlagsEnabled:enabled === true});
    return {ok:true,settings,state:await buildStudioCenterState()};
  });
  ipcMain.handle('dragonstrap:studio-fastflags-set', async (_event, key, value, type='auto') => {
    const status=await getRobloxStatus();
    const result=studioFastFlagService.set(status,studioSettingsStore.getAll().fastFlagsEnabled,key,value,type);
    return {...result,state:await buildStudioCenterState()};
  });
  ipcMain.handle('dragonstrap:studio-fastflags-remove', async (_event, key) => {
    const status=await getRobloxStatus();
    const result=studioFastFlagService.remove(status,studioSettingsStore.getAll().fastFlagsEnabled,key);
    return {...result,state:await buildStudioCenterState()};
  });
  ipcMain.handle('dragonstrap:studio-fastflags-restore-backup', async () => {
    const status=await getRobloxStatus();
    const result=studioFastFlagService.restoreBackup(status,studioSettingsStore.getAll().fastFlagsEnabled);
    return {...result,state:await buildStudioCenterState()};
  });

  ipcMain.handle('dragonstrap:studio-open-install-folder', async () => {
    const status = await getRobloxStatus();
    const target = studioService.getLocations(status).installDir;
    if (!target || !fs.existsSync(target)) return { ok:false, code:'STUDIO_NOT_FOUND', message:'Studio install folder is unavailable.' };
    const error = await shell.openPath(target);
    return error ? { ok:false, code:'OPEN_FAILED', message:error } : { ok:true, path:target };
  });

  ipcMain.handle('dragonstrap:studio-open-logs-folder', async () => {
    const status = await getRobloxStatus();
    const target = studioService.getLocations(status).logsDir;
    if (!target || !fs.existsSync(target)) return { ok:false, code:'LOGS_NOT_FOUND', message:'Roblox logs folder is unavailable.' };
    const error = await shell.openPath(target);
    return error ? { ok:false, code:'OPEN_FAILED', message:error } : { ok:true, path:target };
  });

  ipcMain.handle('dragonstrap:launch-player', async (event, options = {}) => {
    const normalized = launchTargetService.normalize(options.target, options.gameInstanceId);
    if (!normalized.ok) return normalized;

    const readiness = await bootstrapPipeline.assertLaunchReady();
    if (!readiness.ok) return readiness;
    const status = readiness.status;
    const currentSettings = settingsStore.getAll();
    const performanceSelection = performanceProfileStore.resolveForExperience(normalized.placeId, currentSettings);
    const performance = currentSettings.performanceAutoApply
      ? performanceService.apply(status, performanceSelection.settings)
      : { ok: true, skipped: true };
    const result = launchService.launchPlayer(status, { uri: normalized.uri });
    const profile = performanceSelection.source === 'experience'
      ? performanceSelection.profile.name
      : (currentSettings.launchProfile || 'default');
    const historyItem = launchHistoryStore.add({
      type: normalized.kind,
      label: normalized.label,
      target: normalized.uri,
      profile,
      ok: result.ok,
      message: result.ok ? null : result.message
    });

    maybeMinimizeSourceWindow(event, result);
    return { ...result, target: normalized, historyItem, performance, performanceSelection:{ source:performanceSelection.source, placeId:performanceSelection.placeId, profileId:performanceSelection.profile.id, profileName:performanceSelection.profile.name } };
  });

  ipcMain.handle('dragonstrap:launch-studio', async event => {
    const status = await getRobloxStatus();
    const studioProfile=studioSettingsStore.getProfile();
    const result = launchService.launchStudio(status);
    const historyItem = launchHistoryStore.add({
      type: 'studio', label: 'Roblox Studio', target: null, profile:studioProfile.name, ok: result.ok,
      message: result.ok ? null : result.message
    });
    maybeMinimizeSourceWindow(event, result);
    return { ...result, historyItem, studioProfile };
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
    kernel = new AppKernel({
      userData,
      currentVersion:app.getVersion(),
      isPackaged:app.isPackaged,
      execPath:process.execPath,
      env:process.env,
      platform:process.platform,
      arch:process.arch
    }).initialize();

    settingsStore = kernel.get('settings.store');
    robloxService = kernel.get('roblox.installation');
    statusCache = kernel.get('roblox.status-cache');
    launchService = kernel.get('launch.service');
    launchTargetService = kernel.get('launch.target');
    launchHistoryStore = kernel.get('launch.history');
    performanceService = kernel.get('performance.settings');
    performanceProfileStore = kernel.get('performance.profiles');
    performanceCenterService = kernel.get('performance.center');
    fastFlagSnapshotStore = kernel.get('fastflags.snapshots');
    fastFlagService = kernel.get('fastflags.player');
    fastFlagPresetStore = kernel.get('fastflags.presets');
    configurationProfileStore = kernel.get('configuration.profiles.store');
    configurationProfileService = kernel.get('configuration.profiles');
    serverIntelligenceStore = kernel.get('servers.store');
    serverIntelligenceService = kernel.get('servers.intelligence');
    studioService = kernel.get('studio.service');
    studioProjectHistoryStore = kernel.get('studio.history');
    studioSettingsStore = kernel.get('studio.settings');
    studioBackupService = kernel.get('studio.backups');
    studioFastFlagService = kernel.get('studio.fastflags');
    channelVersionService = kernel.get('roblox.channels');
    robloxUpdateEngine = kernel.get('roblox.update-engine');
    maintenanceService = kernel.get('maintenance.service');
    recoveryService = kernel.get('recovery.service');
    updateService = kernel.get('updates.release-feed');
    selfUpdateService = kernel.get('updates.self');
    reliabilityService = kernel.get('reliability.service');
    operationCoordinator = kernel.get('core.operations');
    bootstrapPipeline = kernel.get('core.bootstrap-pipeline');

    reliabilityService.initialize();
    process.on('uncaughtException', error => {
      reliabilityService?.recordError('uncaught-exception', error);
      app.exit(1);
    });
    process.on('unhandledRejection', reason => reliabilityService?.recordError('unhandled-rejection', reason instanceof Error ? reason : new Error(String(reason))));

    robloxUpdateEngine.on('progress', progress => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('dragonstrap:player-install-progress', progress);
    });
    selfUpdateService.on('progress', progress => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('dragonstrap:update-download-progress', progress);
    });
    registerIpc();
    createWindow();
    reliabilityService.log('info','app-ready',{packaged:app.isPackaged,electron:process.versions.electron,arch:process.arch});
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });

  app.on('before-quit', () => reliabilityService?.markCleanExit());
  app.on('child-process-gone', (_event, details) => reliabilityService?.log('error','child-process-gone',details));
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
