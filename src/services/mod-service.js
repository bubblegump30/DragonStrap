'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const MAX_BYTES = 8 * 1024 * 1024;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const ID = /^[a-f0-9-]{36}$/;

function assetPath(value) {
  if (typeof value !== 'string' || value.length > 240 || /[\\:\x00-\x1f]/.test(value)) throw new Error('Use a relative content path with forward slashes.');
  const parts = value.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(p))) throw new Error('Invalid asset path.');
  if (!/^content\/(sounds\/.+\.(ogg|mp3|wav)|textures\/.+\.(png|jpg|jpeg|dds)|fonts\/.+\.(ttf|otf))$/i.test(value)) throw new Error('Only sound, texture and font assets under content are supported.');
  return parts.join('/');
}

// Every path component must be an ordinary, existing file/directory. No junctions.
function ordinary(file, directory = false) {
  const absolute = path.resolve(file), parsed = path.parse(absolute);
  let current = parsed.root;
  for (const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error('Linked paths are not supported for Mods.');
  }
  const stat = fs.lstatSync(absolute);
  if (directory ? !stat.isDirectory() : !stat.isFile()) throw new Error('Expected an ordinary ' + (directory ? 'folder.' : 'file.'));
  return absolute;
}
function readAsset(file) {
  ordinary(file);
  const stat = fs.statSync(file);
  if (!stat.size || stat.size > MAX_BYTES) throw new Error('Assets must be between 1 byte and 8 MB.');
  return fs.readFileSync(file);
}
function atomicJson(file, data) {
  ordinary(path.dirname(file),true);
  const temporary = file + '.' + crypto.randomUUID() + '.tmp';
  try { fs.writeFileSync(temporary, JSON.stringify(data), { flag:'wx' }); fs.renameSync(temporary, file); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function decode(value, expected) {
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_BYTES / 3) * 4) throw new Error('Invalid asset backup.');
  const bytes = Buffer.from(value, 'base64');
  if (!bytes.length || bytes.length > MAX_BYTES || hash(bytes) !== expected || bytes.toString('base64') !== value) throw new Error('Asset backup checksum mismatch.');
  return bytes;
}

