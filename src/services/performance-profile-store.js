'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BUILTIN_PROFILES = Object.freeze([
  Object.freeze({ id:'builtin:default', name:'Default', builtin:true, settings:Object.freeze({ fpsCap:0, renderMode:'default', msaaMode:'default' }) }),
  Object.freeze({ id:'builtin:balanced', name:'Balanced', builtin:true, settings:Object.freeze({ fpsCap:120, renderMode:'default', msaaMode:'2' }) }),
  Object.freeze({ id:'builtin:performance', name:'Performance', builtin:true, settings:Object.freeze({ fpsCap:240, renderMode:'default', msaaMode:'1' }) }),
  Object.freeze({ id:'builtin:quality', name:'Quality', builtin:true, settings:Object.freeze({ fpsCap:120, renderMode:'default', msaaMode:'4' }) })
]);

const VALID_RENDER_MODES = new Set(['default', 'd3d11', 'vulkan']);
const VALID_MSAA = new Set(['default', '1', '2', '4']);

function normalizeSettings(settings = {}) {
  const rawFps = Number(settings.fpsCap);
  const fpsCap = Number.isFinite(rawFps) ? Math.min(240, Math.max(0, Math.round(rawFps))) : 0;
  const renderMode = VALID_RENDER_MODES.has(settings.renderMode) ? settings.renderMode : 'default';
  const msaaMode = VALID_MSAA.has(String(settings.msaaMode)) ? String(settings.msaaMode) : 'default';
  return { fpsCap, renderMode, msaaMode };
}

function cleanProfileName(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ');
  return normalized && normalized.length <= 48 ? normalized : null;
}

function cleanPlaceId(value) {
  const text = String(value ?? '').trim();
  return /^[0-9]{1,20}$/.test(text) && text !== '0' ? text : null;
}

class PerformanceProfileStore {
  constructor(userDataDir, options = {}) {
    this.fs = options.fsImpl || fs;
    this.filePath = path.join(userDataDir, 'performance-profiles.json');
    this.data = { schemaVersion:1, customProfiles:[], experienceProfiles:{} };
    this.#load();
  }

  #load() {
    try {
      if (!this.fs.existsSync(this.filePath)) return;
      const parsed = JSON.parse(this.fs.readFileSync(this.filePath, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      const customProfiles = Array.isArray(parsed.customProfiles)
        ? parsed.customProfiles.map(item => this.#sanitizeStoredProfile(item)).filter(Boolean).slice(0, 50)
        : [];
      const validIds = new Set([...BUILTIN_PROFILES.map(item => item.id), ...customProfiles.map(item => item.id)]);
      const experienceProfiles = {};
      if (parsed.experienceProfiles && typeof parsed.experienceProfiles === 'object' && !Array.isArray(parsed.experienceProfiles)) {
        for (const [placeId, profileId] of Object.entries(parsed.experienceProfiles)) {
          const clean = cleanPlaceId(placeId);
          if (clean && typeof profileId === 'string' && validIds.has(profileId)) experienceProfiles[clean] = profileId;
        }
      }
      this.data = { schemaVersion:1, customProfiles, experienceProfiles };
    } catch {
      this.data = { schemaVersion:1, customProfiles:[], experienceProfiles:{} };
    }
  }

  #sanitizeStoredProfile(item) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const name = cleanProfileName(item.name);
    const id = typeof item.id === 'string' && /^custom:[A-Za-z0-9-]{8,64}$/.test(item.id) ? item.id : null;
    if (!name || !id) return null;
    return {
      id,
      name,
      builtin:false,
      settings:normalizeSettings(item.settings),
      createdAt:Number.isSafeInteger(item.createdAt) && item.createdAt > 0 ? item.createdAt : Date.now(),
      updatedAt:Number.isSafeInteger(item.updatedAt) && item.updatedAt > 0 ? item.updatedAt : Date.now()
    };
  }

  #save() {
    this.fs.mkdirSync(path.dirname(this.filePath), { recursive:true });
    const temp = `${this.filePath}.tmp`;
    this.fs.writeFileSync(temp, `${JSON.stringify(this.data, null, 2)}\n`, 'utf8');
    this.fs.renameSync(temp, this.filePath);
  }

  listProfiles() {
    return [
      ...BUILTIN_PROFILES.map(profile => ({ ...profile, settings:{ ...profile.settings } })),
      ...this.data.customProfiles.map(profile => ({ ...profile, settings:{ ...profile.settings } }))
    ];
  }

