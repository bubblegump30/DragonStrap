'use strict';

const os = require('os');
const { spawnSync } = require('child_process');

function bytesToGiB(bytes) {
  return Math.round((Number(bytes || 0) / (1024 ** 3)) * 10) / 10;
}

function normalizeProbeJson(text) {
  const source = String(text || '').trim();
  if (!source) return null;
  try { return JSON.parse(source); } catch { return null; }
}

function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

class PerformanceCenterService {
  constructor(options = {}) {
    this.os = options.osImpl || os;
    this.spawnSync = options.spawnSyncImpl || spawnSync;
    this.platform = options.platform || process.platform;
    this.now = options.now || (() => Date.now());
    this.performanceService = options.performanceService || null;
    this.profileStore = options.profileStore || null;
    this.systemProbe = options.systemProbe || (() => this.#probeWindowsSystem());
    this.processProbe = options.processProbe || (() => this.#probeWindowsProcesses());
    this.hardwareCache = null;
    this.hardwareCacheAt = 0;
  }

  #runPowerShell(script, timeout = 3500) {
    if (this.platform !== 'win32') return null;
    const result = this.spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      encoding:'utf8',
      timeout,
      windowsHide:true,
      maxBuffer:1024 * 1024
    });
    if (result?.error || result?.status !== 0) return null;
    return normalizeProbeJson(result.stdout);
  }

  #probeWindowsSystem() {
    const script = [
      "$g=@(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Select-Object Name,AdapterRAM,DriverVersion,CurrentRefreshRate)",
      "$c=@(Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed)",
      "$p=(powercfg /getactivescheme 2>$null | Out-String).Trim()",
      "[pscustomobject]@{gpus=$g;cpus=$c;powerPlan=$p}|ConvertTo-Json -Depth 5 -Compress"
    ].join(';');
    return this.#runPowerShell(script) || { gpus:[], cpus:[], powerPlan:'' };
  }

  #probeWindowsProcesses() {
    const script = [
      "$p=@(Get-Process -Name RobloxPlayerBeta -ErrorAction SilentlyContinue | ForEach-Object {",
      "[pscustomobject]@{Id=$_.Id;CPU=$_.CPU;WorkingSet64=$_.WorkingSet64;StartTime=$_.StartTime.ToUniversalTime().ToString('o');Responding=$_.Responding;ThreadCount=$_.Threads.Count}",
      "})",
      "$p|ConvertTo-Json -Compress"
    ].join(' ');
    const result = this.#runPowerShell(script, 2500);
    return normalizeArray(result);
  }

  getHardware(force = false) {
    const now = this.now();
    if (!force && this.hardwareCache && now - this.hardwareCacheAt < 60000) return this.hardwareCache;
    const cpus = this.os.cpus?.() || [];
    let probe = {};
    try { probe = this.systemProbe() || {}; } catch { probe = {}; }
    const gpuList = normalizeArray(probe.gpus).map(item => ({
      name:String(item?.Name || item?.name || 'Unknown GPU'),
      adapterRamBytes:Number(item?.AdapterRAM ?? item?.adapterRam ?? 0) || 0,
      driverVersion:String(item?.DriverVersion || item?.driverVersion || ''),
      refreshRateHz:Number(item?.CurrentRefreshRate ?? item?.currentRefreshRate ?? 0) || 0
    }));
    const cpuProbe = normalizeArray(probe.cpus);
    const physicalCores = cpuProbe.reduce((sum, item) => sum + (Number(item?.NumberOfCores) || 0), 0) || null;
    const logicalFromProbe = cpuProbe.reduce((sum, item) => sum + (Number(item?.NumberOfLogicalProcessors) || 0), 0) || null;
    const refreshRateHz = Math.max(0, ...gpuList.map(item => item.refreshRateHz || 0));
    const primaryGpu = [...gpuList].sort((a, b) => b.adapterRamBytes - a.adapterRamBytes)[0] || null;
    const hardware = {
      platform:this.platform,
      arch:this.os.arch?.() || process.arch,
      cpuModel:String(cpuProbe[0]?.Name || cpus[0]?.model || 'Unknown CPU').trim(),
      logicalCores:logicalFromProbe || cpus.length || null,
      physicalCores,
      totalMemoryBytes:Number(this.os.totalmem?.() || 0),
      freeMemoryBytes:Number(this.os.freemem?.() || 0),
      gpus:gpuList,
      primaryGpu,
      refreshRateHz:refreshRateHz || null,
      powerPlan:String(probe.powerPlan || ''),
      probeAvailable:this.platform === 'win32' ? Boolean(gpuList.length || cpuProbe.length || probe.powerPlan) : false
    };
    hardware.tier = this.classifyHardware(hardware);
    this.hardwareCache = hardware;
    this.hardwareCacheAt = now;
    return hardware;
  }

  classifyHardware(hardware) {
    const ram = bytesToGiB(hardware.totalMemoryBytes);
    const logical = Number(hardware.logicalCores || 0);
    const vram = bytesToGiB(hardware.primaryGpu?.adapterRamBytes || 0);
    if ((ram && ram < 8) || (logical && logical < 4) || (vram && vram < 2)) return 'entry';
    if ((ram && ram < 16) || (logical && logical < 8) || (vram && vram < 4)) return 'mainstream';
    if ((ram && ram < 32) || (logical && logical < 12) || (vram && vram < 8)) return 'high';
    return 'enthusiast';
  }

  recommend(hardware) {
    const refresh = Number(hardware.refreshRateHz || 0);
    const tierCaps = { entry:60, mainstream:120, high:180, enthusiast:240 };
    let fpsCap = tierCaps[hardware.tier] || 120;
    if (refresh > 0) {
      const displayTarget = refresh >= 200 ? 240 : refresh >= 140 ? 180 : refresh >= 100 ? 120 : 60;
      fpsCap = Math.min(fpsCap, displayTarget);
    }
    const msaaMode = hardware.tier === 'entry' ? '1' : (hardware.tier === 'enthusiast' ? '4' : '2');
    const reasons = [];
    reasons.push(`${bytesToGiB(hardware.totalMemoryBytes)} GB system memory and ${hardware.logicalCores || 'unknown'} logical CPU threads detected.`);
    if (hardware.primaryGpu) reasons.push(`${hardware.primaryGpu.name}${hardware.primaryGpu.adapterRamBytes ? ` · ${bytesToGiB(hardware.primaryGpu.adapterRamBytes)} GB reported VRAM` : ''}.`);
    if (refresh) reasons.push(`${refresh} Hz display refresh detected; recommended FPS target is capped conservatively around the display/hardware tier.`);
    else reasons.push('Display refresh was unavailable, so DragonStrap used the hardware tier only.');
    reasons.push('Renderer remains Default because driver/API compatibility cannot be inferred safely from hardware names alone.');
    return {
      tier:hardware.tier,
      label:hardware.tier === 'entry' ? 'Efficiency' : hardware.tier === 'mainstream' ? 'Balanced' : hardware.tier === 'high' ? 'High Refresh' : 'Enthusiast',
      settings:{ fpsCap, renderMode:'default', msaaMode },
      reasons
    };
  }

  buildHardwarePresets(hardware, recommendation) {
    const tierCaps = { entry:60, mainstream:120, high:180, enthusiast:240 };
    const cap = tierCaps[hardware.tier] || 120;
    const qualityMsaa = ['high', 'enthusiast'].includes(hardware.tier) ? '4' : (hardware.tier === 'entry' ? '1' : '2');
    return [
      { id:'efficiency', name:'Efficiency', detail:'Lower heat and resource use', settings:{ fpsCap:Math.min(60, cap), renderMode:'default', msaaMode:'1' } },
      { id:'recommended', name:recommendation.label || 'Recommended', detail:'DragonStrap hardware-aware default', recommended:true, settings:{ ...recommendation.settings } },
      { id:'high-refresh', name:'High Refresh', detail:'Prioritize frame-rate headroom', settings:{ fpsCap:cap, renderMode:'default', msaaMode:'1' } },
      { id:'visual-quality', name:'Visual Quality', detail:'Favor MSAA within detected tier', settings:{ fpsCap:Math.min(120, cap), renderMode:'default', msaaMode:qualityMsaa } }
    ];
  }

  getProcessInfo() {
    if (this.platform !== 'win32') return { available:false, running:false, processes:[], message:'Live Roblox process telemetry is available on Windows.' };
    let items = [];
    try { items = normalizeArray(this.processProbe()); } catch { items = []; }
    const now = this.now();
    const processes = items.map(item => {
      const start = Date.parse(item?.StartTime || item?.startTime || '');
      return {
        pid:Number(item?.Id ?? item?.id ?? 0) || null,
        cpuTimeSeconds:Math.round((Number(item?.CPU ?? item?.cpu ?? 0) || 0) * 10) / 10,
        workingSetBytes:Number(item?.WorkingSet64 ?? item?.workingSetBytes ?? 0) || 0,
        uptimeSeconds:Number.isFinite(start) ? Math.max(0, Math.floor((now - start) / 1000)) : null,
        responding:item?.Responding ?? item?.responding ?? null,
        threadCount:Number(item?.ThreadCount ?? item?.threadCount ?? 0) || null
      };
    }).filter(item => item.pid);
    return { available:true, running:processes.length > 0, count:processes.length, processes };
  }

  buildChecks(status, settings, hardware, processInfo) {
    const checks = [];
    checks.push(status?.playerPath
      ? { id:'player', status:'pass', title:'Roblox Player detected', detail:status.version || 'Installed Player executable is available.' }
      : { id:'player', status:'warn', title:'Roblox Player not detected', detail:'Install Roblox Player before applying Performance Center settings.' });

    if (this.performanceService) {
      const config = this.performanceService.getState(status);
      checks.push(config.ok
        ? { id:'client-settings', status:'pass', title:'ClientSettings readable', detail:'DragonStrap can safely inspect the managed configuration boundary.' }
        : { id:'client-settings', status:'warn', title:'ClientSettings needs attention', detail:config.message || config.code || 'Configuration could not be read.' });
    }

    const freeGb = bytesToGiB(hardware.freeMemoryBytes);
    checks.push(freeGb >= 2
      ? { id:'memory', status:'pass', title:'Memory headroom available', detail:`${freeGb} GB currently available to Windows.` }
      : { id:'memory', status:'warn', title:'Low free memory', detail:`Only ${freeGb} GB is currently free. Close memory-heavy applications before launching Roblox.` });

    const plan = String(hardware.powerPlan || '');
    if (/power saver/i.test(plan)) checks.push({ id:'power-plan', status:'warn', title:'Power Saver is active', detail:'Windows Power Saver can reduce CPU/GPU boost behavior. DragonStrap does not change the power plan automatically.' });
    else if (plan) checks.push({ id:'power-plan', status:'pass', title:'Windows power plan detected', detail:plan.replace(/\s+/g, ' ').slice(0, 160) });
    else checks.push({ id:'power-plan', status:'info', title:'Power plan unavailable', detail:'DragonStrap could not read the active Windows power plan.' });

    checks.push(settings?.performanceAutoApply !== false
      ? { id:'auto-apply', status:'pass', title:'Auto-apply enabled', detail:'The selected performance configuration is applied before Player launch.' }
      : { id:'auto-apply', status:'info', title:'Auto-apply disabled', detail:'Use Apply Now manually or enable auto-apply for consistent launch configuration.' });

    if (processInfo.running) checks.push({ id:'running', status:'info', title:'Roblox is currently running', detail:'Configuration file changes are safest to evaluate on the next Roblox launch.' });
    else checks.push({ id:'running', status:'pass', title:'Roblox is not running', detail:'No active Player process was detected.' });
    return checks;
  }

  buildRecommendations(settings, hardware, recommendation) {
    const output = [];
    const fps = Number(settings?.fpsCap || 0);
    const refresh = Number(hardware.refreshRateHz || 0);
    if (fps > recommendation.settings.fpsCap && recommendation.settings.fpsCap > 0) {
      output.push({ severity:'suggestion', title:'FPS target exceeds hardware-aware recommendation', detail:`Current ${fps} FPS vs recommended ${recommendation.settings.fpsCap} FPS for this hardware/display profile.` });
    }
    if (refresh && fps > refresh * 2.5) {
      output.push({ severity:'warning', title:'FPS target is far above display refresh', detail:`${fps} FPS is more than 2.5× the detected ${refresh} Hz refresh rate. Higher caps may increase CPU/GPU load without equivalent visible benefit.` });
    }
    if (String(settings?.msaaMode) === '4' && ['entry', 'mainstream'].includes(hardware.tier)) {
      output.push({ severity:'suggestion', title:'4× MSAA may be expensive on this tier', detail:`DragonStrap recommends ${recommendation.settings.msaaMode}× MSAA for the detected ${hardware.tier} hardware tier.` });
    }
    if (settings?.renderMode === 'vulkan') {
      output.push({ severity:'warning', title:'Forced Vulkan compatibility varies', detail:'DragonStrap cannot guarantee Vulkan stability for every Roblox build/GPU driver. Default renderer is the hardware-aware recommendation.' });
    }
    if (bytesToGiB(hardware.freeMemoryBytes) < 2) {
      output.push({ severity:'warning', title:'Free memory is low', detail:'Close memory-heavy applications before launching Roblox to reduce paging and stutter risk.' });
    }
    if (!output.length) output.push({ severity:'ok', title:'Configuration is within the conservative recommendation envelope', detail:'No obvious hardware/configuration mismatch was detected. This is guidance, not a benchmark result.' });
    return output;
  }

  getState(status, settings = {}) {
    const hardware = this.getHardware(false);
    const recommendation = this.recommend(hardware);
    const hardwarePresets = this.buildHardwarePresets(hardware, recommendation);
    const processInfo = this.getProcessInfo();
    return {
      ok:true,
      generatedAt:new Date(this.now()).toISOString(),
      hardware,
      recommendation,
      hardwarePresets,
      process:processInfo,
      checks:this.buildChecks(status, settings, hardware, processInfo),
      recommendations:this.buildRecommendations(settings, hardware, recommendation),
      profiles:this.profileStore?.getState?.() || null
    };
  }
}

module.exports = { PerformanceCenterService, bytesToGiB, normalizeProbeJson };
