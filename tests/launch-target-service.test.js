'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { LaunchTargetService } = require('../src/services/launch-target-service');

const service = new LaunchTargetService();

test('LaunchTargetService converts a Place ID to a Roblox experience deeplink', () => {
  const result = service.normalize('1818');
  assert.equal(result.ok, true);
  assert.equal(result.kind, 'experience');
  assert.equal(result.uri, 'roblox://experiences/start?placeId=1818');
});

test('LaunchTargetService extracts Place ID from a Roblox game URL', () => {
  const result = service.normalize('https://www.roblox.com/games/1818/Classic-Crossroads');
  assert.equal(result.ok, true);
  assert.equal(result.placeId, '1818');
});

test('LaunchTargetService adds a validated Game Instance ID', () => {
  const result = service.normalize('1818', '2ae1e20b-7905-400a-b009-16df59ff7cea');
  assert.equal(result.ok, true);
  assert.equal(result.kind, 'server');
  assert.match(result.uri, /gameInstanceId=2ae1e20b-7905-400a-b009-16df59ff7cea/);
});

test('LaunchTargetService rejects unrelated websites', () => {
  const result = service.normalize('https://example.com/games/1818');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'UNSUPPORTED_HOST');
});
