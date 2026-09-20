'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');

test('Studio Center 2.0 exposes deployment, profiles, backups, and isolated FastFlag controls',()=>{
  const html=fs.readFileSync(path.join(root,'renderer/index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'renderer/app.js'),'utf8');
  for (const id of ['studioChannelInput','studioChannelCheckBtn','studioChannelSelectBtn','studioLaunchProfileSelect','studioAutoBackup','studioBackupRetention','studioFastFlagsToggle','studioFlagKey','studioFlagValue','studioFlagType','studioFlagSetBtn','studioFlagRestoreBtn','studioFastFlagList']) {
    assert.match(html,new RegExp(`id=["']${id}["']`));
  }
  assert.match(html,/STUDIO CENTER 2\.0/);
  assert.match(app,/backupStudioProject/);
  assert.match(app,/restoreStudioProjectCopy/);
  assert.match(app,/setStudioFastFlag/);
});
