'use strict';

const { spawn } = require('child_process');
const path = require('path');

class LaunchService {
  constructor(spawnImpl = spawn) {
    this.spawn = spawnImpl;
  }

  launchPlayer(status, options = {}) {
    if (!status?.playerPath) {
      return { ok: false, code: 'ROBLOX_NOT_FOUND', message: 'Roblox Player was not detected.' };
    }

    const args = [];
    if (options.uri) {
      if (typeof options.uri !== 'string' || !options.uri.startsWith('roblox://experiences/start?')) {
        return { ok: false, code: 'INVALID_LAUNCH_URI', message: 'DragonStrap refused an unsupported Roblox launch URI.' };
      }
      args.push(options.uri);
    } else {
      args.push('--app');
    }

    try {
      const child = this.spawn(status.playerPath, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: false
      });
      child.unref();
      return { ok: true, pid: child.pid || null };
    } catch (error) {
      return { ok: false, code: 'LAUNCH_FAILED', message: error.message };
    }
  }

  launchStudio(status, options = {}) {
    if (!status?.studioPath) {
      return { ok: false, code: 'STUDIO_NOT_FOUND', message: 'Roblox Studio was not detected.' };
    }

    const args = [];
    if (options.projectPath) {
      const projectPath = String(options.projectPath);
      const extension = path.extname(projectPath).toLowerCase();
      const isAbsolute = path.isAbsolute(projectPath) || path.win32.isAbsolute(projectPath);
      if (!isAbsolute || !['.rbxl', '.rbxlx'].includes(extension)) {
        return { ok: false, code: 'INVALID_STUDIO_PROJECT', message: 'DragonStrap refused an unsupported Studio project path.' };
      }
      args.push(projectPath);
    }

    try {
      const child = this.spawn(status.studioPath, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: false
      });
      child.unref();
      return { ok: true, pid: child.pid || null, projectPath: options.projectPath || null };
    } catch (error) {
      return { ok: false, code: 'LAUNCH_FAILED', message: error.message };
    }
  }
}

module.exports = { LaunchService };
