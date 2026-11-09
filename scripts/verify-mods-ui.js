'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {app,BrowserWindow}=require('electron');
const root=path.resolve(__dirname,'..'),fixture=path.join(root,'renderer','.mods-verification.html');
const source=fs.readFileSync(path.join(root,'renderer/index.html'),'utf8').replace(/<script src="[^"]+"><\/script>/g,'');
const output=process.env.DRAGONSTRAP_UI_OUTPUT;
fs.writeFileSync(fixture,source);
let win;
async function evaluate(code){return win.webContents.executeJavaScript(code);}
async function paint(){await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');}
(async()=>{try{
  await app.whenReady();win=new BrowserWindow({show:false,width:1600,height:980,webPreferences:{contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false}});
  await win.loadFile(fixture);
  await evaluate(`window.__mods={mods:[],active:null};window.__calls=[];window.dragonStrap={getMods:async()=>({ok:true,state:window.__mods}),importMod:async(target,name)=>{window.__mods.mods=[{id:'00000000-0000-4000-8000-000000000001',name,target,hash:'a'.repeat(64),size:4096}];return {ok:true,state:window.__mods};},previewMod:async id=>({ok:true,preview:{token:'review-token',name:window.__mods.mods[0].name,destination:'C:/Fixture/Versions/version-preview/'+window.__mods.mods[0].target}}),changeMod:async(action,value)=>{window.__calls.push({action,value});if(action==='apply')window.__mods.active={name:window.__mods.mods[0].name,target:window.__mods.mods[0].target,version:'version-preview'};if(action==='restore')window.__mods.active=null;if(action==='remove')window.__mods.mods=[];return {ok:true,state:window.__mods};}};document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.dataset.view==='mods'));document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.tab==='mods'));`);
  await evaluate(fs.readFileSync(path.join(root,'renderer/mods.js'),'utf8'));
  await evaluate(`document.documentElement.dataset.view='mods'`);await paint();
  await evaluate(`document.querySelector('#modsRoot [name=name]').value='Custom cursor <test>';document.querySelector('#modsRoot [name=target]').value='content/textures/Cursors/KeyboardMouse/ArrowCursor.png';document.querySelector('#modsRoot form').requestSubmit()`);await paint();
  if(!await evaluate(`document.querySelector('.mods-library').textContent.includes('Custom cursor <test>')&&!document.querySelector('.mods-library test')`))throw new Error('Imported asset rendering/escaping failed.');
  await evaluate(`document.querySelector('[data-mod-action=preview]').click()`);await paint();
  if(!await evaluate(`!document.querySelector('.mods-review').hidden&&document.querySelector('.mods-review').textContent.includes('C:/Fixture/')`))throw new Error('Exact destination review missing.');
  await evaluate(`document.querySelector('[data-mod-action=apply]').click()`);await paint();
  if(!await evaluate(`window.__calls[0].action==='apply'&&window.__calls[0].value==='review-token'&&!!document.querySelector('[data-mod-action=restore]')`))throw new Error('Apply review-token/restore flow failed.');
  await evaluate(`document.querySelector('[data-mod-action=restore]').click()`);await paint();
  if(!await evaluate(`!document.querySelector('[data-mod-action=restore]')`))throw new Error('Restore state failed.');
  for(const size of [{width:1600,height:980,zoom:1},{width:1600,height:980,zoom:1.25},{width:1600,height:980,zoom:1.5},{width:1180,height:760,zoom:1}]){
    win.setContentSize(size.width,size.height);win.webContents.setZoomFactor(size.zoom);await paint();
    const errors=await evaluate(`(()=>{const out=[];if(document.documentElement.scrollWidth>innerWidth+3)out.push('horizontal overflow');for(const node of document.querySelectorAll('#modsRoot button,#modsRoot input')){if(!node.offsetParent)continue;const rect=node.getBoundingClientRect();if(rect.width<25||rect.right>innerWidth+3)out.push('invalid control bounds');}return out})()`);
    if(errors.length)throw new Error(JSON.stringify({size,errors}));
    if(output&&size.zoom===1&&size.width===1600){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'Mods-Preview.png'),(await win.webContents.capturePage()).toPNG());}
    console.log(`Mods layout passed: ${size.width}x${size.height} @ ${size.zoom*100}%`);
  }
  await evaluate(`document.querySelector('[data-mod-action=remove]').click()`);await paint();
  if(!await evaluate(`document.querySelector('.mods-library').textContent.includes('Your library is empty')`))throw new Error('Library remove flow failed.');
  console.log('Mods import, escaped library, exact preview, apply token, restore and remove UI flows passed (synthetic data).');
  app.exit(0);
}catch(error){console.error(error);app.exit(1);}finally{win?.destroy();fs.rmSync(fixture,{force:true});}})();
