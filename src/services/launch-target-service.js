'use strict';

const ALLOWED_DEEPLINK_PARAMS = new Set([
  'placeId', 'gameInstanceId', 'accessCode', 'linkCode', 'launchData',
  'reservedServerAccessCode', 'joinAttemptId', 'joinAttemptOrigin',
  'callId', 'browserTrackerId', 'userId'
]);

function cleanInstanceId(value) {
  if (value == null || String(value).trim() === '') return null;
  const id = String(value).trim();
  return /^[A-Za-z0-9-]{6,128}$/.test(id) ? id : null;
}

function cleanPlaceId(value) {
  const id = String(value ?? '').trim();
  return /^[0-9]{1,20}$/.test(id) && id !== '0' ? id : null;
}

class LaunchTargetService {
  normalize(rawTarget, rawInstanceId) {
    const target = String(rawTarget ?? '').trim();
    const explicitInstanceId = String(rawInstanceId ?? '').trim();
    if (explicitInstanceId && !cleanInstanceId(explicitInstanceId)) {
      return { ok: false, code: 'INVALID_INSTANCE_ID', message: 'Game Instance ID contains unsupported characters.' };
    }

    if (!target) {
      if (explicitInstanceId) {
        return { ok: false, code: 'PLACE_ID_REQUIRED', message: 'A Place ID is required when a Game Instance ID is supplied.' };
      }
      return { ok: true, kind: 'app', label: 'Roblox App', uri: null, placeId: null, gameInstanceId: null };
    }

    const numericPlaceId = cleanPlaceId(target);
    if (numericPlaceId) return this.#buildExperience(numericPlaceId, explicitInstanceId || null);

    let url;
    try { url = new URL(target); }
    catch {
      return { ok: false, code: 'INVALID_TARGET', message: 'Enter a Place ID, Roblox game URL, or Roblox experience deep link.' };
    }

    if (url.protocol === 'https:' || url.protocol === 'http:') {
      const host = url.hostname.toLowerCase();
      if (host !== 'roblox.com' && host !== 'www.roblox.com') {
        return { ok: false, code: 'UNSUPPORTED_HOST', message: 'Only roblox.com game URLs are accepted.' };
      }

      const gameMatch = url.pathname.match(/^\/games\/(\d+)(?:\/|$)/i);
      const startMatch = url.pathname.toLowerCase() === '/games/start';
      const placeId = cleanPlaceId(gameMatch?.[1] || (startMatch ? url.searchParams.get('placeId') : null));
      if (!placeId) {
        return { ok: false, code: 'PLACE_ID_NOT_FOUND', message: 'No Roblox Place ID was found in that URL.' };
      }
      const instanceId = explicitInstanceId || cleanInstanceId(url.searchParams.get('gameInstanceId'));
      return this.#buildExperience(placeId, instanceId);
    }

    if (url.protocol === 'roblox:') {
      const isExperience = url.hostname.toLowerCase() === 'experiences' && url.pathname.toLowerCase() === '/start';
      if (!isExperience) {
        return { ok: false, code: 'UNSUPPORTED_DEEPLINK', message: 'Only roblox://experiences/start deep links are accepted in this release.' };
      }

      const placeId = cleanPlaceId(url.searchParams.get('placeId') || url.searchParams.get('id'));
      if (!placeId) {
        return { ok: false, code: 'PLACE_ID_NOT_FOUND', message: 'The Roblox deep link does not contain a valid Place ID.' };
      }

      const params = new URLSearchParams();
      for (const [key, value] of url.searchParams.entries()) {
        if (ALLOWED_DEEPLINK_PARAMS.has(key) && value) params.set(key, value);
      }
      params.set('placeId', placeId);
      if (explicitInstanceId) params.set('gameInstanceId', explicitInstanceId);

      return {
        ok: true,
        kind: params.get('gameInstanceId') ? 'server' : 'experience',
        label: params.get('gameInstanceId') ? `Place ${placeId} · specific server` : `Place ${placeId}`,
        uri: `roblox://experiences/start?${params.toString()}`,
        placeId,
        gameInstanceId: params.get('gameInstanceId') || null
      };
    }

    return { ok: false, code: 'UNSUPPORTED_PROTOCOL', message: 'That link type is not supported by DragonStrap Launch Center.' };
  }

  #buildExperience(placeId, gameInstanceId) {
    const params = new URLSearchParams({ placeId });
    if (gameInstanceId) params.set('gameInstanceId', gameInstanceId);
    return {
      ok: true,
      kind: gameInstanceId ? 'server' : 'experience',
      label: gameInstanceId ? `Place ${placeId} · specific server` : `Place ${placeId}`,
      uri: `roblox://experiences/start?${params.toString()}`,
      placeId,
      gameInstanceId: gameInstanceId || null
    };
  }
}

module.exports = { LaunchTargetService, cleanPlaceId, cleanInstanceId };
