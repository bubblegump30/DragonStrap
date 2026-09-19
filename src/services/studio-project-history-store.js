'use strict';

const fs = require('fs');
const path = require('path');

class StudioProjectHistoryStore {
  constructor(userDataDir, limit = 10) {
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

  add(projectPath) {
    const normalized = String(projectPath || '').trim();
    if (!normalized) throw new TypeError('Project path is required.');
    const compare = normalized.toLowerCase();
    this.items = this.items.filter(item => String(item.path || '').toLowerCase() !== compare);
    const item = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: path.basename(normalized).slice(0, 220),
      path: normalized.slice(0, 4096),
      lastOpenedAt: new Date().toISOString()
    };
    this.items = [item, ...this.items].slice(0, this.limit);
    this.#save();
    return { ...item };
  }

  getAll() { return this.items.map(item => ({ ...item })); }
  get(id) { const item = this.items.find(entry => entry.id === id); return item ? { ...item } : null; }
  clear() { this.items = []; this.#save(); return []; }
}

module.exports = { StudioProjectHistoryStore };
