'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { RobloxInstallationService } = require('../src/services/roblox-installation');

test('RobloxInstallationService selects the newest Player and Studio folders', async () => {
  const local = fs.mkdtempSync(path.join(os.tmpdir(), 'dragonstrap-localappdata-'));
  const versions = path.join(local, 'Roblox', 'Versions');
  const oldDir = path.join(versions, 'version-old');
  const newDir = path.join(versions, 'version-new');
  fs.mkdirSync(oldDir, { recursive: true });
  fs.mkdirSync(newDir, { recursive: true });
  fs.writeFileSync(path.join(oldDir, 'RobloxPlayerBeta.exe'), '');
  fs.writeFileSync(path.join(newDir, 'RobloxPlayerBeta.exe'), '');
  fs.writeFileSync(path.join(newDir, 'RobloxStudioBeta.exe'), '');
  const past = new Date(Date.now() - 60000);
  fs.utimesSync(oldDir, past, past);
  const service = new RobloxInstallationService({ LOCALAPPDATA: local });
  const status = await service.getStatus();
  assert.equal(status.installed, true);
  assert.equal(status.studioInstalled, true);
  assert.equal(status.version, 'version-new');
  assert.equal(status.studioVersion, 'version-new');
  fs.rmSync(local, { recursive: true, force: true });
});
