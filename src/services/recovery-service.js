'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RESTORE_SCHEMA = 'dragonstrap.restore-point.v1';
const MAX_RESTORE_POINTS = 20;
const MAX_CONFIG_BYTES = 4 * 1024 * 1024;

function safeInside(root, candidate) {
  const base=path.resolve(root);
  const target=path.resolve(candidate);
  return target === base || target.startsWith(`${base}${path.sep}`);
}

function sha256Buffer(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }

class RecoveryService {
  constructor({ userData, env=process.env, fsImpl=fs, now=()=>Date.now() } = {}) {
    if (!userData) throw new TypeError('RecoveryService requires userData.');
    this.fs=fsImpl;
    this.now=now;
    this.userData=path.resolve(userData);
    this.localAppData=env.LOCALAPPDATA || path.join(require('os').homedir(),'AppData','Local');
    this.robloxRoot=path.join(this.localAppData,'Roblox');
    this.versionsRoot=path.join(this.robloxRoot,'Versions');
    this.root=path.join(this.userData,'recovery');
    this.restoreRoot=path.join(this.root,'restore-points');
    this.configMap=Object.freeze({
      settings:path.join(this.userData,'settings.json'),
      performanceProfiles:path.join(this.userData,'performance-profiles.json'),
      configurationProfiles:path.join(this.userData,'configuration-profiles.json'),
      fastFlagPresets:path.join(this.userData,'fastflag-presets.json'),
      studioSettings:path.join(this.userData,'studio-center-settings.json')
    });
  }

