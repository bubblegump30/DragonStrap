'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'renderer/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'renderer/app.js'), 'utf8');

test('Server Intelligence 2.0 exposes occupancy, favorites, recent, comparison and provider-health controls', () => {
  for (const id of ['serverOccupancySelect','serverFavoritesOnly','serverFavoritesList','serverRecentList','serverProviderDiagnostics','serverCompareList','serverCompareClearBtn']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /SERVER INTELLIGENCE 2\.0/);
});

test('Server Intelligence renderer wires favorites, recent join recording, comparison and latency history', () => {
  assert.match(app, /toggleServerFavorite/);
  assert.match(app, /recordServerJoin/);
  assert.match(app, /latencyHistory/);
  assert.match(app, /compareIds/);
});
