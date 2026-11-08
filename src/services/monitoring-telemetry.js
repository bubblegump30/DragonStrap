'use strict';
const {execFile}=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs');
function cpuReading(result){
 let data={};try{data=JSON.parse(result.stdout);}catch{}
 const sensors=Array.isArray(data.cpu)?data.cpu.filter(s=>typeof s.celsius==='number'&&Number.isFinite(s.celsius)&&s.celsius>0&&s.celsius<=150):[];
 const packageSensor=sensors.find(s=>/Tctl\/Tdie|CPU Package/i.test(s.name));
 return {celsius:packageSensor?.celsius??(sensors.length?Math.max(...sensors.map(s=>s.celsius)):null),source:'LibreHardwareMonitor 0.9.6 / PawnIO',status:sensors.length?'Live CPU sensor · '+(packageSensor?.name||'hottest core'):data.status==='administrator-required'?'Run DragonStrap as administrator to read the CPU sensor':data.status==='driver-required'?'PawnIO sensor driver required (not installed automatically)':data.status==='no-sensor'?'No supported CPU temperature sensor detected':'CPU sensor reader could not obtain a valid reading'};
}
function csvCells(line){
 const cells=[];let value='',quoted=false;
 for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){cells.push(value.trim());value='';}else value+=c;}
 cells.push(value.trim());return cells;
}
function parseFrames(csv){
 const lines=csv.replace(/^\uFEFF/,'').split(/\r?\n/);let header=null;const groups=new Map();
 for(const line of lines){const cells=csvCells(line);const normalized=cells.map(c=>c.toLowerCase());
  if(normalized[0]==='application'&&normalized.includes('processid')){header=normalized;continue;}
  if(!header)continue;
  const get=name=>cells[header.indexOf(name)];const pid=Number(get('processid')),ms=Number(get('msbetweenpresents'));
  const application=get('application')?.split(/[\\/]/).pop()?.toLowerCase();
  if(application!=='robloxplayerbeta.exe'||!Number.isSafeInteger(pid)||pid<=0||!Number.isFinite(ms)||ms<=0||ms>1000)continue;
  const key=pid+':'+get('swapchainaddress');const g=groups.get(key)||{pid,count:0,ms:0};g.count++;g.ms+=ms;groups.set(key,g);
 }
 const best=new Map();for(const g of groups.values())if(g.count>=3&&(!best.has(g.pid)||best.get(g.pid).count<g.count))best.set(g.pid,g);
 return [...best.values()].map(g=>({pid:g.pid,fps:Math.round(10000*g.count/g.ms)/10,samples:g.count}));
}

class MonitoringTelemetry {
 constructor({exec=execFile,now=()=>Date.now()}={}){this.exec=exec;this.now=now;this.cached=null;this.pending=null;}
 run(file,args,timeout=8000){return new Promise(resolve=>this.exec(file,args,{windowsHide:true,timeout,maxBuffer:4*1024*1024},(error,stdout,stderr)=>resolve({error,stdout:String(stdout||''),stderr:String(stderr||'')})));}
 async sample(){if(this.pending)return this.pending;if(this.cached&&this.now()-this.cached.sampledAt<8000)return this.cached;this.pending=this.collect();try{return this.cached=await this.pending;}finally{this.pending=null;}}
 async collect(){
 const sensorScript=`$ErrorActionPreference='SilentlyContinue';$gpu=@();$smi=Join-Path $env:WINDIR 'System32\\nvidia-smi.exe';if(Test-Path -LiteralPath $smi){$gpu=@(& $smi --query-gpu=temperature.gpu --format=csv,noheader,nounits | ForEach-Object { $v=0.0;if([double]::TryParse($_,[Globalization.NumberStyles]::Float,[Globalization.CultureInfo]::InvariantCulture,[ref]$v) -and $v -ge 0 -and $v -le 150){$v} })};$cpu=@();$source='';foreach($ns in @('root/LibreHardwareMonitor','root/OpenHardwareMonitor')){$s=@(Get-CimInstance -Namespace $ns -ClassName Sensor | Where-Object {$_.SensorType -eq 'Temperature' -and $_.Identifier -match '/(intelcpu|amdcpu)/' -and $_.Value -ge 0 -and $_.Value -le 150});if($s.Count){$cpu=@($s|ForEach-Object {[double]$_.Value});$source=$ns;break}};@{gpu=$gpu;cpu=$cpu;cpuSource=$source}|ConvertTo-Json -Compress`;
 const binary=path.join(__dirname,'../../assets/telemetry/PresentMon.exe').replace('app.asar'+path.sep,'app.asar.unpacked'+path.sep);
 const cpuLibrary=path.join(__dirname,'../../assets/telemetry/cpu/LibreHardwareMonitorLib.dll').replace('app.asar'+path.sep,'app.asar.unpacked'+path.sep);
 const cpuScript=fs.readFileSync(path.join(__dirname,'../native/cpu-sensors.ps1'),'utf8');
 const cpuCommand='& { '+cpuScript+' } '+"'"+cpuLibrary.replaceAll("'","''")+"'";
 const [sensors,frames,directCpu]=await Promise.all([this.run('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(sensorScript,'utf16le').toString('base64')]),this.run(binary,['--process_name','RobloxPlayerBeta.exe','--output_stdout','--no_console_stats','--v1_metrics','--timed','3','--terminate_after_timed','--session_name','DragonStrap-'+process.pid],7000),this.run('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(cpuCommand,'utf16le').toString('base64')],10000)]);
 let values={};try{values=JSON.parse(sensors.stdout);}catch{}
 const valid=a=>Array.isArray(a)?a.filter(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=150):[];
 const gpu=valid(values.gpu),cpu=valid(values.cpu).filter(n=>n>0),fps=parseFrames(frames.stdout);
 return {sampledAt:this.now(),gpu:{celsius:gpu.length?Math.max(...gpu):null,source:'NVIDIA driver',status:gpu.length?'Live sensor':'NVIDIA temperature provider not detected'},cpu:cpu.length?{celsius:Math.max(...cpu),source:values.cpuSource||'',status:'Live CPU sensor (hottest)'}:cpuReading(directCpu),fps:{readings:fps,status:fps.length?'Measured presentation rate (3-second sample)':/access denied|administrative privileges/i.test(frames.stderr+frames.stdout)?'Windows permission required: run DragonStrap as administrator for FPS capture':frames.error?'FPS provider could not start':'Waiting for Roblox frames — keep the game rendering'}};
 }
}
module.exports={MonitoringTelemetry,parseFrames,cpuReading};
