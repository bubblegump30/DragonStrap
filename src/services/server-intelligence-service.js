'use strict';

const ROVALRA_BASE = 'https://apis.rovalra.com';
const ROBLOX_GAMES_BASE = 'https://games.roblox.com';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_CACHE_MS = 20000;
const DETAILS_BATCH_SIZE = 35;
const MAX_SERVER_ID_LENGTH = 80;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clampNumber(value, min, max, fallback = null) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function cleanLocationPart(value) {
  const text = String(value ?? '').trim();
  return text && text.toLowerCase() !== 'unknown' ? text.slice(0, 100) : null;
}

function normalizeRegionDetails(item = {}) {
  const city = cleanLocationPart(item.city);
  const subdivision = cleanLocationPart(item.region);
  const country = cleanLocationPart(item.country);
  const locationParts = [city, subdivision && subdivision !== city ? subdivision : null, country].filter(Boolean);
  const region = [...new Set(locationParts)].join(', ') || null;
  const regionKey = [country, subdivision, city].filter(Boolean).join(' / ').toLowerCase() || null;
  const regionGroup = [country, subdivision].filter(Boolean).join(' • ') || country || subdivision || null;
  const quality = city && country ? 'metro' : (subdivision && country ? 'regional' : (country ? 'country' : 'unavailable'));
  return { city, regionName:subdivision, country, region, regionKey, regionGroup, locationQuality:quality };
}

class ServerIntelligenceService {
  constructor(options = {}) {
    this.fetch = options.fetchImpl || globalThis.fetch;
    this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    this.cacheMs = options.cacheMs || DEFAULT_CACHE_MS;
    this.now = options.now || (() => Date.now());
    this.clock = options.clock || (() => Date.now());
    this.version = options.version || '1.7.0';
    this.store = options.store || null;
    this.cache = new Map();
    if (typeof this.fetch !== 'function') throw new TypeError('A fetch implementation is required.');
  }

  normalizePlaceId(input) {
    const value = String(input ?? '').trim();
    if (!value) return { ok:false, code:'PLACE_REQUIRED', message:'Enter a Roblox Place ID or game URL.' };
    if (/^\d{1,20}$/.test(value)) return { ok:true, placeId:value };

    try {
      const parsed = new URL(value);
      const host = parsed.hostname.toLowerCase();
      if (parsed.protocol === 'roblox:' && parsed.hostname === 'experiences' && parsed.pathname === '/start') {
        const placeId = parsed.searchParams.get('placeId');
        if (placeId && /^\d{1,20}$/.test(placeId)) return { ok:true, placeId };
      }
      if ((host === 'roblox.com' || host.endsWith('.roblox.com')) && /^https?:$/.test(parsed.protocol)) {
        const match = parsed.pathname.match(/^\/games\/(\d{1,20})(?:\/|$)/i);
        if (match) return { ok:true, placeId:match[1] };
      }
    } catch (_) {}

    return { ok:false, code:'INVALID_PLACE', message:'Use a numeric Place ID or a roblox.com/games URL.' };
  }

