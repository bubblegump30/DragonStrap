'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const os=require('os');
const path=require('path');
const { SettingsStore }=require('../src/services/settings-store');
const { PerformanceService, MANAGED_FLAGS }=require('../src/services/performance-service');
const { FastFlagService }=require('../src/services/fastflag-service');
const { FastFlagSnapshotStore }=require('../src/services/fastflag-snapshot-store');
const { ConfigurationProfileStore }=require('../src/services/configuration-profile-store');
const { ConfigurationProfileService }=require('../src/services/configuration-profile-service');

function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dragonstrap-config-service-'));const userData=path.join(root,'data');const version=path.join(root,'Roblox','Versions','version-test');fs.mkdirSync(version,{recursive:true});
  const playerPath=path.join(version,'RobloxPlayerBeta.exe');fs.writeFileSync(playerPath,'x');const settingsPath=path.join(version,'ClientSettings','ClientAppSettings.json');fs.mkdirSync(path.dirname(settingsPath),{recursive:true});fs.writeFileSync(settingsPath,JSON.stringify({FFlagOld:'True',[MANAGED_FLAGS.fps]:'120'}));
  const settingsStore=new SettingsStore(userData);const performanceService=new PerformanceService();const snapshotStore=new FastFlagSnapshotStore(userData);const fastFlagService=new FastFlagService(fs,{snapshotStore});const store=new ConfigurationProfileStore(userData);const service=new ConfigurationProfileService({store,settingsStore,fastFlagService,performanceService});return{root,userData,playerPath,settingsPath,settingsStore,store,service};
}

test('ConfigurationProfileService captures all supported configuration domains',()=>{
  const f=fixture();f.settingsStore.update({fpsCap:144,renderMode:'vulkan',msaaMode:'2',performanceAutoApply:false,channel:'ZCanary',minimizeOnLaunch:true,serverSort:'history',serverOccupancy:'busy',serverFavoritesOnly:true,serverHideFull:true});
  const result=f.service.captureCurrent({playerPath:f.playerPath});assert.equal(result.ok,true);assert.equal(result.configuration.performance.fpsCap,144);assert.equal(result.configuration.fastFlags.FFlagOld,'True');assert.equal(Object.hasOwn(result.configuration.fastFlags,MANAGED_FLAGS.fps),false);assert.equal(result.configuration.servers.hideFull,true);fs.rmSync(f.root,{recursive:true,force:true});
});

test('ConfigurationProfileService applies an exact editable FastFlag set and Performance+ settings',()=>{
  const f=fixture();const saved=f.store.saveProfile('Target',{performance:{fpsCap:165,renderMode:'d3d11',msaaMode:'4',launchProfile:'custom',performanceAutoApply:true},fastFlags:{FFlagNew:'False'},channel:'production',launch:{minimizeOnLaunch:true},servers:{sort:'space',occupancy:'low',favoritesOnly:false,hideFull:true}}).profile;
  const preview=f.service.previewApply({playerPath:f.playerPath},saved.id);assert.equal(preview.ok,true);assert.equal(preview.fastFlags.removeCount,1);assert.equal(preview.fastFlags.setCount,1);
  const result=f.service.apply({playerPath:f.playerPath},saved.id);assert.equal(result.ok,true);const json=JSON.parse(fs.readFileSync(f.settingsPath,'utf8'));assert.equal(json.FFlagNew,'False');assert.equal(Object.hasOwn(json,'FFlagOld'),false);assert.equal(json[MANAGED_FLAGS.fps],'165');assert.equal(json[MANAGED_FLAGS.msaa],'4');assert.equal(json[MANAGED_FLAGS.d3d11],'True');assert.equal(f.settingsStore.getAll().serverSort,'space');assert.equal(f.store.getActiveId(),saved.id);fs.rmSync(f.root,{recursive:true,force:true});
});

test('ConfigurationProfileService rolls settings and editable flags back when the final Performance+ stage fails',()=>{
  const f=fixture();
  f.settingsStore.update({fpsCap:120,renderMode:'default',msaaMode:'2',channel:'production',minimizeOnLaunch:false,serverSort:'ping',serverOccupancy:'any',serverFavoritesOnly:false,serverHideFull:false});
  const target=f.store.saveProfile('Will Roll Back',{performance:{fpsCap:200,renderMode:'vulkan',msaaMode:'4',launchProfile:'custom',performanceAutoApply:true},fastFlags:{FFlagReplacement:'False'},channel:'ZCanary',launch:{minimizeOnLaunch:true},servers:{sort:'history',occupancy:'busy',favoritesOnly:true,hideFull:true}}).profile;
  let calls=0;
  const failingService=new ConfigurationProfileService({store:f.store,settingsStore:f.settingsStore,fastFlagService:new FastFlagService(fs,{snapshotStore:new FastFlagSnapshotStore(f.userData)}),performanceService:{apply(){calls+=1;return calls===1?{ok:false,code:'TEST_FAILURE',message:'simulated performance failure'}:{ok:true};}}});
  const result=failingService.apply({playerPath:f.playerPath},target.id);assert.equal(result.ok,false);assert.equal(result.code,'TEST_FAILURE');
  const settings=f.settingsStore.getAll();assert.equal(settings.fpsCap,120);assert.equal(settings.channel,'production');assert.equal(settings.serverSort,'ping');
  const json=JSON.parse(fs.readFileSync(f.settingsPath,'utf8'));assert.equal(json.FFlagOld,'True');assert.equal(Object.hasOwn(json,'FFlagReplacement'),false);assert.equal(f.store.getActiveId(),null);
  fs.rmSync(f.root,{recursive:true,force:true});
});
