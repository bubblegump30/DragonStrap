'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'renderer', 'app.js'), 'utf8');

test('Home Performance Center exposes real interactive controls', () => {
  for (const id of [
    'homePerfFpsBtn','homePerfRenderBtn','homePerfNetworkBtn','homePerfAutoBtn',
    'homePerfCustomBtn','homePerfChartBtn','homePerfFpsValue','homePerfRenderValue','homePerfStatus'
  ]) assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
});

test('Home Performance controls route to real feature workflows', () => {
  assert.match(js, /homePerfFpsBtn[^\n]*openPerformanceControl\('#fpsRange'\)/);
  assert.match(js, /homePerfRenderBtn[^\n]*openPerformanceControl\('#renderModeChoice'\)/);
  assert.match(js, /homePerfNetworkBtn[^\n]*switchView\('servers'\)/);
  assert.match(js, /homePerfChartBtn[^\n]*openPerformanceControl\('\.performance-hero'\)/);
  assert.match(js, /homePerfAutoBtn[^\n]*enableHomePerformanceAuto/);
  assert.match(js, /homePerfCustomBtn[^\n]*openHomePerformanceCustom/);
});

test('Home Auto mode uses hardware recommendation and real auto-apply setting', () => {
  assert.match(js, /recommendation = center\?\.recommendation\?\.settings/);
  assert.match(js, /performanceAutoApply:true/);
  assert.match(js, /Hardware-aware settings loaded/);
});

test('Home Performance status is derived from persisted settings', () => {
  assert.match(js, /function renderHomePerformanceWidget/);
  assert.match(js, /settings\.performanceAutoApply !== false/);
  assert.match(js, /homePerfFpsValue/);
  assert.match(js, /homePerfRenderValue/);
  assert.match(js, /Auto-apply enabled/);
  assert.match(js, /Manual mode/);
});
