'use strict';

const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

class ReliabilityService {
  constructor(userDataDir,{version='0.0.0',maxLogBytes=2_000_000}={}) {
    this.userDataDir=userDataDir;
    this.version=version;
    this.maxLogBytes=maxLogBytes;
    this.logsDir=path.join(userDataDir,'logs');
    this.logPath=path.join(this.logsDir,'DragonStrap.log');
    this.statePath=path.join(userDataDir,'session-state.json');
    this.sessionId=crypto.randomUUID();
    this.startedAt=new Date().toISOString();
    this.previousSession=null;
    this.initialized=false;
  }

  initialize() {
    fs.mkdirSync(this.logsDir,{recursive:true});
    try {
      if (fs.existsSync(this.statePath)) this.previousSession=JSON.parse(fs.readFileSync(this.statePath,'utf8'));
    } catch { this.previousSession=null; }
    this.#writeSession(false);
    this.initialized=true;
    this.log('info','session-start',{version:this.version,pid:process.pid,previousSessionClean:this.previousSession?.cleanExit ?? null});
    return this.getState();
  }

  #writeSession(cleanExit,extra={}) {
    fs.mkdirSync(path.dirname(this.statePath),{recursive:true});
    const data={sessionId:this.sessionId,version:this.version,pid:process.pid,startedAt:this.startedAt,cleanExit:Boolean(cleanExit),...extra};
    const temp=`${this.statePath}.tmp`;
    fs.writeFileSync(temp,JSON.stringify(data,null,2)+'\n','utf8');
    fs.renameSync(temp,this.statePath);
  }

  #rotateIfNeeded() {
    try {
      if (!fs.existsSync(this.logPath) || fs.statSync(this.logPath).size < this.maxLogBytes) return;
      const rotated=path.join(this.logsDir,'DragonStrap.previous.log');
      if (fs.existsSync(rotated)) fs.rmSync(rotated,{force:true});
      fs.renameSync(this.logPath,rotated);
    } catch {}
  }

  log(level,event,data={}) {
    try {
      fs.mkdirSync(this.logsDir,{recursive:true});
      this.#rotateIfNeeded();
      const safeData={};
      for (const [key,value] of Object.entries(data || {})) {
        if (/cookie|token|authorization|secret|password/i.test(key)) continue;
        safeData[key]=typeof value === 'string' ? value.slice(0,4000) : value;
      }
      fs.appendFileSync(this.logPath,JSON.stringify({ts:new Date().toISOString(),level,event,sessionId:this.sessionId,...safeData})+'\n','utf8');
    } catch {}
  }

  recordError(event,error,extra={}) {
    this.log('error',event,{message:String(error?.message || error || 'Unknown error'),stack:String(error?.stack || '').slice(0,8000),...extra});
  }

  markCleanExit() {
    if (!this.initialized) return;
    this.log('info','session-end',{cleanExit:true});
    try { this.#writeSession(true,{endedAt:new Date().toISOString()}); } catch {}
  }

  getState() {
    const previous=this.previousSession;
    return {
      ok:true,
      sessionId:this.sessionId,
      startedAt:this.startedAt,
      uptimeSeconds:Math.max(0,Math.round((Date.now()-Date.parse(this.startedAt))/1000)),
      previousSessionClean:previous ? previous.cleanExit === true : null,
      previousSessionVersion:previous?.version || null,
      logsDir:this.logsDir,
      logPath:this.logPath,
      singleInstance:true
    };
  }
}

module.exports={ ReliabilityService };
