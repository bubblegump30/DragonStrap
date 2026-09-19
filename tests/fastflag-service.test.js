'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { FastFlagService, classifyFlag } = require('../src/services/fastflag-service');

function fixture(initial = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dragonstrap-fastflags-'));
  const versionDir = path.join(root, 'Versions', 'version-test');
  const playerPath = path.join(versionDir, 'RobloxPlayerBeta.exe');
  const settingsPath = path.join(versionDir, 'ClientSettings', 'ClientAppSettings.json');
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(playerPath, 'stub');
  fs.writeFileSync(settingsPath, `${JSON.stringify(initial, null, 2)}\n`);
  return { root, status: { playerPath }, settingsPath };
}

test('classifyFlag recognizes core Roblox FastVariable value families', () => {
  assert.equal(classifyFlag('FFlagExample', 'True'), 'boolean');
  assert.equal(classifyFlag('DFIntExample', '12'), 'integer');
  assert.equal(classifyFlag('FStringExample', 'hello'), 'string');
  assert.equal(classifyFlag('DFFloatExample', '1.5'), 'float');
});

test('FastFlagService applies editable flags, preserves unrelated flags, and creates a backup', () => {
  const { root, status, settingsPath } = fixture({ ExistingFlag: 'keep', FFlagOld: 'False' });
  const service = new FastFlagService();
  const result = service.applyPatch(status, {
    set: [{ key: 'FFlagNewFeature', value: 'true', type: 'boolean' }],
    remove: ['FFlagOld']
  });
  assert.equal(result.ok, true);
  const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.equal(saved.ExistingFlag, 'keep');
  assert.equal(saved.FFlagNewFeature, 'True');
  assert.equal(Object.hasOwn(saved, 'FFlagOld'), false);
  assert.equal(fs.existsSync(`${settingsPath}.dragonstrap.bak`), true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('FastFlagService refuses Performance+ owned flags', () => {
  const { root, status } = fixture({});
  const service = new FastFlagService();
  const result = service.applyPatch(status, {
    set: [{ key: 'DFIntTaskSchedulerTargetFps', value: '120', type: 'integer' }]
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'PERFORMANCE_PROTECTED');
  fs.rmSync(root, { recursive: true, force: true });
});

test('FastFlagService import preview normalizes values and ignores Performance+ keys', () => {
  const service = new FastFlagService();
  const result = service.previewImport({
    FFlagExample: true,
    DFIntExample: 42,
    FStringExample: 'hello',
    DFIntTaskSchedulerTargetFps: '240',
    BadObject: { nope: true }
  });
  assert.equal(result.ok, true);
  assert.equal(result.entries.find(x => x.key === 'FFlagExample').value, 'True');
  assert.equal(result.entries.find(x => x.key === 'DFIntExample').value, '42');
  assert.deepEqual(result.ignoredProtected, ['DFIntTaskSchedulerTargetFps']);
  assert.equal(result.errors.length, 1);
});

test('FastFlagService restores the pre-DragonStrap backup', () => {
  const { root, status, settingsPath } = fixture({ FFlagOriginal: 'True' });
  const service = new FastFlagService();
  assert.equal(service.applyPatch(status, { set: [{ key: 'FFlagAdded', value: 'False', type: 'boolean' }] }).ok, true);
  const restored = service.restoreBackup(status);
  assert.equal(restored.ok, true);
  const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.deepEqual(saved, { FFlagOriginal: 'True' });
  fs.rmSync(root, { recursive: true, force: true });
});
