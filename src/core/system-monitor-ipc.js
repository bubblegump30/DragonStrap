'use strict';
const {SystemMonitor}=require('../services/system-monitor');
function installSystemMonitorIpc({ipcMain,getWindow,telemetry}) {
  const monitor=new SystemMonitor();
  const guard=fn=>async event=>{
    const window=getWindow();
    if(!window||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame)throw new Error('Untrusted system monitor caller.');
    try{return {ok:true,...await fn()};}catch(error){return {ok:false,message:error.message};}
  };
  ipcMain.handle('dragonstrap:system-stats',guard(()=>({system:monitor.sample()})));
  ipcMain.handle('dragonstrap:system-sensors',guard(async()=>({sensors:await telemetry.sampleSensors()})));
}
module.exports={installSystemMonitorIpc};
