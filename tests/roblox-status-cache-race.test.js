'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { RobloxStatusCache } = require('../src/core/roblox-status-cache');

test('a slow scan cannot overwrite a newer forced scan', async () => {
  const completions = [];
  const cache = new RobloxStatusCache({getStatus:() => new Promise(resolve => completions.push(resolve))});
  const old = cache.get();
  await Promise.resolve();
  const fresh = cache.get({fresh:true});
  await Promise.resolve();
  completions[1]({version:'new'});
  await fresh;
  completions[0]({version:'old'});
  await old;
  assert.equal((await cache.get()).version, 'new');
});

test('invalidating an in-flight scan starts a new scan and prevents stale caching', async () => {
  const completions = [];
  const cache = new RobloxStatusCache({getStatus:() => new Promise(resolve => completions.push(resolve))});
  const old = cache.get();
  await Promise.resolve();
  cache.invalidate();
  const fresh = cache.get();
  await Promise.resolve();
  assert.equal(completions.length, 2);
  completions[0]({version:'old'});
  await old;
  completions[1]({version:'new'});
  await fresh;
  assert.equal((await cache.get()).version, 'new');
});
