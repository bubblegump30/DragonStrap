'use strict';

const q = selector => document.querySelector(selector);
const qsa = selector => [...document.querySelectorAll(selector)];
const escapeHtml = value => String(value ?? '').replace(/[&<>\"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);

const state = {
  roblox: null,
  settings: null,
  refreshTimer: null,
  launchPending: false,
  performance: null,
  performanceCenter: { data:null, profiles:null, pollTimer:null, loading:false },
  configurationProfiles: { data:null, preview:null, loading:false },
  fastFlags: { entries: [], path: '', backupExists: false, pendingSet: new Map(), pendingRemove: new Set(), selectedKey: null, selectedKeys: new Set(), presets: [], snapshots: [], preview: null, categories: [], safeCoreCatalog: [] },
  servers: { result: null, loading: false, saved: { favorites: [], recent: [], providerHealth: {} }, compareIds: new Set() },
  studio: { center: null, loading: false },
  channels: { data: null, loading: false, install: { plan:null, running:false, progress:null } },
  maintenance: { data: null, loading: false },
  updates: { data: null, loading: false, downloading: false, progress: null },
  reliability: { data: null },
  core: { data:null, loading:false },
  appInfo: null
};

const PERFORMANCE_PRESETS = Object.freeze({
  default: Object.freeze({ fpsCap: 0, renderMode: 'default', msaaMode: 'default' }),
  balanced: Object.freeze({ fpsCap: 120, renderMode: 'default', msaaMode: '2' }),
  performance: Object.freeze({ fpsCap: 240, renderMode: 'default', msaaMode: '1' }),
  quality: Object.freeze({ fpsCap: 120, renderMode: 'default', msaaMode: '4' })
});

function showToast(message, error = false) {
  const toast = q('#toast');
  toast.textContent = message;
  toast.classList.toggle('error', error);
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function setProductMenuOpen(open) {
  const button = q('#productMenuButton');
  const popup = q('#productMenuPopup');
  if (!button || !popup) return;
  const next = Boolean(open);
  button.setAttribute('aria-expanded', String(next));
  popup.hidden = !next;
  q('#productMenu')?.classList.toggle('open', next);
  if (next) requestAnimationFrame(() => q('#productHelpBtn')?.focus());
}

function openDragonHelp() {
  setProductMenuOpen(false);
  const dialog = q('#helpDialog');
  if (dialog && !dialog.open) dialog.showModal();
}

function openDragonAbout() {
  setProductMenuOpen(false);
  switchView('settings');
  requestAnimationFrame(() => {
    const card = q('#aboutCard');
    card?.scrollIntoView({ behavior:'smooth', block:'center' });
    card?.focus({ preventScroll:true });
  });
}

function switchView(name, options = {}) {
  const active = q(`.nav-item[data-tab="${name}"]`);
  if (!active) return;

  qsa('.nav-item').forEach(item => {
    const selected = item.dataset.tab === name;
    item.classList.toggle('active', selected);
    if (selected) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  qsa('.view').forEach(view => view.classList.toggle('active', view.dataset.view === name));

  const label = active.querySelector('span')?.textContent?.trim() || 'DragonStrap';
  document.title = name === 'home' ? 'DragonStrap' : `DragonStrap — ${label}`;
  document.documentElement.dataset.view = name;
  localStorage.setItem('dragonstrap.activeView', name);
  active.scrollIntoView({ block: 'nearest' });

  if (name === 'maintenance') refreshMaintenance(false);
  if (name === 'servers') refreshServerSavedState().catch(console.error);
  if (name === 'studio') refreshStudioCenter(false).catch(console.error);
  if (name === 'profiles') refreshConfigurationProfiles(false).catch(console.error);
  if (name === 'fastflags') refreshFastFlags(false).catch(console.error);
  if (name === 'channels') { refreshChannelVersion(false).catch(console.error); restorePlayerInstallState().catch(console.error); }
  if (name === 'settings') {
    refreshCoreState(false).catch(console.error);
    refreshUpdateState(false,false).catch(console.error);
    refreshReliabilityState().catch(console.error);
  }
  if (name === 'performance') {
    refreshPerformanceState(false).catch(console.error);
    refreshPerformanceCenter(false).catch(console.error);
    startPerformanceCenterPolling();
  } else {
    stopPerformanceCenterPolling();
  }

  if (options.focusHeading) {
    q(`.view[data-view="${name}"] .page-heading h1`)?.focus?.();
  }
}

qsa('.nav-item').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.tab)));
qsa('[data-tab-jump]').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.tabJump)));

qsa('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => setProfile(btn.dataset.profile));
});

async function setProfile(profile) {
  const patch = { launchProfile: profile };
  if (PERFORMANCE_PRESETS[profile]) Object.assign(patch, PERFORMANCE_PRESETS[profile]);
  qsa('[data-profile]').forEach(item => item.classList.toggle('active', item.dataset.profile === profile));
  qsa('[data-perf-profile]').forEach(item => item.classList.toggle('active', item.dataset.perfProfile === profile));
  if (q('#launchProfile')) q('#launchProfile').value = profile;
  if (state.settings) {
    Object.assign(state.settings, patch);
    await saveSettings(patch);
    renderPerformanceSettings();
  }
}

qsa('.profile-btn,.profile-tile').forEach(btn => {
  btn.addEventListener('click', () => setProfile(btn.dataset.profile));
});

qsa('.vslider').forEach(slider => {
  const update = () => {
    const min = Number(slider.min || 0);
    const max = Number(slider.max || 100);
    const value = Number(slider.value);
    const pct = ((value - min) / (max - min)) * 100;
    slider.style.background = `linear-gradient(0deg,#9a4dff 0 ${pct}%,#191220 ${pct}%)`;
  };
  slider.addEventListener('input', update);
  update();
});

function fpsLabel(value) {
  return Number(value) === 0 ? 'DEFAULT' : String(value);
}

function homeRenderLabel(mode) {
  if (mode === 'd3d11') return 'D3D11';
  if (mode === 'vulkan') return 'Vulkan';
  return 'Default';
}

function renderHomePerformanceWidget() {
  const settings = state.settings || {};
  const autoApply = settings.performanceAutoApply !== false;
  const fps = Number(settings.fpsCap ?? 0);
  const profile = String(settings.launchProfile || 'custom');
  const profileLabel = profile === 'custom' ? 'Custom' : profile.charAt(0).toUpperCase() + profile.slice(1);
  if (q('#homePerfFpsValue')) q('#homePerfFpsValue').textContent = fpsLabel(fps);
  if (q('#homePerfRenderValue')) q('#homePerfRenderValue').textContent = homeRenderLabel(settings.renderMode || 'default');
  q('#homePerfAutoBtn')?.classList.toggle('active', autoApply);
  q('#homePerfCustomBtn')?.classList.toggle('active', !autoApply);
  const dot = q('#homePerfStatusDot');
  if (dot) {
    dot.classList.toggle('online', autoApply);
    dot.classList.toggle('offline', !autoApply);
  }
  if (q('#homePerfStatus')) {
    q('#homePerfStatus').textContent = autoApply
      ? `Auto-apply enabled · ${profileLabel} · ${fpsLabel(fps)} FPS`
      : `Manual mode · ${profileLabel} · ${fpsLabel(fps)} FPS`;
  }
}

function openPerformanceControl(selector) {
  switchView('performance');
  requestAnimationFrame(() => {
    const target = q(selector);
    target?.scrollIntoView?.({ behavior:'smooth', block:'center' });
    if (target?.matches?.('input,button,select,textarea,[tabindex]')) target.focus?.();
    else target?.querySelector?.('input,button,select,textarea,[tabindex]')?.focus?.();
  });
}

async function enableHomePerformanceAuto() {
  const button = q('#homePerfAutoBtn');
  if (button) button.disabled = true;
  try {
    const center = state.performanceCenter.data?.ok ? state.performanceCenter.data : await refreshPerformanceCenter(false);
    const recommendation = center?.recommendation?.settings;
    if (!recommendation) {
      showToast('Hardware recommendation is unavailable. Opening Performance Center.', true);
      return openPerformanceControl('#useHardwareRecommendationBtn');
    }
    await savePerformancePatch({ ...recommendation, performanceAutoApply:true }, true);
    renderHomePerformanceWidget();
    showToast('Hardware-aware settings loaded. Auto-apply is enabled for the next Roblox launch.');
  } finally {
    if (button) button.disabled = false;
  }
}

async function openHomePerformanceCustom() {
  await savePerformancePatch({ performanceAutoApply:false }, false);
  renderHomePerformanceWidget();
  openPerformanceControl('.perf-presets');
  showToast('Manual performance mode enabled. Adjust the Performance Center controls as needed.');
}

function renderPerformanceSettings() {
  if (!state.settings) return;
  const fps = Number(state.settings.fpsCap ?? 240);
  if (q('#fpsRange')) q('#fpsRange').value = String(fps);
  if (q('#fpsSlider')) {
    const slider = q('#fpsSlider');
    slider.value = String(fps);
    const min = Number(slider.min || 0);
    const max = Number(slider.max || 240);
    const pct = ((fps - min) / (max - min)) * 100;
    slider.style.background = `linear-gradient(0deg,#9a4dff 0 ${pct}%,#191220 ${pct}%)`;
  }
  if (q('#fpsReadout')) q('#fpsReadout').textContent = fpsLabel(fps);
  if (q('#performanceAutoApply')) q('#performanceAutoApply').checked = state.settings.performanceAutoApply !== false;
  qsa('#renderModeChoice [data-value]').forEach(button => button.classList.toggle('active', button.dataset.value === (state.settings.renderMode || 'default')));
  qsa('#msaaChoice [data-value]').forEach(button => button.classList.toggle('active', button.dataset.value === String(state.settings.msaaMode || 'default')));
  qsa('[data-perf-profile]').forEach(button => button.classList.toggle('active', button.dataset.perfProfile === state.settings.launchProfile));
  renderHomePerformanceWidget();
}

async function savePerformancePatch(patch, markCustom = true) {
  if (markCustom) patch.launchProfile = 'custom';
  Object.assign(state.settings, patch);
  await saveSettings(patch);
  if (markCustom) {
    qsa('[data-profile]').forEach(item => item.classList.toggle('active', item.dataset.profile === 'custom'));
    if (q('#launchProfile')) q('#launchProfile').value = 'custom';
  }
  renderPerformanceSettings();
}

function renderPerformanceState(result) {
  state.performance = result;
  const dot = q('#performanceStateDot');
  if (!result?.ok) {
    if (dot) { dot.classList.remove('online'); dot.classList.add('offline'); }
    if (q('#performanceAppliedStatus')) q('#performanceAppliedStatus').textContent = result?.code || 'Unavailable';
    if (q('#performancePath')) q('#performancePath').textContent = result?.path || 'Roblox Player not detected';
    return;
  }
  const managed = result.managed || {};
  const hasManaged = Object.values(managed).some(value => value !== null && value !== undefined);
  if (dot) { dot.classList.toggle('online', hasManaged); dot.classList.toggle('offline', !hasManaged); }
  q('#performanceAppliedStatus').textContent = hasManaged ? 'Overrides active' : 'Roblox defaults';
  q('#performanceAppliedFps').textContent = managed.fpsCap ?? 'Default';
  q('#performanceAppliedMsaa').textContent = managed.msaaMode ? `${managed.msaaMode}×` : 'Default';
  q('#performanceAppliedRenderer').textContent = managed.vulkan === 'True' ? 'Vulkan' : (managed.d3d11 === 'True' ? 'Direct3D 11' : 'Default');
  q('#performancePath').textContent = result.path || '—';
}

async function refreshPerformanceState(announce = false) {
  try {
    const result = await window.dragonStrap.getPerformanceState();
    renderPerformanceState(result);
    if (announce) showToast(result.ok ? 'Performance+ state refreshed.' : (result.message || 'Performance+ state unavailable.'), !result.ok);
    return result;
  } catch (error) {
    console.error(error);
    if (announce) showToast('Performance+ state could not be read.', true);
    return null;
  }
}

async function applyPerformanceNow() {
  const button = q('#applyPerformanceBtn');
  if (button) button.disabled = true;
  try {
    const result = await window.dragonStrap.applyPerformance();
    if (!result.ok) {
      showToast(result.message || 'Performance+ settings could not be applied.', true);
      renderPerformanceState(result);
      return;
    }
    showToast('Performance+ settings applied to Roblox Player.');
    await refreshPerformanceState(false);
  } finally {
    if (button) button.disabled = false;
  }
}

async function restorePerformanceDefaults() {
  const button = q('#restorePerformanceBtn');
  if (button) button.disabled = true;
  try {
    Object.assign(state.settings, { launchProfile: 'default', fpsCap: 0, renderMode: 'default', msaaMode: 'default' });
    await saveSettings({ launchProfile: 'default', fpsCap: 0, renderMode: 'default', msaaMode: 'default' });
    renderPerformanceSettings();
    qsa('[data-profile]').forEach(item => item.classList.toggle('active', item.dataset.profile === 'default'));
    const result = await window.dragonStrap.restorePerformance();
    showToast(result.ok ? 'DragonStrap performance overrides removed.' : (result.message || 'Performance+ restore failed.'), !result.ok);
    await refreshPerformanceState(false);
  } finally {
    if (button) button.disabled = false;
  }
}


function formatPerfBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return '—';
  if (value >= 1024 ** 3) return `${(value / (1024 ** 3)).toFixed(1)} GB`;
  if (value >= 1024 ** 2) return `${(value / (1024 ** 2)).toFixed(0)} MB`;
  return `${Math.round(value / 1024)} KB`;
}

function formatPerfDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return '—';
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = Math.floor(value % 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

function cleanPowerPlanLabel(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  const match = text.match(/\(([^)]+)\)/);
  return match?.[1] || text || 'Unavailable';
}

function renderPerformanceCheckList(selector, items = []) {
  const container = q(selector);
  if (!container) return;
  if (!items.length) {
    container.innerHTML = '<div class="perf2-empty">No items reported.</div>';
    return;
  }
  container.innerHTML = items.map(item => `
    <div class="perf2-check-item ${escapeHtml(item.status || item.severity || 'info')}">
      <i></i><div><strong>${escapeHtml(item.title || 'Check')}</strong><p>${escapeHtml(item.detail || '')}</p></div>
    </div>`).join('');
}

