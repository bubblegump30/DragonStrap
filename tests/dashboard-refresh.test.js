'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../renderer/app.js'), 'utf8');
function fixture(getStatus) {
  const nodes = new Map();
  const q = id => {
    if (!nodes.has(id)) nodes.set(id, { textContent: '', dataset: {}, disabled: false, setAttribute() {}, classList: { remove() {} } });
    return nodes.get(id);
  };
  const context = vm.createContext({ q, Date, state: { roblox:null, lastSuccessfulScanAt:null, launchAttempted:false, launchPending:false }, setLaunchBusy() {}, renderLaunchReadiness() {}, console: { error() {} }, showToast() {}, window: { dragonStrap: { getRobloxStatus: getStatus } } });
  vm.runInContext(source.slice(source.indexOf('function renderDashboardScan('), source.indexOf('function selectedConfigurationProfile(')), context);
  context.renderRobloxStatus = status => { context.state.roblox = status; context.renderDashboardScan('ready'); };
  return { context, q };
}
test('dashboard shares an in-flight scan and reenables refresh after success', async () => {
  let resolve, calls = 0;
  const { context: c, q } = fixture(() => { calls++; return new Promise(r => { resolve = r; }); });
  const first = c.refreshRobloxStatus();
  assert.equal(q('#homeRefresh').disabled, true);
  assert.equal(c.refreshRobloxStatus(), first);
  assert.equal(calls, 1);
  resolve({ installed: true }); await first;
  assert.equal(q('#homeRefresh').disabled, false);
  assert.equal(q('#dashboardScanStatus').dataset.state, 'ready');
  assert.equal(q('#dashboardScanStatus').textContent, 'Roblox Player ready · Studio optional');
  assert.match(q('#dashboardCheckedAt').textContent, /^Checked /);
});
test('failed scans expose unknown status, preserve check time, and allow retry', async () => {
  let fail = true;
  const { context: c, q } = fixture(async () => { if (fail) throw Error('scan failed'); return { installed: false }; });
  c.state.lastSuccessfulScanAt = new Date('2026-09-28T10:00:00Z');
  await c.refreshRobloxStatus();
  assert.equal(q('#installGauge').textContent, 'UNKNOWN');
  assert.equal(q('#studioStatus').textContent, 'Unknown');
  assert.equal(q('#dashboardScanStatus').dataset.state, 'error');
  assert.match(q('#dashboardCheckedAt').textContent, /^Last successful check /);
  assert.equal(q('#homeRefresh').disabled, false);
  fail = false; await c.refreshRobloxStatus();
  assert.equal(q('#dashboardScanStatus').dataset.state, 'missing');
  assert.equal(q('#dashboardScanStatus').textContent, 'Roblox Player not detected · Install from Channels');
});
