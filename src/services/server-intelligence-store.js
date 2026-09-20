'use strict';

const fs = require('fs');
const path = require('path');

const MAX_FAVORITES = 80;
const MAX_RECENT = 24;
const MAX_LATENCY_KEYS = 160;
const MAX_LATENCY_SAMPLES = 24;
const LATENCY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SERVER_ID_LENGTH = 80;

function safePlaceId(value) {
  const text = String(value ?? '').trim();
  return /^\d{1,20}$/.test(text) ? text : null;
}

function safeServerId(value) {
  const text = String(value ?? '').trim();
  return text && text.length <= MAX_SERVER_ID_LENGTH && /^[A-Za-z0-9_-]+$/.test(text) ? text : null;
}

function safeText(value, max = 180) {
  return value == null ? null : String(value).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max);
}

function normalizeServerSnapshot(placeId, server = {}) {
  const safePlace = safePlaceId(placeId);
  const id = safeServerId(server.id || server.serverId);
  if (!safePlace || !id) return null;
  return {
    placeId:safePlace,
    serverId:id,
    region:safeText(server.region, 180),
    city:safeText(server.city, 100),
    regionName:safeText(server.regionName, 100),
    country:safeText(server.country, 100),
    datacenterId:server.datacenterId == null ? null : safeText(server.datacenterId, 60),
    ping:Number.isFinite(Number(server.ping)) ? Math.max(0, Math.round(Number(server.ping))) : null,
    playing:Number.isFinite(Number(server.playing)) ? Math.max(0, Math.round(Number(server.playing))) : null,
    maxPlayers:Number.isFinite(Number(server.maxPlayers)) ? Math.max(0, Math.round(Number(server.maxPlayers))) : null
  };
}

class ServerIntelligenceStore {
  constructor(userDataDir, options = {}) {
    this.fs = options.fsImpl || fs;
    this.now = options.now || (() => Date.now());
    this.filePath = path.join(userDataDir, 'server-intelligence.json');
    this.data = { schemaVersion:2, favorites:[], recent:[], latency:{}, providerHealth:{} };
    this.#load();
  }