function renderPerformanceProfiles(profileState) {
  state.performanceCenter.profiles = profileState;
  const profiles = profileState?.profiles || [];
  const savedSelect = q('#performanceProfileSelect');
  const experienceSelect = q('#performanceExperienceProfile');
  const previousSaved = savedSelect?.value || '';
  const previousExperience = experienceSelect?.value || '';
  const optionHtml = profiles.map(profile => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.name)}${profile.builtin ? ' · built-in' : ' · custom'}</option>`).join('');
  if (savedSelect) {
    savedSelect.innerHTML = optionHtml || '<option value="">No profiles</option>';
    if (profiles.some(profile => profile.id === previousSaved)) savedSelect.value = previousSaved;
  }
  if (experienceSelect) {
    experienceSelect.innerHTML = optionHtml || '<option value="">No profiles</option>';
    if (profiles.some(profile => profile.id === previousExperience)) experienceSelect.value = previousExperience;
  }
  const selected = profiles.find(profile => profile.id === savedSelect?.value);
  if (q('#deletePerformanceProfileBtn')) q('#deletePerformanceProfileBtn').disabled = !selected || selected.builtin;

  const list = q('#performanceExperienceList');
  const mappings = profileState?.experienceProfiles || [];
  if (list) {
    list.innerHTML = mappings.length ? mappings.map(item => `
      <button class="perf2-experience-row" type="button" data-place-id="${escapeHtml(item.placeId)}" data-profile-id="${escapeHtml(item.profileId)}">
        <span>Place ${escapeHtml(item.placeId)}</span><strong>${escapeHtml(item.profileName)}</strong>
      </button>`).join('') : '<div class="perf2-empty">No per-experience profiles configured.</div>';
    qsa('.perf2-experience-row').forEach(row => row.addEventListener('click', () => {
      q('#performanceExperiencePlaceId').value = row.dataset.placeId || '';
      if ([...q('#performanceExperienceProfile').options].some(option => option.value === row.dataset.profileId)) q('#performanceExperienceProfile').value = row.dataset.profileId;
    }));
  }
}

function renderPerformanceCenter(result) {
  state.performanceCenter.data = result;
  if (!result?.ok) return;
  const hardware = result.hardware || {};
  const recommendation = result.recommendation || {};
  const primaryGpu = hardware.primaryGpu || {};
  if (q('#perfHardwareTier')) q('#perfHardwareTier').textContent = String(hardware.tier || 'unknown').toUpperCase();
  if (q('#perfCpu')) q('#perfCpu').textContent = `${hardware.cpuModel || 'Unknown CPU'}${hardware.logicalCores ? ` · ${hardware.logicalCores}T` : ''}`;
  if (q('#perfGpu')) q('#perfGpu').textContent = primaryGpu.name || 'GPU probe unavailable';
  if (q('#perfMemory')) q('#perfMemory').textContent = `${formatPerfBytes(hardware.totalMemoryBytes)} total · ${formatPerfBytes(hardware.freeMemoryBytes)} free`;
  if (q('#perfRefresh')) q('#perfRefresh').textContent = hardware.refreshRateHz ? `${hardware.refreshRateHz} Hz` : 'Unavailable';
  if (q('#perfPowerPlan')) q('#perfPowerPlan').textContent = cleanPowerPlanLabel(hardware.powerPlan);
  if (q('#perfRecommendationLabel')) q('#perfRecommendationLabel').textContent = `${recommendation.label || 'Balanced'} · ${recommendation.settings?.fpsCap || 'Default'} FPS · ${recommendation.settings?.msaaMode === 'default' ? 'Default' : `${recommendation.settings?.msaaMode}×`} MSAA`;
  if (q('#perfRecommendationDetail')) q('#perfRecommendationDetail').textContent = recommendation.reasons?.[2] || recommendation.reasons?.[0] || 'Conservative hardware guidance is available.';
  const hardwarePresets = q('#perfHardwarePresets');
  if (hardwarePresets) {
    hardwarePresets.innerHTML = (result.hardwarePresets || []).map((preset, index) => `
      <button type="button" class="perf2-hardware-preset${preset.recommended ? ' recommended' : ''}" data-hardware-preset-index="${index}">
        <strong>${escapeHtml(preset.name)}</strong><span>${escapeHtml(preset.detail)}</span><em>${preset.settings.fpsCap || 'Default'} FPS · ${preset.settings.msaaMode === 'default' ? 'Default' : `${escapeHtml(preset.settings.msaaMode)}×`} MSAA</em>
      </button>`).join('') || '<div class="perf2-empty">Hardware-aware presets unavailable.</div>';
    qsa('[data-hardware-preset-index]').forEach(button => button.addEventListener('click', async () => {
      const preset = state.performanceCenter.data?.hardwarePresets?.[Number(button.dataset.hardwarePresetIndex)];
      if (!preset) return;
      await savePerformancePatch({ ...preset.settings }, true);
      showToast(`${preset.name} hardware-aware preset loaded. Use Apply Now or launch Roblox to activate it.`);
      await refreshPerformanceCenter(false);
    }));
  }

  const process = result.process || {};
  const current = process.processes?.[0] || null;
  const dot = q('#perfProcessDot');
  if (dot) { dot.classList.toggle('online', Boolean(process.running)); dot.classList.toggle('offline', !process.running); }
  if (q('#perfProcessStatus')) q('#perfProcessStatus').textContent = process.running ? `Running${process.count > 1 ? ` (${process.count})` : ''}` : 'Not running';
  if (q('#perfProcessPid')) q('#perfProcessPid').textContent = current?.pid || '—';
  if (q('#perfProcessMemory')) q('#perfProcessMemory').textContent = current ? formatPerfBytes(current.workingSetBytes) : '—';
  if (q('#perfProcessCpu')) q('#perfProcessCpu').textContent = current ? `${current.cpuTimeSeconds.toFixed(1)} s` : '—';
  if (q('#perfProcessUptime')) q('#perfProcessUptime').textContent = current ? formatPerfDuration(current.uptimeSeconds) : '—';
  if (q('#perfProcessThreads')) q('#perfProcessThreads').textContent = current?.threadCount || '—';

  renderPerformanceCheckList('#performanceStartupChecks', result.checks || []);
  renderPerformanceCheckList('#performanceRecommendations', (result.recommendations || []).map(item => ({ ...item, status:item.severity })));
  if (result.profiles) renderPerformanceProfiles(result.profiles);
}

async function refreshPerformanceCenter(announce = false) {
  if (state.performanceCenter.loading) return state.performanceCenter.data;
  state.performanceCenter.loading = true;
  try {
    const result = await window.dragonStrap.getPerformanceCenterState();
    renderPerformanceCenter(result);
    if (announce) showToast(result.ok ? 'Performance Center refreshed.' : (result.message || 'Performance Center state unavailable.'), !result.ok);
    return result;
  } catch (error) {
    console.error(error);
    if (announce) showToast('Performance Center could not be refreshed.', true);
    return null;
  } finally {
    state.performanceCenter.loading = false;
  }
}

function startPerformanceCenterPolling() {
  stopPerformanceCenterPolling();
  state.performanceCenter.pollTimer = setInterval(() => {
    if (document.documentElement.dataset.view === 'performance') refreshPerformanceCenter(false).catch(console.error);
  }, 5000);
}

function stopPerformanceCenterPolling() {
  if (state.performanceCenter.pollTimer) clearInterval(state.performanceCenter.pollTimer);
  state.performanceCenter.pollTimer = null;
}

async function useHardwareRecommendation() {
  const settings = state.performanceCenter.data?.recommendation?.settings;
  if (!settings) return showToast('Hardware recommendation is not available yet.', true);
  await savePerformancePatch({ ...settings }, true);
  showToast('Hardware-aware recommendation loaded. Use Apply Now or launch Roblox to activate it.');
  await refreshPerformanceCenter(false);
}

async function applySelectedPerformanceProfile() {
  const id = q('#performanceProfileSelect')?.value;
  const profile = state.performanceCenter.profiles?.profiles?.find(item => item.id === id);
  if (!profile) return showToast('Select a performance profile first.', true);
  if (profile.id.startsWith('builtin:')) await setProfile(profile.id.slice('builtin:'.length));
  else await savePerformancePatch({ ...profile.settings }, true);
  showToast(`${profile.name} loaded. Use Apply Now or launch Roblox to activate it.`);
  await refreshPerformanceCenter(false);
}

async function saveCurrentPerformanceProfile() {
  const input = q('#performanceProfileName');
  const name = input?.value?.trim() || '';
  const result = await window.dragonStrap.savePerformanceProfile(name);
  if (!result.ok) return showToast(result.message || 'Performance profile could not be saved.', true);
  if (input) input.value = '';
  const profiles = await window.dragonStrap.getPerformanceProfiles();
  renderPerformanceProfiles(profiles);
  if (q('#performanceProfileSelect')) q('#performanceProfileSelect').value = result.profile.id;
  showToast(result.updated ? 'Performance profile updated.' : 'Performance profile saved.');
}

async function deleteSelectedPerformanceProfile() {
  const id = q('#performanceProfileSelect')?.value;
  if (!id) return;
  const result = await window.dragonStrap.deletePerformanceProfile(id);
  if (!result.ok) return showToast(result.message || 'Performance profile could not be deleted.', true);
  renderPerformanceProfiles(await window.dragonStrap.getPerformanceProfiles());
  showToast('Custom performance profile deleted.');
}

async function assignExperiencePerformanceProfile() {
  const placeId = q('#performanceExperiencePlaceId')?.value?.trim() || '';
  const profileId = q('#performanceExperienceProfile')?.value || '';
  const result = await window.dragonStrap.assignPerformanceExperience(placeId, profileId);
  if (!result.ok) return showToast(result.message || 'Experience profile could not be assigned.', true);
  renderPerformanceProfiles(await window.dragonStrap.getPerformanceProfiles());
  showToast(`Place ${result.mapping.placeId} will use ${result.mapping.profileName}.`);
}

async function removeExperiencePerformanceProfile() {
  const placeId = q('#performanceExperiencePlaceId')?.value?.trim() || '';
  const result = await window.dragonStrap.removePerformanceExperience(placeId);
  if (!result.ok) return showToast(result.message || 'Experience profile could not be removed.', true);
  renderPerformanceProfiles(await window.dragonStrap.getPerformanceProfiles());
  showToast(result.removed ? `Per-experience profile removed for Place ${placeId}.` : 'No mapping existed for that Place ID.');
}


function fastFlagPendingCount() {
  return state.fastFlags.pendingSet.size + state.fastFlags.pendingRemove.size;
}

function fastFlagPendingPatch() {
  return {
    set: [...state.fastFlags.pendingSet.values()],
    remove: [...state.fastFlags.pendingRemove]
  };
}

function setFastFlagHint(message, kind = '') {
  const hint = q('#fastFlagEditorHint');
  if (!hint) return;
  hint.textContent = message;
  hint.classList.toggle('error', kind === 'error');
  hint.classList.toggle('ok', kind === 'ok');
}

function renderFastFlagIntel(entry = null) {
  const category = q('#fastFlagSelectedCategory');
  const safety = q('#fastFlagSafety');
  const description = q('#fastFlagDescription');
  const compatibility = q('#fastFlagCompatibility');
  if (!category || !safety || !description || !compatibility) return;
  category.textContent = entry?.category || '—';
  const trust=entry?.trust || { level:'unknown', label:'UNKNOWN', severity:'neutral', message:'' };
  safety.textContent=entry ? (trust.label || 'UNKNOWN') : '—';
  safety.className=`fastflag-trust-badge ${trust.severity || 'neutral'}`;
  safety.title=trust.message || '';
  description.textContent = entry?.description || 'Select a flag to inspect its inferred purpose.';
  compatibility.replaceChildren();
  const warnings = Array.isArray(entry?.warnings) ? entry.warnings : [];
  if (!entry) {
    const safe = document.createElement('span'); safe.className = 'fastflag-safe'; safe.textContent = 'No selected flag.'; compatibility.append(safe); return;
  }
  if (trust.message) {
    const trustNote=document.createElement('span');
    trustNote.className=trust.level === 'safe' ? 'fastflag-safe' : `fastflag-warning ${trust.level === 'legacy' ? '' : trust.level === 'experimental' ? 'error' : 'info'}`;
    trustNote.textContent=trust.message;
    compatibility.append(trustNote);
  }
  const extraWarnings=warnings.filter(w => !['SAFE_CORE','LEGACY_COMPATIBILITY','EXPERIMENTAL_FLAG'].includes(w.code));
  if (!extraWarnings.length && trust.level === 'unknown') {
    const unknown = document.createElement('span'); unknown.className = 'fastflag-warning info'; unknown.textContent = 'No known Performance Center conflict detected, but this flag is not in DragonStrap Safe Core.'; compatibility.append(unknown); return;
  }
  for (const warning of extraWarnings) {
    const item = document.createElement('span');
    item.className = `fastflag-warning ${warning.severity || 'info'}`;
    item.textContent = warning.message || warning.code || 'Compatibility warning';
    compatibility.append(item);
  }
}
function clearFastFlagEditor() {
  state.fastFlags.selectedKey = null;
  if (q('#fastFlagKey')) q('#fastFlagKey').value = '';
  if (q('#fastFlagValue')) q('#fastFlagValue').value = '';
  if (q('#fastFlagType')) q('#fastFlagType').value = 'auto';
  if (q('#fastFlagKey')) q('#fastFlagKey').disabled = false;
  if (q('#fastFlagValue')) q('#fastFlagValue').disabled = false;
  if (q('#fastFlagType')) q('#fastFlagType').disabled = false;
  if (q('#fastFlagQueueSet')) q('#fastFlagQueueSet').disabled = false;
  if (q('#fastFlagQueueRemove')) q('#fastFlagQueueRemove').disabled = false;
  renderFastFlagIntel(null);
  setFastFlagHint('Performance Center-owned keys are visible but locked here.');
  renderFastFlagList();
}

function getPreviewChange(key) {
  return state.fastFlags.preview?.changes?.find(change => change.key === key) || null;
}

function getFastFlagEntry(key) {
  if (state.fastFlags.pendingSet.has(key)) {
    const queued = state.fastFlags.pendingSet.get(key);
    const current = state.fastFlags.entries.find(item => item.key === key);
    const preview = getPreviewChange(key);
    return {
      ...(current || {}), ...(preview || {}), ...queued, key,
      value: preview?.after ?? queued.value,
      protected: current?.protected || false, pending: true,
      category: preview?.category || current?.category || 'Pending',
      description: preview?.description || current?.description || 'Pending FastFlag. Compatibility metadata will be resolved during preview.',
      warnings: preview?.warnings || current?.warnings || [],
      trust: preview?.trust || current?.trust || { level:'unknown', label:'UNKNOWN', severity:'neutral' }
    };
  }
  return state.fastFlags.entries.find(item => item.key === key) || null;
}

function selectFastFlag(key) {
  const entry = getFastFlagEntry(key);
  if (!entry) return;
  state.fastFlags.selectedKey = key;
  q('#fastFlagKey').value = entry.key;
  q('#fastFlagValue').value = entry.value ?? '';
  q('#fastFlagType').value = ['boolean', 'integer', 'float', 'string'].includes(entry.type) ? entry.type : 'auto';
  const locked = Boolean(entry.protected);
  q('#fastFlagKey').disabled = locked;
  q('#fastFlagValue').disabled = locked;
  q('#fastFlagType').disabled = locked;
  q('#fastFlagQueueSet').disabled = locked;
  q('#fastFlagQueueRemove').disabled = locked;
  renderFastFlagIntel(entry);
  setFastFlagHint(
    locked ? 'This key is owned by Performance Center. Edit it there.' : 'Edit the value, then queue the change for before/after review.',
    locked ? 'error' : ''
  );
  renderFastFlagList();
}

function matchesFastFlagFilters(item) {
  const term = (q('#fastFlagSearch')?.value || '').trim().toLowerCase();
  const category = q('#fastFlagCategoryFilter')?.value || '';
  if (category && item.category !== category) return false;
  if (!term) return true;
  return [item.key, item.value, item.category, item.description]
    .some(value => String(value || '').toLowerCase().includes(term));
}

function getFastFlagViewRows() {
  const map = new Map(state.fastFlags.entries.map(item => [item.key, { ...item }]));
  for (const [key, item] of state.fastFlags.pendingSet) {
    const current = map.get(key);
    const preview = getPreviewChange(key);
    map.set(key, {
      ...(current || {}), ...(preview || {}), ...item, key,
      value: preview?.after ?? item.value,
      protected: current?.protected || false, pending:true,
      category:preview?.category || current?.category || 'Pending',
      description:preview?.description || current?.description || '',
      warnings:preview?.warnings || current?.warnings || [],
      trust:preview?.trust || current?.trust || { level:'unknown', label:'UNKNOWN', severity:'neutral' }
    });
  }
  return [...map.values()].filter(matchesFastFlagFilters).sort((a,b)=>a.key.localeCompare(b.key));
}

function syncFastFlagBulkControls(rows = getFastFlagViewRows()) {
  const validKeys = new Set(rows.filter(item => !item.protected).map(item => item.key));
  for (const key of [...state.fastFlags.selectedKeys]) {
    const exists = state.fastFlags.entries.some(item => item.key === key) || state.fastFlags.pendingSet.has(key);
    const protectedKey = getFastFlagEntry(key)?.protected;
    if (!exists || protectedKey) state.fastFlags.selectedKeys.delete(key);
  }
  const count = state.fastFlags.selectedKeys.size;
  if (q('#fastFlagSelectionCount')) q('#fastFlagSelectionCount').textContent = `${count} SELECTED`;
  if (q('#fastFlagClearSelection')) q('#fastFlagClearSelection').disabled = count === 0;
  if (q('#fastFlagBulkTrue')) q('#fastFlagBulkTrue').disabled = count === 0;
  if (q('#fastFlagBulkFalse')) q('#fastFlagBulkFalse').disabled = count === 0;
  if (q('#fastFlagBulkRemove')) q('#fastFlagBulkRemove').disabled = count === 0;
  if (q('#fastFlagSelectFiltered')) q('#fastFlagSelectFiltered').disabled = validKeys.size === 0;
}

function renderFastFlagPending() {
  const list = q('#fastFlagPendingList');
  if (!list) return;
  list.replaceChildren();
  const pendingCount = fastFlagPendingCount();
  const preview = state.fastFlags.preview;
  const changes = preview?.ok ? (preview.changes || []) : [];
  q('#fastFlagPendingCount').textContent = String(changes.length || pendingCount);
  q('#fastFlagApplyPending').disabled = !preview?.ok || changes.length === 0;
  q('#fastFlagDiscardPending').disabled = pendingCount === 0;
  const warningBadge = q('#fastFlagPreviewWarnings');
  const conflictBadge = q('#fastFlagPreviewConflicts');
  if (warningBadge) {
    warningBadge.textContent = `${preview?.warningCount || 0} WARNINGS`;
    warningBadge.classList.toggle('active-warning', Boolean(preview?.warningCount));
  }
  if (conflictBadge) {
    conflictBadge.textContent = `${preview?.conflictCount || 0} CONFLICTS`;
    conflictBadge.classList.toggle('active-conflict', Boolean(preview?.conflictCount));
  }
  if (!pendingCount) {
    const empty = document.createElement('div'); empty.className = 'fastflag-empty'; empty.textContent = 'No pending changes.'; list.append(empty); return;
  }
  if (!preview) {
    const empty = document.createElement('div'); empty.className = 'fastflag-empty'; empty.textContent = 'Validating pending changes…'; list.append(empty); return;
  }
  if (!preview.ok) {
    const empty = document.createElement('div'); empty.className = 'fastflag-empty'; empty.textContent = preview.message || 'Pending changes are invalid.'; list.append(empty); return;
  }
  if (!changes.length) {
    const empty = document.createElement('div'); empty.className = 'fastflag-empty'; empty.textContent = 'Pending values already match the current file; there is nothing to write.'; list.append(empty); return;
  }
  for (const change of changes) {
    const row = document.createElement('div'); row.className = `fastflag-pending-item${change.action === 'REMOVE' ? ' remove' : ''}`;
    const action = document.createElement('b'); action.textContent = change.action;
    const diff = document.createElement('div'); diff.className = 'fastflag-diff';
    const key = document.createElement('span'); key.className = 'fastflag-diff-key'; key.textContent = `${change.key} · ${change.category || 'Other'}`;
    const values = document.createElement('span'); values.className = 'fastflag-diff-values';
    const before = document.createElement('em'); before.textContent = change.before === null ? '(not set)' : change.before;
    const arrow = document.createElement('i'); arrow.textContent = '→';
    const after = document.createElement('em'); after.textContent = change.after === null ? '(removed)' : change.after;
    values.append(before, arrow, after); diff.append(key, values);
    const warnings=(change.warnings || []).filter(w=>w.severity !== 'info');
    if (warnings.length) { const warn=document.createElement('span'); warn.className='fastflag-diff-warning'; warn.textContent=warnings.map(w=>w.message).join(' '); diff.append(warn); }
    row.append(action,diff); list.append(row);
  }
}

function renderFastFlagList() {
  const list = q('#fastFlagList');
  if (!list) return;
  const rows = getFastFlagViewRows();
  list.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement('div'); empty.className = 'fastflag-empty';
    empty.textContent = (q('#fastFlagSearch')?.value || q('#fastFlagCategoryFilter')?.value) ? 'No flags match the current filters.' : 'No ClientAppSettings flags are currently applied.';
    list.append(empty);
  }
  for (const item of rows) {
    const row = document.createElement('button'); row.type = 'button'; row.className = 'fastflag-row';
    if (state.fastFlags.selectedKey === item.key) row.classList.add('selected');
    if (state.fastFlags.selectedKeys.has(item.key)) row.classList.add('bulk-selected');
    if (state.fastFlags.pendingSet.has(item.key)) row.classList.add('pending');
    if (state.fastFlags.pendingRemove.has(item.key)) row.classList.add('removing');
    if ((item.warnings || []).some(w=>['warning','error'].includes(w.severity))) row.classList.add('has-warning');
    if (item.trust?.level) row.classList.add(`trust-${item.trust.level}`);
    row.dataset.key = item.key;

    const checkbox = document.createElement('input'); checkbox.type='checkbox'; checkbox.className='fastflag-selectbox'; checkbox.checked=state.fastFlags.selectedKeys.has(item.key); checkbox.disabled=Boolean(item.protected); checkbox.setAttribute('aria-label',`Select ${item.key}`);
    checkbox.addEventListener('click', event => event.stopPropagation());
    checkbox.addEventListener('change', () => { checkbox.checked ? state.fastFlags.selectedKeys.add(item.key) : state.fastFlags.selectedKeys.delete(item.key); renderFastFlagList(); });
    const key = document.createElement('span'); key.className = 'fastflag-key'; key.textContent = item.key;
    const category=document.createElement('span'); category.className='fastflag-category'; category.textContent=item.category || 'Other';
    const value = document.createElement('span'); value.className = 'fastflag-value'; value.textContent = String(item.value ?? '');
    const type = document.createElement('span'); type.className = 'fastflag-type'; type.textContent = item.type || 'string';
    const status = document.createElement('span'); status.className = 'fastflag-state-pill';
    if (item.protected) { status.classList.add('locked'); status.textContent = 'LOCKED'; status.title=`Performance Center owned · ${item.trust?.label || 'UNKNOWN'}`; }
    else if (state.fastFlags.pendingRemove.has(item.key)) { status.classList.add('changed'); status.textContent = 'REMOVE'; }
    else if (state.fastFlags.pendingSet.has(item.key)) { status.classList.add('changed'); status.textContent = 'PENDING'; }
    else if (item.trust?.level === 'safe') { status.classList.add('safe'); status.textContent='SAFE'; }
    else if (item.trust?.level === 'legacy') { status.classList.add('warning'); status.textContent='LEGACY'; }
    else if (item.trust?.level === 'experimental') { status.classList.add('danger'); status.textContent='CAUTION'; }
    else status.textContent = 'EDITABLE';
    row.append(checkbox,key,category,value,type,status);
    row.addEventListener('click', () => selectFastFlag(item.key)); list.append(row);
  }
  syncFastFlagBulkControls(rows);
  renderFastFlagPending();
}

function renderFastFlagCategories(categories = []) {
  state.fastFlags.categories = categories;
  const select=q('#fastFlagCategoryFilter'); if (!select) return;
  const current=select.value; select.replaceChildren();
  const all=document.createElement('option'); all.value=''; all.textContent='ALL CATEGORIES'; select.append(all);
  for (const name of categories) { const option=document.createElement('option'); option.value=name; option.textContent=name.toUpperCase(); select.append(option); }
  if (categories.includes(current)) select.value=current;
}

function renderFastFlagSafeCore(items = []) {
  state.fastFlags.safeCoreCatalog = Array.isArray(items) ? items : [];
  const list=q('#fastFlagSafeCoreList');
  if (!list) return;
  list.replaceChildren();
  if (!state.fastFlags.safeCoreCatalog.length) {
    const empty=document.createElement('div'); empty.className='fastflag-empty'; empty.textContent='Safe Core metadata is unavailable.'; list.append(empty); return;
  }
  for (const item of state.fastFlags.safeCoreCatalog) {
    const row=document.createElement('div'); row.className='fastflag-safe-core-row';
    const copy=document.createElement('div');
    const key=document.createElement('code'); key.textContent=item.key;
    const note=document.createElement('span'); note.textContent=item.protected ? `Recommended ${item.recommendedValue} · Performance Center owned` : `Recommended ${item.recommendedValue}`;
    copy.append(key,note);
    const badge=document.createElement('b'); badge.textContent=item.protected ? 'LOCKED' : 'SAFE'; badge.className=item.protected ? 'locked' : 'safe';
    row.append(copy,badge); list.append(row);
  }
}

async function queueFastFlagSafeCore() {
  const catalog=state.fastFlags.safeCoreCatalog || [];
  if (!catalog.length) { showToast('Safe Core metadata is unavailable.',true); return; }
  let queued=0, locked=0;
  for (const item of catalog) {
    if (item.protected) { locked++; continue; }
    state.fastFlags.pendingRemove.delete(item.key);
    state.fastFlags.pendingSet.set(item.key,{key:item.key,value:item.recommendedValue,type:item.type || 'auto'});
    queued++;
  }
  renderFastFlagList();
  await refreshFastFlagPreview();
  showToast(`Queued ${queued} editable Safe Core flag${queued===1?'':'s'} for review${locked?`; ${locked} Performance Center-owned flag left locked`:''}.`);
}

function renderFastFlagSnapshots(items = []) {
  state.fastFlags.snapshots = items;
  const select=q('#fastFlagSnapshotSelect'); if (!select) return;
  const current=select.value; select.replaceChildren();
  const empty=document.createElement('option'); empty.value=''; empty.textContent=items.length ? 'Select automatic snapshot' : 'No automatic snapshots'; select.append(empty);
  for (const item of items) {
    const option=document.createElement('option'); option.value=item.id;
    const date=new Date(item.createdAt); const when=Number.isNaN(date.getTime()) ? item.createdAt : date.toLocaleString();
    option.textContent=`${when} · ${item.flagCount} flags · ${item.reason}`; select.append(option);
  }
  if (items.some(item=>item.id===current)) select.value=current;
  q('#fastFlagSnapshotCount').textContent=String(items.length);
  q('#fastFlagSnapshotRestore').disabled=!select.value;
}

function renderFastFlagState(result) {
  if (!result?.ok) {
    state.fastFlags.entries=[]; state.fastFlags.path=result?.path || ''; state.fastFlags.selectedKeys.clear();
    q('#fastFlagCount').textContent='UNAVAILABLE'; q('#fastFlagPath').textContent=result?.path || 'Roblox Player not detected';
    q('#fastFlagBackupState').textContent='Unavailable'; q('#fastFlagEditableCount').textContent='0'; q('#fastFlagProtectedCount').textContent='0 locked';
    q('#fastFlagSafeCoreCount').textContent='0'; q('#fastFlagLegacyCount').textContent='0'; q('#fastFlagWarningCount').textContent='0'; q('#fastFlagConflictCount').textContent='0'; q('#fastFlagRestoreBackup').disabled=true;
    renderFastFlagCategories([]); renderFastFlagSafeCore([]); renderFastFlagSnapshots([]); renderFastFlagList(); return;
  }
  state.fastFlags.entries=result.entries || []; state.fastFlags.path=result.path || ''; state.fastFlags.backupExists=Boolean(result.backupExists);
  q('#fastFlagCount').textContent=`${result.total || 0} FLAGS`; q('#fastFlagPath').textContent=result.path || '—';
  q('#fastFlagBackupState').textContent=result.backupExists ? 'Available' : 'Not created'; q('#fastFlagEditableCount').textContent=String(result.editableCount || 0);
  q('#fastFlagProtectedCount').textContent=`${result.protectedCount || 0} locked`; q('#fastFlagSafeCoreCount').textContent=String(result.safeCoreCount || 0); q('#fastFlagLegacyCount').textContent=String(result.legacyCount || 0); q('#fastFlagWarningCount').textContent=String(result.warningCount || 0); q('#fastFlagConflictCount').textContent=String(result.conflictCount || 0);
  q('#fastFlagRestoreBackup').disabled=!result.backupExists;
  renderFastFlagCategories(result.categories || []); renderFastFlagSafeCore(result.safeCoreCatalog || []); renderFastFlagSnapshots(result.snapshots || []);
  if (state.fastFlags.selectedKey) renderFastFlagIntel(getFastFlagEntry(state.fastFlags.selectedKey));
  renderFastFlagList();
}

async function refreshFastFlags(announce = false) {
  try {
    const result=await window.dragonStrap.getFastFlagsState(); renderFastFlagState(result);
    if (announce) showToast(result.ok ? 'FastFlag state refreshed.' : (result.message || 'FastFlag state unavailable.'), !result.ok);
    return result;
  } catch(error) { console.error(error); if (announce) showToast('FastFlag state could not be read.',true); return null; }
}

async function refreshFastFlagPreview() {
  if (fastFlagPendingCount()===0) { state.fastFlags.preview={ok:true,changes:[],warningCount:0,conflictCount:0}; renderFastFlagList(); return state.fastFlags.preview; }
  state.fastFlags.preview=null; renderFastFlagPending();
  try { state.fastFlags.preview=await window.dragonStrap.previewFastFlags(fastFlagPendingPatch()); }
  catch(error) { state.fastFlags.preview={ok:false,message:error.message || 'FastFlag preview failed.',changes:[]}; }
  if (state.fastFlags.selectedKey) renderFastFlagIntel(getFastFlagEntry(state.fastFlags.selectedKey));
  renderFastFlagList(); return state.fastFlags.preview;
}

async function queueFastFlagSet() {
  const key=q('#fastFlagKey').value.trim(); const value=q('#fastFlagValue').value; const type=q('#fastFlagType').value;
  if (!/^[A-Za-z][A-Za-z0-9_]{1,159}$/.test(key)) { setFastFlagHint('Enter a valid flag name: letters/numbers/underscores, starting with a letter.','error'); return; }
  const existing=state.fastFlags.entries.find(item=>item.key===key); if (existing?.protected) { setFastFlagHint('This key is managed by Performance Center and cannot be queued here.','error'); return; }
  state.fastFlags.pendingRemove.delete(key); state.fastFlags.pendingSet.set(key,{key,value,type}); state.fastFlags.selectedKey=key;
  setFastFlagHint('Change queued. DragonStrap is validating the normalized before/after diff.','ok'); renderFastFlagList(); await refreshFastFlagPreview();
}

async function queueFastFlagRemove() {
  const key=q('#fastFlagKey').value.trim(); if (!key) { setFastFlagHint('Select or enter a flag first.','error'); return; }
  const existing=state.fastFlags.entries.find(item=>item.key===key); if (existing?.protected) { setFastFlagHint('Performance Center keys cannot be removed here.','error'); return; }
  if (!existing && state.fastFlags.pendingSet.has(key)) { state.fastFlags.pendingSet.delete(key); clearFastFlagEditor(); await refreshFastFlagPreview(); return; }
  state.fastFlags.pendingSet.delete(key); state.fastFlags.pendingRemove.add(key); setFastFlagHint('Removal queued. Nothing is deleted until Apply Changes.','ok'); renderFastFlagList(); await refreshFastFlagPreview();
}

function selectFilteredFastFlags() {
  for (const item of getFastFlagViewRows()) if (!item.protected) state.fastFlags.selectedKeys.add(item.key);
  renderFastFlagList();
}
function clearFastFlagSelection(){ state.fastFlags.selectedKeys.clear(); renderFastFlagList(); }
async function bulkSetFastFlagBoolean(value) {
  let changed=0, skipped=0;
  for (const key of state.fastFlags.selectedKeys) {
    const entry=getFastFlagEntry(key); if (!entry || entry.protected) continue;
    if (entry.type!=='boolean') { skipped++; continue; }
    state.fastFlags.pendingRemove.delete(key); state.fastFlags.pendingSet.set(key,{key,value,type:'boolean'}); changed++;
  }
  if (!changed) { showToast('No selected editable Boolean flags to change.',true); return; }
  renderFastFlagList(); await refreshFastFlagPreview(); showToast(`Queued ${changed} Boolean flag${changed===1?'':'s'} as ${value}${skipped?`; ${skipped} non-Boolean skipped`:''}.`);
}
async function bulkRemoveFastFlags() {
  let changed=0;
  for (const key of [...state.fastFlags.selectedKeys]) {
    const entry=getFastFlagEntry(key); if (!entry || entry.protected) continue;
    if (!state.fastFlags.entries.some(item=>item.key===key) && state.fastFlags.pendingSet.has(key)) state.fastFlags.pendingSet.delete(key);
    else { state.fastFlags.pendingSet.delete(key); state.fastFlags.pendingRemove.add(key); }
    changed++;
  }
  if (!changed) return;
  renderFastFlagList(); await refreshFastFlagPreview(); showToast(`Queued ${changed} selected flag${changed===1?'':'s'} for removal.`);
}

async function applyFastFlagPending() {
  if (fastFlagPendingCount()===0) return;
  const button=q('#fastFlagApplyPending'); button.disabled=true;
  try {
    const preview=await refreshFastFlagPreview(); if (!preview?.ok || !(preview.changes||[]).length) { showToast(preview?.message || 'There are no valid FastFlag changes to apply.',true); return; }
    const result=await window.dragonStrap.applyFastFlags(fastFlagPendingPatch());
    if (!result.ok) { showToast(result.message || 'FastFlag changes could not be applied.',true); setFastFlagHint(result.message || 'Apply failed.','error'); return; }
    state.fastFlags.pendingSet.clear(); state.fastFlags.pendingRemove.clear(); state.fastFlags.selectedKeys.clear(); state.fastFlags.preview=null; clearFastFlagEditor();
    await Promise.all([refreshFastFlags(false),refreshPerformanceState(false)]);
    const snapshot=result.snapshot ? ' Automatic pre-change snapshot created.' : '';
    showToast(`FastFlags applied: ${result.setCount} set, ${result.removeCount} removed.${snapshot}`);
  } finally { button.disabled=false; }
}

async function discardFastFlagPending() {
  state.fastFlags.pendingSet.clear(); state.fastFlags.pendingRemove.clear(); state.fastFlags.preview=null; clearFastFlagEditor(); await refreshFastFlagPreview(); showToast('Pending FastFlag changes discarded.');
}

async function importFastFlags() {
  const result=await window.dragonStrap.importFastFlags(); if (!result || result.canceled) return; if (!result.ok) { showToast(result.message || 'FastFlag import failed.',true); return; }
  for (const item of result.entries || []) { state.fastFlags.pendingRemove.delete(item.key); state.fastFlags.pendingSet.set(item.key,{key:item.key,value:item.value,type:item.type || 'auto'}); }
  await refreshFastFlagPreview();
  const notes=[]; if (result.ignoredProtected?.length) notes.push(`${result.ignoredProtected.length} Performance Center key(s) ignored`); if (result.errors?.length) notes.push(`${result.errors.length} invalid entr${result.errors.length===1?'y':'ies'} skipped`);
  showToast(`Imported ${result.entries?.length || 0} flag(s) to pending${notes.length?`; ${notes.join(', ')}`:''}.`,Boolean(result.errors?.length));
}
async function exportFastFlags(){ const result=await window.dragonStrap.exportFastFlags(); if (!result || result.canceled) return; showToast(result.ok?`Exported ${result.count} FastFlags.`:(result.message || 'FastFlag export failed.'),!result.ok); }

async function restoreFastFlagsBackup() {
  const result=await window.dragonStrap.restoreFastFlagsBackup(); if (!result.ok) { showToast(result.message || 'Backup restore failed.',true); return; }
  state.fastFlags.pendingSet.clear(); state.fastFlags.pendingRemove.clear(); state.fastFlags.selectedKeys.clear(); state.fastFlags.preview=null; clearFastFlagEditor();
  await Promise.all([refreshFastFlags(false),refreshPerformanceState(false)]); showToast(`FastFlag backup restored (${result.total} flags). A pre-restore automatic snapshot was preserved.`);
}

function syncFastFlagPresetButtons() {
  const has=Boolean(q('#fastFlagPresetSelect')?.value);
  if (q('#fastFlagPresetLoad')) q('#fastFlagPresetLoad').disabled=!has;
  if (q('#fastFlagPresetShare')) q('#fastFlagPresetShare').disabled=!has;
  if (q('#fastFlagPresetDelete')) q('#fastFlagPresetDelete').disabled=!has;
}
function renderFastFlagPresets(items = []) {
  state.fastFlags.presets=items; const select=q('#fastFlagPresetSelect'); if (!select) return; const current=select.value; select.replaceChildren();
  const empty=document.createElement('option'); empty.value=''; empty.textContent=items.length?'Select a saved preset':'No saved presets'; select.append(empty);
  for (const item of items) { const option=document.createElement('option'); option.value=item.id; option.textContent=`${item.name} (${item.flagCount} flags)${item.shared?' · shared':''}`; select.append(option); }
  if (items.some(item=>item.id===current)) select.value=current;
  syncFastFlagPresetButtons();
}
async function loadFastFlagPresets(){ try { renderFastFlagPresets(await window.dragonStrap.listFastFlagPresets()); } catch(error){ console.error(error); } }
async function saveFastFlagPreset(){
  const name=q('#fastFlagPresetName').value.trim(); if (!name) { showToast('Enter a preset name first.',true); q('#fastFlagPresetName').focus(); return; }
  const result=await window.dragonStrap.saveFastFlagPreset(name); if (!result.ok) { showToast(result.message || 'Preset could not be saved.',true); return; }
  q('#fastFlagPresetName').value=''; renderFastFlagPresets(result.items || []); if (result.preset?.id) q('#fastFlagPresetSelect').value=result.preset.id; syncFastFlagPresetButtons();
  showToast(`Saved FastFlag preset “${result.preset.name}”.`);
}
async function loadFastFlagPresetToPending(){
  const id=q('#fastFlagPresetSelect').value; if (!id) { showToast('Choose a preset first.',true); return; }
  const result=await window.dragonStrap.getFastFlagPreset(id); if (!result.ok) { showToast(result.message || 'Preset could not be loaded.',true); return; }
  const flags=result.preset.flags || {}; state.fastFlags.pendingSet.clear(); state.fastFlags.pendingRemove.clear();
  for (const entry of state.fastFlags.entries) if (!entry.protected && !Object.hasOwn(flags,entry.key)) state.fastFlags.pendingRemove.add(entry.key);
  for (const [key,value] of Object.entries(flags)) state.fastFlags.pendingSet.set(key,{key,value,type:'auto'});
  clearFastFlagEditor(); await refreshFastFlagPreview(); showToast(`Preset “${result.preset.name}” staged as an exact editable snapshot.`);
}
async function deleteFastFlagPreset(){ const id=q('#fastFlagPresetSelect').value; if (!id) { showToast('Choose a preset first.',true); return; } const result=await window.dragonStrap.deleteFastFlagPreset(id); renderFastFlagPresets(result.items || []); showToast(result.deleted?'FastFlag preset deleted.':'Preset was already unavailable.',!result.deleted); }
async function exportFastFlagPresetShare(){
  const id=q('#fastFlagPresetSelect').value; if (!id) { showToast('Choose a preset first.',true); return; }
  const result=await window.dragonStrap.exportFastFlagPresetShare(id); if (!result || result.canceled) return; showToast(result.ok?`Shared preset exported with ${result.count} flags.`:(result.message || 'Preset export failed.'),!result.ok);
}
async function importFastFlagPresetShare(){
  const result=await window.dragonStrap.importFastFlagPresetShare(); if (!result || result.canceled) return; if (!result.ok) { showToast(result.message || 'Shared preset import failed.',true); return; }
  renderFastFlagPresets(result.items || []); if (result.preset?.id) q('#fastFlagPresetSelect').value=result.preset.id; syncFastFlagPresetButtons();
  const ignored=result.ignoredProtected?.length ? ` ${result.ignoredProtected.length} Performance Center key(s) were excluded.` : '';
  showToast(`Imported shared preset “${result.preset.name}”.${ignored}`);
}

async function restoreFastFlagSnapshot(){
  const id=q('#fastFlagSnapshotSelect').value; if (!id) { showToast('Choose an automatic snapshot first.',true); return; }
  if (!window.confirm('Restore this FastFlag snapshot? Current Performance+ owned values will be preserved.')) return;
  const result=await window.dragonStrap.restoreFastFlagSnapshot(id); if (!result.ok) { showToast(result.message || 'Snapshot restore failed.',true); return; }
  state.fastFlags.pendingSet.clear(); state.fastFlags.pendingRemove.clear(); state.fastFlags.selectedKeys.clear(); state.fastFlags.preview=null; clearFastFlagEditor();
  await Promise.all([refreshFastFlags(false),refreshPerformanceState(false)]); showToast(`Snapshot restored. ${result.protectedPreserved} Performance+ value(s) preserved.`);
}

function formatServerUptime(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return '—';
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${Math.max(0, minutes)}m`;
}

