'use strict';
// Run with `npm run ui:verify` on Windows. This uses the packaged Electron
// renderer, local styles and assets without invoking Roblox or app services.
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');
const root = path.resolve(__dirname, '..');
const renderer = path.join(root, 'renderer');
const fixture = path.join(renderer, '.layout-verification.html');
const sizes = [
  { width: 1600, height: 980, zoom: 1 },
  { width: 1600, height: 980, zoom: 1.25 },
  { width: 1600, height: 980, zoom: 1.5 },
  { width: 1366, height: 800, zoom: 1 },
  { width: 1180, height: 760, zoom: 1 }
];
const source = fs.readFileSync(path.join(renderer, 'index.html'), 'utf8');
if (!source.includes('<script src="app.js"></script>')) throw new Error('Renderer entry changed; update visual fixture.');
fs.writeFileSync(fixture, source.replace('<script src="app.js"></script>', ''), 'utf8');
let failures = 0;
function inspect() {
  const $ = selector => document.querySelector(selector);
  const rect = selector => $(selector).getBoundingClientRect();
  const inside = (inner, outer) => inner.top >= outer.top - 2 && inner.bottom <= outer.bottom + 2 && inner.left >= outer.left - 2 && inner.right <= outer.right + 2;
  const issues = [];
  const viewport = { top: 0, left: 0, right: innerWidth, bottom: innerHeight };
  if (document.documentElement.scrollWidth > innerWidth + 2) issues.push('horizontal page overflow');
  for (const selector of ['.topbar', '.sidebar', '.content-area', '.dashboard-status-bar']) {
    const box = rect(selector);
    if (box.right > viewport.right + 2 || box.left < -2) issues.push(`${selector} extends past viewport`);
  }
  const temp = rect('.temp-card');
  const channel = rect('.temp-card .temp-row:last-child');
  if (!inside(channel, temp)) issues.push('Channel row clipped by Installation Status card');
  const first = rect('.master-card');
  const next = rect('.audio-card');
  if (next.top < first.bottom - 2) issues.push('dashboard rows overlap');
  const popup = $('#productMenuPopup');
  popup.hidden = false;
  $('#productMenu').classList.add('open');
  const menu = popup.getBoundingClientRect();
  if (menu.left < -2 || menu.right > innerWidth + 2) issues.push('product menu beyond viewport');
  for (const item of popup.querySelectorAll('.product-menu-item')) {
    const r = item.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (hit !== item && !item.contains(hit)) issues.push(`${item.id} covered by page content`);
  }
  return { issues, viewport: `${innerWidth}×${innerHeight}` };
}

function inspectSecondaryViews() {
  const issues = [];
  const views = [...document.querySelectorAll('.view')];
  const original = views.find(view => view.classList.contains('active'));
  const pendingBanner = document.querySelector('#fastFlagPendingBanner');
  const pendingNavCount = document.querySelector('#fastFlagNavCount');
  const originalBannerHidden = pendingBanner?.hidden;
  const originalNavHidden = pendingNavCount?.hidden;
  for (const name of ['launch', 'instances', 'fastflags', 'maintenance', 'settings']) {
    views.forEach(view => view.classList.toggle('active', view.dataset.view === name));
    if (name === 'fastflags') { pendingBanner.hidden = false; pendingNavCount.hidden = false; }
    // Force layout before checking this page.
    document.body.getBoundingClientRect();
    if (document.documentElement.scrollWidth > innerWidth + 2) issues.push(`${name}: horizontal overflow`);
    if (name === 'fastflags') {
      const banner = pendingBanner.getBoundingClientRect();
      if (banner.left < -2 || banner.right > innerWidth + 2) issues.push('fastflags: pending bar beyond viewport');
    }
    for (const button of document.querySelectorAll(`.view[data-view="${name}"] button`)) {
      if (button.offsetParent === null || button.clientWidth < 1) continue;
      const text = document.createRange();
      text.selectNodeContents(button);
      const content = text.getBoundingClientRect();
      const box = button.getBoundingClientRect();
      if (content.height && (content.top < box.top - 2 || content.bottom > box.bottom + 2)) {
        issues.push(`${name}: clipped button label (${button.id || button.textContent.trim().slice(0, 28)})`);
      }
    }
  }
  pendingBanner.hidden = originalBannerHidden;
  pendingNavCount.hidden = originalNavHidden;
  views.forEach(view => view.classList.toggle('active', view === original));
  return issues;
}

(async () => {
  try {
    await app.whenReady();
    const win = new BrowserWindow({ show: false, width: 1600, height: 980, webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false } });
    await win.loadFile(fixture);
    for (const size of sizes) {
      win.setContentSize(size.width, size.height);
      win.webContents.setZoomFactor(size.zoom);
      const result = await win.webContents.executeJavaScript(`(${inspect.toString()})()`);
      const secondaryIssues = await win.webContents.executeJavaScript(`(${inspectSecondaryViews.toString()})()`);
      result.issues.push(...secondaryIssues);
      const label = `${size.width}×${size.height} @ ${Math.round(size.zoom * 100)}% (${result.viewport} CSS)`;
      if (result.issues.length) { failures += result.issues.length; console.error(`${label}: ${result.issues.join('; ')}`); }
      else console.log(`${label}: layout passed`);
    }
    win.destroy();
  } catch (error) { failures++; console.error(error); }
  finally {
    fs.rmSync(fixture, { force: true });
    app.exit(failures ? 1 : 0);
  }
})();
