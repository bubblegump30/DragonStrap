'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

class RobloxInstallationService {
  constructor(env = process.env) {
    this.localAppData = env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    this.robloxRoot = path.join(this.localAppData, 'Roblox');
    this.versionsRoot = path.join(this.robloxRoot, 'Versions');
  }

  async getStatus() {
    const candidates = this.#getVersionCandidates();
    const player = candidates.find(item => item.playerPath);
    const studio = candidates.find(item => item.studioPath);

    return {
      installed: Boolean(player),
      studioInstalled: Boolean(studio),
      version: player?.version || 'Not detected',
      studioVersion: studio?.version || 'Not detected',
      playerPath: player?.playerPath || null,
      studioPath: studio?.studioPath || null,
      robloxRoot: this.robloxRoot,
      channel: 'LIVE',
      lastScannedAt: new Date().toISOString()
    };
  }

  #getVersionCandidates() {
    if (!fs.existsSync(this.versionsRoot)) return [];

    return fs.readdirSync(this.versionsRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && entry.name.startsWith('version-'))
      .map(entry => {
        const dir = path.join(this.versionsRoot, entry.name);
        const playerPath = path.join(dir, 'RobloxPlayerBeta.exe');
        const studioPath = path.join(dir, 'RobloxStudioBeta.exe');
        let modified = 0;
        try { modified = fs.statSync(dir).mtimeMs; } catch { /* ignore inaccessible entry */ }
        return {
          version: entry.name,
          modified,
          playerPath: fs.existsSync(playerPath) ? playerPath : null,
          studioPath: fs.existsSync(studioPath) ? studioPath : null
        };
      })
      .sort((a, b) => b.modified - a.modified);
  }
}

module.exports = { RobloxInstallationService };
