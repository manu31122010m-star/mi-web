/* Conexión con YouTube: inicio de sesión de Google (un canal por hueco), YouTube Data API v3,
   subida de vídeos reanudable con progreso, miniaturas, listas, comentarios y búsqueda de virales. */
(function () {
  'use strict';
  const API = 'https://www.googleapis.com/youtube/v3/';
  const UP = 'https://www.googleapis.com/upload/youtube/v3/';
  const SCOPES = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/youtube.force-ssl'
  ].join(' ');
  const TK = 'canales.tok';

  const err = (code, message) => Object.assign(new Error(message), { code });

  // ---------- Google Identity Services ----------
  let gisLoading = null;
  function loadGIS() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (gisLoading) return gisLoading;
    gisLoading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => res();
      s.onerror = () => { gisLoading = null; rej(err('offline', 'No se pudo cargar el inicio de sesión de Google. Revisa tu conexión.')); };
      document.head.appendChild(s);
    });
    return gisLoading;
  }

  // ---------- tokens (uno por hueco de canal, caducan en 1 h) ----------
  function tokens() { try { return JSON.parse(localStorage.getItem(TK) || '{}'); } catch (e) { return {}; } }
  function setTok(slot, t) {
    const all = tokens();
    if (t) all[slot] = t; else delete all[slot];
    try { localStorage.setItem(TK, JSON.stringify(all)); } catch (e) { /* sin espacio */ }
  }
  function tokenFor(slot) { const t = tokens()[slot]; return t && t.exp > Date.now() + 30000 ? t.token : null; }
  function anyToken() { for (const s of [0, 1, 2]) { const t = tokenFor(s); if (t) return t; } return null; }

  function signIn(clientId, slot, hint) {
    if (!clientId) return Promise.reject(err('no_client', 'Falta el ID de cliente de Google. Ponlo en Ajustes → Conexión con YouTube.'));
    return loadGIS().then(() => new Promise((resolve, reject) => {
      let client;
      try {
        client = google.accounts.oauth2.initTokenClient({
          client_id: clientId.trim(),
          scope: SCOPES,
          prompt: 'select_account',
          hint: hint || undefined,
          callback: r => {
            if (r.error) return reject(err(r.error, r.error_description || 'Google no ha dado permiso.'));
            if (!google.accounts.oauth2.hasGrantedAllScopes(r, ...SCOPES.split(' '))) {
              // Funciona con lo concedido, pero avisa
              r._partial = true;
            }
            setTok(slot, { token: r.access_token, exp: Date.now() + (Number(r.expires_in) || 3600) * 1000 });
            resolve({ token: r.access_token, partial: !!r._partial });
          },
          error_callback: e => reject(err(e.type || 'popup', e.type === 'popup_closed' ? 'Has cerrado la ventana de Google.' : e.type === 'popup_failed_to_open' ? 'El navegador ha bloqueado la ventana de Google: permite las ventanas emergentes.' : 'No se pudo iniciar sesión con Google.'))
        });
      } catch (e) { return reject(err('client', 'El ID de cliente de Google no es válido.')); }
      client.requestAccessToken();
    }));
  }
  function signOut(slot) {
    const t = tokenFor(slot);
    setTok(slot, null);
    try { if (t && window.google && google.accounts) google.accounts.oauth2.revoke(t, () => {}); } catch (e) { /* ignorar */ }
  }

  // ---------- peticiones ----------
  let apiKey = '';
  function setKey(k) { apiKey = (k || '').trim(); }

  async function call(slot, path, params = {}, opt = {}) {
    const token = slot == null ? (anyToken()) : tokenFor(slot);
    const u = new URL((opt.base || API) + path);
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, v); });
    const headers = Object.assign({}, opt.headers || {});
    if (token) headers.Authorization = 'Bearer ' + token;
    else if (apiKey && !opt.auth) u.searchParams.set('key', apiKey);
    else throw err('auth', slot == null ? 'Inicia sesión en un canal o añade una clave de API en Ajustes.' : 'La sesión de este canal ha caducado. Vuelve a iniciar sesión.');
    let r;
    try { r = await fetch(u, { method: opt.method || 'GET', headers, body: opt.body }); }
    catch (e) { throw err('offline', 'Sin conexión con YouTube.'); }
    if (r.status === 204) return {};
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const reason = data.error && data.error.errors && data.error.errors[0] && data.error.errors[0].reason;
      if (r.status === 401) { if (slot != null) setTok(slot, null); throw err('auth', 'La sesión ha caducado. Vuelve a iniciar sesión en el canal.'); }
      if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') throw err('quota', 'Se ha gastado la cuota diaria de la API de YouTube (10.000 unidades). Se renueva a las 9:00 (hora de España).');
      if (reason === 'youtubeSignupRequired') throw err('nochannel', 'Esa cuenta de Google no tiene canal de YouTube.');
      if (reason === 'commentsDisabled') throw err('comments', 'Los comentarios están desactivados.');
      if (reason === 'insufficientPermissions' || r.status === 403 && /scope/i.test(JSON.stringify(data))) throw err('scope', 'Falta un permiso: vuelve a iniciar sesión y marca todas las casillas.');
      throw err(reason || 'http', (data.error && data.error.message) || ('Error ' + r.status));
    }
    return data;
  }

  // ISO 8601 → segundos
  function dur(iso) {
    const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '') || [];
    return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
  }
  const thumb = sn => { const t = (sn && sn.thumbnails) || {}; return (t.medium || t.high || t.default || {}).url || ''; };
  const n = v => Number(v || 0);

  function mapVideo(v) {
    const sn = v.snippet || {}, st = v.statistics || {}, cd = v.contentDetails || {};
    const secs = dur(cd.duration);
    return {
      id: v.id, title: sn.title || '', channelId: sn.channelId, channelTitle: sn.channelTitle || '', published: sn.publishedAt,
      thumb: thumb(sn), tags: sn.tags || [], desc: (sn.description || '').slice(0, 600), secs,
      short: secs > 0 && secs <= 180, views: n(st.viewCount), likes: n(st.likeCount), comments: n(st.commentCount),
      privacy: v.status && v.status.privacyStatus, publishAt: v.status && v.status.publishAt
    };
  }

  async function myChannel(slot) {
    const d = await call(slot, 'channels', { part: 'snippet,statistics,contentDetails,brandingSettings', mine: 'true' });
    const c = d.items && d.items[0];
    if (!c) throw err('nochannel', 'Esa cuenta no tiene canal de YouTube. Elige la cuenta o el canal de marca correcto.');
    return {
      id: c.id, title: c.snippet.title, handle: c.snippet.customUrl || '', thumb: thumb(c.snippet), country: c.snippet.country || '',
      desc: (c.snippet.description || '').slice(0, 500), keywords: (c.brandingSettings && c.brandingSettings.channel && c.brandingSettings.channel.keywords) || '',
      subs: n(c.statistics.subscriberCount), views: n(c.statistics.viewCount), videos: n(c.statistics.videoCount),
      hiddenSubs: !!c.statistics.hiddenSubscriberCount, uploads: c.contentDetails.relatedPlaylists.uploads
    };
  }

  async function videosByIds(slot, ids) {
    const out = [];
    for (let i = 0; i < ids.length; i += 50) {
      const d = await call(slot, 'videos', { part: 'snippet,statistics,contentDetails,status', id: ids.slice(i, i + 50).join(','), maxResults: 50 });
      out.push(...(d.items || []).map(mapVideo));
    }
    return out;
  }

  async function recentVideos(slot, uploads, max = 30) {
    const d = await call(slot, 'playlistItems', { part: 'contentDetails', playlistId: uploads, maxResults: Math.min(max, 50) });
    const ids = (d.items || []).map(i => i.contentDetails.videoId);
    if (!ids.length) return [];
    const vids = await videosByIds(slot, ids);
    return vids.sort((a, b) => (b.published || '').localeCompare(a.published || ''));
  }

  async function channelsByIds(slot, ids) {
    const out = {};
    for (let i = 0; i < ids.length; i += 50) {
      const d = await call(slot, 'channels', { part: 'snippet,statistics', id: ids.slice(i, i + 50).join(',') });
      (d.items || []).forEach(c => { out[c.id] = { id: c.id, title: c.snippet.title, thumb: thumb(c.snippet), handle: c.snippet.customUrl || '', subs: n(c.statistics.subscriberCount), videos: n(c.statistics.videoCount), views: n(c.statistics.viewCount) }; });
    }
    return out;
  }

  // Búsqueda de vídeos virales del nicho (search.list = 100 unidades de cuota)
  async function searchViral({ q, days = 30, region = 'ES', lang = 'es', kind = 'all', max = 25, order = 'viewCount' }) {
    const after = new Date(Date.now() - days * 86400000).toISOString();
    const d = await call(null, 'search', {
      part: 'snippet', q, type: 'video', order, publishedAfter: after, regionCode: region, relevanceLanguage: lang,
      maxResults: Math.min(max, 50), videoDuration: kind === 'short' ? 'short' : kind === 'long' ? 'medium' : undefined, safeSearch: 'none'
    });
    const ids = (d.items || []).map(i => i.id.videoId).filter(Boolean);
    if (!ids.length) return [];
    let vids = await videosByIds(null, ids);
    if (kind === 'short') vids = vids.filter(v => v.secs <= 180);
    if (kind === 'long') vids = vids.filter(v => v.secs > 180);
    const chans = await channelsByIds(null, [...new Set(vids.map(v => v.channelId))]);
    return vids.map(v => Object.assign(v, { ch: chans[v.channelId] || null }));
  }

  async function myPlaylists(slot) {
    const d = await call(slot, 'playlists', { part: 'snippet,contentDetails', mine: 'true', maxResults: 50 });
    return (d.items || []).map(p => ({ id: p.id, title: p.snippet.title, count: p.contentDetails.itemCount }));
  }
  function addToPlaylist(slot, playlistId, videoId) {
    return call(slot, 'playlistItems', { part: 'snippet' }, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } } }) });
  }

  async function comments(slot, channelId, max = 50) {
    const d = await call(slot, 'commentThreads', { part: 'snippet', allThreadsRelatedToChannelId: channelId, maxResults: max, order: 'time', textFormat: 'plainText' });
    return (d.items || []).map(t => {
      const c = t.snippet.topLevelComment.snippet;
      return { id: t.snippet.topLevelComment.id, threadId: t.id, videoId: t.snippet.videoId, author: c.authorDisplayName, authorChannel: c.authorChannelId && c.authorChannelId.value, avatar: c.authorProfileImageUrl, text: c.textDisplay || c.textOriginal || '', likes: c.likeCount, at: c.publishedAt, replies: t.snippet.totalReplyCount, mine: c.authorChannelId && c.authorChannelId.value === channelId };
    });
  }
  function reply(slot, parentId, text) {
    return call(slot, 'comments', { part: 'snippet' }, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ snippet: { parentId, textOriginal: text } }) });
  }

  function updateVideo(slot, video) {
    return call(slot, 'videos', { part: 'snippet' }, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(video) });
  }

  // Subida reanudable con progreso. meta = { title, description, tags, categoryId, privacy, publishAt, kids, lang }
  function upload(slot, file, meta, onProgress) {
    const token = tokenFor(slot);
    if (!token) return { promise: Promise.reject(err('auth', 'Inicia sesión en el canal antes de subir.')), abort() {} };
    let xhr = null, aborted = false;
    const body = {
      snippet: { title: meta.title, description: meta.description || '', tags: meta.tags || [], categoryId: meta.categoryId || '22', defaultLanguage: meta.lang || 'es', defaultAudioLanguage: meta.lang || 'es' },
      status: { privacyStatus: meta.publishAt ? 'private' : (meta.privacy || 'private'), selfDeclaredMadeForKids: !!meta.kids, embeddable: true }
    };
    if (meta.publishAt) body.status.publishAt = new Date(meta.publishAt).toISOString();
    const promise = (async () => {
      let r;
      try {
        r = await fetch(UP + 'videos?uploadType=resumable&part=snippet,status', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Length': String(file.size), 'X-Upload-Content-Type': file.type || 'video/*' },
          body: JSON.stringify(body)
        });
      } catch (e) { throw err('offline', 'Sin conexión con YouTube.'); }
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        const reason = d.error && d.error.errors && d.error.errors[0] && d.error.errors[0].reason;
        if (r.status === 401) { setTok(slot, null); throw err('auth', 'La sesión ha caducado. Vuelve a iniciar sesión.'); }
        if (reason === 'quotaExceeded') throw err('quota', 'Cuota diaria agotada (cada subida gasta 1.600 unidades).');
        if (reason === 'uploadLimitExceeded') throw err('limit', 'Has llegado al límite de subidas diarias de YouTube.');
        throw err(reason || 'http', (d.error && d.error.message) || 'YouTube ha rechazado la subida.');
      }
      const loc = r.headers.get('Location');
      if (!loc) throw err('http', 'YouTube no ha devuelto la dirección de subida.');
      if (aborted) throw err('cancelled', 'Subida cancelada.');
      return new Promise((resolve, reject) => {
        xhr = new XMLHttpRequest();
        xhr.open('PUT', loc);
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.setRequestHeader('Content-Type', file.type || 'video/*');
        xhr.upload.onprogress = e => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total, e.loaded, e.total); };
        xhr.onload = () => {
          let d = {};
          try { d = JSON.parse(xhr.responseText); } catch (e) { /* vacío */ }
          if (xhr.status >= 200 && xhr.status < 300 && d.id) resolve(d);
          else reject(err('http', (d.error && d.error.message) || 'La subida ha fallado (' + xhr.status + ').'));
        };
        xhr.onerror = () => reject(err('offline', 'Se ha cortado la conexión durante la subida.'));
        xhr.onabort = () => reject(err('cancelled', 'Subida cancelada.'));
        xhr.send(file);
      });
    })();
    return { promise, abort() { aborted = true; if (xhr) xhr.abort(); } };
  }

  async function setThumbnail(slot, videoId, file) {
    const token = tokenFor(slot);
    if (!token) throw err('auth', 'Sesión caducada.');
    const r = await fetch(UP + 'thumbnails/set?videoId=' + encodeURIComponent(videoId) + '&uploadType=media', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': file.type || 'image/jpeg' }, body: file });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw err('thumb', (d.error && d.error.message) || 'No se pudo poner la miniatura (el canal debe estar verificado por teléfono).');
    }
    return r.json();
  }

  window.YT = { signIn, signOut, tokenFor, anyToken, setKey, myChannel, recentVideos, videosByIds, channelsByIds, searchViral, myPlaylists, addToPlaylist, comments, reply, updateVideo, upload, setThumbnail, dur };
})();
