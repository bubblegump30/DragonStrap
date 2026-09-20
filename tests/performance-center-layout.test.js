'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'performance-center.css'), 'utf8');

test('Performance Center bottom row fills the desktop grid', () => {
  assert.match(css, /\.performance-center-layout \.performance-state-card\{grid-column:span 2\}/);
  assert.match(css, /\.performance-center-layout \.performance-safety-card\{grid-column:auto;min-height:250px\}/);
  assert.doesNotMatch(css, /\.performance-center-layout \.performance-state-card\{grid-column:auto\}/);
});

test('Performance Center bottom row stays gap-free at medium and compact widths', () => {
  assert.match(css, /@media\(max-width:1400px\)[\s\S]*?\.performance-center-layout \.performance-state-card\{grid-column:1\}[\s\S]*?\.performance-center-layout \.performance-safety-card\{grid-column:2\}/);
  assert.match(css, /@media\(max-width:900px\)[\s\S]*?\.performance-center-layout \.performance-state-card,[\s\S]*?\.performance-center-layout \.performance-safety-card\{grid-column:1\}/);
});
