'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_EXTENSIONS = new Set(['.rbxl', '.rbxlx']);

class StudioService {
  constructor(options = {}) {
    this.fs = options.fs || fs;
    this.path = options.path || path;
  }

  validateProjectPath(filePath) {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      return { ok: false, code: 'PROJECT_REQUIRED', message: 'Choose a Roblox Studio project first.' };
    }

    const candidate = filePath.trim();
    const isAbsolute = this.path.isAbsolute(candidate) || this.path.win32.isAbsolute(candidate);
    if (!isAbsolute) {
      return { ok: false, code: 'INVALID_PROJECT_PATH', message: 'Studio project path must be absolute.' };
    }

    const extension = this.path.extname(candidate).toLowerCase();
    if (!PROJECT_EXTENSIONS.has(extension)) {
      return { ok: false, code: 'UNSUPPORTED_PROJECT', message: 'DragonStrap only opens .rbxl and .rbxlx Studio projects.' };
    }

    try {
      if (!this.fs.existsSync(candidate) || !this.fs.statSync(candidate).isFile()) {
        return { ok: false, code: 'PROJECT_NOT_FOUND', message: 'The selected Studio project no longer exists.' };
      }
    } catch (error) {
      return { ok: false, code: 'PROJECT_UNAVAILABLE', message: error.message };
    }

    return {
      ok: true,
      path: candidate,
      extension,
      name: this.path.basename(candidate)
    };
  }

  getLocations(status) {
    const studioPath = status?.studioPath || null;
    const robloxRoot = status?.robloxRoot || null;
    const installDir = studioPath ? this.path.dirname(studioPath) : null;
    const logsDir = robloxRoot ? this.path.join(robloxRoot, 'logs') : null;
    return {
      studioPath,
      installDir,
      logsDir,
      installDirExists: Boolean(installDir && this.fs.existsSync(installDir)),
      logsDirExists: Boolean(logsDir && this.fs.existsSync(logsDir))
    };
  }
}

module.exports = { StudioService, PROJECT_EXTENSIONS };
