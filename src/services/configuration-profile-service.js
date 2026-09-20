'use strict';

class ConfigurationProfileService {
  constructor(options = {}) {
    this.store = options.store;
    this.settingsStore = options.settingsStore;
    this.fastFlagService = options.fastFlagService;
    this.performanceService = options.performanceService;
  }

  getState() { return this.store.getState(); }

  captureCurrent(status) {
    const fastFlags = this.fastFlagService.getEditableObject(status);
    if (!fastFlags.ok) return { ok:false, code:fastFlags.code, message:`Complete profile capture requires readable Player FastFlags. ${fastFlags.message || ''}`.trim() };
    const settings = this.settingsStore.getAll();
    return {
      ok:true,
      configuration:{
        performance:{
          fpsCap:settings.fpsCap,
          renderMode:settings.renderMode,
          msaaMode:settings.msaaMode,
          launchProfile:settings.launchProfile,
          performanceAutoApply:settings.performanceAutoApply
        },
        fastFlags:fastFlags.data,
        channel:settings.channel,
        launch:{ minimizeOnLaunch:settings.minimizeOnLaunch },
        servers:{
          sort:settings.serverSort,
          occupancy:settings.serverOccupancy,
          favoritesOnly:settings.serverFavoritesOnly,
          hideFull:settings.serverHideFull
        }
      }
    };
  }

  saveCurrent(status, name) {
    const captured = this.captureCurrent(status);
    if (!captured.ok) return captured;
    return this.store.saveProfile(name, captured.configuration);
  }

  clone(id, name) { return this.store.cloneProfile(id, name); }
  delete(id) { return this.store.deleteProfile(id); }

  previewApply(status, id) {
    const profile = this.store.get(id);
    if (!profile) return { ok:false, code:'PROFILE_NOT_FOUND', message:'The selected configuration profile no longer exists.' };
    const editable = this.fastFlagService.getEditableObject(status);
    if (!editable.ok) return editable;
    const target = profile.configuration.fastFlags || {};
    const set = Object.entries(target).map(([key, value]) => ({ key, value, type:'auto' }));
    const remove = Object.keys(editable.data).filter(key => !Object.hasOwn(target, key));
    const fastFlagPreview = this.fastFlagService.previewPatch(status, { set, remove });
    if (!fastFlagPreview.ok) return fastFlagPreview;
    const settings = this.settingsStore.getAll();
    const cfg = profile.configuration;
    const settingsChanges = [];
    const desired = {
      launchProfile:cfg.performance.launchProfile,
      fpsCap:cfg.performance.fpsCap,
      renderMode:cfg.performance.renderMode,
      msaaMode:cfg.performance.msaaMode,
      performanceAutoApply:cfg.performance.performanceAutoApply,
      channel:cfg.channel,
      minimizeOnLaunch:cfg.launch.minimizeOnLaunch,
      serverSort:cfg.servers.sort,
      serverOccupancy:cfg.servers.occupancy,
      serverFavoritesOnly:cfg.servers.favoritesOnly,
      serverHideFull:cfg.servers.hideFull
    };
    for (const [key, after] of Object.entries(desired)) if (settings[key] !== after) settingsChanges.push({ key, before:settings[key], after });
    return { ok:true, profile, settingsChanges, fastFlags:fastFlagPreview, destructiveFlagRemovals:fastFlagPreview.removeCount || 0 };
  }

  apply(status, id) {
    const preview = this.previewApply(status, id);
    if (!preview.ok) return preview;
    const cfg = preview.profile.configuration;
    const beforeSettings = this.settingsStore.getAll();
    const beforeFlagsResult = this.fastFlagService.getEditableObject(status);
    if (!beforeFlagsResult.ok) return beforeFlagsResult;
    const settingsPatch = {
      launchProfile:cfg.performance.launchProfile,
      fpsCap:cfg.performance.fpsCap,
      renderMode:cfg.performance.renderMode,
      msaaMode:cfg.performance.msaaMode,
      performanceAutoApply:cfg.performance.performanceAutoApply,
      channel:cfg.channel,
      minimizeOnLaunch:cfg.launch.minimizeOnLaunch,
      serverSort:cfg.servers.sort,
      serverOccupancy:cfg.servers.occupancy,
      serverFavoritesOnly:cfg.servers.favoritesOnly,
      serverHideFull:cfg.servers.hideFull
    };
    try {
      const settings = this.settingsStore.update(settingsPatch);
      const ff = this.fastFlagService.applyPatch(status, {
        set:Object.entries(cfg.fastFlags || {}).map(([key,value]) => ({ key, value, type:'auto' })),
        remove:Object.keys(beforeFlagsResult.data).filter(key => !Object.hasOwn(cfg.fastFlags || {}, key))
      });
      if (!ff.ok) throw Object.assign(new Error(ff.message || 'FastFlag profile apply failed.'), { result:ff });
      const performance = this.performanceService.apply(status, settings);
      if (!performance.ok) throw Object.assign(new Error(performance.message || 'Performance+ profile apply failed.'), { result:performance });
      this.store.setActive(id);
      return { ok:true, profile:this.store.get(id), settings:this.settingsStore.getAll(), fastFlags:ff, performance, settingsChanges:preview.settingsChanges };
    } catch (error) {
      this.settingsStore.update({
        launchProfile:beforeSettings.launchProfile,
        fpsCap:beforeSettings.fpsCap,
        renderMode:beforeSettings.renderMode,
        msaaMode:beforeSettings.msaaMode,
        performanceAutoApply:beforeSettings.performanceAutoApply,
        channel:beforeSettings.channel,
        minimizeOnLaunch:beforeSettings.minimizeOnLaunch,
        serverSort:beforeSettings.serverSort,
        serverOccupancy:beforeSettings.serverOccupancy,
        serverFavoritesOnly:beforeSettings.serverFavoritesOnly,
        serverHideFull:beforeSettings.serverHideFull
      });
      const currentFlags = this.fastFlagService.getEditableObject(status);
      if (currentFlags.ok) {
        this.fastFlagService.applyPatch(status, {
          set:Object.entries(beforeFlagsResult.data).map(([key,value]) => ({key,value,type:'auto'})),
          remove:Object.keys(currentFlags.data).filter(key => !Object.hasOwn(beforeFlagsResult.data,key))
        });
      }
      this.performanceService.apply(status, beforeSettings);
      return { ok:false, code:error.result?.code || 'PROFILE_APPLY_FAILED', message:error.message };
    }
  }
}

module.exports = { ConfigurationProfileService };
