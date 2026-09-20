'use strict';

const fs = require('fs');
const path = require('path');
const { MANAGED_FLAGS } = require('./performance-service');
const {
  inferCategory,
  inferDescription,
  trustInfo,
  safeCoreCatalog,
  compatibilityWarnings,
  activePerformanceFamilies
} = require('./fastflag-metadata');

const PROTECTED_KEYS = new Set(Object.values(MANAGED_FLAGS));
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{1,159}$/;
const MAX_VALUE_LENGTH = 2048;
const MAX_PATCH_ITEMS = 1000;

function classifyFlag(key, value) {
  const raw = String(value ?? '');
  if (/^(?:D|S)?FFlag/.test(key)) return 'boolean';
  if (/^(?:D|S)?FInt/.test(key) || /^(?:D|S)?FLog/.test(key)) return 'integer';
  if (/^(?:D|S)?FFloat/.test(key)) return 'float';
  if (/^(?:D|S)?FString/.test(key)) return 'string';
  if (/^(True|False)$/i.test(raw)) return 'boolean';
  if (/^-?\d+$/.test(raw)) return 'integer';
  if (/^-?(?:\d+\.\d+|\d+(?:\.\d+)?[eE][+-]?\d+)$/.test(raw)) return 'float';
  return 'string';
}

class FastFlagService {
  constructor(fsImpl = fs, options = {}) {
    this.fs = fsImpl;
    this.snapshotStore = options.snapshotStore || null;
  }

  getClientSettingsPath(status) {
    if (!status?.playerPath) return null;
    return path.join(path.dirname(status.playerPath), 'ClientSettings', 'ClientAppSettings.json');
  }

  getBackupPath(status) {
    const filePath = this.getClientSettingsPath(status);
    return filePath ? `${filePath}.dragonstrap.bak` : null;
  }

