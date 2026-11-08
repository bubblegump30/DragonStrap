'use strict';
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
function parseJoinEvidence(text,placeId,userId){
 let home=false,joining=false,joined=false;
 for(const line of text.split(/\r?\n/)){
  if(line.includes('[FLog::DataModelStarterModule]')){if(line.includes('Launching Lua App'))home=true;if(line.includes(`Launching experience at ${placeId}`))joining=true;}
  if(line.includes('[FLog::GameJoinLoadTime]')){const place=line.match(/\bplaceid:(\d+)/i)?.[1],user=line.match(/\buserid:(\d+)/i)?.[1];if(place===String(placeId)&&user===String(userId))joined=true;}
 }
 return {state:joined?'joined':joining?'joining':home?'home':'pending'};
}
class RobloxJoinObserver{
 constructor({root=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData/Local'),'Roblox','logs')}={}){this.root=root;}
 files(){try{return fs.readdirSync(this.root).filter(name=>/_Player_[a-f0-9]+_last\.log$/i.test(name)).map(name=>path.join(this.root,name));}catch{return [];}}
 snapshot(){const sizes={};for(const file of this.files())try{sizes[file]=fs.statSync(file).size;}catch{}return sizes;}
 inspect(snapshot,placeId,userId){let state='pending';for(const file of this.files()){
  let fd;try{const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink())continue;const start=snapshot[file]||0;if(stat.size<=start)continue;fd=fs.openSync(file,'r');const b=Buffer.alloc(Math.min(stat.size-start,512*1024));fs.readSync(fd,b,0,b.length,start);const evidence=parseJoinEvidence(b.toString('utf8'),placeId,userId);if(evidence.state==='joined')return evidence;if(evidence.state==='joining')state='joining';else if(evidence.state==='home'&&state==='pending')state='home';}catch{}finally{if(fd!==undefined)fs.closeSync(fd);}
 }return {state};}
}
module.exports={RobloxJoinObserver,parseJoinEvidence};
