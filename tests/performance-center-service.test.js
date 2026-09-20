'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { PerformanceCenterService, bytesToGiB } = require('../src/services/performance-center-service');

function mockOs({ ramGb=16, freeGb=8, logical=8 } = {}) {
  return {
    cpus:() => Array.from({ length:logical }, () => ({ model:'Test CPU' })),
    totalmem:() => ramGb * 1024 ** 3,
    freemem:() => freeGb * 1024 ** 3,
    arch:() => 'x64'
  };
}

test('PerformanceCenterService creates a conservative hardware-aware high-refresh recommendation', () => {
  const service = new PerformanceCenterService({
    platform:'win32',
    osImpl:mockOs({ ramGb:32, freeGb:20, logical:16 }),
    systemProbe:() => ({
      cpus:[{ Name:'Ryzen Test', NumberOfCores:8, NumberOfLogicalProcessors:16 }],
      gpus:[{ Name:'Test GPU', AdapterRAM:8 * 1024 ** 3, CurrentRefreshRate:165 }],
      powerPlan:'Power Scheme GUID: abc (Balanced)'
    }),
    processProbe:() => [],
    now:() => Date.parse('2026-09-20T00:00:00Z')
  });
  const hardware = service.getHardware();
  const recommendation = service.recommend(hardware);
  assert.equal(hardware.tier, 'enthusiast');
  assert.equal(hardware.refreshRateHz, 165);
  assert.equal(recommendation.settings.fpsCap, 180);
  assert.equal(recommendation.settings.renderMode, 'default');
  assert.equal(recommendation.settings.msaaMode, '4');
  const presets = service.buildHardwarePresets(hardware, recommendation);
  assert.deepEqual(presets.map(item => item.id), ['efficiency','recommended','high-refresh','visual-quality']);
  assert.equal(presets.find(item => item.recommended).settings.fpsCap, 180);
});

test('PerformanceCenterService scales entry hardware down and warns on aggressive current settings', () => {
  const service = new PerformanceCenterService({
    platform:'win32',
    osImpl:mockOs({ ramGb:6, freeGb:1, logical:4 }),
    systemProbe:() => ({ gpus:[{ Name:'Integrated Test GPU', AdapterRAM:1024 ** 3, CurrentRefreshRate:60 }], cpus:[], powerPlan:'Power Saver' }),
    processProbe:() => []
  });
  const state = service.getState({ playerPath:'C:/Roblox/RobloxPlayerBeta.exe' }, { fpsCap:240, renderMode:'vulkan', msaaMode:'4', performanceAutoApply:false });
  assert.equal(state.recommendation.settings.fpsCap, 60);
  assert.equal(state.recommendation.settings.msaaMode, '1');
  assert.ok(state.checks.some(item => item.id === 'memory' && item.status === 'warn'));
  assert.ok(state.checks.some(item => item.id === 'power-plan' && item.status === 'warn'));
  assert.ok(state.recommendations.some(item => item.title.includes('FPS target')));
  assert.ok(state.recommendations.some(item => item.title.includes('Vulkan')));
});

test('PerformanceCenterService reports live Roblox process data without command-line contents', () => {
  const now = Date.parse('2026-09-20T00:10:00Z');
  const service = new PerformanceCenterService({
    platform:'win32',
    osImpl:mockOs(),
    systemProbe:() => ({}),
    processProbe:() => [{ Id:4242, CPU:12.34, WorkingSet64:512 * 1024 ** 2, StartTime:'2026-09-20T00:00:00.000Z', Responding:true, ThreadCount:44 }],
    now:() => now
  });
  const info = service.getProcessInfo();
  assert.equal(info.running, true);
  assert.equal(info.processes[0].pid, 4242);
  assert.equal(info.processes[0].uptimeSeconds, 600);
  assert.equal(info.processes[0].workingSetBytes, 512 * 1024 ** 2);
  assert.equal(Object.hasOwn(info.processes[0], 'commandLine'), false);
});

test('PerformanceCenterService caches hardware probes for one minute', () => {
  let probes = 0;
  let now = 1000;
  const service = new PerformanceCenterService({
    platform:'win32', osImpl:mockOs(), now:() => now,
    systemProbe:() => { probes += 1; return {}; }, processProbe:() => []
  });
  service.getHardware();
  service.getHardware();
  assert.equal(probes, 1);
  now += 61000;
  service.getHardware();
  assert.equal(probes, 2);
});

test('bytesToGiB returns a one-decimal GiB value', () => {
  assert.equal(bytesToGiB(16 * 1024 ** 3), 16);
  assert.equal(bytesToGiB(1536 * 1024 ** 2), 1.5);
});
