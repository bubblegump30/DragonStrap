'use strict';

const fs = require('fs');
const path = require('path');

class StudioProjectHistoryStore {
  constructor(userDataDir, limit = 12) {
    this.filePath = path.join(userDataDir, 'studio-project-history.json');
    this.limit = limit;
    this.items = [];
    this.#load();
  }

  #load() {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      if (Array.isArray(raw)) this.items = raw.slice(0, this.limit).map(item => ({ ...item }));
    } catch {
      this.items = [];
    }
  }

  #save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify(this.items, null, 2)}\n`, 'utf8');
    fs.renameSync(temp, this.filePath);
  }

  add(projectPath, metadata = {}) {
    const normalized = String(projectPath || '').trim();
    if (!normalized) throw new TypeError('Project path is required.');
    const compare = normalized.toLowerCase();
    const existing = this.items.find(item => String(item.path || '').toLowerCase() === compare) || null;
    this.items = this.items.filter(item => String(item.path || '').toLowerCase() !== compare);
    const now = new Date().toISOString();
    const item = {
      id: existing?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: path.basename(normalized).slice(0, 220),
      path: normalized.slice(0, 4096),
      firstOpenedAt: existing?.firstOpenedAt || now,
      lastOpenedAt: now,
      openCount: Math.max(0, Number(existing?.openCount) || 0) + 1,
      lastKnownSize: Number(metadata.size ?? existing?.lastKnownSize ?? 0) || 0,
      lastKnownModifiedAt: metadata.modifiedAt || existing?.lastKnownModifiedAt || null,
      lastLaunchProfile: String(metadata.launchProfile || existing?.lastLaunchProfile || 'standard').slice(0, 40)
    };
    this.items = [item, ...this.items].slice(0, this.limit);
    this.#save();
    return { ...item };
  }

  touchMetadata(id, metadata = {}) {
    const index=this.items.findIndex(item=>item.id === id);
    if (index < 0) return null;
    this.items[index]={
      ...this.items[index],
      lastKnownSize:Number(metadata.size ?? this.items[index].lastKnownSize ?? 0) || 0,
      lastKnownModifiedAt:metadata.modifiedAt || this.items[index].lastKnownModifiedAt || null
    };
    this.#save();
    return { ...this.items[index] };
  }

  getAll() { return this.items.map(item => ({ ...item })); }
  get(id) { const item = this.items.find(entry => entry.id === id); return item ? { ...item } : null; }
  clear() { this.items = []; this.#save(); return []; }
}

module.exports = { StudioProjectHistoryStore };
