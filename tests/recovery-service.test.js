'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const os=require('os');
const path=require('path');
const { RecoveryService }=require('../src/services/recovery-service');

function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dragonstrap-recovery-'));
  const local=path.join(root,'LocalAppData');
  const userData=path.join(root,'DragonData');
  const versionDir=path.join(local,'Roblox','Versions','version-test');
  fs.mkdirSync(versionDir,{recursive:true});
  const playerPath=path.join(versionDir,'RobloxPlayerBeta.exe');
  const exe=Buffer.alloc(300*1024); exe.write('MZ'); fs.writeFileSync(playerPath,exe);
  fs.mkdirSync(path.join(versionDir,'content'),{recursive:true});
  fs.writeFileSync(path.join(versionDir,'AppSettings.xml'),'<Settings/>');
  const service=new RecoveryService({userData,env:{LOCALAPPDATA:local},now:(()=>{let n=Date.parse('2026-09-20T12:00:00Z');return()=>n+=1000;})()});
  return {root,local,userData,versionDir,playerPath,service,status:{installed:true,version:'version-test',playerPath}};
}

test('RecoveryService creates and transactionally restores allowlisted configuration files',()=>{
  const f=fixture();
  fs.mkdirSync(f.userData,{recursive:true});
  fs.writeFileSync(path.join(f.userData,'settings.json'),'{"fpsCap":120}\n');
  fs.mkdirSync(path.join(f.versionDir,'ClientSettings'),{recursive:true});
  fs.writeFileSync(path.join(f.versionDir,'ClientSettings','ClientAppSettings.json'),'{"FFlagExample":"True"}\n');
  const created=f.service.createRestorePoint('Known good',f.status);
  assert.equal(created.ok,true);
  assert.equal(created.restorePoint.fileCount,2);
  fs.writeFileSync(path.join(f.userData,'settings.json'),'{"fpsCap":30}\n');
  fs.writeFileSync(path.join(f.versionDir,'ClientSettings','ClientAppSettings.json'),'{"FFlagExample":"False"}\n');
  const restored=f.service.restorePoint(created.restorePoint.id,f.status);
  assert.equal(restored.ok,true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.userData,'settings.json'),'utf8')).fpsCap,120);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.versionDir,'ClientSettings','ClientAppSettings.json'),'utf8')).FFlagExample,'True');
  assert.ok(restored.safetyRestorePoint);
  fs.rmSync(f.root,{recursive:true,force:true});
});

test('RecoveryService detects corrupted Player binaries using PE and structure checks',()=>{
  const f=fixture();
  let integrity=f.service.inspectPlayer(f.status);
  assert.equal(integrity.level,'healthy');
  fs.writeFileSync(f.playerPath,'not-a-windows-executable');
  integrity=f.service.inspectPlayer(f.status);
  assert.equal(integrity.corrupted,true);
  assert.ok(integrity.checks.some(item=>item.id==='player-binary' && item.level==='error'));
  fs.rmSync(f.root,{recursive:true,force:true});
});

test('RecoveryService removes only DragonStrap abandoned staging directories when installer is idle',()=>{
  const f=fixture();
  const staging=path.join(f.local,'Roblox','Versions','.dragonstrap-staging','version-old');
  fs.mkdirSync(staging,{recursive:true});
  fs.writeFileSync(path.join(staging,'partial.txt'),'x');
  assert.equal(f.service.inspectAbandonedStaging({active:false}).count,1);
  const result=f.service.clearAbandonedStaging({active:false});
  assert.equal(result.ok,true);
  assert.equal(result.removed,1);
  assert.equal(fs.existsSync(staging),false);
  fs.rmSync(f.root,{recursive:true,force:true});
});

test('RecoveryService refuses staging cleanup during an active Player installation',()=>{
  const f=fixture();
  const result=f.service.clearAbandonedStaging({active:true});
  assert.equal(result.ok,false);
  assert.equal(result.code,'INSTALL_ACTIVE');
  fs.rmSync(f.root,{recursive:true,force:true});
});

test('RecoveryService can preserve malformed JSON in a safety point without treating it as restorable valid configuration',()=>{
  const f=fixture();
  fs.mkdirSync(f.userData,{recursive:true});
  fs.writeFileSync(path.join(f.userData,'settings.json'),'{broken-json');
  const created=f.service.createRestorePoint('Before repair',f.status);
  assert.equal(created.ok,true);
  assert.equal(created.restorePoint.fileCount,1);
  const restored=f.service.restorePoint(created.restorePoint.id,f.status);
  assert.equal(restored.ok,false);
  assert.equal(restored.code,'RESTORE_POINT_INVALID');
  fs.rmSync(f.root,{recursive:true,force:true});
});