  async lookup(input, options = {}) {
    const normalized = this.normalizePlaceId(input);
    if (!normalized.ok) return normalized;
    const { placeId } = normalized;
    const force = options.force === true;
    const cached = this.cache.get(placeId);
    if (!force && cached && this.now() - cached.cachedAt < this.cacheMs) {
      return { ...cached.result, cached:true, saved:this.#savedState(placeId) };
    }

    let robloxTimed;
    try {
      robloxTimed = await this.#timedJson(`${ROBLOX_GAMES_BASE}/v1/games/${placeId}/servers/Public?limit=100`, false);
      this.#recordHealth('roblox', { ok:true, label:'Roblox Public Servers', durationMs:robloxTimed.durationMs });
    } catch (error) {
      this.#recordHealth('roblox', { ok:false, label:'Roblox Public Servers', durationMs:error.durationMs, message:error.message });
      return {
        ok:false,
        code:'ROBLOX_SERVER_LIST_FAILED',
        placeId,
        message:`Roblox server list unavailable: ${error.message}`,
        providers:{ roblox:{ ok:false, label:'Roblox Public Servers', message:error.message }, rovalra:{ ok:null, label:'RoValra', message:'Not queried.' } },
        providerHealth:this.store?.getProviderHealth?.() || {}
      };
    }

    const baseServers = Array.isArray(robloxTimed.data?.data) ? robloxTimed.data.data : [];
    const safeServers = baseServers
      .filter(server => server && typeof server.id === 'string' && server.id.length > 0 && server.id.length <= MAX_SERVER_ID_LENGTH)
      .slice(0, 100)
      .map(server => {
        const playing = clampNumber(server.playing, 0, 100000, 0);
        const maxPlayers = clampNumber(server.maxPlayers, 0, 100000, 0);
        return {
          id:server.id,
          playing,
          maxPlayers,
          availableSlots:Math.max(0, maxPlayers - playing),
          occupancyPercent:maxPlayers > 0 ? Math.round((playing / maxPlayers) * 1000) / 10 : 0,
          occupancyBand:this.#occupancyBand(playing, maxPlayers),
          ping:clampNumber(server.ping, 0, 100000, null),
          fps:clampNumber(server.fps, 0, 1000, null),
          region:null, regionKey:null, regionGroup:null, locationQuality:'unavailable',
          city:null, regionName:null, country:null, datacenterId:null, ipAddress:null,
          placeVersion:null, uptimeSeconds:null, uptimeEstimate:true
        };
      });

    const serverIds = safeServers.map(server => server.id);
    let details = [];
    let counts = null;
    let detailsHealth = { ok:true, label:'RoValra Details', durationMs:0 };
    let countsHealth = { ok:true, label:'RoValra Counts', durationMs:0 };

    const detailPromise = this.#fetchRoValraDetails(placeId, serverIds)
      .then(result => { detailsHealth = { ok:true, label:'RoValra Details', durationMs:result.durationMs }; return result.items; })
      .catch(error => { detailsHealth = { ok:false, label:'RoValra Details', durationMs:error.durationMs, message:error.message }; return []; });
    const countsPromise = this.#fetchRoValraCounts(placeId)
      .then(result => { countsHealth = { ok:true, label:'RoValra Counts', durationMs:result.durationMs }; return result.data; })
      .catch(error => { countsHealth = { ok:false, label:'RoValra Counts', durationMs:error.durationMs, message:error.message }; return null; });
    [details, counts] = await Promise.all([detailPromise, countsPromise]);
    this.#recordHealth('rovalraDetails', detailsHealth);
    this.#recordHealth('rovalraCounts', countsHealth);

    const detailById = new Map(details.map(item => [item.serverId, item]));
    let servers = safeServers.map(server => ({ ...server, ...(detailById.get(server.id) || {}) }));
    this.store?.addLatencySamples?.(placeId, servers);
    servers = servers.map(server => ({
      ...server,
      latencyHistory:this.store?.getLatencySummary?.(placeId, server.id) || { samples:0, average:null, min:null, max:null, last:null, trend:'none' },
      favorite:Boolean(this.store?.isFavorite?.(placeId, server.id))
    }));

    const regionCounts = this.#normalizeRegionCounts(counts?.regions, servers);
    const totalServers = Number.isFinite(Number(counts?.total_servers)) ? Number(counts.total_servers) : servers.length;
    const pingValues = servers.map(server => Number(server.ping)).filter(Number.isFinite);
    const stats = {
      totalServers,
      loadedServers:servers.length,
      regionCount:Object.keys(regionCounts).length,
      regions:regionCounts,
      newestPlaceVersion:counts?.newest_place_version ?? null,
      oldestPlaceVersion:counts?.oldest_place_version ?? null,
      averagePing:pingValues.length ? Math.round(pingValues.reduce((a,b)=>a+b,0) / pingValues.length) : null,
      openSlots:servers.reduce((sum, server) => sum + Number(server.availableSlots || 0), 0)
    };

    const rovalraOnline = detailsHealth.ok && countsHealth.ok;
    const rovalraPartial = detailsHealth.ok || countsHealth.ok;
    const result = {
      ok:true,
      placeId,
      fetchedAt:new Date(this.now()).toISOString(),
      cached:false,
      providers:{
        roblox:{ ok:true, label:'Roblox Public Servers', durationMs:robloxTimed.durationMs },
        rovalra:{ ok:rovalraOnline, partial:!rovalraOnline && rovalraPartial, label:'RoValra', message:rovalraOnline ? null : (detailsHealth.message || countsHealth.message || 'Partial provider response.'), details:detailsHealth, counts:countsHealth }
      },
      providerHealth:this.store?.getProviderHealth?.() || {},
      privacy:{ sentToRoValra:true, sentPlaceId:true, sentServerIds:serverIds.length, sendsCookie:false },
      stats,
      servers,
      saved:this.#savedState(placeId)
    };
    this.cache.set(placeId, { cachedAt:this.now(), result });
    return result;
  }

  clearCache(placeId = null) { if (placeId) this.cache.delete(String(placeId)); else this.cache.clear(); }

  getSavedState(placeId = null) { return this.#savedState(placeId); }

  toggleFavorite(placeId, server) {
    const result = this.store?.toggleFavorite?.(placeId, server) || { ok:false, code:'STORE_UNAVAILABLE', message:'Server favorites are unavailable.' };
    this.clearCache(placeId);
    return result;
  }

  recordJoin(placeId, server) { return this.store?.addRecentJoin?.(placeId, server) || { ok:false, code:'STORE_UNAVAILABLE', message:'Recent server history is unavailable.' }; }
  clearRecent() { return this.store?.clearRecent?.() || []; }

  #savedState(placeId) {
    return this.store?.getState?.(placeId) || { favorites:[], recent:[], providerHealth:{} };
  }

  #occupancyBand(playing, maxPlayers) {
    if (!maxPlayers || playing <= 0) return 'empty';
    const ratio = playing / maxPlayers;
    if (ratio >= 1) return 'full';
    if (ratio >= 0.85) return 'almost-full';
    if (ratio >= 0.6) return 'busy';
    if (ratio >= 0.25) return 'medium';
    return 'low';
  }

