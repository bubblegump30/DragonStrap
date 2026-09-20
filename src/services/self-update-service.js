'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { spawn } = require('child_process');

const MAX_CHECKSUM_BYTES = 1024 * 1024;
const UPDATE_DOWNLOAD_TIMEOUT_MS = 30 * 60 * 1000;

function normalizeAssetName(value) {
  return path.basename(String(value || '').replace(/\\/g, '/'));
}

function parseSha256Sums(text) {
  const result = new Map();
  for (const line of String(text || '').split(/\r?\n/)) {
    const match = line.trim().match(/^([a-fA-F0-9]{64})\s+\*?(.+?)\s*$/);
    if (!match) continue;
    const name = normalizeAssetName(match[2]);
    if (name) result.set(name.toLowerCase(), match[1].toLowerCase());
  }
  return result;
}

function detectBuildMode({ isPackaged = false, env = process.env, execPath = process.execPath } = {}) {
  if (!isPackaged) return { mode:'source', label:'Source / Dev', executablePath:null };
  const portableDir = typeof env.PORTABLE_EXECUTABLE_DIR === 'string' ? env.PORTABLE_EXECUTABLE_DIR.trim() : '';
  const portableFile = typeof env.PORTABLE_EXECUTABLE_FILE === 'string' ? env.PORTABLE_EXECUTABLE_FILE.trim() : '';
  if (portableDir || portableFile) {
    let executablePath = null;
    if (portableFile) {
      executablePath = path.isAbsolute(portableFile)
        ? path.normalize(portableFile)
        : (portableDir ? path.resolve(portableDir, portableFile) : null);
    }
    return { mode:'portable', label:'Portable', executablePath };
  }
  return { mode:'installer', label:'Installed / Setup', executablePath:path.resolve(execPath) };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function selectReleaseAsset(assets, mode, version, arch = 'x64') {
  if (!Array.isArray(assets) || !version || !['portable','installer'].includes(mode)) return null;
  const kind = mode === 'portable' ? 'Portable' : 'Setup';
  const exact = new RegExp(`^DragonStrap-${kind}-${escapeRegExp(version)}-${escapeRegExp(arch)}\\.exe$`, 'i');
  return assets.find(asset => exact.test(String(asset?.name || ''))) || null;
}

function trustedReleaseDownloadUrl(value, repository) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com') return false;
    return url.pathname.toLowerCase().startsWith(`/${String(repository || '').toLowerCase()}/releases/download/`);
  } catch {
    return false;
  }
}

async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const input = fs.createReadStream(filePath);
    input.on('error', reject);
    input.on('data', chunk => hash.update(chunk));
    input.on('end', () => resolve(hash.digest('hex')));
  });
}

function quotePowerShellLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function waitForChildSpawn(child, timeoutMs = 5000) {
  if (!child || typeof child.once !== 'function') return Promise.resolve();
  return new Promise((resolve, reject) => {
    let settled=false;
    const finish=(error=null) => {
      if (settled) return;
      settled=true;
      clearTimeout(timer);
      child.removeListener?.('spawn', onSpawn);
      child.removeListener?.('error', onError);
      if (error) reject(error); else resolve();
    };
    const onSpawn=() => finish();
    const onError=error => finish(error);
    const timer=setTimeout(() => finish(new Error('Timed out while starting the update process.')), timeoutMs);
    child.once('spawn', onSpawn);
    child.once('error', onError);
  });
}

