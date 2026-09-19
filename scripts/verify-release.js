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
for (const file of ['assets/DragonStrap.ico','assets/DragonStrap.png','release.config.json','THIRD_PARTY_NOTICES.md','renderer/index.html','src/services/update-service.js','src/services/reliability-service.js']) {
  if (!fs.existsSync(path.join(root,file))) failures.push(`missing ${file}`);
}
const html=fs.readFileSync(path.join(root,'renderer/index.html'),'utf8');
if (!html.includes(version)) failures.push('renderer version text is not synchronized');
const config=JSON.parse(fs.readFileSync(path.join(root,'release.config.json'),'utf8'));
if (config.repository && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repository)) failures.push('release.config.json repository must be owner/repo or empty');
if (failures.length) { console.error('Release verification FAILED:\n- '+failures.join('\n- ')); process.exit(1); }
console.log(`DragonStrap v${version} release verification passed.`);
