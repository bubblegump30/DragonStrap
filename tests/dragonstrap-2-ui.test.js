'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname,'..','renderer','index.html'),'utf8');
const app = fs.readFileSync(path.join(__dirname,'..','renderer','app.js'),'utf8');
const preload = fs.readFileSync(path.join(__dirname,'..','preload.js'),'utf8');

test('DragonStrap 2.0 Settings exposes core API/service/operation/plugin state', () => {
  for (const id of ['coreApiVersion','coreServiceCount','corePipelineState','coreOperationState','coreExtensionCount','corePluginState','coreExtensionPoints','aboutCoreApi']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(app, /refreshCoreState/);
  assert.match(preload, /apiVersion:\s*'2\.0\.0'/);
  assert.match(preload, /dragonstrap:core-state/);
});

test('DragonStrap 2.0 startup lazy-loads feature centers on navigation', () => {
  assert.match(app, /if \(name === 'fastflags'\) refreshFastFlags/);
  assert.match(app, /if \(name === 'channels'\)/);
  assert.match(app, /keeps startup lean/);
  const init = app.slice(app.lastIndexOf('(async function initialize()'));
  assert.doesNotMatch(init, /refreshFastFlags\(false\).*refreshStudioCenter/s);
});
