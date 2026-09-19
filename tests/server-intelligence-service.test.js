'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ServerIntelligenceService } = require('../src/services/server-intelligence-service');

function response(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return data; }
  };
}

test('ServerIntelligenceService normalizes Place IDs and Roblox game URLs', () => {
  const service = new ServerIntelligenceService({ fetchImpl: async () => response({}) });
  assert.deepEqual(service.normalizePlaceId('1818'), { ok:true, placeId:'1818' });
  assert.deepEqual(service.normalizePlaceId('https://www.roblox.com/games/1818/Classic-Crossroads'), { ok:true, placeId:'1818' });
  assert.deepEqual(service.normalizePlaceId('roblox://experiences/start?placeId=1818'), { ok:true, placeId:'1818' });
  assert.equal(service.normalizePlaceId('https://example.com/games/1818').ok, false);
});

test('ServerIntelligenceService merges Roblox server metrics with RoValra details', async () => {
  const calls = [];
  const now = Date.parse('2026-09-19T12:00:00Z');
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).includes('games.roblox.com')) {
      return response({ data:[
        { id:'server-a', playing:8, maxPlayers:20, ping:52, fps:59.9 },
        { id:'server-b', playing:20, maxPlayers:20, ping:140, fps:58.2 }
      ]});
    }
    if (String(url).includes('/v1/servers/details')) {
      return response({ status:'success', servers:[
        { server_id:'server-a', first_seen:'2026-09-19T10:00:00', place_version:321, city:'Toronto', region:'Ontario', country:'Canada', ip_address:'203.0.113.10', datacenter_id:42 },
        { server_id:'server-b', first_seen:'2026-09-19T11:30:00Z', place_version:321, city:'Ashburn', region:'Virginia', country:'United States', ip_address:'203.0.113.11', datacenter_id:55 }
      ]});
    }
    if (String(url).includes('/v1/servers/counts')) {
      return response({ status:'success', counts:{ total_servers:120, regions:{ 'CA-ON':34, 'US-VA':86 }, newest_place_version:321, oldest_place_version:319 } });
    }
    return response({}, 404);
  };
  const service = new ServerIntelligenceService({ fetchImpl, now:() => now, version:'0.6.0' });
  const result = await service.lookup('1818');
  assert.equal(result.ok, true);
  assert.equal(result.providers.rovalra.ok, true);
  assert.equal(result.stats.totalServers, 120);
  assert.equal(result.stats.regionCount, 2);
  assert.equal(result.servers[0].region, 'Toronto, Ontario, Canada');
  assert.equal(result.servers[0].uptimeSeconds, 7200);
  assert.equal(result.servers[0].placeVersion, 321);
  assert.equal(result.privacy.sendsCookie, false);
  assert.ok(calls.some(url => url.includes('apis.rovalra.com/v1/servers/details')));
});

test('ServerIntelligenceService degrades to Roblox metrics when RoValra is unavailable', async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes('games.roblox.com')) {
      return response({ data:[{ id:'server-a', playing:4, maxPlayers:12, ping:70, fps:60 }] });
    }
    throw new Error('provider offline');
  };
  const service = new ServerIntelligenceService({ fetchImpl });
  const result = await service.lookup('1818');
  assert.equal(result.ok, true);
  assert.equal(result.providers.rovalra.ok, false);
  assert.equal(result.servers.length, 1);
  assert.equal(result.servers[0].playing, 4);
  assert.equal(result.servers[0].region, null);
});

test('ServerIntelligenceService uses its short cache unless force refresh is requested', async () => {
  let calls = 0;
  const fetchImpl = async (url) => {
    calls += 1;
    if (String(url).includes('games.roblox.com')) return response({ data:[] });
    if (String(url).includes('/v1/servers/details')) return response({ status:'success', servers:[] });
    return response({ status:'success', counts:{ total_servers:0, regions:{} } });
  };
  const service = new ServerIntelligenceService({ fetchImpl, now:() => 1000 });
  const first = await service.lookup('1818');
  const afterFirst = calls;
  const second = await service.lookup('1818');
  assert.equal(second.cached, true);
  assert.equal(calls, afterFirst);
  await service.lookup('1818', { force:true });
  assert.ok(calls > afterFirst);
  assert.equal(first.ok, true);
});
