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
for (const file of [
  'assets/DragonStrap.ico','assets/DragonStrap.png','release.config.json','THIRD_PARTY_NOTICES.md',
  'renderer/index.html','src/services/update-service.js','src/services/reliability-service.js',
  'docs/RELEASE-POLICY.md','docs/RELEASE-v1.0.0.md','.github/workflows/ci.yml'
]) {
  if (!fs.existsSync(path.join(root,file))) failures.push(`missing ${file}`);
}
const html=fs.readFileSync(path.join(root,'renderer/index.html'),'utf8');
if (!html.includes(version)) failures.push('renderer version text is not synchronized');
if (/Foundation Ready|Bootstrapper foundation|Release-ready foundation/.test(html)) failures.push('prototype foundation wording remains in renderer');
const config=JSON.parse(fs.readFileSync(path.join(root,'release.config.json'),'utf8'));
if (config.repository !== 'bubblegump30/DragonStrap') failures.push('official update repository must be bubblegump30/DragonStrap');
if (config.releaseChannel !== 'stable') failures.push('stable release must default to the stable update channel');
if (pkg.repository?.url !== 'https://github.com/bubblegump30/DragonStrap.git') failures.push('package.json repository metadata is missing or unexpected');
if (failures.length) { console.error('Release verification FAILED:\n- '+failures.join('\n- ')); process.exit(1); }
console.log(`DragonStrap v${version} stable release verification passed.`);
