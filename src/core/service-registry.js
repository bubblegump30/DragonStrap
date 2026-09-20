'use strict';

class ServiceRegistry {
  constructor({ apiVersion = '2.0.0', now = () => Date.now() } = {}) {
    this.apiVersion = String(apiVersion);
    this.now = now;
    this.createdAt = new Date(this.now()).toISOString();
    this.services = new Map();
    this.sealed = false;
  }

  register(name, service, metadata = {}) {
    const key = String(name || '').trim();
    if (!/^[a-z][a-z0-9.-]{1,63}$/.test(key)) throw new TypeError(`Invalid service name: ${key || '<empty>'}`);
    if (!service || (typeof service !== 'object' && typeof service !== 'function')) throw new TypeError(`Service ${key} must be an object or function.`);
    if (this.sealed) throw new Error('Service registry is sealed.');
    if (this.services.has(key)) throw new Error(`Service already registered: ${key}`);
    const capabilities = [...new Set((Array.isArray(metadata.capabilities) ? metadata.capabilities : []).map(value => String(value).trim()).filter(Boolean))].sort();
    this.services.set(key, {
      name:key,
      service,
      metadata:Object.freeze({
        stability:String(metadata.stability || 'stable'),
        contractVersion:String(metadata.contractVersion || '1'),
        capabilities:Object.freeze(capabilities)
      })
    });
    return service;
  }

  get(name) {
    const entry = this.services.get(String(name));
    if (!entry) throw new Error(`Unknown DragonStrap service: ${name}`);
    return entry.service;
  }

  has(name) { return this.services.has(String(name)); }

  getByCapability(capability) {
    const target = String(capability || '').trim();
    if (!target) return [];
    return [...this.services.values()].filter(entry => entry.metadata.capabilities.includes(target)).map(entry => entry.service);
  }

  seal() { this.sealed = true; return this; }

  describe() {
    return {
      apiVersion:this.apiVersion,
      createdAt:this.createdAt,
      sealed:this.sealed,
      count:this.services.size,
      services:[...this.services.values()].map(entry => ({ name:entry.name, ...entry.metadata }))
    };
  }
}

module.exports = { ServiceRegistry };
