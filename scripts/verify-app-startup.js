'use strict';
// Boot the actual main/preload/renderer with isolated test data and no visible window.
const fs=require('node:fs');const path=require('node:path');const {app,BrowserWindow}=require('electron');
// A script-hosted Electron run reports Electron's version; IPC must reflect its runtime.
const expected=app.getVersion();
const startupStarted=performance.now();let firstPaintMs=null;
const profile=path.resolve(__dirname,'../../app-startup-fixture');fs.mkdirSync(profile,{recursive:true});
fs.writeFileSync(path.join(profile,'settings.json'),JSON.stringify({firstRunComplete:true,checkForUpdates:false,autoRefresh:false}));
app.setPath('userData',profile);process.env.LOCALAPPDATA=path.join(profile,'Local');
BrowserWindow.prototype.show=function(){};
let done=false;const timer=setTimeout(()=>{if(!done){console.error('Actual app startup timed out.');app.exit(1);}},30000);
app.on('browser-window-created',(_event,win)=>{
 const painted=new Promise(resolve=>win.once('ready-to-show',()=>{firstPaintMs=Math.round(performance.now()-startupStarted);resolve();}));
 win.webContents.once('did-finish-load',async()=>{
  try{
   const result=await win.webContents.executeJavaScript(`(async()=>({info:await window.dragonStrap.getAppInfo(),core:await window.dragonStrap.getCoreState(),manager:await window.dragonStrap.getAccountManager(),bridge:typeof window.dragonStrap.signInRobloxAccount==='function'}))()`);

   if(result.info.version!==expected||!result.manager.ok||result.manager.data.accounts.length!==0||!result.bridge)throw new Error('App version, preload or account manager IPC failed.');
   await win.webContents.executeJavaScript(`document.querySelector('[data-tab="accounts"]').click()`);
   for(let i=0;i<20;i++){if(await win.webContents.executeJavaScript(`Boolean(document.querySelector('#managerRoot .manager-tabs'))`))break;await new Promise(r=>setTimeout(r,250));}
   const visible=await win.webContents.executeJavaScript(`document.querySelector('.view.active').dataset.view==='accounts'&&Boolean(document.querySelector('#managerRoot .manager-tabs'))`);
   if(!visible)throw new Error('Actual account center did not initialize.');
   await painted;
   console.log('STARTUP_TIMING '+JSON.stringify({firstPaintMs,usableAccountCenterMs:Math.round(performance.now()-startupStarted)}));
   console.log('Actual main/preload/renderer startup and manager IPC: passed (isolated test profile).');done=true;clearTimeout(timer);app.quit();
  }catch(e){done=true;clearTimeout(timer);console.error(e);app.exit(1);}
 });
});
require('../main');
