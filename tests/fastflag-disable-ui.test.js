'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '../renderer/app.js'), 'utf8');

function fixture(result, confirmed = true) {
  const buttons = new Map();
  const state = { settings:{performanceAutoApply:true}, fastFlags:{pendingSet:new Map([['FFlagPending',{}]]),pendingRemove:new Set(['FFlagOld']),selectedKeys:new Set(['FFlagOld']),preview:{ok:true}} };
  let calls = 0;
  const c = vm.createContext({ state, q:id => { if (!buttons.has(id)) buttons.set(id,{}); return buttons.get(id); },
    window:{confirm:() => confirmed,dragonStrap:{disableAllFastFlags:async()=>{calls++;return result;},getSettings:async()=>({performanceAutoApply:false})}},
    clearFastFlagEditor(){},renderPerformanceSettings(){},refreshPerformanceState:async()=>{},refreshFastFlagPreview:async()=>{},
    refreshFastFlags:async()=>{ for (const button of buttons.values()) button.disabled=false; },showToast(){} });
  vm.runInContext(app.slice(app.indexOf('async function changeAllFastFlags('), app.indexOf('async function restoreFastFlagSnapshot(')), c);
  return {c,state,buttons,calls:()=>calls};
}

test('disable-all cancellation preserves pending edits and never invokes the backend', async () => {
  const f = fixture({ok:true},false);
  await f.c.changeAllFastFlags();
  assert.equal(f.calls(),0);
  assert.equal(f.state.fastFlags.pendingSet.size,1);
});

test('disable-all success discards pending edits and updates visible auto-apply settings', async () => {
  const f = fixture({ok:true,removedCount:3,protectedRemoved:1});
  await f.c.changeAllFastFlags();
  assert.equal(f.state.fastFlags.pendingSet.size,0);
  assert.equal(f.state.fastFlags.pendingRemove.size,0);
  assert.equal(f.state.settings.performanceAutoApply,false);
  assert.equal(f.buttons.get('#fastFlagDisableAll').disabled,false);
});

test('disable-all failure preserves pending edits and reenables actions', async () => {
  const f = fixture({ok:false,message:'write denied'});
  await f.c.changeAllFastFlags();
  assert.equal(f.state.fastFlags.pendingSet.size,1);
  assert.equal(f.state.settings.performanceAutoApply,true);
  assert.equal(f.buttons.get('#fastFlagDisableAll').disabled,false);
});
