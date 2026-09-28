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

test('retention keeps the newest backups created in the same millisecond, including after restart', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dragonstrap-backup-tie-'));
  try {
    const project=path.join(dir,'World.rbxlx');
    const userdata=path.join(dir,'userdata');
    const now=()=>1893456000000;
    const service=new StudioBackupService(userdata,{now});
    const created=[];
    for (const content of ['one','two','three']) {
      fs.writeFileSync(project,content);
      created.push(service.create(project,{retention:2}).backup);
    }
    const reloaded=new StudioBackupService(userdata,{now});
    fs.writeFileSync(project,'four');
    const fourth=reloaded.create(project,{retention:2}).backup;
    assert.deepEqual(reloaded.list(project).map(item=>item.id),[fourth.id,created[2].id]);
    assert.equal(reloaded.get(project,created[0].id),null);
    assert.equal(reloaded.get(project,created[1].id),null);
    const destination=path.join(dir,'restored.rbxlx');
    assert.equal(reloaded.restoreCopy(project,created[2].id,destination).ok,true);
    assert.equal(fs.readFileSync(destination,'utf8'),'three');
    assert.equal(reloaded.restoreCopy(project,created[2].id,destination).code,'RESTORE_DESTINATION_EXISTS');
    assert.equal(fs.readFileSync(destination,'utf8'),'three');
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('damaged metadata cannot make retention remove a file outside its backup folder', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dragonstrap-backup-path-'));
  try {
    const project=path.join(dir,'World.rbxlx'); fs.writeFileSync(project,'original');
    const service=new StudioBackupService(path.join(dir,'userdata'));
    const first=service.create(project,{retention:2}).backup;
    const external=path.join(dir,`outside.${first.id}.rbxlx`);
    fs.writeFileSync(external,'keep me');
    const meta=path.join(service.getProjectDir(project),`${first.id}.json`);
    const record=JSON.parse(fs.readFileSync(meta,'utf8'));
    record.backupPath=external;
    fs.writeFileSync(meta,JSON.stringify(record));
    assert.equal(service.get(project,first.id),null);
    fs.writeFileSync(project,'second'); service.create(project,{retention:1});
    assert.equal(fs.readFileSync(external,'utf8'),'keep me');
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('failed metadata commit cleans up the copied backup file', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dragonstrap-backup-atomic-'));
  try {
    const project=path.join(dir,'World.rbxlx'); fs.writeFileSync(project,'original');
    const brokenFs={...fs,writeFileSync(file,...args){
      if (String(file).endsWith('.tmp')) throw Error('metadata write failed');
      return fs.writeFileSync(file,...args);
    }};
    const service=new StudioBackupService(path.join(dir,'userdata'),{fs:brokenFs});
    assert.throws(()=>service.create(project),/metadata write failed/);
    assert.deepEqual(fs.readdirSync(service.getProjectDir(project)),[]);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