function serverPingClass(ping) {
  const value = Number(ping);
  if (!Number.isFinite(value)) return '';
  if (value <= 80) return 'good';
  if (value <= 160) return 'warn';
  return 'bad';
}

function formatServerTimestamp(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function renderServerRegionStrip(stats) {
  const strip = q('#serverRegionStrip');
  if (!strip) return;
  strip.replaceChildren();
  const regions = Object.entries(stats?.regions || {}).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 16);
  if (!regions.length) {
    const empty = document.createElement('span');
    empty.textContent = 'No RoValra region data available for this sample.';
    strip.append(empty);
    return;
  }
  for (const [name, count] of regions) {
    const chip = document.createElement('span');
    chip.append(document.createTextNode(name));
    const number = document.createElement('strong');
    number.textContent = String(count);
    chip.append(number);
    strip.append(chip);
  }
}

function serverMatchesOccupancy(server, filter) {
  if (!filter || filter === 'any') return true;
  return server.occupancyBand === filter;
}

function filteredServerRows() {
  const items = [...(state.servers.result?.servers || [])];
  const term = (q('#serverFilterInput')?.value || '').trim().toLowerCase();
  const occupancy = q('#serverOccupancySelect')?.value || 'any';
  const favoritesOnly = Boolean(q('#serverFavoritesOnly')?.checked);
  const hideFull = Boolean(q('#serverHideFull')?.checked);
  const sort = q('#serverSortSelect')?.value || 'ping';
  const filtered = items.filter(server => {
    if (!serverMatchesOccupancy(server, occupancy)) return false;
    if (favoritesOnly && !server.favorite) return false;
    if (hideFull && (server.occupancyBand === 'full' || Number(server.availableSlots || 0) <= 0)) return false;
    if (!term) return true;
    return [server.region, server.regionGroup, server.city, server.regionName, server.country, server.datacenterId, server.id]
      .some(value => String(value || '').toLowerCase().includes(term));
  });
  filtered.sort((a, b) => {
    if (sort === 'players') return Number(b.playing || 0) - Number(a.playing || 0);
    if (sort === 'space') return Number(b.availableSlots || 0) - Number(a.availableSlots || 0);
    if (sort === 'occupancy') return Number(a.occupancyPercent || 0) - Number(b.occupancyPercent || 0);
    if (sort === 'history') {
      const ap = Number.isFinite(Number(a.latencyHistory?.average)) ? Number(a.latencyHistory.average) : Number.POSITIVE_INFINITY;
      const bp = Number.isFinite(Number(b.latencyHistory?.average)) ? Number(b.latencyHistory.average) : Number.POSITIVE_INFINITY;
      return ap - bp;
    }
    if (sort === 'uptime') return Number(b.uptimeSeconds || -1) - Number(a.uptimeSeconds || -1);
    if (sort === 'region') return String(a.region || 'zzzz').localeCompare(String(b.region || 'zzzz'));
    const ap = Number.isFinite(Number(a.ping)) ? Number(a.ping) : Number.POSITIVE_INFINITY;
    const bp = Number.isFinite(Number(b.ping)) ? Number(b.ping) : Number.POSITIVE_INFINITY;
    return ap - bp;
  });
  return filtered;
}

function serverSnapshot(server) {
  return {
    id:server.id,
    region:server.region || null,
    city:server.city || null,
    regionName:server.regionName || null,
    country:server.country || null,
    datacenterId:server.datacenterId ?? null,
    ping:Number.isFinite(Number(server.ping)) ? Number(server.ping) : null,
    playing:Number.isFinite(Number(server.playing)) ? Number(server.playing) : null,
    maxPlayers:Number.isFinite(Number(server.maxPlayers)) ? Number(server.maxPlayers) : null
  };
}

async function joinServerIntelligence(placeId, server, button = null) {
  if (!placeId || !server?.id) return;
  const original = button?.textContent;
  if (button) { button.disabled = true; button.textContent = 'JOINING…'; }
  try {
    const launched = await launchPlayer({ target:String(placeId), gameInstanceId:server.id });
    if (!launched?.ok) return;
    const saved = await window.dragonStrap.recordServerJoin(String(placeId), serverSnapshot(server));
    if (saved?.ok) {
      state.servers.saved.recent = saved.recent || state.servers.saved.recent;
      if (state.servers.result?.saved) state.servers.result.saved.recent = state.servers.saved.recent;
      renderServerSavedLists();
    }
    showToast(`Joining ${server.region || 'selected Roblox server'}.`);
  } finally {
    if (button) { button.textContent = original || 'JOIN'; button.disabled = !state.roblox?.installed; }
  }
}

function makeServerMiniRow(item, kind) {
  const row = document.createElement('div');
  row.className = 'server-mini-row';
  const text = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = item.region || `Place ${item.placeId}`;
  const meta = document.createElement('small');
  const stamp = kind === 'recent' ? ` • ${formatServerTimestamp(item.joinedAt)}` : '';
  meta.textContent = `Place ${item.placeId} • ${item.ping == null ? 'ping —' : `${Math.round(item.ping)} ms`}${stamp}`;
  text.append(title, meta);
  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'server-mini-action';
  action.textContent = kind === 'recent' ? 'REJOIN' : 'JOIN';
  action.disabled = !state.roblox?.installed;
  action.addEventListener('click', () => joinServerIntelligence(item.placeId, { ...item, id:item.serverId }, action));
  row.append(text, action);
  return row;
}

function renderServerSavedLists() {
  const saved = state.servers.saved || { favorites:[], recent:[] };
  const favorites = q('#serverFavoritesList');
  const recent = q('#serverRecentList');
  if (favorites) {
    favorites.replaceChildren();
    if (!saved.favorites?.length) {
      const empty = document.createElement('div'); empty.className = 'server-mini-empty'; empty.textContent = 'No favorite servers yet.'; favorites.append(empty);
    } else saved.favorites.slice(0, 8).forEach(item => favorites.append(makeServerMiniRow(item, 'favorite')));
  }
  if (recent) {
    recent.replaceChildren();
    if (!saved.recent?.length) {
      const empty = document.createElement('div'); empty.className = 'server-mini-empty'; empty.textContent = 'No recent server joins yet.'; recent.append(empty);
    } else saved.recent.slice(0, 8).forEach(item => recent.append(makeServerMiniRow(item, 'recent')));
  }
}

function renderServerProviderDiagnostics() {
  const container = q('#serverProviderDiagnostics');
  if (!container) return;
  container.replaceChildren();
  const health = state.servers.result?.providerHealth || state.servers.saved?.providerHealth || {};
  const preferred = ['roblox','rovalraDetails','rovalraCounts'];
  const entries = preferred.map(key => [key, health[key]]).filter(([,value]) => value);
  if (!entries.length) {
    const empty = document.createElement('div'); empty.className = 'server-mini-empty'; empty.textContent = 'Run a lookup to populate diagnostics.'; container.append(empty); return;
  }
  for (const [, info] of entries) {
    const row = document.createElement('div'); row.className = `server-health-row ${info.ok ? 'healthy' : 'failed'}`;
    const name = document.createElement('div'); const strong = document.createElement('strong'); strong.textContent = info.label || 'Provider';
    const small = document.createElement('small'); small.textContent = `${info.ok ? 'Online' : `Failed ×${info.consecutiveFailures || 1}`} • ${info.durationMs == null ? 'timing —' : `${info.durationMs} ms`} • ${formatServerTimestamp(info.lastCheckAt)}`;
    name.append(strong, small);
    const badge = document.createElement('span'); badge.textContent = info.ok ? 'ONLINE' : 'DEGRADED';
    row.title = info.lastError || '';
    row.append(name, badge); container.append(row);
  }
}

