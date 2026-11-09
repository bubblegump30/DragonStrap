'use strict';
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {RobloxJoinObserver}=require('./roblox-join-observer');
const {buildAuthenticatedProtocol,trustedPlayerPath}=require('./authenticated-launch');
const {AccountManagerStore}=require('./account-manager-store');
const {LaunchTargetService}=require('./launch-target-service');
const {WindowsSessionControl}=require('./windows-session-control');
const cleanCookie=value=>{
 const v=String(value||'').trim().replace(/^\.ROBLOSECURITY=/i,'');
 if(v.length<20||v.length>16384||/[\r\n;\x00-\x20]/.test(v))throw new Error('The session cookie is invalid.');return v;
};
function normalizeGame(raw){
 const input=String(raw||'').trim();if(input.length>4096)throw new Error('Game link is too long.');
 const result=new LaunchTargetService().normalize(input);
 if(!result.ok||!result.placeId)throw new Error(result.message||'Use a Place ID or a Roblox games URL. Share links must be opened on Roblox first to obtain the game URL.');
 const params=new URLSearchParams(result.uri.split('?')[1]);
 try{const url=new URL(input);for(const key of ['privateServerLinkCode','accessCode','linkCode']){const v=url.searchParams.get(key);if(v){if(!/^[A-Za-z0-9_-]{1,200}$/.test(v))throw new Error('Invalid private server code.');params.set(key==='privateServerLinkCode'?'linkCode':key,v);}}}catch(e){if(e.message==='Invalid private server code.')throw e;}
 return {placeId:result.placeId,uri:`roblox://experiences/start?${params}`};
}
class RobloxAccountProvider {
 constructor({fetchImpl=globalThis.fetch}={}){this.fetch=fetchImpl;}
 async request(url,options={}){
  const response=await this.fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(15000)});
  return response;
 }
 async identity(cookie){
  const r=await this.request('https://users.roblox.com/v1/users/authenticated',{headers:{Cookie:`.ROBLOSECURITY=${cleanCookie(cookie)}`}});
  if(!r.ok)throw new Error(r.status===401?'This Roblox session has expired. Sign in again.':`Roblox account verification returned HTTP ${r.status}.`);
  const user=await r.json();if(!Number.isSafeInteger(user.id)||user.id<=0||typeof user.name!=='string')throw new Error('Roblox returned invalid account information.');
  return {userId:String(user.id),username:user.name,displayName:user.displayName};
 }
 async thumbnail(url){try{const r=await this.request(url);if(!r.ok)return '';const image=(await r.json()).data?.[0]?.imageUrl;const u=new URL(image);return u.protocol==='https:'&&u.hostname.endsWith('.rbxcdn.com')?u.href:'';}catch{return '';}}
 async profile(cookie){const user=await this.identity(cookie);const [avatarUrl,balance]=await Promise.all([this.thumbnail(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.userId}&size=150x150&format=Png&isCircular=false`),(async()=>{try{const r=await this.request(`https://economy.roblox.com/v1/users/${user.userId}/currency`,{headers:{Cookie:`.ROBLOSECURITY=${cleanCookie(cookie)}`}});if(!r.ok)return null;const value=(await r.json()).robux;return Number.isSafeInteger(value)&&value>=0?value:null;}catch{return null;}})()]);return {...user,avatarUrl,robux:balance,refreshedAt:Date.now()};}
 async ticket(cookie){
  const headers={Cookie:`.ROBLOSECURITY=${cleanCookie(cookie)}`,Origin:'https://www.roblox.com',Referer:'https://www.roblox.com/','Content-Type':'application/json',RBXAuthenticationNegotiation:'1'};
  let r=await this.request('https://auth.roblox.com/v1/authentication-ticket/',{method:'POST',headers,body:'{}'});
  const csrf=r.headers.get('x-csrf-token');
  if(r.status===403&&csrf){headers['x-csrf-token']=csrf;r=await this.request('https://auth.roblox.com/v1/authentication-ticket/',{method:'POST',headers,body:'{}'});}
  const ticket=r.headers.get('rbx-authentication-ticket');
  if(!r.ok||!ticket||ticket.length>10000||/[\r\n]/.test(ticket))throw new Error(`Roblox could not authorize this launch (HTTP ${r.status}). Sign in again if the session expired.`);
  return ticket;
 }
 async gameName(placeId){
  try{const r=await this.request(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);if(!r.ok)return null;const u=await r.json();if(!Number.isSafeInteger(u.universeId))return null;
   const g=await this.request(`https://games.roblox.com/v1/games?universeIds=${u.universeId}`);if(!g.ok)return null;return (await g.json()).data?.[0]?.name||null;
  }catch{return null;}
 }
}
class AccountSessionService {
 constructor({userData,safeStorage,status,settingsStore,launchService,performanceService,recoveryService,configurationProfileStore,operations,provider=new RobloxAccountProvider(),native=new WindowsSessionControl(),launchProtocol=null,joinObserver=new RobloxJoinObserver(),now=()=>Date.now(),store=null}={}){
  this.store=store||new AccountManagerStore(userData,{now});this.userData=userData;this.safeStorage=safeStorage;this.status=status;this.settingsStore=settingsStore;this.launchService=launchService;this.performance=performanceService;this.recovery=recoveryService;this.configurationProfiles=configurationProfileStore;this.operations=operations;this.provider=provider;this.native=native;this.launchProtocol=launchProtocol;this.joinObserver=joinObserver;this.joinSnapshots=new Map();this.now=now;
  this.sessions=new Map();this.bulkBusy=false;this.bulkEpoch=0;this.launchEpoch=0;this.busy=new Set();this.tickBusy=false;this.lastProbe=null;this.lastError='';this.timer=null;this.stopping=false;this.vaultFile=path.join(userData,'account-vault.json');this.vault={};this.shutdownAt=0;
  if(fs.existsSync(this.vaultFile)){const data=JSON.parse(fs.readFileSync(this.vaultFile,'utf8'));if(data?.schema!==1||!data.secrets||typeof data.secrets!=='object'||Array.isArray(data.secrets))throw new Error('Account vault is invalid.');this.vault=data.secrets;}
  // Jobs which were in progress when the app exited are not replayed automatically.
  for(const job of this.store.state().schedules)if(job.status==='running')this.store.updateSchedule(job.id,'interrupted','DragonStrap closed during this job.');
 }
 async encryptedAvailable(){return Boolean(await this.safeStorage?.isAsyncEncryptionAvailable());}
 async cookie(id){if(!await this.encryptedAvailable())throw new Error('Windows credential encryption is unavailable.');const encoded=this.vault[id];if(!encoded)throw new Error('Sign in to this account first.');const decrypted=await this.safeStorage.decryptStringAsync(Buffer.from(encoded,'base64'));const secret=cleanCookie(decrypted.result);if(decrypted.shouldReEncrypt){const encrypted=(await this.safeStorage.encryptStringAsync(secret)).toString('base64');if(this.vault[id]===encoded)this.saveVault({...this.vault,[id]:encrypted});}return secret;}

 saveVault(next){fs.mkdirSync(this.userData,{recursive:true});fs.writeFileSync(this.vaultFile+'.tmp',JSON.stringify({schema:1,secrets:next}),'utf8');fs.renameSync(this.vaultFile+'.tmp',this.vaultFile);this.vault=next;}
 async connect(cookie){
  if(!await this.encryptedAvailable())throw new Error('Windows credential encryption is unavailable; the account will not be saved.');
  const secret=cleanCookie(cookie),identity=await (this.provider.profile?this.provider.profile(secret):this.provider.identity(secret));const encrypted=(await this.safeStorage.encryptStringAsync(secret)).toString('base64');const account=this.store.saveAccount(identity);
  this.saveVault({...this.vault,[account.id]:encrypted});return account;
 }
 async refreshAccount(id){const secret=await this.cookie(id);const user=await (this.provider.profile?this.provider.profile(secret):this.provider.identity(secret));if(this.store.account(id)?.userId!==user.userId)throw new Error('The saved credential belongs to a different account.');return this.store.saveAccount(user);}
 removeAccount(id){if(this.busy.has(id))throw new Error('Wait for this account launch to finish or cancel it before removing the account.');if([...this.sessions.values()].some(s=>s.accountId===id&&s.status==='running'))throw new Error('Stop this account’s managed session before removing it.');const next={...this.vault};delete next[id];this.saveVault(next);this.store.removeAccount(id);}
 async saveGame(accountId,input){const game=normalizeGame(input.target);const name=String(input.name||'').trim()||await this.provider.gameName(game.placeId)||`Place ${game.placeId}`;const imageUrl=this.provider.thumbnail?await this.provider.thumbnail(`https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${game.placeId}&size=150x150&format=Png&isCircular=false`):'';return this.store.saveGame(accountId,{...game,id:input.id,name,favorite:input.favorite,imageUrl});}
 state(){
  const data=this.store.state();const sessions=[...this.sessions.values()].map(({path,...s})=>s);
  const history=data.history;const seconds=(data.totals?.seconds||0)+sessions.filter(s=>s.status==='running').reduce((n,s)=>n+Math.max(0,Math.floor((this.now()-s.startedAt)/1000)),0);
  const launches=(data.totals?.launches||0)+sessions.filter(s=>s.status==='running').length;
  return {...data,accounts:data.accounts.map(a=>({...a,connected:Boolean(this.vault[a.id])})),sessions,bulkBusy:this.bulkBusy,probe:this.lastProbe,capabilities:{encryptedStorage:Boolean(this.safeStorage),native:process.platform==='win32',multiInstance:'Roblox decides whether concurrent clients remain open; no client patching or singleton-handle removal is performed.',antiAfk:'Foreground managed window only, after 60 seconds of Windows inactivity. Games may ignore synthetic input.',fps:'Legacy ClientSettings target; current Roblox builds may ignore it.'},stats:{seconds,launches,level:1+Math.floor(seconds/36000),achievements:[{name:'First launch',earned:launches>=1},{name:'Ten sessions',earned:launches>=10},{name:'One hour',earned:seconds>=3600},{name:'Ten hours',earned:seconds>=36000}]},shutdownAt:this.shutdownAt,lastError:this.lastError};
 }
 cancelBulk(){this.bulkEpoch++;}
 async bulkAccounts(action,ids,expectedFavorites=null,expectedSessions=null){
  this.ensureOpen();if(!['refresh','launch-favorite','stop'].includes(action))throw new Error('Unsupported bulk account action.');
  const selected=this.store.accountIds(ids);if(this.bulkBusy)throw new Error('Another bulk account action is still running.');
  if(action==='launch-favorite'&&selected.length>1&&!this.store.getOptions().multiInstance)throw new Error('Enable concurrent launch attempts in Manager settings before launching multiple accounts.');
  if(action==='launch-favorite'&&(!expectedFavorites||typeof expectedFavorites!=='object'||Array.isArray(expectedFavorites)||selected.some(id=>!Object.prototype.hasOwnProperty.call(expectedFavorites,id)||!(expectedFavorites[id]===null||typeof expectedFavorites[id]==='string'))))throw new Error('Review favorite game targets before launching the batch.');
  if(action==='stop'&&(!expectedSessions||typeof expectedSessions!=='object'||Array.isArray(expectedSessions)||selected.some(id=>!Array.isArray(expectedSessions[id])||expectedSessions[id].some(value=>typeof value!=='string'))))throw new Error('Review managed sessions before stopping the batch.');
  this.bulkBusy=true;const batchEpoch=this.bulkEpoch,epoch=this.launchEpoch;const results=[];
  try{for(const accountId of selected){try{this.ensureOpen();if(batchEpoch!==this.bulkEpoch)throw new Error('Bulk action cancelled before this account started.');if(action==='launch-favorite'&&epoch!==this.launchEpoch)throw new Error('Batch launch cancelled by Stop all.');
    if(action==='refresh'){await this.refreshAccount(accountId);results.push({accountId,ok:true,message:'Roblox details refreshed.'});}
    else if(action==='launch-favorite'){const game=this.store.account(accountId)?.games.find(g=>g.favorite);if((game?.id??null)!==expectedFavorites[accountId])throw new Error('Favorite game changed after review. Review this account again.');if(!game)throw new Error('No favorite saved game. Edit this account and favorite a game first.');const result=await this.launch(accountId,game.id);if(!result.ok)throw new Error(result.message);results.push({accountId,ok:true,message:'Launch requested.',sessionId:result.sessionId});}
    else {const sessions=[...this.sessions.values()].filter(s=>s.accountId===accountId&&s.status==='running');if(sessions.some(session=>!expectedSessions[accountId].includes(session.id)))throw new Error('Managed session changed after review. Review this account again.');for(const session of sessions)await this.control(session.id,'stop');results.push({accountId,ok:true,message:sessions.length?'Managed session stopped.':'No running managed session.'});}
   }catch(e){results.push({accountId,ok:false,message:e.message});}}
   return results;
  }finally{this.bulkBusy=false;}
 }
 ensureOpen(){if(this.stopping)throw new Error('DragonStrap is closing; account launch cancelled.');}
 async launch(accountId,gameId,{restartCount=0}={}){
  if(this.stopping)throw new Error('DragonStrap is closing.');const account=this.store.account(accountId);if(!account)throw new Error('Account not found.');
  const game=account.games.find(g=>g.id===gameId);if(!game)throw new Error('Choose a saved game.');
  if(this.busy.has(accountId))throw new Error('This account is already launching.');
  if([...this.sessions.values()].some(s=>s.accountId===accountId&&s.status==='running'))throw new Error('This account already has a managed session.');
  if(!this.store.state().options.multiInstance&&[...this.sessions.values()].some(s=>s.status==='running'))throw new Error('Enable concurrent launch attempts in Manager settings before launching another account.');
  const launchEpoch=this.launchEpoch;const ensureCurrent=()=>{this.ensureOpen();if(launchEpoch!==this.launchEpoch)throw new Error('Account launch cancelled by Stop all.');};
  this.busy.add(accountId);
  try{return await this.operations.run('accounts.launch',{label:'Account launch'},async()=>{
   const status=await this.status();ensureCurrent();if(!status?.playerPath)throw new Error('Roblox Player was not detected.');
   const before=await this.native.run({action:'probe'});ensureCurrent();if(!before.ok)throw new Error(before.message);
   if(!this.store.state().options.multiInstance&&before.processes?.length)throw new Error('Roblox is already running. Close it or enable concurrent launch attempts.');
   const secret=await this.cookie(accountId);ensureCurrent();const identity=await this.provider.identity(secret);ensureCurrent();if(identity.userId!==account.userId)throw new Error('Saved account identity changed. Sign in again.');
   const ticket=await this.provider.ticket(secret);ensureCurrent();
   const launchUri=buildAuthenticatedProtocol({ticket,uri:game.uri,placeId:game.placeId,trackerId:crypto.randomInt(100000000,999999999),launchedAt:this.now()});
   const policy=account.policy;const globalSettings=this.settingsStore?.getAll()||{performanceAutoApply:true,renderMode:'default'};const externalHandler=before.protocolHandlerPath&&!trustedPlayerPath(status.playerPath,null,before.protocolHandlerPath);if(globalSettings.performanceAutoApply&&!externalHandler){if(this.recovery){const saved=this.recovery.createRestorePoint('Before account session launch',status);if(!saved.ok)throw new Error(saved.message||'A safety restore point could not be created.');}const perf=this.performance.apply(status,{fpsCap:policy.fpsCap,renderMode:globalSettings.renderMode||'default',msaaMode:policy.potato?'1':'default'});if(!perf.ok)throw new Error(perf.message);this.configurationProfiles?.setActive(null);}
   if(!this.launchProtocol)throw new Error('The registered Roblox protocol launcher is unavailable.');
   const logSnapshot=this.joinObserver.snapshot();
   ensureCurrent();await this.launchProtocol(launchUri);ensureCurrent();
   // A URI handoff can exit or spawn a different PID. Only attach when identity is unambiguous.
   let process=null;
   for(let attempt=0;attempt<12;attempt++){
    const probe=await this.native.run({action:'probe'});ensureCurrent();if(probe.ok){const candidates=(probe.processes||[]).filter(p=>trustedPlayerPath(p.path,status.playerPath,probe.protocolHandlerPath||before.protocolHandlerPath)&&!before.processes?.some(old=>old.pid===p.pid&&old.start===p.start));process=candidates.length===1?candidates[0]:null;if(process)break;}
    await new Promise(r=>setTimeout(r,500));
   }
   if(!process)throw new Error('Roblox started but its session could not be identified. It will not be controlled or automatically restarted.');
   const session={id:crypto.randomUUID(),accountId,gameId,placeId:game.placeId,gameName:game.name,pid:process.pid,start:process.start,path:process.path,startedAt:this.now(),status:'running',joinState:this.joinObserver.inspect(logSnapshot,game.placeId,account.userId).state,restartCount,policy:{...policy},memoryBytes:process.memoryBytes,cpuPercent:null,lastCpu:process.cpuSeconds,lastSample:this.now(),lastTrim:this.now()-35*60000+30000,lastAntiAfk:this.now(),message:externalHandler?'The registered launcher manages this Player installation; DragonStrap left its graphics configuration unchanged.':globalSettings.performanceAutoApply?'':'Performance auto-apply is off; FPS and MSAA overrides were not applied.',originalMaxWorkingSet:process.maxWorkingSet,originalAffinity:process.affinity,originalStyle:process.windowStyle,lastNativeWindows:this.store.state().options.nativeWindows,coreIndex:[...this.sessions.values()].filter(s=>s.status==='running').length};
   this.joinSnapshots.set(session.id,logSnapshot);
   this.sessions.set(session.id,session);if(policy.lowPriority||policy.ecoCpu||policy.isolateCpu||policy.memoryPriority||policy.workingSetMb||!this.store.state().options.nativeWindows){const result=await this.native.run({action:'policy',...this.identity(session),policy});if(!result.ok){session.message=result.message;session.policyApplied=false;}}
   return {ok:true,sessionId:session.id};
  });}finally{this.busy.delete(accountId);}
 }
 identity(s){return {pid:s.pid,start:s.start,path:s.path,originalMaxWorkingSet:s.originalMaxWorkingSet,originalAffinity:s.originalAffinity,originalStyle:s.originalStyle,coreIndex:s.coreIndex,nativeWindows:this.store.state().options.nativeWindows};}
 async control(id,action){const s=this.sessions.get(id);if(!s||s.status!=='running')throw new Error('A running managed session is required.');if(!['stop','trim','focus','minimize','policy','antiAfk'].includes(action))throw new Error('Unsupported session action.');
  if(action==='antiAfk'&&(this.stopping||!this.store.account(s.accountId)?.policy.antiAfk))throw new Error('Anti-AFK is disabled or the manager is closing.');
  if(action==='stop')s.stopRequested=true;
  const result=await this.native.run({action,...this.identity(s),policy:this.store.account(s.accountId)?.policy,delayMs:this.store.state().options.antiAfkDelayMs});
  if(!result.ok){if(action==='stop')s.stopRequested=false;throw new Error(result.message);}if(action==='stop')this.finish(s,'stopped');return result;
 }
 finish(s,status){if(s.status!=='running')return;s.status=status;this.joinSnapshots.delete(s.id);s.endedAt=this.now();this.store.history({accountId:s.accountId,accountName:this.store.account(s.accountId)?.alias||this.store.account(s.accountId)?.username||'Removed account',joinState:s.joinState||'unknown',restartCount:s.restartCount||0,gameId:s.gameId,gameName:s.gameName,startedAt:s.startedAt,endedAt:s.endedAt,durationSeconds:Math.max(0,Math.floor((s.endedAt-s.startedAt)/1000)),status});}
 async tick(){if(this.tickBusy||this.stopping)return;this.tickBusy=true;try{
  const scanning=[...this.sessions.values()];const probe=await this.native.run({action:'probe'});if(this.stopping)return;if(probe.ok){this.lastProbe=probe;for(const s of scanning)if(s.status==='running'){
   const p=probe.processes.find(p=>p.pid===s.pid&&p.start===s.start&&p.path===s.path);
   if(!p){this.finish(s,s.stopRequested?'stopped':'exited');const account=this.store.account(s.accountId);if(!s.stopRequested&&account?.policy.autoRestart&&s.restartCount<3&&this.now()-s.startedAt>=30000){try{await this.launch(s.accountId,s.gameId,{restartCount:s.restartCount+1});}catch(e){s.message=e.message;}}continue;}
   const elapsed=(this.now()-s.lastSample)/1000;s.cpuPercent=elapsed>0?Math.max(0,Math.min(100,100*(p.cpuSeconds-s.lastCpu)/elapsed/(probe.logicalCores||1))):0;s.lastCpu=p.cpuSeconds;s.lastSample=this.now();s.memoryBytes=p.memoryBytes;s.responding=p.responding;
   if(['pending','joining','home','unconfirmed'].includes(s.joinState)){const account=this.store.account(s.accountId);const evidence=this.joinObserver.inspect(this.joinSnapshots.get(s.id)||{},s.placeId,account?.userId);s.joinState=evidence.state;if(s.joinState==='joined'&&s.message?.startsWith('Roblox opened, but'))s.message='';if(s.joinState!=='joined'&&this.now()-s.startedAt>90000){s.joinState='unconfirmed';s.message='Roblox opened, but joining the saved game was not confirmed. Try launching again or check the Roblox error screen.';}}
   const policy=this.store.account(s.accountId)?.policy||s.policy;
   if(s.policyApplied===false||JSON.stringify(policy)!==JSON.stringify(s.policy)||s.lastNativeWindows!==this.store.state().options.nativeWindows){const r=await this.native.run({action:'policy',...this.identity(s),policy});s.message=r.ok?'':r.message;if(r.ok){s.policy={...policy};s.policyApplied=true;s.lastNativeWindows=this.store.state().options.nativeWindows;}else s.policyApplied=false;}
   if(policy.autoTrim&&this.now()-s.lastTrim>=35*60000){s.lastTrim=this.now();try{await this.control(s.id,'trim');}catch(e){s.message=e.message;}}
   if(policy.antiAfk&&this.now()-s.lastAntiAfk>=this.store.state().options.antiAfkMinutes*60000&&(!s.lastAntiAfkAttempt||this.now()-s.lastAntiAfkAttempt>=30000)){s.lastAntiAfkAttempt=this.now();try{const r=await this.control(s.id,'antiAfk');if(Number.isInteger(r.sent)&&r.sent>0){s.lastAntiAfk=this.now();s.message=r.message||'Anti-AFK input sent.';}else s.message=r.message||'Anti-AFK waiting; no input was confirmed.';}catch(e){s.message='Anti-AFK: '+e.message;}}
  }}else this.lastError=probe.message;
  if(this.stopping)return;
  for(const job of this.store.state().schedules.filter(j=>j.status==='pending'&&j.at<=this.now())){
   if(this.now()-job.at>5*60000){this.store.updateSchedule(job.id,'missed','Scheduled time passed while DragonStrap was closed or suspended.');continue;}
   this.store.updateSchedule(job.id,'running');try{if(job.action==='launch'){const r=await this.launch(job.accountId,job.gameId);if(!r.ok)throw new Error(r.message);}else{for(const s of this.sessions.values())if(s.accountId===job.accountId&&s.status==='running')await this.control(s.id,'stop');}this.store.updateSchedule(job.id,'completed');}catch(e){this.store.updateSchedule(job.id,'failed',e.message);}
  }
  if(this.shutdownAt&&this.now()>=this.shutdownAt){this.shutdownAt=0;await this.stopAll();}
 }catch(e){this.lastError=e.message;}finally{this.tickBusy=false;}}
 async stopAll(){this.launchEpoch++;const failures=[];for(const s of this.sessions.values())if(s.status==='running')try{await this.control(s.id,'stop');}catch(e){failures.push(e.message);}if(failures.length)throw new Error(failures.join('; '));return {ok:true};}
 setShutdown(minutes){if(!Number.isInteger(minutes)||minutes<0||minutes>1440)throw new Error('Choose 0–1440 minutes.');this.shutdownAt=minutes?this.now()+minutes*60000:0;}
 start(){if(this.stopping||this.timer)return;this.timer=setInterval(()=>this.tick(),15000);this.timer.unref();this.tick();}
 dispose(){if(this.stopping)return;this.stopping=true;clearInterval(this.timer);for(const s of this.sessions.values())if(s.status==='running')try{this.finish(s,'detached');}catch{this.lastError='Session statistics could not be saved on exit.';}}
}
module.exports={AccountSessionService,RobloxAccountProvider,normalizeGame,cleanCookie};