function createPortableApplyScript({ pid, stagedPath, targetPath }) {
  const newPath = `${targetPath}.dragonstrap-update`;
  const backupPath = `${targetPath}.dragonstrap-old`;
  return [
    '$ErrorActionPreference = "Stop"',
    `$DragonPid = ${Number(pid)}`,
    `$Staged = ${quotePowerShellLiteral(stagedPath)}`,
    `$Target = ${quotePowerShellLiteral(targetPath)}`,
    `$New = ${quotePowerShellLiteral(newPath)}`,
    `$Backup = ${quotePowerShellLiteral(backupPath)}`,
    'try { Wait-Process -Id $DragonPid -Timeout 90 -ErrorAction SilentlyContinue } catch {}',
    'Start-Sleep -Milliseconds 500',
    'try {',
    '  if (Test-Path -LiteralPath $New) { Remove-Item -LiteralPath $New -Force }',
    '  Copy-Item -LiteralPath $Staged -Destination $New -Force',
    '  if (Test-Path -LiteralPath $Backup) { Remove-Item -LiteralPath $Backup -Force }',
    '  if (Test-Path -LiteralPath $Target) { Move-Item -LiteralPath $Target -Destination $Backup -Force }',
    '  Move-Item -LiteralPath $New -Destination $Target -Force',
    '  Start-Process -FilePath $Target',
    '  Start-Sleep -Seconds 3',
    '  if (Test-Path -LiteralPath $Backup) { Remove-Item -LiteralPath $Backup -Force -ErrorAction SilentlyContinue }',
    '} catch {',
    '  if (-not (Test-Path -LiteralPath $Target) -and (Test-Path -LiteralPath $Backup)) { Move-Item -LiteralPath $Backup -Destination $Target -Force -ErrorAction SilentlyContinue }',
    '  exit 1',
    '}',
    'Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue'
  ].join('\r\n');
}

class SelfUpdateService extends EventEmitter {
  constructor({
    userData,
    currentVersion,
    repository,
    fetchImpl = globalThis.fetch,
    isPackaged = false,
    execPath = process.execPath,
    env = process.env,
    platform = process.platform,
    arch = process.arch,
    spawnImpl = spawn,
    pid = process.pid
  }) {
    super();
    this.userData = userData;
    this.currentVersion = currentVersion;
    this.repository = repository;
    this.fetchImpl = fetchImpl;
    this.platform = platform;
    this.arch = arch;
    this.spawnImpl = spawnImpl;
    this.pid = pid;
    this.runtime = detectBuildMode({ isPackaged, execPath, env });
    this.root = path.join(userData, 'updates');
    this.statePath = path.join(this.root, 'update-state.json');
    this.activeAbort = null;
    this.progress = { phase:'idle', percent:0, receivedBytes:0, totalBytes:0, message:'' };
  }

  getRuntimeInfo() { return { ...this.runtime, platform:this.platform, arch:this.arch }; }

