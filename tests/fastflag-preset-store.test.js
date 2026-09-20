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

test('FastFlagPresetStore exports and parses the portable sharing schema', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dragonstrap-preset-share-'));
  const store = new FastFlagPresetStore(root);
  const preset = store.save('Shared Flags', { FFlagExample:'True' });
  const doc = store.exportDocument(preset.id, '1.4.0');
  assert.equal(doc.schema, 'dragonstrap.fastflag-preset.v1');
  assert.equal(doc.preset.name, 'Shared Flags');
  assert.equal(doc.exportedByVersion, '1.4.0');
  const parsed = store.parseSharedDocument(doc);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.flags, { FFlagExample:'True' });
  fs.rmSync(root, { recursive:true, force:true });
});

test('FastFlagPresetStore rejects unknown shared preset schemas', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dragonstrap-preset-share-bad-'));
  const store = new FastFlagPresetStore(root);
  const parsed = store.parseSharedDocument({ schema:'other.v9', preset:{name:'Bad',flags:{FFlagExample:'True'}} });
  assert.equal(parsed.ok, false);
  assert.equal(parsed.code, 'UNSUPPORTED_PRESET_SCHEMA');
  fs.rmSync(root, { recursive:true, force:true });
});
