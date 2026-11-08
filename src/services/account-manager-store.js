'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const DEFAULT_OPTIONS = Object.freeze({effects:'gaming',accent:'#b66dff',surface:'#100b1b',nativeWindows:true,multiInstance:false,autoCleanLogs:false,cleanOldVersions:false,cleanDumps:false,antiAfkDelayMs:1000,antiAfkMinutes:18,hideDetails:false});
const DEFAULT_POLICY = Object.freeze({fpsCap:60,potato:false,lowPriority:false,ecoCpu:false,isolateCpu:false,memoryPriority:false,workingSetMb:0,autoTrim:false,antiAfk:false,autoRestart:false});
const text = (v,n=80) => typeof v === 'string' ? v.trim().slice(0,n) : '';
function policy(input={}) {
  const result={...DEFAULT_POLICY};
  for(const key of ['potato','lowPriority','isolateCpu','ecoCpu','memoryPriority','autoTrim','antiAfk','autoRestart']) if(typeof input[key]==='boolean') result[key]=input[key];
  if(Number.isInteger(input.fpsCap)&&input.fpsCap>=0&&input.fpsCap<=240) result.fpsCap=input.fpsCap;
  if(Number.isInteger(input.workingSetMb)&&input.workingSetMb>=0&&input.workingSetMb<=16384) result.workingSetMb=input.workingSetMb;
  return result;
}
class AccountManagerStore {
  constructor(userData,{fsImpl=fs,now=()=>Date.now()}={}) {
    this.fs=fsImpl;this.now=now;this.file=path.join(userData,'account-manager.json');
    this.data={schema:1,accounts:[],groups:[],schedules:[],history:[],skins:[],totals:{seconds:0,launches:0},options:{...DEFAULT_OPTIONS}};
    if(this.fs.existsSync(this.file)) {
      const data=JSON.parse(this.fs.readFileSync(this.file,'utf8'));
      if(data?.schema!==1||!Array.isArray(data.accounts)||!Array.isArray(data.schedules)||!Array.isArray(data.history)) throw new Error('Account manager data is invalid; restore the file before continuing.');
      const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if(data.accounts.length>100||data.schedules.length>200||data.history.length>1000||data.accounts.some(a=>!uuid.test(a.id)||!(/^[1-9]\d{0,19}$/.test(a.userId))||typeof a.username!=='string'||!Array.isArray(a.tags)||!Array.isArray(a.games)||a.games.some(g=>!uuid.test(g.id))))throw new Error('Account manager records are invalid.');
      const groups=data.groups===undefined?[]:data.groups;
      if(!Array.isArray(groups)||groups.length>32||groups.some(g=>!g||!uuid.test(g.id)||!text(g.name,40))||new Set(groups.map(g=>g.id)).size!==groups.length||new Set(groups.map(g=>text(g.name,40).toLowerCase())).size!==groups.length)throw new Error('Account groups are invalid.');
      if(data.accounts.some(a=>a.groupId!=null&&!groups.some(g=>g.id===a.groupId)))throw new Error('Account group membership is invalid.');
      this.data={...data,groups:groups.map(g=>({id:g.id,name:text(g.name,40)})),skins:Array.isArray(data.skins)?data.skins:[],totals:data.totals||{seconds:data.history.reduce((n,s)=>n+(s.durationSeconds||0),0),launches:data.history.length},accounts:data.accounts.map(a=>({...a,groupId:a.groupId??null,policy:policy(a.policy)})),options:{...DEFAULT_OPTIONS,...data.options}};
    }
  }
  commit(task) {
    const next=structuredClone(this.data);const result=task(next);
    this.fs.mkdirSync(path.dirname(this.file),{recursive:true});
    this.fs.writeFileSync(this.file+'.tmp',JSON.stringify(next,null,2)+'\n','utf8');
    this.fs.renameSync(this.file+'.tmp',this.file);this.data=next;return result;
  }
  state(){return structuredClone(this.data);}
  getOptions(){return {...this.data.options};}
  account(id){return this.data.accounts.find(a=>a.id===id)||null;}
  accountIds(ids){
    if(!Array.isArray(ids)||ids.length<1||ids.length>100||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!this.account(id)))throw new Error('Select 1–100 distinct saved accounts.');
    return [...ids];
  }
  saveGroup(input={}){
    const name=text(input.name,40);if(!name)throw new Error('Choose a group name.');
    return this.commit(data=>{let group=input.id?data.groups.find(g=>g.id===input.id):null;if(input.id&&!group)throw new Error('Group not found.');if(data.groups.some(g=>g.id!==group?.id&&g.name.toLowerCase()===name.toLowerCase()))throw new Error('A group with that name already exists.');if(!group){if(data.groups.length>=32)throw new Error('The group limit is 32.');group={id:crypto.randomUUID()};data.groups.push(group);}group.name=name;return {...group};});
  }
  removeGroup(id){return this.commit(data=>{if(!data.groups.some(g=>g.id===id))throw new Error('Group not found.');data.groups=data.groups.filter(g=>g.id!==id);for(const account of data.accounts)if(account.groupId===id)account.groupId=null;});}
  bulkEditAccounts(ids,patch={}){
    const selected=this.accountIds(ids);if(!('groupId' in patch)&&typeof patch.favorite!=='boolean')throw new Error('Choose a supported account change.');
    if('groupId'in patch&&patch.groupId!==null&&!this.data.groups.some(g=>g.id===patch.groupId))throw new Error('Group not found.');
    return this.commit(data=>{for(const id of selected){const account=data.accounts.find(a=>a.id===id);if('groupId'in patch)account.groupId=patch.groupId;if(typeof patch.favorite==='boolean')account.favorite=patch.favorite;}return selected;});
  }
  saveAccount(input) {
    if(!input||!/^[1-9]\d{0,19}$/.test(String(input.userId||''))||!text(input.username,20)) throw new Error('A verified Roblox account is required.');
    return this.commit(data=>{
      let account=data.accounts.find(a=>a.userId===String(input.userId));
      if(!account){if(data.accounts.length>=100) throw new Error('The account limit is 100.');account={id:crypto.randomUUID(),userId:String(input.userId),alias:'',tags:[],groupId:null,favorite:false,games:[],policy:{...DEFAULT_POLICY},createdAt:this.now()};data.accounts.push(account);}
      if(typeof input.avatarUrl==='string'&&/^https:\/\/[^/]+\.rbxcdn\.com\//i.test(input.avatarUrl))account.avatarUrl=input.avatarUrl;
      if(input.robux===null||Number.isSafeInteger(input.robux)&&input.robux>=0)account.robux=input.robux;
      if(Number.isSafeInteger(input.refreshedAt))account.refreshedAt=input.refreshedAt;
      account.username=text(input.username,20);account.displayName=text(input.displayName,80)||account.username;
      return structuredClone(account);
    });
  }
  editAccount(id,input={}) {
    return this.commit(data=>{const a=data.accounts.find(a=>a.id===id);if(!a)throw new Error('Account not found.');
      if('alias'in input)a.alias=text(input.alias);
      if('tags'in input){if(!Array.isArray(input.tags))throw new Error('Tags must be a list.');a.tags=[...new Set(input.tags.map(v=>text(v,24)).filter(Boolean))].slice(0,20);}
      if(typeof input.favorite==='boolean')a.favorite=input.favorite;
      if(input.policy)a.policy=policy({...a.policy,...input.policy});
      return structuredClone(a);
    });
  }
  removeAccount(id){return this.commit(data=>{data.accounts=data.accounts.filter(a=>a.id!==id);data.schedules=data.schedules.filter(s=>s.accountId!==id);});}
  saveGame(id,game) {
    if(!game||!/^[1-9]\d{0,19}$/.test(String(game.placeId||'')))throw new Error('Invalid Place ID.');
    return this.commit(data=>{const a=data.accounts.find(a=>a.id===id);if(!a)throw new Error('Account not found.');
      const existing=a.games.find(g=>g.id===game.id);if(!existing&&a.games.length>=100)throw new Error('The saved game limit is 100 per account.');
      const item={id:existing?.id||crypto.randomUUID(),placeId:String(game.placeId),name:text(game.name,120)||`Place ${game.placeId}`,uri:text(game.uri,4096),favorite:typeof game.favorite==='boolean'?game.favorite:Boolean(existing?.favorite),imageUrl:typeof game.imageUrl==='string'&&/^https:\/\/[^/]+\.rbxcdn\.com\//i.test(game.imageUrl)?game.imageUrl:(existing?.imageUrl||'')};
      if(existing)Object.assign(existing,item);else a.games.push(item);return item;
    });
  }
  removeGame(id,gameId){return this.commit(data=>{const a=data.accounts.find(a=>a.id===id);if(!a)throw new Error('Account not found.');a.games=a.games.filter(g=>g.id!==gameId);});}
  options(patch={}) {
    return this.commit(data=>{const o=data.options;
      for(const key of ['nativeWindows','multiInstance','autoCleanLogs','cleanOldVersions','cleanDumps','hideDetails'])if(typeof patch[key]==='boolean')o[key]=patch[key];
      if(['gaming','light','low'].includes(patch.effects))o.effects=patch.effects;
      for(const key of ['accent','surface'])if(/^#[a-f0-9]{6}$/i.test(patch[key]||''))o[key]=patch[key];
      if(Number.isInteger(patch.antiAfkDelayMs)&&patch.antiAfkDelayMs>=250&&patch.antiAfkDelayMs<=10000)o.antiAfkDelayMs=patch.antiAfkDelayMs;
      if(Number.isInteger(patch.antiAfkMinutes)&&patch.antiAfkMinutes>=5&&patch.antiAfkMinutes<=18)o.antiAfkMinutes=patch.antiAfkMinutes;
      return {...o};
    });
  }
  saveSkin(input){
    if(!text(input.name,40)||!/^#[a-f0-9]{6}$/i.test(input.accent||'')||!/^#[a-f0-9]{6}$/i.test(input.surface||''))throw new Error('Choose a skin name and valid colors.');
    return this.commit(data=>{let skin=data.skins.find(s=>s.name===text(input.name,40));if(!skin){if(data.skins.length>=20)throw new Error('The custom skin limit is 20.');skin={id:crypto.randomUUID()};data.skins.push(skin);}Object.assign(skin,{name:text(input.name,40),accent:input.accent,surface:input.surface,effects:['gaming','light','low'].includes(input.effects)?input.effects:'gaming'});return {...skin};});
  }
  removeSkin(id){return this.commit(data=>{data.skins=data.skins.filter(s=>s.id!==id);});}
  schedule(input) {
    if(!['launch','stop'].includes(input?.action)||!Number.isSafeInteger(input.at)||input.at<=this.now()||input.at>this.now()+366*86400000)throw new Error('Choose a future time within one year.');
    if(!this.account(input.accountId))throw new Error('Account not found.');
    if(input.action==='launch'&&!this.account(input.accountId).games.some(g=>g.id===input.gameId))throw new Error('Choose a saved game.');
    return this.commit(data=>{if(data.schedules.length>=200){const removable=data.schedules.findIndex(s=>!['pending','running'].includes(s.status));if(removable<0)throw new Error('The pending schedule limit is 200.');data.schedules.splice(removable,1);}const item={id:crypto.randomUUID(),accountId:input.accountId,gameId:input.gameId||null,action:input.action,at:input.at,status:'pending',createdAt:this.now()};data.schedules.push(item);return item;});
  }
  cancelSchedule(id){return this.commit(data=>{const s=data.schedules.find(s=>s.id===id);if(s?.status==='pending')s.status='cancelled';});}
  updateSchedule(id,status,message=''){return this.commit(data=>{const s=data.schedules.find(s=>s.id===id);if(s){s.status=status;s.message=text(message,200);}});}
  history(item){return this.commit(data=>{data.totals.seconds+=item.durationSeconds||0;data.totals.launches++;data.history.unshift({...item,id:crypto.randomUUID()});data.history=data.history.slice(0,1000);});}
}
module.exports={AccountManagerStore,DEFAULT_OPTIONS,DEFAULT_POLICY,policy};
