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

class ServerIntelligenceService {
  constructor(options = {}) {
    this.fetch = options.fetchImpl || globalThis.fetch;
    this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    this.cacheMs = options.cacheMs || DEFAULT_CACHE_MS;
    this.now = options.now || (() => Date.now());
    this.version = options.version || '0.6.0';
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
      return { ...cached.result, cached:true };
    }

    let robloxData;
    try {
      robloxData = await this.#fetchJson(`${ROBLOX_GAMES_BASE}/v1/games/${placeId}/servers/Public?limit=100`, false);
    } catch (error) {
      return { ok:false, code:'ROBLOX_SERVER_LIST_FAILED', placeId, message:`Roblox server list unavailable: ${error.message}` };
    }

    const baseServers = Array.isArray(robloxData?.data) ? robloxData.data : [];
    const safeServers = baseServers
      .filter(server => server && typeof server.id === 'string' && server.id.length > 0 && server.id.length <= MAX_SERVER_ID_LENGTH)
      .slice(0, 100)
      .map(server => ({
        id: server.id,
        playing: clampNumber(server.playing, 0, 100000, 0),
        maxPlayers: clampNumber(server.maxPlayers, 0, 100000, 0),
        ping: clampNumber(server.ping, 0, 100000, null),
        fps: clampNumber(server.fps, 0, 1000, null),
        region: null,
        city: null,
        regionName: null,
        country: null,
        datacenterId: null,
        ipAddress: null,
        placeVersion: null,
        uptimeSeconds: null,
        uptimeEstimate: true
      }));

    const serverIds = safeServers.map(server => server.id);
    let rovalraOnline = true;
    let rovalraMessage = null;
    let details = [];
    let counts = null;

    const detailPromise = this.#fetchRoValraDetails(placeId, serverIds).catch(error => {
      rovalraOnline = false;
      rovalraMessage = error.message;
      return [];
    });
    const countsPromise = this.#fetchRoValraCounts(placeId).catch(error => {
      rovalraOnline = false;
      rovalraMessage ||= error.message;
      return null;
    });
    [details, counts] = await Promise.all([detailPromise, countsPromise]);

    const detailById = new Map(details.map(item => [item.serverId, item]));
    const servers = safeServers.map(server => ({ ...server, ...(detailById.get(server.id) || {}) }));

    const regionCounts = this.#normalizeRegionCounts(counts?.regions, servers);
    const totalServers = Number.isFinite(Number(counts?.total_servers)) ? Number(counts.total_servers) : servers.length;
    const stats = {
      totalServers,
      loadedServers: servers.length,
      regionCount: Object.keys(regionCounts).length,
      regions: regionCounts,
      newestPlaceVersion: counts?.newest_place_version ?? null,
      oldestPlaceVersion: counts?.oldest_place_version ?? null
    };

    const result = {
      ok:true,
      placeId,
      fetchedAt:new Date(this.now()).toISOString(),
      cached:false,
      providers:{
        roblox:{ ok:true, label:'Roblox Public Servers' },
        rovalra:{ ok:rovalraOnline, label:'RoValra', message:rovalraMessage }
      },
      privacy:{ sentToRoValra:true, sentPlaceId:true, sentServerIds:serverIds.length, sendsCookie:false },
      stats,
      servers
    };
    this.cache.set(placeId, { cachedAt:this.now(), result });
    return result;
  }

  clearCache(placeId = null) {
    if (placeId) this.cache.delete(String(placeId));
    else this.cache.clear();
  }

  async #fetchRoValraDetails(placeId, serverIds) {
    if (!serverIds.length) return [];
    const output = [];
    for (let i = 0; i < serverIds.length; i += DETAILS_BATCH_SIZE) {
      const batch = serverIds.slice(i, i + DETAILS_BATCH_SIZE);
      const query = new URLSearchParams({ place_id:placeId, server_ids:batch.join(',') });
      const data = await this.#fetchJson(`${ROVALRA_BASE}/v1/servers/details?${query.toString()}`, true);
      if (data?.status !== 'success' || !Array.isArray(data.servers)) throw new Error('RoValra returned invalid server-detail data.');
      for (const item of data.servers) {
        if (!isPlainObject(item) || typeof item.server_id !== 'string') continue;
        const firstSeen = this.#parseFirstSeen(item.first_seen);
        const locationParts = [item.city, item.region && item.region !== item.city ? item.region : null, item.country]
          .filter(value => value && value !== 'Unknown');
        output.push({
          serverId:item.server_id,
          region:[...new Set(locationParts)].join(', ') || null,
          city:item.city || null,
          regionName:item.region || null,
          country:item.country || null,
          datacenterId:item.datacenter_id ?? null,
          ipAddress:item.ip_address || null,
          placeVersion:item.place_version ?? null,
          uptimeSeconds:firstSeen === null ? null : Math.max(0, Math.floor((this.now() - firstSeen) / 1000)),
          uptimeEstimate:true
        });
      }
    }
    return output;
  }

  async #fetchRoValraCounts(placeId) {
    const query = new URLSearchParams({ place_id:placeId });
    const data = await this.#fetchJson(`${ROVALRA_BASE}/v1/servers/counts?${query.toString()}`, true);
    if (data?.status !== 'success' || !isPlainObject(data.counts)) throw new Error('RoValra returned invalid server-count data.');
    return data.counts;
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
      if (!server.region) continue;
      output[server.region] = (output[server.region] || 0) + 1;
    }
    return output;
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

module.exports = { ServerIntelligenceService };