function renderServerComparison() {
  const container = q('#serverCompareList');
  if (!container) return;
  container.replaceChildren();
  const servers = state.servers.result?.servers || [];
  const selected = [...state.servers.compareIds].map(id => servers.find(server => server.id === id)).filter(Boolean);
  state.servers.compareIds = new Set(selected.map(server => server.id));
  if (!selected.length) {
    const empty = document.createElement('div'); empty.className = 'server-mini-empty'; empty.textContent = 'No servers selected for comparison.'; container.append(empty); return;
  }
  const validPings = selected.map(server => Number(server.ping)).filter(Number.isFinite);
  const bestPing = validPings.length ? Math.min(...validPings) : null;
  for (const server of selected) {
    const card = document.createElement('div'); card.className = 'server-compare-item';
    const heading = document.createElement('div'); heading.className = 'server-compare-heading';
    const title = document.createElement('strong'); title.textContent = server.region || 'Region unavailable';
    const close = document.createElement('button'); close.type = 'button'; close.textContent = '×'; close.title = 'Remove from comparison';
    close.addEventListener('click', () => { state.servers.compareIds.delete(server.id); renderServerComparison(); renderServerList(); });
    heading.append(title, close);
    const metrics = document.createElement('div'); metrics.className = 'server-compare-metrics';
    const pairs = [
      ['PING', Number.isFinite(Number(server.ping)) ? `${Math.round(server.ping)} ms${bestPing === Number(server.ping) ? ' • BEST' : ''}` : '—'],
      ['HISTORY', server.latencyHistory?.average == null ? 'No history' : `${server.latencyHistory.average} ms avg • ${server.latencyHistory.samples} samples`],
      ['OCCUPANCY', `${server.playing}/${server.maxPlayers} • ${server.occupancyPercent}%`],
      ['UPTIME', formatServerUptime(server.uptimeSeconds)],
      ['DATACENTER', server.datacenterId == null ? '—' : String(server.datacenterId)]
    ];
    for (const [label,value] of pairs) { const box=document.createElement('div'); const l=document.createElement('span');l.textContent=label;const v=document.createElement('b');v.textContent=value;box.append(l,v);metrics.append(box); }
    const join=document.createElement('button'); join.type='button'; join.className='server-join'; join.textContent='JOIN THIS SERVER'; join.disabled=!state.roblox?.installed; join.addEventListener('click',()=>joinServerIntelligence(state.servers.result.placeId,server,join));
    card.append(heading,metrics,join); container.append(card);
  }
}

async function toggleServerFavorite(server, button) {
  const placeId = state.servers.result?.placeId;
  if (!placeId) return;
  button.disabled = true;
  try {
    const result = await window.dragonStrap.toggleServerFavorite(String(placeId), serverSnapshot(server));
    if (!result?.ok) { showToast(result?.message || 'Favorite could not be updated.', true); return; }
    server.favorite = result.favorite;
    state.servers.saved.favorites = result.favorites || [];
    if (state.servers.result?.saved) state.servers.result.saved.favorites = state.servers.saved.favorites;
    renderServerSavedLists(); renderServerList(); renderServerComparison();
    showToast(result.favorite ? 'Server added to favorites.' : 'Server removed from favorites.');
  } finally { button.disabled = false; }
}

function renderServerList() {
  const list = q('#serverList');
  if (!list) return;
  list.replaceChildren();
  const result = state.servers.result;
  if (!result?.ok) {
    const empty = document.createElement('div');
    empty.className = `server-empty-state${result ? ' server-error' : ''}`;
    empty.textContent = result?.message || 'Server Intelligence 2.0 is ready. Run a lookup to begin.';
    list.append(empty); return;
  }
  const rows = filteredServerRows();
  if (!rows.length) {
    const empty = document.createElement('div'); empty.className='server-empty-state';
    empty.textContent = result.servers?.length ? 'No servers match the current filters.' : 'No public servers were returned for this place.';
    list.append(empty); return;
  }

  for (const server of rows) {
    const row = document.createElement('div'); row.className = `server-row${server.favorite ? ' favorite' : ''}${state.servers.compareIds.has(server.id) ? ' comparing' : ''}`;
    const favorite = document.createElement('button'); favorite.type='button'; favorite.className='server-favorite'; favorite.textContent=server.favorite?'★':'☆'; favorite.title=server.favorite?'Remove favorite':'Add favorite'; favorite.addEventListener('click',()=>toggleServerFavorite(server,favorite));

    const region = document.createElement('div'); region.className='server-region';
    const regionTitle=document.createElement('strong'); regionTitle.textContent=server.region || 'Region unavailable';
    const regionMeta=document.createElement('small'); regionMeta.textContent=server.datacenterId ? `${server.regionGroup || server.country || 'Location'} • DC ${server.datacenterId}` : (server.regionGroup || server.country || 'RoValra data unavailable');
    region.append(regionTitle,regionMeta);

    const players=document.createElement('span'); players.className='server-metric server-occupancy'; players.textContent=`${server.playing ?? 0}/${server.maxPlayers ?? 0}`; players.title=`${server.occupancyPercent ?? 0}% occupied • ${server.availableSlots ?? 0} open slots`;

    const latency=document.createElement('div'); latency.className='server-latency';
    const ping=document.createElement('strong'); ping.className=serverPingClass(server.ping); ping.textContent=Number.isFinite(Number(server.ping))?`${Math.round(server.ping)} ms`:'—';
    const history=document.createElement('small');
    if (server.latencyHistory?.samples) history.textContent=`avg ${server.latencyHistory.average} • ${server.latencyHistory.trend}`;
    else history.textContent='first sample';
    latency.append(ping,history);

    const uptime=document.createElement('span'); uptime.className='server-metric server-uptime'; uptime.textContent=formatServerUptime(server.uptimeSeconds); if(server.uptimeSeconds!=null&&server.uptimeEstimate)uptime.title='Estimated from RoValra first-seen time';
    const version=document.createElement('span'); version.className='server-metric server-version'; version.textContent=server.placeVersion==null?'—':`v${server.placeVersion}`;
    const id=document.createElement('span'); id.className='server-id'; id.textContent=server.id; id.title=server.id;

    const actions=document.createElement('div'); actions.className='server-actions';
    const compare=document.createElement('button'); compare.type='button'; compare.className='server-compare-toggle'; compare.textContent=state.servers.compareIds.has(server.id)?'SELECTED':'COMPARE';
    compare.addEventListener('click',()=>{
      if(state.servers.compareIds.has(server.id)) state.servers.compareIds.delete(server.id);
      else if(state.servers.compareIds.size>=3){showToast('Compare up to 3 servers at a time.',true);return;} else state.servers.compareIds.add(server.id);
      renderServerComparison(); renderServerList();
    });
    const join=document.createElement('button'); join.type='button'; join.className='server-join'; join.textContent='JOIN'; join.disabled=state.launchPending||!state.roblox?.installed; join.addEventListener('click',()=>joinServerIntelligence(result.placeId,server,join));
    actions.append(compare,join);
    row.append(favorite,region,players,latency,uptime,version,id,actions); list.append(row);
  }
}

