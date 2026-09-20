'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'renderer','index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'renderer','app.js'),'utf8');
const preload=fs.readFileSync(path.join(root,'preload.js'),'utf8');

test('Reliability & Recovery 2.0 exposes integrity, restore, update recovery and safe repair controls',()=>{
  for (const id of ['recoveryIntegrityBadge','maintenanceRollbackBtn','recoveryRestoreList','maintenanceCreateRestoreBtn','recoveryUpdateState','maintenanceRepairUpdateBtn','maintenanceSafeRepairBtn']) assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(html,/RELIABILITY &amp; RECOVERY 2\.0|RELIABILITY & RECOVERY 2\.0/);
  assert.match(app,/createConfigurationRestorePoint/);
  assert.match(app,/rollbackRobloxPlayer/);
  assert.match(app,/runSafeRepair/);
  assert.match(preload,/maintenance-create-restore-point/);
  assert.match(preload,/maintenance-safe-repair/);
});
