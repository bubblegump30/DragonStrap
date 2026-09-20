'use strict';

const { MANAGED_FLAGS } = require('./performance-service');

const TRUST = Object.freeze({
  SAFE: 'safe',
  LEGACY: 'legacy',
  EXPERIMENTAL: 'experimental',
  UNKNOWN: 'unknown'
});

const KNOWN = Object.freeze({
  FFlagHandleAltEnterFullscreenManually: Object.freeze({
    category:'Rendering',
    description:'Current low-risk fullscreen preset used by modern Roblox bootstrapper tooling. False keeps DragonStrap from forcing an alternate fullscreen behavior. Roblox can still change client-side support between builds.',
    family:null,
    trust:TRUST.SAFE,
    recommendedValue:'False'
  }),
  DFFlagDisableDPIScale: Object.freeze({
    category:'Rendering',
    description:'Current low-risk DPI/render-scaling preset used by modern Roblox bootstrapper tooling. True asks Roblox not to apply its DPI scale override. Behavior can still change between Roblox builds.',
    family:null,
    trust:TRUST.SAFE,
    recommendedValue:'True'
  }),
  [MANAGED_FLAGS.msaa]: Object.freeze({
    category:'Rendering',
    description:'Current low-risk MSAA preset. DragonStrap owns this key through Performance Center, so FastFlag Manager keeps it locked here.',
    family:'msaa',
    trust:TRUST.SAFE,
    recommendedValue:'2'
  }),
  DFFlagTextureQualityOverrideEnabled: Object.freeze({
    category:'Rendering',
    description:'Enables the paired manual texture-quality level override. Kept in DragonStrap Safe Core because it remains a current bootstrapper rendering preset, but Roblox can change support at any time.',
    family:null,
    trust:TRUST.SAFE,
    recommendedValue:'True'
  }),
  DFIntTextureQualityOverride: Object.freeze({
    category:'Rendering',
    description:'Texture quality override level used with DFFlagTextureQualityOverrideEnabled. DragonStrap Safe Core recommends level 2 as a conservative middle value.',
    family:null,
    trust:TRUST.SAFE,
    recommendedValue:'2'
  }),
  [MANAGED_FLAGS.fps]: Object.freeze({
    category:'Performance',
    description:'Legacy DragonStrap FPS-target override. Current Roblox clients may ignore this client setting; prefer Roblox\'s built-in FPS control when available. DragonStrap still keeps ownership for backward compatibility.',
    family:'fps',
    trust:TRUST.LEGACY,
    recommendedValue:null
  }),
  [MANAGED_FLAGS.d3d11]: Object.freeze({
    category:'Rendering',
    description:'Legacy Direct3D 11 renderer preference. Current Roblox builds may ignore this override. DragonStrap retains the control for compatibility testing but does not classify it as Safe Core.',
    family:'renderer',
    trust:TRUST.LEGACY,
    recommendedValue:null
  }),
  [MANAGED_FLAGS.vulkan]: Object.freeze({
    category:'Rendering',
    description:'Legacy Vulkan renderer preference. Current Roblox builds may ignore this override. DragonStrap retains the control for compatibility testing but does not classify it as Safe Core.',
    family:'renderer',
    trust:TRUST.LEGACY,
    recommendedValue:null
  })
});

const SAFE_CORE_KEYS = Object.freeze([
  'FFlagHandleAltEnterFullscreenManually',
  'DFFlagDisableDPIScale',
  MANAGED_FLAGS.msaa,
  'DFFlagTextureQualityOverrideEnabled',
  'DFIntTextureQualityOverride'
]);

const CATEGORY_RULES = Object.freeze([
  ['Rendering', /(graphics|render|texture|shader|lighting|shadow|msaa|gpu|d3d|vulkan|opengl|metal)/i],
  ['Performance', /(fps|scheduler|performance|thread|memory|cache|qualitylevel|lod)/i],
  ['Network', /(network|http|socket|packet|ping|latency|replic|bandwidth|connection)/i],
  ['Physics', /(physics|solver|collision|humanoid|simulation)/i],
  ['UI', /(ui|gui|menu|chat|notification|avatar|display|screen)/i],
  ['Audio', /(audio|sound|voice|microphone)/i],
  ['Input', /(input|mouse|keyboard|gamepad|touch|camera)/i],
  ['Telemetry', /(telemetry|analytics|metric|log|eventstream|counter)/i],
  ['Experimental', /(experiment|experimental|beta|test|debug)/i]
]);

function inferCategory(key) {
  if (KNOWN[key]) return KNOWN[key].category;
  for (const [category, pattern] of CATEGORY_RULES) if (pattern.test(key)) return category;
  return 'Other';
}

