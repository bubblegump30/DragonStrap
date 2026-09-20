'use strict';

const fs = require('fs');
const path = require('path');
const { SettingsStore } = require('../services/settings-store');
const { RobloxInstallationService } = require('../services/roblox-installation');
const { LaunchService } = require('../services/launch-service');
const { LaunchTargetService } = require('../services/launch-target-service');
const { LaunchHistoryStore } = require('../services/launch-history-store');
const { PerformanceService } = require('../services/performance-service');
const { PerformanceProfileStore } = require('../services/performance-profile-store');
const { PerformanceCenterService } = require('../services/performance-center-service');
const { ConfigurationProfileStore } = require('../services/configuration-profile-store');
const { ConfigurationProfileService } = require('../services/configuration-profile-service');
const { FastFlagService } = require('../services/fastflag-service');
const { FastFlagPresetStore } = require('../services/fastflag-preset-store');
const { FastFlagSnapshotStore } = require('../services/fastflag-snapshot-store');
const { ServerIntelligenceService } = require('../services/server-intelligence-service');
const { ServerIntelligenceStore } = require('../services/server-intelligence-store');
const { StudioService } = require('../services/studio-service');
const { StudioProjectHistoryStore } = require('../services/studio-project-history-store');
const { StudioSettingsStore } = require('../services/studio-settings-store');
const { StudioBackupService } = require('../services/studio-backup-service');
const { StudioFastFlagService } = require('../services/studio-fastflag-service');
const { ChannelVersionService } = require('../services/channel-version-service');
const { MaintenanceService } = require('../services/maintenance-service');
const { UpdateService } = require('../services/update-service');
const { SelfUpdateService } = require('../services/self-update-service');
const { ReliabilityService } = require('../services/reliability-service');
const { RobloxUpdateEngine } = require('../services/roblox-update-engine');
const { RecoveryService } = require('../services/recovery-service');
const { ServiceRegistry } = require('./service-registry');
const { OperationCoordinator } = require('./operation-coordinator');
const { PluginHost } = require('./plugin-host');
const { RobloxStatusCache } = require('./roblox-status-cache');
const { BootstrapPipeline } = require('./bootstrap-pipeline');
const { CORE_API_VERSION } = require('./api-contract');

class AppKernel {
  constructor({ userData, currentVersion, isPackaged, execPath, env = process.env, platform = process.platform, arch = process.arch } = {}) {
    if (!userData) throw new TypeError('AppKernel requires userData.');
    this.userData = userData;
    this.currentVersion = String(currentVersion || '0.0.0');
    this.runtime = { isPackaged:Boolean(isPackaged), execPath, env, platform, arch };
    this.registry = new ServiceRegistry({ apiVersion:CORE_API_VERSION });
    this.operations = new OperationCoordinator();
    this.plugins = new PluginHost({ registry:this.registry, apiVersion:CORE_API_VERSION });
    this.initialized = false;
  }

  register(name, service, capabilities = [], metadata = {}) {
    return this.registry.register(name, service, { capabilities, ...metadata });
  }

