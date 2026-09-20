'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalizeSettings: normalizePerformance } = require('./performance-profile-store');
const { sanitizeSetting } = require('./settings-store');
const { MANAGED_FLAGS } = require('./performance-service');
const PROTECTED_FLAGS = new Set(Object.values(MANAGED_FLAGS));

const PROFILE_SCHEMA = 'dragonstrap.configuration-profile.v1';
const STORE_SCHEMA_VERSION = 1;
const MAX_PROFILES = 50;
const MAX_FLAGS = 1000;
const MAX_FLAG_VALUE = 2048;
const FLAG_KEY = /^[A-Za-z][A-Za-z0-9_]{1,159}$/;
const SERVER_SORTS = new Set(['ping','history','players','space','occupancy','uptime','region']);
const SERVER_OCCUPANCY = new Set(['any','empty','low','medium','busy','almost-full','full']);

function cleanName(value) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ');
  return text && text.length <= 64 ? text : null;
}

function normalizeFlags(flags = {}) {
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) return {};
  const output = {};
  for (const [key, value] of Object.entries(flags)) {
    if (Object.keys(output).length >= MAX_FLAGS) break;
    if (!FLAG_KEY.test(key) || PROTECTED_FLAGS.has(key) || value === null || typeof value === 'object') continue;
    const text = String(value);
    if (text.length > MAX_FLAG_VALUE) continue;
    output[key] = text;
  }
  return output;
}

function normalizeConfiguration(input = {}) {
  const performanceInput = input.performance && typeof input.performance === 'object' ? input.performance : {};
  const normalizedPerformance = normalizePerformance(performanceInput);
  const launchProfile = sanitizeSetting('launchProfile', performanceInput.launchProfile) || 'custom';
  const performanceAutoApply = sanitizeSetting('performanceAutoApply', performanceInput.performanceAutoApply);
  const channel = sanitizeSetting('channel', input.channel) || 'production';
  const launchInput = input.launch && typeof input.launch === 'object' ? input.launch : {};
  const minimizeOnLaunch = sanitizeSetting('minimizeOnLaunch', launchInput.minimizeOnLaunch);
  const serverInput = input.servers && typeof input.servers === 'object' ? input.servers : {};
  return {
    performance: {
      ...normalizedPerformance,
      launchProfile,
      performanceAutoApply: performanceAutoApply === undefined ? true : performanceAutoApply
    },
    fastFlags: normalizeFlags(input.fastFlags),
    channel,
    launch: {
      minimizeOnLaunch: minimizeOnLaunch === undefined ? false : minimizeOnLaunch
    },
    servers: {
      sort: SERVER_SORTS.has(serverInput.sort) ? serverInput.sort : 'ping',
      occupancy: SERVER_OCCUPANCY.has(serverInput.occupancy) ? serverInput.occupancy : 'any',
      favoritesOnly: serverInput.favoritesOnly === true,
      hideFull: serverInput.hideFull === true
    }
  };
}

class ConfigurationProfileStore {
  constructor(userDataDir, options = {}) {
    this.fs = options.fsImpl || fs;
    this.now = options.now || (() => Date.now());
    this.filePath = path.join(userDataDir, 'configuration-profiles.json');
    this.data = { schemaVersion:STORE_SCHEMA_VERSION, activeProfileId:null, profiles:[] };
    this.#load();
  }

  #load() {
    try {
      if (!this.fs.existsSync(this.filePath)) return;
      const parsed = JSON.parse(this.fs.readFileSync(this.filePath, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      const profiles = Array.isArray(parsed.profiles)
        ? parsed.profiles.map(item => this.#sanitizeStored(item)).filter(Boolean).slice(0, MAX_PROFILES)
        : [];
      const active = typeof parsed.activeProfileId === 'string' && profiles.some(p => p.id === parsed.activeProfileId)
        ? parsed.activeProfileId : null;
      this.data = { schemaVersion:STORE_SCHEMA_VERSION, activeProfileId:active, profiles };
    } catch {
      this.data = { schemaVersion:STORE_SCHEMA_VERSION, activeProfileId:null, profiles:[] };
    }
  }

  #sanitizeStored(item) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const id = typeof item.id === 'string' && /^profile:[A-Za-z0-9-]{8,64}$/.test(item.id) ? item.id : null;
    const name = cleanName(item.name);
    if (!id || !name) return null;
    return {
      id,
      name,
      configuration:normalizeConfiguration(item.configuration),
      createdAt:Number.isSafeInteger(item.createdAt) && item.createdAt > 0 ? item.createdAt : this.now(),
      updatedAt:Number.isSafeInteger(item.updatedAt) && item.updatedAt > 0 ? item.updatedAt : this.now()
    };
  }

  #save() {
    this.fs.mkdirSync(path.dirname(this.filePath), { recursive:true });
    const temp = `${this.filePath}.tmp`;
    this.fs.writeFileSync(temp, `${JSON.stringify(this.data, null, 2)}\n`, 'utf8');
    this.fs.renameSync(temp, this.filePath);
  }

