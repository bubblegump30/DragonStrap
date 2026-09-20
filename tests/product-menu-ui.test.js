'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'renderer', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'renderer', 'dragon-2.css'), 'utf8');

test('product identity block exposes Help and About dropdown controls', () => {
  for (const id of ['productMenuButton','productMenuPopup','productHelpBtn','productAboutBtn','helpDialog','helpDialogClose','aboutCard','aboutVersion']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /aria-haspopup=["']menu["']/);
  assert.match(html, /role=["']menu["']/);
});

test('product dropdown Help and About controls are wired to real navigation', () => {
  assert.match(js, /productMenuButton[^\n]*addEventListener\(['"]click['"]/);
  assert.match(js, /productHelpBtn[^\n]*addEventListener\(['"]click['"],\s*openDragonHelp/);
  assert.match(js, /productAboutBtn[^\n]*addEventListener\(['"]click['"],\s*openDragonAbout/);
  assert.match(js, /function openDragonAbout\(\)[\s\S]*switchView\(['"]settings['"]\)/);
  assert.match(js, /data-help-tab/);
  assert.match(js, /aboutVersion[^\n]*info\.version/);
});

test('product dropdown and help dialog have dedicated DragonStrap 2 styling', () => {
  assert.match(css, /\.product-menu-popup\s*\{/);
  assert.match(css, /\.product-menu-item\s*\{/);
  assert.match(css, /\.dragon-help-dialog\s*\{/);
});
