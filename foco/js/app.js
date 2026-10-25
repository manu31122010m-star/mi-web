/* Foco — sesiones de concentración, apps de distracción con límites diarios y webs bloqueadas. Todo se guarda en el dispositivo. */
(function () {
  'use strict';
  const KEY = 'foco-app-v1';
  const VERSION = '1.0';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const pad2 = n => String(n).padStart(2, '0');
  const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
  const hhmm = t => { const d = new Date(t); return `${d.getHours()}:${pad2(d.getMinutes())}`; };
  const fmtMin = m => { m = Math.round(m); if (m < 60) return m + ' min'; const h = Math.floor(m / 60), r = m % 60; return h + ' h' + (r ? ' ' + r : ''); };
  const fmtClock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return (h ? h + ':' + pad2(m) : m) + ':' + pad2(s % 60); };
  const DURS = [15, 25, 45, 60, 90, 120, 180];
  const LIMITS = [5, 10, 15, 20, 30, 45, 60, 90, 120];
  const WARNS = [1, 5, 10, 15, 30];
  const COLORS = ['#7c3aed', '#2563eb', '#db2777', '#059669', '#ea580c', '#0891b2', '#ca8a04', '#4f46e5'];
  const ICON = {
    foco: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>',
    apps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="7" height="7" rx="2.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2.2"/></svg>',
    ajustes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'
  };

  // ---------- estado ----------
  const fresh = () => ({
    v: 1, dur: 90, strict: true, motivo: '', warns: [1, 10, 30],
    list: { instagram: { on: true, limit: 30 }, tiktok: { on: true, limit: 10 }, youtube: { on: true, limit: 45 } },
    custom: [], used: {}, sites: [], sitesOff: [], session: null, open: null, history: []
  });
  let S;
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  if (!S || !S.v) S = fresh();
  S = Object.assign(fresh(), S);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('No se pudo guardar'); } };

  const UI = { tab: location.hash.slice(1) || 'foco', q: '' };
  if (!['foco', 'apps', 'ajustes'].includes(UI.tab)) UI.tab = 'foco';

  // ---------- apps ----------
  const allApps = () => window.FOCO_APPS.concat(S.custom);
  const appOf = id => allApps().find(a => a.id === id);
  const cfg = id => S.list[id] || { on: false, limit: null };
  const setCfg = (id, patch) => { S.list[id] = Object.assign({}, cfg(id), patch); save(); };
  const byName = (a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  const myApps = () => allApps().filter(a => cfg(a.id).on).sort(byName);
  const usedToday = id => (S.used[dayKey()] || {})[id] || 0;
  const addUsed = (id, min) => { const k = dayKey(); S.used[k] = S.used[k] || {}; S.used[k][id] = Math.max(0, Math.round((S.used[k][id] || 0) + min)); pruneUsed(); save(); };
  const pruneUsed = () => { const keys = Object.keys(S.used).sort(); while (keys.length > 60) delete S.used[keys.shift()]; };
  const spent = id => { const l = cfg(id).limit; return !!l && usedToday(id) >= l; };
  const sessionOn = () => S.session && S.session.end > Date.now();
  const strictNow = () => S.strict && sessionOn();
  const icon = (a, cls = '') => `<div class="ico ${cls} ${[...a.glyph].length > 2 || /^[a-z]{3,}$/i.test(a.glyph) ? 'txt' : ''}" style="background:${a.bg}">${esc(a.glyph)}</div>`;
  const stack = (list, n = 6) => `<div class="stack">${list.slice(0, n).map(a => icon(a, 'sm')).join('')}</div>`;

  function blockedTitle(list) {
    if (!list.length) return 'Ninguna app todavía';
    const names = list.slice(0, 2).map(a => a.name);
    return names.join(', ') + (list.length > 2 ? ` y ${list.length - 2} más` : '');
  }

  // webs: las de las apps de tu lista más las añadidas, menos las quitadas
  const autoSites = () => [...new Set(myApps().flatMap(a => a.domains || []))];
  const allSites = () => [...new Set(autoSites().filter(d => !S.sitesOff.includes(d)).concat(S.sites))];

  // ---------- render ----------
  function render() {
    document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === UI.tab));
    $('#view').innerHTML = UI.tab === 'apps' ? viewApps() : UI.tab === 'ajustes' ? viewAjustes() : viewFoco();
    if (UI.tab === 'apps') { const i = $('#q'); if (i && UI.focusQ) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
    renderSession();
  }

  function viewFoco() {
    const mine = myApps(), limited = mine.filter(a => cfg(a.id).limit);
    const durLabel = fmtMin(S.dur);
    const today = S.history.filter(h => dayKey(h.start) === dayKey());
    const focusMin = today.reduce((s, h) => s + h.min, 0);
    return `
      <div class="hero"><div class="brain">🧠</div><h1>¿Nos concentramos?</h1><p>Elige cuánto tiempo. Hasta que acabe, tus apps de distracción quedan bloqueadas.</p></div>
      <div class="card">
        <div class="label">Duración</div>
        <div class="chips">${DURS.map(m => `<button class="chip ${S.dur === m ? 'on' : ''}" data-act="dur" data-v="${m}">${fmtMin(m)}</button>`).join('')}
          <button class="chip ${DURS.includes(S.dur) ? '' : 'on'}" data-act="durOther">${DURS.includes(S.dur) ? 'Otra' : fmtMin(S.dur)}</button></div>
        <div class="label" style="margin-top:22px">Se bloquean</div>
        <button class="blocks" data-act="tab" data-tab="apps">${mine.length ? stack(mine) : ''}
          <div class="grow"><b>${esc(blockedTitle(mine))}</b><span class="muted small">${mine.length ? `${mine.length} app${mine.length > 1 ? 's' : ''} · y sus webs en Chrome` : 'Toca para elegir qué te distrae'}</span></div><span class="chev">›</span></button>
        <button class="btn" data-act="start" ${mine.length ? '' : 'disabled'}>Empezar · ${durLabel}</button>
        <div class="lock">${ICON.lock}${S.strict ? 'Modo estricto: no se podrá parar antes de tiempo' : 'Podrás parar manteniendo pulsado'}</div>
      </div>
      <div class="card">
        <div class="hoy-h"><b>Hoy</b><span class="muted small">Límites diarios</span></div>
        ${limited.length ? limited.map(limRow).join('') : '<p class="muted">Ponle un límite diario a una app desde <b>Apps</b> y aquí verás cuánto te queda.</p>'}
      </div>
      ${today.length ? `<div class="stats">Hoy: ${today.length} sesi${today.length > 1 ? 'ones' : 'ón'} · ${fmtMin(focusMin)} de foco</div>` : ''}`;
  }

  function limRow(a) {
    const l = cfg(a.id).limit, u = usedToday(a.id), p = Math.min(100, u / l * 100);
    const cls = u >= l ? 'full' : p >= 80 ? 'warn' : '';
    return `<button class="lim" data-act="app" data-id="${a.id}">${icon(a)}<div class="grow">
      <div class="top"><span style="color:var(--text);font-size:18px">${esc(a.name)}</span><span>${fmtMin(u)} / ${fmtMin(l)}</span></div>
      <div class="bar ${cls}"><i style="width:${p}%"></i></div>${u >= l ? '<span class="pill">Bloqueada hasta mañana</span>' : ''}</div></button>`;
  }

  function appRow(a) {
    const c = cfg(a.id), u = usedToday(a.id);
    const lim = c.limit ? (u >= c.limit ? ' · <span class="red">límite gastado</span>' : ` · <span class="accent">límite ${fmtMin(c.limit)}</span>`) : '';
    return `<div class="app">${icon(a)}<div class="grow" data-act="app" data-id="${a.id}"><b>${esc(a.name)}</b><small>Hoy ${fmtMin(u)}${lim}</small></div>
      <button class="sw ${c.on ? 'on' : ''}" data-act="toggle" data-id="${a.id}" aria-label="Bloquear ${esc(a.name)}"></button></div>`;
  }

  function viewApps() {
    const q = norm(UI.q), match = a => !q || norm(a.name).includes(q);
    const mine = myApps().filter(match);
    const rest = allApps().filter(a => !cfg(a.id).on && match(a)).sort(byName);
    return `
      <h1>Apps</h1>
      <p class="sub">Marca las que te distraen y, si quieres, ponles un límite diario.</p>
      <div class="search"><label>${ICON.search}<input id="q" type="search" placeholder="Buscar app" value="${esc(UI.q)}" autocomplete="off"></label></div>
      <div class="sec">Mi lista</div>
      ${mine.length ? mine.map(appRow).join('') : `<p class="empty">${q ? 'Ninguna coincide.' : 'Activa las apps que te roban tiempo.'}</p>`}
      ${rest.length ? `<div class="sec" style="margin-top:28px">Suelen distraer</div>${rest.map(appRow).join('')}` : ''}
      <button class="btn ghost add" data-act="newApp">+ Añadir otra app${q ? ` «${esc(UI.q)}»` : ''}</button>`;
  }

  function permRow(ok, title, text, act) {
    return `<button class="perm" ${act ? `data-act="${act}"` : ''}><span class="check ${ok ? 'ok' : ''}"></span><span><b>${title}</b><small>${text}</small></span></button>`;
  }

  function viewAjustes() {
    const notif = 'Notification' in window && Notification.permission === 'granted';
    const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const auto = autoSites();
    return `
      <h1 style="margin-bottom:18px">Ajustes</h1>
      <div class="card">
        <div class="label">Tu motivo</div>
        <textarea id="motivo" rows="3" placeholder="¿Para qué quieres soltar el móvil?">${esc(S.motivo)}</textarea>
        <p class="note">Sale en la pantalla de bloqueo para recordártelo.</p>
      </div>
      <div class="card">
        <div class="label">Avisos antes de que se acabe un límite</div>
        <div class="chips">${WARNS.map(w => `<button class="chip ${S.warns.includes(w) ? 'on' : ''}" data-act="warn" data-v="${w}">${w} min</button>`).join('')}</div>
        <p class="note">Te llega una notificación (con vibración) cuando a una app con límite le queda ese tiempo. En la ficha de cada app puedes elegir otros.</p>
      </div>
      <div class="card">
        <div class="label">Webs bloqueadas en Chrome</div>
        <p class="note" style="margin:0 0 14px">En tus sesiones se bloquean las webs de las apps de tu lista y las que añadas aquí. Toca una para quitarla.</p>
        <div class="chips">${allSites().map(d => `<button class="chip site ${auto.includes(d) ? '' : 'custom'}" data-act="site" data-v="${esc(d)}">${esc(d)}</button>`).join('') || '<span class="muted">Ninguna todavía.</span>'}</div>
        ${S.sitesOff.length ? `<button class="chip site" style="margin-top:10px" data-act="sitesReset">Recuperar ${S.sitesOff.length} quitada${S.sitesOff.length > 1 ? 's' : ''}</button>` : ''}
        <form class="addsite" data-form="site"><input class="input" name="d" placeholder="ej.: marca.com" inputmode="url" autocapitalize="off"><button class="btn sm">Añadir</button></form>
        <button class="btn ghost" style="margin-top:12px" data-act="copySites">Copiar lista</button>
      </div>
      <div class="card">
        <div class="label">Permisos</div>
        ${permRow(notif, 'Notificaciones', 'Para avisarte de los límites, de cuándo sales durante una sesión y de cuándo termina.', notif ? '' : 'notif')}
        ${permRow('wakeLock' in navigator, 'Pantalla siempre encendida', 'Durante la sesión la pantalla no se apaga mientras Foco está abierta.')}
        ${permRow(installed, 'En la pantalla de inicio', installed ? 'Foco está instalada como app.' : 'Instálala para abrirla como una app más.', installed ? '' : 'install')}
        ${permRow(false, 'Bloqueo real de apps y webs', 'Una web no puede cerrar otras apps: actívalo en tu móvil en 2 minutos. Toca para ver cómo.', 'guide')}
      </div>
      <div class="card strict">
        <div class="label">Modo estricto</div>
        <div class="row"><div class="grow"><span class="${S.strict ? 'accent' : 'muted'}">${S.strict ? 'Activo' : 'Desactivado'}</span> · ${S.strict ? 'no hay vuelta atrás.' : 'puedes parar las sesiones.'}</div>
          <button class="sw ${S.strict ? 'on' : ''}" data-act="strict" aria-label="Modo estricto"></button></div>
        <ul><li>No se puede parar una sesión antes de tiempo.</li><li>Durante una sesión no puedes quitar apps de tu lista ni webs bloqueadas.</li><li>Un límite gastado no se puede subir ni quitar hasta mañana.</li></ul>
        <p class="note">¿Quieres desactivarlo? Solo se puede cuando no hay ninguna sesión en marcha.</p>
      </div>
      <div class="card">
        <div class="label">Copia de seguridad</div>
        <div class="btns" style="margin-top:0"><button class="btn ghost" data-act="export">Exportar</button><button class="btn ghost" data-act="import">Importar</button></div>
      </div>
      <div class="card">
        <div class="label">Versión</div>
        <p style="font-size:17px;margin:0">Foco 🧠 ${VERSION}</p>
        <p class="note">Foco mira solo si hay versión nueva al abrirse.</p>
        <button class="btn ghost" style="width:auto;display:inline-block;margin-top:12px;padding:12px 18px" data-act="update">Buscar actualizaciones</button>
      </div>
      <p class="foot">Foco 🧠 · gratis y sin anuncios</p>`;
  }

  // ---------- hojas ----------
  function sheet(html) {
    const el = $('#sheet');
    el.innerHTML = `<div class="sheet"><div class="grab"></div>${html}</div>`;
    el.hidden = false; document.body.classList.add('locked');
  }
  function closeSheet() { $('#sheet').hidden = true; $('#sheet').innerHTML = ''; UI.sheetApp = null; document.body.classList.remove('locked'); }

  function sheetApp(id) {
    const a = appOf(id); if (!a) return;
    UI.sheetApp = id;
    const c = cfg(id), u = usedToday(id), warns = c.warns || S.warns;
    sheet(`
      <div class="row">${icon(a, 'lg')}<div class="grow"><h2>${esc(a.name)}</h2><span class="muted">Hoy ${fmtMin(u)}${c.limit ? ` de ${fmtMin(c.limit)}` : ''}</span></div></div>
      <button class="btn" style="margin-top:18px" data-act="launch" data-id="${id}">Abrir ${esc(a.name)}</button>
      <p class="note center">Ábrela desde aquí: Foco cuenta el tiempo y te frena si está bloqueada.</p>
      <div class="row" style="margin-top:20px"><div class="grow"><b style="font-weight:400;font-size:16px">En mi lista</b><br><small class="muted">Se bloquea durante las sesiones</small></div>
        <button class="sw ${c.on ? 'on' : ''}" data-act="toggle" data-id="${id}"></button></div>
      <div class="label">Límite diario</div>
      <div class="chips"><button class="chip ${c.limit ? '' : 'on'}" data-act="limit" data-v="0">Sin límite</button>
        ${LIMITS.map(m => `<button class="chip ${c.limit === m ? 'on' : ''}" data-act="limit" data-v="${m}">${fmtMin(m)}</button>`).join('')}
        <button class="chip ${c.limit && !LIMITS.includes(c.limit) ? 'on' : ''}" data-act="limitOther">${c.limit && !LIMITS.includes(c.limit) ? fmtMin(c.limit) : 'Otro'}</button></div>
      ${c.limit ? `<div class="label">Avisos de esta app</div>
        <div class="chips">${WARNS.map(w => `<button class="chip ${warns.includes(w) ? 'on' : ''}" data-act="appWarn" data-id="${id}" data-v="${w}">${w} min</button>`).join('')}</div>` : ''}
      <div class="label">Tiempo de uso de hoy</div>
      <div class="stepper"><button data-act="used" data-v="-5">−5</button><b>${fmtMin(u)}</b><button data-act="used" data-v="5">+5</button><button data-act="used" data-v="15">+15</button></div>
      <p class="note">Si la usaste sin pasar por Foco, apúntalo aquí.</p>
      ${a.domains && a.domains.length ? `<div class="label">Sus webs</div><div class="chips">${a.domains.map(d => `<span class="chip site">${esc(d)}</span>`).join('')}</div>` : ''}
      ${S.custom.some(x => x.id === a.id) ? `<button class="btn danger" style="margin-top:22px" data-act="delApp" data-id="${id}">Eliminar app</button>` : ''}
      <button class="btn ghost" style="margin-top:12px" data-act="close">Hecho</button>`);
  }

  function sheetNewApp() {
    sheet(`<h2>Añadir app</h2>
      <form data-form="newApp">
        <div class="label">Nombre</div><input class="input" name="name" required value="${esc(UI.q)}" placeholder="ej.: Duolingo">
        <div class="label">Icono (un emoji, opcional)</div><input class="input" name="glyph" maxlength="4" placeholder="🎮">
        <div class="label">Web (opcional)</div><input class="input" name="domain" inputmode="url" autocapitalize="off" placeholder="ej.: duolingo.com">
        <div class="label">Paquete de Android (opcional)</div><input class="input" name="pkg" autocapitalize="off" placeholder="ej.: com.duolingo">
        <p class="note">Lo ves en la dirección de su ficha de Google Play (…?id=<b>com.duolingo</b>). Sirve para abrirla desde Foco.</p>
        <button class="btn" style="margin-top:18px">Añadir a mi lista</button>
      </form>`);
  }

  function sheetNumber(title, value, act) {
    sheet(`<h2>${title}</h2><form data-form="${act}"><div class="label">Minutos</div>
      <input class="input" name="m" type="number" min="1" max="720" inputmode="numeric" value="${value}" required>
      <button class="btn" style="margin-top:16px">Guardar</button></form>`);
    setTimeout(() => $('#sheet input').select(), 50);
  }

  function sheetGuide() {
    sheet(`<h2>Bloqueo real en tu móvil</h2>
      <p class="muted">Foco es una web: te organiza, cuenta y te frena cuando abres las apps desde aquí, pero quien puede cerrar otras apps es el sistema. Actívalo una vez con las mismas apps de tu lista:</p>
      <h3>Android (también Xiaomi)</h3>
      <ol><li><b>Ajustes → Bienestar digital y controles parentales → Modo Concentración</b>: marca tus apps de distracción. Añade el botón «Concentración» a los ajustes rápidos y actívalo al pulsar «Empezar» en Foco.</li>
        <li><b>Límites diarios</b>: en el panel de Bienestar digital toca cada app → <b>Temporizador</b> → pon el mismo límite que en Foco. Al gastarlo, la app se pausa hasta mañana.</li>
        <li><b>Webs</b>: en Bienestar digital activa <b>Mostrar sitios en el panel</b> (Chrome) y ponles temporizador. Usa «Copiar lista» en Ajustes para tenerlas a mano.</li>
        <li>Para que no puedas quitarlo tú mismo: pide a alguien que lo configure con <b>Google Family Link</b> y su PIN.</li></ol>
      <h3>iPhone</h3>
      <ol><li><b>Ajustes → Tiempo de uso → Límites de apps</b>: crea un límite por app con los mismos minutos.</li>
        <li><b>Ajustes → Concentración → +</b>: crea «Foco» y en Apps elige silenciar o, con Tiempo de uso, bloquear las de tu lista.</li>
        <li><b>Tiempo de uso → Contenido y privacidad → Contenido de la App Store → Contenido web → Limitar sitios web para adultos → Nunca permitir</b>: añade tus webs.</li>
        <li>Pon un <b>código de Tiempo de uso</b> que no sepas (que lo elija otra persona).</li></ol>
      <button class="btn ghost" style="margin-top:16px" data-act="close">Entendido</button>`);
  }

  // ---------- abrir apps (cuenta el tiempo al volver) ----------
  function launchUrl(a) {
    const isAndroid = /Android/i.test(navigator.userAgent);
    const web = a.domains && a.domains[0] ? 'https://' + a.domains[0] : '';
    if (isAndroid && a.pkg) {
      const fb = web || `https://play.google.com/store/apps/details?id=${a.pkg}`;
      return web || `intent://#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${a.pkg};S.browser_fallback_url=${encodeURIComponent(fb)};end`;
    }
    return web || (a.pkg ? `https://play.google.com/store/apps/details?id=${a.pkg}` : '');
  }

  function launch(id) {
    const a = appOf(id);
    if (sessionOn() && cfg(id).on) return showBlock(a, `Bloqueada hasta las ${hhmm(S.session.end)}`, 'Estás en una sesión de concentración.');
    if (spent(id)) return showBlock(a, 'Bloqueada hasta mañana', `Ya has gastado tu límite de ${fmtMin(cfg(id).limit)}.`);
    const url = launchUrl(a);
    if (!url) return toast('Ábrela desde tu móvil y apunta luego el tiempo aquí');
    S.open = { id, start: Date.now() }; save();
    scheduleWarns(id);
    closeSheet();
    location.href = url;
  }

  function settleOpen() {
    if (!S.open) return;
    const { id, start } = S.open; S.open = null;
    const min = Math.min(240, (Date.now() - start) / 60000);
    clearWarns();
    if (min >= 0.5) { addUsed(id, Math.max(1, min)); const a = appOf(id); if (a) toast(`${a.name}: +${fmtMin(Math.max(1, min))} hoy`); }
    save(); render();
  }

  let warnTimers = [];
  const clearWarns = () => { warnTimers.forEach(clearTimeout); warnTimers = []; };
  function scheduleWarns(id) {
    clearWarns();
    const c = cfg(id), a = appOf(id); if (!c.limit) return;
    const left = c.limit - usedToday(id);
    (c.warns || S.warns).filter(w => w < left).forEach(w => warnTimers.push(setTimeout(() => notify(`Te quedan ${w} min de ${a.name}`, 'Ve cerrando ya.'), (left - w) * 60000)));
    warnTimers.push(setTimeout(() => notify(`Límite de ${a.name} gastado`, S.motivo || 'Ciérrala, mañana más.'), left * 60000));
  }

  // ---------- sesión ----------
  let tick = null, wake = null, exitWarned = false;
  function start() {
    const apps = myApps().map(a => a.id);
    if (!apps.length) return toast('Primero elige qué apps te distraen');
    const now = Date.now();
    S.session = { start: now, end: now + S.dur * 60000, apps, exits: 0 };
    save();
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().then(render);
    document.documentElement.requestFullscreen?.().catch(() => {});
    render();
  }

  function finish(done) {
    const s = S.session; if (!s) return;
    const min = Math.round((Math.min(Date.now(), s.end) - s.start) / 60000);
    S.history.push({ start: s.start, min, done, exits: s.exits });
    if (S.history.length > 500) S.history = S.history.slice(-500);
    S.session = null; save();
    clearInterval(tick); tick = null; releaseWake();
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    if (done) { notify('¡Sesión terminada! 🧠', `${fmtMin(min)} de foco. Ya puedes usar tus apps.`); navigator.vibrate?.([200, 100, 200]); }
    render();
    if (done) toast(`Sesión completada · ${fmtMin(min)}`);
  }

  function renderSession() {
    const el = $('#session');
    if (!S.session) { el.hidden = true; el.innerHTML = ''; document.body.classList.remove('locked'); return; }
    if (S.session.end <= Date.now()) return finish(true);
    const s = S.session, apps = s.apps.map(appOf).filter(Boolean);
    el.hidden = false; document.body.classList.add('locked');
    el.innerHTML = `
      <div class="ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="#ffffff14" stroke-width="3"/>
        <circle id="arc" cx="50" cy="50" r="46" fill="none" stroke="url(#g)" stroke-width="3.4" stroke-linecap="round" pathLength="100" stroke-dasharray="100"/>
        <defs><linearGradient id="g"><stop offset="0" stop-color="#c4b5fd"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs></svg>
        <div class="in"><div class="brain">🧠</div><div class="clock" id="clock"></div></div></div>
      <h2>Concentrado hasta las ${hhmm(s.end)}</h2>
      <p class="muted">${apps.length} app${apps.length > 1 ? 's' : ''} y ${allSites().length} webs bloqueadas</p>
      ${stack(apps, 8)}
      ${S.motivo ? `<div class="motivo">${esc(S.motivo)}</div>` : ''}
      <p class="muted small" id="exits">${s.exits ? `Has salido ${s.exits} ${s.exits > 1 ? 'veces' : 'vez'}` : 'Deja el móvil y a lo tuyo.'}</p>
      ${S.strict ? `<div class="lock">${ICON.lock}Modo estricto: no se puede parar antes de tiempo</div>`
        : '<button class="btn ghost hold" id="hold"><i></i>Mantén pulsado para parar</button>'}`;
    updateClock();
    if (!tick) tick = setInterval(updateClock, 1000);
    getWake();
  }

  function updateClock() {
    const s = S.session; if (!s) return;
    const left = s.end - Date.now();
    if (left <= 0) return finish(true);
    const c = $('#clock'), arc = $('#arc');
    if (c) c.textContent = fmtClock(left);
    if (arc) arc.setAttribute('stroke-dashoffset', String(100 * (1 - left / (s.end - s.start))));
  }

  async function getWake() { try { if ('wakeLock' in navigator && !wake && document.visibilityState === 'visible') { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { wake = null; } }
  function releaseWake() { try { wake && wake.release(); } catch (e) { } wake = null; }

  function showBlock(a, title, why) {
    const el = $('#block');
    el.innerHTML = `<div class="brain" style="font-size:96px">🧠</div>${a ? icon(a, 'lg') : ''}
      <h2 style="margin-top:18px">${a ? esc(a.name) + ' está bloqueada' : 'Bloqueada'}</h2>
      <p class="accent">${esc(title)}</p><p class="muted">${esc(why)}</p>
      ${S.motivo ? `<div class="motivo">${esc(S.motivo)}</div>` : ''}
      <button class="btn" data-act="unblock">Volver</button>`;
    el.querySelector('.ico') && (el.querySelector('.ico').style.margin = '-30px auto 0');
    el.hidden = false; closeSheet(); document.body.classList.add('locked');
    navigator.vibrate?.(80);
  }

  // ---------- avisos ----------
  async function notify(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') { toast(title); return; }
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      const opts = { body, icon: 'icons/icon-192.png', badge: 'icons/favicon-32.png', vibrate: [200, 100, 200], tag: 'foco-' + title };
      if (reg) reg.showNotification(title, opts); else new Notification(title, opts);
    } catch (e) { toast(title); }
  }

  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }

  // ---------- acciones ----------
  function toggleApp(id) {
    const c = cfg(id);
    if (c.on && strictNow()) return toast('Modo estricto: no puedes quitarla durante la sesión');
    setCfg(id, { on: !c.on });
    if (sessionOn() && !c.on && !S.session.apps.includes(id)) { S.session.apps.push(id); save(); }
    if (UI.sheetApp === id) sheetApp(id);
    render();
  }

  function setLimit(id, m) {
    const c = cfg(id);
    if (S.strict && spent(id) && (!m || m > c.limit)) return toast('Modo estricto: el límite gastado no se puede subir hasta mañana');
    setCfg(id, { limit: m || null, on: m ? true : c.on });
    sheetApp(id); render();
  }

  const ACT = {
    tab: el => { closeSheet(); UI.tab = el.dataset.tab; history.replaceState(null, '', '#' + UI.tab); render(); scrollTo(0, 0); },
    dur: el => { S.dur = +el.dataset.v; save(); render(); },
    durOther: () => sheetNumber('Duración', S.dur, 'dur'),
    start,
    app: el => sheetApp(el.dataset.id),
    toggle: el => toggleApp(el.dataset.id),
    limit: el => setLimit(UI.sheetApp, +el.dataset.v),
    limitOther: () => { const id = UI.sheetApp; sheetNumber('Límite diario', cfg(id).limit || 20, 'limit'); UI.sheetApp = id; },
    appWarn: el => { const id = el.dataset.id, w = +el.dataset.v, c = cfg(id), list = (c.warns || S.warns).slice(); const i = list.indexOf(w); i < 0 ? list.push(w) : list.splice(i, 1); setCfg(id, { warns: list.sort((a, b) => a - b) }); sheetApp(id); },
    used: el => { const id = UI.sheetApp, v = +el.dataset.v; if (v < 0 && S.strict && spent(id)) return toast('Modo estricto: no se puede quitar tiempo a un límite gastado'); addUsed(id, v); sheetApp(id); render(); },
    launch: el => launch(el.dataset.id),
    delApp: el => { if (strictNow()) return toast('Modo estricto: espera a que acabe la sesión'); if (!confirm('¿Eliminar esta app?')) return; S.custom = S.custom.filter(a => a.id !== el.dataset.id); delete S.list[el.dataset.id]; save(); closeSheet(); render(); },
    newApp: sheetNewApp,
    close: closeSheet,
    unblock: () => { $('#block').hidden = true; $('#block').innerHTML = ''; document.body.classList.toggle('locked', !!S.session); },
    warn: el => { const w = +el.dataset.v, i = S.warns.indexOf(w); i < 0 ? S.warns.push(w) : S.warns.splice(i, 1); S.warns.sort((a, b) => a - b); save(); render(); },
    site: el => {
      const d = el.dataset.v;
      if (strictNow()) return toast('Modo estricto: no puedes quitar webs durante la sesión');
      if (S.sites.includes(d)) S.sites = S.sites.filter(x => x !== d); else S.sitesOff.push(d);
      save(); render();
    },
    sitesReset: () => { S.sitesOff = []; save(); render(); },
    copySites: () => { const t = allSites().join('\n'); navigator.clipboard?.writeText(t).then(() => toast('Lista copiada'), () => toast('No se pudo copiar')); },
    notif: () => { if (!('Notification' in window)) return toast('Este navegador no tiene notificaciones'); Notification.requestPermission().then(render); },
    install: () => { if (UI.installEv) { UI.installEv.prompt(); UI.installEv = null; } else toast('Android: menú ⋮ → Instalar aplicación · iPhone: Compartir → Añadir a pantalla de inicio'); },
    guide: sheetGuide,
    strict: () => { if (S.strict && sessionOn()) return toast('No se puede desactivar durante una sesión'); S.strict = !S.strict; save(); render(); },
    export: () => {
      const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `foco-${dayKey()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    import: () => {
      if (strictNow()) return toast('Modo estricto: espera a que acabe la sesión');
      const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/json,.json';
      i.onchange = () => { const f = i.files[0]; if (!f) return; f.text().then(t => { const d = JSON.parse(t); if (!d || !d.v) throw 0; S = Object.assign(fresh(), d); save(); render(); toast('Copia importada'); }).catch(() => toast('Ese archivo no es una copia de Foco')); };
      i.click();
    },
    update: async () => {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (!reg) return toast('Abre Foco por https para las actualizaciones');
      toast('Buscando…');
      await reg.update().catch(() => {});
      if (reg.installing || reg.waiting) { toast('Hay versión nueva: reiniciando…'); setTimeout(() => location.reload(), 1200); } else toast('Ya tienes la última versión');
    }
  };

  const FORMS = {
    dur: f => { S.dur = Math.max(1, Math.min(720, +f.m.value || 90)); save(); closeSheet(); render(); },
    limit: f => { const id = UI.sheetApp; setLimit(id, Math.max(1, Math.min(720, +f.m.value || 0))); },
    site: f => {
      const d = f.d.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
      if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) return toast('Escribe una web como marca.com');
      S.sitesOff = S.sitesOff.filter(x => x !== d);
      if (!allSites().includes(d)) S.sites.push(d);
      save(); render();
    },
    newApp: f => {
      const name = f.name.value.trim(); if (!name) return;
      const domain = f.domain.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
      const glyph = f.glyph.value.trim() || name[0].toUpperCase();
      const a = { id: uid(), name, glyph, bg: COLORS[S.custom.length % COLORS.length], pkg: f.pkg.value.trim(), domains: domain ? [domain] : [] };
      S.custom.push(a); S.list[a.id] = { on: true, limit: null };
      if (sessionOn()) S.session.apps.push(a.id);
      UI.q = ''; save(); render(); sheetApp(a.id);
    }
  };

  document.addEventListener('click', e => {
    if (e.target.id === 'sheet') return closeSheet();
    const el = e.target.closest('[data-act]'); if (!el) return;
    const fn = ACT[el.dataset.act]; if (fn) { e.preventDefault(); fn(el); }
  });
  document.addEventListener('submit', e => { const f = e.target, fn = FORMS[f.dataset.form]; if (fn) { e.preventDefault(); fn(f); } });
  document.addEventListener('input', e => {
    if (e.target.id === 'q') { UI.q = e.target.value; UI.focusQ = true; render(); }
    if (e.target.id === 'motivo') { S.motivo = e.target.value; save(); }
  });
  document.addEventListener('focusout', e => { if (e.target.id === 'q') UI.focusQ = false; });

  // mantener pulsado para parar (solo sin modo estricto)
  let holdT = null;
  document.addEventListener('pointerdown', e => {
    const h = e.target.closest('#hold'); if (!h) return;
    h.classList.add('go'); holdT = setTimeout(() => finish(false), 2000);
  });
  const cancelHold = () => { clearTimeout(holdT); holdT = null; const h = $('#hold'); h && h.classList.remove('go'); };
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => document.addEventListener(t, cancelHold));

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (sessionOn() && !S.open) {
        S.session.exits++; save();
        if (!exitWarned) notify('Vuelve a Foco 🧠', `Sesión en marcha hasta las ${hhmm(S.session.end)}.${S.motivo ? ' ' + S.motivo : ''}`);
        exitWarned = true;
      }
    } else {
      exitWarned = false;
      settleOpen();
      if (S.session) { getWake(); renderSession(); }
    }
  });
  window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (['foco', 'apps', 'ajustes'].includes(t) && t !== UI.tab) { UI.tab = t; render(); } });
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); UI.installEv = e; });

  // a medianoche se renuevan los límites
  let lastDay = dayKey();
  setInterval(() => { if (dayKey() !== lastDay) { lastDay = dayKey(); render(); } }, 30000);

  $('.nav').innerHTML = ['foco', 'apps', 'ajustes'].map(t => `<button data-act="tab" data-tab="${t}">${ICON[t]}${t[0].toUpperCase() + t.slice(1)}</button>`).join('');
  settleOpen();
  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').then(r => r.update().catch(() => {})).catch(() => {});
})();
