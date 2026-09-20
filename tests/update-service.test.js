'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const os=require('os');
const path=require('path');
const { UpdateService, compareVersions }=require('../src/services/update-service');

test('compareVersions handles stable semantic versions',()=>{
  assert.equal(compareVersions('0.9.5','0.9.0'),1);
  assert.equal(compareVersions('v1.0.0','1.0.0'),0);
  assert.equal(compareVersions('1.0.0-beta.1','1.0.0'),-1);
});

test('UpdateService reports an unconfigured release feed safely',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dragonstrap-update-'));
  const config=path.join(dir,'release.config.json');
  fs.writeFileSync(config,JSON.stringify({provider:'github',repository:''}));
  const service=new UpdateService({currentVersion:'0.9.5',configPath:config,fetchImpl:async()=>{throw new Error('should not fetch')}});
  const result=await service.check('stable');
  assert.equal(result.ok,false);
  assert.equal(result.code,'FEED_NOT_CONFIGURED');
});

test('UpdateService recognizes a newer GitHub release',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dragonstrap-update-'));
  const config=path.join(dir,'release.config.json');
  fs.writeFileSync(config,JSON.stringify({provider:'github',repository:'owner/DragonStrap'}));
  const service=new UpdateService({currentVersion:'0.9.5',configPath:config,fetchImpl:async()=>({ok:true,json:async()=>({tag_name:'v1.0.0',draft:false,prerelease:false,name:'DragonStrap v1.0.0',html_url:'https://github.com/owner/DragonStrap/releases/tag/v1.0.0',published_at:'2026-09-19T00:00:00Z',assets:[{name:'DragonStrap-1.0.0-x64-portable.exe',browser_download_url:'https://github.com/owner/DragonStrap/releases/download/v1.0.0/a.exe',size:123}]})})});
  const result=await service.check('stable');
  assert.equal(result.ok,true);
  assert.equal(result.updateAvailable,true);
  assert.equal(result.latestVersion,'1.0.0');
  assert.equal(result.windowsAsset.name,'DragonStrap-1.0.0-x64-portable.exe');
});

test('UpdateService exposes release notes, full asset inventory, and GitHub digests',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dragonstrap-update-notes-'));
  const config=path.join(dir,'release.config.json');
  fs.writeFileSync(config,JSON.stringify({provider:'github',repository:'owner/DragonStrap'}));
  const service=new UpdateService({currentVersion:'1.1.2',configPath:config,fetchImpl:async()=>({ok:true,json:async()=>({
    tag_name:'v1.3.0',draft:false,prerelease:false,name:'DragonStrap v1.3.0',body:'Release notes here',html_url:'https://github.com/owner/DragonStrap/releases/tag/v1.3.0',published_at:'2026-09-19T00:00:00Z',
    assets:[
      {name:'DragonStrap-Setup-1.3.0-x64.exe',browser_download_url:'https://github.com/owner/DragonStrap/releases/download/v1.3.0/setup.exe',size:100,digest:`sha256:${'a'.repeat(64)}`},
      {name:'SHA256SUMS.txt',browser_download_url:'https://github.com/owner/DragonStrap/releases/download/v1.3.0/SHA256SUMS.txt',size:120}
    ]
  })})});
  const result=await service.check('stable');
  assert.equal(result.releaseNotes,'Release notes here');
  assert.equal(result.assets.length,2);
  assert.equal(result.assets[0].digest,`sha256:${'a'.repeat(64)}`);
  assert.equal(result.checksumAsset.name,'SHA256SUMS.txt');
});

test('UpdateService prerelease channel selects the highest semantic version from published releases',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dragonstrap-update-prerelease-'));
  const config=path.join(dir,'release.config.json');
  fs.writeFileSync(config,JSON.stringify({provider:'github',repository:'owner/DragonStrap'}));
  const releases=[
    {tag_name:'v1.3.0',draft:false,prerelease:false,name:'1.3.0',assets:[]},
    {tag_name:'v1.4.0-beta.1',draft:false,prerelease:true,name:'1.4 beta',assets:[]},
    {tag_name:'v1.2.9',draft:false,prerelease:false,name:'1.2.9',assets:[]}
  ];
  const service=new UpdateService({currentVersion:'1.3.0',configPath:config,fetchImpl:async()=>({ok:true,json:async()=>releases})});
  const result=await service.check('prerelease');
  assert.equal(result.latestVersion,'1.4.0-beta.1');
  assert.equal(result.prerelease,true);
  assert.equal(result.updateAvailable,true);
});
