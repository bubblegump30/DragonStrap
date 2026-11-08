'use strict';
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
class ManagerCleanupService {
 constructor({root=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData/Local'),'Roblox'),now=()=>Date.now()}={}){this.root=path.resolve(root);this.now=now;}
 safe(file){const relative=path.relative(this.root,path.resolve(file));if(!relative||relative.startsWith('..')||path.isAbsolute(relative))return false;let current=this.root;if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())return false;for(const part of relative.split(path.sep)){current=path.join(current,part);if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())return false;}return true;}
 files(dir,extensions){if(!this.safe(dir)||!fs.existsSync(dir))return [];return fs.readdirSync(dir,{withFileTypes:true}).filter(e=>e.isFile()&&extensions.includes(path.extname(e.name).toLowerCase())).map(e=>{const file=path.join(dir,e.name),stat=fs.lstatSync(file);return {file,size:stat.size,modified:stat.mtimeMs};}).filter(e=>this.safe(e.file));}
 plan(options,status,processes=[]){const items=[];const logs=this.files(path.join(this.root,'logs'),['.log','.txt']);
  if(options.autoCleanLogs){let total=logs.reduce((n,f)=>n+f.size,0);for(const item of logs.sort((a,b)=>a.modified-b.modified)){if(this.now()-item.modified<3600000)continue;if(this.now()-item.modified>86400000||total>50*1024*1024){items.push({...item,kind:'log'});total-=item.size;}}}
  if(options.cleanDumps)for(const dir of [path.join(this.root,'logs'),path.join(this.root,'crashes'),path.join(this.root,'CrashDumps')])for(const item of this.files(dir,['.dmp']))if(this.now()-item.modified>86400000)items.push({...item,kind:'dump'});
  if(options.cleanOldVersions){const versions=path.join(this.root,'Versions');if(this.safe(versions)&&fs.existsSync(versions)){
   const dirs=fs.readdirSync(versions,{withFileTypes:true}).filter(e=>e.isDirectory()&&/^version-[a-f0-9]+$/i.test(e.name)).map(e=>path.join(versions,e.name)).filter(f=>this.safe(f)).sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs);
   const keep=new Set(dirs.slice(0,2));for(const file of [status?.playerPath,status?.studioPath,...processes.map(p=>p.path)])if(file)keep.add(path.dirname(path.resolve(file)));
   for(const dir of dirs)if(!keep.has(dir)&&!fs.existsSync(path.join(dir,'ClientSettings'))&&this.now()-fs.statSync(dir).mtimeMs>7*86400000)items.push({file:dir,size:null,kind:'version'});
  }}return {items,bytes:items.reduce((n,i)=>n+(i.size||0),0)};
 }
 apply(plan){const results=[];for(const item of plan.items){if(!this.safe(item.file)){results.push({kind:item.kind,ok:false,message:'Unsafe cleanup path refused.'});continue;}try{fs.rmSync(item.file,{recursive:item.kind==='version',force:true});results.push({kind:item.kind,ok:true});}catch{results.push({kind:item.kind,ok:false,message:'File is busy or could not be removed.'});}}return {ok:results.every(r=>r.ok),results,removed:results.filter(r=>r.ok).length};}
}
module.exports={ManagerCleanupService};
