'use strict';
const os=require('node:os');
function cpuTotals(cpus) {
  if(!Array.isArray(cpus)||!cpus.length)return null;
  let idle=0,total=0;
  for(const cpu of cpus){
    const times=cpu.times;
    if(!times||!['user','nice','sys','idle','irq'].every(k=>Number.isFinite(times[k])&&times[k]>=0))return null;
    idle+=times.idle;total+=['user','nice','sys','idle','irq'].reduce((sum,key)=>sum+times[key],0);
  }
  return {idle,total,count:cpus.length};
}
class SystemMonitor {
  constructor({osImpl=os,now=()=>Date.now()}={}){this.os=osImpl;this.now=now;this.previous=cpuTotals(this.os.cpus());this.cached=null;}
  sample(){
    const now=this.now();
    if(this.cached&&now>=this.cached.sampledAt&&now-this.cached.sampledAt<1000)return this.cached;
    const current=cpuTotals(this.os.cpus()),previous=this.previous;this.previous=current;
    const total=current&&previous?current.total-previous.total:0,idle=current&&previous?current.idle-previous.idle:0;
    const cpuPercent=current&&previous&&current.count===previous.count&&total>0&&idle>=0&&idle<=total?Math.round((1-idle/total)*100):null;
    const totalMemoryBytes=this.os.totalmem(),freeMemoryBytes=this.os.freemem();
    const memoryPercent=Number.isFinite(totalMemoryBytes)&&totalMemoryBytes>0&&Number.isFinite(freeMemoryBytes)&&freeMemoryBytes>=0&&freeMemoryBytes<=totalMemoryBytes?Math.round((totalMemoryBytes-freeMemoryBytes)/totalMemoryBytes*100):null;
    return this.cached={sampledAt:now,cpuPercent,memoryPercent,totalMemoryBytes,freeMemoryBytes};
  }
}
module.exports={SystemMonitor,cpuTotals};
