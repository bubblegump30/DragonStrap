'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const file=path.join(__dirname,'../scripts/verify-anti-afk-native.ps1');
function simulate(name){return JSON.parse(execFileSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-File',file,'-Case',name],{encoding:'utf8',windowsHide:true,timeout:20000}).trim());}
test('Native Anti-AFK compiles with the correct Windows INPUT layout without sending input',{skip:process.platform!=='win32'},()=>{const r=simulate('compile');assert.equal(r.ok,true);assert.equal(r.inputSent,false);assert.ok([28,40].includes(r.inputSize));});
test('Native Anti-AFK skips background windows, recent activity and held keys',{skip:process.platform!=='win32'},()=>{for(const name of ['background','active','held']){const r=simulate(name);assert.equal(r.ok,true,name);assert.equal(r.skipped,true,name);assert.equal(r.sent,0,name);}});
test('Native Anti-AFK sends both simulated taps only for an idle foreground session',{skip:process.platform!=='win32'},()=>{const r=simulate('idle');assert.equal(r.ok,true);assert.equal(r.sent,2);});
test('Native Anti-AFK suppresses the second tap after focus or user activity changes',{skip:process.platform!=='win32'},()=>{for(const name of ['switch','human']){const r=simulate(name);assert.equal(r.ok,true,name);assert.equal(r.sent,1,name);}});
test('Native Anti-AFK fails closed when Windows idle time cannot be read',{skip:process.platform!=='win32'},()=>{const r=simulate('idleFailure');assert.equal(r.ok,false);assert.match(r.message,/idle time/);});
