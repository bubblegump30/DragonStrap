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
  store.add(a);
  store.add(a);
  assert.equal(store.getAll().length, 1);
  const reloaded = new StudioProjectHistoryStore(dir, 5);
  assert.equal(reloaded.getAll()[0].path, a);
});
