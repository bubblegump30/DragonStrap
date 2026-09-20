'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const os=require('os');
const path=require('path');
const { StudioSettingsStore, LAUNCH_PROFILES }=require('../src/services/studio-settings-store');

test('StudioSettingsStore persists validated Studio-only settings',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dragonstrap-studio-settings-'));
  const store=new StudioSettingsStore(dir);
  const updated=store.update({channel:'ZCanary',launchProfile:'protected',autoBackup:false,backupRetention:20,fastFlagsEnabled:true});
  assert.equal(updated.channel,'ZCanary');
  assert.equal(updated.launchProfile,'protected');
  assert.equal(updated.autoBackup,false);
  assert.equal(updated.backupRetention,20);
  assert.equal(updated.fastFlagsEnabled,true);
  const reloaded=new StudioSettingsStore(dir).getAll();
  assert.deepEqual(reloaded,updated);
  fs.rmSync(dir,{recursive:true,force:true});
});

test('StudioSettingsStore rejects invalid channel/profile/retention values',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dragonstrap-studio-settings-invalid-'));
  const store=new StudioSettingsStore(dir);
  const before=store.getAll();
  const after=store.update({channel:'../bad',launchProfile:'danger',backupRetention:999,autoBackup:'yes'});
  assert.deepEqual(after,before);
  assert.equal(Object.keys(LAUNCH_PROFILES).length,3);
  fs.rmSync(dir,{recursive:true,force:true});
});
