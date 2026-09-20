'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ServerIntelligenceStore } = require('../src/services/server-intelligence-store');

function fixture(now = Date.parse('2026-09-20T12:00:00Z')) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dragonstrap-server-store-'));
  return { dir, store:new ServerIntelligenceStore(dir, { now:() => now }) };
}

const sample = { id:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', region:'Toronto, Ontario, Canada', city:'Toronto', regionName:'Ontario', country:'Canada', datacenterId:42, ping:55, playing:10, maxPlayers:20 };

test('ServerIntelligenceStore persists favorite server shortcuts', () => {
  const f = fixture();
  const added = f.store.toggleFavorite('1818', sample);
  assert.equal(added.ok, true);
  assert.equal(added.favorite, true);
  assert.equal(f.store.isFavorite('1818', sample.id), true);
  const reloaded = new ServerIntelligenceStore(f.dir);
  assert.equal(reloaded.getFavorites('1818').length, 1);
  const removed = reloaded.toggleFavorite('1818', sample);
  assert.equal(removed.favorite, false);
  fs.rmSync(f.dir, { recursive:true, force:true });
});

test('ServerIntelligenceStore keeps deduplicated recent joins with newest first', () => {
  const f = fixture();
  f.store.addRecentJoin('1818', sample);
  f.store.addRecentJoin('1818', { ...sample, ping:48 });
  const recent = f.store.getRecent();
  assert.equal(recent.length, 1);
  assert.equal(recent[0].ping, 48);
  assert.equal(recent[0].placeId, '1818');
  fs.rmSync(f.dir, { recursive:true, force:true });
});

test('ServerIntelligenceStore summarizes latency history and trend', () => {
  let now = Date.parse('2026-09-20T12:00:00Z');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dragonstrap-server-latency-'));
  const store = new ServerIntelligenceStore(dir, { now:() => now });
  for (const ping of [120, 115, 90, 80]) {
    store.addLatencySamples('1818', [{ ...sample, ping }]);
    now += 1000;
  }
  const summary = store.getLatencySummary('1818', sample.id);
  assert.equal(summary.samples, 4);
  assert.equal(summary.average, 101);
  assert.equal(summary.min, 80);
  assert.equal(summary.max, 120);
  assert.equal(summary.trend, 'improving');
  fs.rmSync(dir, { recursive:true, force:true });
});

test('ServerIntelligenceStore tracks provider failures and recovery', () => {
  const f = fixture();
  f.store.recordProviderHealth('rovalraDetails', { ok:false, label:'RoValra Details', durationMs:800, message:'timeout' });
  f.store.recordProviderHealth('rovalraDetails', { ok:false, label:'RoValra Details', durationMs:810, message:'timeout' });
  assert.equal(f.store.getProviderHealth().rovalraDetails.consecutiveFailures, 2);
  f.store.recordProviderHealth('rovalraDetails', { ok:true, label:'RoValra Details', durationMs:120 });
  const health = f.store.getProviderHealth().rovalraDetails;
  assert.equal(health.ok, true);
  assert.equal(health.consecutiveFailures, 0);
  assert.equal(health.lastError, null);
  fs.rmSync(f.dir, { recursive:true, force:true });
});
