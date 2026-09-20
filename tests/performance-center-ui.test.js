'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'renderer', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'renderer', 'purple-dragon.css'), 'utf8');

test('Performance Center 2.0 exposes hardware, runtime, profiles and experience controls', () => {
  assert.match(html, /PERFORMANCE CENTER 2\.0/);
  for (const id of [
    'perfHardwareTier','perfCpu','perfGpu','perfMemory','perfRefresh','perfPowerPlan',
    'useHardwareRecommendationBtn','perfProcessStatus','performanceStartupChecks','performanceRecommendations',
    'performanceProfileSelect','savePerformanceProfileBtn','performanceExperiencePlaceId',
    'performanceExperienceProfile','assignPerformanceExperienceBtn','performanceExperienceList'
  ]) assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
});

test('Performance Center renderer wires live refresh and profile actions', () => {
  assert.match(js, /refreshPerformanceCenter/);
  assert.match(js, /startPerformanceCenterPolling/);
  assert.match(js, /savePerformanceProfile/);
  assert.match(js, /assignPerformanceExperience/);
  assert.match(js, /useHardwareRecommendation/);
});


test('Performance profile preset copy is bounded inside each card', () => {
  assert.match(html, /class="perf-preset-icon"/);
  assert.match(html, /class="perf-preset-copy"/);
  assert.match(css, /grid-template-columns:22px minmax\(0,1fr\)/);
  assert.match(css, /\.perf-presets \.perf-preset-copy\{min-width:0/);
  assert.match(css, /\.perf-presets \.perf-preset-copy strong\{[^}]*white-space:nowrap[^}]*overflow:hidden[^}]*text-overflow:ellipsis/);
  assert.match(css, /\.perf-presets \.perf-preset-copy small\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/);
});
