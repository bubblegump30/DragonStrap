'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ServiceRegistry } = require('../src/core/service-registry');
const { OperationCoordinator } = require('../src/core/operation-coordinator');
const { PluginHost } = require('../src/core/plugin-host');
const { RobloxStatusCache } = require('../src/core/roblox-status-cache');
const { AppKernel } = require('../src/core/app-kernel');
const { CORE_API_VERSION } = require('../src/core/api-contract');

test('ServiceRegistry exposes stable metadata and capability lookups', () => {
  const registry = new ServiceRegistry({ apiVersion:'2.0.0', now:() => 0 });
  const service = { ok:true };
  registry.register('test.service', service, { capabilities:['alpha','beta'], contractVersion:'2' });
  assert.equal(registry.get('test.service'), service);
  assert.deepEqual(registry.getByCapability('alpha'), [service]);
  registry.seal();
  const state = registry.describe();
  assert.equal(state.apiVersion, '2.0.0');
  assert.equal(state.count, 1);
  assert.equal(state.services[0].contractVersion, '2');
  assert.throws(() => registry.register('other.service', {}), /sealed/i);
});

test('OperationCoordinator prevents destructive pipeline collisions and releases after completion', async () => {
  const operations = new OperationCoordinator({ now:() => 1000 });
  const first = operations.acquire('roblox.install', { label:'Roblox install' });
  assert.equal(operations.getState().busy, true);
  const blocked = await operations.run('dragonstrap.update.download', { label:'Update download' }, async () => ({ ok:true }));
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, 'OPERATION_BUSY');
  first.release();
  const result = await operations.run('dragonstrap.update.download', { label:'Update download' }, async () => ({ ok:true, worked:true }));
  assert.equal(result.worked, true);
  assert.equal(operations.getState().busy, false);
});

test('PluginHost defines extension boundaries without enabling arbitrary third-party code', () => {
  const registry = new ServiceRegistry();
  registry.register('servers.test', {}, { capabilities:['servers.lookup'] });
  const plugins = new PluginHost({ registry });
  plugins.registerBuiltin({ id:'dragonstrap.test', extensionPoints:['server.enrichment'], serviceCapabilities:['servers.lookup'] });
  const state = plugins.describe();
  assert.equal(state.externalLoadingEnabled, false);
  assert.ok(state.extensionPoints.some(item => item.id === 'server.enrichment'));
  assert.equal(state.builtins[0].kind, 'builtin');
});

test('RobloxStatusCache coalesces repeated status reads and supports explicit invalidation', async () => {
  let calls = 0;
  const cache = new RobloxStatusCache({ async getStatus(){ calls += 1; return { installed:true, calls }; } }, { ttlMs:1000, now:() => 10 });
  const a = await cache.get();
  const b = await cache.get();
  assert.equal(a.calls, 1);
  assert.equal(b.calls, 1);
  assert.equal(calls, 1);
  cache.invalidate();
  const c = await cache.get();
  assert.equal(c.calls, 2);
});

test('AppKernel builds and seals the DragonStrap 2.0 dependency graph', () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'dragonstrap-kernel-'));
  try {
    const kernel = new AppKernel({ userData, currentVersion:'2.0.0', isPackaged:false, execPath:process.execPath, platform:process.platform, arch:process.arch }).initialize();
    const state = kernel.describe();
    assert.equal(state.apiVersion, CORE_API_VERSION);
    assert.equal(state.registry.sealed, true);
    assert.ok(state.registry.count >= 25);
    assert.equal(state.plugins.externalLoadingEnabled, false);
    assert.ok(kernel.get('core.bootstrap-pipeline'));
  } finally { fs.rmSync(userData, { recursive:true, force:true }); }
});
