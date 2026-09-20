'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const os=require('os');
const path=require('path');
const { ConfigurationProfileStore, PROFILE_SCHEMA, normalizeConfiguration }=require('../src/services/configuration-profile-store');
const { MANAGED_FLAGS }=require('../src/services/performance-service');

function fixture(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dragonstrap-config-profiles-'));return{dir,store:new ConfigurationProfileStore(dir)};}

const configuration={
  performance:{fpsCap:165,renderMode:'d3d11',msaaMode:'2',launchProfile:'custom',performanceAutoApply:true},
  fastFlags:{FFlagExample:'True',[MANAGED_FLAGS.fps]:'999'},
  channel:'ZCanary',launch:{minimizeOnLaunch:true},servers:{sort:'history',occupancy:'low',favoritesOnly:true,hideFull:true}
};

test('ConfigurationProfileStore saves and reloads complete sanitized profiles',()=>{
  const f=fixture();const result=f.store.saveProfile('Competitive',configuration);assert.equal(result.ok,true);
  assert.equal(result.profile.configuration.performance.fpsCap,165);assert.equal(result.profile.configuration.channel,'ZCanary');
  assert.equal(result.profile.configuration.fastFlags.FFlagExample,'True');assert.equal(Object.hasOwn(result.profile.configuration.fastFlags,MANAGED_FLAGS.fps),false);
  const reloaded=new ConfigurationProfileStore(f.dir);assert.equal(reloaded.list().length,1);assert.equal(reloaded.list()[0].configuration.servers.hideFull,true);
  fs.rmSync(f.dir,{recursive:true,force:true});
});

test('ConfigurationProfileStore clones profiles independently and tracks active profile',()=>{
  const f=fixture();const saved=f.store.saveProfile('Base',configuration).profile;const clone=f.store.cloneProfile(saved.id,'Base Copy');assert.equal(clone.ok,true);assert.notEqual(clone.profile.id,saved.id);
  assert.equal(f.store.setActive(clone.profile.id),true);assert.equal(f.store.getState().activeProfileId,clone.profile.id);
  fs.rmSync(f.dir,{recursive:true,force:true});
});

test('Configuration profile share format imports without trusting source IDs',()=>{
  const f=fixture();const saved=f.store.saveProfile('Share Me',configuration).profile;const exported=f.store.exportDocument(saved.id);assert.equal(exported.document.schema,PROFILE_SCHEMA);
  exported.document.profile.id='profile:attacker';const imported=f.store.importDocument(exported.document);assert.equal(imported.ok,true);assert.notEqual(imported.profile.id,'profile:attacker');assert.match(imported.profile.name,/Share Me \(2\)/);
  fs.rmSync(f.dir,{recursive:true,force:true});
});

test('normalizeConfiguration falls back safely for invalid profile fields',()=>{
  const cfg=normalizeConfiguration({performance:{fpsCap:999,renderMode:'bad',msaaMode:'16'},channel:'../bad',launch:{minimizeOnLaunch:'yes'},servers:{sort:'bad',occupancy:'all',favoritesOnly:'yes'}});
  assert.deepEqual(cfg.performance,{fpsCap:240,renderMode:'default',msaaMode:'default',launchProfile:'custom',performanceAutoApply:true});
  assert.equal(cfg.channel,'production');assert.deepEqual(cfg.servers,{sort:'ping',occupancy:'any',favoritesOnly:false,hideFull:false});
});
