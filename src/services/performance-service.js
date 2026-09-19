'use strict';

const fs = require('fs');
const path = require('path');

const MANAGED_FLAGS = Object.freeze({
  fps: 'DFIntTaskSchedulerTargetFps',
  msaa: 'FIntDebugForceMSAASamples',
  d3d11: 'FFlagDebugGraphicsPreferD3D11',
  vulkan: 'FFlagDebugGraphicsPreferVulkan'
});

const VALID_RENDER_MODES = new Set(['default', 'd3d11', 'vulkan']);
const VALID_MSAA = new Set(['default', '1', '2', '4']);

class PerformanceService {
  constructor(fsImpl = fs) { this.fs = fsImpl; }

  getClientSettingsPath(status) {
    if (!status?.playerPath) return null;
    return path.join(path.dirname(status.playerPath), 'ClientSettings', 'ClientAppSettings.json');
  }

  normalize(settings = {}) {
    const rawFps = Number(settings.fpsCap);
    const fpsCap = Number.isFinite(rawFps) ? Math.min(240, Math.max(0, Math.round(rawFps))) : 0;
    const renderMode = VALID_RENDER_MODES.has(settings.renderMode) ? settings.renderMode : 'default';
    const msaaMode = VALID_MSAA.has(String(settings.msaaMode)) ? String(settings.msaaMode) : 'default';
    return { fpsCap, renderMode, msaaMode };
  }

  getState(status) {
    const filePath = this.getClientSettingsPath(status);
    if (!filePath) return { ok: false, code: 'ROBLOX_NOT_FOUND', message: 'Roblox Player was not detected.' };
    try {
      const data = this.#read(filePath);
      return {
        ok: true,
        path: filePath,
        exists: this.fs.existsSync(filePath),
        managed: {
          fpsCap: data[MANAGED_FLAGS.fps] ?? null,
          msaaMode: data[MANAGED_FLAGS.msaa] ?? null,
          d3d11: data[MANAGED_FLAGS.d3d11] ?? null,
          vulkan: data[MANAGED_FLAGS.vulkan] ?? null
        }
      };
    } catch (error) {
      return { ok: false, code: 'INVALID_CLIENT_SETTINGS', message: error.message, path: filePath };
    }
  }

  apply(status, settings = {}) {
    const filePath = this.getClientSettingsPath(status);
    if (!filePath) return { ok: false, code: 'ROBLOX_NOT_FOUND', message: 'Roblox Player was not detected.' };
    const normalized = this.normalize(settings);
    try {
      const data = this.#read(filePath);
      if (normalized.fpsCap === 0) delete data[MANAGED_FLAGS.fps];
      else data[MANAGED_FLAGS.fps] = String(normalized.fpsCap);

      if (normalized.msaaMode === 'default') delete data[MANAGED_FLAGS.msaa];
      else data[MANAGED_FLAGS.msaa] = normalized.msaaMode;

      delete data[MANAGED_FLAGS.d3d11];
      delete data[MANAGED_FLAGS.vulkan];
      if (normalized.renderMode === 'd3d11') data[MANAGED_FLAGS.d3d11] = 'True';
      if (normalized.renderMode === 'vulkan') data[MANAGED_FLAGS.vulkan] = 'True';

      this.#write(filePath, data);
      return { ok: true, path: filePath, settings: normalized, managedFlags: this.#managedSnapshot(data) };
    } catch (error) {
      return { ok: false, code: 'PERFORMANCE_APPLY_FAILED', message: error.message, path: filePath };
    }
  }

  restore(status) {
    const filePath = this.getClientSettingsPath(status);
    if (!filePath) return { ok: false, code: 'ROBLOX_NOT_FOUND', message: 'Roblox Player was not detected.' };
    try {
      if (!this.fs.existsSync(filePath)) return { ok: true, path: filePath, restored: false, managedFlags: {} };
      const data = this.#read(filePath);
      for (const key of Object.values(MANAGED_FLAGS)) delete data[key];
      if (Object.keys(data).length === 0) this.fs.rmSync(filePath, { force: true });
      else this.#write(filePath, data);
      return { ok: true, path: filePath, restored: true, managedFlags: {} };
    } catch (error) {
      return { ok: false, code: 'PERFORMANCE_RESTORE_FAILED', message: error.message, path: filePath };
    }
  }

  #read(filePath) {
    if (!this.fs.existsSync(filePath)) return {};
    const text = this.fs.readFileSync(filePath, 'utf8').trim();
    if (!text) return {};
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('ClientAppSettings.json must contain a JSON object.');
    }
    return { ...parsed };
  }

  #write(filePath, data) {
    this.fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temp = `${filePath}.dragonstrap.tmp`;
    this.fs.writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    this.fs.renameSync(temp, filePath);
  }

  #managedSnapshot(data) {
    const output = {};
    for (const key of Object.values(MANAGED_FLAGS)) if (Object.hasOwn(data, key)) output[key] = data[key];
    return output;
  }
}

module.exports = { PerformanceService, MANAGED_FLAGS };