function renderServerIntelligence(result) {
  state.servers.result = result;
  if (result?.saved) state.servers.saved = { ...state.servers.saved, ...result.saved };
  const pill=q('#serverProviderPill'); pill?.classList.remove('online','degraded');
  if (!result?.ok) {
    if(pill){pill.textContent='ERROR';pill.classList.add('degraded');}
    q('#serverTotalCount').textContent='—'; q('#serverLoadedCount').textContent='—'; q('#serverAveragePing').textContent='—'; q('#serverOpenSlots').textContent='—';
    q('#serverProviderState').textContent='ERROR'; q('#serverLookupSummary').textContent=result?.message||'Server lookup failed.';
    renderServerRegionStrip(null); renderServerProviderDiagnostics(); renderServerSavedLists(); renderServerComparison(); renderServerList(); return;
  }

  const rovalraOk=result.providers?.rovalra?.ok===true;
  const rovalraPartial=result.providers?.rovalra?.partial===true;
  if(pill){pill.textContent=rovalraOk?'ROVALRA ONLINE':(rovalraPartial?'ROVALRA PARTIAL':'ROVALRA DEGRADED');pill.classList.add(rovalraOk?'online':'degraded');}
  q('#serverTotalCount').textContent=Number(result.stats?.totalServers??0).toLocaleString();
  q('#serverLoadedCount').textContent=Number(result.stats?.loadedServers??0).toLocaleString();
  q('#serverAveragePing').textContent=result.stats?.averagePing==null?'—':`${result.stats.averagePing} ms`;
  q('#serverOpenSlots').textContent=Number(result.stats?.openSlots??0).toLocaleString();
  q('#serverProviderState').textContent=rovalraOk?'ONLINE':(rovalraPartial?'PARTIAL':'DEGRADED');
  const stamp=new Date(result.fetchedAt);
  q('#serverLookupSummary').textContent=`Place ${result.placeId} • ${result.stats?.loadedServers||0} loaded • ${result.stats?.regionCount||0} regions${Number.isNaN(stamp.getTime())?'':` • ${stamp.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`}${result.cached?' • cached':''}`;
  q('#serverRefreshBtn').disabled=false;
  renderServerRegionStrip(result.stats); renderServerSavedLists(); renderServerProviderDiagnostics(); renderServerComparison(); renderServerList();
}

async function refreshServerSavedState(placeId = null) {
  try {
    const saved=await window.dragonStrap.getServerSavedState(placeId || state.servers.result?.placeId || null);
    if(saved) state.servers.saved={ ...state.servers.saved, ...saved };
    renderServerSavedLists(); renderServerProviderDiagnostics();
  } catch(error){ console.error(error); }
}

async function lookupServerIntelligence(force=false) {
  if(state.servers.loading)return;
  const target=q('#serverPlaceInput')?.value.trim();
  if(!target){showToast('Enter a Roblox Place ID or game URL first.',true);q('#serverPlaceInput')?.focus();return;}
  state.servers.loading=true; q('#serverLookupBtn').disabled=true; q('#serverRefreshBtn').disabled=true; q('#serverProviderPill').textContent='LOADING'; q('#serverProviderPill').classList.remove('online','degraded'); q('#serverBrowserCard')?.classList.add('server-loading'); q('#serverLookupSummary').textContent='Loading Roblox public servers, region data, and latency intelligence…'; localStorage.setItem('dragonstrap.serverPlace',target);
  try{
    const result=await window.dragonStrap.getServerIntelligence(target,{force});
    if(state.servers.result?.placeId!==result?.placeId) state.servers.compareIds.clear();
    renderServerIntelligence(result);
    if(!result.ok)showToast(result.message||'Server lookup failed.',true);
    else if(result.providers?.rovalra?.ok===false)showToast(result.providers?.rovalra?.partial?'Servers loaded with partial RoValra enrichment.':'Roblox servers loaded; RoValra enrichment is unavailable.',true);
    else showToast(`Loaded ${result.servers?.length||0} public servers for Place ${result.placeId}.`);
  }catch(error){console.error(error);renderServerIntelligence({ok:false,message:'Server Intelligence request failed.'});showToast('Server Intelligence request failed.',true);}
  finally{state.servers.loading=false;q('#serverLookupBtn').disabled=false;q('#serverRefreshBtn').disabled=!state.servers.result?.ok;q('#serverBrowserCard')?.classList.remove('server-loading');}
}

async function refreshCoreState(announce=false) {
  if (state.core.loading) return state.core.data;
  state.core.loading=true;
  try {
    const data=await window.dragonStrap.getCoreState();
    state.core.data=data;
    const registry=data?.registry || {};
    const operations=data?.operations || {};
    const plugins=data?.plugins || {};
    const pipeline=data?.pipeline || {};
    if(q('#coreApiVersion'))q('#coreApiVersion').textContent=data?.apiVersion || window.dragonStrap.apiVersion || '2.0.0';
    if(q('#aboutCoreApi'))q('#aboutCoreApi').textContent=data?.apiVersion || window.dragonStrap.apiVersion || '2.0.0';
    if(q('#coreServiceCount'))q('#coreServiceCount').textContent=String(registry.count ?? '—');
    if(q('#coreOperationState'))q('#coreOperationState').textContent=operations.busy ? (operations.active?.label || operations.active?.kind || 'BUSY') : 'IDLE';
    if(q('#corePipelineState'))q('#corePipelineState').textContent=operations.busy ? 'LOCKED' : (pipeline?.player?.installed ? 'READY' : 'PLAYER MISSING');
    if(q('#coreExtensionCount'))q('#coreExtensionCount').textContent=String(plugins.extensionPoints?.length ?? 0);
    if(q('#corePluginState'))q('#corePluginState').textContent=plugins.externalLoadingEnabled ? 'ENABLED' : 'DISABLED';
    if(q('#coreExtensionPoints'))q('#coreExtensionPoints').textContent=(plugins.extensionPoints || []).map(item=>item.id).join(' • ') || 'No extension points registered';
    q('#coreStatusDot')?.classList.toggle('online',!operations.busy);
    q('#coreStatusDot')?.classList.toggle('degraded',Boolean(operations.busy));
    if(announce)showToast(`DragonStrap Core API ${data?.apiVersion || '2.0.0'} • ${registry.count || 0} services.`);
    return data;
  } catch(error) {
    console.error(error);
    q('#coreStatusDot')?.classList.remove('online');
    q('#coreStatusDot')?.classList.add('offline');
    if(announce)showToast('DragonStrap core state could not be loaded.',true);
    return null;
  } finally { state.core.loading=false; }
}

async function getAppInfo() {
  try {
    const info = await window.dragonStrap.getAppInfo();
    state.appInfo = info;
    q('#topVersion').textContent = `v${info.version}`;
    q('#appVersion').textContent = info.version;
    if (q('#aboutVersion')) q('#aboutVersion').textContent = info.version;
    if (q('#updateCurrentVersion')) q('#updateCurrentVersion').textContent = info.version;
    if (q('#aboutElectron')) q('#aboutElectron').textContent = info.electron ? `v${info.electron}` : '—';
    if (q('#aboutBuildType')) q('#aboutBuildType').textContent = info.distribution || (info.packaged ? 'Packaged' : 'Source / Dev');
    if (q('#aboutCoreApi')) q('#aboutCoreApi').textContent = info.coreApiVersion || window.dragonStrap.apiVersion || '2.0.0';
  } catch (error) {
    console.error(error);
  }
}

function formatCheckTime(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function formatUpdateDate(value) {
  const date = new Date(Number(value || 0));
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function renderUpdateProgress(progress, staged = null) {
  const data = progress || {};
  let percent = Math.max(0, Math.min(100, Number(data.percent || 0)));
  let label = data.message || 'Idle';
  if ((!data.phase || data.phase === 'idle') && staged) { percent=100; label='Downloaded and SHA-256 verified'; }
  const bar=q('#updateDownloadProgressBar');
  if (bar) bar.style.width=`${percent}%`;
  if (q('#updateDownloadPercent')) q('#updateDownloadPercent').textContent=`${Math.round(percent)}%`;
  if (q('#updateDownloadStatus')) {
    let detail=label;
    if (data.phase === 'downloading' && Number(data.totalBytes || 0) > 0) detail=`${label} • ${formatBytesLocal(data.receivedBytes)} / ${formatBytesLocal(data.totalBytes)}`;
    q('#updateDownloadStatus').textContent=detail;
  }
}

function renderUpdateState(result) {
  state.updates.data = result;
  const dot=q('#updateStatusDot');
  const latest=q('#updateLatestVersion');
  const feed=q('#updateFeedStatus');
  const message=q('#updateMessage');
  const open=q('#openReleaseBtn');
  const self=result?.selfUpdate || {};
  const staged=Boolean(self.staged && result?.latestVersion && self.staged.version === result.latestVersion);
  const updateAvailable=Boolean(result?.ok && result?.updateAvailable);
  const supported=Boolean(self.supported && self.selectedAsset);

  if (latest) { latest.textContent=result?.latestVersion || '—'; latest.classList.toggle('newer',updateAvailable); }
  if (q('#updateLastChecked')) q('#updateLastChecked').textContent=formatCheckTime(result?.checkedAt || result?.lastResult?.checkedAt);
  if (q('#updateBuildMode')) q('#updateBuildMode').textContent=self.buildLabel || state.appInfo?.distribution || 'Detecting…';
  if (q('#updateSelectedAsset')) q('#updateSelectedAsset').textContent=self.selectedAsset?.name || (updateAvailable ? 'Compatible package unavailable' : 'No update package selected');
  if (q('#updateReleaseName')) q('#updateReleaseName').textContent=result?.releaseName || 'No release selected';
  if (q('#updateReleaseNotes')) q('#updateReleaseNotes').textContent=result?.releaseNotes || 'Release notes will appear after a successful update check.';
  const releaseUrl=result?.releaseUrl || result?.lastResult?.releaseUrl || null;
  if (open) open.disabled=!releaseUrl;
  if (dot) { dot.classList.remove('online','offline'); dot.classList.add(result?.configured && result?.ok !== false ? 'online' : 'offline'); }

  if (feed) {
    feed.classList.remove('ready','warning','error');
    if (!result?.configured) { feed.textContent='Not configured'; feed.classList.add('warning'); }
    else if (updateAvailable && result?.deferred) { feed.textContent='Deferred'; feed.classList.add('warning'); }
    else if (updateAvailable) { feed.textContent='Update available'; feed.classList.add('ready'); }
    else if (result?.ok && (result?.checkedAt || result?.lastResult?.checkedAt)) { feed.textContent='Up to date'; feed.classList.add('ready'); }
    else if (result?.configured) { feed.textContent='Ready'; feed.classList.add('ready'); }
    else { feed.textContent=result?.code || 'Unavailable'; feed.classList.add('error'); }
  }

  const verify=q('#updateVerificationState');
  if (verify) {
    verify.classList.remove('verified','required');
    if (staged) { verify.textContent='SHA-256 verified'; verify.classList.add('verified'); }
    else if (updateAvailable) { verify.textContent='Verification required'; verify.classList.add('required'); }
    else verify.textContent='—';
  }

  if (q('#downloadUpdateBtn')) q('#downloadUpdateBtn').disabled=!updateAvailable || !supported || staged || state.updates.downloading;
  if (q('#applyUpdateBtn')) q('#applyUpdateBtn').disabled=!staged || !updateAvailable || state.updates.downloading;
  if (q('#cancelUpdateDownloadBtn')) q('#cancelUpdateDownloadBtn').disabled=!state.updates.downloading;
  if (q('#deferUpdateBtn')) q('#deferUpdateBtn').disabled=!updateAvailable || result?.deferred || state.updates.downloading;
  if (q('#clearUpdateDeferralBtn')) q('#clearUpdateDeferralBtn').disabled=!result?.deferred;
  if (q('#updateDeferredStatus')) q('#updateDeferredStatus').textContent=result?.deferred ? `Deferred until ${formatUpdateDate(result.deferredUntil)}` : 'No update deferred';

  renderUpdateProgress(state.updates.progress || self.progress, staged ? self.staged : null);

  if (message) {
    if (!result?.configured) message.textContent='The official DragonStrap GitHub release feed is not configured.';
    else if (updateAvailable && self.buildMode === 'source') message.textContent=`DragonStrap ${result.latestVersion} is available. Source/dev sessions do not self-update; run a packaged Portable or Setup build to use verified downloads.`;
    else if (staged) message.textContent=`DragonStrap ${result.latestVersion} is downloaded and SHA-256 verified. INSTALL UPDATE will ${self.buildMode === 'portable' ? 'perform a safe portable handoff and relaunch DragonStrap' : 'launch the verified Setup package and close DragonStrap'}.`;
    else if (updateAvailable && result?.deferred) message.textContent=`DragonStrap ${result.latestVersion} is available, but this notification is deferred until ${formatUpdateDate(result.deferredUntil)}.`;
    else if (updateAvailable && !supported) message.textContent=`DragonStrap ${result.latestVersion} is available, but this release does not contain the required ${self.buildLabel || ''} ${state.appInfo?.architecture || ''} artifact.`;
    else if (updateAvailable) message.textContent=`DragonStrap ${result.latestVersion} is available${result.prerelease ? ' as a pre-release' : ''}. Downloading requires SHA256SUMS.txt and the matching ${self.buildLabel || 'Windows'} artifact.`;
    else if (result?.ok) message.textContent=`DragonStrap ${result.currentVersion} is current on the ${result.channel} channel.`;
    else message.textContent=result?.message || 'The release feed could not be checked.';
  }
}

async function refreshUpdateState(check=false, announce=false) {
  if (state.updates.loading) return state.updates.data;
  state.updates.loading=true;
  const button=q('#checkUpdatesBtn');
  if (button) button.disabled=true;
  try {
    const result=check ? await window.dragonStrap.checkForUpdates() : await window.dragonStrap.getUpdateState();
    state.updates.progress=result?.selfUpdate?.progress || null;
    renderUpdateState(result);
    if (announce) {
      const text=result.ok
        ? (result.updateAvailable ? (result.deferred ? `DragonStrap ${result.latestVersion} is available and currently deferred.` : `DragonStrap ${result.latestVersion} is available.`) : 'DragonStrap is up to date.')
        : (result.message || 'Update check unavailable.');
      showToast(text, !result.ok && result.code !== 'FEED_NOT_CONFIGURED');
    }
    return result;
  } catch (error) {
    console.error(error);
    if (announce) showToast('Update check failed.',true);
    return null;
  } finally {
    state.updates.loading=false;
    if (button) button.disabled=false;
  }
}

async function downloadDragonStrapUpdate() {
  if (state.updates.downloading) return;
  state.updates.downloading=true;
  renderUpdateState(state.updates.data || {});
  try {
    const result=await window.dragonStrap.downloadUpdate();
    if (result.state) {
      state.updates.progress=result.state?.selfUpdate?.progress || state.updates.progress;
      renderUpdateState(result.state);
    }
    showToast(result.ok ? 'Update downloaded and SHA-256 verified.' : (result.message || 'Update download failed.'), !result.ok && !result.canceled);
  } catch (error) {
    console.error(error);
    showToast('Update download failed.',true);
  } finally {
    state.updates.downloading=false;
    await refreshUpdateState(false,false);
  }
}

async function applyDragonStrapUpdate() {
  const result=await window.dragonStrap.applyUpdate();
  showToast(result.ok ? (result.message || 'Applying verified update…') : (result.message || 'Update could not be installed.'), !result.ok);
}

async function deferDragonStrapUpdate() {
  const hours=Number(q('#updateDeferralHours')?.value || 24);
  const result=await window.dragonStrap.deferUpdate(hours);
  if (result.state) renderUpdateState(result.state);
  showToast(result.ok ? `Update deferred until ${formatUpdateDate(result.deferredUntil)}.` : (result.message || 'Update could not be deferred.'), !result.ok);
}

function renderReliabilityState(result) {
  state.reliability.data=result;
  const previous=q('#previousSessionState');
  if (previous) {
    previous.classList.remove('clean','recovered');
    if (result?.previousSessionClean === false) { previous.textContent='Recovered'; previous.classList.add('recovered'); }
    else if (result?.previousSessionClean === true) { previous.textContent='Clean'; previous.classList.add('clean'); }
    else previous.textContent='First run';
  }
  if (q('#reliabilityUptime')) {
    const sec=Number(result?.uptimeSeconds || 0); const min=Math.floor(sec/60); const hours=Math.floor(min/60);
    q('#reliabilityUptime').textContent=hours ? `${hours}h ${min%60}m` : `${min}m`;
  }
  if (q('#reliabilityRuntime')) q('#reliabilityRuntime').textContent=state.appInfo?.electron ? `Electron ${state.appInfo.electron}` : 'Electron';
}

async function refreshReliabilityState() {
  try { const result=await window.dragonStrap.getReliabilityState(); renderReliabilityState(result); return result; }
  catch(error){ console.error(error); return null; }
}

function setStatusDot(selector, online) {
  const dot = q(selector);
  if (!dot) return;
  dot.classList.toggle('online', online);
  dot.classList.toggle('offline', !online);
}

function renderRobloxStatus(status) {
  state.roblox = status;
  const installed = Boolean(status.installed);
  const studioInstalled = Boolean(status.studioInstalled);

  q('#installGauge').textContent = installed ? 'READY' : 'MISSING';
  q('#installDetail').textContent = installed ? status.version : 'Not detected';
  q('#installDetail').title = installed ? status.version : '';
  q('#playerOverviewDial')?.classList.toggle('ready', installed);
  q('#playerOverviewDial')?.classList.toggle('offline', !installed);

  q('#studioGauge').textContent = studioInstalled ? 'READY' : 'MISSING';
  q('#studioDetail').textContent = studioInstalled ? status.studioVersion : 'Not detected';
  q('#studioDetail').title = studioInstalled ? status.studioVersion : '';
  q('#studioOverviewDial')?.classList.toggle('ready', studioInstalled);
  q('#studioOverviewDial')?.classList.toggle('offline', !studioInstalled);

  const selectedChannel = status.channel || 'LIVE';
  q('#channelGauge').textContent = selectedChannel;
  q('#channelDetail').textContent = selectedChannel === 'LIVE' ? 'Official production' : `Selected: ${selectedChannel}`;
  q('#channelOverviewDial')?.classList.add('ready');
  q('#channelStatus').textContent = selectedChannel;

  q('#playerStatus').textContent = installed ? 'Detected' : 'Not Detected';
  q('#studioStatus').textContent = studioInstalled ? 'Detected' : 'Not Detected';
  q('#playerMeter').style.width = installed ? '92%' : '12%';
  q('#studioMeter').style.width = studioInstalled ? '92%' : '12%';
  q('#robloxSummary').textContent = installed ? 'Detected' : 'Not Found';
  q('#footerStatus').textContent = installed ? 'ROBLOX READY' : 'ROBLOX NOT DETECTED';

  q('#launchPlayerVersion').textContent = installed ? status.version : 'Not detected';
  q('#launchPlayerPath').textContent = status.playerPath || 'RobloxPlayerBeta.exe was not found.';
  q('#launchStudioVersion').textContent = studioInstalled ? status.studioVersion : 'Not detected';
  q('#launchStudioPath').textContent = status.studioPath || 'RobloxStudioBeta.exe was not found.';
  q('#launchPlayerBtn').disabled = !installed || state.launchPending;
  q('#launchStudioBtn').disabled = !studioInstalled || state.launchPending;
  if (q('#launchExperienceBtn')) q('#launchExperienceBtn').disabled = !installed || state.launchPending;
  setStatusDot('#launchPlayerDot', installed);
  setStatusDot('#launchStudioDot', studioInstalled);
  if (q('#launchHealth')) {
    q('#launchHealth').textContent = installed ? (studioInstalled ? 'PLAYER + STUDIO READY' : 'PLAYER READY') : 'PLAYER OFFLINE';
    q('#launchHealth').classList.toggle('online', installed);
  }

  q('#instanceInstalled').textContent = installed ? 'Yes' : 'No';
  q('#instanceVersion').textContent = status.version || '—';
  q('#instancePlayerPath').textContent = status.playerPath || '—';
  q('#instanceStudioInstalled').textContent = studioInstalled ? 'Yes' : 'No';
  q('#instanceStudioVersion').textContent = status.studioVersion || '—';
  q('#instanceStudioPath').textContent = status.studioPath || '—';
  q('#robloxRoot').textContent = status.robloxRoot || '—';

  q('#studioPageState').textContent = studioInstalled ? 'READY' : 'OFFLINE';
  q('#studioPageVersion').textContent = studioInstalled ? status.studioVersion : 'Studio not detected';
  if (q('#studioCenterPath')) q('#studioCenterPath').textContent = status.studioPath || 'RobloxStudioBeta.exe was not found.';
  setStatusDot('#studioCenterDot', studioInstalled);
  if (q('#studioLaunchTop')) q('#studioLaunchTop').disabled = !studioInstalled || state.launchPending;
  if (q('#studioOpenProjectBtn')) q('#studioOpenProjectBtn').disabled = !studioInstalled || state.launchPending;

  q('#launchState').textContent = installed ? 'ROBLOX PLAYER READY' : 'ROBLOX NOT DETECTED';
  q('#launchHint').textContent = installed ? 'Press PLAY to launch Roblox.' : 'Install Roblox or refresh detection.';
}

async function refreshRobloxStatus(announce = false) {
  try {
    q('#footerStatus').textContent = 'SCANNING ROBLOX';
    const status = await window.dragonStrap.getRobloxStatus();
    renderRobloxStatus(status);
    if (announce) showToast(status.installed ? 'Roblox installation refreshed.' : 'Roblox Player was not detected.', !status.installed);
  } catch (error) {
    console.error(error);
    q('#footerStatus').textContent = 'STATUS ERROR';
    showToast('Unable to scan the Roblox installation.', true);
  }
}


function selectedConfigurationProfile() {
  const id = q('#configurationProfileSelect')?.value || '';
  return state.configurationProfiles.data?.profiles?.find(item => item.id === id) || null;
}

function renderConfigurationProfileSummary(profile) {
  const dot = q('#configurationProfileDot');
  if (!profile) {
    q('#configurationProfileSummaryTitle').textContent = 'Select a profile to inspect it.';
    ['configurationSummaryPerformance','configurationSummaryFlags','configurationSummaryChannel','configurationSummaryLaunch','configurationSummaryServerSort','configurationSummaryServerFilter'].forEach(id => q(`#${id}`).textContent = '—');
    dot?.classList.remove('online');
    return;
  }
  const cfg = profile.configuration || {};
  const perf = cfg.performance || {};
  q('#configurationProfileSummaryTitle').textContent = profile.name;
  q('#configurationSummaryPerformance').textContent = `${fpsLabel(perf.fpsCap)} FPS • ${perf.renderMode || 'default'} • ${perf.msaaMode === 'default' ? 'default MSAA' : `${perf.msaaMode}× MSAA`}`;
  q('#configurationSummaryFlags').textContent = `${Object.keys(cfg.fastFlags || {}).length} editable`;
  q('#configurationSummaryChannel').textContent = cfg.channel === 'production' ? 'LIVE / production' : (cfg.channel || 'production');
  q('#configurationSummaryLaunch').textContent = cfg.launch?.minimizeOnLaunch ? 'Minimize after launch' : 'Keep DragonStrap open';
  q('#configurationSummaryServerSort').textContent = cfg.servers?.sort || 'ping';
  const filterBits = [cfg.servers?.occupancy || 'any'];
  if (cfg.servers?.favoritesOnly) filterBits.push('favorites');
  if (cfg.servers?.hideFull) filterBits.push('hide full');
  q('#configurationSummaryServerFilter').textContent = filterBits.join(' • ');
  dot?.classList.add('online');
}

function renderConfigurationPreview(result) {
  state.configurationProfiles.preview = result?.ok ? result : null;
  q('#configurationPreviewSettings').textContent = result?.ok ? String(result.settingsChanges?.length || 0) : '0';
  q('#configurationPreviewSets').textContent = result?.ok ? String(result.fastFlags?.setCount || 0) : '0';
  q('#configurationPreviewRemovals').textContent = result?.ok ? String(result.fastFlags?.removeCount || 0) : '0';
  q('#configurationPreviewWarnings').textContent = result?.ok ? String(result.fastFlags?.warningCount || 0) : '0';
  const list = q('#configurationPreviewList');
  list.replaceChildren();
  if (!result?.ok) {
    const empty = document.createElement('div'); empty.className='configuration-empty'; empty.textContent=result?.message || 'Select a profile to build an apply preview.'; list.append(empty); return;
  }
  const items = [];
  for (const change of result.settingsChanges || []) items.push({ type:'SETTING', name:change.key, before:String(change.before ?? '—'), after:String(change.after ?? '—') });
  for (const change of result.fastFlags?.changes || []) items.push({ type:`FLAG ${change.action}`, name:change.key, before:String(change.before ?? '—'), after:String(change.after ?? 'REMOVED') });
  if (!items.length) { const empty=document.createElement('div'); empty.className='configuration-empty'; empty.textContent='This profile already matches the current configuration.'; list.append(empty); return; }
  for (const item of items.slice(0, 120)) {
    const row=document.createElement('div'); row.className='configuration-preview-item';
    const type=document.createElement('b'); type.textContent=item.type;
    const before=document.createElement('code'); before.textContent=`${item.name}: ${item.before}`;
    const after=document.createElement('code'); after.textContent=`→ ${item.after}`;
    row.append(type,before,after); list.append(row);
  }
  if (items.length > 120) { const more=document.createElement('div'); more.className='configuration-empty'; more.textContent=`${items.length-120} additional changes validated but not shown.`; list.append(more); }
}

function renderConfigurationProfiles(result) {
  state.configurationProfiles.data = result;
  const profiles = result?.profiles || [];
  const select = q('#configurationProfileSelect');
  const previous = select.value;
  select.replaceChildren();
  if (!profiles.length) { const option=document.createElement('option'); option.value=''; option.textContent='No profiles yet'; select.append(option); }
  else for (const profile of profiles) { const option=document.createElement('option'); option.value=profile.id; option.textContent=profile.name; select.append(option); }
  if (profiles.some(item => item.id === previous)) select.value=previous;
  else if (result?.activeProfileId && profiles.some(item => item.id === result.activeProfileId)) select.value=result.activeProfileId;
  else if (profiles[0]) select.value=profiles[0].id;
  q('#configurationProfileCount').textContent = `${profiles.length} profile${profiles.length === 1 ? '' : 's'}`;
  const active = profiles.find(item => item.id === result?.activeProfileId);
  q('#configurationActiveProfile').textContent = active?.name || 'None';
  const has = Boolean(selectedConfigurationProfile());
  ['configurationApplyBtn','configurationExportBtn','configurationDeleteBtn','configurationCloneBtn','configurationPreviewBtn'].forEach(id => q(`#${id}`).disabled = !has);
  renderConfigurationProfileSummary(selectedConfigurationProfile());
}

async function refreshConfigurationProfiles(announce=false) {
  try {
    const result=await window.dragonStrap.getConfigurationProfiles();
    renderConfigurationProfiles(result);
    if (selectedConfigurationProfile()) await previewSelectedConfigurationProfile(false);
    else renderConfigurationPreview(null);
    if (announce) showToast('Configuration profiles refreshed.');
    return result;
  } catch(error) { console.error(error); if(announce) showToast('Configuration profiles could not be loaded.',true); return null; }
}

async function previewSelectedConfigurationProfile(announce=false) {
  const profile=selectedConfigurationProfile();
  if(!profile){renderConfigurationPreview(null);return null;}
  const result=await window.dragonStrap.previewConfigurationProfile(profile.id);
  renderConfigurationPreview(result);
  if(announce) showToast(result.ok ? 'Profile apply preview refreshed.' : (result.message || 'Profile preview failed.'), !result.ok);
  return result;
}

async function saveCurrentConfigurationProfile() {
  const name=q('#configurationProfileName').value.trim();
  if(!name){showToast('Enter a profile name first.',true);return;}
  const result=await window.dragonStrap.saveConfigurationProfile(name);
  if(!result.ok){showToast(result.message || 'Configuration profile could not be saved.',true);return;}
  q('#configurationProfileName').value='';
  await refreshConfigurationProfiles(false);
  q('#configurationProfileSelect').value=result.profile.id;
  renderConfigurationProfileSummary(result.profile);
  await previewSelectedConfigurationProfile(false);
  showToast(result.updated ? 'Configuration profile updated.' : 'Configuration profile saved.');
}

async function applySelectedConfigurationProfile() {
  const profile=selectedConfigurationProfile(); if(!profile)return;
  const preview=await previewSelectedConfigurationProfile(false); if(!preview?.ok){showToast(preview?.message || 'Profile validation failed.',true);return;}
  if((preview.destructiveFlagRemovals || 0) > 0 && !window.confirm(`Apply ${profile.name}? This will remove ${preview.destructiveFlagRemovals} editable FastFlag override(s) that are not stored in the profile.`)) return;
  const button=q('#configurationApplyBtn'); button.disabled=true;
  try {
    const result=await window.dragonStrap.applyConfigurationProfile(profile.id);
    if(!result.ok){showToast(result.message || 'Configuration profile apply failed.',true);return;}
    await loadSettings();
    await Promise.all([refreshPerformanceState(false),refreshPerformanceCenter(false),refreshFastFlags(false),refreshChannelVersion(false)]);
    renderServerList();
    await refreshConfigurationProfiles(false);
    showToast(`${profile.name} applied.`);
  } finally { button.disabled=false; }
}

async function cloneSelectedConfigurationProfile() {
  const profile=selectedConfigurationProfile(); if(!profile)return;
  const name=q('#configurationCloneName').value.trim() || `${profile.name} Copy`;
  const result=await window.dragonStrap.cloneConfigurationProfile(profile.id,name);
  if(!result.ok){showToast(result.message || 'Profile clone failed.',true);return;}
  q('#configurationCloneName').value=''; await refreshConfigurationProfiles(false); q('#configurationProfileSelect').value=result.profile.id; renderConfigurationProfileSummary(result.profile); await previewSelectedConfigurationProfile(false); showToast('Configuration profile cloned.');
}

async function deleteSelectedConfigurationProfile() {
  const profile=selectedConfigurationProfile(); if(!profile)return;
  if(!window.confirm(`Delete configuration profile “${profile.name}”?`))return;
  const result=await window.dragonStrap.deleteConfigurationProfile(profile.id);
  if(!result.ok){showToast(result.message || 'Profile deletion failed.',true);return;}
  await refreshConfigurationProfiles(false); showToast('Configuration profile deleted.');
}

async function exportSelectedConfigurationProfile() {
  const profile=selectedConfigurationProfile(); if(!profile)return;
  const result=await window.dragonStrap.exportConfigurationProfile(profile.id);
  if(result?.canceled)return; showToast(result?.ok ? 'Configuration profile exported.' : (result?.message || 'Profile export failed.'), !result?.ok);
}

async function importConfigurationProfile() {
  const result=await window.dragonStrap.importConfigurationProfile();
  if(result?.canceled)return;
  if(!result?.ok){showToast(result?.message || 'Profile import failed.',true);return;}
  await refreshConfigurationProfiles(false); if(result.profile?.id) q('#configurationProfileSelect').value=result.profile.id; renderConfigurationProfileSummary(selectedConfigurationProfile()); await previewSelectedConfigurationProfile(false); showToast('Configuration profile imported.');
}

async function saveSettings(patch) {
  try {
    state.settings = await window.dragonStrap.updateSettings(patch);
  } catch (error) {
    console.error(error);
    showToast('Could not save DragonStrap settings.', true);
  }
}

function installRefreshTimer() {
  clearInterval(state.refreshTimer);
  const seconds = Number(state.settings?.refreshSeconds || 60);
  if (state.settings?.autoRefresh !== false) {
    state.refreshTimer = setInterval(() => refreshRobloxStatus(false), Math.max(60, seconds) * 1000);
  }
}

async function loadSettings() {
  try {
    state.settings = await window.dragonStrap.getSettings();
    const activeProfile = state.settings.launchProfile || 'performance';
    q('#launchProfile').value = activeProfile;
    qsa('[data-profile]').forEach(item => item.classList.toggle('active', item.dataset.profile === activeProfile));
    q('#minimizeOnLaunch').checked = Boolean(state.settings.minimizeOnLaunch);
    q('#notificationsSetting').checked = state.settings.notifications !== false;
    q('#refreshSeconds').value = String(state.settings.refreshSeconds || 60);
    if (q('#checkForUpdatesSetting')) q('#checkForUpdatesSetting').checked = state.settings.checkForUpdates !== false;
    if (q('#updateChannelSetting')) q('#updateChannelSetting').value = state.settings.updateChannel || 'stable';
    renderPerformanceSettings();
    if (q('#launchTargetInput')) q('#launchTargetInput').value = state.settings.lastLaunchTarget || '';
    if (q('#serverPlaceInput')) q('#serverPlaceInput').value = localStorage.getItem('dragonstrap.serverPlace') || state.settings.lastLaunchTarget || '';
    if (q('#serverSortSelect')) q('#serverSortSelect').value = state.settings.serverSort || 'ping';
    if (q('#serverOccupancySelect')) q('#serverOccupancySelect').value = state.settings.serverOccupancy || 'any';
    if (q('#serverFavoritesOnly')) q('#serverFavoritesOnly').checked = Boolean(state.settings.serverFavoritesOnly);
    if (q('#serverHideFull')) q('#serverHideFull').checked = Boolean(state.settings.serverHideFull);
    if (q('#channelNameInput')) q('#channelNameInput').value = state.settings.channel || 'production';
    installRefreshTimer();
  } catch (error) {
    console.error(error);
    showToast('Settings could not be loaded. Defaults are active.', true);
  }
}

function setLaunchBusy(busy) {
  state.launchPending = busy;
  if (state.servers.result?.ok) queueMicrotask(renderServerList);
  ['#launchPlayerBtn', '#launchStudioBtn', '#launchExperienceBtn'].forEach(selector => {
    const button = q(selector);
    if (!button) return;
    if (selector === '#launchStudioBtn') button.disabled = busy || !state.roblox?.studioInstalled;
    else button.disabled = busy || !state.roblox?.installed;
  });
}

function setLaunchResult(result, actionLabel) {
  const orb = q('#launchResultOrb');
  if (!orb) return;
  orb.classList.remove('ok', 'error');
  orb.classList.add(result.ok ? 'ok' : 'error');
  q('#launchResultCode').textContent = result.ok ? 'STARTED' : (result.code || 'FAILED');
  q('#launchResultMessage').textContent = result.ok
    ? `${actionLabel} launch request was sent successfully.`
    : (result.message || `${actionLabel} could not be launched.`);
  q('#launchResultTime').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderLaunchHistory(items) {
  const container = q('#launchHistory');
  if (!container) return;
  container.replaceChildren();
  if (!items?.length) {
    const empty = document.createElement('div');
    empty.className = 'launch-history-empty';
    empty.textContent = 'No launch activity yet.';
    container.append(empty);
    return;
  }

  for (const item of items) {
    const row = document.createElement('div');
    row.className = `launch-history-item${item.ok ? '' : ' failed'}`;

    const type = document.createElement('span');
    type.className = 'history-type';
    type.textContent = String(item.type || 'player').toUpperCase();

    const main = document.createElement('div');
    main.className = 'history-main';
    const title = document.createElement('strong');
    title.textContent = item.label || 'Roblox';
    const target = document.createElement('span');
    target.textContent = item.ok ? (item.target || 'Local application') : (item.message || 'Launch failed');
    main.append(title, target);

    const profile = document.createElement('span');
    profile.className = 'history-profile';
    profile.textContent = item.profile || 'default';

    const time = document.createElement('time');
    const stamp = new Date(item.timestamp);
    time.dateTime = item.timestamp || '';
    time.textContent = Number.isNaN(stamp.getTime()) ? '—' : stamp.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    row.append(type, main, profile, time);
    container.append(row);
  }
}

async function loadLaunchHistory() {
  try {
    renderLaunchHistory(await window.dragonStrap.getLaunchHistory());
  } catch (error) {
    console.error(error);
  }
}

async function launchPlayer(options = {}) {
  if (state.launchPending) return;
  setLaunchBusy(true);
  q('#launchState').textContent = 'LAUNCHING…';
  try {
    const result = await window.dragonStrap.launchPlayer(options);
    if (result.ok) {
      q('#launchState').textContent = 'ROBLOX STARTED';
      if (result.performance && !result.performance.ok) {
        showToast(`Roblox launched, but Performance+ was not applied: ${result.performance.message || 'unknown error'}`, true);
      } else {
        showToast(options.target ? 'Experience launch request sent.' : 'Roblox launch request sent.');
      }
      if (result.performance?.ok && !result.performance.skipped) refreshPerformanceState(false);
    } else {
      q('#launchState').textContent = 'LAUNCH FAILED';
      showToast(result.message || 'Roblox could not be launched.', true);
    }
    setLaunchResult(result, options.target ? 'Experience' : 'Roblox');
    await loadLaunchHistory();
    return result;
  } finally {
    setLaunchBusy(false);
  }
}

async function launchExperience() {
  const target = q('#launchTargetInput').value.trim();
  const gameInstanceId = q('#launchInstanceInput').value.trim();
  if (!target) {
    setLaunchResult({ ok: false, code: 'TARGET REQUIRED', message: 'Enter a Place ID or Roblox game URL first.' }, 'Experience');
    showToast('Enter a Place ID or Roblox game URL first.', true);
    q('#launchTargetInput').focus();
    return;
  }
  await saveSettings({ lastLaunchTarget: target });
  return launchPlayer({ target, gameInstanceId });
}


function channelDate(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString([], { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function channelProductState(product) {
  if (!product?.ok) return { label:product?.code === 'CHANNEL_RESTRICTED' ? 'RESTRICTED' : (product?.code === 'CHANNEL_NOT_FOUND' ? 'NOT FOUND' : 'ERROR'), className:'error' };
  if (!product.installed) return { label:'NOT INSTALLED', className:'' };
  if (product.current) return { label:'CURRENT', className:'current' };
  return { label:'UPDATE AVAILABLE', className:'update' };
}

function renderChannelProduct(prefix, product, isProduction) {
  const stateView = channelProductState(product);
  const pill = q(`#channel${prefix}State`);
  pill.textContent = stateView.label;
  pill.className = `channel-state-pill ${stateView.className}`.trim();
  q(`#channel${prefix}Version`).textContent = product?.ok ? product.version : 'Unavailable';
  q(`#channel${prefix}Guid`).textContent = product?.ok ? product.versionGuid : (product?.message || 'Metadata unavailable');
  q(`#channel${prefix}Installed`).textContent = product?.installedGuid || 'Not detected';
  q(`#channel${prefix}Published`).textContent = product?.timestamp ? channelDate(product.timestamp) : 'Unknown';
  let comparison = 'LIVE';
  if (!isProduction) comparison = product?.behindProduction ? 'Behind LIVE' : (product?.ok ? 'Same/newer than LIVE' : 'Unknown');
  q(`#channel${prefix}Comparison`).textContent = comparison;
}

function renderChannelVersion(result) {
  state.channels.data = result;
  const selected = result?.displayChannel || (state.settings?.channel?.toLowerCase() === 'production' ? 'LIVE' : state.settings?.channel) || 'LIVE';
  q('#channelPhaseBadge').textContent = selected;
  q('#channelSelectedName').textContent = selected;
  if (document.activeElement !== q('#channelNameInput')) q('#channelNameInput').value = result?.channel || state.settings?.channel || 'production';
  renderChannelProduct('Player', result?.player, Boolean(result?.isProduction));
  renderChannelProduct('Studio', result?.studio, Boolean(result?.isProduction));
  q('#channelPlayerEndpoint').textContent = result?.player?.endpoint || 'Unavailable';
  q('#channelStudioEndpoint').textContent = result?.studio?.endpoint || 'Unavailable';
  q('#channelLastChecked').textContent = channelDate(result?.checkedAt);
  const dot = q('#channelProviderDot');
  dot.classList.toggle('online', Boolean(result?.ok));
  dot.classList.toggle('offline', !result?.ok);
  q('#channelOpenPlayerFolder').disabled = !state.roblox?.installed;
  q('#channelOpenStudioFolder').disabled = !state.roblox?.studioInstalled;
}

async function refreshChannelVersion(announce = false, channel = null) {
  if (state.channels.loading) return state.channels.data;
  state.channels.loading = true;
  ['#channelRefreshBtn','#channelCheckBtn','#channelSelectBtn','#channelUseLiveBtn'].forEach(sel => { if (q(sel)) q(sel).disabled = true; });
  try {
    const result = await window.dragonStrap.getChannelVersionState(channel);
    renderChannelVersion(result);
    if (announce) showToast(result?.ok ? `Channel metadata refreshed for ${result.displayChannel}.` : (result?.message || result?.player?.message || 'Channel metadata lookup failed.'), !result?.ok);
    return result;
  } catch (error) {
    console.error(error);
    if (announce) showToast('Channel metadata could not be loaded.', true);
    return null;
  } finally {
    state.channels.loading = false;
    ['#channelRefreshBtn','#channelCheckBtn','#channelSelectBtn','#channelUseLiveBtn'].forEach(sel => { if (q(sel)) q(sel).disabled = false; });
  }
}

async function selectChannel(channel) {
  if (state.channels.loading || state.channels.install.running) return;
  state.channels.loading = true;
  ['#channelRefreshBtn','#channelCheckBtn','#channelSelectBtn','#channelUseLiveBtn'].forEach(sel => { if (q(sel)) q(sel).disabled = true; });
  try {
    const result = await window.dragonStrap.selectChannel(channel);
    if (!result.ok) {
      renderChannelVersion(result.state || { ok:false, channel, displayChannel:channel, player:{ ok:false, code:result.code, message:result.message }, studio:{ ok:false, code:result.code, message:result.message }, checkedAt:new Date().toISOString() });
      showToast(result.message || 'Channel could not be selected.', true);
      return result;
    }
    state.settings.channel = result.channel;
    state.channels.install.plan = null;
    q('#playerInstallStartBtn').disabled = true;
    q('#playerInstallPhase').textContent = 'READY';
    q('#playerInstallMessage').textContent = 'Channel changed. Analyze the new selected channel before installing.';
    renderChannelVersion(result.state);
    if (q('#channelGauge')) q('#channelGauge').textContent = result.displayChannel;
    if (q('#channelStatus')) q('#channelStatus').textContent = result.displayChannel;
    showToast(`${result.displayChannel} selected for DragonStrap version tracking.`);
    return result;
  } finally {
    state.channels.loading = false;
    ['#channelRefreshBtn','#channelCheckBtn','#channelSelectBtn','#channelUseLiveBtn'].forEach(sel => { if (q(sel)) q(sel).disabled = false; });
  }
}

function installPhaseLabel(phase) {
  return ({ planning:'PLANNING', downloading:'DOWNLOADING', extracting:'EXTRACTING', committing:'COMMITTING', complete:'COMPLETE', canceled:'CANCELED', error:'ERROR' })[phase] || 'READY';
}

function renderPlayerInstallPlan(plan) {
  state.channels.install.plan = plan?.ok ? plan : null;
  if (!plan?.ok) {
    q('#playerInstallTarget').textContent = 'Unavailable';
    q('#playerInstallPackages').textContent = '—';
    q('#playerInstallDownloadLabel').textContent = 'Download';
    q('#playerInstallDownload').textContent = '—';
    q('#playerInstallUnpacked').textContent = '—';
    q('#playerInstallFreeSpace').textContent = '—';
    q('#playerInstallResume').textContent = '—';
    q('#playerInstallProgressBar').style.width = '0%';
    q('#playerInstallPercent').textContent = '0%';
    q('#playerInstallSpeed').textContent = '—';
    q('#playerInstallMessage').textContent = plan?.message || 'Installation plan could not be created.';
    q('#playerInstallDetail').textContent = plan?.code || 'PLAN ERROR';
    q('#playerInstallStartBtn').disabled = true;
    return;
  }
  q('#playerInstallTarget').textContent = `${plan.displayChannel} • ${plan.versionGuid}`;
  q('#playerInstallPackages').textContent = String(plan.packageCount);
  q('#playerInstallUnpacked').textContent = formatBytesLocal(plan.totalUnpackedBytes);
  q('#playerInstallResume').textContent = plan.resumeAvailable ? `${formatBytesLocal(plan.partialBytes)} partial` : (plan.cachedBytes ? `${formatBytesLocal(plan.cachedBytes)} verified-size cache` : 'None');
  const warning = plan.warnings?.length ? ` • ${plan.warnings.join(' ')}` : '';

  if (plan.current) {
    q('#playerInstallDownloadLabel').textContent = 'Package size';
    q('#playerInstallDownload').textContent = `${formatBytesLocal(plan.totalDownloadBytes)} analyzed • no download required`;
    q('#playerInstallFreeSpace').textContent = plan.freeBytes === null ? 'Unknown • no staging required' : `${formatBytesLocal(plan.freeBytes)} free • no staging required`;
    q('#playerInstallMessage').textContent = 'Selected Roblox Player build is already installed.';
    q('#playerInstallDetail').textContent = `Manifest ready • current build verified${warning}`;
    q('#playerInstallProgressBar').style.width = '100%';
    q('#playerInstallPercent').textContent = 'CURRENT';
    q('#playerInstallSpeed').textContent = '—';
    q('#playerInstallSafety').textContent = 'No installation is required. Package metadata was analyzed only; DragonStrap will not download or stage the current build.';
  } else {
    q('#playerInstallDownloadLabel').textContent = 'Download';
    q('#playerInstallDownload').textContent = `${formatBytesLocal(plan.remainingDownloadBytes)} remaining / ${formatBytesLocal(plan.totalDownloadBytes)}`;
    q('#playerInstallFreeSpace').textContent = plan.freeBytes === null ? `Unknown • ${formatBytesLocal(plan.requiredFreeBytes)} required` : `${formatBytesLocal(plan.freeBytes)} free • ${formatBytesLocal(plan.requiredFreeBytes)} required`;
    q('#playerInstallMessage').textContent = `Ready to stage ${plan.packageCount} verified packages.`;
    q('#playerInstallDetail').textContent = plan.enoughSpace === false ? 'Insufficient free disk space.' : `Manifest ready${plan.resumeAvailable ? ' • interrupted downloads can resume' : ''}${warning}`;
    q('#playerInstallProgressBar').style.width = '0%';
    q('#playerInstallPercent').textContent = '0%';
    q('#playerInstallSpeed').textContent = '—';
    q('#playerInstallSafety').textContent = plan.enoughSpace === false
      ? `DragonStrap needs about ${formatBytesLocal(plan.requiredFreeBytes)} free for cached packages, staging, and a 512 MB safety reserve.`
      : 'Downloads are cached under Roblox\Downloads\DragonStrap. Canceling keeps partial package downloads so the next run can resume.';
  }

  q('#playerInstallStartBtn').disabled = Boolean(state.channels.install.running || plan.current || plan.enoughSpace === false);
}

function renderPlayerInstallProgress(progress) {
  if (!progress) return;
  state.channels.install.progress = progress;
  const running = ['planning','downloading','extracting','committing'].includes(progress.phase);
  state.channels.install.running = running;
  const card = q('#channelInstallCard');
  card?.classList.toggle('installing', running);
  card?.classList.toggle('complete', progress.phase === 'complete');
  card?.classList.toggle('error', ['error','canceled'].includes(progress.phase));
  q('#playerInstallPhase').textContent = installPhaseLabel(progress.phase);
  const percent = Math.max(0, Math.min(100, Number(progress.progress || 0)));
  q('#playerInstallProgressBar').style.width = `${percent}%`;
  q('#playerInstallPercent').textContent = `${percent}%`;
  if (progress.message) q('#playerInstallMessage').textContent = progress.message;
  const detail = progress.packageName ? `${progress.packageName}${progress.detail ? ` • ${progress.detail}` : ''}` : (progress.detail || progress.code || '');
  if (detail) q('#playerInstallDetail').textContent = detail;
  q('#playerInstallSpeed').textContent = progress.phase === 'downloading' && progress.speedBytesPerSecond ? `${formatBytesLocal(progress.speedBytesPerSecond)}/s` : '—';
  q('#playerInstallPlanBtn').disabled = running;
  q('#playerInstallStartBtn').disabled = running || !state.channels.install.plan || state.channels.install.plan.current || state.channels.install.plan.enoughSpace === false;
  q('#playerInstallCancelBtn').disabled = !running;
  ['#channelRefreshBtn','#channelCheckBtn','#channelSelectBtn','#channelUseLiveBtn','#channelNameInput'].forEach(sel => { if (q(sel)) q(sel).disabled = running; });
}

async function analyzePlayerInstall(announce = false) {
  if (state.channels.install.running) return null;
  q('#playerInstallPlanBtn').disabled = true;
  q('#playerInstallStartBtn').disabled = true;
  q('#playerInstallPhase').textContent = 'ANALYZING';
  q('#playerInstallMessage').textContent = 'Fetching Roblox Player deployment and package manifest…';
  q('#playerInstallDetail').textContent = state.settings?.channel?.toLowerCase() === 'production' ? 'LIVE' : (state.settings?.channel || 'LIVE');
  try {
    const plan = await window.dragonStrap.getPlayerInstallPlan();
    renderPlayerInstallPlan(plan);
    q('#playerInstallPhase').textContent = plan?.ok ? (plan.current ? 'CURRENT' : 'READY') : 'ERROR';
    if (announce) showToast(plan?.ok ? (plan.current ? 'Roblox Player is already current.' : `Install plan ready: ${plan.packageCount} packages.`) : (plan?.message || 'Install plan failed.'), !plan?.ok);
    return plan;
  } catch (error) {
    console.error(error);
    const result = { ok:false, code:'PLAN_FAILED', message:'Roblox installation plan could not be loaded.' };
    renderPlayerInstallPlan(result);
    q('#playerInstallPhase').textContent = 'ERROR';
    if (announce) showToast(result.message, true);
    return result;
  } finally {
    q('#playerInstallPlanBtn').disabled = false;
  }
}

async function startPlayerInstall() {
  if (state.channels.install.running) return;
  let plan = state.channels.install.plan;
  if (!plan?.ok) plan = await analyzePlayerInstall(false);
  if (!plan?.ok || plan.current || plan.enoughSpace === false) return;
  state.channels.install.running = true;
  renderPlayerInstallProgress({ phase:'planning', progress:1, message:'Starting transactional Roblox Player installation…' });
  try {
    const result = await window.dragonStrap.startPlayerInstall();
    if (result.ok) {
      showToast(result.alreadyCurrent ? 'Roblox Player is already current.' : 'Roblox Player installation completed successfully.');
      await refreshRobloxStatus(false);
      await refreshChannelVersion(false);
      await analyzePlayerInstall(false);
    } else {
      showToast(result.message || 'Roblox Player installation failed.', !result.canceled);
    }
    return result;
  } catch (error) {
    console.error(error);
    showToast('Roblox Player installation request failed.', true);
    return null;
  } finally {
    state.channels.install.running = false;
    q('#playerInstallCancelBtn').disabled = true;
    q('#playerInstallPlanBtn').disabled = false;
  }
}

async function cancelPlayerInstall() {
  const result = await window.dragonStrap.cancelPlayerInstall();
  showToast(result.ok ? 'Cancel requested. Partial downloads will be kept for resume.' : (result.message || 'No install is running.'), !result.ok);
}

async function restorePlayerInstallState() {
  try {
    const installState = await window.dragonStrap.getPlayerInstallState();
    if (installState?.operation) renderPlayerInstallProgress(installState.operation);
    else if (installState?.lastProgress && ['error','canceled'].includes(installState.lastProgress.phase)) renderPlayerInstallProgress(installState.lastProgress);
    return installState;
  } catch (error) { console.error(error); return null; }
}

function formatStudioDate(value) {
  const date=new Date(value || 0);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function renderStudioFastFlags(fastFlags) {
  const enabled=Boolean(fastFlags?.enabled);
  const isolated=Boolean(fastFlags?.isolated);
  const toggle=q('#studioFastFlagsToggle');
  if (toggle) {
    toggle.checked=enabled;
    toggle.disabled=!fastFlags?.ok || (!isolated && !enabled);
  }
  if (q('#studioFastFlagsState')) q('#studioFastFlagsState').textContent=!fastFlags?.ok ? 'UNAVAILABLE' : (!isolated ? 'NOT ISOLATED' : (enabled ? 'MANAGEMENT ON' : 'MANAGEMENT OFF'));
  if (q('#studioFastFlagsPath')) q('#studioFastFlagsPath').textContent=fastFlags?.path || 'Studio ClientSettings unavailable.';
  if (q('#studioFlagSetBtn')) q('#studioFlagSetBtn').disabled=!enabled || !isolated;
  if (q('#studioFlagRestoreBtn')) q('#studioFlagRestoreBtn').disabled=!enabled || !isolated || !fastFlags?.backupExists;

  const list=q('#studioFastFlagList');
  if (!list) return;
  list.replaceChildren();
  const entries=fastFlags?.entries || [];
  if (!entries.length) {
    const empty=document.createElement('div');
    empty.className='studio-empty compact-empty';
    empty.textContent=enabled ? 'No Studio FastFlags configured.' : 'Studio FastFlag editing is disabled; existing Studio ClientSettings are left untouched.';
    list.append(empty);
    return;
  }
  for (const entry of entries) {
    const row=document.createElement('div'); row.className='studio-flag-row';
    const key=document.createElement('code'); key.textContent=entry.key;
    const value=document.createElement('span'); value.textContent=entry.value;
    const type=document.createElement('span'); type.textContent=String(entry.type || 'string').toUpperCase();
    const remove=document.createElement('button'); remove.className='small-action'; remove.textContent='REMOVE'; remove.disabled=!enabled || !isolated;
    remove.addEventListener('click',()=>removeStudioFastFlag(entry.key));
    row.append(key,value,type,remove); list.append(row);
  }
}

function renderStudioCenter(result) {
  state.studio.center = result;
  const projects = result?.projects || [];
  const settings=result?.settings || {};
  const deployment=result?.deployment || {};

  if (q('#studioInstallFolder')) q('#studioInstallFolder').textContent = result?.locations?.installDir || 'Unavailable';
  if (q('#studioLogsFolder')) q('#studioLogsFolder').textContent = result?.locations?.logsDir || 'Unavailable';
  if (q('#studioOpenInstallBtn')) q('#studioOpenInstallBtn').disabled = !result?.locations?.installDirExists;
  if (q('#studioOpenLogsBtn')) q('#studioOpenLogsBtn').disabled = !result?.locations?.logsDirExists;
  if (q('#studioCenterPath')) q('#studioCenterPath').textContent=result?.locations?.studioPath || 'RobloxStudioBeta.exe was not found.';
  if (q('#studioPageState')) q('#studioPageState').textContent=result?.installed ? 'READY' : 'OFFLINE';
  if (q('#studioPageVersion')) q('#studioPageVersion').textContent=result?.installed ? (result.version || 'Detected') : 'Studio not detected';
  setStatusDot('#studioCenterDot',Boolean(result?.installed));
  if (q('#studioLaunchTop')) q('#studioLaunchTop').disabled=!result?.installed || state.launchPending;
  if (q('#studioOpenProjectBtn')) q('#studioOpenProjectBtn').disabled=!result?.installed || state.studio.loading;

  if (q('#studioSelectedChannel')) q('#studioSelectedChannel').textContent=result?.selectedChannel || 'LIVE';
  if (q('#studioRemoteVersion')) q('#studioRemoteVersion').textContent=deployment?.ok ? (deployment.versionGuid || deployment.version || 'Available') : 'Unavailable';
  if (q('#studioChannelState')) q('#studioChannelState').textContent=!deployment?.ok ? (deployment?.code || 'UNAVAILABLE') : (deployment.current ? 'CURRENT' : (deployment.installed ? 'DIFFERENT BUILD' : 'NOT INSTALLED'));
  if (q('#studioChannelInput') && document.activeElement !== q('#studioChannelInput')) q('#studioChannelInput').value=settings.channel === 'production' ? 'production' : (settings.channel || 'production');

  const profileSelect=q('#studioLaunchProfileSelect');
  if (profileSelect) {
    const previous=profileSelect.value;
    profileSelect.replaceChildren();
    for (const profile of result?.launchProfiles || []) {
      const option=document.createElement('option'); option.value=profile.id; option.textContent=profile.name; profileSelect.append(option);
    }
    profileSelect.value=settings.launchProfile || previous || 'standard';
    const selected=(result?.launchProfiles || []).find(item=>item.id === profileSelect.value);
    if (q('#studioProfileDescription')) q('#studioProfileDescription').textContent=selected?.description || 'Choose how DragonStrap prepares Studio projects before launch.';
  }
  if (q('#studioAutoBackup')) q('#studioAutoBackup').checked=settings.autoBackup !== false;
  if (q('#studioBackupRetention')) q('#studioBackupRetention').value=String(settings.backupRetention || 10);
  renderStudioFastFlags(result?.fastFlags);

  const container = q('#studioRecentProjects');
  if (!container) return;
  container.replaceChildren();
  if (!projects.length) {
    const empty = document.createElement('div');
    empty.className = 'studio-empty';
    empty.textContent = 'No Studio projects opened through DragonStrap yet.';
    container.append(empty);
    return;
  }

  for (const project of projects) {
    const row = document.createElement('div');
    row.className = `studio-recent-row${project.exists ? '' : ' missing'}`;
    const icon = document.createElement('span'); icon.className = 'studio-recent-icon'; icon.textContent = project.changedSinceLastOpen ? '!' : '◇';
    const main = document.createElement('div'); main.className = 'studio-recent-main';
    const title = document.createElement('strong'); title.textContent = project.name || 'Studio Project';
    const file = document.createElement('code'); file.textContent = project.path || '—';
    main.append(title, file);

    const intel=document.createElement('div'); intel.className='studio-project-intel';
    const addIntel=(label,value,className='')=>{const span=document.createElement('span'); if(className) span.className=className; const b=document.createElement('b'); b.textContent=`${label}: `; span.append(b,document.createTextNode(value)); intel.append(span);};
    addIntel('Opened',String(project.openCount || 0));
    addIntel('Size',project.exists ? formatBytesLocal(project.size || 0) : 'Missing');
    addIntel('Modified',project.modifiedAt ? formatStudioDate(project.modifiedAt) : '—',project.changedSinceLastOpen ? 'changed' : '');
    addIntel('Backups',String(project.backupCount || 0));

    const actions=document.createElement('div'); actions.className='studio-project-actions';
    const open=document.createElement('button'); open.className='small-action'; open.textContent=project.exists ? 'OPEN' : 'MISSING'; open.disabled=!project.exists || state.studio.loading; open.addEventListener('click',()=>launchRecentStudioProject(project.id));
    const backup=document.createElement('button'); backup.className='small-action'; backup.textContent='BACKUP'; backup.disabled=!project.exists || state.studio.loading; backup.addEventListener('click',()=>backupStudioProject(project.id));
    const restore=document.createElement('button'); restore.className='small-action'; restore.textContent='RESTORE COPY'; restore.disabled=!project.latestBackup || state.studio.loading; restore.addEventListener('click',()=>restoreStudioProjectCopy(project.id,project.latestBackup?.id));
    const folder=document.createElement('button'); folder.className='small-action'; folder.textContent='BACKUPS'; folder.addEventListener('click',()=>openStudioProjectBackups(project.id));
    actions.append(open,backup,restore,folder);
    row.append(icon,main,intel,actions); container.append(row);
  }
}

async function refreshStudioCenter(announce = false) {
  try {
    const result = await window.dragonStrap.getStudioCenterState();
    renderStudioCenter(result);
    if (announce) showToast(result.installed ? 'Studio Center 2.0 refreshed.' : 'Roblox Studio was not detected.', !result.installed);
    return result;
  } catch (error) {
    console.error(error);
    if (announce) showToast('Studio Center could not be refreshed.', true);
    return null;
  }
}

async function saveStudioSettings(patch, message='Studio settings updated.') {
  try {
    const result=await window.dragonStrap.updateStudioSettings(patch);
    if (result?.state) renderStudioCenter(result.state);
    showToast(result?.ok ? message : (result?.message || 'Studio settings could not be updated.'),!result?.ok);
    return result;
  } catch(error) { console.error(error); showToast('Studio settings update failed.',true); return null; }
}

async function checkStudioChannel(select=false) {
  const channel=q('#studioChannelInput')?.value || 'production';
  try {
    const result=select ? await window.dragonStrap.selectStudioChannel(channel) : await window.dragonStrap.checkStudioChannel(channel);
    if (result?.state?.settings) renderStudioCenter(result.state);
    else if (select && result?.state) renderStudioCenter(result.state);
    showToast(result.ok ? (select ? `Studio channel set to ${result.state?.selectedChannel || result.displayChannel || channel}.` : `Studio channel ${result.displayChannel || channel} is available.`) : (result.message || 'Studio channel could not be verified.'),!result.ok);
    if (select && result.ok) await refreshStudioCenter(false);
    return result;
  } catch(error) { console.error(error); showToast('Studio channel check failed.',true); return null; }
}

async function backupStudioProject(id) {
  const result=await window.dragonStrap.backupStudioProject(id);
  if (result?.state) renderStudioCenter(result.state);
  showToast(result.ok ? 'Studio project backup created.' : (result.message || 'Project backup failed.'),!result.ok);
  return result;
}

async function restoreStudioProjectCopy(id,backupId) {
  if (!backupId) return;
  const result=await window.dragonStrap.restoreStudioProjectCopy(id,backupId);
  if (result.canceled) return result;
  showToast(result.ok ? 'Studio backup restored as a new project copy.' : (result.message || 'Backup restore failed.'),!result.ok);
  return result;
}

async function openStudioProjectBackups(id) {
  const result=await window.dragonStrap.openStudioProjectBackups(id);
  showToast(result.ok ? 'Opened project backup folder.' : (result.message || 'Backup folder unavailable.'),!result.ok);
}

async function setStudioFastFlag() {
  const key=q('#studioFlagKey')?.value || '';
  const value=q('#studioFlagValue')?.value ?? '';
  const type=q('#studioFlagType')?.value || 'auto';
  const result=await window.dragonStrap.setStudioFastFlag(key,value,type);
  if (result?.state) renderStudioCenter(result.state);
  showToast(result.ok ? `Studio FastFlag ${key.trim()} updated.` : (result.message || 'Studio FastFlag could not be updated.'),!result.ok);
  return result;
}

async function removeStudioFastFlag(key) {
  const result=await window.dragonStrap.removeStudioFastFlag(key);
  if (result?.state) renderStudioCenter(result.state);
  showToast(result.ok ? `Removed Studio FastFlag ${key}.` : (result.message || 'Studio FastFlag could not be removed.'),!result.ok);
  return result;
}

async function chooseAndLaunchStudioProject() {
  if (state.studio.loading) return;
  state.studio.loading = true;
  if (q('#studioOpenProjectBtn')) q('#studioOpenProjectBtn').disabled = true;
  try {
    const result = await window.dragonStrap.chooseAndLaunchStudioProject();
    if (result.canceled) return result;
    const backupText=result.projectBackup?.ok && !result.projectBackup?.skipped ? ' Backup created.' : '';
    showToast(result.ok ? `Opening ${result.project?.name || 'Studio project'}.${backupText}` : (result.message || 'Studio project could not be opened.'), !result.ok);
    setLaunchResult(result, 'Roblox Studio Project');
    await Promise.all([loadLaunchHistory(), refreshStudioCenter(false)]);
    return result;
  } finally {
    state.studio.loading = false;
    if (q('#studioOpenProjectBtn')) q('#studioOpenProjectBtn').disabled = !state.roblox?.studioInstalled;
  }
}

async function launchRecentStudioProject(id) {
  if (state.studio.loading) return;
  state.studio.loading = true;
  renderStudioCenter(state.studio.center || { projects:[] });
  try {
    const result = await window.dragonStrap.launchRecentStudioProject(id);
    const backupText=result.projectBackup?.ok && !result.projectBackup?.skipped ? ' Backup created.' : '';
    showToast(result.ok ? `Opening ${result.project?.name || 'recent Studio project'}.${backupText}` : (result.message || 'Recent Studio project could not be opened.'), !result.ok);
    setLaunchResult(result, 'Roblox Studio Project');
    await Promise.all([loadLaunchHistory(), refreshStudioCenter(false)]);
    return result;
  } finally {
    state.studio.loading = false;
    if (state.studio.center) renderStudioCenter(state.studio.center);
  }
}

async function launchStudio() {
  if (state.launchPending) return;
  setLaunchBusy(true);
  try {
    const result = await window.dragonStrap.launchStudio();
    showToast(result.ok ? `Roblox Studio launch request sent (${result.studioProfile?.name || 'Studio'}).` : (result.message || 'Studio could not be launched.'), !result.ok);
    setLaunchResult(result, 'Roblox Studio');
    await loadLaunchHistory();
    return result;
  } finally {
    setLaunchBusy(false);
  }
}


function maintenanceGroupLabel(id) {
  return ({
    dragonCache:'DragonStrap Cache', dragonCodeCache:'DragonStrap Code Cache', dragonGpuCache:'DragonStrap GPU Cache',
    robloxTemp:'Roblox TEMP', robloxDownloads:'Roblox Downloads'
  })[id] || id;
}

function renderMaintenance(stateData) {
  if (!stateData) return;
  state.maintenance.data = stateData;
  const health = stateData.health || 'attention';
  const badge = q('#maintenanceHealthBadge');
  badge.textContent = health === 'healthy' ? 'HEALTHY' : (health === 'warning' ? 'REVIEW' : 'ATTENTION');
  badge.dataset.health = health;
  const orb = q('#maintenanceHealthOrb');
  orb.textContent = health === 'healthy' ? '✓' : (health === 'warning' ? '!' : '×');
  orb.dataset.health = health;
  q('#maintenanceHealthText').textContent = health === 'healthy' ? 'Environment Healthy' : (health === 'warning' ? 'Review Recommended' : 'Repair Recommended');
  q('#maintenanceHealthSub').textContent = `Last scan ${new Date(stateData.generatedAt).toLocaleTimeString()}`;

  q('#maintenanceChecks').innerHTML = (stateData.checks || []).map(item => `
    <div class="maintenance-check ${item.level}"><i></i><div><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.detail)}</span></div><b>${item.level.toUpperCase()}</b></div>
  `).join('') || '<div class="maintenance-empty">No diagnostic checks available.</div>';

  q('#maintenanceCacheTotal').textContent = stateData.cache?.totalText || '0 B';
  q('#maintenanceCacheList').innerHTML = (stateData.cache?.groups || []).map(group => `
    <div><span>${escapeHtml(maintenanceGroupLabel(group.id))}</span><strong>${escapeHtml(group.text || '0 B')}</strong></div>
  `).join('');

  const config = stateData.clientSettings || {};
  const configDot = q('#maintenanceConfigDot');
  configDot.classList.toggle('online', config.state !== 'malformed');
  configDot.classList.toggle('offline', config.state === 'malformed');
  q('#maintenanceConfigState').textContent = config.state === 'malformed' ? 'Repair required' : (config.state === 'valid' ? 'Valid configuration' : 'Roblox defaults');
  q('#maintenanceConfigDetail').textContent = config.message || '—';
  q('#maintenanceConfigPath').textContent = config.path || 'Roblox Player not detected';
  q('#maintenanceRepairConfigBtn').disabled = !config.repairAvailable;

  q('#maintenanceLogsTotal').textContent = stateData.logs?.bytes !== undefined ? formatBytesLocal(stateData.logs.bytes) : '0 B';
  q('#maintenanceLogCount').textContent = String(stateData.logs?.files || 0);

  const recovery=stateData.recovery || {};
  const integrity=recovery.integrity || {};
  const integrityBadge=q('#recoveryIntegrityBadge');
  const integrityLevel=integrity.level || 'critical';
  integrityBadge.textContent=integrityLevel === 'healthy' ? 'HEALTHY' : (integrityLevel === 'warning' ? 'REVIEW' : 'CORRUPTION');
  integrityBadge.dataset.health=integrityLevel === 'critical' ? 'attention' : integrityLevel;
  q('#recoveryIntegrityState').textContent=integrityLevel === 'healthy' ? 'Player structure looks healthy' : (integrityLevel === 'warning' ? 'Player needs review' : 'Player corruption detected');
  q('#recoveryIntegrityVersion').textContent=integrity.version || 'Not detected';
  q('#recoveryIntegrityChecks').innerHTML=(integrity.checks || []).map(item=>`<div class="maintenance-check ${item.level}"><i></i><div><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.detail)}</span></div><b>${String(item.level || '').toUpperCase()}</b></div>`).join('') || '<div class="maintenance-empty">No Player integrity checks available.</div>';
  const rollback=recovery.rollback || {};
  q('#recoveryRollbackDetail').textContent=rollback.available ? `${rollback.type === 'backup' ? 'Pre-replacement backup' : 'Previous version'} • ${rollback.targetVersion}` : (rollback.reason || 'No rollback candidate available.');
  q('#maintenanceRollbackBtn').disabled=!rollback.available;

  const restorePoints=recovery.restorePoints || [];
  q('#recoveryRestoreCount').textContent=String(restorePoints.length);
  q('#recoveryRestoreList').innerHTML=restorePoints.length ? restorePoints.map(item=>`
    <div class="recovery-restore-item" data-restore-id="${escapeHtml(item.id)}"><div><strong>${escapeHtml(item.label)}</strong><span>${new Date(item.createdAt).toLocaleString()} • ${item.fileCount} file${item.fileCount===1?'':'s'}</span></div><div><button class="secondary-action recovery-restore-apply" data-id="${escapeHtml(item.id)}">RESTORE</button><button class="secondary-action recovery-restore-delete" data-id="${escapeHtml(item.id)}">DELETE</button></div></div>
  `).join('') : '<div class="maintenance-empty">No restore points yet.</div>';

  const updateRecovery=recovery.update || {};
  const updateDot=q('#recoveryUpdateDot');
  updateDot.classList.toggle('online',updateRecovery.healthy === true);
  updateDot.classList.toggle('offline',updateRecovery.healthy === false);
  q('#recoveryUpdateState').textContent=updateRecovery.healthy ? 'Update recovery state healthy' : `${(updateRecovery.issues || []).length} recovery issue${(updateRecovery.issues || []).length===1?'':'s'} detected`;
  q('#recoveryUpdateDetail').textContent=updateRecovery.staged ? `Verified staged update: ${updateRecovery.staged.version}` : (updateRecovery.active ? 'Update download currently active.' : 'No active staged update.');
  q('#recoveryUpdateIssues').innerHTML=(updateRecovery.issues || []).map(item=>`<div><strong>${escapeHtml(item.code || 'ISSUE')}</strong><span>${escapeHtml(item.message || '')}</span></div>`).join('') || '<div class="recovery-ok-line">No interrupted update artifacts detected.</div>';
  q('#maintenanceRepairUpdateBtn').disabled=Boolean(updateRecovery.active) || updateRecovery.healthy === true;
}

function formatBytesLocal(bytes) {
  const value = Number(bytes || 0);
  if (value <= 0) return '0 B';
  const units = ['B','KB','MB','GB'];
  let n = value, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  return `${n >= 10 || i === 0 ? n.toFixed(i === 0 ? 0 : 1) : n.toFixed(2)} ${units[i]}`;
}

async function refreshMaintenance(announce = false) {
  if (state.maintenance.loading) return state.maintenance.data;
  state.maintenance.loading = true;
  try {
    const result = await window.dragonStrap.getMaintenanceState();
    renderMaintenance(result);
    if (announce) showToast('Maintenance diagnostics refreshed.');
    return result;
  } catch (error) {
    console.error(error);
    if (announce) showToast('Maintenance diagnostics could not be read.', true);
    return null;
  } finally {
    state.maintenance.loading = false;
  }
}

async function clearMaintenanceCache(scope) {
  const result = await window.dragonStrap.clearMaintenanceCache(scope);
  if (result.state) renderMaintenance(result.state);
  const message = result.ok
    ? `Cleared ${result.removedText || '0 B'} of cache.`
    : (result.message || `Cache cleanup completed with ${result.failures?.length || 1} locked item(s).`);
  showToast(message, !result.ok && !result.partial);
}

async function repairMaintenanceConfig() {
  const result = await window.dragonStrap.repairClientSettings();
  if (result.state) renderMaintenance(result.state);
  showToast(result.ok ? (result.repaired ? `Client settings repaired from ${result.source}.` : result.message) : (result.message || 'Client settings repair failed.'), !result.ok);
}

async function createMaintenanceRestorePoint() {
  const label=q('#recoveryRestoreLabel').value.trim() || 'Manual restore point';
  const result=await window.dragonStrap.createConfigurationRestorePoint(label);
  if (result.state) renderMaintenance(result.state);
  if (result.ok) q('#recoveryRestoreLabel').value='';
  showToast(result.ok ? `Restore point created (${result.restorePoint?.fileCount || 0} files).` : (result.message || 'Restore point could not be created.'),!result.ok);
}

async function restoreMaintenancePoint(id) {
  if (!id || !confirm('Restore this configuration point? DragonStrap will automatically create a safety restore point first.')) return;
  const result=await window.dragonStrap.restoreConfigurationRestorePoint(id);
  if (result.state) renderMaintenance(result.state);
  showToast(result.ok ? `Restored ${result.restoredCount || 0} configuration file(s). Restart DragonStrap if the UI does not immediately reflect every restored setting.` : (result.message || 'Configuration restore failed.'),!result.ok);
}

async function deleteMaintenancePoint(id) {
  if (!id || !confirm('Delete this restore point?')) return;
  const result=await window.dragonStrap.deleteConfigurationRestorePoint(id);
  if (result.state) renderMaintenance(result.state);
  showToast(result.ok ? 'Restore point deleted.' : (result.message || 'Restore point could not be deleted.'),!result.ok);
}

async function runMaintenanceSafeRepair() {
  const button=q('#maintenanceSafeRepairBtn');
  button.disabled=true;
  q('#recoverySafeRepairResult').textContent='Safe Repair is running…';
  try {
    const result=await window.dragonStrap.runSafeRepair();
    if (result.state) renderMaintenance(result.state);
    const actions=(result.actions || []).map(item=>`${item.ok===false?'⚠':'✓'} ${item.detail}`).join(' ');
    q('#recoverySafeRepairResult').textContent=actions || result.message || 'No repairable issues were found.';
    showToast(result.ok ? (result.message || 'Safe Repair completed.') : (result.message || 'Safe Repair completed with issues.'),!result.ok);
  } finally { button.disabled=false; }
}

q('#homePerfFpsBtn').addEventListener('click', () => openPerformanceControl('#fpsRange'));
q('#homePerfRenderBtn').addEventListener('click', () => openPerformanceControl('#renderModeChoice'));
q('#homePerfNetworkBtn').addEventListener('click', () => { switchView('servers'); requestAnimationFrame(() => q('#serverPlaceInput')?.focus()); });
q('#homePerfChartBtn').addEventListener('click', () => openPerformanceControl('.performance-hero'));
q('#homePerfAutoBtn').addEventListener('click', enableHomePerformanceAuto);
q('#homePerfCustomBtn').addEventListener('click', openHomePerformanceCustom);

q('#launchKnob').addEventListener('click', () => launchPlayer({}));
q('#launchPlayerBtn').addEventListener('click', () => launchPlayer({}));
q('#launchStudioBtn').addEventListener('click', launchStudio);
q('#studioLaunchTop').addEventListener('click', launchStudio);
q('#studioOpenProjectBtn').addEventListener('click', chooseAndLaunchStudioProject);
q('#studioRefreshBtn').addEventListener('click', async () => { await refreshRobloxStatus(false); await refreshStudioCenter(true); });
q('#studioClearHistoryBtn').addEventListener('click', async () => { await window.dragonStrap.clearStudioProjectHistory(); await refreshStudioCenter(false); showToast('Studio project history cleared.'); });
q('#studioOpenInstallBtn').addEventListener('click', async () => { const result = await window.dragonStrap.openStudioInstallFolder(); showToast(result.ok ? 'Opened Studio install folder.' : (result.message || 'Studio install folder unavailable.'), !result.ok); });
q('#studioOpenLogsBtn').addEventListener('click', async () => { const result = await window.dragonStrap.openStudioLogsFolder(); showToast(result.ok ? 'Opened Roblox logs folder.' : (result.message || 'Roblox logs folder unavailable.'), !result.ok); });
q('#studioChannelCheckBtn').addEventListener('click', () => checkStudioChannel(false));
q('#studioChannelSelectBtn').addEventListener('click', () => checkStudioChannel(true));
q('#studioChannelInput').addEventListener('keydown', event => { if (event.key === 'Enter') checkStudioChannel(false); });
q('#studioLaunchProfileSelect').addEventListener('change', event => saveStudioSettings({ launchProfile:event.target.value }, 'Studio launch profile updated.'));
q('#studioAutoBackup').addEventListener('change', event => saveStudioSettings({ autoBackup:event.target.checked }, event.target.checked ? 'Studio Auto Backup enabled.' : 'Studio Auto Backup disabled.'));
q('#studioBackupRetention').addEventListener('change', event => saveStudioSettings({ backupRetention:Number(event.target.value) }, 'Studio backup retention updated.'));
q('#studioFastFlagsToggle').addEventListener('change', async event => {
  const result=await window.dragonStrap.toggleStudioFastFlags(event.target.checked);
  if (result?.state) renderStudioCenter(result.state);
  showToast(result.ok ? (event.target.checked ? 'Isolated Studio FastFlags enabled.' : 'Studio FastFlags disabled.') : (result.message || 'Studio FastFlag state could not be changed.'),!result.ok);
});
q('#studioFlagSetBtn').addEventListener('click', setStudioFastFlag);
q('#studioFlagKey').addEventListener('keydown', event => { if (event.key === 'Enter') setStudioFastFlag(); });
q('#studioFlagValue').addEventListener('keydown', event => { if (event.key === 'Enter') setStudioFastFlag(); });
q('#studioFlagRestoreBtn').addEventListener('click', async () => {
  const result=await window.dragonStrap.restoreStudioFastFlagsBackup();
  if (result?.state) renderStudioCenter(result.state);
  showToast(result.ok ? 'Studio FastFlag backup restored.' : (result.message || 'Studio FastFlag backup could not be restored.'),!result.ok);
});
q('#launchExperienceBtn').addEventListener('click', launchExperience);
q('#launchCenterRefresh').addEventListener('click', () => refreshRobloxStatus(true));
q('#clearLaunchTargetBtn').addEventListener('click', async () => {
  q('#launchTargetInput').value = '';
  q('#launchInstanceInput').value = '';
  await saveSettings({ lastLaunchTarget: '' });
  q('#launchTargetInput').focus();
});
q('#clearLaunchHistoryBtn').addEventListener('click', async () => {
  renderLaunchHistory(await window.dragonStrap.clearLaunchHistory());
  showToast('Launch history cleared.');
});
q('#launchTargetInput').addEventListener('change', event => saveSettings({ lastLaunchTarget: event.target.value.trim() }));
q('#launchTargetInput').addEventListener('keydown', event => { if (event.key === 'Enter') launchExperience(); });
q('#launchInstanceInput').addEventListener('keydown', event => { if (event.key === 'Enter') launchExperience(); });
q('#refreshStatus').addEventListener('click', () => refreshRobloxStatus(true));
q('#homeRefresh').addEventListener('click', () => refreshRobloxStatus(true));
q('#instanceRefresh').addEventListener('click', () => refreshRobloxStatus(true));
q('#maintenanceRefreshBtn').addEventListener('click', () => refreshMaintenance(true));
q('#maintenanceClearDragonBtn').addEventListener('click', () => clearMaintenanceCache('dragonstrap'));
q('#maintenanceClearRobloxBtn').addEventListener('click', () => clearMaintenanceCache('roblox'));
q('#maintenanceClearAllBtn').addEventListener('click', () => clearMaintenanceCache('all'));
q('#maintenanceRepairConfigBtn').addEventListener('click', repairMaintenanceConfig);
q('#maintenanceCreateRestoreBtn').addEventListener('click', createMaintenanceRestorePoint);
q('#recoveryRestoreList').addEventListener('click', event => {
  const restore=event.target.closest('.recovery-restore-apply');
  const remove=event.target.closest('.recovery-restore-delete');
  if (restore) restoreMaintenancePoint(restore.dataset.id);
  else if (remove) deleteMaintenancePoint(remove.dataset.id);
});
q('#maintenanceRollbackBtn').addEventListener('click', async () => {
  if (!confirm("Roll back Roblox Player to DragonStrap's trusted previous installation?")) return;
  const result=await window.dragonStrap.rollbackRobloxPlayer();
  if (result.state) renderMaintenance(result.state);
  showToast(result.ok ? result.message : (result.message || 'Roblox Player rollback failed.'),!result.ok);
});
q('#maintenanceRepairUpdateBtn').addEventListener('click', async () => {
  const result=await window.dragonStrap.repairUpdateRecovery();
  if (result.state) renderMaintenance(result.state);
  showToast(result.ok ? 'Update recovery state repaired.' : (result.message || 'Update recovery failed.'),!result.ok);
});
q('#maintenanceSafeRepairBtn').addEventListener('click', runMaintenanceSafeRepair);
q('#maintenanceClearLogsBtn').addEventListener('click', async () => {
  const result = await window.dragonStrap.clearOldRobloxLogs(7);
  if (result.state) renderMaintenance(result.state);
  showToast(result.ok ? `Removed ${result.removedFiles || 0} old log file(s) (${result.removedText || '0 B'}).` : 'Old-log cleanup completed with locked files.', !result.ok && !result.partial);
});
q('#maintenanceOpenLogsBtn').addEventListener('click', async () => {
  const result = await window.dragonStrap.openMaintenanceLocation('logs');
  showToast(result.ok ? 'Opened Roblox logs folder.' : (result.message || 'Logs folder is unavailable.'), !result.ok);
});
qsa('[data-maint-location]').forEach(button => button.addEventListener('click', async () => {
  const result = await window.dragonStrap.openMaintenanceLocation(button.dataset.maintLocation);
  showToast(result.ok ? 'Opened folder.' : (result.message || 'Folder is unavailable.'), !result.ok);
}));
q('#maintenanceExportBtn').addEventListener('click', async () => {
  const result = await window.dragonStrap.exportDiagnostics();
  if (result.canceled) return;
  showToast(result.ok ? 'Diagnostic report exported.' : (result.message || 'Diagnostic export failed.'), !result.ok);
});

q('#systemToggle').addEventListener('change', event => {
  const enabled = event.target.checked;
  q('#systemState').textContent = enabled ? 'Services Active' : 'Services Standby';
  q('#systemState').style.color = enabled ? '#c8a4e4' : '#8a7d96';
});

q('#fpsRange').addEventListener('input', event => {
  q('#fpsReadout').textContent = fpsLabel(event.target.value);
  q('#fpsSlider').value = event.target.value;
});
q('#fpsRange').addEventListener('change', event => savePerformancePatch({ fpsCap: Number(event.target.value) }));
q('#fpsSlider').addEventListener('input', event => {
  q('#fpsRange').value = event.target.value;
  q('#fpsReadout').textContent = fpsLabel(event.target.value);
});
q('#fpsSlider').addEventListener('change', event => savePerformancePatch({ fpsCap: Number(event.target.value) }));
qsa('[data-perf-profile]').forEach(button => button.addEventListener('click', () => setProfile(button.dataset.perfProfile)));
qsa('#renderModeChoice [data-value]').forEach(button => button.addEventListener('click', () => savePerformancePatch({ renderMode: button.dataset.value })));
qsa('#msaaChoice [data-value]').forEach(button => button.addEventListener('click', () => savePerformancePatch({ msaaMode: button.dataset.value })));
q('#performanceAutoApply').addEventListener('change', event => savePerformancePatch({ performanceAutoApply: event.target.checked }, false));
q('#applyPerformanceBtn').addEventListener('click', applyPerformanceNow);
q('#restorePerformanceBtn').addEventListener('click', restorePerformanceDefaults);
q('#refreshPerformanceState').addEventListener('click', () => refreshPerformanceState(true));
q('#refreshPerformanceCenter').addEventListener('click', () => refreshPerformanceCenter(true));
q('#useHardwareRecommendationBtn').addEventListener('click', useHardwareRecommendation);
q('#applySavedPerformanceProfile').addEventListener('click', applySelectedPerformanceProfile);
q('#savePerformanceProfileBtn').addEventListener('click', saveCurrentPerformanceProfile);
q('#deletePerformanceProfileBtn').addEventListener('click', deleteSelectedPerformanceProfile);
q('#performanceProfileSelect').addEventListener('change', () => { const profile = state.performanceCenter.profiles?.profiles?.find(item => item.id === q('#performanceProfileSelect').value); q('#deletePerformanceProfileBtn').disabled = !profile || profile.builtin; });
q('#assignPerformanceExperienceBtn').addEventListener('click', assignExperiencePerformanceProfile);
q('#removePerformanceExperienceBtn').addEventListener('click', removeExperiencePerformanceProfile);
q('#performanceProfileName').addEventListener('keydown', event => { if (event.key === 'Enter') saveCurrentPerformanceProfile(); });
q('#performanceExperiencePlaceId').addEventListener('keydown', event => { if (event.key === 'Enter') assignExperiencePerformanceProfile(); });
q('#launchProfile').addEventListener('change', event => setProfile(event.target.value));
q('#minimizeOnLaunch').addEventListener('change', event => saveSettings({ minimizeOnLaunch: event.target.checked }));
q('#notificationsSetting').addEventListener('change', event => saveSettings({ notifications: event.target.checked }));
q('#refreshSeconds').addEventListener('change', async event => {
  await saveSettings({ refreshSeconds: Number(event.target.value) });
  installRefreshTimer();
});
q('#checkForUpdatesSetting').addEventListener('change', event => saveSettings({ checkForUpdates:event.target.checked }));
q('#updateChannelSetting').addEventListener('change', async event => {
  await saveSettings({ updateChannel:event.target.value });
  await refreshUpdateState(true,false);
});
q('#checkUpdatesBtn').addEventListener('click', () => refreshUpdateState(true,true));
q('#downloadUpdateBtn').addEventListener('click', downloadDragonStrapUpdate);
q('#applyUpdateBtn').addEventListener('click', applyDragonStrapUpdate);
q('#cancelUpdateDownloadBtn').addEventListener('click', async () => {
  const result=await window.dragonStrap.cancelUpdateDownload();
  if (!result.ok) showToast(result.message || 'No active update download.',true);
});
q('#deferUpdateBtn').addEventListener('click', deferDragonStrapUpdate);
q('#clearUpdateDeferralBtn').addEventListener('click', async () => {
  const result=await window.dragonStrap.clearUpdateDeferral();
  if (result.state) renderUpdateState(result.state);
  showToast(result.ok ? 'Update deferral cleared.' : (result.message || 'Could not clear update deferral.'), !result.ok);
});
q('#openUpdateFolderBtn').addEventListener('click', async () => {
  const result=await window.dragonStrap.openUpdateFolder();
  if (!result.ok) showToast(result.message || 'Update folder unavailable.',true);
});
q('#openReleaseBtn').addEventListener('click', async () => {
  const result=await window.dragonStrap.openUpdateRelease();
  if (!result.ok) showToast(result.message || 'Release page unavailable.',true);
});
q('#openReliabilityLogsBtn').addEventListener('click', async () => {
  const result=await window.dragonStrap.openReliabilityLogs();
  showToast(result.ok ? 'Opened DragonStrap reliability logs.' : (result.message || 'Reliability logs unavailable.'), !result.ok);
});


q('#configurationProfileSelect').addEventListener('change', async () => { renderConfigurationProfileSummary(selectedConfigurationProfile()); await previewSelectedConfigurationProfile(false); });
q('#configurationSaveBtn').addEventListener('click', saveCurrentConfigurationProfile);
q('#configurationApplyBtn').addEventListener('click', applySelectedConfigurationProfile);
q('#configurationCloneBtn').addEventListener('click', cloneSelectedConfigurationProfile);
q('#configurationDeleteBtn').addEventListener('click', deleteSelectedConfigurationProfile);
q('#configurationExportBtn').addEventListener('click', exportSelectedConfigurationProfile);
q('#configurationImportBtn').addEventListener('click', importConfigurationProfile);
q('#configurationPreviewBtn').addEventListener('click', () => previewSelectedConfigurationProfile(true));
q('#configurationProfileName').addEventListener('keydown', event => { if(event.key === 'Enter') saveCurrentConfigurationProfile(); });
q('#configurationCloneName').addEventListener('keydown', event => { if(event.key === 'Enter') cloneSelectedConfigurationProfile(); });

q('#serverLookupBtn').addEventListener('click', () => lookupServerIntelligence(false));
q('#serverRefreshBtn').addEventListener('click', () => lookupServerIntelligence(true));
q('#serverPlaceInput').addEventListener('keydown', event => { if (event.key === 'Enter') lookupServerIntelligence(false); });
q('#serverFilterInput').addEventListener('input', renderServerList);
q('#serverSortSelect').addEventListener('change', async event => { await saveSettings({serverSort:event.target.value}); renderServerList(); });
q('#serverOccupancySelect').addEventListener('change', async event => { await saveSettings({serverOccupancy:event.target.value}); renderServerList(); });
q('#serverFavoritesOnly').addEventListener('change', async event => { await saveSettings({serverFavoritesOnly:event.target.checked}); renderServerList(); });
q('#serverHideFull').addEventListener('change', async event => { await saveSettings({serverHideFull:event.target.checked}); renderServerList(); });
q('#serverCompareClearBtn').addEventListener('click', () => { state.servers.compareIds.clear(); renderServerComparison(); renderServerList(); });
q('#serverClearRecentBtn').addEventListener('click', async () => { const result=await window.dragonStrap.clearRecentServers(); if(result?.ok){state.servers.saved.recent=result.recent||[];renderServerSavedLists();showToast('Recent server history cleared.');} });

q('#fastFlagSearch').addEventListener('input', renderFastFlagList);
q('#fastFlagCategoryFilter').addEventListener('change', renderFastFlagList);
q('#fastFlagRefresh').addEventListener('click', () => refreshFastFlags(true));
q('#fastFlagEditorClear').addEventListener('click', clearFastFlagEditor);
q('#fastFlagQueueSet').addEventListener('click', queueFastFlagSet);
q('#fastFlagQueueRemove').addEventListener('click', queueFastFlagRemove);
q('#fastFlagApplyPending').addEventListener('click', applyFastFlagPending);
q('#fastFlagDiscardPending').addEventListener('click', discardFastFlagPending);
q('#fastFlagSelectFiltered').addEventListener('click', selectFilteredFastFlags);
q('#fastFlagClearSelection').addEventListener('click', clearFastFlagSelection);
q('#fastFlagBulkTrue').addEventListener('click', () => bulkSetFastFlagBoolean('True'));
q('#fastFlagBulkFalse').addEventListener('click', () => bulkSetFastFlagBoolean('False'));
q('#fastFlagBulkRemove').addEventListener('click', bulkRemoveFastFlags);
q('#fastFlagQueueSafeCore').addEventListener('click', queueFastFlagSafeCore);
q('#fastFlagImport').addEventListener('click', importFastFlags);
q('#fastFlagExport').addEventListener('click', exportFastFlags);
q('#fastFlagOpenFile').addEventListener('click', async () => {
  const result = await window.dragonStrap.showFastFlagsFile();
  showToast(result.ok ? 'Opened ClientAppSettings.json location.' : (result.message || 'FastFlag file location unavailable.'), !result.ok);
});
q('#fastFlagRestoreBackup').addEventListener('click', restoreFastFlagsBackup);
q('#fastFlagPresetSave').addEventListener('click', saveFastFlagPreset);
q('#fastFlagPresetLoad').addEventListener('click', loadFastFlagPresetToPending);
q('#fastFlagPresetShare').addEventListener('click', exportFastFlagPresetShare);
q('#fastFlagPresetImportShare').addEventListener('click', importFastFlagPresetShare);
q('#fastFlagPresetDelete').addEventListener('click', deleteFastFlagPreset);
q('#fastFlagPresetSelect').addEventListener('change', syncFastFlagPresetButtons);
q('#fastFlagSnapshotSelect').addEventListener('change', () => { q('#fastFlagSnapshotRestore').disabled = !q('#fastFlagSnapshotSelect').value; });
q('#fastFlagSnapshotRestore').addEventListener('click', restoreFastFlagSnapshot);
q('#fastFlagPresetName').addEventListener('keydown', event => { if (event.key === 'Enter') saveFastFlagPreset(); });
q('#fastFlagValue').addEventListener('keydown', event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) queueFastFlagSet(); });

q('#channelRefreshBtn').addEventListener('click', () => refreshChannelVersion(true));
q('#channelCheckBtn').addEventListener('click', () => refreshChannelVersion(true, q('#channelNameInput').value.trim()));
q('#channelSelectBtn').addEventListener('click', () => selectChannel(q('#channelNameInput').value.trim()));
q('#channelUseLiveBtn').addEventListener('click', () => { q('#channelNameInput').value = 'production'; selectChannel('production'); });
q('#channelNameInput').addEventListener('keydown', event => { if (event.key === 'Enter') refreshChannelVersion(true, event.target.value.trim()); });
q('#channelOpenPlayerFolder').addEventListener('click', async () => { const result = await window.dragonStrap.openChannelInstallFolder('player'); showToast(result.ok ? 'Opened installed Roblox Player version.' : (result.message || 'Player version folder unavailable.'), !result.ok); });
q('#channelOpenStudioFolder').addEventListener('click', async () => { const result = await window.dragonStrap.openChannelInstallFolder('studio'); showToast(result.ok ? 'Opened installed Roblox Studio version.' : (result.message || 'Studio version folder unavailable.'), !result.ok); });
q('#playerInstallPlanBtn').addEventListener('click', () => analyzePlayerInstall(true));
q('#playerInstallStartBtn').addEventListener('click', startPlayerInstall);
q('#playerInstallCancelBtn').addEventListener('click', cancelPlayerInstall);

q('#productMenuButton').addEventListener('click', event => {
  event.stopPropagation();
  const open = q('#productMenuButton').getAttribute('aria-expanded') === 'true';
  setProductMenuOpen(!open);
});
q('#productHelpBtn').addEventListener('click', openDragonHelp);
q('#productAboutBtn').addEventListener('click', openDragonAbout);
q('#helpDialogClose').addEventListener('click', () => q('#helpDialog')?.close());
q('#helpDialog').addEventListener('click', event => { if (event.target === q('#helpDialog')) q('#helpDialog').close(); });
qsa('[data-help-tab]').forEach(button => button.addEventListener('click', () => {
  q('#helpDialog')?.close();
  switchView(button.dataset.helpTab);
}));
document.addEventListener('click', event => {
  if (!q('#productMenu')?.contains(event.target)) setProductMenuOpen(false);
});

q('#globalSearch').addEventListener('input', event => {
  const term = event.target.value.trim().toLowerCase();
  if (!term) return;
  const match = qsa('.nav-item').find(item => item.textContent.toLowerCase().includes(term));
  if (match) switchView(match.dataset.tab);
});

document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    q('#globalSearch')?.focus();
    q('#globalSearch')?.select();
  }
  if (event.key === 'Escape' && document.activeElement === q('#globalSearch')) {
    q('#globalSearch').value = '';
    q('#globalSearch').blur();
  }
  if (event.key === 'Escape' && q('#productMenuButton')?.getAttribute('aria-expanded') === 'true') {
    setProductMenuOpen(false);
    q('#productMenuButton')?.focus();
  }
});

window.dragonStrap.onPlayerInstallProgress(progress => {
  renderPlayerInstallProgress(progress);
  if (document.documentElement.dataset.view === 'settings') refreshCoreState(false).catch(console.error);
});
window.dragonStrap.onRobloxStatusChanged(status => {
  renderRobloxStatus(status);
  refreshChannelVersion(false).catch(console.error);
  if (document.documentElement.dataset.view === 'performance') refreshPerformanceCenter(false).catch(console.error);
});

const restoredView = localStorage.getItem('dragonstrap.activeView');
if (restoredView && q(`.nav-item[data-tab="${restoredView}"]`)) switchView(restoredView);
else switchView('home');

window.dragonStrap.onUpdateDownloadProgress(progress => {
  state.updates.progress=progress;
  const active=['checksums','downloading','verifying'].includes(progress?.phase);
  state.updates.downloading=active;
  renderUpdateProgress(progress, state.updates.data?.selfUpdate?.staged || null);
  if (q('#cancelUpdateDownloadBtn')) q('#cancelUpdateDownloadBtn').disabled=!active;
  if (q('#downloadUpdateBtn') && active) q('#downloadUpdateBtn').disabled=true;
  if (q('#applyUpdateBtn') && active) q('#applyUpdateBtn').disabled=true;
  if (document.documentElement.dataset.view === 'settings') refreshCoreState(false).catch(console.error);
});

(async function initialize() {
  // DragonStrap 2.0 keeps startup lean: load only shell/home state, then lazy-load feature centers on navigation.
  await Promise.all([getAppInfo(), loadSettings(), loadLaunchHistory(), refreshConfigurationProfiles(false)]);
  await refreshRobloxStatus(false);
  await Promise.all([refreshCoreState(false), refreshUpdateState(false,false), refreshReliabilityState(), restorePlayerInstallState()]);
  if (state.settings?.checkForUpdates !== false) {
    setTimeout(() => refreshUpdateState(true,false), 2200);
  }
  setInterval(() => {
    if (document.documentElement.dataset.view === 'settings') refreshReliabilityState();
  }, 60_000);
})();
