'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const os=require('os');
const path=require('path');
const { ReliabilityService }=require('../src/services/reliability-service');

test('ReliabilityService detects an unclean previous session and writes sanitized logs',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dragonstrap-reliability-'));
  fs.writeFileSync(path.join(dir,'session-state.json'),JSON.stringify({cleanExit:false,version:'0.9.0'}));
  const service=new ReliabilityService(dir,{version:'0.9.5'});
  const state=service.initialize();
  assert.equal(state.previousSessionClean,false);
  service.log('info','test',{token:'do-not-log',message:'hello'});
  const log=fs.readFileSync(state.logPath,'utf8');
  assert.match(log,/hello/);
  assert.doesNotMatch(log,/do-not-log/);
  service.markCleanExit();
  const saved=JSON.parse(fs.readFileSync(path.join(dir,'session-state.json'),'utf8'));
  assert.equal(saved.cleanExit,true);
});
