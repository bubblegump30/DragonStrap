'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PerformanceProfileStore } = require('../src/services/performance-profile-store');

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dragonstrap-perf-profiles-'));
  return { dir, store:new PerformanceProfileStore(dir) };
}

test('PerformanceProfileStore exposes built-ins and normalizes custom settings', () => {
  const f = fixture();
  const result = f.store.saveCustomProfile('Competitive', { fpsCap:999, renderMode:'bad', msaaMode:'8' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.profile.settings, { fpsCap:240, renderMode:'default', msaaMode:'default' });
  const profiles = f.store.listProfiles();
  assert.ok(profiles.some(item => item.id === 'builtin:balanced'));
  assert.ok(profiles.some(item => item.name === 'Competitive'));
  fs.rmSync(f.dir, { recursive:true, force:true });
});

test('PerformanceProfileStore updates duplicate custom names instead of duplicating them', () => {
  const f = fixture();
  f.store.saveCustomProfile('165 Hz', { fpsCap:120, renderMode:'default', msaaMode:'2' });
  const updated = f.store.saveCustomProfile('165 hz', { fpsCap:180, renderMode:'d3d11', msaaMode:'1' });
  assert.equal(updated.updated, true);
  const custom = f.store.listProfiles().filter(item => !item.builtin);
  assert.equal(custom.length, 1);
  assert.equal(custom[0].settings.fpsCap, 180);
  fs.rmSync(f.dir, { recursive:true, force:true });
});

test('PerformanceProfileStore persists and resolves per-experience mappings', () => {
  const f = fixture();
  const saved = f.store.saveCustomProfile('Rivals', { fpsCap:180, renderMode:'d3d11', msaaMode:'1' });
  assert.equal(f.store.assignExperience('123456', saved.profile.id).ok, true);
  const resolved = f.store.resolveForExperience('123456', { fpsCap:60, renderMode:'default', msaaMode:'1', launchProfile:'balanced' });
  assert.equal(resolved.source, 'experience');
  assert.equal(resolved.profile.name, 'Rivals');
  assert.equal(resolved.settings.fpsCap, 180);
  const reloaded = new PerformanceProfileStore(f.dir);
  assert.equal(reloaded.listExperienceProfiles()[0].profileName, 'Rivals');
  fs.rmSync(f.dir, { recursive:true, force:true });
});

test('PerformanceProfileStore deleting a custom profile removes its experience mappings', () => {
  const f = fixture();
  const saved = f.store.saveCustomProfile('Temporary', { fpsCap:120 });
  f.store.assignExperience('1818', saved.profile.id);
  assert.equal(f.store.deleteCustomProfile(saved.profile.id).ok, true);
  assert.deepEqual(f.store.listExperienceProfiles(), []);
  assert.equal(f.store.deleteCustomProfile('builtin:performance').code, 'BUILTIN_PROFILE');
  fs.rmSync(f.dir, { recursive:true, force:true });
});

test('PerformanceProfileStore rejects invalid Place IDs and falls back to global settings', () => {
  const f = fixture();
  assert.equal(f.store.assignExperience('../bad', 'builtin:balanced').code, 'INVALID_PLACE_ID');
  const resolved = f.store.resolveForExperience(null, { fpsCap:144, renderMode:'vulkan', msaaMode:'2', launchProfile:'custom' });
  assert.equal(resolved.source, 'global');
  assert.deepEqual(resolved.settings, { fpsCap:144, renderMode:'vulkan', msaaMode:'2' });
  fs.rmSync(f.dir, { recursive:true, force:true });
});
