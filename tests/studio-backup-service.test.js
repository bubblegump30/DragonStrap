'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const os=require('os');
const path=require('path');
const { StudioBackupService }=require('../src/services/studio-backup-service');

test('StudioBackupService creates bounded local project backups and restores a copy',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dragonstrap-studio-backup-'));
  const project=path.join(dir,'World.rbxlx');
  fs.writeFileSync(project,'version-one');
  const service=new StudioBackupService(path.join(dir,'userdata'));
  const a=service.create(project,{retention:2,reason:'manual'});
  fs.writeFileSync(project,'version-two');
  const b=service.create(project,{retention:2,reason:'pre-launch'});
  fs.writeFileSync(project,'version-three');
  service.create(project,{retention:2,reason:'pre-launch'});
  const list=service.list(project);
  assert.equal(list.length,2);
  assert.equal(list.some(item=>item.id===a.backup.id),false);
  assert.equal(list.some(item=>item.id===b.backup.id),true);
  const restored=path.join(dir,'World-restored.rbxlx');
  const result=service.restoreCopy(project,b.backup.id,restored);
  assert.equal(result.ok,true);
  assert.equal(fs.readFileSync(restored,'utf8'),'version-two');
  fs.rmSync(dir,{recursive:true,force:true});
});

test('StudioBackupService refuses non-project restore destinations',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dragonstrap-studio-backup-ext-'));
  const project=path.join(dir,'World.rbxl'); fs.writeFileSync(project,'x');
  const service=new StudioBackupService(path.join(dir,'userdata'));
  const backup=service.create(project);
  const result=service.restoreCopy(project,backup.backup.id,path.join(dir,'bad.txt'));
  assert.equal(result.ok,false);
  assert.equal(result.code,'INVALID_RESTORE_PATH');
  fs.rmSync(dir,{recursive:true,force:true});
});
