'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {ModService,assetPath}=require('../src/services/mod-service');
function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dragon-mod-test-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const versionsRoot=path.join(root,'Versions'), version='version-fixture';
  const folder=path.join(versionsRoot,version);
  fs.mkdirSync(path.join(folder,'content','sounds'),{recursive:true});
  fs.writeFileSync(path.join(folder,'RobloxPlayerBeta.exe'),'fixture executable');
  const target='content/sounds/example.ogg', destination=path.join(folder,...target.split('/'));
  fs.writeFileSync(destination,'original sound');
  const source=path.join(root,'replacement.ogg');fs.writeFileSync(source,'replacement sound');
  const userData=path.join(root,'data'), service=new ModService({userData,versionsRoot});
  return {root,folder,target,destination,source,userData,versionsRoot,service,status:{version,playerPath:path.join(folder,'RobloxPlayerBeta.exe')}};
}
test('Mods import is local-only; preview, apply and restart-safe restore preserve exact original bytes',t=>{
  const f=fixture(t);const imported=f.service.import(f.source,f.target,'Custom sound');
  assert.equal(fs.readFileSync(f.destination,'utf8'),'original sound');
  assert.equal(imported.mods[0].bytes,undefined);
  const plan=f.service.plan(imported.mods[0].id,f.status);
  f.service.apply(plan.token,f.status);
  assert.equal(fs.readFileSync(f.destination,'utf8'),'replacement sound');
  const restarted=new ModService(f);assert.ok(restarted.state().active);
  restarted.restore();assert.equal(fs.readFileSync(f.destination,'utf8'),'original sound');assert.equal(restarted.state().active,null);
});
test('Mods reject executable, script, traversal, alternate stream and Windows reserved target names',()=>{
  for(const target of ['../content/sounds/x.ogg','content/sounds/../x.ogg','content/sounds/x.ogg:exe','C:/content/sounds/x.ogg','content\\sounds\\x.ogg','content/sounds/con.ogg','content/sounds/x.ogg.','content/sounds/x.lua','content/textures/x.exe','ClientSettings/x.json','content/fonts/families/x.json'])assert.throws(()=>assetPath(target),target);
});
test('Mods detect a changed target and consume stale review tokens without writing',t=>{
  const f=fixture(t), mod=f.service.import(f.source,f.target,'Sound').mods[0];
  const plan=f.service.plan(mod.id,f.status);fs.writeFileSync(f.destination,'third-party change');
  assert.throws(()=>f.service.apply(plan.token,f.status),/target changed/);
  assert.equal(fs.readFileSync(f.destination,'utf8'),'third-party change');assert.equal(f.service.state().active,null);
  assert.throws(()=>f.service.apply(plan.token,f.status),/Preview/);
});
test('Mods require a fresh preview for each Player version and block missing/shared Studio targets',t=>{
  const f=fixture(t), mod=f.service.import(f.source,f.target,'Sound').mods[0];
  const plan=f.service.plan(mod.id,f.status);assert.throws(()=>f.service.apply(plan.token,{...f.status,version:'version-new'}),/changed/);
  fs.writeFileSync(path.join(f.folder,'RobloxStudioBeta.exe'),'fixture');assert.throws(()=>f.service.plan(mod.id,f.status),/Studio/);
});
test('Mods restore refuses third-party changes and retains the original backup',t=>{
  const f=fixture(t), mod=f.service.import(f.source,f.target,'Sound').mods[0];
  f.service.apply(f.service.plan(mod.id,f.status).token,f.status);
  fs.writeFileSync(f.destination,'other program');assert.throws(()=>f.service.restore(),/another program/);
  assert.ok(f.service.state().active);assert.equal(fs.readFileSync(f.destination,'utf8'),'other program');
});
test('An interrupted Mods apply has a durable backup, blocks another apply, and can restore',t=>{
  const f=fixture(t), mod=f.service.import(f.source,f.target,'Sound').mods[0];
  f.service.replace=()=>{throw new Error('simulated write failure');};
  assert.throws(()=>f.service.apply(f.service.plan(mod.id,f.status).token,f.status),/simulated/);
  const restarted=new ModService(f);assert.throws(()=>restarted.plan(mod.id,f.status),/Restore/);restarted.restore();assert.equal(fs.readFileSync(f.destination,'utf8'),'original sound');
});
test('Mods validate original backup checksums and never accept an arbitrary recovery destination',t=>{
  const f=fixture(t),mod=f.service.import(f.source,f.target,'Sound').mods[0];f.service.apply(f.service.plan(mod.id,f.status).token,f.status);
  const file=path.join(f.userData,'mods','active.json'), active=JSON.parse(fs.readFileSync(file));
  fs.writeFileSync(file,JSON.stringify({...active,target:'../outside.ogg'}));assert.throws(()=>f.service.restore());
  fs.writeFileSync(file,JSON.stringify({...active,original:'corrupt'}));assert.throws(()=>f.service.restore(),/checksum/);
  assert.equal(fs.readFileSync(f.destination,'utf8'),'replacement sound');
});
test('Mods reject linked asset directories and linked imports',t=>{
  const f=fixture(t), outside=path.join(f.root,'outside');fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'file.ogg'),'outside');
  fs.symlinkSync(outside,path.join(f.folder,'content','sounds','linked'),'junction');
  const mod=f.service.import(f.source,'content/sounds/linked/file.ogg','Linked').mods[0];assert.throws(()=>f.service.plan(mod.id,f.status),/Linked/);
  assert.throws(()=>f.service.import(path.join(f.folder,'content','sounds','linked','file.ogg'),f.target,'Import'),/Linked/);
});
test('Mods enforce asset size, matching extensions and active-library removal rules',t=>{
  const f=fixture(t);assert.throws(()=>f.service.import(f.source,'content/textures/x.png','Wrong'),/extensions/);
  const mod=f.service.import(f.source,f.target,'Sound').mods[0];f.service.apply(f.service.plan(mod.id,f.status).token,f.status);
  assert.throws(()=>f.service.remove(mod.id),/Restore/);f.service.restore();assert.equal(f.service.remove(mod.id).mods.length,0);
  fs.writeFileSync(f.source,Buffer.alloc(8*1024*1024+1));assert.throws(()=>f.service.import(f.source,f.target,'Large'),/8 MB/);
});
