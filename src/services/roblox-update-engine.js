'use strict';

const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const { BINARY_TYPES, normalizeChannel, displayChannel } = require('./channel-version-service');

const DEFAULT_MIRRORS = Object.freeze([
  'https://setup.rbxcdn.com',
  'https://setup-aws.rbxcdn.com',
  'https://setup-ak.rbxcdn.com',
  'https://roblox-setup.cachefly.net',
  'https://s3.amazonaws.com/setup.roblox.com'
]);

const PACKAGE_DIRECTORY_MAP = Object.freeze({
  'RobloxApp.zip': '',
  'Libraries.zip': '',
  'redist.zip': '',
  'WebView2.zip': '',
  'shaders.zip': 'shaders',
  'ssl.zip': 'ssl',
  'WebView2RuntimeInstaller.zip': 'WebView2RuntimeInstaller',
  'content-avatar.zip': path.join('content', 'avatar'),
  'content-configs.zip': path.join('content', 'configs'),
  'content-fonts.zip': path.join('content', 'fonts'),
  'content-sky.zip': path.join('content', 'sky'),
  'content-sounds.zip': path.join('content', 'sounds'),
  'content-textures2.zip': path.join('content', 'textures'),
  'content-models.zip': path.join('content', 'models'),
  'content-textures3.zip': path.join('PlatformContent', 'pc', 'textures'),
  'content-terrain.zip': path.join('PlatformContent', 'pc', 'terrain'),
  'content-platform-fonts.zip': path.join('PlatformContent', 'pc', 'fonts'),
  'content-platform-dictionaries.zip': path.join('PlatformContent', 'pc', 'shared_compression_dictionaries'),
  'extracontent-luapackages.zip': path.join('ExtraContent', 'LuaPackages'),
  'extracontent-translations.zip': path.join('ExtraContent', 'translations'),
  'extracontent-models.zip': path.join('ExtraContent', 'models'),
  'extracontent-textures.zip': path.join('ExtraContent', 'textures'),
  'extracontent-places.zip': path.join('ExtraContent', 'places')
});

const APP_SETTINGS_XML = '<?xml version="1.0" encoding="UTF-8"?>\r\n<Settings>\r\n\t<ContentFolder>content</ContentFolder>\r\n\t<BaseUrl>http://www.roblox.com</BaseUrl>\r\n</Settings>\r\n';
const MANIFEST_VERSION = 'v0';
const IGNORED_MANIFEST_PACKAGES = Object.freeze(new Set([
  'RobloxPlayerInstaller.exe'
]));
const SAFETY_BYTES = 512 * 1024 * 1024;
const MAX_PACKAGE_COUNT = 128;
const MAX_PACKAGE_SIZE = 2_147_483_647;
const MAX_TOTAL_UNPACKED = 12 * 1024 * 1024 * 1024;
const MAX_ARCHIVE_LIST_BYTES = 16 * 1024 * 1024;

function isVersionGuid(value) {
  return /^version-[A-Za-z0-9]+$/.test(String(value || '').trim());
}

function isMd5(value) {
  return /^[a-f0-9]{32}$/i.test(String(value || '').trim());
}

