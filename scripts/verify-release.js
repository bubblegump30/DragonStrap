'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const version=fs.readFileSync(path.join(root,'VERSION'),'utf8').trim();
const failures=[];
if (pkg.version !== version) failures.push(`package.json version ${pkg.version} does not match VERSION ${version}`);
if (pkg.productName !== 'DragonStrap') failures.push('productName must be DragonStrap');
if (pkg.build?.appId !== 'com.dragonstrap.app') failures.push('Windows appId is missing or unexpected');
if (pkg.build?.portable?.artifactName !== 'DragonStrap-Portable-${version}-${arch}.${ext}') failures.push('portable artifactName does not match the Update Center contract');
if (pkg.build?.nsis?.artifactName !== 'DragonStrap-Setup-${version}-${arch}.${ext}') failures.push('NSIS artifactName does not match the Update Center contract');
for (const file of [
  'assets/DragonStrap.ico','assets/DragonStrap.png','release.config.json','THIRD_PARTY_NOTICES.md',
  'renderer/index.html','renderer/dragon-2.css','renderer/update-center.css','renderer/fastflags.css','renderer/performance-center.css','renderer/profiles.css','src/core/app-kernel.js','src/core/service-registry.js','src/core/operation-coordinator.js','src/core/bootstrap-pipeline.js','src/core/plugin-host.js','src/core/roblox-status-cache.js','src/core/api-contract.js','src/services/update-service.js','src/services/self-update-service.js','src/services/reliability-service.js','src/services/recovery-service.js','src/services/roblox-update-engine.js','src/services/fastflag-service.js','src/services/fastflag-metadata.js','src/services/fastflag-snapshot-store.js','src/services/performance-center-service.js','src/services/performance-profile-store.js','src/services/configuration-profile-store.js','src/services/configuration-profile-service.js','src/services/server-intelligence-service.js','src/services/server-intelligence-store.js','src/services/studio-settings-store.js','src/services/studio-backup-service.js','src/services/studio-fastflag-service.js',
  'docs/RELEASE-POLICY.md','docs/CORE-API-v2.md',`docs/RELEASE-v${version}.md`,'docs/ROBLOX-INSTALL-UPDATE-v1.1.0.md','docs/FASTFLAG-MANAGER-v1.4.0.md','docs/PERFORMANCE-CENTER-v1.5.0.md','docs/SERVER-INTELLIGENCE-v1.6.0.md','docs/STUDIO-CENTER-v1.7.0.md','docs/PROFILES-CONFIGURATION-v1.8.0.md','docs/RELIABILITY-RECOVERY-v1.9.0.md','.github/workflows/ci.yml','.github/FUNDING.yml'
]) {
  if (!fs.existsSync(path.join(root,file))) failures.push(`missing ${file}`);
}
const html=fs.readFileSync(path.join(root,'renderer/index.html'),'utf8');
if (!html.includes(version)) failures.push('renderer version text is not synchronized');
if (!html.includes(`id=\"appVersion\">${version}<`)) failures.push('home version fallback is not synchronized');
if (!html.includes(`id=\"updateCurrentVersion\">${version}<`)) failures.push('Update Center version fallback is not synchronized');
const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');
if (!readme.includes(`## Version\n\n\`${version}\``)) failures.push('README version is not synchronized');
if (/Foundation Ready|Bootstrapper foundation|Release-ready foundation/.test(html)) failures.push('prototype foundation wording remains in renderer');
if (!html.includes('UPDATE CENTER 2.0')) failures.push('Update Center 2.0 UI is missing');
if (!html.includes('FASTFLAG MANAGER 3.0')) failures.push('FastFlag Manager 3.0 UI is missing');
if (!html.includes('PERFORMANCE CENTER 2.0')) failures.push('Performance Center 2.0 UI is missing');
if (!html.includes('SERVER INTELLIGENCE 2.0')) failures.push('Server Intelligence 2.0 UI is missing');
if (!html.includes('STUDIO CENTER 2.0')) failures.push('Studio Center 2.0 UI is missing');
if (!html.includes('PROFILES & CONFIGURATION CENTER')) failures.push('Profiles & Configuration Center UI is missing');
if (!html.includes('RELIABILITY & RECOVERY 2.0')) failures.push('Reliability & Recovery 2.0 UI is missing');
if (!html.includes('DRAGONSTRAP 2.0 CORE')) failures.push('DragonStrap 2.0 Core UI is missing');
if (!html.includes('CORE API 2.0')) failures.push('Core API 2.0 UI marker is missing');
const config=JSON.parse(fs.readFileSync(path.join(root,'release.config.json'),'utf8'));
if (config.repository !== 'bubblegump30/DragonStrap') failures.push('official update repository must be bubblegump30/DragonStrap');
if (config.releaseChannel !== 'stable') failures.push('stable release must default to the stable update channel');
const policy=fs.readFileSync(path.join(root,'docs/RELEASE-POLICY.md'),'utf8');
if (!policy.includes('SHA256SUMS.txt')) failures.push('release policy must require SHA256SUMS.txt');
if (pkg.repository?.url !== 'https://github.com/bubblegump30/DragonStrap.git') failures.push('package.json repository metadata is missing or unexpected');
if (failures.length) { console.error('Release verification FAILED:\n- '+failures.join('\n- ')); process.exit(1); }
console.log(`DragonStrap v${version} stable release verification passed.`);
