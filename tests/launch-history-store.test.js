'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { LaunchHistoryStore } = require('../src/services/launch-history-store');

test('LaunchHistoryStore persists newest launch first and can clear history', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dragonstrap-history-'));
  const store = new LaunchHistoryStore(dir, 3);
  store.add({ type: 'app', label: 'Roblox App', ok: true, profile: 'performance' });
  store.add({ type: 'experience', label: 'Place 1818', target: 'roblox://experiences/start?placeId=1818', ok: true, profile: 'performance' });
  assert.equal(store.getAll().length, 2);
  assert.equal(store.getAll()[0].label, 'Place 1818');
  store.clear();
  assert.deepEqual(store.getAll(), []);
});
