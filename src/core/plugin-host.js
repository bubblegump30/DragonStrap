'use strict';

const PLUGIN_API_VERSION = '2.0.0';
const EXTENSION_POINTS = Object.freeze([
  Object.freeze({ id:'launch.adapter', version:'1', description:'Future launch-target adapters behind validated DragonStrap launch contracts.' }),
  Object.freeze({ id:'server.enrichment', version:'1', description:'Future public-server enrichment providers without credential access.' }),
  Object.freeze({ id:'diagnostics.contributor', version:'1', description:'Future privacy-reviewed diagnostic contributors.' }),
  Object.freeze({ id:'profile.section', version:'1', description:'Future profile-owned configuration sections using schema validation.' })
]);

class PluginHost {
  constructor({ registry, apiVersion = PLUGIN_API_VERSION } = {}) {
    if (!registry) throw new TypeError('PluginHost requires a service registry.');
    this.registry = registry;
    this.apiVersion = String(apiVersion);
    this.manifests = new Map();
  }

  registerBuiltin(manifest) {
    if (!manifest || typeof manifest !== 'object') throw new TypeError('Plugin manifest must be an object.');
    const id = String(manifest.id || '').trim();
    if (!/^[a-z][a-z0-9.-]{2,79}$/.test(id)) throw new TypeError('Invalid plugin id.');
    if (this.manifests.has(id)) throw new Error(`Plugin manifest already registered: ${id}`);
    const extensionPoints = [...new Set((Array.isArray(manifest.extensionPoints) ? manifest.extensionPoints : []).map(String))];
    const known = new Set(EXTENSION_POINTS.map(item => item.id));
    if (extensionPoints.some(point => !known.has(point))) throw new Error(`Unknown extension point in ${id}.`);
    const serviceCapabilities = [...new Set((Array.isArray(manifest.serviceCapabilities) ? manifest.serviceCapabilities : []).map(String))];
    const normalized = Object.freeze({
      id,
      name:String(manifest.name || id),
      version:String(manifest.version || '1.0.0'),
      kind:'builtin',
      extensionPoints:Object.freeze(extensionPoints),
      serviceCapabilities:Object.freeze(serviceCapabilities)
    });
    this.manifests.set(id, normalized);
    return normalized;
  }

  createCapabilityView(capability) {
    return Object.freeze(this.registry.getByCapability(capability).slice());
  }

  describe() {
    return {
      apiVersion:this.apiVersion,
      externalLoadingEnabled:false,
      externalLoadingReason:'DragonStrap 2.0 defines stable extension boundaries but does not execute third-party plugin code yet.',
      extensionPoints:EXTENSION_POINTS.map(item => ({ ...item })),
      builtins:[...this.manifests.values()].map(item => ({ ...item, extensionPoints:[...item.extensionPoints], serviceCapabilities:[...item.serviceCapabilities] }))
    };
  }
}

module.exports = { PluginHost, PLUGIN_API_VERSION, EXTENSION_POINTS };
