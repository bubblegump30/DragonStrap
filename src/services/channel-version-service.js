
'use strict';

const DEFAULT_CHANNEL = 'production';
const CHANNEL_RE = /^[A-Za-z0-9_-]{1,64}$/;
const BINARY_TYPES = Object.freeze({ player:'WindowsPlayer', studio:'WindowsStudio64' });
const PRIMARY_BASE = 'https://clientsettingscdn.roblox.com';
const FALLBACK_BASE = 'https://clientsettings.roblox.com';
const SETUP_BASE = 'https://setup.rbxcdn.com';

function normalizeChannel(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return DEFAULT_CHANNEL;
  const lower = raw.toLowerCase();
  if (lower === 'live' || lower === 'zlive' || lower === 'production') return DEFAULT_CHANNEL;
  return raw;
}

function displayChannel(value) {
  const channel = normalizeChannel(value);
  return channel.toLowerCase() === DEFAULT_CHANNEL ? 'LIVE' : channel;
}

function validateChannel(value) {
  const channel = normalizeChannel(value);
  if (!CHANNEL_RE.test(channel)) {
    return { ok:false, code:'INVALID_CHANNEL_NAME', message:'Channel names may contain only letters, numbers, hyphens, and underscores.', channel };
  }
  return { ok:true, channel, displayChannel:displayChannel(channel) };
}

