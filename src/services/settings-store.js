'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULTS = Object.freeze({
  launchProfile: 'performance',
  fpsCap: 240,
  renderMode: 'default',
  msaaMode: '1',
  performanceAutoApply: true,
  channel: 'production',
  autoRefresh: true,
  refreshSeconds: 60,
  minimizeOnLaunch: false,
  notifications: true,
  checkForUpdates: true,
  updateChannel: 'stable',
  lastLaunchTarget: '',
  theme: 'neo-purple'
});

const PROFILES = new Set(['default', 'balanced', 'performance', 'quality', 'studio', 'custom']);
const RENDER_MODES = new Set(['default', 'd3d11', 'vulkan']);
const MSAA_MODES = new Set(['default', '1', '2', '4']);
const REFRESH_INTERVALS = new Set([60, 120, 300, 600]);
const UPDATE_CHANNELS = new Set(['stable', 'prerelease']);

function sanitizeSetting(key, value) {
  switch (key) {
    case 'launchProfile': return PROFILES.has(value) ? value : undefined;
    case 'fpsCap': {
      const number = Number(value);
      if (!Number.isFinite(number)) return undefined;
      const rounded = Math.round(number);
      return rounded >= 0 && rounded <= 240 ? rounded : undefined;
    }
    case 'renderMode': return RENDER_MODES.has(value) ? value : undefined;
    case 'msaaMode': return MSAA_MODES.has(String(value)) ? String(value) : undefined;
    case 'performanceAutoApply':
    case 'autoRefresh':
    case 'minimizeOnLaunch':
    case 'notifications':
    case 'checkForUpdates': return typeof value === 'boolean' ? value : undefined;
    case 'updateChannel': return UPDATE_CHANNELS.has(value) ? value : undefined;
    case 'refreshSeconds': {
      const number = Number(value);
      return REFRESH_INTERVALS.has(number) ? number : undefined;
    }
    case 'lastLaunchTarget': return typeof value === 'string' ? value.slice(0, 2048) : undefined;
    case 'channel': {
      if (typeof value !== 'string') return undefined;
      const trimmed = value.trim();
      if (!trimmed) return 'production';
      const lower = trimmed.toLowerCase();
      if (lower === 'live' || lower === 'zlive' || lower === 'production') return 'production';
      return /^[A-Za-z0-9_-]{1,64}$/.test(trimmed) ? trimmed : undefined;
    }
    case 'theme': return value === 'neo-purple' ? value : undefined;
    default: return undefined;
  }
}

class SettingsStore {
  constructor(userDataDir) {
    this.filePath = path.join(userDataDir, 'settings.json');
    this.data = { ...DEFAULTS };
    this.#load();
  }

  #load() {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
      const loaded = { ...DEFAULTS };
      for (const key of Object.keys(DEFAULTS)) {
        if (!Object.hasOwn(raw, key)) continue;
        const sanitized = sanitizeSetting(key, raw[key]);
        if (sanitized !== undefined) loaded[key] = sanitized;
      }
      this.data = loaded;
    } catch {
      this.data = { ...DEFAULTS };
    }
  }

  #save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify(this.data, null, 2)}\n`, 'utf8');
    fs.renameSync(temp, this.filePath);
  }

  getAll() { return { ...this.data }; }

  update(patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new TypeError('Settings patch must be an object.');
    }
    for (const [key, value] of Object.entries(patch)) {
      const sanitized = sanitizeSetting(key, value);
      if (sanitized !== undefined) this.data[key] = sanitized;
    }
    this.#save();
    return this.getAll();
  }
}

module.exports = { SettingsStore, DEFAULTS, sanitizeSetting };
