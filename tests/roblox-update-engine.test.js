'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const {
  RobloxUpdateEngine,
  parsePackageManifest,
  validateArchiveEntryPath,
  safeSubpath
} = require('../src/services/roblox-update-engine');

function md5(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

function manifestFor(packages) {
  const lines = ['v0'];
  for (const pkg of packages) lines.push(pkg.name, pkg.signature, String(pkg.packedSize), String(pkg.size));
  return `${lines.join('\n')}\n`;
}

function streamBody(buffer, chunkSize = buffer.length) {
  return {
    async *[Symbol.asyncIterator]() {
      for (let i = 0; i < buffer.length; i += chunkSize) yield buffer.subarray(i, Math.min(buffer.length, i + chunkSize));
    }
  };
}

function makeFixture({ packageBytes = Buffer.from('roblox-package-data'), freeBytes = 20 * 1024 ** 3, versionGuid = 'version-abc123' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dragonstrap-update-engine-'));
  const local = path.join(root, 'LocalAppData');
  const userData = path.join(root, 'DragonStrapData');
  fs.mkdirSync(local, { recursive:true });
  fs.mkdirSync(userData, { recursive:true });
  const pkg = { name:'RobloxApp.zip', signature:md5(packageBytes), packedSize:packageBytes.length, size:4096 };
  const manifest = manifestFor([pkg]);
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url:String(url), headers:{ ...(options.headers || {}) } });
    if (String(url).endsWith(`${versionGuid}-rbxPkgManifest.txt`)) {
      return { ok:true, status:200, text:async () => manifest };
    }
    if (String(url).endsWith(`${versionGuid}-RobloxApp.zip`)) {
      const range = options.headers?.Range || options.headers?.range;
      if (range) {
        const start = Number(String(range).match(/bytes=(\d+)-/)?.[1] || 0);
        return { ok:true, status:206, body:streamBody(packageBytes.subarray(start), 3) };
      }
      return { ok:true, status:200, body:streamBody(packageBytes, 3) };
    }
    return { ok:false, status:404, text:async () => '' };
  };
  const channelService = {
    async fetchBinary() {
      return { ok:true, version:'0.700.0.7000000', versionGuid, timestamp:'2026-09-19T00:00:00.000Z' };
    }
  };
  const extractor = async (_archive, destination, options = {}) => {
    await fsp.mkdir(destination, { recursive:true });
    if (options.package?.name === 'RobloxApp.zip') await fsp.writeFile(path.join(destination, 'RobloxPlayerBeta.exe'), 'fake-executable');
  };
  const engine = new RobloxUpdateEngine({
    userData,
    env:{ LOCALAPPDATA:local },
    fetchImpl,
    channelService,
    extractor,
    freeSpaceProvider:() => freeBytes,
    mirrors:['https://setup.example.test'],
    downloadConcurrency:2,
    now:(() => { let t = Date.parse('2026-09-19T12:00:00Z'); return () => (t += 100); })()
  });
  return { root, local, userData, engine, pkg, packageBytes, manifest, requests, versionGuid };
}

test('parsePackageManifest parses v0 package metadata and rejects malformed signatures', () => {
  const bytes = Buffer.from('abc');
  const signature = md5(bytes);
  const parsed = parsePackageManifest(manifestFor([{ name:'RobloxApp.zip', signature, packedSize:3, size:10 }]));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].name, 'RobloxApp.zip');
  assert.equal(parsed[0].signature, signature);
  assert.throws(() => parsePackageManifest('v0\nRobloxApp.zip\nnot-md5\n3\n10\n'), /signature/i);
});

test('parsePackageManifest safely ignores RobloxPlayerInstaller.exe while keeping Player ZIP packages', () => {
  const appBytes = Buffer.from('app');
  const installerBytes = Buffer.from('installer');
  const parsed = parsePackageManifest(manifestFor([
    { name:'RobloxPlayerInstaller.exe', signature:md5(installerBytes), packedSize:installerBytes.length, size:installerBytes.length },
    { name:'RobloxApp.zip', signature:md5(appBytes), packedSize:appBytes.length, size:4096 }
  ]));
  assert.deepEqual(parsed.map(pkg => pkg.name), ['RobloxApp.zip']);
  assert.throws(() => parsePackageManifest(manifestFor([
    { name:'FutureBootstrapper.exe', signature:md5(installerBytes), packedSize:installerBytes.length, size:installerBytes.length },
    { name:'RobloxApp.zip', signature:md5(appBytes), packedSize:appBytes.length, size:4096 }
  ])), /unsafe package name/i);
});