  listExperienceProfiles() {
    const profiles = new Map(this.listProfiles().map(profile => [profile.id, profile]));
    return Object.entries(this.data.experienceProfiles)
      .map(([placeId, profileId]) => ({ placeId, profileId, profileName:profiles.get(profileId)?.name || 'Unavailable' }))
      .sort((a, b) => a.placeId.localeCompare(b.placeId));
  }

  getProfile(id) {
    const profileId = String(id || '');
    const builtin = BUILTIN_PROFILES.find(item => item.id === profileId);
    if (builtin) return { ...builtin, settings:{ ...builtin.settings } };
    const custom = this.data.customProfiles.find(item => item.id === profileId);
    return custom ? { ...custom, settings:{ ...custom.settings } } : null;
  }

  saveCustomProfile(name, settings) {
    const cleanName = cleanProfileName(name);
    if (!cleanName) return { ok:false, code:'INVALID_PROFILE_NAME', message:'Profile names must contain 1–48 printable characters.' };
    const duplicate = this.data.customProfiles.find(item => item.name.toLowerCase() === cleanName.toLowerCase());
    const now = Date.now();
    if (duplicate) {
      duplicate.settings = normalizeSettings(settings);
      duplicate.updatedAt = now;
      this.#save();
      return { ok:true, profile:{ ...duplicate, settings:{ ...duplicate.settings } }, updated:true };
    }
    if (this.data.customProfiles.length >= 50) return { ok:false, code:'PROFILE_LIMIT', message:'DragonStrap supports up to 50 custom performance profiles.' };
    const profile = {
      id:`custom:${crypto.randomUUID()}`,
      name:cleanName,
      builtin:false,
      settings:normalizeSettings(settings),
      createdAt:now,
      updatedAt:now
    };
    this.data.customProfiles.push(profile);
    this.#save();
    return { ok:true, profile:{ ...profile, settings:{ ...profile.settings } }, updated:false };
  }

  deleteCustomProfile(id) {
    const profileId = String(id || '');
    if (!profileId.startsWith('custom:')) return { ok:false, code:'BUILTIN_PROFILE', message:'Built-in performance profiles cannot be deleted.' };
    const before = this.data.customProfiles.length;
    this.data.customProfiles = this.data.customProfiles.filter(item => item.id !== profileId);
    if (this.data.customProfiles.length === before) return { ok:false, code:'PROFILE_NOT_FOUND', message:'Performance profile was not found.' };
    for (const [placeId, mapped] of Object.entries(this.data.experienceProfiles)) {
      if (mapped === profileId) delete this.data.experienceProfiles[placeId];
    }
    this.#save();
    return { ok:true };
  }

  assignExperience(placeId, profileId) {
    const clean = cleanPlaceId(placeId);
    if (!clean) return { ok:false, code:'INVALID_PLACE_ID', message:'Enter a valid numeric Roblox Place ID.' };
    const profile = this.getProfile(profileId);
    if (!profile) return { ok:false, code:'PROFILE_NOT_FOUND', message:'Select an available performance profile.' };
    this.data.experienceProfiles[clean] = profile.id;
    this.#save();
    return { ok:true, mapping:{ placeId:clean, profileId:profile.id, profileName:profile.name } };
  }

  removeExperience(placeId) {
    const clean = cleanPlaceId(placeId);
    if (!clean) return { ok:false, code:'INVALID_PLACE_ID', message:'Enter a valid numeric Roblox Place ID.' };
    const existed = Object.hasOwn(this.data.experienceProfiles, clean);
    delete this.data.experienceProfiles[clean];
    if (existed) this.#save();
    return { ok:true, removed:existed };
  }

  resolveForExperience(placeId, fallbackSettings = {}) {
    const clean = cleanPlaceId(placeId);
    const mappedId = clean ? this.data.experienceProfiles[clean] : null;
    if (mappedId) {
      const profile = this.getProfile(mappedId);
      if (profile) return { source:'experience', placeId:clean, profile, settings:{ ...profile.settings } };
    }
    return {
      source:'global',
      placeId:clean,
      profile:{ id:'global', name:String(fallbackSettings.launchProfile || 'Custom'), builtin:false },
      settings:normalizeSettings(fallbackSettings)
    };
  }

  getState() {
    return {
      ok:true,
      profiles:this.listProfiles(),
      experienceProfiles:this.listExperienceProfiles(),
      path:this.filePath
    };
  }
}

module.exports = { PerformanceProfileStore, BUILTIN_PROFILES, normalizeSettings, cleanProfileName, cleanPlaceId };