  initialize() {
    if (this.initialized) return this;
    const userData = this.userData;
    const settingsStore = this.register('settings.store', new SettingsStore(userData), ['settings.read','settings.write']);
    const robloxService = this.register('roblox.installation', new RobloxInstallationService(), ['roblox.status']);
    const statusCache = this.register('roblox.status-cache', new RobloxStatusCache(robloxService), ['roblox.status.cached'], { contractVersion:'2' });
    const launchService = this.register('launch.service', new LaunchService(), ['launch.player','launch.studio']);
    const launchTargetService = this.register('launch.target', new LaunchTargetService(), ['launch.normalize']);
    const launchHistoryStore = this.register('launch.history', new LaunchHistoryStore(userData), ['launch.history']);
    const performanceService = this.register('performance.settings', new PerformanceService(), ['performance.apply']);
    const performanceProfileStore = this.register('performance.profiles', new PerformanceProfileStore(userData), ['performance.profiles']);
    const performanceCenterService = this.register('performance.center', new PerformanceCenterService({ performanceService, profileStore:performanceProfileStore }), ['performance.intelligence']);
    const fastFlagSnapshotStore = this.register('fastflags.snapshots', new FastFlagSnapshotStore(userData), ['fastflags.snapshots']);
    const fastFlagService = this.register('fastflags.player', new FastFlagService(fs, { snapshotStore:fastFlagSnapshotStore }), ['fastflags.read','fastflags.write']);
    const fastFlagPresetStore = this.register('fastflags.presets', new FastFlagPresetStore(userData), ['fastflags.presets']);
    const configurationProfileStore = this.register('configuration.profiles.store', new ConfigurationProfileStore(userData), ['profiles.store']);
    const configurationProfileService = this.register('configuration.profiles', new ConfigurationProfileService({ store:configurationProfileStore, settingsStore, fastFlagService, performanceService }), ['profiles.capture','profiles.apply']);
    const serverIntelligenceStore = this.register('servers.store', new ServerIntelligenceStore(userData), ['servers.persistence']);
    const serverIntelligenceService = this.register('servers.intelligence', new ServerIntelligenceService({ version:this.currentVersion, store:serverIntelligenceStore }), ['servers.lookup','servers.enrichment']);
    const studioService = this.register('studio.service', new StudioService(), ['studio.launch','studio.projects']);
    const studioProjectHistoryStore = this.register('studio.history', new StudioProjectHistoryStore(userData), ['studio.history']);
    const studioSettingsStore = this.register('studio.settings', new StudioSettingsStore(userData), ['studio.settings']);
    const studioBackupService = this.register('studio.backups', new StudioBackupService(userData), ['studio.backups']);
    const studioFastFlagService = this.register('studio.fastflags', new StudioFastFlagService(userData), ['studio.fastflags']);
    const channelVersionService = this.register('roblox.channels', new ChannelVersionService(), ['roblox.channels']);
    const robloxUpdateEngine = this.register('roblox.update-engine', new RobloxUpdateEngine({ userData, channelService:channelVersionService }), ['roblox.install','roblox.rollback'], { contractVersion:'2' });
    const maintenanceService = this.register('maintenance.service', new MaintenanceService({ userData }), ['maintenance.inspect','maintenance.clean']);
    const recoveryService = this.register('recovery.service', new RecoveryService({ userData }), ['recovery.inspect','recovery.restore'], { contractVersion:'2' });
    const updateService = this.register('updates.release-feed', new UpdateService({ currentVersion:this.currentVersion, configPath:path.join(__dirname,'..','..','release.config.json') }), ['updates.check']);
    const selfUpdateService = this.register('updates.self', new SelfUpdateService({
      userData,
      currentVersion:this.currentVersion,
      repository:updateService.loadConfig().repository,
      isPackaged:this.runtime.isPackaged,
      execPath:this.runtime.execPath,
      env:this.runtime.env,
      platform:this.runtime.platform,
      arch:this.runtime.arch
    }), ['updates.download','updates.apply'], { contractVersion:'2' });
    const reliabilityService = this.register('reliability.service', new ReliabilityService(userData, { version:this.currentVersion }), ['reliability.log']);
    this.register('core.operations', this.operations, ['core.operations'], { contractVersion:'2' });
    const pipeline = this.register('core.bootstrap-pipeline', new BootstrapPipeline({ statusCache, settingsStore, robloxUpdateEngine, selfUpdateService, updateService, operationCoordinator:this.operations }), ['core.bootstrap','core.updates'], { contractVersion:'2' });

    this.plugins.registerBuiltin({ id:'dragonstrap.launch-core', name:'DragonStrap Launch Core', version:this.currentVersion, extensionPoints:['launch.adapter'], serviceCapabilities:['launch.normalize','launch.player'] });
    this.plugins.registerBuiltin({ id:'dragonstrap.server-core', name:'DragonStrap Server Intelligence', version:this.currentVersion, extensionPoints:['server.enrichment'], serviceCapabilities:['servers.lookup','servers.enrichment'] });
    this.plugins.registerBuiltin({ id:'dragonstrap.recovery-core', name:'DragonStrap Recovery Diagnostics', version:this.currentVersion, extensionPoints:['diagnostics.contributor'], serviceCapabilities:['recovery.inspect','maintenance.inspect'] });
    this.plugins.registerBuiltin({ id:'dragonstrap.profile-core', name:'DragonStrap Profile Core', version:this.currentVersion, extensionPoints:['profile.section'], serviceCapabilities:['profiles.capture','profiles.apply'] });

    this.registry.seal();
    this.initialized = true;
    return this;
  }

  get(name) { return this.registry.get(name); }

  describe() {
    return {
      apiVersion:CORE_API_VERSION,
      version:this.currentVersion,
      registry:this.registry.describe(),
      operations:this.operations.getState(),
      plugins:this.plugins.describe()
    };
  }
}

module.exports = { AppKernel };
