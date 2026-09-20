'use strict';

const fs = require('fs');
const path = require('path');
const { normalizeChannel, validateChannel } = require('./channel-version-service');

const DEFAULTS = Object.freeze({
  channel: 'production',
  launchProfile: 'standard',
  autoBackup: true,
  backupRetention: 10,
  fastFlagsEnabled: false
});

const LAUNCH_PROFILES = Object.freeze({
  standard: Object.freeze({ id:'standard', name:'Standard', description:'Use your Studio settings and back up projects when Auto Backup is enabled.', backupMode:'setting' }),
  protected: Object.freeze({ id:'protected', name:'Protected', description:'Always create a project backup immediately before Studio launches it.', backupMode:'always' }),
  fast: Object.freeze({ id:'fast', name:'Fast Start', description:'Skip automatic project backup for the quickest launch path.', backupMode:'never' })
});

class StudioSettingsStore {
  constructor(userDataDir, fsImpl = fs) {
    this.fs = fsImpl;
    this.filePath = path.join(userDataDir, 'studio-center-settings.json');
    this.data = { ...DEFAULTS };
    this.#load();
  }

  #load() {
    try {
      if (!this.fs.existsSync(this.filePath)) return;
      const raw = JSON.parse(this.fs.readFileSync(this.filePath, 'utf8'));
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
      this.data = { ...this.data, ...this.#sanitize(raw) };
    } catch {
      this.data = { ...DEFAULTS };
    }
  }

  #sanitize(input) {
    const out = {};
    if (Object.hasOwn(input, 'channel')) {
      const valid = validateChannel(input.channel);
      if (valid.ok) out.channel = normalizeChannel(valid.channel);
    }
    if (Object.hasOwn(input, 'launchProfile') && Object.hasOwn(LAUNCH_PROFILES, input.launchProfile)) out.launchProfile = input.launchProfile;
    if (Object.hasOwn(input, 'autoBackup') && typeof input.autoBackup === 'boolean') out.autoBackup = input.autoBackup;
    if (Object.hasOwn(input, 'fastFlagsEnabled') && typeof input.fastFlagsEnabled === 'boolean') out.fastFlagsEnabled = input.fastFlagsEnabled;
    if (Object.hasOwn(input, 'backupRetention')) {
      const value = Number(input.backupRetention);
      if (Number.isInteger(value) && value >= 1 && value <= 50) out.backupRetention = value;
    }
    return out;
  }

  #save() {
    this.fs.mkdirSync(path.dirname(this.filePath), { recursive:true });
    const temp = `${this.filePath}.tmp`;
    this.fs.writeFileSync(temp, `${JSON.stringify(this.data, null, 2)}\n`, 'utf8');
    this.fs.renameSync(temp, this.filePath);
  }

  getAll() { return { ...this.data }; }
  getProfiles() { return Object.values(LAUNCH_PROFILES).map(item => ({ ...item })); }
  getProfile() { return { ...LAUNCH_PROFILES[this.data.launchProfile] }; }

  update(patch = {}) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return this.getAll();
    const clean = this.#sanitize(patch);
    this.data = { ...this.data, ...clean };
    this.#save();
    return this.getAll();
  }
}

module.exports = { StudioSettingsStore, DEFAULTS, LAUNCH_PROFILES };
