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

test('FastFlagService enriches entries with categories, descriptions, and active Performance+ conflict warnings', () => {
  const { root, status } = fixture({
    DFIntTaskSchedulerTargetFps: '120',
    DFIntCustomTargetFpsCap: '144',
    FFlagDebugExperimentalThing: 'True'
  });
  const service = new FastFlagService();
  const state = service.getState(status);
  assert.equal(state.ok, true);
  const fps = state.entries.find(item => item.key === 'DFIntCustomTargetFpsCap');
  assert.equal(fps.category, 'Performance');
  assert.match(fps.description, /performance-related name/i);
  assert.equal(fps.warnings.some(w => w.code === 'PERFORMANCE_FAMILY_FPS' && w.severity === 'warning'), true);
  assert.equal(state.conflictCount, 1);
  const experimental = state.entries.find(item => item.key === 'FFlagDebugExperimentalThing');
  assert.equal(experimental.warnings.some(w => w.code === 'EXPERIMENTAL_FLAG'), true);
  fs.rmSync(root, { recursive:true, force:true });
});

test('FastFlagService previewPatch returns normalized before/after changes without writing the file', () => {
  const { root, status, settingsPath } = fixture({ FFlagExample:'False', DFIntExample:'5' });
  const service = new FastFlagService();
  const before = fs.readFileSync(settingsPath, 'utf8');
  const preview = service.previewPatch(status, {
    set:[{key:'FFlagExample',value:'1',type:'boolean'},{key:'DFIntExample',value:'9',type:'integer'}],
    remove:[]
  });
  assert.equal(preview.ok, true);
  assert.equal(preview.changes.find(x=>x.key==='FFlagExample').before, 'False');
  assert.equal(preview.changes.find(x=>x.key==='FFlagExample').after, 'True');
  assert.equal(preview.changes.find(x=>x.key==='DFIntExample').after, '9');
  assert.equal(fs.readFileSync(settingsPath, 'utf8'), before);
  fs.rmSync(root, { recursive:true, force:true });
});

test('FastFlagService exposes a conservative five-flag Safe Core catalog', () => {
  const { root, status } = fixture({});
  const service = new FastFlagService();
  const state = service.getState(status);
  assert.equal(state.ok, true);
  assert.equal(state.safeCoreCatalog.length, 5);
  assert.deepEqual(state.safeCoreCatalog.map(item => item.key), [
    'FFlagHandleAltEnterFullscreenManually',
    'DFFlagDisableDPIScale',
    'FIntDebugForceMSAASamples',
    'DFFlagTextureQualityOverrideEnabled',
    'DFIntTextureQualityOverride'
  ]);
  assert.equal(state.safeCoreCatalog.find(item => item.key === 'FIntDebugForceMSAASamples').protected, true);
  assert.equal(state.safeCoreCatalog.filter(item => !item.protected).length, 4);
  fs.rmSync(root, { recursive:true, force:true });
});

test('FastFlagService classifies Safe Core, legacy, experimental, and unknown flags', () => {
  const { root, status } = fixture({
    DFFlagDisableDPIScale:'True',
    DFIntTaskSchedulerTargetFps:'120',
    FFlagDebugExperimentalThing:'True',
    FStringCompletelyUnknown:'hello'
  });
  const service = new FastFlagService();
  const state = service.getState(status);
  assert.equal(state.entries.find(item => item.key === 'DFFlagDisableDPIScale').trust.level, 'safe');
  const legacy=state.entries.find(item => item.key === 'DFIntTaskSchedulerTargetFps');
  assert.equal(legacy.trust.level, 'legacy');
  assert.equal(legacy.warnings.some(w => w.code === 'LEGACY_COMPATIBILITY'), true);
  assert.equal(state.entries.find(item => item.key === 'FFlagDebugExperimentalThing').trust.level, 'experimental');
  assert.equal(state.entries.find(item => item.key === 'FStringCompletelyUnknown').trust.level, 'unknown');
  fs.rmSync(root, { recursive:true, force:true });
});

test('FastFlagService preview carries trust metadata for Safe Core changes', () => {
  const { root, status } = fixture({});
  const service = new FastFlagService();
  const preview=service.previewPatch(status,{set:[{key:'DFFlagDisableDPIScale',value:'True',type:'boolean'}],remove:[]});
  assert.equal(preview.ok,true);
  assert.equal(preview.changes[0].trust.level,'safe');
  assert.equal(preview.changes[0].warnings.some(w=>w.code==='SAFE_CORE'),true);
  fs.rmSync(root, { recursive:true, force:true });
});
