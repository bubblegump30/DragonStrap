'use strict';

class BootstrapPipeline {
  constructor({ statusCache, settingsStore, robloxUpdateEngine, selfUpdateService, updateService, operationCoordinator } = {}) {
    if (!statusCache || !settingsStore || !robloxUpdateEngine || !selfUpdateService || !updateService || !operationCoordinator) throw new TypeError('BootstrapPipeline requires all core dependencies.');
    this.statusCache = statusCache;
    this.settingsStore = settingsStore;
    this.robloxUpdateEngine = robloxUpdateEngine;
    this.selfUpdateService = selfUpdateService;
    this.updateService = updateService;
    this.operations = operationCoordinator;
  }

  async getState() {
    const status = await this.statusCache.get();
    return {
      ok:true,
      operations:this.operations.getState(),
      player:{ installed:Boolean(status?.playerPath), version:status?.version || null, install:this.robloxUpdateEngine.getState() },
      selfUpdate:this.selfUpdateService.getState(this.updateService.lastResult || null)
    };
  }

  async planPlayer() {
    const status = await this.statusCache.get({ fresh:true });
    return this.robloxUpdateEngine.createPlan(status, this.settingsStore.getAll().channel);
  }

  async installPlayer() {
    return this.operations.run('roblox.install', { label:'Roblox Player installation' }, async () => {
      const status = await this.statusCache.get({ fresh:true });
      const channel = this.settingsStore.getAll().channel;
      const result = await this.robloxUpdateEngine.install(status, channel);
      this.statusCache.invalidate();
      return result;
    });
  }

  async rollbackPlayer() {
    return this.operations.run('roblox.rollback', { label:'Roblox Player rollback' }, async () => {
      const status = await this.statusCache.get({ fresh:true });
      const result = await this.robloxUpdateEngine.rollback(status);
      this.statusCache.invalidate();
      return result;
    });
  }

  async downloadSelfUpdate() {
    return this.operations.run('dragonstrap.update.download', { label:'DragonStrap update download' }, async () => this.selfUpdateService.download(this.updateService.lastResult));
  }

  async applySelfUpdate() {
    return this.operations.run('dragonstrap.update.apply', { label:'DragonStrap update apply' }, async () => this.selfUpdateService.apply(this.updateService.lastResult));
  }

  async assertLaunchReady() {
    const operation = this.operations.getState();
    if (operation.busy) return { ok:false, code:'CORE_BUSY', message:`DragonStrap is busy with ${operation.active.label}.`, operation:operation.active };
    const status = await this.statusCache.get();
    if (!status?.playerPath) return { ok:false, code:'PLAYER_NOT_INSTALLED', message:'Roblox Player is not installed or could not be detected.', status };
    return { ok:true, status };
  }
}

module.exports = { BootstrapPipeline };
