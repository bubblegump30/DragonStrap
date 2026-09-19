'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SettingsStore } = require('../src/services/settings-store');

test('SettingsStore persists validated allowlisted settings and ignores unknown keys', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dragonstrap-settings-'));
  const store = new SettingsStore(dir);
  const updated = store.update({
    fpsCap: 165,
    launchProfile: 'balanced',
    renderMode: 'd3d11',
    msaaMode: '2',
    arbitraryExecutable: 'bad.exe'
  });
  assert.equal(updated.fpsCap, 165);
  assert.equal(updated.launchProfile, 'balanced');
  assert.equal(updated.renderMode, 'd3d11');
  assert.equal(updated.msaaMode, '2');
  assert.equal(Object.hasOwn(updated, 'arbitraryExecutable'), false);
  const reloaded = new SettingsStore(dir).getAll();
  assert.equal(reloaded.fpsCap, 165);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('SettingsStore rejects invalid Performance+ values instead of persisting them', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dragonstrap-settings-invalid-'));
  const store = new SettingsStore(dir);
  const defaults = store.getAll();
  const updated = store.update({ fpsCap: 999, renderMode: 'software', msaaMode: '16', performanceAutoApply: 'yes' });
  assert.equal(updated.fpsCap, defaults.fpsCap);
  assert.equal(updated.renderMode, defaults.renderMode);
  assert.equal(updated.msaaMode, defaults.msaaMode);
  assert.equal(updated.performanceAutoApply, defaults.performanceAutoApply);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('SettingsStore normalizes LIVE and accepts validated public channel names', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dragonstrap-settings-channel-'));
  const store = new SettingsStore(dir);
  assert.equal(store.update({ channel: 'LIVE' }).channel, 'production');
  assert.equal(store.update({ channel: 'ZCanary' }).channel, 'ZCanary');
  assert.equal(store.update({ channel: '../bad' }).channel, 'ZCanary');
  fs.rmSync(dir, { recursive: true, force: true });
});
