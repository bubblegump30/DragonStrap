'use strict';
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const {app,BrowserWindow,safeStorage}=require('electron');
const root=path.resolve(__dirname,'..'),fixture=path.join(root,'renderer','.manager-verification.html');
const source=fs.readFileSync(path.join(root,'renderer/index.html'),'utf8').replace('<script src="app.js"></script>','').replace('<script src="manager.js"></script>','');
fs.writeFileSync(fixture,source);const output=process.env.DRAGONSTRAP_UI_OUTPUT;let failures=0;
const {DEFAULT_OPTIONS,DEFAULT_POLICY}=require('../src/services/account-manager-store');
const account={id:'00000000-0000-4000-8000-000000000001',userId:'123',username:'PreviewDragon',displayName:'Preview Dragon',alias:'Layout test account',tags:['creator','test'],favorite:true,connected:true,policy:{...DEFAULT_POLICY},games:[{id:'00000000-0000-4000-8000-000000000002',placeId:'123',name:'Saved game preview',uri:'roblox://experiences/start?placeId=123',favorite:true}]};
const data={accounts:[account],options:{...DEFAULT_OPTIONS},schedules:[],history:[],sessions:[{id:'test-session',accountId:account.id,gameId:account.games[0].id,pid:123,start:'fixture',startedAt:Date.now()-120000,status:'running',gameName:'Layout test session',memoryBytes:256*1048576,cpuPercent:2.5}],stats:{seconds:120,launches:1,level:1,achievements:[{name:'First launch',earned:true},{name:'One hour',earned:false}]},probe:{processes:[],freeMemoryBytes:8*1073741824},shutdownAt:0,lastError:'Layout verification uses synthetic test data.'};
async function paint(win){await win.webContents.executeJavaScript('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');}
async function inspect(win,label){const issues=await win.webContents.executeJavaScript(`(()=>{const issues=[];if(document.documentElement.scrollWidth>innerWidth+3)issues.push('page horizontal overflow');for(const b of document.querySelectorAll('#managerRoot button,.manager-dialog[open] button')){if(!b.offsetParent||b.clientWidth<1||b.closest('.manager-table-scroll'))continue;const r=document.createRange();r.selectNodeContents(b);const text=r.getBoundingClientRect(),box=b.getBoundingClientRect();if(text.height&&(text.top<box.top-2||text.bottom>box.bottom+2))issues.push('clipped button: '+b.textContent.trim());}return issues;})()`);if(issues.length){failures+=issues.length;console.error(label+': '+issues.join('; '));}}
(async()=>{let win;try{
 await app.whenReady();if(!await safeStorage.isAsyncEncryptionAvailable())throw new Error('Windows encryption is unavailable.');const sample='synthetic-test-secret';const encrypted=await safeStorage.encryptStringAsync(sample);if(encrypted.toString().includes(sample)||(await safeStorage.decryptStringAsync(encrypted)).result!==sample)throw new Error('OS encryption roundtrip failed.');console.log('Windows safeStorage encryption roundtrip passed.');
 win=new BrowserWindow({show:false,width:1600,height:980,webPreferences:{contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false}});
 win.webContents.on('console-message',event=>{if(event.level==='error')console.error(event.message);});
 await win.loadFile(fixture);
 await win.webContents.executeJavaScript(`window.dragonStrap={getAccountManager:async()=>({ok:true,data:${JSON.stringify(data)}}),accountManagerAction:async()=>({ok:true,data:${JSON.stringify(data)}}),signInRobloxAccount:async()=>({ok:true})};document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.dataset.view==='accounts'));document.documentElement.dataset.view='accounts';document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.tab==='accounts'));`);
 await win.webContents.executeJavaScript(fs.readFileSync(path.join(root,'renderer/manager.js'),'utf8'));await paint(win);
 for(const size of [{width:1600,height:980,zoom:1},{width:1600,height:980,zoom:1.25},{width:1600,height:980,zoom:1.5},{width:1180,height:760,zoom:1}]){
  win.setContentSize(size.width,size.height);await paint(win);win.webContents.setZoomFactor(size.zoom);await paint(win);
  for(const pane of ['accounts','sessions','monitor','scheduler','levels','appearance','settings']){await win.webContents.executeJavaScript(`document.querySelector('[data-manager-pane="${pane}"]').click()`);await paint(win);await inspect(win,`${size.width}@${size.zoom} ${pane}`);
   if(output&&size.width===1600&&size.zoom===1&&['accounts','sessions','settings'].includes(pane)){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,`DragonStrap-${pane}-preview.png`),(await win.webContents.capturePage()).toPNG());}
  }
  await win.webContents.executeJavaScript(`document.querySelector('[data-manager-pane="accounts"]').click();document.querySelector('[data-manager="edit"]').click();`);await paint(win);
  for(const tab of ['details','games','policy']){await win.webContents.executeJavaScript(`document.querySelector('[data-account-tab="${tab}"]').click()`);await paint(win);await inspect(win,`${size.width}@${size.zoom} account ${tab}`);}
  await win.webContents.executeJavaScript(`document.querySelector('.manager-dialog [data-manager="close-dialog"]').click()`);
  console.log(`Account center panes and dialogs checked: ${size.width}x${size.height} @ ${size.zoom*100}%`);
 }
}catch(e){failures++;console.error(e);}finally{win?.destroy();fs.rmSync(fixture,{force:true});app.exit(failures?1:0);}})();