test('archive path validation blocks traversal and absolute paths', () => {
  assert.equal(validateArchiveEntryPath('content/textures/a.png'), true);
  assert.equal(validateArchiveEntryPath('../escape.exe'), false);
  assert.equal(validateArchiveEntryPath('/absolute/file'), false);
  assert.equal(validateArchiveEntryPath('C:/Windows/file'), false);
  assert.throws(() => safeSubpath('/safe/root', '..', 'escape'), /unsafe/i);
});

test('createPlan validates package layout and calculates staged disk requirement', async () => {
  const f = makeFixture();
  const plan = await f.engine.createPlan({ installed:false, version:'Not detected' }, 'production');
  assert.equal(plan.ok, true);
  assert.equal(plan.versionGuid, f.versionGuid);
  assert.equal(plan.packageCount, 1);
  assert.equal(plan.totalDownloadBytes, f.packageBytes.length);
  assert.equal(plan.totalUnpackedBytes, 4096);
  assert.equal(plan.enoughSpace, true);
  assert.match(plan.manifestEndpoint, /rbxPkgManifest\.txt$/);
  fs.rmSync(f.root, { recursive:true, force:true });
});

test('createPlan refuses unknown Roblox package placement instead of guessing', async () => {
  const f = makeFixture();
  const originalFetch = f.engine.fetch;
  const unknownBytes = Buffer.from('unknown');
  f.engine.fetch = async (url, options) => {
    if (String(url).endsWith(`${f.versionGuid}-rbxPkgManifest.txt`)) {
      const text = manifestFor([
        { name:'RobloxApp.zip', signature:f.pkg.signature, packedSize:f.pkg.packedSize, size:4096 },
        { name:'future-new-package.zip', signature:md5(unknownBytes), packedSize:unknownBytes.length, size:20 }
      ]);
      return { ok:true, status:200, text:async () => text };
    }
    return originalFetch(url, options);
  };
  const plan = await f.engine.createPlan({ installed:false }, 'production');
  assert.equal(plan.ok, false);
  assert.equal(plan.code, 'UNSUPPORTED_PACKAGE_LAYOUT');
  assert.deepEqual(plan.unknownPackages, ['future-new-package.zip']);
  fs.rmSync(f.root, { recursive:true, force:true });
});

test('install downloads, verifies, stages and atomically commits Roblox Player', async () => {
  const f = makeFixture();
  const previousDir = path.join(f.local, 'Roblox', 'Versions', 'version-previous');
  fs.mkdirSync(previousDir, { recursive:true });
  fs.writeFileSync(path.join(previousDir, 'RobloxPlayerBeta.exe'), 'previous-exe');
  const progress = [];
  f.engine.on('progress', item => progress.push(item.phase));
  const result = await f.engine.install({ installed:true, version:'version-previous', playerPath:path.join(previousDir, 'RobloxPlayerBeta.exe') }, 'production');
  assert.equal(result.ok, true);
  assert.equal(result.versionGuid, f.versionGuid);
  assert.equal(result.previousVersionGuid, 'version-previous');
  assert.equal(fs.existsSync(path.join(f.local, 'Roblox', 'Versions', f.versionGuid, 'RobloxPlayerBeta.exe')), true);
  assert.equal(fs.existsSync(path.join(f.local, 'Roblox', 'Versions', f.versionGuid, 'AppSettings.xml')), true);
  assert.equal(fs.existsSync(path.join(previousDir, 'RobloxPlayerBeta.exe')), true, 'previous working version must remain untouched');
  assert.ok(progress.includes('downloading'));
  assert.ok(progress.includes('extracting'));
  assert.ok(progress.includes('committing'));
  assert.equal(progress.at(-1), 'complete');
  fs.rmSync(f.root, { recursive:true, force:true });
});

