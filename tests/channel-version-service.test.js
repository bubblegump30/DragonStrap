
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ChannelVersionService, normalizeChannel, displayChannel, compareVersions } = require('../src/services/channel-version-service');

function response(status, data, headers = {}) {
  return {
    ok:status >= 200 && status < 300,
    status,
    json:async () => data,
    headers:{ get:name => headers[String(name).toLowerCase()] || null }
  };
}

function createFetch(routes) {
  return async (url, options = {}) => {
    const key = `${options.method || 'GET'} ${url}`;
    if (!(key in routes)) throw new Error(`Unexpected request: ${key}`);
    return routes[key];
  };
}

test('Channel aliases normalize to production and display as LIVE', () => {
  assert.equal(normalizeChannel('LIVE'), 'production');
  assert.equal(normalizeChannel('zlive'), 'production');
  assert.equal(displayChannel('production'), 'LIVE');
  assert.equal(normalizeChannel('ZCanary'), 'ZCanary');
});

test('compareVersions compares Roblox dotted versions numerically', () => {
  assert.equal(compareVersions('0.739.0.7390687', '0.738.0.7381397'), 1);
  assert.equal(compareVersions('0.739.0.7390687', '0.739.0.7390687'), 0);
  assert.equal(compareVersions('0.738.0.7381397', '0.739.0.7390687'), -1);
});

test('ChannelVersionService reports current installed production builds', async () => {
  const playerUrl='https://clientsettingscdn.roblox.com/v2/client-version/WindowsPlayer';
  const studioUrl='https://clientsettingscdn.roblox.com/v2/client-version/WindowsStudio64';
  const playerGuid='version-aaaaaaaaaaaaaaaa';
  const studioGuid='version-bbbbbbbbbbbbbbbb';
  const fetchImpl=createFetch({
    [`GET ${playerUrl}`]:response(200,{version:'0.739.0.7390687',clientVersionUpload:playerGuid,bootstrapperVersion:'1'}),
    [`GET ${studioUrl}`]:response(200,{version:'0.739.0.7390687',clientVersionUpload:studioGuid,bootstrapperVersion:''}),
    [`HEAD https://setup.rbxcdn.com/${playerGuid}-rbxPkgManifest.txt`]:response(200,{}, {'last-modified':'Fri, 18 Sep 2026 12:00:00 GMT'}),
    [`HEAD https://setup.rbxcdn.com/${studioGuid}-rbxPkgManifest.txt`]:response(200,{}, {'last-modified':'Fri, 18 Sep 2026 12:00:00 GMT'})
  });
  const service=new ChannelVersionService({fetchImpl});
  const state=await service.getState({version:playerGuid,studioVersion:studioGuid},'LIVE');
  assert.equal(state.ok,true);
  assert.equal(state.displayChannel,'LIVE');
  assert.equal(state.player.current,true);
  assert.equal(state.studio.current,true);
  assert.equal(state.player.updateAvailable,false);
});

test('ChannelVersionService marks restricted channels without falling through', async () => {
  const url='https://clientsettingscdn.roblox.com/v2/client-version/WindowsPlayer/channel/Internal';
  const studio='https://clientsettingscdn.roblox.com/v2/client-version/WindowsStudio64/channel/Internal';
  const service=new ChannelVersionService({fetchImpl:createFetch({[`GET ${url}`]:response(401,{}),[`GET ${studio}`]:response(401,{})})});
  const state=await service.getState({version:'version-aaaaaaaaaaaaaaaa',studioVersion:'version-bbbbbbbbbbbbbbbb'},'Internal');
  assert.equal(state.ok,false);
  assert.equal(state.player.code,'CHANNEL_RESTRICTED');
  assert.equal(state.studio.code,'CHANNEL_RESTRICTED');
});