  list() { return this.data.profiles.map(item => JSON.parse(JSON.stringify(item))); }
  get(id) { const item = this.data.profiles.find(p => p.id === String(id || '')); return item ? JSON.parse(JSON.stringify(item)) : null; }
  getActiveId() { return this.data.activeProfileId; }
  setActive(id) {
    const value = id == null ? null : String(id);
    if (value && !this.data.profiles.some(p => p.id === value)) return false;
    this.data.activeProfileId = value;
    this.#save();
    return true;
  }

  saveProfile(name, configuration) {
    const clean = cleanName(name);
    if (!clean) return { ok:false, code:'INVALID_PROFILE_NAME', message:'Profile names must contain 1–64 printable characters.' };
    const existing = this.data.profiles.find(item => item.name.toLowerCase() === clean.toLowerCase());
    const now = this.now();
    if (existing) {
      existing.configuration = normalizeConfiguration(configuration);
      existing.updatedAt = now;
      this.#save();
      return { ok:true, updated:true, profile:this.get(existing.id) };
    }
    if (this.data.profiles.length >= MAX_PROFILES) return { ok:false, code:'PROFILE_LIMIT', message:`DragonStrap supports up to ${MAX_PROFILES} configuration profiles.` };
    const profile = { id:`profile:${crypto.randomUUID()}`, name:clean, configuration:normalizeConfiguration(configuration), createdAt:now, updatedAt:now };
    this.data.profiles.push(profile);
    this.#save();
    return { ok:true, updated:false, profile:this.get(profile.id) };
  }

  cloneProfile(id, name) {
    const source = this.get(id);
    if (!source) return { ok:false, code:'PROFILE_NOT_FOUND', message:'The selected configuration profile no longer exists.' };
    const clean = cleanName(name || `${source.name} Copy`);
    if (!clean) return { ok:false, code:'INVALID_PROFILE_NAME', message:'Clone names must contain 1–64 printable characters.' };
    if (this.data.profiles.some(item => item.name.toLowerCase() === clean.toLowerCase())) return { ok:false, code:'DUPLICATE_PROFILE_NAME', message:'A configuration profile with that name already exists.' };
    if (this.data.profiles.length >= MAX_PROFILES) return { ok:false, code:'PROFILE_LIMIT', message:`DragonStrap supports up to ${MAX_PROFILES} configuration profiles.` };
    const now = this.now();
    const profile = { id:`profile:${crypto.randomUUID()}`, name:clean, configuration:normalizeConfiguration(source.configuration), createdAt:now, updatedAt:now };
    this.data.profiles.push(profile);
    this.#save();
    return { ok:true, profile:this.get(profile.id) };
  }

  deleteProfile(id) {
    const value = String(id || '');
    const index = this.data.profiles.findIndex(item => item.id === value);
    if (index < 0) return { ok:false, code:'PROFILE_NOT_FOUND', message:'The selected configuration profile no longer exists.' };
    const [removed] = this.data.profiles.splice(index, 1);
    if (this.data.activeProfileId === value) this.data.activeProfileId = null;
    this.#save();
    return { ok:true, removed:{ id:removed.id, name:removed.name } };
  }

  exportDocument(id) {
    const profile = this.get(id);
    if (!profile) return { ok:false, code:'PROFILE_NOT_FOUND', message:'The selected configuration profile no longer exists.' };
    return {
      ok:true,
      document:{
        schema:PROFILE_SCHEMA,
        exportedAt:new Date(this.now()).toISOString(),
        profile:{ name:profile.name, configuration:normalizeConfiguration(profile.configuration) }
      }
    };
  }

  importDocument(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || input.schema !== PROFILE_SCHEMA) {
      return { ok:false, code:'INVALID_PROFILE_FILE', message:`Profile files must use schema ${PROFILE_SCHEMA}.` };
    }
    const profile = input.profile;
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return { ok:false, code:'INVALID_PROFILE_FILE', message:'The profile document does not contain a profile object.' };
    const name = cleanName(profile.name);
    if (!name) return { ok:false, code:'INVALID_PROFILE_NAME', message:'The imported profile name is invalid.' };
    let candidate = name;
    let suffix = 2;
    while (this.data.profiles.some(item => item.name.toLowerCase() === candidate.toLowerCase())) candidate = `${name.slice(0, 54)} (${suffix++})`;
    return this.saveProfile(candidate, normalizeConfiguration(profile.configuration));
  }

  getState() { return { ok:true, activeProfileId:this.data.activeProfileId, profiles:this.list(), path:this.filePath, schema:PROFILE_SCHEMA }; }
}

module.exports = { ConfigurationProfileStore, PROFILE_SCHEMA, normalizeConfiguration, normalizeFlags, cleanName };
