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
  fastFlags: { entries: [], path: '', backupExists: false, pendingSet: new Map(), pendingRemove: new Set(), selectedKey: null, presets: [] },
  servers: { result: null, loading: false },
  studio: { center: null, loading: false },
  channels: { data: null, loading: false },
  maintenance: { data: null, loading: false },
  updates: { data: null, loading: false },
  reliability: { data: null },
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

qsa('.segmented').forEach(group => {
  group.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('button').forEach(item => item.classList.remove('active'));
      btn.classList.add('active');
    });
  });
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


function fastFlagPendingCount() {
  return state.fastFlags.pendingSet.size + state.fastFlags.pendingRemove.size;
}

function setFastFlagHint(message, kind = '') {
  const hint = q('#fastFlagEditorHint');
  if (!hint) return;
  hint.textContent = message;
  hint.classList.toggle('error', kind === 'error');
  hint.classList.toggle('ok', kind === 'ok');
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
  setFastFlagHint('Performance+ owned keys are visible but locked here.');
  renderFastFlagList();
}

function getFastFlagEntry(key) {
  if (state.fastFlags.pendingSet.has(key)) {
    const queued = state.fastFlags.pendingSet.get(key);
    const current = state.fastFlags.entries.find(item => item.key === key);
    return { ...(current || {}), ...queued, key, protected: current?.protected || false, pending: true };
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
  setFastFlagHint(
    locked ? 'This key is owned by Performance+. Edit it from the Performance+ page.' : 'Edit the value, then queue the change for review.',
    locked ? 'error' : ''
  );
  renderFastFlagList();
}

function renderFastFlagPending() {
  const list = q('#fastFlagPendingList');
  if (!list) return;
  list.replaceChildren();
  const changes = [];
  for (const [key, item] of state.fastFlags.pendingSet) changes.push({ action: 'SET', key, value: item.value });
  for (const key of state.fastFlags.pendingRemove) changes.push({ action: 'REMOVE', key, value: '' });
  changes.sort((a, b) => a.key.localeCompare(b.key));
  q('#fastFlagPendingCount').textContent = String(changes.length);
  q('#fastFlagApplyPending').disabled = changes.length === 0;
  q('#fastFlagDiscardPending').disabled = changes.length === 0;
  if (!changes.length) {
    const empty = document.createElement('div');
    empty.className = 'fastflag-empty';
    empty.textContent = 'No pending changes.';
    list.append(empty);
    return;
  }
  for (const change of changes) {
    const row = document.createElement('div');
    row.className = `fastflag-pending-item${change.action === 'REMOVE' ? ' remove' : ''}`;
    const action = document.createElement('b');
    action.textContent = change.action;
    const detail = document.createElement('span');
    detail.textContent = change.action === 'REMOVE' ? change.key : `${change.key} = ${change.value}`;
    row.append(action, detail);
    list.append(row);
  }
}

function renderFastFlagList() {
  const list = q('#fastFlagList');
  if (!list) return;
  const term = (q('#fastFlagSearch')?.value || '').trim().toLowerCase();
  const map = new Map(state.fastFlags.entries.map(item => [item.key, { ...item }]));
  for (const [key, item] of state.fastFlags.pendingSet) {
    const current = map.get(key);
    map.set(key, { ...(current || {}), ...item, key, protected: current?.protected || false, pending: true });
  }
  const rows = [...map.values()]
    .filter(item => !term || item.key.toLowerCase().includes(term) || String(item.value).toLowerCase().includes(term))
    .sort((a, b) => a.key.localeCompare(b.key));
  list.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'fastflag-empty';
    empty.textContent = term ? 'No flags match this search.' : 'No ClientAppSettings flags are currently applied.';
    list.append(empty);
  }
  for (const item of rows) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'fastflag-row';
    if (state.fastFlags.selectedKey === item.key) row.classList.add('selected');
    if (state.fastFlags.pendingSet.has(item.key)) row.classList.add('pending');
    if (state.fastFlags.pendingRemove.has(item.key)) row.classList.add('removing');
    row.dataset.key = item.key;

    const key = document.createElement('span'); key.className = 'fastflag-key'; key.textContent = item.key;
    const value = document.createElement('span'); value.className = 'fastflag-value'; value.textContent = String(item.value ?? '');
    const type = document.createElement('span'); type.className = 'fastflag-type'; type.textContent = item.type || 'string';
    const status = document.createElement('span'); status.className = 'fastflag-state-pill';
    if (item.protected) { status.classList.add('locked'); status.textContent = 'PERFORMANCE+'; }
    else if (state.fastFlags.pendingRemove.has(item.key)) { status.classList.add('changed'); status.textContent = 'REMOVE'; }
    else if (state.fastFlags.pendingSet.has(item.key)) { status.classList.add('changed'); status.textContent = 'PENDING'; }
    else status.textContent = 'EDITABLE';
    row.append(key, value, type, status);
    row.addEventListener('click', () => selectFastFlag(item.key));
    list.append(row);
  }
  renderFastFlagPending();
}

