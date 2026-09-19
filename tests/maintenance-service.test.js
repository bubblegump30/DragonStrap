'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { MaintenanceService, isSubPath } = require('../src/services/maintenance-service');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dragonstrap-maintenance-'));
  const localAppData = path.join(root, 'Local');
  const tempRoot = path.join(root, 'Temp');
  const userData = path.join(root, 'DragonStrapData');
  const versionDir = path.join(localAppData, 'Roblox', 'Versions', 'version-current');
  const playerPath = path.join(versionDir, 'RobloxPlayerBeta.exe');
  const studioPath = path.join(versionDir, 'RobloxStudioBeta.exe');
  fs.mkdirSync(versionDir, { recursive:true });
  fs.writeFileSync(playerPath, 'player');
  fs.writeFileSync(studioPath, 'studio');
  return { root, localAppData, tempRoot, userData, versionDir, playerPath, studioPath, service:new MaintenanceService({ localAppData, tempRoot, userData }) };
}

test('MaintenanceService reports installation and valid client settings health', () => {
  const f = fixture();
  const settings = path.join(f.versionDir, 'ClientSettings', 'ClientAppSettings.json');
  fs.mkdirSync(path.dirname(settings), { recursive:true });
  fs.writeFileSync(settings, '{"FFlagExample":"True"}');
  const state = f.service.getState({ playerPath:f.playerPath, studioPath:f.studioPath, version:'version-current', studioVersion:'version-current' }, { version:'0.9.0' });
  assert.equal(state.health, 'healthy');
  assert.equal(state.clientSettings.state, 'valid');
  assert.equal(state.installation.player.exists, true);
  fs.rmSync(f.root, { recursive:true, force:true });
});

test('MaintenanceService cache cleanup only clears known cache roots', () => {
  const f = fixture();
  const cacheFile = path.join(f.userData, 'Cache', 'data.bin');
  const outside = path.join(f.root, 'keep.txt');
  fs.mkdirSync(path.dirname(cacheFile), { recursive:true });
  fs.writeFileSync(cacheFile, Buffer.alloc(1024));
  fs.writeFileSync(outside, 'keep');
  const result = f.service.clearCache('dragonstrap');
  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(cacheFile), false);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'keep');
  fs.rmSync(f.root, { recursive:true, force:true });
});

test('MaintenanceService repairs malformed client settings and preserves broken copy', () => {
  const f = fixture();
  const settings = path.join(f.versionDir, 'ClientSettings', 'ClientAppSettings.json');
  fs.mkdirSync(path.dirname(settings), { recursive:true });
  fs.writeFileSync(settings, '{bad-json');
  fs.writeFileSync(`${settings}.dragonstrap.bak`, '{"FFlagRestored":"True"}');
  const result = f.service.repairClientSettings({ playerPath:f.playerPath });
  assert.equal(result.ok, true);
  assert.equal(result.repaired, true);
  assert.equal(result.source, 'backup');
  assert.deepEqual(JSON.parse(fs.readFileSync(settings, 'utf8')), { FFlagRestored:'True' });
  assert.equal(fs.existsSync(result.brokenCopy), true);
  fs.rmSync(f.root, { recursive:true, force:true });
});

test('MaintenanceService clears only old Roblox log files', () => {
  const f = fixture();
  const logs = path.join(f.localAppData, 'Roblox', 'logs');
  fs.mkdirSync(logs, { recursive:true });
  const oldLog = path.join(logs, 'old.log');
  const freshLog = path.join(logs, 'fresh.log');
  fs.writeFileSync(oldLog, 'old');
  fs.writeFileSync(freshLog, 'fresh');
  const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  fs.utimesSync(oldLog, old, old);
  const result = f.service.clearOldLogs(7);
  assert.equal(result.removedFiles, 1);
  assert.equal(fs.existsSync(oldLog), false);
  assert.equal(fs.existsSync(freshLog), true);
  fs.rmSync(f.root, { recursive:true, force:true });
});

test('MaintenanceService diagnostic report omits file contents', () => {
  const f = fixture();
  const report = f.service.buildDiagnosticReport({ playerPath:f.playerPath, version:'version-current' }, { name:'DragonStrap', version:'0.9.0' });
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.app.version, '0.9.0');
  assert.equal(Object.hasOwn(report, 'settingsContents'), false);
  fs.rmSync(f.root, { recursive:true, force:true });
});

test('isSubPath rejects sibling path traversal', () => {
  assert.equal(isSubPath('/safe/root', '/safe/root/cache'), true);
  assert.equal(isSubPath('/safe/root', '/safe/root-cache'), false);
});