function compareVersions(a, b) {
  const left = String(a || '').split('.').map(part => Number(part));
  const right = String(b || '').split('.').map(part => Number(part));
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const x = Number.isFinite(left[i]) ? left[i] : 0;
    const y = Number.isFinite(right[i]) ? right[i] : 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

function normalizeGuid(value) {
  const text = String(value || '').trim();
  return /^version-[A-Za-z0-9]+$/.test(text) ? text : '';
}

class ChannelVersionService {
  constructor({ fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
    if (typeof fetchImpl !== 'function') throw new TypeError('ChannelVersionService requires fetch.');
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  normalizeChannel(value) { return normalizeChannel(value); }
  displayChannel(value) { return displayChannel(value); }
  validateChannel(value) { return validateChannel(value); }

  async #fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetch(url, { ...options, signal:controller.signal, headers:{ Accept:'application/json', ...(options.headers || {}) } });
    } finally {
      clearTimeout(timer);
    }
  }

  #path(binaryType, channel) {
    const base = `/v2/client-version/${encodeURIComponent(binaryType)}`;
    return normalizeChannel(channel).toLowerCase() === DEFAULT_CHANNEL
      ? base
      : `${base}/channel/${encodeURIComponent(normalizeChannel(channel))}`;
  }

  async #requestVersion(binaryType, channel) {
    const path = this.#path(binaryType, channel);
    let lastError = null;
    for (const base of [PRIMARY_BASE, FALLBACK_BASE]) {
      const url = `${base}${path}`;
      try {
        const response = await this.#fetchWithTimeout(url, { method:'GET' });
        if (!response.ok) {
          if ([401,403].includes(response.status)) {
            return { ok:false, code:'CHANNEL_RESTRICTED', status:response.status, endpoint:url, message:'This Roblox channel is restricted or requires authorization.' };
          }
          if (response.status === 404) {
            return { ok:false, code:'CHANNEL_NOT_FOUND', status:404, endpoint:url, message:'No Roblox deployment exists for this channel and binary type.' };
          }
          lastError = new Error(`HTTP ${response.status}`);
          continue;
        }
        const data = await response.json();
        const versionGuid = normalizeGuid(data?.clientVersionUpload);
        if (!versionGuid || typeof data?.version !== 'string') {
          lastError = new Error('Roblox returned incomplete version metadata.');
          continue;
        }
        return {
          ok:true,
          endpoint:url,
          version:data.version,
          versionGuid,
          bootstrapperVersion:typeof data.bootstrapperVersion === 'string' ? data.bootstrapperVersion : ''
        };
      } catch (error) {
        lastError = error;
      }
    }
    return { ok:false, code:'VERSION_LOOKUP_FAILED', message:lastError?.name === 'AbortError' ? 'Roblox version lookup timed out.' : (lastError?.message || 'Roblox version lookup failed.') };
  }

  async #fetchTimestamp(versionGuid, channel) {
    if (!versionGuid) return null;
    const selected = normalizeChannel(channel);
    const resource = selected.toLowerCase() === DEFAULT_CHANNEL
      ? `/${versionGuid}-rbxPkgManifest.txt`
      : `/channel/common/${versionGuid}-rbxPkgManifest.txt`;
    try {
      const response = await this.#fetchWithTimeout(`${SETUP_BASE}${resource}`, { method:'HEAD', headers:{ Accept:'*/*' } });
      if (!response.ok) return null;
      const raw = response.headers?.get?.('last-modified');
      if (!raw) return null;
      const date = new Date(raw);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    } catch {
      return null;
    }
  }

  async fetchBinary(binaryType, channel, { includeTimestamp = true } = {}) {
    const validation = validateChannel(channel);
    if (!validation.ok) return validation;
    const result = await this.#requestVersion(binaryType, validation.channel);
    if (!result.ok) return { ...result, binaryType, channel:validation.channel, displayChannel:validation.displayChannel };
    const timestamp = includeTimestamp ? await this.#fetchTimestamp(result.versionGuid, validation.channel) : null;
    return { ...result, binaryType, channel:validation.channel, displayChannel:validation.displayChannel, timestamp };
  }

  #productState(remote, installedGuid, production) {
    const installed = normalizeGuid(installedGuid);
    if (!remote?.ok) {
      return { ...remote, installedGuid:installed || null, installed:Boolean(installed), current:false, updateAvailable:false, behindProduction:false };
    }
    const current = Boolean(installed) && installed.toLowerCase() === remote.versionGuid.toLowerCase();
    const behindProduction = Boolean(production?.ok) && compareVersions(remote.version, production.version) < 0;
    return {
      ...remote,
      installedGuid:installed || null,
      installed:Boolean(installed),
      current,
      updateAvailable:Boolean(installed) && !current,
      behindProduction,
      state:!installed ? 'not-installed' : (current ? 'current' : 'different-build')
    };
  }

  async getState(status, channel) {
    const validation = validateChannel(channel);
    if (!validation.ok) return { ...validation, checkedAt:new Date().toISOString() };
    const selected = validation.channel;
    const isProduction = selected.toLowerCase() === DEFAULT_CHANNEL;

    const [playerRemote, studioRemote] = await Promise.all([
      this.fetchBinary(BINARY_TYPES.player, selected),
      this.fetchBinary(BINARY_TYPES.studio, selected)
    ]);

    let productionPlayer = playerRemote;
    let productionStudio = studioRemote;
    if (!isProduction) {
      [productionPlayer, productionStudio] = await Promise.all([
        this.fetchBinary(BINARY_TYPES.player, DEFAULT_CHANNEL, { includeTimestamp:false }),
        this.fetchBinary(BINARY_TYPES.studio, DEFAULT_CHANNEL, { includeTimestamp:false })
      ]);
    }

    const player = this.#productState(playerRemote, status?.version, productionPlayer);
    const studio = this.#productState(studioRemote, status?.studioVersion, productionStudio);
    return {
      ok:Boolean(playerRemote.ok || studioRemote.ok),
      channel:selected,
      displayChannel:validation.displayChannel,
      isProduction,
      checkedAt:new Date().toISOString(),
      player,
      studio,
      production:{
        player:productionPlayer?.ok ? { version:productionPlayer.version, versionGuid:productionPlayer.versionGuid } : null,
        studio:productionStudio?.ok ? { version:productionStudio.version, versionGuid:productionStudio.versionGuid } : null
      }
    };
  }
}

module.exports = {
  ChannelVersionService,
  DEFAULT_CHANNEL,
  BINARY_TYPES,
  normalizeChannel,
  displayChannel,
  validateChannel,
  compareVersions
};
