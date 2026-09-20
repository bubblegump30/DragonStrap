'use strict';

const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const MAX_PRESETS=30;
const MAX_FLAGS_PER_PRESET=1000;
const SHARE_SCHEMA='dragonstrap.fastflag-preset.v1';

class FastFlagPresetStore {
  constructor(userDataDir, fsImpl=fs) {
    this.fs=fsImpl;
    this.filePath=path.join(userDataDir,'fastflag-presets.json');
    this.items=[];
    this.#load();
  }

  list(){ return this.items.map(({flags,...meta})=>({...meta,flagCount:Object.keys(flags).length})); }
  get(id){ const item=this.items.find(x=>x.id===id); return item ? JSON.parse(JSON.stringify(item)) : null; }

  save(name,flags,metadata={}){
    const cleanName=typeof name==='string' ? name.trim().slice(0,60) : '';
    if (!cleanName) throw new TypeError('Preset name is required.');
    if (!flags || typeof flags!=='object' || Array.isArray(flags)) throw new TypeError('Preset flags must be an object.');
    const keys=Object.keys(flags);
    if (keys.length>MAX_FLAGS_PER_PRESET) throw new RangeError(`Presets are limited to ${MAX_FLAGS_PER_PRESET} flags.`);
    if (this.items.length>=MAX_PRESETS) throw new RangeError(`DragonStrap supports up to ${MAX_PRESETS} FastFlag presets.`);
    const now=new Date().toISOString();
    const item={
      id:crypto.randomUUID(),name:cleanName,createdAt:now,updatedAt:now,
      shared:Boolean(metadata.shared),
      importedFrom:typeof metadata.importedFrom==='string' ? metadata.importedFrom.slice(0,120) : null,
      flags:{}
    };
    for (const [key,value] of Object.entries(flags)) item.flags[key]=String(value ?? '');
    this.items.unshift(item);
    this.#save();
    return this.get(item.id);
  }

  exportDocument(id, appVersion='') {
    const item=this.get(id);
    if (!item) return null;
    return {
      schema:SHARE_SCHEMA,
      product:'DragonStrap',
      exportedAt:new Date().toISOString(),
      exportedByVersion:String(appVersion || ''),
      preset:{ name:item.name, flags:{...item.flags} }
    };
  }

  parseSharedDocument(input) {
    if (!input || typeof input!=='object' || Array.isArray(input)) return {ok:false,code:'INVALID_SHARED_PRESET',message:'Shared preset must be a JSON object.'};
    if (input.schema!==SHARE_SCHEMA) return {ok:false,code:'UNSUPPORTED_PRESET_SCHEMA',message:`Expected shared preset schema ${SHARE_SCHEMA}.`};
    const name=typeof input.preset?.name==='string' ? input.preset.name.trim().slice(0,60) : '';
    const flags=input.preset?.flags;
    if (!name) return {ok:false,code:'INVALID_SHARED_PRESET',message:'Shared preset is missing a name.'};
    if (!flags || typeof flags!=='object' || Array.isArray(flags)) return {ok:false,code:'INVALID_SHARED_PRESET',message:'Shared preset flags must be a JSON object.'};
    if (Object.keys(flags).length>MAX_FLAGS_PER_PRESET) return {ok:false,code:'PRESET_TOO_LARGE',message:`Shared presets are limited to ${MAX_FLAGS_PER_PRESET} flags.`};
    return {ok:true,name,flags:{...flags},exportedAt:input.exportedAt || null,exportedByVersion:input.exportedByVersion || null};
  }

  delete(id){
    const before=this.items.length;
    this.items=this.items.filter(x=>x.id!==id);
    if (this.items.length!==before) this.#save();
    return {ok:true,deleted:this.items.length!==before,items:this.list()};
  }

  #load(){
    try{
      if(!this.fs.existsSync(this.filePath)) return;
      const raw=JSON.parse(this.fs.readFileSync(this.filePath,'utf8'));
      if(!Array.isArray(raw)) return;
      this.items=raw.filter(item=>item&&typeof item==='object'&&!Array.isArray(item)&&typeof item.id==='string'&&typeof item.name==='string'&&item.flags&&typeof item.flags==='object'&&!Array.isArray(item.flags)).slice(0,MAX_PRESETS);
    }catch{ this.items=[]; }
  }
  #save(){
    this.fs.mkdirSync(path.dirname(this.filePath),{recursive:true});
    const temp=`${this.filePath}.tmp`;
    this.fs.writeFileSync(temp,`${JSON.stringify(this.items,null,2)}\n`,'utf8');
    this.fs.renameSync(temp,this.filePath);
  }
}

module.exports={FastFlagPresetStore,SHARE_SCHEMA,MAX_PRESETS,MAX_FLAGS_PER_PRESET};
