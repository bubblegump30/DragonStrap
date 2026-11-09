'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {SystemMonitor}=require('../src/services/system-monitor');
const {MonitoringTelemetry}=require('../src/services/monitoring-telemetry');
const {installSystemMonitorIpc}=require('../src/core/system-monitor-ipc');
const cpus=(idle,user)=>[{times:{idle,user,nice:0,sys:0,irq:0}},{times:{idle,user,nice:0,sys:0,irq:0}}];
test('System monitor measures CPU deltas across all logical cores and physical RAM usage',()=>{
 let time=1000,snapshot=cpus(100,100);const monitor=new SystemMonitor({now:()=>time,osImpl:{cpus:()=>snapshot,totalmem:()=>1000,freemem:()=>330}});
 snapshot=cpus(180,120);const result=monitor.sample();assert.equal(result.cpuPercent,20);assert.equal(result.memoryPercent,67);
 snapshot=cpus(200,200);assert.equal(monitor.sample(),result);time+=2000;assert.equal(monitor.sample().cpuPercent,80);
});
test('System monitor returns unavailable for missing CPU deltas, counter resets or invalid RAM',()=>{
 let snapshot=cpus(100,100),time=1;const monitor=new SystemMonitor({now:()=>time,osImpl:{cpus:()=>snapshot,totalmem:()=>0,freemem:()=>100}});
 assert.equal(monitor.sample().cpuPercent,null);assert.equal(monitor.sample().memoryPercent,null);
 snapshot=cpus(1,1);time+=2000;assert.equal(monitor.sample().cpuPercent,null);
 snapshot=[];time+=2000;assert.equal(monitor.sample().cpuPercent,null);
});
test('Sidebar sensor calls share cached probes and never start FPS capture',async()=>{
 let time=1,calls=[];const telemetry=new MonitoringTelemetry({now:()=>time,exec:(file,args,options,callback)=>{calls.push(file);setImmediate(()=>callback(null,JSON.stringify({gpu:[45],cpu:[65]}),''));}});
 const [a,b]=await Promise.all([telemetry.sampleSensors(),telemetry.sampleSensors()]);assert.equal(a,b);assert.equal(a.cpu.celsius,65);assert.equal(a.gpu.celsius,45);assert.deepEqual(calls,['powershell.exe','powershell.exe']);
 await telemetry.sampleSensors();assert.equal(calls.length,2);time+=11000;await telemetry.sampleSensors();assert.equal(calls.length,4);
});
test('Missing temperature providers remain null rather than a fabricated zero',async()=>{
 const telemetry=new MonitoringTelemetry({exec:(_file,_args,_options,callback)=>setImmediate(()=>callback(new Error('unavailable'),'',''))});
 const result=await telemetry.sampleSensors();assert.equal(result.cpu.celsius,null);assert.equal(result.gpu.celsius,null);
});
test('System IPC allows only the main window frame and keeps sensor and stats routes separate',async()=>{
 const handlers=new Map(),mainFrame={},webContents={mainFrame};let sensorCalls=0;
 installSystemMonitorIpc({ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},getWindow:()=>({webContents}),telemetry:{sampleSensors:async()=>{sensorCalls++;return {cpu:{celsius:65},gpu:{celsius:45}};}}});
 const stats=handlers.get('dragonstrap:system-stats'),sensors=handlers.get('dragonstrap:system-sensors');
 await assert.rejects(stats({sender:{},senderFrame:mainFrame}),/Untrusted/);await assert.rejects(sensors({sender:webContents,senderFrame:{}}),/Untrusted/);
 assert.equal((await stats({sender:webContents,senderFrame:mainFrame})).ok,true);assert.equal(sensorCalls,0);
 assert.equal((await sensors({sender:webContents,senderFrame:mainFrame})).sensors.cpu.celsius,65);assert.equal(sensorCalls,1);
});