function renderFastFlagState(result) {
  if (!result?.ok) {
    state.fastFlags.entries = [];
    state.fastFlags.path = result?.path || '';
    q('#fastFlagCount').textContent = 'UNAVAILABLE';
    q('#fastFlagPath').textContent = result?.path || 'Roblox Player not detected';
    q('#fastFlagBackupState').textContent = 'Unavailable';
    q('#fastFlagEditableCount').textContent = '0';
    q('#fastFlagProtectedCount').textContent = '0 locked';
    q('#fastFlagRestoreBackup').disabled = true;
    renderFastFlagList();
    return;
  }
  state.fastFlags.entries = result.entries || [];
  state.fastFlags.path = result.path || '';
  state.fastFlags.backupExists = Boolean(result.backupExists);
  q('#fastFlagCount').textContent = `${result.total || 0} FLAGS`;
  q('#fastFlagPath').textContent = result.path || '—';
  q('#fastFlagBackupState').textContent = result.backupExists ? 'Available' : 'Not created';
  q('#fastFlagEditableCount').textContent = String(result.editableCount || 0);
  q('#fastFlagProtectedCount').textContent = `${result.protectedCount || 0} locked`;
  q('#fastFlagRestoreBackup').disabled = !result.backupExists;
  renderFastFlagList();
}

async function refreshFastFlags(announce = false) {
  try {
    const result = await window.dragonStrap.getFastFlagsState();
    renderFastFlagState(result);
    if (announce) showToast(result.ok ? 'FastFlag state refreshed.' : (result.message || 'FastFlag state unavailable.'), !result.ok);
    return result;
  } catch (error) {
    console.error(error);
    if (announce) showToast('FastFlag state could not be read.', true);
    return null;
  }
}

function queueFastFlagSet() {
  const key = q('#fastFlagKey').value.trim();
  const value = q('#fastFlagValue').value;
  const type = q('#fastFlagType').value;
  if (!/^[A-Za-z][A-Za-z0-9_]{1,159}$/.test(key)) {
    setFastFlagHint('Enter a valid flag name: letters/numbers/underscores, starting with a letter.', 'error');
    return;
  }
  const existing = state.fastFlags.entries.find(item => item.key === key);
  if (existing?.protected) {
    setFastFlagHint('This key is managed by Performance+ and cannot be queued here.', 'error');
    return;
  }
  state.fastFlags.pendingRemove.delete(key);
  state.fastFlags.pendingSet.set(key, { key, value, type });
  state.fastFlags.selectedKey = key;
  setFastFlagHint('Change queued. Review it below, then apply when ready.', 'ok');
  renderFastFlagList();
}

function queueFastFlagRemove() {
  const key = q('#fastFlagKey').value.trim();
  if (!key) { setFastFlagHint('Select or enter a flag first.', 'error'); return; }
  const existing = state.fastFlags.entries.find(item => item.key === key);
  if (existing?.protected) { setFastFlagHint('Performance+ keys cannot be removed here.', 'error'); return; }
  if (!existing && state.fastFlags.pendingSet.has(key)) {
    state.fastFlags.pendingSet.delete(key);
    clearFastFlagEditor();
    return;
  }
  state.fastFlags.pendingSet.delete(key);
  state.fastFlags.pendingRemove.add(key);
  setFastFlagHint('Removal queued. Nothing is deleted until Apply Changes.', 'ok');
  renderFastFlagList();
}