  async #fetchRoValraDetails(placeId, serverIds) {
    if (!serverIds.length) return { items:[], durationMs:0 };
    const output = [];
    let durationMs = 0;
    for (let i = 0; i < serverIds.length; i += DETAILS_BATCH_SIZE) {
      const batch = serverIds.slice(i, i + DETAILS_BATCH_SIZE);
      const query = new URLSearchParams({ place_id:placeId, server_ids:batch.join(',') });
      let timed;
      try {
        timed = await this.#timedJson(`${ROVALRA_BASE}/v1/servers/details?${query.toString()}`, true);
      } catch (error) {
        error.durationMs = durationMs + Number(error.durationMs || 0);
        throw error;
      }
      durationMs += timed.durationMs;
      const data = timed.data;
      if (data?.status !== 'success' || !Array.isArray(data.servers)) throw Object.assign(new Error('RoValra returned invalid server-detail data.'), { durationMs });
      for (const item of data.servers) {
        if (!isPlainObject(item) || typeof item.server_id !== 'string') continue;
        const firstSeen = this.#parseFirstSeen(item.first_seen);
        output.push({
          serverId:item.server_id,
          ...normalizeRegionDetails(item),
          datacenterId:item.datacenter_id ?? null,
          ipAddress:item.ip_address || null,
          placeVersion:item.place_version ?? null,
          uptimeSeconds:firstSeen === null ? null : Math.max(0, Math.floor((this.now() - firstSeen) / 1000)),
          uptimeEstimate:true
        });
      }
    }
    return { items:output, durationMs };
  }

  async #fetchRoValraCounts(placeId) {
    const query = new URLSearchParams({ place_id:placeId });
    const timed = await this.#timedJson(`${ROVALRA_BASE}/v1/servers/counts?${query.toString()}`, true);
    if (timed.data?.status !== 'success' || !isPlainObject(timed.data.counts)) throw Object.assign(new Error('RoValra returned invalid server-count data.'), { durationMs:timed.durationMs });
    return { data:timed.data.counts, durationMs:timed.durationMs };
  }

  #parseFirstSeen(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    const normalized = /[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`;
    const time = Date.parse(normalized);
    return Number.isFinite(time) ? time : null;
  }

  #normalizeRegionCounts(regions, servers) {
    if (isPlainObject(regions)) {
      const output = {};
      for (const [key, value] of Object.entries(regions)) {
        const count = Number(value);
        if (key && Number.isFinite(count) && count >= 0) output[key] = count;
      }
      if (Object.keys(output).length) return output;
    }
    const output = {};
    for (const server of servers) {
      const key = server.regionGroup || server.region;
      if (!key) continue;
      output[key] = (output[key] || 0) + 1;
    }
    return output;
  }

  #recordHealth(name, result) {
    try { this.store?.recordProviderHealth?.(name, result); } catch (_) {}
  }

  async #timedJson(url, rovalra) {
    const started = this.clock();
    try {
      const data = await this.#fetchJson(url, rovalra);
      return { data, durationMs:Math.max(0, this.clock() - started) };
    } catch (error) {
      error.durationMs = Math.max(0, this.clock() - started);
      throw error;
    }
  }

  async #fetchJson(url, rovalra) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers = { Accept:'application/json' };
      if (rovalra) headers['x-rovalra-user-agent'] = `DragonStrap/Windows/${this.version}`;
      const response = await this.fetch(url, { method:'GET', headers, signal:controller.signal, cache:'no-store' });
      if (!response || !response.ok) throw new Error(`HTTP ${response?.status ?? 'error'}`);
      return await response.json();
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('request timed out');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = { ServerIntelligenceService, normalizeRegionDetails };
