'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PerformanceService, MANAGED_FLAGS } = require('../src/services/performance-service');

function makeStatus() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dragonstrap-performance-'));
  const versionDir = path.join(root, 'Roblox', 'Versions', 'version-test');
  fs.mkdirSync(versionDir, { recursive: true });
  const playerPath = path.join(versionDir, 'RobloxPlayerBeta.exe');
  fs.writeFileSync(playerPath, '');
  return { root, versionDir, status: { playerPath } };
}

test('PerformanceService applies only managed flags and preserves unrelated settings', () => {
  const { root, versionDir, status } = makeStatus();
  const file = path.join(versionDir, 'ClientSettings', 'ClientAppSettings.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ FStringUnrelatedSetting: 'keep-me' }));

  const service = new PerformanceService();
  const result = service.apply(status, { fpsCap: 240, renderMode: 'd3d11', msaaMode: '1' });
  assert.equal(result.ok, true);

  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(saved.FStringUnrelatedSetting, 'keep-me');
  assert.equal(saved[MANAGED_FLAGS.fps], '240');
  assert.equal(saved[MANAGED_FLAGS.msaa], '1');
  assert.equal(saved[MANAGED_FLAGS.d3d11], 'True');
  assert.equal(Object.hasOwn(saved, MANAGED_FLAGS.vulkan), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('PerformanceService restore removes only DragonStrap managed flags', () => {
  const { root, versionDir, status } = makeStatus();
  const file = path.join(versionDir, 'ClientSettings', 'ClientAppSettings.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({
    FStringUnrelatedSetting: 'keep-me',
    [MANAGED_FLAGS.fps]: '120',
    [MANAGED_FLAGS.vulkan]: 'True'
  }));

  const service = new PerformanceService();
  const result = service.restore(status);
  assert.equal(result.ok, true);
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(saved, { FStringUnrelatedSetting: 'keep-me' });
  fs.rmSync(root, { recursive: true, force: true });
});

test('PerformanceService clamps settings to safe supported values', () => {
  const service = new PerformanceService();
  assert.deepEqual(service.normalize({ fpsCap: 999, renderMode: 'bad', msaaMode: '8' }), {
    fpsCap: 240,
    renderMode: 'default',
    msaaMode: 'default'
  });
});

test('PerformanceService refuses to replace malformed ClientAppSettings JSON', () => {
  const { root, versionDir, status } = makeStatus();
  const file = path.join(versionDir, 'ClientSettings', 'ClientAppSettings.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '{ definitely-not-json');
  const before = fs.readFileSync(file, 'utf8');

  const service = new PerformanceService();
  const result = service.apply(status, { fpsCap: 120 });
  assert.equal(result.ok, false);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  fs.rmSync(root, { recursive: true, force: true });
});
