'use strict';

const fs = require('fs');
const path = require('path');

class LaunchHistoryStore {
  constructor(userDataDir, limit = 12) {
    this.filePath = path.join(userDataDir, 'launch-history.json');
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

  add(entry) {
    const item = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: String(entry?.type || 'player').slice(0, 32),
      label: String(entry?.label || 'Roblox').slice(0, 180),
      target: entry?.target ? String(entry.target).slice(0, 2048) : null,
      profile: String(entry?.profile || 'default').slice(0, 32),
      ok: Boolean(entry?.ok),
      message: entry?.message ? String(entry.message).slice(0, 300) : null,
      timestamp: new Date().toISOString()
    };
    this.items = [item, ...this.items].slice(0, this.limit);
    this.#save();
    return { ...item };
  }

  getAll() { return this.items.map(item => ({ ...item })); }
  clear() { this.items = []; this.#save(); return []; }
}

module.exports = { LaunchHistoryStore };
