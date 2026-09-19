'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const version=fs.readFileSync(path.join(root,'VERSION'),'utf8').trim();
const outDir=path.join(root,'dist-meta');
const excluded=new Set(['node_modules','dist','dist-meta','.git']);
function walk(dir,base='') {
  const out=[];
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if (excluded.has(entry.name)) continue;
    const rel=path.join(base,entry.name);
    const full=path.join(dir,entry.name);
    if (entry.isDirectory()) out.push(...walk(full,rel));
    else if (entry.isFile()) out.push(rel.replaceAll('\\','/'));
  }
  return out;
}
function sha(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
fs.mkdirSync(outDir,{recursive:true});
const files=walk(root).sort().map(file=>({file,sha256:sha(path.join(root,file)),size:fs.statSync(path.join(root,file)).size}));
const manifest={product:'DragonStrap',version,generatedAt:new Date().toISOString(),files};
const manifestPath=path.join(outDir,`DragonStrap-v${version}-source-manifest.json`);
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');
console.log(`Wrote ${manifestPath} (${files.length} files).`);