  #dynamicMap(status={}) {
    const map={ ...this.configMap };
    if (status.playerPath) map.playerClientSettings=path.join(path.dirname(status.playerPath),'ClientSettings','ClientAppSettings.json');
    if (status.studioPath) {
      const studio=path.join(path.dirname(status.studioPath),'ClientSettings','ClientAppSettings.json');
      if (!map.playerClientSettings || path.resolve(studio).toLowerCase() !== path.resolve(map.playerClientSettings).toLowerCase()) map.studioClientSettings=studio;
    }
    return map;
  }

  #validDestination(key, destination, status) {
    const allowed=this.#dynamicMap(status)[key];
    return Boolean(allowed && path.resolve(allowed).toLowerCase() === path.resolve(destination).toLowerCase());
  }

  #readJson(filePath) {
    const data=JSON.parse(this.fs.readFileSync(filePath,'utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${path.basename(filePath)} must contain a JSON object.`);
    return data;
  }

  #atomicWrite(filePath, buffer) {
    this.fs.mkdirSync(path.dirname(filePath),{recursive:true});
    const temp=`${filePath}.dragonstrap-recovery-${process.pid}-${this.now()}.tmp`;
    this.fs.writeFileSync(temp,buffer);
    this.fs.renameSync(temp,filePath);
  }

  createRestorePoint(label='Manual restore point', status={}) {
    const id=`restore-${new Date(this.now()).toISOString().replace(/[:.]/g,'-')}-${crypto.randomBytes(4).toString('hex')}`;
    const dir=path.join(this.restoreRoot,id);
    const filesDir=path.join(dir,'files');
    const map=this.#dynamicMap(status);
    const files=[];
    this.fs.mkdirSync(filesDir,{recursive:true});
    try {
      for (const [key,source] of Object.entries(map)) {
        if (!this.fs.existsSync(source)) continue;
        const stat=this.fs.statSync(source);
        if (!stat.isFile() || stat.size > MAX_CONFIG_BYTES) continue;
        const buffer=this.fs.readFileSync(source);
        const storedName=`${files.length.toString().padStart(2,'0')}-${key}.bin`;
        this.fs.writeFileSync(path.join(filesDir,storedName),buffer);
        files.push({ key, storedName, size:buffer.length, sha256:sha256Buffer(buffer) });
      }
      const manifest={
        schema:RESTORE_SCHEMA,
        id,
        label:String(label || 'Restore point').trim().slice(0,80) || 'Restore point',
        createdAt:new Date(this.now()).toISOString(),
        fileCount:files.length,
        files
      };
      this.fs.writeFileSync(path.join(dir,'manifest.json'),`${JSON.stringify(manifest,null,2)}\n`,'utf8');
      this.#prune();
      return { ok:true, restorePoint:this.#summary(manifest), path:dir };
    } catch(error) {
      this.fs.rmSync(dir,{recursive:true,force:true});
      return { ok:false, code:'RESTORE_POINT_CREATE_FAILED', message:error.message };
    }
  }

  #load(id) {
    const safeId=String(id || '');
    if (!/^restore-[A-Za-z0-9-]{10,160}$/.test(safeId)) return null;
    const dir=path.join(this.restoreRoot,safeId);
    if (!safeInside(this.restoreRoot,dir)) return null;
    try {
      const manifest=JSON.parse(this.fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
      if (manifest?.schema !== RESTORE_SCHEMA || manifest.id !== safeId || !Array.isArray(manifest.files)) return null;
      return { dir, manifest };
    } catch { return null; }
  }

  #summary(manifest) {
    return { id:manifest.id, label:manifest.label, createdAt:manifest.createdAt, fileCount:Number(manifest.fileCount || manifest.files?.length || 0) };
  }

  listRestorePoints() {
    if (!this.fs.existsSync(this.restoreRoot)) return [];
    const items=[];
    for (const entry of this.fs.readdirSync(this.restoreRoot,{withFileTypes:true})) {
      if (!entry.isDirectory()) continue;
      const loaded=this.#load(entry.name);
      if (loaded) items.push(this.#summary(loaded.manifest));
    }
    return items.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,MAX_RESTORE_POINTS);
  }

  restorePoint(id,status={}) {
    const loaded=this.#load(id);
    if (!loaded) return { ok:false, code:'RESTORE_POINT_NOT_FOUND', message:'The selected configuration restore point is unavailable.' };
    const map=this.#dynamicMap(status);
    const prepared=[];
    try {
      for (const item of loaded.manifest.files) {
        if (!item || typeof item.key !== 'string' || typeof item.storedName !== 'string') throw new Error('Restore point manifest is invalid.');
        const destination=map[item.key];
        if (!destination || !this.#validDestination(item.key,destination,status)) continue;
        const stored=path.join(loaded.dir,'files',path.basename(item.storedName));
        if (!safeInside(path.join(loaded.dir,'files'),stored) || !this.fs.existsSync(stored)) throw new Error(`Restore point payload is missing: ${item.key}`);
        const buffer=this.fs.readFileSync(stored);
        if (buffer.length !== Number(item.size) || sha256Buffer(buffer) !== item.sha256) throw new Error(`Restore point verification failed: ${item.key}`);
        if (/\.json$/i.test(destination)) {
          const parsed=JSON.parse(buffer.toString('utf8'));
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`Restore point JSON is invalid: ${item.key}`);
        }
        prepared.push({ key:item.key, destination, buffer, previous:this.fs.existsSync(destination) ? this.fs.readFileSync(destination) : null });
      }
    } catch(error) { return { ok:false, code:'RESTORE_POINT_INVALID', message:error.message }; }

    if (!prepared.length) return { ok:false, code:'RESTORE_POINT_EMPTY', message:'No files in this restore point apply to the current DragonStrap/Roblox configuration.' };
    const safety=this.createRestorePoint('Automatic point before restore',status);
    if (!safety.ok) return { ok:false, code:'RESTORE_SAFETY_POINT_FAILED', message:'DragonStrap could not create the safety restore point required before restoring.' };
    const written=[];
    try {
      for (const item of prepared) { this.#atomicWrite(item.destination,item.buffer); written.push(item); }
      return { ok:true, restored:written.map(item=>item.key), restoredCount:written.length, safetyRestorePoint:safety.restorePoint };
    } catch(error) {
      for (const item of written.reverse()) {
        try {
          if (item.previous === null) this.fs.rmSync(item.destination,{force:true});
          else this.#atomicWrite(item.destination,item.previous);
        } catch { /* best effort transactional rollback */ }
      }
      return { ok:false, code:'RESTORE_POINT_APPLY_FAILED', message:error.message };
    }
  }

  deleteRestorePoint(id) {
    const loaded=this.#load(id);
    if (!loaded) return { ok:false, code:'RESTORE_POINT_NOT_FOUND', message:'The selected configuration restore point is unavailable.' };
    this.fs.rmSync(loaded.dir,{recursive:true,force:true});
    return { ok:true, id };
  }

  inspectPlayer(status={}) {
    const checks=[];
    const add=(id,label,level,detail)=>checks.push({id,label,level,detail});
    if (!status.playerPath) {
      add('player-exe','Player executable','error','RobloxPlayerBeta.exe was not detected.');
      return { level:'critical', corrupted:true, checks, version:status.version || null, playerPath:null };
    }
    const exe=path.resolve(status.playerPath);
    const dir=path.dirname(exe);
    const versionName=path.basename(dir);
    const insideVersions=safeInside(this.versionsRoot,dir) && /^version-[A-Za-z0-9_-]+$/i.test(versionName);
    add('player-location','Version location',insideVersions?'ok':'error',insideVersions?versionName:'Player executable is outside the expected Roblox Versions directory.');
    let stat=null, header=null;
    try {
      stat=this.fs.statSync(exe);
      const fd=this.fs.openSync(exe,'r');
      try { const bytes=Buffer.alloc(2); this.fs.readSync(fd,bytes,0,2,0); header=bytes.toString('ascii'); } finally { this.fs.closeSync(fd); }
    } catch {}
    const exeOk=Boolean(stat?.isFile() && stat.size >= 256 * 1024 && header === 'MZ');
    add('player-binary','Player binary',exeOk?'ok':'error',exeOk?`Windows PE executable • ${(stat.size/1024/1024).toFixed(1)} MB`:'RobloxPlayerBeta.exe is missing, truncated, or does not have a valid Windows PE header.');
    const appSettings=path.join(dir,'AppSettings.xml');
    add('app-settings','AppSettings.xml',this.fs.existsSync(appSettings)?'ok':'warn',this.fs.existsSync(appSettings)?'Present.':'Missing. Roblox may recreate it, but this installation should be reviewed.');
    const content=path.join(dir,'content');
    add('content','Core content',this.fs.existsSync(content)?'ok':'warn',this.fs.existsSync(content)?'Content directory detected.':'Core content directory was not detected.');
    const settings=path.join(dir,'ClientSettings','ClientAppSettings.json');
    if (this.fs.existsSync(settings)) {
      try { this.#readJson(settings); add('client-settings','Client settings','ok','ClientAppSettings.json is valid JSON.'); }
      catch(error) { add('client-settings','Client settings','error',`Malformed ClientAppSettings.json: ${error.message}`); }
    } else add('client-settings','Client settings','ok','No Player override file is present.');
    const errors=checks.filter(item=>item.level==='error').length;
    const warnings=checks.filter(item=>item.level==='warn').length;
    return { level:errors?'critical':(warnings?'warning':'healthy'), corrupted:errors>0, checks, version:status.version || versionName, playerPath:exe };
  }

  inspectAbandonedStaging(updateState={}) {
    const active=Boolean(updateState?.active);
    const items=[];
    if (this.fs.existsSync(path.join(this.versionsRoot,'.dragonstrap-staging'))) {
      const root=path.join(this.versionsRoot,'.dragonstrap-staging');
      for (const entry of this.fs.readdirSync(root,{withFileTypes:true})) if (entry.isDirectory()) items.push(entry.name);
    }
    return { active, count:items.length, items:items.slice(0,20), repairAvailable:!active && items.length>0 };
  }

  clearAbandonedStaging(updateState={}) {
    const scan=this.inspectAbandonedStaging(updateState);
    if (scan.active) return { ok:false, code:'INSTALL_ACTIVE', message:'Roblox installation staging cannot be cleaned while an installation is active.' };
    const root=path.join(this.versionsRoot,'.dragonstrap-staging');
    let removed=0;
    for (const name of scan.items) {
      const target=path.join(root,name);
      if (!safeInside(root,target)) continue;
      this.fs.rmSync(target,{recursive:true,force:true});
      removed += 1;
    }
    return { ok:true, removed };
  }

  getState(status={}, robloxUpdateState={}) {
    return {
      ok:true,
      integrity:this.inspectPlayer(status),
      restorePoints:this.listRestorePoints(),
      staging:this.inspectAbandonedStaging(robloxUpdateState),
      generatedAt:new Date(this.now()).toISOString()
    };
  }

  #prune() {
    if (!this.fs.existsSync(this.restoreRoot)) return;
    const items=[];
    for (const entry of this.fs.readdirSync(this.restoreRoot,{withFileTypes:true})) {
      if (!entry.isDirectory()) continue;
      const loaded=this.#load(entry.name);
      if (loaded) items.push(this.#summary(loaded.manifest));
    }
    items.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    for (const item of items.slice(MAX_RESTORE_POINTS)) {
      const loaded=this.#load(item.id);
      if (loaded) this.fs.rmSync(loaded.dir,{recursive:true,force:true});
    }
  }
}

module.exports={ RecoveryService, RESTORE_SCHEMA, MAX_RESTORE_POINTS, MAX_CONFIG_BYTES, safeInside, sha256Buffer };
