'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const os=require('os');
const path=require('path');
const { FastFlagService }=require('../src/services/fastflag-service');
const { FastFlagSnapshotStore }=require('../src/services/fastflag-snapshot-store');

function fixture(initial={}) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dragonstrap-fastflag-snapshots-'));
  const versionDir=path.join(root,'Roblox','Versions','version-test');
  const playerPath=path.join(versionDir,'RobloxPlayerBeta.exe');
  const settingsPath=path.join(versionDir,'ClientSettings','ClientAppSettings.json');
  fs.mkdirSync(path.dirname(settingsPath),{recursive:true});
  fs.writeFileSync(playerPath,'stub');
  fs.writeFileSync(settingsPath,`${JSON.stringify(initial,null,2)}\n`);
  const snapshots=new FastFlagSnapshotStore(root);
  const service=new FastFlagService(fs,{snapshotStore:snapshots});
  return {root,status:{playerPath},settingsPath,snapshots,service};
}

test('FastFlagService creates an automatic snapshot before applying manual changes',()=>{
  const f=fixture({FFlagBefore:'True'});
  const result=f.service.applyPatch(f.status,{set:[{key:'FFlagAfter',value:'False',type:'boolean'}]});
  assert.equal(result.ok,true);
  assert.ok(result.snapshot?.id);
  const list=f.service.listSnapshots();
  assert.equal(list.length,1);
  const stored=f.snapshots.get(list[0].id);
  assert.deepEqual(stored.flags,{FFlagBefore:'True'});
  fs.rmSync(f.root,{recursive:true,force:true});
});

test('snapshot restore returns editable flags while preserving current Performance+ owned values',()=>{
  const f=fixture({FFlagOriginal:'True',DFIntTaskSchedulerTargetFps:'120'});
  assert.equal(f.service.applyPatch(f.status,{set:[{key:'FFlagLater',value:'True',type:'boolean'}]}).ok,true);
  const snapshot=f.service.listSnapshots()[0];
  const current=JSON.parse(fs.readFileSync(f.settingsPath,'utf8'));
  current.DFIntTaskSchedulerTargetFps='240';
  fs.writeFileSync(f.settingsPath,`${JSON.stringify(current,null,2)}\n`);
  const restored=f.service.restoreSnapshot(f.status,snapshot.id);
  assert.equal(restored.ok,true);
  assert.equal(restored.protectedPreserved,1);
  const saved=JSON.parse(fs.readFileSync(f.settingsPath,'utf8'));
  assert.equal(saved.FFlagOriginal,'True');
  assert.equal(Object.hasOwn(saved,'FFlagLater'),false);
  assert.equal(saved.DFIntTaskSchedulerTargetFps,'240');
  assert.equal(f.service.listSnapshots().length,2);
  fs.rmSync(f.root,{recursive:true,force:true});
});
