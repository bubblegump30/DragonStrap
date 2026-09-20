'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { classifyFlag, KEY_PATTERN } = require('./fastflag-service');

const FORBIDDEN_KEYS = new Set(['__proto__','prototype','constructor']);
const MAX_FLAGS = 500;
const MAX_VALUE_LENGTH = 2048;
const MAX_SNAPSHOTS = 20;

class StudioFastFlagService {
  constructor(userDataDir, fsImpl = fs) {
    this.fs = fsImpl;
    this.snapshotDir = path.join(userDataDir, 'studio-fastflag-snapshots');
  }

  getPath(status) {
    if (!status?.studioPath) return null;
    return path.join(path.dirname(status.studioPath), 'ClientSettings', 'ClientAppSettings.json');
  }

  isIsolated(status) {
    const studioPath=this.getPath(status);
    if (!studioPath) return false;
    if (!status?.playerPath) return true;
    const playerPath=path.join(path.dirname(status.playerPath),'ClientSettings','ClientAppSettings.json');
    return path.resolve(studioPath).toLowerCase() !== path.resolve(playerPath).toLowerCase();
  }

  getState(status, enabled = false) {
    const filePath=this.getPath(status);
    if (!filePath) return { ok:false, code:'STUDIO_NOT_FOUND', message:'Roblox Studio was not detected.', enabled:false, entries:[] };
    const isolated=this.isIsolated(status);
    try {
      const data=this.#read(filePath);
      return {
        ok:true,
        enabled:Boolean(enabled),
        isolated,
        path:filePath,
        backupPath:`${filePath}.dragonstrap.studio.bak`,
        backupExists:this.fs.existsSync(`${filePath}.dragonstrap.studio.bak`),
        entries:Object.entries(data).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>({ key, value:String(value ?? ''), type:classifyFlag(key,value) })),
        snapshots:this.#listSnapshots()
      };
    } catch(error) {
      return { ok:false, code:'INVALID_STUDIO_SETTINGS', message:error.message, enabled:Boolean(enabled), isolated, path:filePath, entries:[] };
    }
  }

  validateEntry(key,value,type='auto') {
    const normalizedKey=typeof key === 'string' ? key.trim() : '';
    if (!KEY_PATTERN.test(normalizedKey) || FORBIDDEN_KEYS.has(normalizedKey)) return { ok:false, code:'INVALID_KEY', message:'Flag names must be 2–160 letters, numbers, or underscores and start with a letter.' };
    try {
      const normalizedValue=this.#normalizeValue(value,type,normalizedKey);
      return { ok:true, key:normalizedKey, value:normalizedValue, type:classifyFlag(normalizedKey,normalizedValue) };
    } catch(error) { return { ok:false, code:'INVALID_VALUE', message:error.message }; }
  }

  set(status, enabled, key, value, type='auto') {
    if (!enabled) return { ok:false, code:'STUDIO_FASTFLAGS_DISABLED', message:'Enable isolated Studio FastFlags before editing Studio ClientSettings.' };
    if (!this.isIsolated(status)) return { ok:false, code:'STUDIO_NOT_ISOLATED', message:'Studio and Player resolve to the same ClientSettings path; DragonStrap will not write an isolated Studio configuration.' };
    const validation=this.validateEntry(key,value,type);
    if (!validation.ok) return validation;
    const filePath=this.getPath(status);
    try {
      const data=this.#read(filePath);
      if (!Object.hasOwn(data,validation.key) && Object.keys(data).length >= MAX_FLAGS) return { ok:false, code:'STUDIO_FLAG_LIMIT', message:`Studio FastFlags are limited to ${MAX_FLAGS} entries.` };
      this.#ensureBackup(filePath);
      const snapshot=this.#snapshot(data,'before-set');
      data[validation.key]=validation.value;
      this.#write(filePath,data);
      return { ok:true, path:filePath, entry:validation, snapshot };
    } catch(error) { return { ok:false, code:'STUDIO_FASTFLAG_WRITE_FAILED', message:error.message, path:filePath }; }
  }

  remove(status, enabled, key) {
    if (!enabled) return { ok:false, code:'STUDIO_FASTFLAGS_DISABLED', message:'Enable isolated Studio FastFlags before editing Studio ClientSettings.' };
    if (!this.isIsolated(status)) return { ok:false, code:'STUDIO_NOT_ISOLATED', message:'Studio and Player resolve to the same ClientSettings path; DragonStrap will not write an isolated Studio configuration.' };
    const normalized=typeof key === 'string' ? key.trim() : '';
    if (!KEY_PATTERN.test(normalized) || FORBIDDEN_KEYS.has(normalized)) return { ok:false, code:'INVALID_KEY', message:'Invalid Studio FastFlag key.' };
    const filePath=this.getPath(status);
    try {
      const data=this.#read(filePath);
      if (!Object.hasOwn(data,normalized)) return { ok:true, noChanges:true, path:filePath };
      this.#ensureBackup(filePath);
      const snapshot=this.#snapshot(data,'before-remove');
      delete data[normalized];
      this.#write(filePath,data);
      return { ok:true, path:filePath, removed:normalized, snapshot };
    } catch(error) { return { ok:false, code:'STUDIO_FASTFLAG_REMOVE_FAILED', message:error.message, path:filePath }; }
  }

  restoreBackup(status, enabled) {
    if (!enabled) return { ok:false, code:'STUDIO_FASTFLAGS_DISABLED', message:'Enable isolated Studio FastFlags before restoring Studio ClientSettings.' };
    if (!this.isIsolated(status)) return { ok:false, code:'STUDIO_NOT_ISOLATED', message:'Studio and Player resolve to the same ClientSettings path; restore is blocked.' };
    const filePath=this.getPath(status);
    const backupPath=`${filePath}.dragonstrap.studio.bak`;
    if (!this.fs.existsSync(backupPath)) return { ok:false, code:'NO_STUDIO_BACKUP', message:'No Studio FastFlag backup exists yet.' };
    try {
      const current=this.#read(filePath);
      this.#snapshot(current,'before-backup-restore');
      const data=this.#read(backupPath);
      this.#write(filePath,data);
      return { ok:true, path:filePath, total:Object.keys(data).length };
    } catch(error) { return { ok:false, code:'STUDIO_BACKUP_RESTORE_FAILED', message:error.message, path:filePath }; }
  }

  #normalizeValue(value,type,key) {
    const mode=type === 'auto' ? classifyFlag(key,value) : type;
    const raw=String(value ?? '').trim();
    if (raw.length > MAX_VALUE_LENGTH) throw new Error(`Values are limited to ${MAX_VALUE_LENGTH} characters.`);
    if (mode === 'boolean') {
      if (!/^(true|false|1|0)$/i.test(raw)) throw new Error('Boolean flags accept True or False.');
      return /^(true|1)$/i.test(raw) ? 'True' : 'False';
    }
    if (mode === 'integer') {
      if (!/^-?\d+$/.test(raw)) throw new Error('Integer flags require a whole number.');
      return raw;
    }
    if (mode === 'float') {
      const number=Number(raw);
      if (!Number.isFinite(number)) throw new Error('Float flags require a finite number.');
      return String(number);
    }
    if (!['string','auto'].includes(mode)) throw new Error('Unsupported FastFlag value type.');
    return String(value ?? '');
  }

  #read(filePath) {
    if (!this.fs.existsSync(filePath)) return {};
    const text=this.fs.readFileSync(filePath,'utf8').trim();
    if (!text) return {};
    const parsed=JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Studio ClientAppSettings.json must contain a JSON object.');
    return { ...parsed };
  }

  #write(filePath,data) {
    this.fs.mkdirSync(path.dirname(filePath),{recursive:true});
    const temp=`${filePath}.dragonstrap.studio.tmp`;
    this.fs.writeFileSync(temp,`${JSON.stringify(data,null,2)}\n`,'utf8');
    this.fs.renameSync(temp,filePath);
  }

  #ensureBackup(filePath) {
    if (!this.fs.existsSync(filePath)) return;
    const backup=`${filePath}.dragonstrap.studio.bak`;
    if (!this.fs.existsSync(backup)) this.fs.copyFileSync(filePath,backup);
  }

  #snapshot(flags,reason) {
    this.fs.mkdirSync(this.snapshotDir,{recursive:true});
    const now=new Date();
    const id=`${now.toISOString().replace(/[:.]/g,'-')}-${crypto.randomBytes(4).toString('hex')}`;
    const payload={schema:'dragonstrap.studio-fastflag-snapshot.v1',id,createdAt:now.toISOString(),reason,flags:{...flags}};
    const filePath=path.join(this.snapshotDir,`${id}.json`);
    this.fs.writeFileSync(filePath,`${JSON.stringify(payload,null,2)}\n`,'utf8');
    this.#pruneSnapshots();
    return {id,createdAt:payload.createdAt,reason,flagCount:Object.keys(flags).length};
  }

  #listSnapshots() {
    if (!this.fs.existsSync(this.snapshotDir)) return [];
    const items=[];
    for (const name of this.fs.readdirSync(this.snapshotDir)) {
      if (!name.endsWith('.json')) continue;
      try {
        const payload=JSON.parse(this.fs.readFileSync(path.join(this.snapshotDir,name),'utf8'));
        if (payload?.schema !== 'dragonstrap.studio-fastflag-snapshot.v1') continue;
        items.push({id:payload.id,createdAt:payload.createdAt,reason:payload.reason,flagCount:Object.keys(payload.flags || {}).length});
      } catch {}
    }
    return items.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,MAX_SNAPSHOTS);
  }

  #pruneSnapshots() {
    const keep=new Set(this.#listSnapshots().slice(0,MAX_SNAPSHOTS).map(item=>`${item.id}.json`));
    for (const name of this.fs.readdirSync(this.snapshotDir)) if (name.endsWith('.json') && !keep.has(name)) this.fs.rmSync(path.join(this.snapshotDir,name),{force:true});
  }
}

module.exports = { StudioFastFlagService, MAX_FLAGS, MAX_SNAPSHOTS };
