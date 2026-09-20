'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_BACKUPS = 50;

function safeStamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

class StudioBackupService {
  constructor(userDataDir, options = {}) {
    this.fs = options.fs || fs;
    this.path = options.path || path;
    this.crypto = options.crypto || crypto;
    this.root = this.path.join(userDataDir, 'studio-project-backups');
  }

  projectKey(projectPath) {
    return this.crypto.createHash('sha256').update(String(projectPath || '').toLowerCase()).digest('hex').slice(0, 24);
  }

  getProjectDir(projectPath) {
    return this.path.join(this.root, this.projectKey(projectPath));
  }

  create(projectPath, options = {}) {
    const source = String(projectPath || '');
    if (!source || !this.fs.existsSync(source)) return { ok:false, code:'PROJECT_NOT_FOUND', message:'The Studio project no longer exists.' };
    const stat = this.fs.statSync(source);
    if (!stat.isFile()) return { ok:false, code:'PROJECT_NOT_FILE', message:'Studio backup source must be a file.' };
    const retention = Math.max(1, Math.min(MAX_BACKUPS, Number(options.retention) || 10));
    const dir = this.getProjectDir(source);
    this.fs.mkdirSync(dir, { recursive:true });
    const ext = this.path.extname(source).toLowerCase();
    const base = this.path.basename(source, ext).replace(/[^A-Za-z0-9._ -]/g, '_').slice(0, 120) || 'StudioProject';
    const id = `${safeStamp()}-${this.crypto.randomBytes(4).toString('hex')}`;
    const fileName = `${base}.${id}${ext}`;
    const target = this.path.join(dir, fileName);
    this.fs.copyFileSync(source, target);
    const payload = {
      schema:'dragonstrap.studio-backup.v1',
      id,
      projectPath:source,
      sourceName:this.path.basename(source),
      backupPath:target,
      createdAt:new Date().toISOString(),
      reason:String(options.reason || 'manual').slice(0, 80),
      size:this.fs.statSync(target).size,
      sourceModifiedAt:stat.mtime.toISOString()
    };
    const meta = this.path.join(dir, `${id}.json`);
    this.fs.writeFileSync(meta, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    this.#prune(source, retention);
    return { ok:true, backup:this.#public(payload) };
  }

  list(projectPath) {
    const dir = this.getProjectDir(projectPath);
    if (!this.fs.existsSync(dir)) return [];
    const items=[];
    for (const name of this.fs.readdirSync(dir)) {
      if (!name.endsWith('.json')) continue;
      try {
        const payload=JSON.parse(this.fs.readFileSync(this.path.join(dir,name),'utf8'));
        if (payload?.schema !== 'dragonstrap.studio-backup.v1' || typeof payload.id !== 'string') continue;
        if (!this.fs.existsSync(payload.backupPath)) continue;
        items.push(this.#public(payload));
      } catch {}
    }
    return items.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  get(projectPath, id) {
    if (!/^[0-9TZ-]+-[a-f0-9]{8}$/.test(String(id || ''))) return null;
    const meta = this.path.join(this.getProjectDir(projectPath), `${id}.json`);
    if (!this.fs.existsSync(meta)) return null;
    try {
      const payload=JSON.parse(this.fs.readFileSync(meta,'utf8'));
      if (payload?.schema !== 'dragonstrap.studio-backup.v1' || payload.id !== id || payload.projectPath !== projectPath) return null;
      if (!this.fs.existsSync(payload.backupPath)) return null;
      return { ...payload };
    } catch { return null; }
  }

  restoreCopy(projectPath, id, destinationPath) {
    const backup=this.get(projectPath,id);
    if (!backup) return { ok:false, code:'BACKUP_NOT_FOUND', message:'The selected Studio backup no longer exists.' };
    const destination=String(destinationPath || '');
    const ext=this.path.extname(destination).toLowerCase();
    if (!['.rbxl','.rbxlx'].includes(ext)) return { ok:false, code:'INVALID_RESTORE_PATH', message:'Restore destination must use .rbxl or .rbxlx.' };
    this.fs.mkdirSync(this.path.dirname(destination), { recursive:true });
    this.fs.copyFileSync(backup.backupPath, destination);
    return { ok:true, path:destination, backup:this.#public(backup) };
  }

  openFolderForProject(projectPath) {
    const dir=this.getProjectDir(projectPath);
    this.fs.mkdirSync(dir,{recursive:true});
    return dir;
  }

  #public(payload) {
    return {
      id:payload.id,
      createdAt:payload.createdAt,
      reason:payload.reason,
      size:Number(payload.size) || 0,
      sourceModifiedAt:payload.sourceModifiedAt || null,
      sourceName:payload.sourceName || ''
    };
  }

  #prune(projectPath, retention) {
    const dir=this.getProjectDir(projectPath);
    const list=this.list(projectPath);
    for (const item of list.slice(retention)) {
      const meta=this.path.join(dir,`${item.id}.json`);
      try {
        const payload=JSON.parse(this.fs.readFileSync(meta,'utf8'));
        if (payload.backupPath) this.fs.rmSync(payload.backupPath,{force:true});
      } catch {}
      this.fs.rmSync(meta,{force:true});
    }
  }
}

module.exports = { StudioBackupService, MAX_BACKUPS };