test('interrupted package downloads resume with an HTTP Range request', async () => {
  const f = makeFixture({ packageBytes:Buffer.from('0123456789abcdefghij') });
  const cachePath = path.join(f.engine.downloadsRoot, `${f.pkg.signature}-${f.pkg.name}`);
  fs.mkdirSync(path.dirname(cachePath), { recursive:true });
  fs.writeFileSync(`${cachePath}.part`, f.packageBytes.subarray(0, 7));
  const plan = await f.engine.createPlan({ installed:false }, 'production');
  assert.equal(plan.resumeAvailable, true);
  assert.equal(plan.partialBytes, 7);
  const result = await f.engine.install({ installed:false, version:'Not detected', playerPath:null }, 'production');
  assert.equal(result.ok, true);
  assert.ok(f.requests.some(req => req.headers.Range === 'bytes=7-'), 'expected a byte-range resume request');
  assert.equal(fs.existsSync(`${cachePath}.part`), false);
  assert.equal(fs.existsSync(cachePath), true);
  fs.rmSync(f.root, { recursive:true, force:true });
});

test('install refuses to start when staged disk-space requirement is not met', async () => {
  const f = makeFixture({ freeBytes:1024 });
  const result = await f.engine.install({ installed:false }, 'production');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INSUFFICIENT_DISK_SPACE');
  assert.equal(fs.existsSync(path.join(f.local, 'Roblox', 'Versions', f.versionGuid)), false);
  fs.rmSync(f.root, { recursive:true, force:true });
});

test('cancel keeps an interrupted partial package for the next resume attempt', async () => {
  const packageBytes = Buffer.from('abcdefghijklmnopqrstuvwxyz0123456789');
  const f = makeFixture({ packageBytes });
  const manifest = f.manifest;
  f.engine.fetch = async (url, options = {}) => {
    if (String(url).endsWith(`${f.versionGuid}-rbxPkgManifest.txt`)) return { ok:true, status:200, text:async () => manifest };
    if (String(url).endsWith(`${f.versionGuid}-RobloxApp.zip`)) {
      const signal = options.signal;
      return {
        ok:true,
        status:200,
        body:{
          async *[Symbol.asyncIterator]() {
            yield packageBytes.subarray(0, 8);
            await new Promise((resolve, reject) => {
              const timer = setTimeout(resolve, 500);
              signal?.addEventListener?.('abort', () => {
                clearTimeout(timer);
                const error = new Error('aborted');
                error.name = 'AbortError';
                reject(error);
              }, { once:true });
            });
            yield packageBytes.subarray(8);
          }
        }
      };
    }
    return { ok:false, status:404, text:async () => '' };
  };
  let cancelSent = false;
  f.engine.on('progress', progress => {
    if (!cancelSent && progress.phase === 'downloading' && progress.downloadedBytes >= 8) {
      cancelSent = true;
      f.engine.cancel();
    }
  });
  const result = await f.engine.install({ installed:false }, 'production');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INSTALL_CANCELED');
  const cachePath = path.join(f.engine.downloadsRoot, `${f.pkg.signature}-${f.pkg.name}`);
  assert.equal(fs.existsSync(`${cachePath}.part`), true);
  assert.equal(fs.statSync(`${cachePath}.part`).size, 8);
  fs.rmSync(f.root, { recursive:true, force:true });
});

test('RobloxUpdateEngine exposes and performs rollback to the preserved previous Player version', async () => {
  const f=makeFixture();
  const previousDir=path.join(f.local,'Roblox','Versions','version-previous');
  fs.mkdirSync(previousDir,{recursive:true});
  fs.writeFileSync(path.join(previousDir,'RobloxPlayerBeta.exe'),'previous-exe');
  const install=await f.engine.install({installed:true,version:'version-previous',playerPath:path.join(previousDir,'RobloxPlayerBeta.exe')},'production');
  assert.equal(install.ok,true);
  const currentPath=path.join(f.local,'Roblox','Versions',f.versionGuid,'RobloxPlayerBeta.exe');
  const rollbackState=f.engine.getRollbackState({version:f.versionGuid,playerPath:currentPath});
  assert.equal(rollbackState.available,true);
  assert.equal(rollbackState.targetVersion,'version-previous');
  const rolled=await f.engine.rollback({version:f.versionGuid,playerPath:currentPath});
  assert.equal(rolled.ok,true);
  assert.equal(rolled.toVersion,'version-previous');
  assert.equal(fs.existsSync(previousDir),true);
  assert.equal(fs.existsSync(path.dirname(currentPath)),false);
  assert.ok(rolled.quarantinePath && fs.existsSync(rolled.quarantinePath));
  assert.equal(f.engine.getRollbackState({version:'version-previous',playerPath:path.join(previousDir,'RobloxPlayerBeta.exe')}).available,false);
  fs.rmSync(f.root,{recursive:true,force:true});
});
