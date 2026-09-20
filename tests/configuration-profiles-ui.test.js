'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','renderer','index.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'..','renderer','app.js'),'utf8');

test('Profiles & Configuration Center exposes the complete profile workflow',()=>{
  assert.match(html,/PROFILES & CONFIGURATION CENTER/);
  for(const id of ['configurationProfileSelect','configurationProfileName','configurationSaveBtn','configurationApplyBtn','configurationCloneBtn','configurationImportBtn','configurationExportBtn','configurationDeleteBtn','configurationPreviewBtn','configurationPreviewList']) assert.match(html,new RegExp(`id="${id}"`));
  assert.match(app,/saveConfigurationProfile/);assert.match(app,/applyConfigurationProfile/);assert.match(app,/cloneConfigurationProfile/);assert.match(app,/previewConfigurationProfile/);
});

test('Server preference controls include persistent hide-full state for profiles',()=>{assert.match(html,/id="serverHideFull"/);assert.match(app,/serverHideFull/);});
