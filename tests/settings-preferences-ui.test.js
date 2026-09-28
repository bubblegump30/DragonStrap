'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../renderer/app.js'),'utf8');
test('failed Settings-page save restores toggles and exposes inline feedback',async()=>{
  const nodes=new Map();
  const q=id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);};
  const state={settings:{notifications:true,autoRefresh:false,refreshSeconds:120,checkForUpdates:true,updateChannel:'stable'}};
  let errors=0;
  const c=vm.createContext({state,q,console:{error(){}},showToast:()=>errors++,installRefreshTimer(){},refreshUpdateState(){},window:{dragonStrap:{updateSettings:async()=>{throw Error('disk full');}}}});
  vm.runInContext(app.slice(app.indexOf('function renderPreferenceControls()'),app.indexOf('function installRefreshTimer()')),c);
  q('#notificationsSetting').checked=false;
  await c.savePreferenceChange({notifications:false});
  assert.equal(q('#notificationsSetting').checked,true);
  assert.equal(q('#notificationsSetting').disabled,false);
  assert.equal(q('#refreshSeconds').disabled,true);
  assert.match(q('#preferencesSaveStatus').textContent,/Save failed/);
  assert.equal(errors,1);
});
test('notification preference suppresses routine toasts but keeps errors visible',()=>{
  const toast={classList:{toggle(){},add(){},remove(){}}};
  const c=vm.createContext({state:{settings:{notifications:false}},q:()=>toast,clearTimeout(){},setTimeout(){}});
  vm.runInContext(app.slice(app.indexOf('function showToast('),app.indexOf('function setProductMenuOpen(')),c);
  c.showToast('Saved');assert.equal(toast.textContent,undefined);
  c.showToast('Save failed',true);assert.equal(toast.textContent,'Save failed');
});