  getState(status) {
    const filePath = this.getClientSettingsPath(status);
    if (!filePath) return { ok:false, code:'ROBLOX_NOT_FOUND', message:'Roblox Player was not detected.', entries:[], categories:[] };
    try {
      const data = this.#read(filePath);
      const performanceFamilies = activePerformanceFamilies(data);
      const entries = Object.entries(data)
        .map(([key,value]) => this.#entry(key, value, performanceFamilies))
        .sort((a,b) => a.key.localeCompare(b.key));
      const categories = [...new Set(entries.map(item => item.category))].sort();
      const warningCount = entries.reduce((sum,item) => sum + item.warnings.filter(w => w.severity === 'warning').length, 0);
      const conflictCount = entries.filter(item => !item.protected && item.warnings.some(w => w.code.startsWith('PERFORMANCE_FAMILY_') && w.severity === 'warning')).length;
      return {
        ok:true,
        path:filePath,
        backupPath:this.getBackupPath(status),
        backupExists:this.fs.existsSync(this.getBackupPath(status)),
        exists:this.fs.existsSync(filePath),
        total:entries.length,
        editableCount:entries.filter(x=>!x.protected).length,
        protectedCount:entries.filter(x=>x.protected).length,
        warningCount,
        conflictCount,
        categories,
        safeCoreCount:entries.filter(item => item.trust?.level === 'safe').length,
        legacyCount:entries.filter(item => item.trust?.level === 'legacy').length,
        experimentalCount:entries.filter(item => item.trust?.level === 'experimental').length,
        unknownCount:entries.filter(item => item.trust?.level === 'unknown').length,
        safeCoreCatalog:safeCoreCatalog().map(meta => {
          const protectedKey=PROTECTED_KEYS.has(meta.key);
          return {
            key:meta.key,
            recommendedValue:meta.recommendedValue,
            category:meta.category,
            description:meta.description,
            trust:trustInfo(meta.key),
            protected:protectedKey,
            type:classifyFlag(meta.key, meta.recommendedValue ?? '')
          };
        }),
        activePerformanceFamilies:performanceFamilies,
        snapshots:this.listSnapshots(),
        entries
      };
    } catch (error) {
      return { ok:false, code:'INVALID_CLIENT_SETTINGS', message:error.message, path:filePath, entries:[], categories:[] };
    }
  }

  validateEntry(key, value, type = 'auto') {
    const normalizedKey = typeof key === 'string' ? key.trim() : '';
    if (!KEY_PATTERN.test(normalizedKey) || FORBIDDEN_KEYS.has(normalizedKey)) {
      return { ok:false, code:'INVALID_KEY', message:'Flag names must be 2–160 letters, numbers, or underscores and start with a letter.' };
    }
    if (PROTECTED_KEYS.has(normalizedKey)) {
      return { ok:false, code:'PERFORMANCE_PROTECTED', message:'This flag is owned by Performance+. Change it from the Performance+ page.' };
    }
    try {
      const normalizedValue = this.#normalizeValue(value, type, normalizedKey);
      return { ok:true, key:normalizedKey, value:normalizedValue, type:classifyFlag(normalizedKey, normalizedValue) };
    } catch (error) {
      return { ok:false, code:'INVALID_VALUE', message:error.message };
    }
  }

  previewPatch(status, patch = {}) {
    const filePath = this.getClientSettingsPath(status);
    if (!filePath) return { ok:false, code:'ROBLOX_NOT_FOUND', message:'Roblox Player was not detected.', changes:[] };
    const set = Array.isArray(patch.set) ? patch.set : [];
    const remove = Array.isArray(patch.remove) ? patch.remove : [];
    if (set.length + remove.length > MAX_PATCH_ITEMS) {
      return { ok:false, code:'PATCH_TOO_LARGE', message:`A single apply operation is limited to ${MAX_PATCH_ITEMS} changes.`, changes:[] };
    }
    try {
      const data = this.#read(filePath);
      const performanceFamilies = activePerformanceFamilies(data);
      const changes = [];
      const seen = new Set();
      for (const item of set) {
        const result = this.validateEntry(item?.key, item?.value, item?.type || 'auto');
        if (!result.ok) return { ...result, changes:[] };
        if (seen.has(result.key)) return { ok:false, code:'DUPLICATE_PATCH_KEY', message:`${result.key} appears more than once in the pending patch.`, changes:[] };
        seen.add(result.key);
        const before = Object.hasOwn(data, result.key) ? String(data[result.key] ?? '') : null;
        if (before === result.value) continue;
        const meta = this.#entry(result.key, result.value, performanceFamilies);
        changes.push({
          action:before === null ? 'ADD' : 'SET', key:result.key, before, after:result.value,
          type:result.type, category:meta.category, description:meta.description, trust:meta.trust, warnings:meta.warnings
        });
      }
      for (const keyValue of remove) {
        const key = typeof keyValue === 'string' ? keyValue.trim() : '';
        if (!KEY_PATTERN.test(key) || FORBIDDEN_KEYS.has(key)) return { ok:false, code:'INVALID_KEY', message:`Invalid flag name: ${key || '(empty)'}`, changes:[] };
        if (PROTECTED_KEYS.has(key)) return { ok:false, code:'PERFORMANCE_PROTECTED', message:`${key} is managed by Performance Center.`, changes:[] };
        if (seen.has(key)) return { ok:false, code:'DUPLICATE_PATCH_KEY', message:`${key} is queued for both set and remove.`, changes:[] };
        seen.add(key);
        if (!Object.hasOwn(data, key)) continue;
        const meta = this.#entry(key, data[key], performanceFamilies);
        changes.push({ action:'REMOVE', key, before:String(data[key] ?? ''), after:null, type:meta.type, category:meta.category, description:meta.description, trust:meta.trust, warnings:meta.warnings });
      }
      const warnings = changes.flatMap(change => change.warnings.map(warning => ({ ...warning, key:change.key })));
      return {
        ok:true, path:filePath, changes,
        setCount:changes.filter(x=>x.action === 'SET' || x.action === 'ADD').length,
        removeCount:changes.filter(x=>x.action === 'REMOVE').length,
        warningCount:warnings.filter(w=>w.severity === 'warning').length,
        conflictCount:new Set(warnings.filter(w=>w.code.startsWith('PERFORMANCE_FAMILY_') && w.severity === 'warning').map(w=>w.key)).size,
        warnings
      };
    } catch (error) {
      return { ok:false, code:'FASTFLAG_PREVIEW_FAILED', message:error.message, path:filePath, changes:[] };
    }
  }

  applyPatch(status, patch = {}) {
    const preview = this.previewPatch(status, patch);
    if (!preview.ok) return preview;
    const filePath = preview.path;
    try {
      const data = this.#read(filePath);
      if (!preview.changes.length) return { ok:true, path:filePath, setCount:0, removeCount:0, total:Object.keys(data).length, snapshot:null, noChanges:true };
      this.#ensureBackup(filePath);
      const snapshot = this.snapshotStore ? this.snapshotStore.create(data, 'before-manual-apply') : null;
      for (const change of preview.changes) {
        if (change.action === 'REMOVE') delete data[change.key];
        else data[change.key] = change.after;
      }
      this.#write(filePath, data);
      return {
        ok:true, path:filePath,
        setCount:preview.setCount, removeCount:preview.removeCount, total:Object.keys(data).length,
        warningCount:preview.warningCount, conflictCount:preview.conflictCount, snapshot
      };
    } catch (error) {
      return { ok:false, code:'FASTFLAG_APPLY_FAILED', message:error.message, path:filePath };
    }
  }

  previewImport(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return { ok:false, code:'INVALID_IMPORT', message:'Imported FastFlags must be a JSON object.' };
    }
    const entries=[]; const ignoredProtected=[]; const errors=[];
    for (const [key,value] of Object.entries(input)) {
      if (PROTECTED_KEYS.has(key)) { ignoredProtected.push(key); continue; }
      if (value === null || typeof value === 'object') { errors.push({key,message:'Only non-null scalar values are supported.'}); continue; }
      const result=this.validateEntry(key,value,'auto');
      if (result.ok) entries.push({ ...result, category:inferCategory(result.key), description:inferDescription(result.key,result.type), trust:trustInfo(result.key), warnings:compatibilityWarnings(result.key) });
      else errors.push({key,message:result.message});
      if (entries.length > 1000) return { ok:false, code:'IMPORT_TOO_LARGE', message:'Import contains more than 1000 editable flags.' };
    }
    return { ok:true, entries, ignoredProtected, errors, total:Object.keys(input).length };
  }

