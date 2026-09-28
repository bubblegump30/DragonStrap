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
    this.now = options.now || Date.now;
    this.root = this.path.join(userDataDir, 'studio-project-backups');
    this.lastCreatedMs = 0;
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
    // Timestamps are also the retention order. Make them unique even when
    // several backups are created in one millisecond or the clock moves back.
    const newest = Date.parse(this.list(source)[0]?.createdAt || '') || 0;
    const createdMs = Math.max(this.now(), this.lastCreatedMs + 1, newest + 1);
    const createdAt = new Date(createdMs);
    const id = `${safeStamp(createdAt)}-${this.crypto.randomBytes(4).toString('hex')}`;
    const fileName = `${base}.${id}${ext}`;
    const target = this.path.join(dir, fileName);
    this.fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
    const payload = {
      schema:'dragonstrap.studio-backup.v1',
      id,
      projectPath:source,
      sourceName:this.path.basename(source),
      backupPath:target,
      createdAt:createdAt.toISOString(),
      reason:String(options.reason || 'manual').slice(0, 80),
      size:this.fs.statSync(target).size,
      sourceModifiedAt:stat.mtime.toISOString()
    };
    const meta = this.path.join(dir, `${id}.json`);
    const temp = `${meta}.${this.crypto.randomBytes(4).toString('hex')}.tmp`;
    try {
      this.fs.writeFileSync(temp, `${JSON.stringify(payload, null, 2)}\n`, { encoding:'utf8', flag:'wx' });
      this.fs.renameSync(temp, meta);
    } catch (error) {
      this.fs.rmSync(temp, { force:true });
      this.fs.rmSync(target, { force:true });
      throw error;
    }
    this.lastCreatedMs = createdMs;
    this.#prune(source, retention);
    return { ok:true, backup:this.#public(payload) };
  }

  list(projectPath) {
    const dir = this.getProjectDir(projectPath);
    if (!this.fs.existsSync(dir)) return [];
    const items=[];
    for (const name of this.fs.readdirSync(dir)) {
      if (!name.endsWith('.json')) continue;
      const payload = this.#validatedPayload(projectPath, name);
      if (payload) items.push(this.#public(payload));
    }
    return items.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)) || b.id.localeCompare(a.id));
  }

  get(projectPath, id) {
    if (!/^[0-9TZ-]+-[a-f0-9]{8}$/.test(String(id || ''))) return null;
    return this.#validatedPayload(projectPath, `${id}.json`);
  }

  restoreCopy(projectPath, id, destinationPath) {
    const backup=this.get(projectPath,id);
    if (!backup) return { ok:false, code:'BACKUP_NOT_FOUND', message:'The selected Studio backup no longer exists.' };
    const destination=String(destinationPath || '');
    const ext=this.path.extname(destination).toLowerCase();
    if (!['.rbxl','.rbxlx'].includes(ext)) return { ok:false, code:'INVALID_RESTORE_PATH', message:'Restore destination must use .rbxl or .rbxlx.' };
    this.fs.mkdirSync(this.path.dirname(destination), { recursive:true });
    try {
      this.fs.copyFileSync(backup.backupPath, destination, fs.constants.COPYFILE_EXCL);
    } catch (error) {
      if (error.code === 'EEXIST') return { ok:false, code:'RESTORE_DESTINATION_EXISTS', message:'Choose a new filename; an existing project will not be overwritten.' };
      throw error;
    }
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

  #validatedPayload(projectPath, name) {
    const dir = this.getProjectDir(projectPath);
    const id = name.slice(0, -5);
    if (!/^[0-9TZ-]+-[a-f0-9]{8}$/.test(id) || name !== `${id}.json`) return null;
    try {
      const meta = this.path.join(dir, name);
      if (!this.fs.lstatSync(meta).isFile()) return null;
      const payload = JSON.parse(this.fs.readFileSync(meta, 'utf8'));
      if (payload?.schema !== 'dragonstrap.studio-backup.v1' || payload.id !== id || payload.projectPath !== projectPath) return null;
      const backupPath = payload.backupPath;
      const ext = this.path.extname(projectPath).toLowerCase();
      if (typeof backupPath !== 'string' || this.path.resolve(this.path.dirname(backupPath)) !== this.path.resolve(dir) ||
          !this.path.basename(backupPath).endsWith(`.${id}${ext}`) || !this.fs.lstatSync(backupPath).isFile()) return null;
      if (!Number.isFinite(Date.parse(payload.createdAt))) return null;
      return payload;
    } catch { return null; }
  }

  #prune(projectPath, retention) {
    const dir=this.getProjectDir(projectPath);
    const list=this.list(projectPath);
    for (const item of list.slice(retention)) {
      const meta=this.path.join(dir,`${item.id}.json`);
      const payload = this.#validatedPayload(projectPath, `${item.id}.json`);
      if (!payload) continue;
      this.fs.rmSync(payload.backupPath,{force:true});
      this.fs.rmSync(meta,{force:true});
    }
  }
}

module.exports = { StudioBackupService, MAX_BACKUPS };
