'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');

const html=fs.readFileSync(path.join(__dirname,'..','renderer','index.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'..','renderer','app.js'),'utf8');

test('FastFlag Manager 3.0 exposes category, bulk, diff, sharing, and snapshot controls',()=>{
  assert.match(html,/FASTFLAG MANAGER 3\.0/);
  for (const id of [
    'fastFlagCategoryFilter','fastFlagSelectFiltered','fastFlagBulkTrue','fastFlagBulkFalse','fastFlagBulkRemove',
    'fastFlagDescription','fastFlagCompatibility','fastFlagPreviewWarnings','fastFlagPreviewConflicts',
    'fastFlagPresetShare','fastFlagPresetImportShare','fastFlagSnapshotSelect','fastFlagSnapshotRestore'
  ]) assert.match(html,new RegExp(`id="${id}"`));
});

test('FastFlag Manager 3.0 renders before/after preview using the main-process validation API',()=>{
  assert.match(app,/previewFastFlags\(fastFlagPendingPatch\(\)\)/);
  assert.match(app,/change\.before/);
  assert.match(app,/change\.after/);
});

test('FastFlag Manager exposes Safe Core classification and queue controls',()=>{
  for (const id of ['fastFlagSafety','fastFlagSafeCoreCount','fastFlagLegacyCount','fastFlagSafeCoreList','fastFlagQueueSafeCore']) {
    assert.match(html,new RegExp(`id="${id}"`));
  }
  assert.match(app,/queueFastFlagSafeCore/);
  assert.equal(app.includes('row.classList.add(`trust-${item.trust.level}`)'),true);
  assert.match(app,/LEGACY/);
});