  #load() {
    try {
      if (!this.fs.existsSync(this.filePath)) return;
      const parsed = JSON.parse(this.fs.readFileSync(this.filePath, 'utf8'));
      if (!parsed || typeof parsed !== 'object') return;
      this.data = {
        schemaVersion:2,
        favorites:Array.isArray(parsed.favorites) ? parsed.favorites.slice(0, MAX_FAVORITES) : [],
        recent:Array.isArray(parsed.recent) ? parsed.recent.slice(0, MAX_RECENT) : [],
        latency:parsed.latency && typeof parsed.latency === 'object' && !Array.isArray(parsed.latency) ? parsed.latency : {},
        providerHealth:parsed.providerHealth && typeof parsed.providerHealth === 'object' && !Array.isArray(parsed.providerHealth) ? parsed.providerHealth : {}
      };
      this.#pruneLatency();
    } catch {
      this.data = { schemaVersion:2, favorites:[], recent:[], latency:{}, providerHealth:{} };
    }
  }

  #save() {
    this.fs.mkdirSync(path.dirname(this.filePath), { recursive:true });
    const temp = `${this.filePath}.tmp`;
    this.fs.writeFileSync(temp, `${JSON.stringify(this.data, null, 2)}\n`, 'utf8');
    this.fs.renameSync(temp, this.filePath);
  }

  #latencyKey(placeId, serverId) { return `${placeId}:${serverId}`; }

  #pruneLatency() {
    const cutoff = this.now() - LATENCY_RETENTION_MS;
    for (const [key, entry] of Object.entries(this.data.latency)) {
      if (!entry || !Array.isArray(entry.samples)) { delete this.data.latency[key]; continue; }
      entry.samples = entry.samples
        .filter(sample => Number(sample?.at) >= cutoff && Number.isFinite(Number(sample?.ping)))
        .slice(-MAX_LATENCY_SAMPLES);
      if (!entry.samples.length) delete this.data.latency[key];
    }
    const keys = Object.keys(this.data.latency);
    if (keys.length > MAX_LATENCY_KEYS) {
      keys.sort((a, b) => Number(this.data.latency[b]?.updatedAt || 0) - Number(this.data.latency[a]?.updatedAt || 0));
      for (const key of keys.slice(MAX_LATENCY_KEYS)) delete this.data.latency[key];
    }
  }

  addLatencySamples(placeId, servers = []) {
    const safePlace = safePlaceId(placeId);
    if (!safePlace || !Array.isArray(servers)) return;
    const at = this.now();
    let changed = false;
    for (const server of servers) {
      const id = safeServerId(server?.id);
      const ping = Number(server?.ping);
      if (!id || !Number.isFinite(ping) || ping < 0 || ping > 100000) continue;
      const key = this.#latencyKey(safePlace, id);
      const entry = this.data.latency[key] || { placeId:safePlace, serverId:id, region:null, updatedAt:0, samples:[] };
      entry.region = safeText(server.region, 180);
      entry.updatedAt = at;
      entry.samples.push({ at, ping:Math.round(ping) });
      entry.samples = entry.samples.slice(-MAX_LATENCY_SAMPLES);
      this.data.latency[key] = entry;
      changed = true;
    }
    if (changed) { this.#pruneLatency(); this.#save(); }
  }

  getLatencySummary(placeId, serverId) {
    const safePlace = safePlaceId(placeId);
    const id = safeServerId(serverId);
    if (!safePlace || !id) return { samples:0, average:null, min:null, max:null, last:null, trend:'none' };
    this.#pruneLatency();
    const samples = this.data.latency[this.#latencyKey(safePlace, id)]?.samples || [];
    if (!samples.length) return { samples:0, average:null, min:null, max:null, last:null, trend:'none' };
    const values = samples.map(sample => Number(sample.ping));
    const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    let trend = 'stable';
    if (values.length >= 4) {
      const half = Math.max(2, Math.floor(values.length / 2));
      const prior = values.slice(-half * 2, -half);
      const recent = values.slice(-half);
      const priorAvg = prior.reduce((a,b)=>a+b,0) / prior.length;
      const recentAvg = recent.reduce((a,b)=>a+b,0) / recent.length;
      if (recentAvg <= priorAvg - 8) trend = 'improving';
      else if (recentAvg >= priorAvg + 8) trend = 'worsening';
    }
    return { samples:values.length, average, min:Math.min(...values), max:Math.max(...values), last:values.at(-1), trend };
  }

  toggleFavorite(placeId, server) {
    const snapshot = normalizeServerSnapshot(placeId, server);
    if (!snapshot) return { ok:false, code:'INVALID_SERVER', message:'The server could not be saved.' };
    const index = this.data.favorites.findIndex(item => item.placeId === snapshot.placeId && item.serverId === snapshot.serverId);
    if (index >= 0) {
      this.data.favorites.splice(index, 1);
      this.#save();
      return { ok:true, favorite:false, item:snapshot, favorites:this.getFavorites(snapshot.placeId) };
    }
    const item = { ...snapshot, savedAt:new Date(this.now()).toISOString() };
    this.data.favorites = [item, ...this.data.favorites.filter(existing => !(existing.placeId === item.placeId && existing.serverId === item.serverId))].slice(0, MAX_FAVORITES);
    this.#save();
    return { ok:true, favorite:true, item:{...item}, favorites:this.getFavorites(snapshot.placeId) };
  }

  isFavorite(placeId, serverId) {
    const safePlace = safePlaceId(placeId);
    const id = safeServerId(serverId);
    return Boolean(safePlace && id && this.data.favorites.some(item => item.placeId === safePlace && item.serverId === id));
  }

  getFavorites(placeId = null) {
    const safePlace = placeId == null ? null : safePlaceId(placeId);
    return this.data.favorites.filter(item => !safePlace || item.placeId === safePlace).map(item => ({...item}));
  }

  addRecentJoin(placeId, server) {
    const snapshot = normalizeServerSnapshot(placeId, server);
    if (!snapshot) return { ok:false, code:'INVALID_SERVER', message:'The joined server could not be recorded.' };
    const item = { ...snapshot, joinedAt:new Date(this.now()).toISOString() };
    this.data.recent = [item, ...this.data.recent.filter(existing => !(existing.placeId === item.placeId && existing.serverId === item.serverId))].slice(0, MAX_RECENT);
    this.#save();
    return { ok:true, item:{...item}, recent:this.getRecent() };
  }

  getRecent(limit = MAX_RECENT) { return this.data.recent.slice(0, Math.max(1, Math.min(MAX_RECENT, Number(limit) || MAX_RECENT))).map(item => ({...item})); }
  clearRecent() { this.data.recent = []; this.#save(); return []; }

  recordProviderHealth(name, result = {}) {
    const key = String(name || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
    if (!key) return;
    const previous = this.data.providerHealth[key] || {};
    const ok = result.ok === true;
    const nowIso = new Date(this.now()).toISOString();
    this.data.providerHealth[key] = {
      ok,
      label:safeText(result.label || key, 80),
      lastCheckAt:nowIso,
      lastSuccessAt:ok ? nowIso : (previous.lastSuccessAt || null),
      lastFailureAt:ok ? (previous.lastFailureAt || null) : nowIso,
      consecutiveFailures:ok ? 0 : Number(previous.consecutiveFailures || 0) + 1,
      durationMs:Number.isFinite(Number(result.durationMs)) ? Math.max(0, Math.round(Number(result.durationMs))) : null,
      lastError:ok ? null : safeText(result.message || 'Provider request failed.', 240)
    };
    this.#save();
  }

  getProviderHealth() { return JSON.parse(JSON.stringify(this.data.providerHealth)); }

  getState(placeId = null) {
    return {
      favorites:this.getFavorites(placeId),
      recent:this.getRecent(),
      providerHealth:this.getProviderHealth()
    };
  }
}

module.exports = { ServerIntelligenceStore, normalizeServerSnapshot, safePlaceId, safeServerId };
