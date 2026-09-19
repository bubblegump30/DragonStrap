'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { FastFlagPresetStore } = require('../src/services/fastflag-preset-store');

test('FastFlagPresetStore saves, reloads, and deletes snapshots', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dragonstrap-presets-'));
  let store = new FastFlagPresetStore(root);
  const preset = store.save('My Flags', { FFlagExample: 'True', DFIntExample: '5' });
  assert.equal(store.list()[0].flagCount, 2);
  store = new FastFlagPresetStore(root);
  assert.equal(store.get(preset.id).flags.FFlagExample, 'True');
  const deleted = store.delete(preset.id);
  assert.equal(deleted.deleted, true);
  assert.equal(store.list().length, 0);
  fs.rmSync(root, { recursive: true, force: true });
});
