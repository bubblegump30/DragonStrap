'use strict';

const fs = require('fs');

function normalizeVersion(value) {
  const match = String(value || '').trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!match) return null;
  return { raw: `${match[1]}.${match[2]}.${match[3]}${match[4] ? `-${match[4]}` : ''}`, major:Number(match[1]), minor:Number(match[2]), patch:Number(match[3]), pre:match[4] || '' };
}

function compareVersions(a, b) {
  const av=normalizeVersion(a), bv=normalizeVersion(b);
  if (!av || !bv) return null;
  for (const key of ['major','minor','patch']) {
    if (av[key] !== bv[key]) return av[key] > bv[key] ? 1 : -1;
  }
  if (av.pre === bv.pre) return 0;
  if (!av.pre) return 1;
  if (!bv.pre) return -1;
  return av.pre.localeCompare(bv.pre, undefined, { numeric:true, sensitivity:'base' });
}

class UpdateService {
  constructor({ currentVersion, configPath, fetchImpl = globalThis.fetch, timeoutMs = 8000 }) {
    this.currentVersion = currentVersion;
    this.configPath = configPath;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.lastResult = null;
  }

  loadConfig() {
    let config={ provider:'github', repository:'', releaseChannel:'stable' };
    try {
      if (fs.existsSync(this.configPath)) {
        const parsed=JSON.parse(fs.readFileSync(this.configPath,'utf8'));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) config={...config,...parsed};
      }
    } catch {}
    const envRepo=String(process.env.DRAGONSTRAP_UPDATE_REPOSITORY || '').trim();
    if (envRepo) config.repository=envRepo;
    config.repository=typeof config.repository === 'string' ? config.repository.trim() : '';
    config.provider=config.provider === 'github' ? 'github' : 'github';
    config.releaseChannel=config.releaseChannel === 'prerelease' ? 'prerelease' : 'stable';
    return config;
  }

  getState(channel=null) {
    const config=this.loadConfig();
    const repositoryValid=/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repository);
    return {
      ok:true,
      configured:repositoryValid,
      provider:'github',
      repository:repositoryValid ? config.repository : '',
      channel:channel === 'prerelease' ? 'prerelease' : (channel === 'stable' ? 'stable' : config.releaseChannel),
      currentVersion:this.currentVersion,
      lastResult:this.lastResult
    };
  }

  async check(channel=null) {
    const state=this.getState(channel);
    if (!state.configured) {
      const result={...state,ok:false,code:'FEED_NOT_CONFIGURED',message:'The official DragonStrap release feed is not configured yet.',checkedAt:new Date().toISOString()};
      this.lastResult=result;
      return result;
    }
    if (typeof this.fetchImpl !== 'function') {
      const result={...state,ok:false,code:'NETWORK_UNAVAILABLE',message:'Update checks are unavailable in this runtime.',checkedAt:new Date().toISOString()};
      this.lastResult=result;
      return result;
    }

    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
    try {
      const endpoint=state.channel === 'prerelease'
        ? `https://api.github.com/repos/${state.repository}/releases?per_page=12`
        : `https://api.github.com/repos/${state.repository}/releases/latest`;
      const response=await this.fetchImpl(endpoint,{headers:{Accept:'application/vnd.github+json','User-Agent':`DragonStrap/${this.currentVersion}`},signal:controller.signal});
      if (!response.ok) {
        const code=response.status === 404 ? 'RELEASE_FEED_NOT_FOUND' : 'UPDATE_HTTP_ERROR';
        const result={...state,ok:false,code,message:`Update service returned HTTP ${response.status}.`,checkedAt:new Date().toISOString()};
        this.lastResult=result;
        return result;
      }
      let payload=await response.json();
      if (state.channel === 'prerelease') {
        if (!Array.isArray(payload)) payload=[];
        payload=payload.find(item=>item && item.draft !== true) || null;
      }
      if (!payload || payload.draft === true || !payload.tag_name) {
        const result={...state,ok:false,code:'NO_RELEASE',message:'No published DragonStrap release was found.',checkedAt:new Date().toISOString()};
        this.lastResult=result;
        return result;
      }
      const latestVersion=normalizeVersion(payload.tag_name)?.raw || String(payload.tag_name).replace(/^v/i,'');
      const comparison=compareVersions(latestVersion,this.currentVersion);
      if (comparison === null) {
        const result={...state,ok:false,code:'INVALID_RELEASE_VERSION',message:'The release feed returned an invalid version.',checkedAt:new Date().toISOString()};
        this.lastResult=result;
        return result;
      }
      const assets=Array.isArray(payload.assets) ? payload.assets.map(a=>({name:String(a.name||''),url:String(a.browser_download_url||''),size:Number(a.size||0)})) : [];
      const windowsAsset=assets.find(a=>/DragonStrap/i.test(a.name) && /\.(exe|zip)$/i.test(a.name)) || null;
      const checksumAsset=assets.find(a=>/sha256|checksums?/i.test(a.name)) || null;
      const releaseUrl=typeof payload.html_url === 'string' && /^https:\/\/github\.com\//i.test(payload.html_url) ? payload.html_url : `https://github.com/${state.repository}/releases`;
      const result={
        ...state,ok:true,checkedAt:new Date().toISOString(),latestVersion,updateAvailable:comparison>0,
        prerelease:Boolean(payload.prerelease),releaseName:String(payload.name||payload.tag_name),publishedAt:payload.published_at || null,
        releaseUrl,windowsAsset,checksumAsset
      };
      this.lastResult=result;
      return result;
    } catch (error) {
      const result={...state,ok:false,code:error?.name === 'AbortError' ? 'UPDATE_TIMEOUT' : 'UPDATE_NETWORK_ERROR',message:error?.name === 'AbortError' ? 'The update check timed out.' : 'DragonStrap could not reach the release feed.',checkedAt:new Date().toISOString()};
      this.lastResult=result;
      return result;
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports={ UpdateService, normalizeVersion, compareVersions };
