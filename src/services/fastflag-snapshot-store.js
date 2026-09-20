'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_SNAPSHOTS = 20;

class FastFlagSnapshotStore {
  constructor(userDataDir, fsImpl = fs) {
    this.fs = fsImpl;
    this.dir = path.join(userDataDir, 'fastflag-snapshots');
  }

  create(flags, reason = 'manual-apply') {
    if (!flags || typeof flags !== 'object' || Array.isArray(flags)) throw new TypeError('Snapshot flags must be an object.');
    this.fs.mkdirSync(this.dir, { recursive:true });
    const now = new Date();
    const id = `${now.toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(4).toString('hex')}`;
    const payload = {
      schema:'dragonstrap.fastflag-snapshot.v1',
      id,
      createdAt:now.toISOString(),
      reason:String(reason || 'manual-apply').slice(0,80),
      flags:{ ...flags }
    };
    const filePath = path.join(this.dir, `${id}.json`);
    const temp = `${filePath}.tmp`;
    this.fs.writeFileSync(temp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    this.fs.renameSync(temp, filePath);
    this.#prune();
    return this.#meta(payload);
  }

  list() {
    if (!this.fs.existsSync(this.dir)) return [];
    const items = [];
    for (const name of this.fs.readdirSync(this.dir)) {
      if (!name.endsWith('.json')) continue;
      try {
        const payload = JSON.parse(this.fs.readFileSync(path.join(this.dir, name), 'utf8'));
        if (payload?.schema !== 'dragonstrap.fastflag-snapshot.v1' || typeof payload.id !== 'string' || !payload.flags || Array.isArray(payload.flags)) continue;
        items.push(this.#meta(payload));
      } catch {}
    }
    return items.sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, MAX_SNAPSHOTS);
  }

  get(id) {
    const safe = typeof id === 'string' && /^[0-9TZ-]+-[a-f0-9]{8}$/.test(id) ? id : '';
    if (!safe) return null;
    const filePath = path.join(this.dir, `${safe}.json`);
    if (!this.fs.existsSync(filePath)) return null;
    try {
      const payload = JSON.parse(this.fs.readFileSync(filePath, 'utf8'));
      if (payload?.schema !== 'dragonstrap.fastflag-snapshot.v1' || payload.id !== safe || !payload.flags || Array.isArray(payload.flags)) return null;
      return JSON.parse(JSON.stringify(payload));
    } catch { return null; }
  }

  #meta(payload) {
    return {
      id:payload.id,
      createdAt:payload.createdAt,
      reason:payload.reason,
      flagCount:Object.keys(payload.flags || {}).length
    };
  }

  #prune() {
    const items = this.list();
    const keep = new Set(items.slice(0, MAX_SNAPSHOTS).map(item => `${item.id}.json`));
    for (const name of this.fs.readdirSync(this.dir)) {
      if (name.endsWith('.json') && !keep.has(name)) this.fs.rmSync(path.join(this.dir, name), { force:true });
    }
  }
}

module.exports = { FastFlagSnapshotStore, MAX_SNAPSHOTS };
