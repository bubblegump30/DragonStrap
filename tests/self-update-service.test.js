'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const {
  SelfUpdateService,
  parseSha256Sums,
  detectBuildMode,
  selectReleaseAsset,
  trustedReleaseDownloadUrl,
  createPortableApplyScript
} = require('../src/services/self-update-service');

const REPO='bubblegump30/DragonStrap';

function sha(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function assetUrl(version, name) { return `https://github.com/${REPO}/releases/download/v${version}/${name}`; }
function fakeResponse(body, contentType='application/octet-stream') {
  const buffer=Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  return {
    ok:true,
    status:200,
    headers:{ get:name => String(name).toLowerCase()==='content-length' ? String(buffer.length) : (String(name).toLowerCase()==='content-type' ? contentType : null) },
    async text(){ return buffer.toString('utf8'); },
    async arrayBuffer(){ return buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength); }
  };
}
function releaseFor(mode, version, binary, checksum) {
  const kind=mode==='portable' ? 'Portable' : 'Setup';
  const name=`DragonStrap-${kind}-${version}-x64.exe`;
  const checksumName='SHA256SUMS.txt';
  return {
    ok:true,
    updateAvailable:true,
    latestVersion:version,
    releaseUrl:`https://github.com/${REPO}/releases/tag/v${version}`,
    assets:[
      { name, url:assetUrl(version,name), size:binary.length, digest:`sha256:${sha(binary)}` },
      { name:checksumName, url:assetUrl(version,checksumName), size:checksum.length, digest:'' }
    ]
  };
}

test('parseSha256Sums accepts standard and binary-marker checksum lines',()=>{
  const a='a'.repeat(64), b='b'.repeat(64);
  const parsed=parseSha256Sums(`${a}  DragonStrap-Portable-1.3.0-x64.exe\n${b} *DragonStrap-Setup-1.3.0-x64.exe\n`);
  assert.equal(parsed.get('dragonstrap-portable-1.3.0-x64.exe'),a);
  assert.equal(parsed.get('dragonstrap-setup-1.3.0-x64.exe'),b);
});

test('detectBuildMode distinguishes source, portable, and installed builds',()=>{
  assert.equal(detectBuildMode({isPackaged:false}).mode,'source');
  const portable=detectBuildMode({isPackaged:true,execPath:'C:\\Temp\\DragonStrap.exe',env:{PORTABLE_EXECUTABLE_DIR:'C:\\Tools',PORTABLE_EXECUTABLE_FILE:'DragonStrap.exe'}});
  assert.equal(portable.mode,'portable');
  assert.match(portable.executablePath,/DragonStrap\.exe$/);
  assert.equal(detectBuildMode({isPackaged:true,execPath:'C:\\Program Files\\DragonStrap\\DragonStrap.exe',env:{}}).mode,'installer');
});

test('selectReleaseAsset chooses build-mode-specific Windows artifact',()=>{
  const assets=[
    {name:'DragonStrap-Portable-1.3.0-x64.exe'},
    {name:'DragonStrap-Setup-1.3.0-x64.exe'}
  ];
  assert.equal(selectReleaseAsset(assets,'portable','1.3.0','x64').name,'DragonStrap-Portable-1.3.0-x64.exe');
  assert.equal(selectReleaseAsset(assets,'installer','1.3.0','x64').name,'DragonStrap-Setup-1.3.0-x64.exe');
});

test('trustedReleaseDownloadUrl only accepts configured GitHub release paths',()=>{
  assert.equal(trustedReleaseDownloadUrl(assetUrl('1.3.0','a.exe'),REPO),true);
  assert.equal(trustedReleaseDownloadUrl('https://example.com/a.exe',REPO),false);
  assert.equal(trustedReleaseDownloadUrl('https://github.com/other/repo/releases/download/v1/a.exe',REPO),false);
});

test('SelfUpdateService downloads and SHA-256 verifies the portable artifact',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dragonstrap-self-update-'));
  const binary=Buffer.from('verified DragonStrap portable binary');
  const hash=sha(binary);
  const checksum=Buffer.from(`${hash}  DragonStrap-Portable-1.3.0-x64.exe\n`);
  const release=releaseFor('portable','1.3.0',binary,checksum);
  const fetchImpl=async url => String(url).endsWith('SHA256SUMS.txt') ? fakeResponse(checksum,'text/plain') : fakeResponse(binary);
  const service=new SelfUpdateService({userData:dir,currentVersion:'1.1.2',repository:REPO,fetchImpl,isPackaged:true,execPath:'C:\\Temp\\inner.exe',env:{PORTABLE_EXECUTABLE_DIR:'C:\\Tools',PORTABLE_EXECUTABLE_FILE:'DragonStrap.exe'},platform:'win32',arch:'x64'});
  const result=await service.download(release);
  assert.equal(result.ok,true);
  assert.equal(result.staged.sha256,hash);
  assert.equal(fs.existsSync(result.staged.assetPath),true);
  assert.equal(service.getState(release).staged.version,'1.3.0');
  fs.rmSync(dir,{recursive:true,force:true});
});