class ModService {
  constructor({userData, versionsRoot}) {
    this.root = path.join(userData, 'mods');
    this.versionsRoot = path.resolve(versionsRoot);
    this.review = null;
    fs.mkdirSync(this.root, {recursive:true});
    ordinary(this.root, true);
  }
  json(name) {
    ordinary(this.root,true);
    const file = path.join(this.root, name);
    if (!fs.existsSync(file)) return null;
    ordinary(file);
    if (fs.statSync(file).size > MAX_BYTES * 3) throw new Error('Mods metadata exceeds its size limit.');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  library() {
    const library = this.json('library.json') || [];
    if (!Array.isArray(library) || library.length > 16) throw new Error('Invalid Mods library; existing files were preserved.');
    for (const mod of library) {
      if (!ID.test(mod.id) || typeof mod.name !== 'string' || mod.name.length > 80) throw new Error('Invalid Mods library.');
      assetPath(mod.target); decode(mod.bytes, mod.hash);
    }
    return library;
  }
  state() {
    const active = this.json('active.json');
    return {mods:this.library().map(({bytes,...mod}) => mod), active:active ? {name:String(active.name || 'Asset mod'), target:active.target, version:active.version, recoveryPending:true} : null};
  }
  import(file, target, name) {
    target = assetPath(target);
    if (path.extname(file).toLowerCase() !== path.posix.extname(target).toLowerCase()) throw new Error('Replacement and target file extensions must match.');
    name = String(name || path.basename(file)).trim();
    if (!name || name.length > 80 || /[\x00-\x1f]/.test(name)) throw new Error('Use a mod name between 1 and 80 characters.');
    const library = this.library();
    if (library.length >= 16) throw new Error('The local library supports up to 16 assets.');
    const bytes = readAsset(file);
    if (library.reduce((total,mod)=>total+mod.size,0) + bytes.length > 16 * 1024 * 1024) throw new Error('The library supports up to 16 MB of assets in total.');
    library.push({id:crypto.randomUUID(),name,target,hash:hash(bytes),size:bytes.length,bytes:bytes.toString('base64')});
    atomicJson(path.join(this.root,'library.json'),library);
    this.review = null;
    return this.state();
  }
  remove(id) {
    const library = this.library();
    if (this.json('active.json')?.id === id) throw new Error('Restore the active mod before removing it.');
    if (!library.some(mod => mod.id === id)) throw new Error('Mod not found.');
    atomicJson(path.join(this.root,'library.json'),library.filter(mod => mod.id !== id));
    this.review = null;
    return this.state();
  }
  destination(version, target) {
    if (typeof version !== 'string' || !/^version-[a-zA-Z0-9-]+$/.test(version)) throw new Error('Invalid Player version.');
    assetPath(target);
    const folder = path.join(this.versionsRoot,version);
    ordinary(folder,true);
    ordinary(path.join(folder,'RobloxPlayerBeta.exe'));
    if (fs.existsSync(path.join(folder,'RobloxStudioBeta.exe'))) throw new Error('Mods cannot target a shared Player/Studio installation.');
    return ordinary(path.join(folder,...target.split('/')));
  }
  plan(id, status) {
    if (this.json('active.json')) throw new Error('Restore the current mod before applying another.');
    const mod = this.library().find(m => m.id === id);
    if (!mod) throw new Error('Mod not found.');
    const destination = this.destination(status?.version, mod.target);
    if (path.resolve(status?.playerPath || '') !== path.join(this.versionsRoot,status.version,'RobloxPlayerBeta.exe')) throw new Error('Player detection changed; scan again.');
    const original = readAsset(destination);
    if (hash(original) === mod.hash) throw new Error('The selected asset already matches this replacement.');
    this.review = {token:crypto.randomUUID(),id,version:status.version,target:mod.target,originalHash:hash(original),modHash:mod.hash,expires:Date.now()+300000};
    return {...this.review,name:mod.name,size:mod.size,destination};
  }
  apply(token, status) {
    const review = this.review; this.review = null;
    if (!review || token !== review.token || Date.now() > review.expires) throw new Error('Preview this mod again before applying.');
    if (this.json('active.json') || status?.version !== review.version) throw new Error('The installation or active mod changed. Preview again.');
    const mod = this.library().find(m => m.id === review.id);
    if (!mod || mod.hash !== review.modHash) throw new Error('The library changed. Preview again.');
    const destination = this.destination(review.version,review.target), original = readAsset(destination);
    if (hash(original) !== review.originalHash) throw new Error('The target changed since preview; nothing was written.');
    const replacement = decode(mod.bytes, mod.hash);
    // Persist originals first. An interrupted/failed write leaves an explicit restore record.
    atomicJson(path.join(this.root,'active.json'),{id:mod.id,name:mod.name,version:review.version,target:review.target,original:original.toString('base64'),originalHash:review.originalHash,modHash:mod.hash});
    this.replace(destination,replacement);
    return this.state();
  }
  replace(destination, bytes) {
    ordinary(destination);
    const temporary = destination + '.dragonstrap-' + crypto.randomUUID() + '.tmp';
    try { fs.writeFileSync(temporary,bytes,{flag:'wx'}); ordinary(destination); fs.renameSync(temporary,destination); }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
  restore() {
    const active = this.json('active.json');
    if (!active) throw new Error('No active mod to restore.');
    const original = decode(active.original,active.originalHash);
    const destination = this.destination(active.version,active.target), currentHash = hash(readAsset(destination));
    if (currentHash !== active.modHash && currentHash !== active.originalHash) throw new Error('The asset was changed by another program. Restore was stopped to preserve that change and the backup.');
    if (currentHash !== active.originalHash) this.replace(destination,original);
    fs.unlinkSync(path.join(this.root,'active.json'));
    this.review = null;
    return this.state();
  }
}
module.exports = {ModService, assetPath};