function parsePositiveInteger(value, fieldName) {
  if (!/^\d+$/.test(String(value || '').trim())) throw new Error(`Invalid ${fieldName} in package manifest.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || number > MAX_PACKAGE_SIZE) throw new Error(`Unsupported ${fieldName} in package manifest.`);
  return number;
}

function parsePackageManifest(text) {
  const normalized = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  if (lines.shift()?.trim() !== MANIFEST_VERSION) throw new Error('Unsupported Roblox package manifest version.');
  const packages = [];
  for (let i = 0; i < lines.length;) {
    const name = String(lines[i++] ?? '').trim();
    if (!name) break;
    const signature = String(lines[i++] ?? '').trim();
    const packedRaw = String(lines[i++] ?? '').trim();
    const sizeRaw = String(lines[i++] ?? '').trim();
    if (!signature || !packedRaw || !sizeRaw) throw new Error('Incomplete Roblox package manifest entry.');
    if (name === 'RobloxPlayerLauncher.exe') break;
    const ignoredPackage = IGNORED_MANIFEST_PACKAGES.has(name);
    if (!ignoredPackage && !/^[A-Za-z0-9._-]+\.zip$/i.test(name)) throw new Error(`Unsafe package name in Roblox manifest: ${name}`);
    if (!isMd5(signature)) throw new Error(`Invalid package signature for ${name}.`);
    const packedSize = parsePositiveInteger(packedRaw, `packed size for ${name}`);
    const size = parsePositiveInteger(sizeRaw, `unpacked size for ${name}`);
    // RobloxPlayerInstaller.exe is an updater/bootstrap executable carried in the
    // manifest. DragonStrap never executes or extracts it; the transactional
    // package pipeline installs the verified ZIP payloads directly.
    if (ignoredPackage) continue;
    packages.push({ name, signature:signature.toLowerCase(), packedSize, size });
    if (packages.length > MAX_PACKAGE_COUNT) throw new Error('Roblox package manifest contains too many packages.');
  }
  if (!packages.some(item => item.name === 'RobloxApp.zip')) throw new Error('Roblox Player package manifest does not contain RobloxApp.zip.');
  const totalUnpackedBytes = packages.reduce((sum, item) => sum + item.size, 0);
  if (totalUnpackedBytes > MAX_TOTAL_UNPACKED) throw new Error('Roblox package manifest exceeds DragonStrap installation limits.');
  return packages;
}

function validateArchiveEntryPath(entryName) {
  const value = String(entryName || '').replace(/\\/g, '/').trim();
  if (!value) return false;
  if (value.startsWith('/') || /^[A-Za-z]:\//.test(value) || value.includes('\0')) return false;
  const parts = value.split('/').filter(Boolean);
  if (!parts.length || parts.some(part => part === '..')) return false;
  return true;
}

function safeSubpath(root, ...parts) {
  const base = path.resolve(root);
  const target = path.resolve(base, ...parts);
  const relative = path.relative(base, target);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) return target;
  throw new Error('DragonStrap refused an unsafe installation path.');
}

function runProcess(executable, args, { signal = null, maxOutputBytes = MAX_ARCHIVE_LIST_BYTES } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide:true, stdio:['ignore','pipe','pipe'] });
    const stdout = [];
    const stderr = [];
    let outBytes = 0;
    let errBytes = 0;
    let settled = false;
    const finish = (fn, value) => { if (!settled) { settled = true; cleanup(); fn(value); } };
    const abort = () => {
      try { child.kill(); } catch { /* ignore */ }
      const error = new Error('Operation canceled.');
      error.name = 'AbortError';
      finish(reject, error);
    };
    const cleanup = () => signal?.removeEventListener?.('abort', abort);
    if (signal?.aborted) return abort();
    signal?.addEventListener?.('abort', abort, { once:true });
    child.stdout.on('data', chunk => {
      outBytes += chunk.length;
      if (outBytes > maxOutputBytes) {
        try { child.kill(); } catch { /* ignore */ }
        return finish(reject, new Error('Archive listing exceeded DragonStrap safety limits.'));
      }
      stdout.push(chunk);
    });
    child.stderr.on('data', chunk => {
      errBytes += chunk.length;
      if (errBytes <= 1024 * 1024) stderr.push(chunk);
    });
    child.on('error', error => finish(reject, error));
    child.on('close', code => {
      if (code === 0) finish(resolve, { stdout:Buffer.concat(stdout).toString('utf8'), stderr:Buffer.concat(stderr).toString('utf8') });
      else finish(reject, new Error(`${executable} exited with code ${code}: ${Buffer.concat(stderr).toString('utf8').trim()}`));
    });
  });
}

async function defaultExtractZip(archivePath, destination, { signal = null } = {}) {
  await fsp.mkdir(destination, { recursive:true });
  const listing = await runProcess(process.platform === 'win32' ? 'tar.exe' : 'tar', ['-tf', archivePath], { signal });
  const entries = listing.stdout.replace(/\r\n/g, '\n').split('\n').filter(Boolean);
  if (!entries.length) throw new Error(`Archive ${path.basename(archivePath)} is empty.`);
  if (entries.length > 100000) throw new Error(`Archive ${path.basename(archivePath)} contains too many entries.`);
  for (const entry of entries) {
    if (!validateArchiveEntryPath(entry)) throw new Error(`Unsafe path detected in ${path.basename(archivePath)}.`);
  }
  await runProcess(process.platform === 'win32' ? 'tar.exe' : 'tar', ['-xf', archivePath, '-C', destination], { signal, maxOutputBytes:1024 * 1024 });
}

function defaultFreeSpace(targetPath) {
  let current = path.resolve(targetPath);
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  try {
    const stats = fs.statfsSync(current);
    return Number(stats.bavail) * Number(stats.bsize);
  } catch {
    return null;
  }
}

async function md5File(filePath) {
  const hash = crypto.createHash('md5');
  await new Promise((resolve, reject) => {
    const input = fs.createReadStream(filePath);
    input.on('data', chunk => hash.update(chunk));
    input.on('error', reject);
    input.on('end', resolve);
  });
  return hash.digest('hex');
}

function compactOperation(operation) {
  if (!operation) return null;
  const { controller, startedMs, ...safe } = operation;
  return { ...safe };
}

class RobloxUpdateEngine extends EventEmitter {
  constructor({
    userData,
    env = process.env,
    fetchImpl = globalThis.fetch,
    channelService,
    extractor = defaultExtractZip,
    freeSpaceProvider = defaultFreeSpace,
    mirrors = DEFAULT_MIRRORS,
    timeoutMs = 20000,
    downloadConcurrency = 3,
    now = () => Date.now()
  } = {}) {
    super();
    if (!userData) throw new TypeError('RobloxUpdateEngine requires userData.');
    if (typeof fetchImpl !== 'function') throw new TypeError('RobloxUpdateEngine requires fetch.');
    if (!channelService || typeof channelService.fetchBinary !== 'function') throw new TypeError('RobloxUpdateEngine requires ChannelVersionService.');
    this.fetch = fetchImpl;
    this.channelService = channelService;
    this.extractor = extractor;
    this.freeSpaceProvider = freeSpaceProvider;
    this.mirrors = [...mirrors];
    this.timeoutMs = timeoutMs;
    this.downloadConcurrency = Math.max(1, Math.min(6, Number(downloadConcurrency) || 3));
    this.now = now;
    this.localAppData = env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    this.robloxRoot = path.join(this.localAppData, 'Roblox');
    this.versionsRoot = path.join(this.robloxRoot, 'Versions');
    this.downloadsRoot = path.join(this.robloxRoot, 'Downloads', 'DragonStrap');
    this.stagingRoot = path.join(this.versionsRoot, '.dragonstrap-staging');
    this.backupsRoot = path.join(this.robloxRoot, 'DragonStrapBackups');
    this.statePath = path.join(userData, 'roblox-install-state.json');
    this.activeOperation = null;
    this.lastProgress = this.#readState().lastProgress || null;
  }

  #readState() {
    try {
      const data = JSON.parse(fs.readFileSync(this.statePath, 'utf8'));
      return data && typeof data === 'object' ? data : {};
    } catch { return {}; }
  }

  #writeState(patch) {
    const current = this.#readState();
    const next = { ...current, ...patch };
    fs.mkdirSync(path.dirname(this.statePath), { recursive:true });
    const tmp = `${this.statePath}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, this.statePath);
    return next;
  }

  getState() {
    const stored = this.#readState();
    return {
      active:Boolean(this.activeOperation),
      operation:compactOperation(this.activeOperation),
      lastProgress:this.lastProgress,
      lastInstall:stored.lastInstall || null,
      lastRollback:stored.lastRollback || null,
      rollback:this.getRollbackState(),
      paths:{ downloads:this.downloadsRoot, versions:this.versionsRoot, staging:this.stagingRoot, backups:this.backupsRoot }
    };
  }

  getRollbackState(status = null) {
    const stored=this.#readState();
    const last=stored.lastInstall;
    if (!last?.versionGuid) return { available:false, reason:'No DragonStrap-managed Player installation has been recorded yet.' };
    if (last.rolledBack) return { available:false, reason:'The most recent DragonStrap-managed Player installation has already been rolled back.' };
    if (this.activeOperation) return { available:false, reason:'A Roblox Player installation is currently running.' };
    const currentVersion=status?.version || last.versionGuid;
    const currentDir=isVersionGuid(currentVersion) ? safeSubpath(this.versionsRoot,currentVersion) : null;
    if (last.backupPath) {
      const backup=path.resolve(last.backupPath);
      const inside=backup.startsWith(`${path.resolve(this.backupsRoot)}${path.sep}`);
      const exe=inside ? path.join(backup,'RobloxPlayerBeta.exe') : null;
      if (inside && fs.existsSync(exe)) return { available:true, type:'backup', targetVersion:last.versionGuid, sourcePath:backup, currentDir };
    }
    if (isVersionGuid(last.previousVersionGuid)) {
      const previousDir=safeSubpath(this.versionsRoot,last.previousVersionGuid);
      const exe=path.join(previousDir,'RobloxPlayerBeta.exe');
      if (fs.existsSync(exe)) return { available:true, type:'previous-version', targetVersion:last.previousVersionGuid, sourcePath:previousDir, currentDir };
    }
    return { available:false, reason:'No verified previous Roblox Player version is available for rollback.' };
  }

  async rollback(status = {}) {
    if (this.activeOperation) return { ok:false, code:'INSTALL_BUSY', message:'Roblox Player rollback is unavailable while an installation is running.' };
    const candidate=this.getRollbackState(status);
    if (!candidate.available) return { ok:false, code:'ROLLBACK_NOT_AVAILABLE', message:candidate.reason };
    const stored=this.#readState();
    const currentDir=status?.playerPath ? path.resolve(path.dirname(status.playerPath)) : candidate.currentDir;
    let quarantine=null;
    try {
      await fsp.mkdir(this.backupsRoot,{recursive:true});
      if (candidate.type === 'backup') {
        const target=safeSubpath(this.versionsRoot,stored.lastInstall.versionGuid);
        if (fs.existsSync(target)) {
          quarantine=safeSubpath(this.backupsRoot,`rollback-current-${path.basename(target)}-${this.now()}`);
          await fsp.rename(target,quarantine);
        }
        try { await fsp.rename(candidate.sourcePath,target); }
        catch(error) {
          if (quarantine && fs.existsSync(quarantine) && !fs.existsSync(target)) await fsp.rename(quarantine,target).catch(()=>{});
          throw error;
        }
        const exe=path.join(target,'RobloxPlayerBeta.exe');
        if (!fs.existsSync(exe)) throw new Error('Restored Roblox Player backup is missing RobloxPlayerBeta.exe.');
        try { await fsp.utimes(target,new Date(),new Date()); } catch {}
      } else {
        const previousDir=candidate.sourcePath;
        const exe=path.join(previousDir,'RobloxPlayerBeta.exe');
        if (!fs.existsSync(exe)) throw new Error('Previous Roblox Player version is no longer available.');
        if (currentDir && path.resolve(currentDir).toLowerCase() !== path.resolve(previousDir).toLowerCase() && fs.existsSync(currentDir)) {
          quarantine=safeSubpath(this.backupsRoot,`rollback-current-${path.basename(currentDir)}-${this.now()}`);
          await fsp.rename(currentDir,quarantine);
        }
        try { await fsp.utimes(previousDir,new Date(),new Date()); } catch {}
      }
      const lastRollback={
        fromVersion:status?.version || stored.lastInstall.versionGuid,
        toVersion:candidate.targetVersion,
        type:candidate.type,
        rolledBackAt:new Date(this.now()).toISOString(),
        quarantinePath:quarantine
      };
      this.#writeState({ lastRollback, lastInstall:{ ...stored.lastInstall, rolledBack:true, rolledBackAt:lastRollback.rolledBackAt } });
      return { ok:true, ...lastRollback, message:`Roblox Player rolled back to ${candidate.targetVersion}.` };
    } catch(error) {
      return { ok:false, code:'ROLLBACK_FAILED', message:error?.message || 'Roblox Player rollback failed.' };
    }
  }

  cancel() {
    if (!this.activeOperation?.controller) return { ok:false, code:'NO_ACTIVE_INSTALL', message:'No Roblox Player installation is running.' };
    this.activeOperation.controller.abort();
    return { ok:true, operationId:this.activeOperation.id };
  }

  #emitProgress(patch) {
    if (!this.activeOperation) return;
    Object.assign(this.activeOperation, patch, { updatedAt:new Date(this.now()).toISOString() });
    const progress = compactOperation(this.activeOperation);
    this.lastProgress = progress;
    this.emit('progress', progress);
  }

  #resourcePrefixes(channel) {
    const production = normalizeChannel(channel).toLowerCase() === 'production';
    return production ? ['', '/channel/common'] : ['/channel/common', ''];
  }

  #candidateResourceRoots(channel, preferredRoot = null) {
    const roots = [];
    if (preferredRoot) roots.push(preferredRoot.replace(/\/$/, ''));
    for (const mirror of this.mirrors) {
      for (const prefix of this.#resourcePrefixes(channel)) roots.push(`${mirror}${prefix}`.replace(/\/$/, ''));
    }
    return [...new Set(roots)];
  }

  async #fetchWithTimeout(url, options = {}, parentSignal = null) {
    const controller = new AbortController();
    const abortParent = () => controller.abort();
    if (parentSignal?.aborted) controller.abort();
    else parentSignal?.addEventListener?.('abort', abortParent, { once:true });
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetch(url, { ...options, signal:controller.signal });
    } finally {
      clearTimeout(timer);
      parentSignal?.removeEventListener?.('abort', abortParent);
    }
  }

  async #fetchManifest(versionGuid, channel, signal = null) {
    let lastError = null;
    for (const root of this.#candidateResourceRoots(channel)) {
      const endpoint = `${root}/${versionGuid}-rbxPkgManifest.txt`;
      try {
        const response = await this.#fetchWithTimeout(endpoint, { headers:{ Accept:'text/plain,*/*;q=0.8' } }, signal);
        if (!response.ok) {
          lastError = new Error(`HTTP ${response.status}`);
          continue;
        }
        const text = await response.text();
        const packages = parsePackageManifest(text);
        return { ok:true, endpoint, resourceRoot:root, packages };
      } catch (error) {
        if (error?.name === 'AbortError' && signal?.aborted) throw error;
        lastError = error;
      }
    }
    return { ok:false, code:'PACKAGE_MANIFEST_FAILED', message:lastError?.message || 'Roblox package manifest could not be downloaded.' };
  }

  #cachePath(pkg) {
    return safeSubpath(this.downloadsRoot, `${pkg.signature}-${pkg.name}`);
  }

  async #cachedPackageStatus(pkg, verifyHash = false) {
    const filePath = this.#cachePath(pkg);
    try {
      const stats = await fsp.stat(filePath);
      if (!stats.isFile() || stats.size !== pkg.packedSize) return { valid:false, filePath, size:stats.size };
      if (verifyHash && (await md5File(filePath)).toLowerCase() !== pkg.signature) return { valid:false, filePath, size:stats.size };
      return { valid:true, filePath, size:stats.size };
    } catch { return { valid:false, filePath, size:0 }; }
  }

  async createPlan(status, channel) {
    const selected = normalizeChannel(channel);
    const remote = await this.channelService.fetchBinary(BINARY_TYPES.player, selected, { includeTimestamp:true });
    if (!remote.ok) return { ...remote, stage:'version' };
    if (!isVersionGuid(remote.versionGuid)) return { ok:false, code:'INVALID_VERSION_GUID', message:'Roblox returned an invalid Player version identifier.' };
    const manifest = await this.#fetchManifest(remote.versionGuid, selected);
    if (!manifest.ok) return { ...manifest, remote };
    const unknownPackages = manifest.packages.filter(pkg => !Object.hasOwn(PACKAGE_DIRECTORY_MAP, pkg.name)).map(pkg => pkg.name);
    if (unknownPackages.length) {
      return { ok:false, code:'UNSUPPORTED_PACKAGE_LAYOUT', message:`Roblox published package(s) DragonStrap does not yet know how to place: ${unknownPackages.join(', ')}`, unknownPackages, remote, manifestEndpoint:manifest.endpoint };
    }
    let cachedBytes = 0;
    let partialBytes = 0;
    for (const pkg of manifest.packages) {
      const cached = await this.#cachedPackageStatus(pkg, true);
      if (cached.valid) cachedBytes += pkg.packedSize;
      else {
        try {
          const part = await fsp.stat(`${cached.filePath}.part`);
          if (part.isFile() && part.size > 0 && part.size <= pkg.packedSize) partialBytes += part.size;
        } catch { /* no partial */ }
      }
    }
    const totalDownloadBytes = manifest.packages.reduce((sum, pkg) => sum + pkg.packedSize, 0);
    const totalUnpackedBytes = manifest.packages.reduce((sum, pkg) => sum + pkg.size, 0);
    const remainingDownloadBytes = Math.max(0, totalDownloadBytes - cachedBytes - partialBytes);
    const requiredFreeBytes = remainingDownloadBytes + totalUnpackedBytes + SAFETY_BYTES;
    const freeBytes = this.freeSpaceProvider(this.robloxRoot);
    const current = Boolean(status?.playerPath && String(status.version || '').toLowerCase() === remote.versionGuid.toLowerCase());
    return {
      ok:true,
      channel:selected,
      displayChannel:displayChannel(selected),
      remote,
      version:remote.version,
      versionGuid:remote.versionGuid,
      current,
      installedVersion:status?.version || null,
      packageCount:manifest.packages.length,
      packages:manifest.packages,
      manifestEndpoint:manifest.endpoint,
      resourceRoot:manifest.resourceRoot,
      totalDownloadBytes,
      totalUnpackedBytes,
      cachedBytes,
      partialBytes,
      remainingDownloadBytes,
      requiredFreeBytes,
      freeBytes,
      enoughSpace:freeBytes === null ? null : freeBytes >= requiredFreeBytes,
      resumeAvailable:partialBytes > 0,
      warnings:manifest.packages.some(pkg => pkg.name === 'WebView2RuntimeInstaller.zip') ? ['WebView2 runtime installation is not automatically executed by DragonStrap.'] : []
    };
  }

  async #downloadPackage(pkg, plan, signal, byteState) {
    const finalPath = this.#cachePath(pkg);
    const partPath = `${finalPath}.part`;
    await fsp.mkdir(this.downloadsRoot, { recursive:true });

    const cached = await this.#cachedPackageStatus(pkg, true);
    if (cached.valid) {
      byteState.set(pkg.name, pkg.packedSize);
      this.#emitDownloadProgress(plan, pkg, byteState, 'cached');
      return finalPath;
    }
    await fsp.rm(finalPath, { force:true }).catch(() => {});

    const roots = this.#candidateResourceRoots(plan.channel, plan.resourceRoot);
    let lastError = null;
    for (let attempt = 0; attempt < Math.max(3, roots.length); attempt += 1) {
      if (signal.aborted) throw Object.assign(new Error('Operation canceled.'), { name:'AbortError' });
      const root = roots[attempt % roots.length];
      const url = `${root}/${plan.versionGuid}-${encodeURIComponent(pkg.name)}`;
      let resumeAt = 0;
      try {
        const stats = await fsp.stat(partPath);
        if (stats.isFile() && stats.size > 0 && stats.size <= pkg.packedSize) resumeAt = stats.size;
        else if (stats.size > pkg.packedSize) await fsp.rm(partPath, { force:true });
      } catch { /* no partial */ }
      byteState.set(pkg.name, resumeAt);
      this.#emitDownloadProgress(plan, pkg, byteState, resumeAt ? 'resuming' : 'starting');

      const headers = { Accept:'application/octet-stream' };
      if (resumeAt > 0) headers.Range = `bytes=${resumeAt}-`;
      const requestController = new AbortController();
      const abortRequest = () => requestController.abort();
      if (signal.aborted) requestController.abort();
      else signal.addEventListener('abort', abortRequest, { once:true });
      const headerTimer = setTimeout(() => requestController.abort(), this.timeoutMs);
      let response;
      try {
        response = await this.fetch(url, { headers, signal:requestController.signal });
        clearTimeout(headerTimer);
      } catch (error) {
        clearTimeout(headerTimer);
        signal.removeEventListener('abort', abortRequest);
        if (error?.name === 'AbortError' && signal.aborted) throw error;
        lastError = error;
        continue;
      }
      if (!(response.ok || response.status === 206)) {
        signal.removeEventListener('abort', abortRequest);
        lastError = new Error(`HTTP ${response.status} downloading ${pkg.name}`);
        continue;
      }
      if (resumeAt > 0 && response.status !== 206) {
        resumeAt = 0;
        byteState.set(pkg.name, 0);
        await fsp.rm(partPath, { force:true }).catch(() => {});
      }

      const handle = await fsp.open(partPath, resumeAt > 0 ? 'a' : 'w');
      try {
        if (!response.body) throw new Error(`Empty response body downloading ${pkg.name}.`);
        let written = resumeAt;
        for await (const chunk of response.body) {
          if (signal.aborted) throw Object.assign(new Error('Operation canceled.'), { name:'AbortError' });
          const buffer = Buffer.from(chunk);
          await handle.write(buffer);
          written += buffer.length;
          if (written > pkg.packedSize) throw new Error(`Downloaded package exceeded expected size: ${pkg.name}`);
          byteState.set(pkg.name, written);
          this.#emitDownloadProgress(plan, pkg, byteState, 'downloading');
        }
      } finally {
        signal.removeEventListener('abort', abortRequest);
        await handle.close();
      }

      try {
        const stats = await fsp.stat(partPath);
        if (stats.size !== pkg.packedSize) throw new Error(`Incomplete package ${pkg.name}: ${stats.size}/${pkg.packedSize} bytes.`);
        const actual = (await md5File(partPath)).toLowerCase();
        if (actual !== pkg.signature) throw new Error(`Package hash mismatch for ${pkg.name}.`);
        await fsp.rm(finalPath, { force:true }).catch(() => {});
        await fsp.rename(partPath, finalPath);
        byteState.set(pkg.name, pkg.packedSize);
        this.#emitDownloadProgress(plan, pkg, byteState, 'verified');
        return finalPath;
      } catch (error) {
        lastError = error;
        await fsp.rm(partPath, { force:true }).catch(() => {});
        byteState.set(pkg.name, 0);
      }
    }
    throw lastError || new Error(`Failed to download ${pkg.name}.`);
  }

  #emitDownloadProgress(plan, pkg, byteState, detail) {
    const downloadedBytes = [...byteState.values()].reduce((sum, value) => sum + Number(value || 0), 0);
    const total = plan.totalDownloadBytes || 1;
    const progress = Math.min(70, Math.round((downloadedBytes / total) * 70));
    const startedMs = this.activeOperation?.startedMs || this.now();
    const elapsedSeconds = Math.max(0.25, (this.now() - startedMs) / 1000);
    this.#emitProgress({
      phase:'downloading',
      progress,
      packageName:pkg.name,
      detail,
      downloadedBytes,
      totalDownloadBytes:plan.totalDownloadBytes,
      speedBytesPerSecond:Math.round(downloadedBytes / elapsedSeconds)
    });
  }

  async #downloadAll(plan, signal) {
    const byteState = new Map();
    for (const pkg of plan.packages) {
      const cached = await this.#cachedPackageStatus(pkg, false);
      if (cached.valid) byteState.set(pkg.name, pkg.packedSize);
      else {
        try {
          const part = await fsp.stat(`${cached.filePath}.part`);
          byteState.set(pkg.name, part.isFile() && part.size <= pkg.packedSize ? part.size : 0);
        } catch { byteState.set(pkg.name, 0); }
      }
    }
    const queue = [...plan.packages];
    const workers = Array.from({ length:Math.min(this.downloadConcurrency, queue.length) }, async () => {
      while (queue.length) {
        const pkg = queue.shift();
        if (!pkg) return;
        await this.#downloadPackage(pkg, plan, signal, byteState);
      }
    });
    await Promise.all(workers);
  }

  async #extractAll(plan, stagingDir, signal) {
    for (let index = 0; index < plan.packages.length; index += 1) {
      if (signal.aborted) throw Object.assign(new Error('Operation canceled.'), { name:'AbortError' });
      const pkg = plan.packages[index];
      const destination = safeSubpath(stagingDir, PACKAGE_DIRECTORY_MAP[pkg.name]);
      const archive = this.#cachePath(pkg);
      const progress = 70 + Math.round(((index + 0.25) / Math.max(1, plan.packages.length)) * 24);
      this.#emitProgress({ phase:'extracting', progress:Math.min(94, progress), packageName:pkg.name, detail:`Extracting ${index + 1} of ${plan.packages.length}`, packageIndex:index + 1, packageCount:plan.packages.length });
      await this.extractor(archive, destination, { signal, package:pkg });
    }
    await fsp.writeFile(path.join(stagingDir, 'AppSettings.xml'), APP_SETTINGS_XML, 'utf8');
  }

  async install(status, channel) {
    if (this.activeOperation) return { ok:false, code:'INSTALL_BUSY', message:'A Roblox Player installation is already running.', operation:compactOperation(this.activeOperation) };
    const controller = new AbortController();
    const id = crypto.randomUUID();
    this.activeOperation = { id, phase:'planning', progress:0, message:'Preparing Roblox Player installation…', channel:normalizeChannel(channel), startedAt:new Date(this.now()).toISOString(), startedMs:this.now(), controller };
    this.#emitProgress({ phase:'planning', progress:1, message:'Checking Roblox deployment metadata…' });
    let stagingDir = null;
    let backupDir = null;
    let targetDir = null;
    try {
      const plan = await this.createPlan(status, channel);
      if (!plan.ok) return this.#finishFailure(plan.code || 'PLAN_FAILED', plan.message || 'Roblox installation plan failed.');
      if (plan.current && status?.playerPath && fs.existsSync(status.playerPath)) {
        return this.#finishSuccess({ alreadyCurrent:true, versionGuid:plan.versionGuid, version:plan.version, message:'Roblox Player is already current.' });
      }
      if (plan.enoughSpace === false) {
        return this.#finishFailure('INSUFFICIENT_DISK_SPACE', 'Not enough free disk space for a staged Roblox installation.', { plan });
      }
      this.#emitProgress({ phase:'planning', progress:3, message:`${plan.packageCount} packages ready for ${plan.displayChannel}.`, plan:{ version:plan.version, versionGuid:plan.versionGuid, packageCount:plan.packageCount, totalDownloadBytes:plan.totalDownloadBytes, totalUnpackedBytes:plan.totalUnpackedBytes, requiredFreeBytes:plan.requiredFreeBytes, freeBytes:plan.freeBytes, resumeAvailable:plan.resumeAvailable } });

      await fsp.mkdir(this.versionsRoot, { recursive:true });
      await fsp.mkdir(this.stagingRoot, { recursive:true });
      stagingDir = safeSubpath(this.stagingRoot, plan.versionGuid);
      targetDir = safeSubpath(this.versionsRoot, plan.versionGuid);
      await fsp.rm(stagingDir, { recursive:true, force:true });
      await fsp.mkdir(stagingDir, { recursive:true });

      await this.#downloadAll(plan, controller.signal);
      this.#emitProgress({ phase:'extracting', progress:70, message:'All packages verified. Building staged installation…' });
      await this.#extractAll(plan, stagingDir, controller.signal);

      const stagedExe = safeSubpath(stagingDir, 'RobloxPlayerBeta.exe');
      const stagedStats = await fsp.stat(stagedExe).catch(() => null);
      if (!stagedStats?.isFile() || stagedStats.size <= 0) throw new Error('Staged Roblox Player executable is missing or empty.');

      this.#emitProgress({ phase:'committing', progress:96, message:'Committing verified Roblox installation…', packageName:null });
      if (fs.existsSync(targetDir)) {
        await fsp.mkdir(this.backupsRoot, { recursive:true });
        backupDir = safeSubpath(this.backupsRoot, `${plan.versionGuid}-${this.now()}`);
        await fsp.rename(targetDir, backupDir);
      }
      try {
        await fsp.rename(stagingDir, targetDir);
        stagingDir = null;
      } catch (error) {
        if (backupDir && fs.existsSync(backupDir) && !fs.existsSync(targetDir)) await fsp.rename(backupDir, targetDir).catch(() => {});
        throw error;
      }

      const installedExe = safeSubpath(targetDir, 'RobloxPlayerBeta.exe');
      const installedStats = await fsp.stat(installedExe).catch(() => null);
      if (!installedStats?.isFile() || installedStats.size <= 0) {
        await fsp.rm(targetDir, { recursive:true, force:true }).catch(() => {});
        if (backupDir && fs.existsSync(backupDir)) await fsp.rename(backupDir, targetDir).catch(() => {});
        throw new Error('Post-install verification failed for RobloxPlayerBeta.exe.');
      }

      try { await fsp.utimes(targetDir, new Date(), new Date()); } catch { /* mtime is only a selection hint */ }
      const previousVersionGuid = isVersionGuid(status?.version) && String(status.version).toLowerCase() !== plan.versionGuid.toLowerCase() ? status.version : null;
      const lastInstall = {
        version:plan.version,
        versionGuid:plan.versionGuid,
        channel:plan.channel,
        displayChannel:plan.displayChannel,
        previousVersionGuid,
        installedAt:new Date(this.now()).toISOString(),
        packageCount:plan.packageCount,
        manifestEndpoint:plan.manifestEndpoint,
        backupPath:backupDir || null
      };
      this.#writeState({ lastInstall });
      return this.#finishSuccess({ version:plan.version, versionGuid:plan.versionGuid, playerPath:installedExe, previousVersionGuid, backupPath:backupDir || null, warnings:plan.warnings, message:`Roblox Player ${plan.versionGuid} installed successfully.` });
    } catch (error) {
      const canceled = error?.name === 'AbortError' || controller.signal.aborted;
      if (stagingDir) await fsp.rm(stagingDir, { recursive:true, force:true }).catch(() => {});
      if (backupDir && targetDir && fs.existsSync(backupDir) && !fs.existsSync(targetDir)) await fsp.rename(backupDir, targetDir).catch(() => {});
      return this.#finishFailure(canceled ? 'INSTALL_CANCELED' : 'INSTALL_FAILED', canceled ? 'Roblox Player installation was canceled. Partial downloads were kept for resume.' : (error?.message || 'Roblox Player installation failed.'), { canceled });
    }
  }

  #finishSuccess(extra) {
    this.#emitProgress({ phase:'complete', progress:100, message:extra.message || 'Roblox Player installation complete.', completedAt:new Date(this.now()).toISOString() });
    const result = { ok:true, ...extra, operation:compactOperation(this.activeOperation) };
    this.#writeState({ lastProgress:this.lastProgress });
    this.activeOperation = null;
    return result;
  }

  #finishFailure(code, message, extra = {}) {
    const canceled = code === 'INSTALL_CANCELED';
    this.#emitProgress({ phase:canceled ? 'canceled' : 'error', progress:this.activeOperation?.progress || 0, message, code, completedAt:new Date(this.now()).toISOString() });
    const result = { ok:false, code, message, ...extra, operation:compactOperation(this.activeOperation) };
    this.#writeState({ lastProgress:this.lastProgress });
    this.activeOperation = null;
    return result;
  }
}

module.exports = {
  RobloxUpdateEngine,
  PACKAGE_DIRECTORY_MAP,
  IGNORED_MANIFEST_PACKAGES,
  APP_SETTINGS_XML,
  parsePackageManifest,
  validateArchiveEntryPath,
  safeSubpath,
  md5File,
  defaultExtractZip
};
