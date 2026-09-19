'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { StudioService } = require('../src/services/studio-service');

test('StudioService accepts existing rbxl and rbxlx projects', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dragonstrap-studio-'));
  const project = path.join(dir, 'World.rbxlx');
  fs.writeFileSync(project, '<roblox/>');
  const result = new StudioService().validateProjectPath(project);
  assert.equal(result.ok, true);
  assert.equal(result.name, 'World.rbxlx');
});

test('StudioService rejects unsupported project extensions', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dragonstrap-studio-'));
  const project = path.join(dir, 'notes.txt');
  fs.writeFileSync(project, 'no');
  const result = new StudioService().validateProjectPath(project);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'UNSUPPORTED_PROJECT');
});
