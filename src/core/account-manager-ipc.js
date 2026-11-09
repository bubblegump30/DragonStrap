'use strict';
const crypto=require('node:crypto');const fs=require('node:fs');const path=require('node:path');
const {ManagerCleanupService}=require('../services/manager-cleanup-service');
function officialUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&(u.hostname==='roblox.com'||u.hostname.endsWith('.roblox.com'));}catch{return false;}}
function installAccountManagerIpc({kernel,electron,getWindow}){
 const telemetry=new (require('../services/monitoring-telemetry').MonitoringTelemetry)();
 require('./system-monitor-ipc').installSystemMonitorIpc({ipcMain:electron.ipcMain,getWindow,telemetry});
 const {ipcMain,BrowserWindow,session,dialog}=electron;const service=kernel.get('accounts.manager');let login=null,loginBusy=false;const cleanup=new ManagerCleanupService();let lastCleanup=0,cleanupBusy=false;
 const guard=fn=>async(event,...args)=>{if(event.sender!==getWindow()?.webContents)throw new Error('Untrusted manager caller.');try{if(service.initializationError)throw new Error(service.initializationError);return {ok:true,...await fn(...args)};}catch(e){return {ok:false,message:e.message};}};
 ipcMain.handle('dragonstrap:manager-options',guard(async()=>({options:service.store.getOptions()})));
 ipcMain.handle('dragonstrap:manager-state',guard(async()=>({data:service.state()})));
 ipcMain.handle('dragonstrap:manager-sign-in',guard(async()=>{
  if(!await service.encryptedAvailable())throw new Error('Windows credential encryption is unavailable.');
  if(login&&!login.isDestroyed()){login.focus();return {pending:true};}
  const partition=session.fromPartition(`dragon-signin-${crypto.randomUUID()}`,{cache:false});
  login=new BrowserWindow({width:1000,height:820,title:'Sign in to Roblox — DragonStrap',parent:getWindow(),autoHideMenuBar:true,webPreferences:{session:partition,sandbox:true,contextIsolation:true,nodeIntegration:false}});
  const win=login;partition.setPermissionRequestHandler((_w,_p,cb)=>cb(false));win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{if(!officialUrl(url))event.preventDefault();});
  const changed=async(_event,cookie,_cause,removed)=>{if(removed||cookie.name!=='.ROBLOSECURITY'||!(cookie.domain==='roblox.com'||cookie.domain.endsWith('.roblox.com'))||loginBusy)return;loginBusy=true;
   try{const connected=await service.connect(cookie.value);service.lastError='';const main=getWindow();if(main&&!main.isDestroyed())main.webContents.send('dragonstrap:manager-account-connected',connected.id);if(!win.isDestroyed())win.close();}catch(e){service.lastError=e.message;}finally{loginBusy=false;}
  };
  partition.cookies.on('changed',changed);win.on('closed',()=>{partition.cookies.removeListener('changed',changed);partition.clearStorageData().catch(()=>{});if(login===win)login=null;});
  await win.loadURL('https://www.roblox.com/login');return {pending:true};
 }));
 async function runCleanup(preview=false){const probe=await service.native.run({action:'probe'});if(!probe.ok)throw new Error('Process scan failed; cleanup was skipped.');const status=await service.status();const plan=cleanup.plan(service.store.state().options,status,probe.processes||[]);return preview?{plan}:kernel.operations.run('accounts.cleanup',{label:'Automatic Roblox cleanup'},()=>cleanup.apply(plan));}
 ipcMain.handle('dragonstrap:manager-action',guard(async(action,input={})=>{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid manager request.');
  switch(action){
   case 'group-save':service.store.saveGroup(input);break;
   case 'group-remove':service.store.removeGroup(input.id);break;
   case 'accounts-edit':service.store.bulkEditAccounts(input.ids,input.patch);break;
   case 'accounts-bulk-cancel':service.cancelBulk();break;
   case 'accounts-bulk':{const bulkResults=await service.bulkAccounts(input.action,input.ids,input.expectedFavorites,input.expectedSessions);return {data:service.state(),bulkResults};}
   case 'account-import':await service.connect(input.cookie);break;
   case 'account-edit':service.store.editAccount(input.id,input.patch);break;
   case 'account-refresh':await service.refreshAccount(input.id);break;
   case 'account-remove':service.removeAccount(input.id);break;
   case 'game-save':await service.saveGame(input.accountId,input);break;
   case 'game-remove':service.store.removeGame(input.accountId,input.gameId);break;
   case 'skin-save':service.store.saveSkin(input);break;
   case 'skin-remove':service.store.removeSkin(input.id);break;
   case 'options':service.store.options(input);break;
   case 'launch':{const result=await service.launch(input.accountId,input.gameId);if(!result.ok)throw new Error(result.message);break;}
   case 'session':await service.control(input.id,input.action);break;
   case 'stop-all':await service.stopAll();break;
   case 'schedule':service.store.schedule(input);break;
   case 'schedule-cancel':service.store.cancelSchedule(input.id);break;
   case 'shutdown':service.setShutdown(input.minutes);break;
   case 'windows-tuning':{
    const backup=path.join(service.userData,'windows-tuning-backup.json');
    if(!fs.existsSync(backup)){
     const before=await service.native.run({action:'diagnostics'});if(!before.ok||typeof before.automaticPageFile!=='boolean')throw new Error('Windows diagnostics are unavailable; tuning was refused.');
     fs.writeFileSync(backup,JSON.stringify({gdiQuota:before.gdiQuota==null?null:Number(before.gdiQuota),automaticPageFile:before.automaticPageFile}),'utf8');
    }
    const result=await service.native.applyWindowsTuning();if(!result.ok)throw new Error(result.message);return {restartRequired:true};
   }
   case 'windows-tuning-restore':{
    const backup=path.join(service.userData,'windows-tuning-backup.json');if(!fs.existsSync(backup))throw new Error('No Windows tuning backup exists.');
    const result=await service.native.applyWindowsTuning({restore:JSON.parse(fs.readFileSync(backup,'utf8'))});if(!result.ok)throw new Error(result.message);return {restartRequired:true};
   }
   case 'telemetry':return {telemetry:await telemetry.sample()};
   case 'native-diagnostics':return {diagnostics:await service.native.run({action:'diagnostics'})};
   case 'cleanup-preview':return runCleanup(true);
   case 'cleanup-now':return runCleanup(false);
   default:throw new Error('Unsupported manager action.');
  }return {data:service.state()};
 }));
 const timer=setInterval(async()=>{const preferences=service.store.state().options;if(cleanupBusy||Date.now()-lastCleanup<3600000||!(preferences.autoCleanLogs||preferences.cleanOldVersions||preferences.cleanDumps))return;cleanupBusy=true;lastCleanup=Date.now();try{const options=service.store.state().options;if(options.autoCleanLogs||options.cleanOldVersions||options.cleanDumps){const result=await runCleanup();if(!result.ok)service.lastError='Automatic cleanup could not finish. Check Recovery.';}}catch(e){service.lastError=e.message;}finally{cleanupBusy=false;}},60000);timer.unref();
 electron.app.on('before-quit',()=>{clearInterval(timer);service.dispose();if(login&&!login.isDestroyed())login.close();});
 return service;
}
module.exports={installAccountManagerIpc,officialUrl};
