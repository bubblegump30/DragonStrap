'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const os=require('os');
const path=require('path');
const { StudioFastFlagService }=require('../src/services/studio-fastflag-service');

function fixture(shared=false){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dragonstrap-studio-flags-'));
  const studioDir=path.join(root,'Roblox','Versions','version-studio');
  const playerDir=shared?studioDir:path.join(root,'Roblox','Versions','version-player');
  fs.mkdirSync(studioDir,{recursive:true}); fs.mkdirSync(playerDir,{recursive:true});
  const studioPath=path.join(studioDir,'RobloxStudioBeta.exe'); fs.writeFileSync(studioPath,'');
  const playerPath=path.join(playerDir,'RobloxPlayerBeta.exe'); fs.writeFileSync(playerPath,'');
  return {root,status:{studioPath,playerPath},service:new StudioFastFlagService(path.join(root,'userdata'))};
}

test('StudioFastFlagService writes only an isolated Studio ClientSettings file',()=>{
  const f=fixture(false);
  assert.equal(f.service.isIsolated(f.status),true);
  const result=f.service.set(f.status,true,'FFlagStudioExample','true','boolean');
  assert.equal(result.ok,true);
  const state=f.service.getState(f.status,true);
  assert.equal(state.entries[0].key,'FFlagStudioExample');
  assert.equal(state.entries[0].value,'True');
  const playerSettings=path.join(path.dirname(f.status.playerPath),'ClientSettings','ClientAppSettings.json');
  assert.equal(fs.existsSync(playerSettings),false);
  fs.rmSync(f.root,{recursive:true,force:true});
});

test('StudioFastFlagService blocks writes when Player and Studio share ClientSettings',()=>{
  const f=fixture(true);
  assert.equal(f.service.isIsolated(f.status),false);
  const result=f.service.set(f.status,true,'FFlagStudioExample','True','boolean');
  assert.equal(result.ok,false);
  assert.equal(result.code,'STUDIO_NOT_ISOLATED');
  fs.rmSync(f.root,{recursive:true,force:true});
});

test('StudioFastFlagService requires explicit enablement',()=>{
  const f=fixture(false);
  const result=f.service.set(f.status,false,'FFlagStudioExample','True','boolean');
  assert.equal(result.code,'STUDIO_FASTFLAGS_DISABLED');
  fs.rmSync(f.root,{recursive:true,force:true});
});