function typeLabel(type) {
  return ({ boolean:'Boolean', integer:'Integer', float:'Float', string:'String' })[type] || 'FastVariable';
}

function inferDescription(key, type) {
  if (KNOWN[key]) return KNOWN[key].description;
  const category = inferCategory(key);
  if (category === 'Other') return `${typeLabel(type)} Roblox FastVariable. DragonStrap does not have a verified description for this key; behavior can change between Roblox builds.`;
  return `${typeLabel(type)} Roblox FastVariable with a ${category.toLowerCase()}-related name. Category is inferred from the key; exact Roblox behavior is not verified and can change between builds.`;
}

function inferTrust(key) {
  if (KNOWN[key]?.trust) return KNOWN[key].trust;
  if (/(experimental|beta|debug|test)/i.test(key)) return TRUST.EXPERIMENTAL;
  return TRUST.UNKNOWN;
}

function trustInfo(key) {
  const level = inferTrust(key);
  if (level === TRUST.SAFE) return {
    level, label:'SAFE CORE', severity:'safe',
    message:'DragonStrap classifies this as a conservative current preset, not an official Roblox guarantee. Support can still change between client builds.'
  };
  if (level === TRUST.LEGACY) return {
    level, label:'LEGACY', severity:'warning',
    message:'Compatibility-sensitive legacy override. Current Roblox builds may ignore or change this behavior.'
  };
  if (level === TRUST.EXPERIMENTAL) return {
    level, label:'EXPERIMENTAL', severity:'danger',
    message:'Experimental/debug-oriented key. Behavior can change or disappear without notice.'
  };
  return {
    level, label:'UNKNOWN', severity:'neutral',
    message:'DragonStrap has not verified this flag. Treat its behavior as unknown until tested against the current Roblox build.'
  };
}

function conflictFamily(key) {
  if (KNOWN[key]?.family) return KNOWN[key].family;
  if (/(task.*scheduler.*fps|scheduler.*target.*fps|target.*fps|fps.*cap)/i.test(key)) return 'fps';
  if (/msaa/i.test(key)) return 'msaa';
  if (/(graphics.*prefer|prefer.*(d3d|vulkan|opengl|metal)|render.*backend|graphics.*api)/i.test(key)) return 'renderer';
  return null;
}

function compatibilityWarnings(key, { protectedKey=false, activePerformanceFamilies=[] } = {}) {
  const warnings = [];
  const family = conflictFamily(key);
  const trust = trustInfo(key);

  if (trust.level === TRUST.LEGACY) {
    warnings.push({ code:'LEGACY_COMPATIBILITY', severity:'warning', family, message:trust.message });
  } else if (trust.level === TRUST.EXPERIMENTAL) {
    warnings.push({ code:'EXPERIMENTAL_FLAG', severity:'warning', family:null, message:trust.message });
  } else if (trust.level === TRUST.SAFE) {
    warnings.push({ code:'SAFE_CORE', severity:'info', family, message:trust.message });
  }

  if (protectedKey) {
    warnings.push({
      code:'PERFORMANCE_OWNED', severity:'error', family,
      message:'This key is owned by Performance Center. Edit it there; FastFlag Manager keeps it locked to prevent subsystem conflicts.'
    });
    return warnings;
  }

  if (family) {
    const active = activePerformanceFamilies.includes(family);
    const label = family === 'fps' ? 'FPS target' : family === 'msaa' ? 'MSAA' : 'renderer selection';
    warnings.push({
      code:`PERFORMANCE_FAMILY_${family.toUpperCase()}`,
      severity:active ? 'warning' : 'info', family,
      message:active
        ? `This flag belongs to the same ${label} family as an active Performance Center override and may produce conflicting behavior.`
        : `This flag is related to Performance Center ${label}. Enabling the corresponding Performance Center control later may conflict with this manual flag.`
    });
  }
  return warnings;
}

function activePerformanceFamilies(data = {}) {
  const families = new Set();
  if (Object.hasOwn(data, MANAGED_FLAGS.fps)) families.add('fps');
  if (Object.hasOwn(data, MANAGED_FLAGS.msaa)) families.add('msaa');
  if (Object.hasOwn(data, MANAGED_FLAGS.d3d11) || Object.hasOwn(data, MANAGED_FLAGS.vulkan)) families.add('renderer');
  return [...families];
}

function safeCoreCatalog() {
  return SAFE_CORE_KEYS.map(key => ({ key, ...KNOWN[key] }));
}

module.exports = {
  TRUST,
  KNOWN,
  SAFE_CORE_KEYS,
  inferCategory,
  inferDescription,
  inferTrust,
  trustInfo,
  conflictFamily,
  compatibilityWarnings,
  activePerformanceFamilies,
  safeCoreCatalog
};