  exportObject(status) {
    const filePath=this.getClientSettingsPath(status);
    if (!filePath) return { ok:false, code:'ROBLOX_NOT_FOUND', message:'Roblox Player was not detected.' };
    try { return { ok:true, path:filePath, data:this.#read(filePath) }; }
    catch(error){ return { ok:false, code:'INVALID_CLIENT_SETTINGS', message:error.message, path:filePath }; }
  }

  restoreBackup(status) {
    const filePath=this.getClientSettingsPath(status);
    const backupPath=this.getBackupPath(status);
    if (!filePath) return { ok:false, code:'ROBLOX_NOT_FOUND', message:'Roblox Player was not detected.' };
    if (!this.fs.existsSync(backupPath)) return { ok:false, code:'NO_BACKUP', message:'No DragonStrap FastFlag backup exists yet.' };
    try {
      const data=this.#read(backupPath);
      if (this.snapshotStore) this.snapshotStore.create(this.#read(filePath), 'before-backup-restore');
      this.#write(filePath,data);
      return { ok:true, path:filePath, restored:true, total:Object.keys(data).length };
    } catch(error){ return { ok:false, code:'BACKUP_RESTORE_FAILED', message:error.message, path:filePath }; }
  }

  listSnapshots() {
    return this.snapshotStore ? this.snapshotStore.list() : [];
  }

  restoreSnapshot(status, id) {
    const filePath=this.getClientSettingsPath(status);
    if (!filePath) return { ok:false, code:'ROBLOX_NOT_FOUND', message:'Roblox Player was not detected.' };
    if (!this.snapshotStore) return { ok:false, code:'SNAPSHOTS_UNAVAILABLE', message:'Automatic snapshots are unavailable.' };
    const snapshot=this.snapshotStore.get(id);
    if (!snapshot) return { ok:false, code:'SNAPSHOT_NOT_FOUND', message:'The selected FastFlag snapshot no longer exists.' };
    try {
      const current=this.#read(filePath);
      this.snapshotStore.create(current, 'before-snapshot-restore');
      const restored={};
      for (const [key,value] of Object.entries(snapshot.flags)) if (!PROTECTED_KEYS.has(key)) restored[key]=value;
      for (const key of PROTECTED_KEYS) if (Object.hasOwn(current,key)) restored[key]=current[key];
      this.#write(filePath,restored);
      return { ok:true, path:filePath, restored:true, snapshotId:id, total:Object.keys(restored).length, protectedPreserved:[...PROTECTED_KEYS].filter(key=>Object.hasOwn(current,key)).length };
    } catch(error){ return { ok:false, code:'SNAPSHOT_RESTORE_FAILED', message:error.message, path:filePath }; }
  }

  getEditableObject(status) {
    const result=this.exportObject(status);
    if (!result.ok) return result;
    const data={};
    for (const [key,value] of Object.entries(result.data)) if (!PROTECTED_KEYS.has(key)) data[key]=String(value ?? '');
    return { ok:true, data };
  }

  #entry(key, value, performanceFamilies) {
    const type=classifyFlag(key,value);
    const protectedKey=PROTECTED_KEYS.has(key);
    return {
      key,
      value:String(value ?? ''),
      type,
      protected:protectedKey,
      source:protectedKey ? 'Performance+' : 'Client',
      category:inferCategory(key),
      description:inferDescription(key,type),
      trust:trustInfo(key),
      warnings:compatibilityWarnings(key,{ protectedKey, activePerformanceFamilies:performanceFamilies })
    };
  }

  #normalizeValue(value, type, key) {
    const mode = type === 'auto' ? classifyFlag(key,value) : type;
    if (value === null || value === undefined) value='';
    const raw=String(value).trim();
    if (raw.length > MAX_VALUE_LENGTH) throw new Error(`Values are limited to ${MAX_VALUE_LENGTH} characters.`);
    if (mode === 'boolean') {
      if (!/^(true|false|1|0)$/i.test(raw)) throw new Error('Boolean flags accept True or False.');
      return /^(true|1)$/i.test(raw) ? 'True' : 'False';
    }
    if (mode === 'integer') {
      if (!/^-?\d+$/.test(raw)) throw new Error('Integer flags require a whole number.');
      if (raw.length > 32) throw new Error('Integer value is too large.');
      return raw;
    }
    if (mode === 'float') {
      const number=Number(raw);
      if (!Number.isFinite(number)) throw new Error('Float flags require a finite number.');
      return String(number);
    }
    if (!['string','auto'].includes(mode)) throw new Error('Unsupported FastFlag value type.');
    return String(value);
  }

  #read(filePath) {
    if (!this.fs.existsSync(filePath)) return {};
    const text=this.fs.readFileSync(filePath,'utf8').trim();
    if (!text) return {};
    const parsed=JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('ClientAppSettings.json must contain a JSON object.');
    return {...parsed};
  }

  #ensureBackup(filePath) {
    if (!this.fs.existsSync(filePath)) return;
    const backupPath=`${filePath}.dragonstrap.bak`;
    if (!this.fs.existsSync(backupPath)) this.fs.copyFileSync(filePath,backupPath);
  }

  #write(filePath,data) {
    this.fs.mkdirSync(path.dirname(filePath),{recursive:true});
    const temp=`${filePath}.dragonstrap.tmp`;
    this.fs.writeFileSync(temp,`${JSON.stringify(data,null,2)}\n`,'utf8');
    this.fs.renameSync(temp,filePath);
  }
}

module.exports={FastFlagService,PROTECTED_KEYS,classifyFlag,KEY_PATTERN};
