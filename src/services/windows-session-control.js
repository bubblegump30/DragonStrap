'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
class WindowsSessionControl {
 constructor({platform=process.platform,spawnImpl=spawn}={}){this.platform=platform;this.spawn=spawnImpl;this.script=fs.readFileSync(path.join(__dirname,'../native/session-control.ps1'),'utf8');}
 async applyWindowsTuning({restore=null}={}){
  if(this.platform!=='win32')return {ok:false,message:'Windows tuning is unavailable.'};
  if(restore&&!(restore.gdiQuota===null||Number.isInteger(restore.gdiQuota)&&restore.gdiQuota>=256&&restore.gdiQuota<=65536))return {ok:false,message:'Invalid Windows tuning backup.'};
  const registry="HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Windows";
  const command=restore
   ? `$ErrorActionPreference='Stop';${restore.gdiQuota===null?`Remove-ItemProperty -Path '${registry}' -Name GDIProcessHandleQuota -ErrorAction SilentlyContinue`:`Set-ItemProperty -Path '${registry}' -Name GDIProcessHandleQuota -Type DWord -Value ${restore.gdiQuota}`}`
   : `$ErrorActionPreference='Stop';$path='${registry}';$quota=Get-ItemPropertyValue $path GDIProcessHandleQuota -ErrorAction SilentlyContinue;if($null -eq $quota -or $quota -lt 20000){Set-ItemProperty -Path $path -Name GDIProcessHandleQuota -Type DWord -Value 20000}`;
  const encoded=Buffer.from(command,'utf16le').toString('base64');
  const elevate=`$ErrorActionPreference='Stop';try{$child=Start-Process -FilePath powershell.exe -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ArgumentList '-NoProfile','-NonInteractive','-EncodedCommand','${encoded}';if($child.ExitCode -ne 0){exit 1}}catch{exit 1}`;
  return new Promise(resolve=>{
   const child=this.spawn('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(elevate,'utf16le').toString('base64')],{windowsHide:true,stdio:'ignore'});
   child.once('error',()=>resolve({ok:false,message:'The administrator request could not start.'}));
   child.once('exit',code=>resolve(code===0?{ok:true,restartRequired:true}:{ok:false,message:'Windows tuning was cancelled or failed. Check Windows settings before retrying.'}));
  });
 }
 run(request){
  if(this.platform!=='win32')return Promise.resolve({ok:false,message:'Windows process controls are unavailable on this platform.'});
  return new Promise(resolve=>{
   let output='',error='',settled=false;
   const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);resolve(result);};
   const child=this.spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(this.script,'utf16le').toString('base64')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
   const timer=setTimeout(()=>{child.kill();finish({ok:false,message:'Windows process control timed out.'});},25000);
   child.on('error',()=>finish({ok:false,message:'Windows process helper could not start.'}));
   child.stdout.on('data',chunk=>{output+=chunk;if(output.length>2*1024*1024){child.kill();finish({ok:false,message:'Windows process response exceeded its limit.'});}});
   child.stderr.on('data',chunk=>{error+=chunk.toString().slice(0,1000);});
   child.on('close',()=>{try{finish(JSON.parse(output.trim()));}catch{finish({ok:false,message:error?'Windows process control failed.':'Windows process control returned no data.'});}});
   child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({...request,controllerPid:process.pid}));
  });
 }
}
module.exports={WindowsSessionControl};
