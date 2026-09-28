'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'app.js'), 'utf8');

test('switching profiles discards an older preview and enables Apply only for the selected profile', async () => {
  const profiles = [{ id:'one', name:'One' }, { id:'two', name:'Two' }];
  const nodes = new Map();
  const q = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value:'', disabled:false, textContent:'' });
    return nodes.get(selector);
  };
  q('#configurationProfileSelect').value = 'one';
  const pending = new Map();
  const context = vm.createContext({ q, state:{ configurationProfiles:{ data:{ profiles } } }, window:{ dragonStrap:{ previewConfigurationProfile:id => new Promise(resolve => pending.set(id,resolve)) } }, renderConfigurationPreview() {}, showToast() {}, console });
  const block = source.slice(source.indexOf('function selectedConfigurationProfile()'), source.indexOf('function renderConfigurationProfileSummary(')) + source.slice(source.indexOf('let configurationPreviewRequest = 0;'), source.indexOf('async function saveCurrentConfigurationProfile()'));
  vm.runInContext(block, context);
  const old = context.previewSelectedConfigurationProfile();
  q('#configurationProfileSelect').value = 'two';
  const current = context.previewSelectedConfigurationProfile();
  pending.get('two')({ ok:true, settingsChanges:[], fastFlags:{setCount:0,removeCount:0} });
  await current;
  assert.equal(q('#configurationApplyBtn').disabled, false);
  pending.get('one')({ ok:false, message:'Stale error' });
  await old;
  assert.equal(q('#configurationApplyBtn').disabled, false);
  assert.match(q('#configurationSelectionHint').textContent, /Two:/);
});