async function applyFastFlagPending() {
  if (fastFlagPendingCount() === 0) return;
  const button = q('#fastFlagApplyPending');
  button.disabled = true;
  try {
    const result = await window.dragonStrap.applyFastFlags({
      set: [...state.fastFlags.pendingSet.values()],
      remove: [...state.fastFlags.pendingRemove]
    });
    if (!result.ok) {
      showToast(result.message || 'FastFlag changes could not be applied.', true);
      setFastFlagHint(result.message || 'Apply failed.', 'error');
      return;
    }
    state.fastFlags.pendingSet.clear();
    state.fastFlags.pendingRemove.clear();
    clearFastFlagEditor();
    await Promise.all([refreshFastFlags(false), refreshPerformanceState(false)]);
    showToast(`FastFlags applied: ${result.setCount} set, ${result.removeCount} removed.`);
  } finally { button.disabled = false; }
}

function discardFastFlagPending() {
  state.fastFlags.pendingSet.clear();
  state.fastFlags.pendingRemove.clear();
  clearFastFlagEditor();
  showToast('Pending FastFlag changes discarded.');
}

async function importFastFlags() {
  const result = await window.dragonStrap.importFastFlags();
  if (!result || result.canceled) return;
  if (!result.ok) { showToast(result.message || 'FastFlag import failed.', true); return; }
  for (const item of result.entries || []) {
    state.fastFlags.pendingRemove.delete(item.key);
    state.fastFlags.pendingSet.set(item.key, { key: item.key, value: item.value, type: item.type || 'auto' });
  }
  renderFastFlagList();
  const notes = [];
  if (result.ignoredProtected?.length) notes.push(`${result.ignoredProtected.length} Performance+ key(s) ignored`);
  if (result.errors?.length) notes.push(`${result.errors.length} invalid entr${result.errors.length === 1 ? 'y' : 'ies'} skipped`);
  showToast(`Imported ${result.entries?.length || 0} flag(s) to pending${notes.length ? `; ${notes.join(', ')}` : ''}.`, Boolean(result.errors?.length));
}

async function exportFastFlags() {
  const result = await window.dragonStrap.exportFastFlags();
  if (!result || result.canceled) return;
  showToast(result.ok ? `Exported ${result.count} FastFlags.` : (result.message || 'FastFlag export failed.'), !result.ok);
}

async function restoreFastFlagsBackup() {
  const result = await window.dragonStrap.restoreFastFlagsBackup();
  if (!result.ok) { showToast(result.message || 'Backup restore failed.', true); return; }
  state.fastFlags.pendingSet.clear();
  state.fastFlags.pendingRemove.clear();
  clearFastFlagEditor();
  await Promise.all([refreshFastFlags(false), refreshPerformanceState(false)]);
  showToast(`FastFlag backup restored (${result.total} flags).`);
}

