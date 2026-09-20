'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { StudioProjectHistoryStore } = require('../src/services/studio-project-history-store');

test('StudioProjectHistoryStore deduplicates and persists recent projects', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dragonstrap-studio-history-'));
  const store = new StudioProjectHistoryStore(dir, 5);
  const a = path.join(dir, 'A.rbxl');
  store.add(a, { size:10, modifiedAt:'2026-09-20T00:00:00.000Z', launchProfile:'standard' });
  store.add(a, { size:20, modifiedAt:'2026-09-20T01:00:00.000Z', launchProfile:'protected' });
  assert.equal(store.getAll().length, 1);
  assert.equal(store.getAll()[0].openCount, 2);
  assert.equal(store.getAll()[0].lastKnownSize, 20);
  assert.equal(store.getAll()[0].lastLaunchProfile, 'protected');
  const reloaded = new StudioProjectHistoryStore(dir, 5);
  assert.equal(reloaded.getAll()[0].path, a);
});
