'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {ensurePlayerClosed,installModsIpc}=require('../src/core/mods-ipc');
test('Mods refuse running Player, process-query failures, empty results and unsupported platforms',async()=>{
  await assert.rejects(ensurePlayerClosed({platform:'win32',execImpl:async()=>({stdout:'"RobloxPlayerBeta.exe","1234"'})}),/Close all/);
  await assert.rejects(ensurePlayerClosed({platform:'win32',execImpl:async()=>({stdout:''})}),/Could not verify/);
  await assert.rejects(ensurePlayerClosed({platform:'win32',execImpl:async()=>{throw new Error('query failed');}}),/query failed/);
  await assert.rejects(ensurePlayerClosed({platform:'darwin'}),/Windows/);
  await ensurePlayerClosed({platform:'win32',execImpl:async(command,args,options)=>{
    assert.equal(command,'tasklist.exe');assert.ok(args.includes('IMAGENAME eq RobloxPlayerBeta.exe'));assert.equal(options.windowsHide,true);
    return {stdout:'INFO: No tasks are running which match the specified criteria.'};
  }});
});
test('Mods IPC rejects foreign windows and child frames before touching files or showing a picker',async()=>{
  const handlers=new Map(),mainFrame={},webContents={mainFrame};let picked=false;
  installModsIpc({kernel:{},electron:{ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},dialog:{showOpenDialog:async()=>{picked=true;}}},getWindow:()=>({webContents})});
  const handler=handlers.get('dragonstrap:mods-import');
  await assert.rejects(handler({sender:{},senderFrame:mainFrame},'content/sounds/x.ogg','Sound'),/Untrusted/);
  await assert.rejects(handler({sender:webContents,senderFrame:{}},'content/sounds/x.ogg','Sound'),/Untrusted/);
  assert.equal(picked,false);
});
