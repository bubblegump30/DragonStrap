'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'renderer/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'renderer/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'renderer/styles.css'), 'utf8');

test('Roblox Overview labels real build identifiers instead of bare number fragments', () => {
  assert.match(html, /Installed Player Build/);
  assert.match(html, /Installed Studio Build/);
  assert.match(html, /Selected Channel/);
  assert.match(app, /q\('#installDetail'\)\.textContent = installed \? status\.version/);
  assert.match(app, /q\('#studioDetail'\)\.textContent = studioInstalled \? status\.studioVersion/);
  assert.doesNotMatch(app, /status\.version\.replace\('version-', ''\)/);
  assert.doesNotMatch(app, /status\.studioVersion\.replace\('version-', ''\)/);
});

test('Roblox Overview uses status dials rather than arbitrary percentage values', () => {
  assert.doesNotMatch(html, /style="--value:(?:100|85|70)"/);
  assert.match(html, /id="playerOverviewDial"/);
  assert.match(html, /id="studioOverviewDial"/);
  assert.match(app, /'READY'/);
  assert.match(app, /'MISSING'/);
  assert.match(css, /\.status-dial\.ready \.gauge-ring/);
  assert.match(css, /\.status-dial\.offline \.gauge-ring/);
});