function renderFastFlagPresets(items = []) {
  state.fastFlags.presets = items;
  const select = q('#fastFlagPresetSelect');
  if (!select) return;
  const current = select.value;
  select.replaceChildren();
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = items.length ? 'Select a saved preset' : 'No saved presets';
  select.append(empty);
  for (const item of items) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${item.name} (${item.flagCount} flags)`;
    select.append(option);
  }
  if (items.some(item => item.id === current)) select.value = current;
}

async function loadFastFlagPresets() {
  try { renderFastFlagPresets(await window.dragonStrap.listFastFlagPresets()); }
  catch (error) { console.error(error); }
}

async function saveFastFlagPreset() {
  const name = q('#fastFlagPresetName').value.trim();
  if (!name) { showToast('Enter a preset name first.', true); q('#fastFlagPresetName').focus(); return; }
  const result = await window.dragonStrap.saveFastFlagPreset(name);
  if (!result.ok) { showToast(result.message || 'Preset could not be saved.', true); return; }
  q('#fastFlagPresetName').value = '';
  renderFastFlagPresets(result.items || []);
  if (result.preset?.id) q('#fastFlagPresetSelect').value = result.preset.id;
  showToast(`Saved FastFlag preset “${result.preset.name}”.`);
}

async function loadFastFlagPresetToPending() {
  const id = q('#fastFlagPresetSelect').value;
  if (!id) { showToast('Choose a preset first.', true); return; }
  const result = await window.dragonStrap.getFastFlagPreset(id);
  if (!result.ok) { showToast(result.message || 'Preset could not be loaded.', true); return; }
  const flags = result.preset.flags || {};
  state.fastFlags.pendingSet.clear();
  state.fastFlags.pendingRemove.clear();
  for (const entry of state.fastFlags.entries) {
    if (!entry.protected && !Object.hasOwn(flags, entry.key)) state.fastFlags.pendingRemove.add(entry.key);
  }
  for (const [key, value] of Object.entries(flags)) state.fastFlags.pendingSet.set(key, { key, value, type: 'auto' });
  clearFastFlagEditor();
  renderFastFlagList();
  showToast(`Preset “${result.preset.name}” staged as an exact editable snapshot.`);
}

async function deleteFastFlagPreset() {
  const id = q('#fastFlagPresetSelect').value;
  if (!id) { showToast('Choose a preset first.', true); return; }
  const result = await window.dragonStrap.deleteFastFlagPreset(id);
  renderFastFlagPresets(result.items || []);
  showToast(result.deleted ? 'FastFlag preset deleted.' : 'Preset was already unavailable.', !result.deleted);
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

function renderServerRegionStrip(stats) {
  const strip = q('#serverRegionStrip');
  if (!strip) return;
  strip.replaceChildren();
  const regions = Object.entries(stats?.regions || {}).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 14);
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

function filteredServerRows() {
  const items = [...(state.servers.result?.servers || [])];
  const term = (q('#serverFilterInput')?.value || '').trim().toLowerCase();
  const hideFull = Boolean(q('#serverHideFull')?.checked);
  const sort = q('#serverSortSelect')?.value || 'ping';
  const filtered = items.filter(server => {
    if (hideFull && Number(server.maxPlayers) > 0 && Number(server.playing) >= Number(server.maxPlayers)) return false;
    if (!term) return true;
    return [server.region, server.city, server.country, server.id].some(value => String(value || '').toLowerCase().includes(term));
  });
  filtered.sort((a, b) => {
    if (sort === 'players') return Number(b.playing || 0) - Number(a.playing || 0);
    if (sort === 'space') return (Number(b.maxPlayers || 0) - Number(b.playing || 0)) - (Number(a.maxPlayers || 0) - Number(a.playing || 0));
    if (sort === 'uptime') return Number(b.uptimeSeconds || -1) - Number(a.uptimeSeconds || -1);
    if (sort === 'region') return String(a.region || 'zzzz').localeCompare(String(b.region || 'zzzz'));
    const ap = Number.isFinite(Number(a.ping)) ? Number(a.ping) : Number.POSITIVE_INFINITY;
    const bp = Number.isFinite(Number(b.ping)) ? Number(b.ping) : Number.POSITIVE_INFINITY;
    return ap - bp;
  });
  return filtered;
}

function renderServerList() {
  const list = q('#serverList');
  if (!list) return;
  list.replaceChildren();
  const result = state.servers.result;
  if (!result?.ok) {
    const empty = document.createElement('div');
    empty.className = `server-empty-state${result ? ' server-error' : ''}`;
    empty.textContent = result?.message || 'Server Intelligence is ready. Run a lookup to begin.';
    list.append(empty);
    return;
  }
  const rows = filteredServerRows();
  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'server-empty-state';
    empty.textContent = result.servers?.length ? 'No servers match the current filters.' : 'No public servers were returned for this place.';
    list.append(empty);
    return;
  }

  for (const server of rows) {
    const row = document.createElement('div');
    row.className = 'server-row';

    const region = document.createElement('div');
    region.className = 'server-region';
    const regionTitle = document.createElement('strong');
    regionTitle.textContent = server.region || 'Region unavailable';
    const regionMeta = document.createElement('small');
    regionMeta.textContent = server.datacenterId ? `Datacenter ${server.datacenterId}` : (server.country || 'RoValra data unavailable');
    region.append(regionTitle, regionMeta);

    const players = document.createElement('span');
    players.className = 'server-metric';
    players.textContent = `${server.playing ?? 0}/${server.maxPlayers ?? 0}`;

    const ping = document.createElement('span');
    ping.className = `server-metric ${serverPingClass(server.ping)}`.trim();
    ping.textContent = Number.isFinite(Number(server.ping)) ? `${Math.round(Number(server.ping))} ms` : '—';

    const fps = document.createElement('span');
    fps.className = 'server-metric server-fps';
    fps.textContent = Number.isFinite(Number(server.fps)) ? Number(server.fps).toFixed(1) : '—';

    const uptime = document.createElement('span');
    uptime.className = 'server-metric server-uptime';
    uptime.textContent = formatServerUptime(server.uptimeSeconds);
    if (server.uptimeSeconds != null && server.uptimeEstimate) uptime.title = 'Estimated from RoValra first-seen time';

    const version = document.createElement('span');
    version.className = 'server-metric server-version';
    version.textContent = server.placeVersion == null ? '—' : `v${server.placeVersion}`;

    const id = document.createElement('span');
    id.className = 'server-id';
    id.textContent = server.id;
    id.title = server.id;

    const join = document.createElement('button');
    join.type = 'button';
    join.className = 'server-join';
    join.textContent = 'JOIN';
    join.disabled = state.launchPending || !state.roblox?.installed;
    join.addEventListener('click', async () => {
      const original = join.textContent;
      join.disabled = true;
      join.textContent = 'JOINING…';
      try {
        const launched = await launchPlayer({ target:String(result.placeId), gameInstanceId:server.id });
        if (launched?.ok) showToast(`Joining server in ${server.region || 'the selected region'}.`);
      } finally {
        join.textContent = original;
        join.disabled = !state.roblox?.installed;
      }
    });

    row.append(region, players, ping, fps, uptime, version, id, join);
    list.append(row);
  }
}

function renderServerIntelligence(result) {
  state.servers.result = result;
  const pill = q('#serverProviderPill');
  pill?.classList.remove('online', 'degraded');
  if (!result?.ok) {
    if (pill) { pill.textContent = 'ERROR'; pill.classList.add('degraded'); }
    q('#serverTotalCount').textContent = '—';
    q('#serverLoadedCount').textContent = '—';
    q('#serverRegionCount').textContent = '—';
    q('#serverProviderState').textContent = 'ERROR';
    q('#serverProviderDetail').textContent = result?.message || 'Lookup failed';
    q('#serverLookupSummary').textContent = result?.message || 'Server lookup failed.';
    renderServerRegionStrip(null);
    renderServerList();
    return;
  }

  const rovalraOk = result.providers?.rovalra?.ok !== false;
  if (pill) {
    pill.textContent = rovalraOk ? 'ROVALRA ONLINE' : 'ROVALRA DEGRADED';
    pill.classList.add(rovalraOk ? 'online' : 'degraded');
  }
  q('#serverTotalCount').textContent = Number(result.stats?.totalServers ?? 0).toLocaleString();
  q('#serverLoadedCount').textContent = Number(result.stats?.loadedServers ?? 0).toLocaleString();
  q('#serverRegionCount').textContent = Number(result.stats?.regionCount ?? 0).toLocaleString();
  q('#serverProviderState').textContent = rovalraOk ? 'ONLINE' : 'DEGRADED';
  q('#serverProviderDetail').textContent = rovalraOk ? 'Roblox + RoValra' : 'Roblox data only';
  const stamp = new Date(result.fetchedAt);
  q('#serverLookupSummary').textContent = `Place ${result.placeId} • ${result.stats?.loadedServers || 0} loaded${Number.isNaN(stamp.getTime()) ? '' : ` • ${stamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`}${result.cached ? ' • cached' : ''}`;
  q('#serverRefreshBtn').disabled = false;
  renderServerRegionStrip(result.stats);
  renderServerList();
}

async function lookupServerIntelligence(force = false) {
  if (state.servers.loading) return;
  const target = q('#serverPlaceInput')?.value.trim();
  if (!target) {
    showToast('Enter a Roblox Place ID or game URL first.', true);
    q('#serverPlaceInput')?.focus();
    return;
  }
  state.servers.loading = true;
  q('#serverLookupBtn').disabled = true;
  q('#serverRefreshBtn').disabled = true;
  q('#serverProviderPill').textContent = 'LOADING';
  q('#serverProviderPill').classList.remove('online', 'degraded');
  q('#serverBrowserCard')?.classList.add('server-loading');
  q('#serverLookupSummary').textContent = 'Loading Roblox public servers and RoValra enrichment…';
  localStorage.setItem('dragonstrap.serverPlace', target);
  try {
    const result = await window.dragonStrap.getServerIntelligence(target, { force });
    renderServerIntelligence(result);
    if (!result.ok) showToast(result.message || 'Server lookup failed.', true);
    else if (result.providers?.rovalra?.ok === false) showToast('Roblox servers loaded; RoValra enrichment is currently unavailable.', true);
    else showToast(`Loaded ${result.servers?.length || 0} public servers for Place ${result.placeId}.`);
  } catch (error) {
    console.error(error);
    renderServerIntelligence({ ok:false, message:'Server Intelligence request failed.' });
    showToast('Server Intelligence request failed.', true);
  } finally {
    state.servers.loading = false;
    q('#serverLookupBtn').disabled = false;
    q('#serverRefreshBtn').disabled = !state.servers.result?.ok;
    q('#serverBrowserCard')?.classList.remove('server-loading');
  }
}

async function getAppInfo() {
  try {
    const info = await window.dragonStrap.getAppInfo();
    state.appInfo = info;
    q('#topVersion').textContent = `v${info.version}`;
    q('#appVersion').textContent = info.version;
    if (q('#updateCurrentVersion')) q('#updateCurrentVersion').textContent = info.version;
    if (q('#aboutElectron')) q('#aboutElectron').textContent = info.electron ? `v${info.electron}` : '—';
    if (q('#aboutBuildType')) q('#aboutBuildType').textContent = info.packaged ? 'Packaged' : 'Source / Dev';
  } catch (error) {
    console.error(error);
  }
}

function formatCheckTime(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function renderUpdateState(result) {
  state.updates.data = result;
  const dot=q('#updateStatusDot');
  const latest=q('#updateLatestVersion');
  const feed=q('#updateFeedStatus');
  const message=q('#updateMessage');
  const open=q('#openReleaseBtn');
  if (latest) { latest.textContent=result?.latestVersion || '—'; latest.classList.toggle('newer',result?.updateAvailable === true); }
  if (q('#updateLastChecked')) q('#updateLastChecked').textContent=formatCheckTime(result?.checkedAt || result?.lastResult?.checkedAt);
  const releaseUrl=result?.releaseUrl || result?.lastResult?.releaseUrl || null;
  if (open) open.disabled=!releaseUrl;
  if (dot) { dot.classList.remove('online','offline'); dot.classList.add(result?.configured && result?.ok !== false ? 'online' : 'offline'); }
  if (feed) {
    feed.classList.remove('ready','warning','error');
    if (!result?.configured) { feed.textContent='Not configured'; feed.classList.add('warning'); }
    else if (result?.ok && result?.updateAvailable) { feed.textContent='Update available'; feed.classList.add('ready'); }
    else if (result?.ok && (result?.checkedAt || result?.lastResult?.checkedAt)) { feed.textContent='Up to date'; feed.classList.add('ready'); }
    else if (result?.configured) { feed.textContent='Ready'; feed.classList.add('ready'); }
    else { feed.textContent=result?.code || 'Unavailable'; feed.classList.add('error'); }
  }
  if (message) {
    if (!result?.configured) message.textContent='Release checking is ready, but release.config.json does not yet name the official DragonStrap GitHub repository.';
    else if (result?.ok && result?.updateAvailable) message.textContent=`DragonStrap ${result.latestVersion} is available${result.prerelease ? ' as a pre-release' : ''}. Open the verified GitHub release page to review/download it.`;
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
    renderUpdateState(result);
    if (announce) showToast(result.ok ? (result.updateAvailable ? `DragonStrap ${result.latestVersion} is available.` : 'DragonStrap is up to date.') : (result.message || 'Update check unavailable.'), !result.ok && result.code !== 'FEED_NOT_CONFIGURED');
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

  q('#installGauge').textContent = installed ? 'OK' : '—';
  q('#installDetail').textContent = installed ? status.version.replace('version-', '') : 'Not detected';
  q('#studioGauge').textContent = studioInstalled ? 'OK' : '—';
  q('#studioDetail').textContent = studioInstalled ? status.studioVersion.replace('version-', '') : 'Not detected';
  q('#channelGauge').textContent = status.channel || 'LIVE';
  q('#channelStatus').textContent = status.channel || 'LIVE';

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
  if (state.channels.loading) return;
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

function renderStudioCenter(result) {
  state.studio.center = result;
  const projects = result?.projects || [];
  if (q('#studioInstallFolder')) q('#studioInstallFolder').textContent = result?.locations?.installDir || 'Unavailable';
  if (q('#studioLogsFolder')) q('#studioLogsFolder').textContent = result?.locations?.logsDir || 'Unavailable';
  if (q('#studioOpenInstallBtn')) q('#studioOpenInstallBtn').disabled = !result?.locations?.installDirExists;
  if (q('#studioOpenLogsBtn')) q('#studioOpenLogsBtn').disabled = !result?.locations?.logsDirExists;

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
    const icon = document.createElement('span');
    icon.className = 'studio-recent-icon';
    icon.textContent = '◇';
    const main = document.createElement('div');
    main.className = 'studio-recent-main';
    const title = document.createElement('strong');
    title.textContent = project.name || 'Studio Project';
    const file = document.createElement('code');
    file.textContent = project.path || '—';
    main.append(title, file);
    const time = document.createElement('time');
    const date = new Date(project.lastOpenedAt);
    time.textContent = Number.isNaN(date.getTime()) ? '—' : date.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    const open = document.createElement('button');
    open.className = 'small-action';
    open.textContent = project.exists ? 'OPEN' : 'MISSING';
    open.disabled = !project.exists || state.studio.loading;
    open.addEventListener('click', () => launchRecentStudioProject(project.id));
    row.append(icon, main, time, open);
    container.append(row);
  }
}

async function refreshStudioCenter(announce = false) {
  try {
    const result = await window.dragonStrap.getStudioCenterState();
    renderStudioCenter(result);
    if (announce) showToast(result.installed ? 'Studio Center refreshed.' : 'Roblox Studio was not detected.', !result.installed);
    return result;
  } catch (error) {
    console.error(error);
    if (announce) showToast('Studio Center could not be refreshed.', true);
    return null;
  }
}

async function chooseAndLaunchStudioProject() {
  if (state.studio.loading) return;
  state.studio.loading = true;
  if (q('#studioOpenProjectBtn')) q('#studioOpenProjectBtn').disabled = true;
  try {
    const result = await window.dragonStrap.chooseAndLaunchStudioProject();
    if (result.canceled) return result;
    showToast(result.ok ? `Opening ${result.project?.name || 'Studio project'}.` : (result.message || 'Studio project could not be opened.'), !result.ok);
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
    showToast(result.ok ? `Opening ${result.project?.name || 'recent Studio project'}.` : (result.message || 'Recent Studio project could not be opened.'), !result.ok);
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
    showToast(result.ok ? 'Roblox Studio launch request sent.' : (result.message || 'Studio could not be launched.'), !result.ok);
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
    : `Cache cleanup completed with ${result.failures?.length || 1} locked item(s).`;
  showToast(message, !result.ok && !result.partial);
}

async function repairMaintenanceConfig() {
  const result = await window.dragonStrap.repairClientSettings();
  if (result.state) renderMaintenance(result.state);
  showToast(result.ok ? (result.repaired ? `Client settings repaired from ${result.source}.` : result.message) : (result.message || 'Client settings repair failed.'), !result.ok);
}

q('#launchKnob').addEventListener('click', () => launchPlayer({}));
q('#launchPlayerBtn').addEventListener('click', () => launchPlayer({}));
q('#launchStudioBtn').addEventListener('click', launchStudio);
q('#studioLaunchTop').addEventListener('click', launchStudio);
q('#studioOpenProjectBtn').addEventListener('click', chooseAndLaunchStudioProject);
q('#studioRefreshBtn').addEventListener('click', async () => { await refreshRobloxStatus(false); await refreshStudioCenter(true); });
q('#studioClearHistoryBtn').addEventListener('click', async () => { await window.dragonStrap.clearStudioProjectHistory(); await refreshStudioCenter(false); showToast('Studio project history cleared.'); });
q('#studioOpenInstallBtn').addEventListener('click', async () => { const result = await window.dragonStrap.openStudioInstallFolder(); showToast(result.ok ? 'Opened Studio install folder.' : (result.message || 'Studio install folder unavailable.'), !result.ok); });
q('#studioOpenLogsBtn').addEventListener('click', async () => { const result = await window.dragonStrap.openStudioLogsFolder(); showToast(result.ok ? 'Opened Roblox logs folder.' : (result.message || 'Roblox logs folder unavailable.'), !result.ok); });
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
  await refreshUpdateState(false,false);
});
q('#checkUpdatesBtn').addEventListener('click', () => refreshUpdateState(true,true));
q('#openReleaseBtn').addEventListener('click', async () => {
  const result=await window.dragonStrap.openUpdateRelease();
  if (!result.ok) showToast(result.message || 'Release page unavailable.',true);
});
q('#openReliabilityLogsBtn').addEventListener('click', async () => {
  const result=await window.dragonStrap.openReliabilityLogs();
  showToast(result.ok ? 'Opened DragonStrap reliability logs.' : (result.message || 'Reliability logs unavailable.'), !result.ok);
});


q('#serverLookupBtn').addEventListener('click', () => lookupServerIntelligence(false));
q('#serverRefreshBtn').addEventListener('click', () => lookupServerIntelligence(true));
q('#serverPlaceInput').addEventListener('keydown', event => { if (event.key === 'Enter') lookupServerIntelligence(false); });
q('#serverFilterInput').addEventListener('input', renderServerList);
q('#serverSortSelect').addEventListener('change', renderServerList);
q('#serverHideFull').addEventListener('change', renderServerList);

q('#fastFlagSearch').addEventListener('input', renderFastFlagList);
q('#fastFlagRefresh').addEventListener('click', () => refreshFastFlags(true));
q('#fastFlagEditorClear').addEventListener('click', clearFastFlagEditor);
q('#fastFlagQueueSet').addEventListener('click', queueFastFlagSet);
q('#fastFlagQueueRemove').addEventListener('click', queueFastFlagRemove);
q('#fastFlagApplyPending').addEventListener('click', applyFastFlagPending);
q('#fastFlagDiscardPending').addEventListener('click', discardFastFlagPending);
q('#fastFlagImport').addEventListener('click', importFastFlags);
q('#fastFlagExport').addEventListener('click', exportFastFlags);
q('#fastFlagOpenFile').addEventListener('click', async () => {
  const result = await window.dragonStrap.showFastFlagsFile();
  showToast(result.ok ? 'Opened ClientAppSettings.json location.' : (result.message || 'FastFlag file location unavailable.'), !result.ok);
});
q('#fastFlagRestoreBackup').addEventListener('click', restoreFastFlagsBackup);
q('#fastFlagPresetSave').addEventListener('click', saveFastFlagPreset);
q('#fastFlagPresetLoad').addEventListener('click', loadFastFlagPresetToPending);
q('#fastFlagPresetDelete').addEventListener('click', deleteFastFlagPreset);
q('#fastFlagPresetName').addEventListener('keydown', event => { if (event.key === 'Enter') saveFastFlagPreset(); });
q('#fastFlagValue').addEventListener('keydown', event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) queueFastFlagSet(); });

q('#channelRefreshBtn').addEventListener('click', () => refreshChannelVersion(true));
q('#channelCheckBtn').addEventListener('click', () => refreshChannelVersion(true, q('#channelNameInput').value.trim()));
q('#channelSelectBtn').addEventListener('click', () => selectChannel(q('#channelNameInput').value.trim()));
q('#channelUseLiveBtn').addEventListener('click', () => { q('#channelNameInput').value = 'production'; selectChannel('production'); });
q('#channelNameInput').addEventListener('keydown', event => { if (event.key === 'Enter') refreshChannelVersion(true, event.target.value.trim()); });
q('#channelOpenPlayerFolder').addEventListener('click', async () => { const result = await window.dragonStrap.openChannelInstallFolder('player'); showToast(result.ok ? 'Opened installed Roblox Player version.' : (result.message || 'Player version folder unavailable.'), !result.ok); });
q('#channelOpenStudioFolder').addEventListener('click', async () => { const result = await window.dragonStrap.openChannelInstallFolder('studio'); showToast(result.ok ? 'Opened installed Roblox Studio version.' : (result.message || 'Studio version folder unavailable.'), !result.ok); });

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
});

const restoredView = localStorage.getItem('dragonstrap.activeView');
if (restoredView && q(`.nav-item[data-tab="${restoredView}"]`)) switchView(restoredView);
else switchView('home');

(async function initialize() {
  await Promise.all([getAppInfo(), loadSettings(), loadLaunchHistory(), loadFastFlagPresets()]);
  await refreshRobloxStatus(false);
  await Promise.all([refreshPerformanceState(false), refreshFastFlags(false), refreshStudioCenter(false), refreshChannelVersion(false), refreshUpdateState(false,false), refreshReliabilityState()]);
  if (state.settings?.checkForUpdates !== false) {
    setTimeout(() => refreshUpdateState(true,false), 2200);
  }
  setInterval(() => refreshReliabilityState(), 60_000);
})();
