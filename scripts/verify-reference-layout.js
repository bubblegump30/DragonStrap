'use strict';
const fs=require('node:fs'),path=require('node:path');
const {app,BrowserWindow}=require('electron');
const {DEFAULT_OPTIONS,DEFAULT_POLICY}=require('../src/services/account-manager-store');
const root=path.resolve(__dirname,'..'),fixture=path.join(root,'renderer','.reference-verification.html');
fs.writeFileSync(fixture,fs.readFileSync(path.join(root,'renderer/index.html'),'utf8').replace(/<script src="[^"]+"><\/script>/g,''));
const data={groups:[],accounts:[{id:'fixture-account',username:'PreviewDragon',alias:'Creative account',avatarUrl:'assets/dragon-app-icon.png',tags:[],favorite:false,connected:true,robux:25,policy:{...DEFAULT_POLICY},games:[{id:'fixture-game',name:'Saved game preview',favorite:true,imageUrl:'assets/dragon-app-icon.png'}]}],options:{...DEFAULT_OPTIONS},skins:[],schedules:[],history:[],sessions:[],stats:{seconds:120,launches:1},probe:{processes:[],freeMemoryBytes:8*1073741824},shutdownAt:0,lastError:''};
let win;
const js=async code=>{try{return await win.webContents.executeJavaScript(code);}catch(error){throw new Error(code.slice(0,100)+': '+error.message);}};
const paint=()=>js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
(async()=>{try{
 await app.whenReady();win=new BrowserWindow({show:false,width:1600,height:980,webPreferences:{contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false}});
 await win.loadFile(fixture);
 await js(`Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});window.__data=${JSON.stringify(data)};window.__actions=[];window.__missingSensors=false;window.dragonStrap={getAccountManager:async()=>({ok:true,data:window.__data}),accountManagerAction:async(action,input)=>{window.__actions.push({action,input});if(action==='options')Object.assign(window.__data.options,input);if(action==='account-edit')Object.assign(window.__data.accounts.find(a=>a.id===input.id),input.patch);return {ok:true,data:window.__data};},getSystemStats:async()=>({ok:true,system:{cpuPercent:1,memoryPercent:67}}),getSystemSensors:async()=>({ok:true,sensors:{cpu:{celsius:window.__missingSensors?null:65,status:window.__missingSensors?'Administrator required':'Synthetic CPU sensor'},gpu:{celsius:window.__missingSensors?null:45,status:'Synthetic GPU sensor'}}}),signInRobloxAccount:async()=>{window.__actions.push({action:'sign-in'});return {ok:true};}};window.__view=name=>{document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.dataset.view===name));document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.tab===name));document.documentElement.dataset.view=name;};document.querySelector('.nav-item[data-tab=accounts]').addEventListener('click',()=>window.__view('accounts'));window.__view('accounts');`);
 for(const file of ['account-workspace.js','manager.js','system-monitor.js'])await js(fs.readFileSync(path.join(root,'renderer',file),'utf8'));
 await paint();
 if(!await js(`document.querySelector('[data-system-value=cpu]').textContent==='1%'&&document.querySelector('[data-system-value=ram]').textContent==='67%'&&document.querySelector('[data-system-value=cpuTemp]').textContent==='65°'&&document.querySelector('[data-system-value=gpuTemp]').textContent==='45°'`))throw new Error('Sidebar readings failed.');
 await js(`document.querySelector('[data-manager=sign-in]').click()`);await paint();
 if(!await js(`window.__actions.some(a=>a.action==='sign-in')`))throw new Error('Sign-in route failed.');
 await js(`document.querySelector('[data-manager=quick-launch]').click()`);await paint();
 if(!await js(`window.__actions.some(a=>a.action==='launch'&&a.input.accountId==='fixture-account'&&a.input.gameId==='fixture-game')`))throw new Error('Favorite-game launch route failed.');
 await js(`document.querySelector('[data-manager=hide]').click()`);await paint();
 if(!await js(`!document.querySelector('.account-table').textContent.includes('PreviewDragon')&&!document.querySelector('.account-table').textContent.includes('Creative account')&&!document.querySelector('.account-table img')`))throw new Error('Table privacy failed.');
 await js(`document.querySelector('[data-manager=hide]').click()`);await paint();
 await js(`document.querySelector('.account-policy').click()`);await paint();
 if(!await js(`!!document.querySelector('.manager-dialog[open] [data-form=policy]')`))throw new Error('Policy editor route failed.');
 await js(`document.querySelector('.manager-dialog [name=antiAfk]').checked=true;document.querySelector('.manager-dialog [data-form=policy]').requestSubmit()`);await paint();
 if(!await js(`window.__actions.some(a=>a.action==='account-edit'&&a.input.id==='fixture-account'&&a.input.patch.policy.antiAfk===true)&&document.querySelector('.account-policy').classList.contains('enabled')`))throw new Error('Anti-AFK opt-in save/indicator failed.');
 await js(`document.querySelector('.account-policy').click()`);await paint();
 await js(`document.querySelector('.manager-dialog [name=antiAfk]').checked=false;document.querySelector('.manager-dialog [data-form=policy]').requestSubmit()`);await paint();
 if(!await js(`window.__data.accounts[0].policy.antiAfk===false&&!document.querySelector('.account-policy').classList.contains('enabled')`))throw new Error('Anti-AFK disable save/indicator failed.');
 await js(`document.querySelector('.account-policy').click()`);await paint();

 await js(`document.querySelector('.manager-dialog [data-manager=close-dialog]').click();document.querySelector('.sidebar-manager-link[data-manager-goto=sessions]').click()`);await paint();
 if(!await js(`document.querySelector('#managerPane').textContent.includes('ACTIVE MANAGED SESSIONS')`))throw new Error('Sidebar Sessions route failed.');
 await js(`document.querySelector('.sidebar-manager-link[data-manager-goto=appearance]').click()`);await paint();
 if(!await js(`!!document.querySelector('[data-form=appearance]')`))throw new Error('Sidebar Appearance route failed.');
 await js(`document.querySelector('[data-manager-pane=accounts]').click()`);await paint();
 await js(`window.__missingSensors=true;document.dispatchEvent(new Event('visibilitychange'))`);await paint();
 if(!await js(`document.querySelector('[data-system-value=cpuTemp]').textContent==='—'&&!document.querySelector('[data-system-bar=cpuTemp]').parentElement.hasAttribute('aria-valuenow')`))throw new Error('Unavailable sensor was displayed as a number.');
 await js(`window.__missingSensors=false;document.dispatchEvent(new Event('visibilitychange'));document.querySelector('.manager-status').textContent='';`);await paint();
 for(const size of [{width:1600,height:980,zoom:1},{width:1600,height:980,zoom:1.25},{width:1600,height:980,zoom:1.5},{width:1366,height:800,zoom:1},{width:1180,height:760,zoom:1}]){
  win.setContentSize(size.width,size.height);win.webContents.setZoomFactor(size.zoom);await paint();
  const issues=await js(`(()=>{const out=[];if(document.documentElement.scrollWidth>innerWidth+3)out.push('horizontal page overflow');const system=document.querySelector('#sidebarSystem').getBoundingClientRect(),sidebar=document.querySelector('.sidebar').getBoundingClientRect(),nav=document.querySelector('.sidebar nav').getBoundingClientRect();if(system.top<sidebar.top-1||system.bottom>sidebar.bottom+1)out.push('clipped system panel');if(nav.height<70)out.push('sidebar navigation inaccessible');const table=document.querySelector('.account-table-scroll').getBoundingClientRect();if(table.right>innerWidth+3)out.push('table container beyond viewport');return out})()`);
  if(issues.length)throw new Error(JSON.stringify({size,issues}));
  if(process.env.DRAGONSTRAP_UI_OUTPUT&&size.width===1600&&size.zoom===1){fs.mkdirSync(process.env.DRAGONSTRAP_UI_OUTPUT,{recursive:true});fs.writeFileSync(path.join(process.env.DRAGONSTRAP_UI_OUTPUT,'Accounts-System-Preview.png'),(await win.webContents.capturePage()).toPNG());}
  console.log(`Reference layout passed: ${size.width}x${size.height} @ ${size.zoom*100}%`);
 }
 console.log('Sidebar metrics, missing sensors, sign-in, launch, privacy, Anti-AFK enable/disable persistence, policy and Sessions/Appearance routes passed (synthetic data).');app.exit(0);
}catch(error){console.error(error);app.exit(1);}finally{win?.destroy();fs.rmSync(fixture,{force:true});}})();