test('SelfUpdateService deletes an artifact that fails SHA-256 verification',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dragonstrap-self-update-bad-'));
  const binary=Buffer.from('tampered binary');
  const checksum=Buffer.from(`${'f'.repeat(64)}  DragonStrap-Portable-1.3.0-x64.exe\n`);
  const release=releaseFor('portable','1.3.0',binary,checksum);
  release.assets[0].digest='';
  const fetchImpl=async url => String(url).endsWith('SHA256SUMS.txt') ? fakeResponse(checksum,'text/plain') : fakeResponse(binary);
  const service=new SelfUpdateService({userData:dir,currentVersion:'1.1.2',repository:REPO,fetchImpl,isPackaged:true,env:{PORTABLE_EXECUTABLE_DIR:'C:\\Tools',PORTABLE_EXECUTABLE_FILE:'DragonStrap.exe'},platform:'win32',arch:'x64'});
  const result=await service.download(release);
  assert.equal(result.ok,false);
  assert.equal(result.code,'CHECKSUM_MISMATCH');
  assert.equal(service.getState(release).staged,null);
  fs.rmSync(dir,{recursive:true,force:true});
});

test('SelfUpdateService refuses binary updates in source mode',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dragonstrap-self-update-source-'));
  const binary=Buffer.from('binary');
  const checksum=Buffer.from(`${sha(binary)}  DragonStrap-Setup-1.3.0-x64.exe\n`);
  const release=releaseFor('installer','1.3.0',binary,checksum);
  const service=new SelfUpdateService({userData:dir,currentVersion:'1.1.2',repository:REPO,fetchImpl:async()=>{throw new Error('must not fetch');},isPackaged:false,platform:'win32',arch:'x64'});
  const result=await service.download(release);
  assert.equal(result.ok,false);
  assert.equal(result.code,'SOURCE_MODE');
  fs.rmSync(dir,{recursive:true,force:true});
});

test('portable apply script includes wait, backup, replacement, and relaunch operations',()=>{
  const script=createPortableApplyScript({pid:42,stagedPath:'C:\\Updates\\new.exe',targetPath:'C:\\Tools\\DragonStrap.exe'});
  assert.match(script,/Wait-Process/);
  assert.match(script,/dragonstrap-old/);
  assert.match(script,/Move-Item/);
  assert.match(script,/Start-Process/);
});


test('installed self-update rechecks SHA-256 before launching verified Setup',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dragonstrap-self-update-setup-'));
  const binary=Buffer.from('verified setup binary');
  const hash=sha(binary);
  const checksum=Buffer.from(`${hash}  DragonStrap-Setup-1.3.0-x64.exe\n`);
  const release=releaseFor('installer','1.3.0',binary,checksum);
  const fetchImpl=async url => String(url).endsWith('SHA256SUMS.txt') ? fakeResponse(checksum,'text/plain') : fakeResponse(binary);
  const launches=[];
  const spawnImpl=(command,args,options)=>{
    launches.push({command,args,options});
    const child=new EventEmitter();
    child.unref=()=>{};
    queueMicrotask(()=>child.emit('spawn'));
    return child;
  };
  const service=new SelfUpdateService({userData:dir,currentVersion:'1.1.2',repository:REPO,fetchImpl,isPackaged:true,execPath:'C:\\Program Files\\DragonStrap\\DragonStrap.exe',env:{},platform:'win32',arch:'x64',spawnImpl});
  assert.equal((await service.download(release)).ok,true);
  const result=await service.apply(release);
  assert.equal(result.ok,true);
  assert.equal(result.code,'INSTALLER_LAUNCHED');
  assert.equal(launches.length,1);
  assert.match(launches[0].command,/DragonStrap-Setup-1\.3\.0-x64\.exe$/);
  fs.rmSync(dir,{recursive:true,force:true});
});

test('SelfUpdateService recovery cleans interrupted leftovers and malformed update state',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dragonstrap-self-update-recovery-'));
  const service=new SelfUpdateService({userData:dir,currentVersion:'1.9.0',repository:REPO,fetchImpl:async()=>{throw new Error('no network');},isPackaged:false,platform:'win32',arch:'x64'});
  fs.mkdirSync(service.root,{recursive:true});
  fs.writeFileSync(service.statePath,'{bad-json');
  fs.writeFileSync(path.join(service.root,'orphan.exe.part'),'partial');
  fs.writeFileSync(path.join(service.root,'Apply-DragonStrap-Portable-Update.ps1'),'helper');
  const before=service.getRecoveryState();
  assert.equal(before.healthy,false);
  assert.ok(before.leftoverCount>=2);
  const result=await service.repairRecovery();
  assert.equal(result.ok,true);
  assert.equal(result.after.healthy,true);
  assert.equal(fs.existsSync(service.statePath),false);
  assert.equal(fs.existsSync(path.join(service.root,'orphan.exe.part')),false);
  fs.rmSync(dir,{recursive:true,force:true});
});
