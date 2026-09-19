'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { LaunchService } = require('../src/services/launch-service');

test('LaunchService rejects launch when Roblox is not detected', () => {
  const service = new LaunchService(() => { throw new Error('must not execute'); });
  const result = service.launchPlayer({ playerPath: null });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ROBLOX_NOT_FOUND');
});

test('LaunchService uses --app for a normal Roblox app launch', () => {
  let call;
  const service = new LaunchService((exe, args, options) => { call = { exe, args, options }; return { pid: 42, unref() {} }; });
  const result = service.launchPlayer({ playerPath: 'C:\\Roblox\\RobloxPlayerBeta.exe' });
  assert.equal(result.ok, true);
  assert.deepEqual(call.args, ['--app']);
});

test('LaunchService accepts only normalized experience deep links', () => {
  let call;
  const service = new LaunchService((exe, args, options) => { call = { exe, args, options }; return { pid: 42, unref() {} }; });
  const bad = service.launchPlayer({ playerPath: 'C:\\Roblox\\RobloxPlayerBeta.exe' }, { uri: 'https://example.com' });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, 'INVALID_LAUNCH_URI');
  const good = service.launchPlayer({ playerPath: 'C:\\Roblox\\RobloxPlayerBeta.exe' }, { uri: 'roblox://experiences/start?placeId=1818' });
  assert.equal(good.ok, true);
  assert.deepEqual(call.args, ['roblox://experiences/start?placeId=1818']);
});


test('LaunchService passes a validated Studio project path as the only Studio argument', () => {
  const calls = [];
  const service = new LaunchService((exe, args, opts) => { calls.push({exe,args,opts}); return { pid:321, unref(){} }; });
  const project = process.platform === 'win32' ? 'C:\\Projects\\Game.rbxlx' : '/tmp/Game.rbxlx';
  const result = service.launchStudio({ studioPath:'C:\\Roblox\\RobloxStudioBeta.exe' }, { projectPath:project });
  assert.equal(result.ok, true);
  assert.deepEqual(calls[0].args, [project]);
});

test('LaunchService rejects unsupported Studio project paths', () => {
  const service = new LaunchService(() => { throw new Error('should not spawn'); });
  const result = service.launchStudio({ studioPath:'C:\\Roblox\\RobloxStudioBeta.exe' }, { projectPath:'relative.txt' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_STUDIO_PROJECT');
});