  #emitProgress(patch) {
    this.progress = { ...this.progress, ...patch };
    this.emit('progress', { ...this.progress });
  }

  #readState() {
    try {
      if (!fs.existsSync(this.statePath)) return null;
      const parsed = JSON.parse(fs.readFileSync(this.statePath, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      return parsed;
    } catch { return null; }
  }

  #writeState(value) {
    fs.mkdirSync(this.root, { recursive:true });
    const temp = `${this.statePath}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.renameSync(temp, this.statePath);
  }

  #clearState() {
    try { fs.rmSync(this.statePath, { force:true }); } catch {}
  }

  getState(release = null) {
    let stored = this.#readState();
    if (stored?.version === this.currentVersion && stored?.assetPath && typeof stored.assetPath === 'string') {
      const completedPath=path.resolve(stored.assetPath);
      const root=path.resolve(this.root);
      if (completedPath.startsWith(`${root}${path.sep}`)) {
        try { fs.rmSync(completedPath, { force:true }); } catch {}
      }
      this.#clearState();
      stored=null;
    }
    let staged = null;
    if (stored?.assetPath && typeof stored.assetPath === 'string') {
      const resolved = path.resolve(stored.assetPath);
      const insideRoot = resolved === path.resolve(this.root) || resolved.startsWith(`${path.resolve(this.root)}${path.sep}`);
      if (insideRoot && fs.existsSync(resolved)) staged = { ...stored, assetPath:resolved };
    }
    if (stored && !staged) this.#clearState();
    const asset = release?.latestVersion ? selectReleaseAsset(release.assets, this.runtime.mode, release.latestVersion, this.arch) : null;
    return {
      ok:true,
      buildMode:this.runtime.mode,
      buildLabel:this.runtime.label,
      executablePath:this.runtime.executablePath,
      supported:this.platform === 'win32' && ['portable','installer'].includes(this.runtime.mode),
      selectedAsset:asset,
      staged,
      progress:{ ...this.progress }
    };
  }

  #prepare(release) {
    if (this.platform !== 'win32') return { ok:false, code:'UNSUPPORTED_PLATFORM', message:'DragonStrap self-update is currently available on Windows only.' };
    if (!release?.ok || !release.updateAvailable || !release.latestVersion) return { ok:false, code:'NO_UPDATE_AVAILABLE', message:'No newer DragonStrap release is currently selected.' };
    if (!['portable','installer'].includes(this.runtime.mode)) return { ok:false, code:'SOURCE_MODE', message:'Self-update is disabled while DragonStrap is running from source. Build or run a packaged release to use the updater.' };
    const asset = selectReleaseAsset(release.assets, this.runtime.mode, release.latestVersion, this.arch);
    if (!asset) return { ok:false, code:'UPDATE_ASSET_NOT_FOUND', message:`The release does not contain a ${this.runtime.label} ${this.arch} update artifact.` };
    const checksumAsset = Array.isArray(release.assets)
      ? (release.assets.find(item => /^SHA256SUMS\.txt$/i.test(String(item?.name || ''))) || release.assets.find(item => /sha256|checksums?/i.test(String(item?.name || ''))))
      : null;
    if (!checksumAsset) return { ok:false, code:'CHECKSUM_ASSET_NOT_FOUND', message:'The release is missing SHA256SUMS.txt, so DragonStrap will not download the update.' };
    if (!trustedReleaseDownloadUrl(asset.url, this.repository) || !trustedReleaseDownloadUrl(checksumAsset.url, this.repository)) {
      return { ok:false, code:'UNTRUSTED_RELEASE_URL', message:'The selected update assets are not hosted on the configured DragonStrap GitHub release path.' };
    }
    return { ok:true, asset, checksumAsset };
  }

  async #fetchChecksum(checksumAsset, signal) {
    const response = await this.fetchImpl(checksumAsset.url, {
      headers:{ Accept:'text/plain', 'User-Agent':`DragonStrap/${this.currentVersion}` }, signal, redirect:'follow'
    });
    if (!response.ok) throw Object.assign(new Error(`Checksum request returned HTTP ${response.status}.`), { code:'CHECKSUM_HTTP_ERROR' });
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_CHECKSUM_BYTES) throw Object.assign(new Error('Checksum file is unexpectedly large.'), { code:'CHECKSUM_TOO_LARGE' });
    return text;
  }

  async #downloadFile(asset, destination, signal) {
    const response = await this.fetchImpl(asset.url, {
      headers:{ Accept:'application/octet-stream', 'User-Agent':`DragonStrap/${this.currentVersion}` }, signal, redirect:'follow'
    });
    if (!response.ok) throw Object.assign(new Error(`Update download returned HTTP ${response.status}.`), { code:'UPDATE_DOWNLOAD_HTTP_ERROR' });
    const expectedSize = Number(asset.size || 0);
    const responseLength = Number(response.headers?.get?.('content-length') || 0);
    if (expectedSize > 0 && responseLength > 0 && responseLength !== expectedSize) throw Object.assign(new Error('Update download size does not match the GitHub release metadata.'), { code:'UPDATE_SIZE_MISMATCH' });

    const part = `${destination}.part`;
    fs.mkdirSync(path.dirname(destination), { recursive:true });
    fs.rmSync(part, { force:true });
    const output = await fs.promises.open(part, 'w');
    let received = 0;
    const total = expectedSize || responseLength || 0;
    const report = () => this.#emitProgress({ phase:'downloading', receivedBytes:received, totalBytes:total, percent:total ? Math.min(99, Math.floor((received / total) * 100)) : 0, message:`Downloading ${asset.name}` });
    report();
    let failed=false;
    try {
      if (response.body?.getReader) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (signal.aborted) throw Object.assign(new Error('Update download canceled.'), { name:'AbortError' });
          const chunk = Buffer.from(value);
          received += chunk.length;
          if (expectedSize > 0 && received > expectedSize) throw Object.assign(new Error('Update download exceeded the expected release size.'), { code:'UPDATE_SIZE_MISMATCH' });
          await output.write(chunk);
          report();
        }
      } else if (typeof response.arrayBuffer === 'function') {
        const buffer = Buffer.from(await response.arrayBuffer());
        received = buffer.length;
        await output.write(buffer);
        report();
      } else {
        throw Object.assign(new Error('The runtime cannot stream this update response.'), { code:'UPDATE_STREAM_UNAVAILABLE' });
      }
    } catch (error) {
      failed=true;
      throw error;
    } finally {
      await output.close().catch(()=>{});
      if (failed) fs.rmSync(part, { force:true });
    }
    if (expectedSize > 0 && received !== expectedSize) {
      fs.rmSync(part, { force:true });
      throw Object.assign(new Error(`Update download was incomplete (${received} of ${expectedSize} bytes).`), { code:'UPDATE_SIZE_MISMATCH' });
    }
    fs.rmSync(destination, { force:true });
    fs.renameSync(part, destination);
    return received;
  }

  async download(release) {
    if (this.activeAbort) return { ok:false, code:'UPDATE_BUSY', message:'An update download is already running.' };
    const prepared = this.#prepare(release);
    if (!prepared.ok) return prepared;
    const controller = new AbortController();
    this.activeAbort = controller;
    const timer = setTimeout(() => controller.abort(), UPDATE_DOWNLOAD_TIMEOUT_MS);
    const versionDir = path.join(this.root, `v${release.latestVersion}`);
    const destination = path.join(versionDir, normalizeAssetName(prepared.asset.name));
    try {
      this.#emitProgress({ phase:'checksums', percent:0, receivedBytes:0, totalBytes:Number(prepared.asset.size || 0), message:'Loading SHA-256 checksums…' });
      const checksumText = await this.#fetchChecksum(prepared.checksumAsset, controller.signal);
      const checksums = parseSha256Sums(checksumText);
      const expected = checksums.get(normalizeAssetName(prepared.asset.name).toLowerCase());
      if (!expected) {
        this.#emitProgress({ phase:'error', percent:0, message:`SHA256SUMS.txt does not contain ${prepared.asset.name}.` });
        return { ok:false, code:'CHECKSUM_NOT_FOUND', message:`SHA256SUMS.txt does not contain ${prepared.asset.name}.` };
      }
      const apiDigest = String(prepared.asset.digest || '').toLowerCase();
      if (apiDigest && /^sha256:[a-f0-9]{64}$/.test(apiDigest) && apiDigest.slice(7) !== expected) {
        this.#emitProgress({ phase:'error', percent:0, message:'GitHub asset digest and SHA256SUMS.txt disagree.' });
        return { ok:false, code:'CHECKSUM_METADATA_MISMATCH', message:'GitHub asset digest and SHA256SUMS.txt disagree. The update was not downloaded.' };
      }

      await this.#downloadFile(prepared.asset, destination, controller.signal);
      this.#emitProgress({ phase:'verifying', percent:99, message:'Verifying SHA-256…' });
      const actual = await sha256File(destination);
      if (actual !== expected) {
        fs.rmSync(destination, { force:true });
        this.#clearState();
        return { ok:false, code:'CHECKSUM_MISMATCH', message:'The downloaded update failed SHA-256 verification and was deleted.', expectedSha256:expected, actualSha256:actual };
      }
      const stored = {
        version:release.latestVersion,
        mode:this.runtime.mode,
        assetName:prepared.asset.name,
        assetPath:destination,
        sha256:actual,
        size:fs.statSync(destination).size,
        verifiedAt:new Date().toISOString(),
        releaseUrl:release.releaseUrl || null
      };
      this.#writeState(stored);
      this.#emitProgress({ phase:'ready', percent:100, receivedBytes:stored.size, totalBytes:stored.size, message:'Update downloaded and SHA-256 verified.' });
      return { ok:true, code:'UPDATE_READY', message:'Update downloaded and SHA-256 verified.', staged:stored, buildMode:this.runtime.mode };
    } catch (error) {
      const canceled = error?.name === 'AbortError';
      this.#emitProgress({ phase:canceled ? 'canceled' : 'error', percent:0, message:canceled ? 'Update download canceled.' : (error?.message || 'Update download failed.') });
      return { ok:false, canceled, code:canceled ? 'UPDATE_CANCELED' : (error?.code || 'UPDATE_DOWNLOAD_FAILED'), message:canceled ? 'Update download canceled.' : (error?.message || 'Update download failed.') };
    } finally {
      clearTimeout(timer);
      this.activeAbort = null;
    }
  }

  cancel() {
    if (!this.activeAbort) return { ok:false, code:'NO_ACTIVE_UPDATE', message:'No update download is running.' };
    this.activeAbort.abort();
    return { ok:true, message:'Cancel requested.' };
  }

  getRecoveryState() {
    const stateFileExists=fs.existsSync(this.statePath);
    const stored=this.#readState();
    const issues=[];
    if (stateFileExists && !stored) issues.push({ code:'UPDATE_STATE_INVALID', message:'The staged update state file is malformed.' });
    if (stored?.assetPath) {
      const resolved=path.resolve(String(stored.assetPath));
      const root=path.resolve(this.root);
      if (!resolved.startsWith(`${root}${path.sep}`)) issues.push({ code:'UPDATE_STATE_UNTRUSTED_PATH', message:'The staged update state points outside DragonStrap update storage.' });
      else if (!fs.existsSync(resolved)) issues.push({ code:'UPDATE_ASSET_MISSING', message:'The staged update file referenced by update state is missing.' });
      else {
        try {
          const size=fs.statSync(resolved).size;
          if (stored.size && size !== Number(stored.size)) issues.push({ code:'UPDATE_SIZE_CHANGED', message:'The staged update file size changed after verification.' });
        } catch { issues.push({ code:'UPDATE_ASSET_UNREADABLE', message:'The staged update file cannot be read.' }); }
      }
    }
    const leftovers=[];
    if (fs.existsSync(this.root)) {
      const stack=[this.root];
      while (stack.length && leftovers.length < 100) {
        const current=stack.pop();
        let entries=[];
        try { entries=fs.readdirSync(current,{withFileTypes:true}); } catch { continue; }
        for (const entry of entries) {
          const target=path.join(current,entry.name);
          const root=path.resolve(this.root);
          if (!path.resolve(target).startsWith(`${root}${path.sep}`)) continue;
          if (entry.isDirectory()) stack.push(target);
          else if (entry.isFile() && (entry.name.endsWith('.part') || entry.name === 'Apply-DragonStrap-Portable-Update.ps1')) leftovers.push(target);
        }
      }
    }
    if (leftovers.length) issues.push({ code:'UPDATE_LEFTOVERS', message:`${leftovers.length} interrupted update file${leftovers.length===1?'':'s'} can be cleaned.` });
    return {
      ok:true,
      active:Boolean(this.activeAbort),
      healthy:issues.length===0,
      issues,
      leftoverCount:leftovers.length,
      staged:stored?.assetPath && fs.existsSync(String(stored.assetPath)) ? { version:stored.version, assetName:stored.assetName, verifiedAt:stored.verifiedAt } : null
    };
  }

  async repairRecovery() {
    if (this.activeAbort) return { ok:false, code:'UPDATE_BUSY', message:'Update recovery cannot run while a download is active.' };
    const before=this.getRecoveryState();
    let removed=0;
    if (fs.existsSync(this.root)) {
      const stack=[this.root];
      while (stack.length) {
        const current=stack.pop();
        let entries=[];
        try { entries=fs.readdirSync(current,{withFileTypes:true}); } catch { continue; }
        for (const entry of entries) {
          const target=path.join(current,entry.name);
          const root=path.resolve(this.root);
          if (!path.resolve(target).startsWith(`${root}${path.sep}`)) continue;
          if (entry.isDirectory()) stack.push(target);
          else if (entry.isFile() && (entry.name.endsWith('.part') || entry.name === 'Apply-DragonStrap-Portable-Update.ps1')) {
            try { fs.rmSync(target,{force:true}); removed += 1; } catch {}
          }
        }
      }
    }
    const stored=this.#readState();
    let stateAction='preserved';
    if (fs.existsSync(this.statePath) && !stored) { this.#clearState(); stateAction='cleared-invalid'; }
    else if (stored?.assetPath) {
      const assetPath=path.resolve(String(stored.assetPath));
      const root=path.resolve(this.root);
      const trusted=assetPath.startsWith(`${root}${path.sep}`) && fs.existsSync(assetPath);
      if (!trusted) { this.#clearState(); stateAction='cleared-missing'; }
      else {
        try {
          const actual=await sha256File(assetPath);
          if (!stored.sha256 || actual !== stored.sha256 || (stored.size && fs.statSync(assetPath).size !== Number(stored.size))) {
            fs.rmSync(assetPath,{force:true});
            this.#clearState();
            stateAction='cleared-unverified';
          }
        } catch {
          try { fs.rmSync(assetPath,{force:true}); } catch {}
          this.#clearState();
          stateAction='cleared-unreadable';
        }
      }
    }
    return { ok:true, removed, stateAction, before, after:this.getRecoveryState(), message:'DragonStrap update recovery state was repaired.' };
  }

  async apply(release) {
    const prepared = this.#prepare(release);
    if (!prepared.ok) return prepared;
    const stored = this.#readState();
    if (!stored || stored.version !== release.latestVersion || stored.mode !== this.runtime.mode || stored.assetName !== prepared.asset.name) {
      return { ok:false, code:'UPDATE_NOT_STAGED', message:'Download and verify this release before installing it.' };
    }
    const assetPath = path.resolve(String(stored.assetPath || ''));
    const root = path.resolve(this.root);
    if (!assetPath.startsWith(`${root}${path.sep}`) || !fs.existsSync(assetPath)) return { ok:false, code:'UPDATE_FILE_MISSING', message:'The verified update file is no longer available.' };
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(), 15000);
    let publishedHash;
    try {
      const checksumText=await this.#fetchChecksum(prepared.checksumAsset, controller.signal);
      publishedHash=parseSha256Sums(checksumText).get(normalizeAssetName(prepared.asset.name).toLowerCase());
    } catch (error) {
      clearTimeout(timer);
      return { ok:false, code:error?.name === 'AbortError' ? 'CHECKSUM_RECHECK_TIMEOUT' : (error?.code || 'CHECKSUM_RECHECK_FAILED'), message:'DragonStrap could not re-verify the published checksum before applying the update.' };
    }
    clearTimeout(timer);
    if (!publishedHash) return { ok:false, code:'CHECKSUM_NOT_FOUND', message:`SHA256SUMS.txt no longer contains ${prepared.asset.name}.` };
    const apiDigest=String(prepared.asset.digest || '').toLowerCase();
    if (apiDigest && /^sha256:[a-f0-9]{64}$/.test(apiDigest) && apiDigest.slice(7) !== publishedHash) return { ok:false, code:'CHECKSUM_METADATA_MISMATCH', message:'GitHub asset digest and SHA256SUMS.txt disagree. The update will not be applied.' };
    const actual = await sha256File(assetPath);
    if (actual !== stored.sha256 || actual !== publishedHash) {
      fs.rmSync(assetPath, { force:true });
      this.#clearState();
      return { ok:false, code:'CHECKSUM_MISMATCH', message:'The staged update failed its final SHA-256 verification and has been deleted.' };
    }

    if (this.runtime.mode === 'installer') {
      try {
        const child = this.spawnImpl(assetPath, [], { detached:true, stdio:'ignore', windowsHide:false });
        await waitForChildSpawn(child);
        child.unref?.();
        return { ok:true, code:'INSTALLER_LAUNCHED', quitRequired:true, message:'Verified DragonStrap installer launched.' };
      } catch (error) {
        return { ok:false, code:'UPDATE_LAUNCH_FAILED', message:`The verified installer could not be started: ${error?.message || 'unknown launch error'}` };
      }
    }

    const target = this.runtime.executablePath;
    if (!target || !path.isAbsolute(target)) return { ok:false, code:'PORTABLE_TARGET_UNKNOWN', message:'DragonStrap could not determine the outer portable executable path safely.' };
    const helperPath = path.join(path.dirname(assetPath), 'Apply-DragonStrap-Portable-Update.ps1');
    fs.writeFileSync(helperPath, `${createPortableApplyScript({ pid:this.pid, stagedPath:assetPath, targetPath:target })}\r\n`, 'utf8');
    try {
      const child = this.spawnImpl('powershell.exe', ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helperPath], { detached:true, stdio:'ignore', windowsHide:true });
      await waitForChildSpawn(child);
      child.unref?.();
      return { ok:true, code:'PORTABLE_HANDOFF_READY', quitRequired:true, message:'Verified portable update handoff started.' };
    } catch (error) {
      return { ok:false, code:'UPDATE_LAUNCH_FAILED', message:`The portable update helper could not be started: ${error?.message || 'unknown launch error'}` };
    }
  }
}

module.exports = {
  SelfUpdateService,
  parseSha256Sums,
  detectBuildMode,
  selectReleaseAsset,
  trustedReleaseDownloadUrl,
  sha256File,
  createPortableApplyScript
};
