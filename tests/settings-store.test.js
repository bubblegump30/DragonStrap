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

test('SettingsStore persists validated update deferral metadata', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dragonstrap-settings-update-deferral-'));
  const store = new SettingsStore(dir);
  const until = 1893456000000;
  const updated = store.update({ updateDeferredUntil:until, updateDeferredVersion:'1.3.0' });
  assert.equal(updated.updateDeferredUntil, until);
  assert.equal(updated.updateDeferredVersion, '1.3.0');
  const invalid = store.update({ updateDeferredUntil:-1, updateDeferredVersion:'../../bad' });
  assert.equal(invalid.updateDeferredUntil, until);
  assert.equal(invalid.updateDeferredVersion, '1.3.0');
  fs.rmSync(dir, { recursive:true, force:true });
});

test('SettingsStore persists validated Server Intelligence profile preferences', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dragonstrap-settings-server-pref-'));
  const store = new SettingsStore(dir);
  const updated = store.update({ serverSort:'history', serverOccupancy:'busy', serverFavoritesOnly:true, serverHideFull:true });
  assert.equal(updated.serverSort,'history');
  assert.equal(updated.serverOccupancy,'busy');
  assert.equal(updated.serverFavoritesOnly,true);
  assert.equal(updated.serverHideFull,true);
  const after = store.update({ serverSort:'invalid', serverOccupancy:'invalid', serverHideFull:'yes' });
  assert.equal(after.serverSort,'history');
  assert.equal(after.serverOccupancy,'busy');
  assert.equal(after.serverHideFull,true);
  fs.rmSync(dir, { recursive:true, force:true });
});

test('preference resets affect only their declared scope and persist defaults', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dragonstrap-reset-'));
  try {
    const store = new SettingsStore(dir);
    const before = store.update({ notifications:false, autoRefresh:false, refreshSeconds:600, checkForUpdates:false, updateChannel:'prerelease', fpsCap:165, channel:'ZCanary', updateDeferredVersion:'9.0.0', updateDeferredUntil:1893456000000 });
    const general = store.resetPreferences('general');
    assert.equal(general.notifications, true);
    assert.equal(general.autoRefresh, true);
    assert.equal(general.refreshSeconds, 60);
    for (const key of Object.keys(before).filter(k => !['notifications','autoRefresh','refreshSeconds'].includes(k))) assert.equal(general[key], before[key]);
    const updates = store.resetPreferences('updates');
    assert.equal(updates.checkForUpdates, true);
    assert.equal(updates.updateChannel, 'stable');
    for (const key of Object.keys(general).filter(k => !['checkForUpdates','updateChannel'].includes(k))) assert.equal(updates[key], general[key]);
    assert.deepEqual(new SettingsStore(dir).getAll(), updates);
    assert.throws(() => store.resetPreferences('__proto__'), /Unknown/);
    assert.deepEqual(store.getAll(), updates);
  } finally { fs.rmSync(dir, { recursive:true, force:true }); }
});

test('failed preference reset preserves prior in-memory and persisted values', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dragonstrap-reset-failure-'));
  try {
    const store = new SettingsStore(dir);
    const before = store.update({notifications:false, autoRefresh:false});
    store.filePath = path.join(dir, 'blocked');
    fs.mkdirSync(store.filePath);
    assert.throws(() => store.resetPreferences('general'));
    assert.deepEqual(store.getAll(), before);
    assert.deepEqual(new SettingsStore(dir).getAll(), before);
  } finally { fs.rmSync(dir, { recursive:true, force:true }); }
});

test('first-run completion persists for new installs and migrates existing settings', () => {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'dragon-first-run-'));
  const store = new SettingsStore(fresh);
  assert.equal(store.getAll().firstRunComplete, false);
  store.update({ firstRunComplete: true });
  assert.equal(new SettingsStore(fresh).getAll().firstRunComplete, true);
  const existing = fs.mkdtempSync(path.join(os.tmpdir(), 'dragon-existing-'));
  fs.writeFileSync(path.join(existing, 'settings.json'), JSON.stringify({ notifications: false }));
  assert.equal(new SettingsStore(existing).getAll().firstRunComplete, true);
});
