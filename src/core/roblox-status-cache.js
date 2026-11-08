'use strict';

class RobloxStatusCache {
  constructor(service, { ttlMs = 900, now = () => Date.now() } = {}) {
    if (!service || typeof service.getStatus !== 'function') throw new TypeError('RobloxStatusCache requires RobloxInstallationService.');
    this.service = service;
    this.ttlMs = Math.max(0, Number(ttlMs) || 0);
    this.now = now;
    this.value = null;
    this.expiresAt = 0;
    this.pending = null;
    this.generation = 0;
  }

  invalidate() { this.value = null; this.expiresAt = 0; this.pending = null; this.generation++; }

  async get({ fresh = false } = {}) {
    const current = this.now();
    if (!fresh && this.value && current < this.expiresAt) return { ...this.value };
    if (!fresh && this.pending) return { ...(await this.pending) };
    const generation = ++this.generation;
    const request = Promise.resolve().then(() => this.service.getStatus()).then(value => {
      const result = value && typeof value === 'object' ? { ...value } : value;
      if (generation === this.generation) {
        this.value = result;
        this.expiresAt = this.now() + this.ttlMs;
      }
      return result;
    }).finally(() => { if (this.pending === request) this.pending = null; });
    this.pending = request;
    return { ...(await request) };
  }
}

module.exports = { RobloxStatusCache };
