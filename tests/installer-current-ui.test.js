'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'renderer', 'app.js'), 'utf8');

test('CURRENT install plan presents no-download state without misleading remaining bytes', () => {
  assert.match(html, /id="playerInstallDownloadLabel"/);
  assert.match(app, /plan\.current/);
  assert.match(app, /Package size/);
  assert.match(app, /analyzed • no download required/);
  assert.match(app, /no staging required/);
  assert.match(app, /playerInstallPercent'\)\.textContent = 'CURRENT'/);
  assert.match(app, /No installation is required\./);
});
