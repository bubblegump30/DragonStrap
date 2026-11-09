'use strict';
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const {ModService} = require('../services/mod-service');
const exec = promisify(execFile);

async function ensurePlayerClosed({platform=process.platform,execImpl=exec} = {}) {
  if (platform !== 'win32') throw new Error('This Mods preview supports Windows only.');
  const {stdout} = await execImpl('tasklist.exe',['/FI','IMAGENAME eq RobloxPlayerBeta.exe','/FO','CSV','/NH'],{windowsHide:true,timeout:10000});
  if (/RobloxPlayerBeta\.exe/i.test(stdout)) throw new Error('Close all Roblox Player windows before changing Mods.');
  if (!stdout.trim()) throw new Error('Could not verify whether Roblox is running.');
}

function installModsIpc({kernel,electron,getWindow}) {
  // Lazy initialization preserves core startup if local Mods metadata is damaged.
  let service;
  const mods = () => service ||= new ModService({userData:kernel.userData,versionsRoot:kernel.get('roblox.installation').versionsRoot});
  const guard = fn => async (event,...args) => {
    const window = getWindow();
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Untrusted Mods caller.');
    try { return {ok:true,...await fn(...args)}; } catch(error) { return {ok:false,message:error.message}; }
  };
  electron.ipcMain.handle('dragonstrap:mods-state',guard(async()=>({state:mods().state()})));
  electron.ipcMain.handle('dragonstrap:mods-import',guard(async(target,name)=>{
    const result = await electron.dialog.showOpenDialog(getWindow(),{title:'Choose a local replacement asset',properties:['openFile'],filters:[{name:'Sound, image or font',extensions:['ogg','mp3','wav','png','jpg','jpeg','dds','ttf','otf']}]});
    if (result.canceled || !result.filePaths.length) return {canceled:true};
    return kernel.operations.run('mods.import',()=>({state:mods().import(result.filePaths[0],target,name)}));
  }));
  electron.ipcMain.handle('dragonstrap:mods-preview',guard(async id=>({preview:mods().plan(id,await kernel.get('roblox.installation').getStatus())})));
  electron.ipcMain.handle('dragonstrap:mods-change',guard(async(action,value)=>{
    if (!['apply','restore','remove'].includes(action)) throw new Error('Unsupported Mods action.');
    return kernel.operations.run('mods.'+action,async()=>{
      if (action === 'remove') return {state:mods().remove(value)};
      await ensurePlayerClosed();
      return {state:action === 'apply' ? mods().apply(value,await kernel.get('roblox.installation').getStatus()) : mods().restore()};
    });
  }));
}
module.exports = {installModsIpc,ensurePlayerClosed};
