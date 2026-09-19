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
