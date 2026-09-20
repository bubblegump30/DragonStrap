'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { BootstrapPipeline } = require('../src/core/bootstrap-pipeline');
const { OperationCoordinator } = require('../src/core/operation-coordinator');

function fixture() {
  let invalidated = 0;
  const statusCache = {
    async get(){ return { playerPath:'C:/Roblox/version/RobloxPlayerBeta.exe', version:'version-test' }; },
    invalidate(){ invalidated += 1; }
  };
  const settingsStore = { getAll(){ return { channel:'production' }; } };
  const robloxUpdateEngine = {
    getState(){ return { active:false }; },
    async createPlan(status, channel){ return { ok:true, status, channel }; },
    async install(){ return { ok:true, versionGuid:'version-new' }; },
    async rollback(){ return { ok:true, toVersion:'version-old' }; }
  };
  const selfUpdateService = { getState(){ return { supported:true }; }, async download(){ return { ok:true, staged:true }; }, async apply(){ return { ok:true, quitRequired:true }; } };
  const updateService = { lastResult:{ ok:true, updateAvailable:true, latestVersion:'2.0.1' } };
  const operations = new OperationCoordinator();
  const pipeline = new BootstrapPipeline({ statusCache, settingsStore, robloxUpdateEngine, selfUpdateService, updateService, operationCoordinator:operations });
  return { pipeline, operations, getInvalidated:() => invalidated };
}

test('BootstrapPipeline centralizes Player planning, installation and status invalidation', async () => {
  const f = fixture();
  const plan = await f.pipeline.planPlayer();
  assert.equal(plan.channel, 'production');
  const result = await f.pipeline.installPlayer();
  assert.equal(result.ok, true);
  assert.equal(f.getInvalidated(), 1);
});

test('BootstrapPipeline blocks launch readiness while a destructive core operation is active', async () => {
  const f = fixture();
  const lease = f.operations.acquire('recovery.safe-repair', { label:'Safe Repair' });
  const result = await f.pipeline.assertLaunchReady();
  assert.equal(result.ok, false);
  assert.equal(result.code, 'CORE_BUSY');
  lease.release();
  assert.equal((await f.pipeline.assertLaunchReady()).ok, true);
});

test('BootstrapPipeline serializes DragonStrap self-update operations', async () => {
  const f = fixture();
  const download = await f.pipeline.downloadSelfUpdate();
  assert.equal(download.ok, true);
  const apply = await f.pipeline.applySelfUpdate();
  assert.equal(apply.quitRequired, true);
});
