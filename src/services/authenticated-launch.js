'use strict';
const windowsPath=require('node:path').win32;

// Hand off the same complete protocol used by browser Play buttons. The installed
// protocol handler, rather than DragonStrap, selects the current Player command line.
function buildAuthenticatedProtocol({ticket,uri,placeId,trackerId,launchedAt}) {
 if(typeof ticket!=='string'||!ticket||/[\r\n]/.test(ticket))throw new Error('Invalid launch authorization.');
 if(!/^[1-9]\d{0,19}$/.test(String(placeId))||!/^\d+$/.test(String(trackerId))||!Number.isSafeInteger(launchedAt)||launchedAt<0)throw new Error('Invalid game launch target.');
 const target=new URL(uri);
 if(target.protocol!=='roblox:'||target.hostname!=='experiences'||target.pathname!=='/start'||target.searchParams.get('placeId')!==String(placeId))throw new Error('Saved game target does not match its Place ID.');
 const query=new URLSearchParams({request:'RequestGame',browserTrackerId:String(trackerId),placeId:String(placeId),isPlayTogetherGame:'false'});
 const job=target.searchParams.get('gameInstanceId');
 if(job){query.set('request','RequestGameJob');query.set('gameId',job);}
 for(const key of ['accessCode','linkCode'])if(target.searchParams.get(key)){query.set('request','RequestPrivateGame');query.set(key,target.searchParams.get(key));}
 const launcher=`https://assetgame.roblox.com/game/PlaceLauncher.ashx?${query}`;
 return `roblox-player:1+launchmode:play+gameinfo:${encodeURIComponent(ticket)}+launchtime:${launchedAt}+placelauncherurl:${encodeURIComponent(launcher)}+browsertrackerid:${trackerId}+robloxLocale:en_us+gameLocale:en_us+channel:+LaunchExp:InApp`;
}

function trustedPlayerPath(file,expectedPath,handlerPath){
 if(typeof file!=='string'||windowsPath.basename(file).toLowerCase()!=='robloxplayerbeta.exe')return false;
 const candidate=windowsPath.resolve(file).toLowerCase();
 if(expectedPath&&candidate===windowsPath.resolve(expectedPath).toLowerCase())return true;
 if(!handlerPath||windowsPath.extname(handlerPath).toLowerCase()!=='.exe')return false;
 const root=windowsPath.dirname(windowsPath.resolve(handlerPath));
 const relative=windowsPath.relative(root,windowsPath.resolve(file));
 return Boolean(relative)&&!relative.startsWith('..')&&!windowsPath.isAbsolute(relative);
}
module.exports={buildAuthenticatedProtocol,trustedPlayerPath};
