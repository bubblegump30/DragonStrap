'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const MB = 1024 * 1024;

function humanBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 10 || index === 0 ? value.toFixed(index === 0 ? 0 : 1) : value.toFixed(2)} ${units[index]}`;
}

function isSubPath(root, candidate) {
  const base = path.resolve(root);
  const target = path.resolve(candidate);
  return target === base || target.startsWith(`${base}${path.sep}`);
}

class MaintenanceService {
  constructor(options = {}) {
    const env = options.env || process.env;
    this.localAppData = options.localAppData || env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    this.tempRoot = options.tempRoot || env.TEMP || env.TMP || os.tmpdir();
    this.userData = options.userData || path.join(this.localAppData, 'DragonStrap');
    this.robloxRoot = path.join(this.localAppData, 'Roblox');
    this.versionsRoot = path.join(this.robloxRoot, 'Versions');
    this.logsRoot = path.join(this.robloxRoot, 'logs');
    this.allowedCacheRoots = Object.freeze({
      dragonCache: path.join(this.userData, 'Cache'),
      dragonCodeCache: path.join(this.userData, 'Code Cache'),
      dragonGpuCache: path.join(this.userData, 'GPUCache'),
      robloxTemp: path.join(this.tempRoot, 'Roblox'),
      robloxDownloads: path.join(this.robloxRoot, 'Downloads')
    });
  }

  getState(status = {}, appInfo = {}) {
    const playerPath = status.playerPath || null;
    const studioPath = status.studioPath || null;
    const clientSettingsPath = playerPath
      ? path.join(path.dirname(playerPath), 'ClientSettings', 'ClientAppSettings.json')
      : null;
    const clientSettingsBackupPath = clientSettingsPath ? `${clientSettingsPath}.dragonstrap.bak` : null;

    const playerHealth = this.#fileHealth(playerPath);
    const studioHealth = this.#fileHealth(studioPath);
    const settingsHealth = this.#jsonHealth(clientSettingsPath);
    const cache = this.#cacheSummary();
    const logs = this.#directorySummary(this.logsRoot, { countFiles:true });
    const versions = this.#versionSummary(playerPath, studioPath);

    const checks = [
      {
        id:'player', label:'Roblox Player',
        level: playerHealth.exists && playerHealth.size > 0 ? 'ok' : 'error',
        detail: playerHealth.exists ? `${status.version || path.basename(path.dirname(playerPath || ''))} • ${humanBytes(playerHealth.size)}` : 'RobloxPlayerBeta.exe was not detected.'
      },
      {
        id:'studio', label:'Roblox Studio',
        level: studioHealth.exists && studioHealth.size > 0 ? 'ok' : 'warn',
        detail: studioHealth.exists ? `${status.studioVersion || path.basename(path.dirname(studioPath || ''))} • ${humanBytes(studioHealth.size)}` : 'Roblox Studio is not installed or was not detected.'
      },
      {
        id:'client-settings', label:'Client settings',
        level: settingsHealth.state === 'malformed' ? 'error' : 'ok',
        detail: settingsHealth.state === 'missing' ? 'No ClientAppSettings.json override file is present.' : settingsHealth.message
      },
      {
        id:'versions', label:'Version folders',
        level: versions.total > 8 ? 'warn' : 'ok',
        detail: `${versions.total} version folder${versions.total === 1 ? '' : 's'} detected${versions.stale ? ` • ${versions.stale} not currently selected` : ''}.`
      }
    ];

    const errors = checks.filter(item => item.level === 'error').length;
    const warnings = checks.filter(item => item.level === 'warn').length;

    return {
      ok:true,
      health: errors ? 'attention' : (warnings ? 'warning' : 'healthy'),
      checks,
      installation:{
        player:{ ...playerHealth, version:status.version || null, path:playerPath },
        studio:{ ...studioHealth, version:status.studioVersion || null, path:studioPath },
        versions
      },
      clientSettings:{
        ...settingsHealth,
        path:clientSettingsPath,
        backupPath:clientSettingsBackupPath,
        backupExists:Boolean(clientSettingsBackupPath && fs.existsSync(clientSettingsBackupPath)),
        repairAvailable:settingsHealth.state === 'malformed'
      },
      cache,
      logs:{ path:this.logsRoot, ...logs },
      paths:{
        dragonStrapData:this.userData,
        robloxRoot:this.robloxRoot,
        versionsRoot:this.versionsRoot,
        logsRoot:this.logsRoot,
        tempRoot:this.tempRoot
      },
      app:{
        name:appInfo.name || 'DragonStrap',
        version:appInfo.version || null,
        platform:appInfo.platform || process.platform,
        architecture:appInfo.architecture || process.arch
      },
      generatedAt:new Date().toISOString()
    };
  }

  clearCache(scope = 'all') {
    const groups = {
      dragonstrap:['dragonCache', 'dragonCodeCache', 'dragonGpuCache'],
      roblox:['robloxTemp', 'robloxDownloads'],
      all:Object.keys(this.allowedCacheRoots)
    };
    const keys = groups[scope];
    if (!keys) return { ok:false, code:'INVALID_CACHE_SCOPE', message:'Unsupported cache cleanup scope.' };

    let removedBytes = 0;
    let removedEntries = 0;
    const failures = [];

    for (const key of keys) {
      const root = this.allowedCacheRoots[key];
      const before = this.#directorySummary(root, { countFiles:true });
      const result = this.#clearDirectoryContents(root);
      removedBytes += result.ok ? before.bytes : Math.max(0, before.bytes - this.#directorySummary(root).bytes);
      removedEntries += result.removedEntries;
      failures.push(...result.failures.map(message => ({ key, path:root, message })));
    }

    return {
      ok:failures.length === 0,
      partial:failures.length > 0,
      removedBytes,
      removedEntries,
      removedText:humanBytes(removedBytes),
      failures,
      scope
    };
  }

  clearOldLogs(days = 7) {
    const ageDays = Math.max(1, Math.min(90, Number(days) || 7));
    if (!fs.existsSync(this.logsRoot)) return { ok:true, removedFiles:0, removedBytes:0, removedText:'0 B', days:ageDays };
    const cutoff = Date.now() - ageDays * 24 * 60 * 60 * 1000;
    let removedFiles = 0;
    let removedBytes = 0;
    const failures = [];

    for (const file of this.#walkFiles(this.logsRoot, 2500)) {
      try {
        const stat = fs.statSync(file);
        if (stat.mtimeMs >= cutoff) continue;
        if (!isSubPath(this.logsRoot, file)) continue;
        removedBytes += stat.size;
        fs.rmSync(file, { force:true });
        removedFiles += 1;
      } catch (error) {
        failures.push({ path:file, message:error.message });
      }
    }

    return { ok:failures.length === 0, partial:failures.length > 0, removedFiles, removedBytes, removedText:humanBytes(removedBytes), days:ageDays, failures };
  }

  repairClientSettings(status = {}) {
    if (!status.playerPath || !fs.existsSync(status.playerPath)) {
      return { ok:false, code:'PLAYER_NOT_FOUND', message:'Roblox Player must be detected before client settings can be repaired.' };
    }
    const settingsPath = path.join(path.dirname(status.playerPath), 'ClientSettings', 'ClientAppSettings.json');
    const health = this.#jsonHealth(settingsPath);
    if (health.state !== 'malformed') {
      return { ok:true, repaired:false, path:settingsPath, message:health.state === 'missing' ? 'No repair is needed; no client override file exists.' : 'Client settings JSON is already valid.' };
    }

    const dir = path.dirname(settingsPath);
    fs.mkdirSync(dir, { recursive:true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const brokenCopy = path.join(dir, `ClientAppSettings.broken.${stamp}.json`);
    fs.copyFileSync(settingsPath, brokenCopy);

    const backupPath = `${settingsPath}.dragonstrap.bak`;
    let source = 'clean';
    if (fs.existsSync(backupPath) && this.#jsonHealth(backupPath).state === 'valid') {
      fs.copyFileSync(backupPath, settingsPath);
      source = 'backup';
    } else {
      this.#atomicWrite(settingsPath, '{}\n');
    }

    return { ok:true, repaired:true, source, path:settingsPath, brokenCopy, backupPath:fs.existsSync(backupPath) ? backupPath : null };
  }

  buildDiagnosticReport(status = {}, appInfo = {}) {
    const state = this.getState(status, appInfo);
    return {
      schemaVersion:1,
      generatedAt:state.generatedAt,
      app:state.app,
      health:state.health,
      checks:state.checks,
      installation:{
        player:{ installed:state.installation.player.exists, version:state.installation.player.version, size:state.installation.player.size },
        studio:{ installed:state.installation.studio.exists, version:state.installation.studio.version, size:state.installation.studio.size },
        versionFolderCount:state.installation.versions.total,
        staleVersionFolderCount:state.installation.versions.stale
      },
      clientSettings:{
        state:state.clientSettings.state,
        message:state.clientSettings.message,
        backupExists:state.clientSettings.backupExists
      },
      cache:{ totalBytes:state.cache.totalBytes, groups:state.cache.groups.map(group => ({ id:group.id, bytes:group.bytes, files:group.files })) },
      logs:{ bytes:state.logs.bytes, files:state.logs.files },
      paths:state.paths
    };
  }

  #fileHealth(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return { exists:false, size:0 };
    try {
      const stat = fs.statSync(filePath);
      return { exists:stat.isFile(), size:stat.isFile() ? stat.size : 0, modifiedAt:stat.mtime.toISOString() };
    } catch (error) {
      return { exists:false, size:0, error:error.message };
    }
  }

  #jsonHealth(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return { state:'missing', message:'No client override file exists.' };
    try {
      const text = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(text);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Root JSON value must be an object.');
      return { state:'valid', message:`Valid JSON • ${Object.keys(parsed).length} setting${Object.keys(parsed).length === 1 ? '' : 's'}.`, entries:Object.keys(parsed).length };
    } catch (error) {
      return { state:'malformed', message:`Malformed JSON: ${error.message}` };
    }
  }

  #versionSummary(playerPath, studioPath) {
    if (!fs.existsSync(this.versionsRoot)) return { total:0, stale:0, current:[] };
    const current = new Set([playerPath, studioPath].filter(Boolean).map(item => path.resolve(path.dirname(item))));
    let total = 0;
    let stale = 0;
    try {
      for (const entry of fs.readdirSync(this.versionsRoot, { withFileTypes:true })) {
        if (!entry.isDirectory() || !entry.name.startsWith('version-')) continue;
        total += 1;
        if (!current.has(path.resolve(this.versionsRoot, entry.name))) stale += 1;
      }
    } catch { /* inaccessible versions root */ }
    return { total, stale, current:[...current] };
  }

  #cacheSummary() {
    const groups = [];
    let totalBytes = 0;
    let totalFiles = 0;
    for (const [id, folder] of Object.entries(this.allowedCacheRoots)) {
      const summary = this.#directorySummary(folder, { countFiles:true });
      groups.push({ id, path:folder, ...summary, text:humanBytes(summary.bytes) });
      totalBytes += summary.bytes;
      totalFiles += summary.files;
    }
    return { totalBytes, totalFiles, totalText:humanBytes(totalBytes), groups };
  }

  #directorySummary(root, options = {}) {
    if (!root || !fs.existsSync(root)) return { exists:false, bytes:0, files:0 };
    let bytes = 0;
    let files = 0;
    const maxFiles = 5000;
    try {
      for (const file of this.#walkFiles(root, maxFiles)) {
        try {
          const stat = fs.statSync(file);
          if (!stat.isFile()) continue;
          bytes += stat.size;
          files += 1;
        } catch { /* skip locked files */ }
      }
    } catch { /* skip inaccessible root */ }
    return { exists:true, bytes, files:options.countFiles === false ? undefined : files };
  }

  #walkFiles(root, maxFiles = 5000) {
    const files = [];
    if (!root || !fs.existsSync(root)) return files;
    const stack = [root];
    while (stack.length && files.length < maxFiles) {
      const current = stack.pop();
      let entries;
      try { entries = fs.readdirSync(current, { withFileTypes:true }); }
      catch { continue; }
      for (const entry of entries) {
        const target = path.join(current, entry.name);
        if (!isSubPath(root, target)) continue;
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) stack.push(target);
        else if (entry.isFile()) files.push(target);
        if (files.length >= maxFiles) break;
      }
    }
    return files;
  }

  #clearDirectoryContents(root) {
    const result = { ok:true, removedEntries:0, failures:[] };
    if (!root || !fs.existsSync(root)) return result;
    let entries;
    try { entries = fs.readdirSync(root, { withFileTypes:true }); }
    catch (error) { return { ok:false, removedEntries:0, failures:[error.message] }; }
    for (const entry of entries) {
      const target = path.join(root, entry.name);
      if (!isSubPath(root, target)) continue;
      try {
        fs.rmSync(target, { recursive:true, force:true, maxRetries:2, retryDelay:50 });
        result.removedEntries += 1;
      } catch (error) {
        result.ok = false;
        result.failures.push(`${entry.name}: ${error.message}`);
      }
    }
    return result;
  }

  #atomicWrite(filePath, content) {
    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tempPath, content, 'utf8');
    fs.renameSync(tempPath, filePath);
  }
}

module.exports = { MaintenanceService, humanBytes, isSubPath };
