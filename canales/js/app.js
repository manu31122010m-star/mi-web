/* Canales — controla tus 3 canales de YouTube: panel, tablero de vídeos, subidas y agente de crecimiento */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const pad = n => String(n).padStart(2, '0');
  const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fmt = AGENT.fmt;
  const KEY = 'canales.v1';
  const COLORS = ['#ff3b5c', '#a26bff', '#22d3ee', '#ffb020', '#2ee59d', '#ff7ac6'];
  const STAGES = [
    ['idea', '💡 Idea'], ['guion', '✍️ Guion'], ['grabar', '🎥 Grabar'], ['editar', '✂️ Editar'], ['listo', '📦 Listo / programado'], ['publicado', '✅ Publicado']
  ];
  const TYPES = { largo: '🎬 Largo', short: '⚡ Short', directo: '🔴 Directo' };
  const CATS = { 22: 'Personas y blogs', 24: 'Entretenimiento', 20: 'Videojuegos', 27: 'Educación', 28: 'Ciencia y tecnología', 26: 'Consejos y estilo', 10: 'Música', 17: 'Deportes', 23: 'Comedia', 1: 'Cine y animación', 2: 'Motor', 15: 'Animales', 19: 'Viajes', 25: 'Noticias y política', 29: 'ONG y activismo' };
  const REGIONS = { ES: 'España', MX: 'México', AR: 'Argentina', CO: 'Colombia', CL: 'Chile', PE: 'Perú', US: 'Estados Unidos', GB: 'Reino Unido' };

  // ---------- estado ----------
  // Tus 3 canales (se rellenan solos: al iniciar sesión se comprueba que entras en el canal correcto)
  const MINE = [
    { name: 'Mundo Rarezas', handle: '@MundoRarezas', niche: 'curiosidades y datos curiosos', keywords: 'datos curiosos, curiosidades, sabías que, historia curiosa, inventos' },
    { name: 'IA de Novato a Pro', handle: '@IANovatoAPro', niche: 'Claude IA en español', keywords: 'Claude, inteligencia artificial, IA, trucos IA, ChatGPT' },
    { name: 'Luis: De Cero a Millonario', handle: '@LuisDeCeroAMillonario', niche: 'finanzas personales en historias', keywords: 'finanzas personales, ahorrar dinero, salir de deudas, fondo de emergencia, invertir' }
  ];
  const blankCh = i => ({ slot: i, color: COLORS[i], niche: MINE[i].niche, keywords: MINE[i].keywords, goal: 0, perWeek: 3, links: '', expect: MINE[i] });
  const DEF = () => ({
    settings: { clientId: '', apiKey: '', region: 'ES', lang: 'es', aiEngine: 'local', name: '' },
    channels: [0, 1, 2].map(blankCh), plan: [], viral: {}, missions: { day: '', done: {}, replies: {} },
    xp: 0, streak: 0, lastDone: '', chat: []
  });
  let S;
  try { S = Object.assign(DEF(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = DEF(); }
  S.settings = Object.assign(DEF().settings, S.settings);
  S.channels = [0, 1, 2].map(i => { const c = Object.assign(blankCh(i), (S.channels || [])[i] || {}); c.expect = MINE[i]; if (!c.niche) c.niche = MINE[i].niche; if (!c.keywords) c.keywords = MINE[i].keywords; return c; });
  S.missions = Object.assign({ day: '', done: {}, replies: {} }, S.missions);
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { // sin espacio: recorta lo menos importante
      S.chat = S.chat.slice(-10); Object.values(S.viral).forEach(v => { v.items = (v.items || []).slice(0, 15); });
      try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e2) { toast('⚠️ Memoria llena', 'Exporta una copia y borra datos antiguos.'); }
    }
  }
  YT.setKey(S.settings.apiKey);

  const UI = {
    view: 'inicio', planMode: 'board', planCh: -1, calMonth: dkey().slice(0, 7), calSel: dkey(),
    agentTab: 'misiones', agentCh: firstLive(), busy: {}, cm: {}, ideaTopic: '', ideaRes: null, titleTest: '',
    promoSlot: firstLive(), promoVid: '', chatDraft: '', up: null, uploading: null, playlists: {}
  };
  function firstLive() { const i = S.channels.findIndex(c => c.title); return i < 0 ? 0 : i; }
  const live = () => S.channels.filter(c => c.title);
  const chName = i => (S.channels[i] && S.channels[i].title) || (MINE[i] && MINE[i].name) || `Canal ${i + 1}`;
  const othersOf = slot => S.channels.filter((c, i) => i !== slot).map(c => c.title ? c : { title: c.expect.name, handle: c.expect.handle });
  const cc = i => `--cc:${(S.channels[i] && S.channels[i].color) || COLORS[i]}`;
  const connected = i => !!YT.tokenFor(i);
  const ro = c => !!(c && (c.demo || c.pub)); // ejemplo o datos públicos: no se puede subir ni responder
  const kws = ch => String(ch.keywords || ch.niche || '').split(',').map(s => s.trim()).filter(Boolean);

  // ---------- utilidades de interfaz ----------
  let toastT = null;
  function toast(title, sub) {
    const t = $('#toast');
    t.innerHTML = `<b>${esc(title)}</b>${sub ? `<span class="muted small">${esc(sub)}</span>` : ''}`;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 3200);
  }
  function openSheet(html) {
    const s = $('#sheet');
    s.innerHTML = `<div class="panel" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
    s.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeSheet() { const s = $('#sheet'); s.hidden = true; s.innerHTML = ''; document.body.style.overflow = ''; }
  const sheetHead = t => `<div class="head"><h3>${t}</h3><button class="icon-btn" data-act="closeSheet" aria-label="Cerrar">✕</button></div>`;
  function avatar(ch, size = '') {
    if (ch && ch.thumb) return `<img class="av" src="${esc(ch.thumb)}" alt="" referrerpolicy="no-referrer" ${size}>`;
    const l = ch && ch.title ? ch.title.trim()[0].toUpperCase() : (ch ? String(ch.slot + 1) : '?');
    return `<div class="av">${esc(l)}</div>`;
  }
  function spark(vals, color) {
    if (!vals || vals.length < 2) return '';
    const max = Math.max(...vals, 1), w = 84, h = 36;
    const pts = vals.map((v, i) => [i * (w / (vals.length - 1)), h - 3 - (v / max) * (h - 8)]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const id = 'g' + uid();
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${d} L${w} ${h} L0 ${h} Z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  const ago = iso => { const d = (Date.now() - new Date(iso).getTime()) / 1000; if (d < 3600) return `hace ${Math.max(1, Math.round(d / 60))} min`; if (d < 86400) return `hace ${Math.round(d / 3600)} h`; if (d < 86400 * 30) return `hace ${Math.round(d / 86400)} d`; if (d < 86400 * 365) return `hace ${Math.round(d / 86400 / 30)} meses`; return `hace ${Math.round(d / 86400 / 365)} años`; };
  const durTxt = s => s >= 3600 ? `${Math.floor(s / 3600)}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}` : `${Math.floor(s / 60)}:${pad(s % 60)}`;
  const fmtDate = k => { if (!k) return 'Sin fecha'; const [y, m, d] = k.split('-').map(Number); const dt = new Date(y, m - 1, d); const t = dkey(), tm = dkey(new Date(Date.now() + 86400000)); if (k === t) return 'Hoy'; if (k === tm) return 'Mañana'; return dt.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }); };
  const scoreCls = s => s >= 70 ? 'g' : s >= 45 ? 'm' : 'b';
  function mdLite(t) {
    const inline = x => esc(x).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
    const out = []; let list = null;
    for (const raw of String(t).split('\n')) {
      const line = raw.trimEnd();
      const li = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (li) { if (!list) { list = 'ul'; out.push('<ul>'); } out.push(`<li>${inline(li[1])}</li>`); continue; }
      if (list) { out.push('</ul>'); list = null; }
      if (line.trim()) out.push(`<p>${inline(line.replace(/^#+\s*/, ''))}</p>`);
    }
    if (list) out.push('</ul>');
    return out.join('');
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('📋 Copiado'); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('📋 Copiado'); } catch (e2) { toast('No se pudo copiar'); } ta.remove(); }
  }
  function errMsg(e) { return (e && e.message) || 'Algo ha fallado.'; }

  // ---------- XP, racha y misiones ----------
  function rollMissions() {
    const t = dkey();
    if (S.missions.day !== t) { S.missions = { day: t, done: {}, replies: {} }; save(); }
  }
  function addXP(n, why) {
    S.xp += n;
    const t = dkey(), y = dkey(new Date(Date.now() - 86400000));
    if (S.lastDone !== t) { S.streak = S.lastDone === y ? S.streak + 1 : 1; S.lastDone = t; }
    save();
    if (why) toast(`+${n} XP · ${why}`, `Racha: ${S.streak} día${S.streak === 1 ? '' : 's'} 🔥`);
  }
  const level = () => { let lv = 1, need = 100, xp = S.xp; while (xp >= need) { xp -= need; lv++; need = Math.round(need * 1.35); } return { lv, xp, need }; };
  function completeMission(id, silent) {
    rollMissions();
    if (S.missions.done[id]) return;
    const m = AGENT.missions(S.channels, S.plan, dkey()).find(x => x.id === id);
    S.missions.done[id] = true;
    addXP(m ? m.xp : 10, silent ? null : (m ? 'Misión completada' : ''));
  }

  // ---------- conexión con canales ----------
  async function connect(slot) {
    if (!S.settings.clientId) { toast('Falta configurar la conexión', 'Sigue la guía de Ajustes → Conexión con YouTube.'); go('ajustes'); return; }
    UI.busy['c' + slot] = true; render();
    try {
      const r = await YT.signIn(S.settings.clientId, slot);
      const info = await YT.myChannel(slot);
      const dup = S.channels.findIndex((c, i) => i !== slot && c.id === info.id);
      if (dup >= 0) { YT.signOut(slot); throw new Error(`Ese canal ya está en el hueco ${dup + 1}. Al iniciar sesión elige otro canal (o el canal de marca).`); }
      const ch = S.channels[slot];
      const exp = MINE[slot];
      if (!ch.id && exp && info.handle && info.handle.toLowerCase() !== exp.handle.toLowerCase() && !confirm(`Has entrado con «${info.title}» (${info.handle}), pero este hueco es para ${exp.name} (${exp.handle}). ¿Usarlo igualmente?`)) { YT.signOut(slot); throw new Error(`Vuelve a intentarlo y elige ${exp.name} en la ventana de Google.`); }
      if (ch.id && ch.id !== info.id && !confirm(`Has entrado con «${info.title}», no con «${ch.title}». ¿Sustituir el canal ${slot + 1}?`)) { YT.signOut(slot); throw new Error('Conexión cancelada.'); }
      if (ch.id !== info.id) { ch.recent = []; delete S.viral[slot]; }
      Object.assign(ch, info, { demo: false, pub: false });
      if (!ch.niche && info.keywords) ch.keywords = info.keywords.replace(/"/g, '').split(/\s+/).slice(0, 6).join(', ');
      save();
      toast(`✅ ${info.title} conectado`, r.partial ? 'Faltan permisos: algunas funciones no irán.' : 'Ya puedes subir vídeos y responder comentarios.');
      await refresh(slot, true);
      if (live().filter(c => !ro(c)).length === 1) completeMission('conectar', true);
    } catch (e) { toast('No se pudo conectar', errMsg(e)); }
    UI.busy['c' + slot] = false; render();
  }
  async function refresh(slot, quiet) {
    const ch = S.channels[slot];
    if (!ch.title || ro(ch)) return;
    if (!connected(slot)) { if (!quiet) toast('Sesión caducada', `Vuelve a entrar en ${ch.title} (las sesiones de Google duran 1 hora).`); return; }
    UI.busy['r' + slot] = true; render();
    try {
      const info = await YT.myChannel(slot);
      const recent = await YT.recentVideos(slot, info.uploads, 30);
      Object.assign(ch, info, { recent, fetchedAt: Date.now() });
      save();
      if (!quiet) toast('🔄 Datos actualizados', ch.title);
    } catch (e) { toast('No se pudo actualizar', errMsg(e)); }
    UI.busy['r' + slot] = false; render();
  }
  function disconnect(slot) {
    const ch = S.channels[slot];
    if (!confirm(`¿Desconectar ${ch.title || 'este canal'}? Se borran sus datos de la app (no se toca nada en YouTube).`)) return;
    YT.signOut(slot);
    const keep = { color: ch.color, niche: ch.niche, keywords: ch.keywords, goal: ch.goal, perWeek: ch.perWeek, links: ch.links };
    S.channels[slot] = Object.assign(blankCh(slot), keep);
    delete S.viral[slot];
    save(); render();
  }

  // ---------- datos de ejemplo ----------
  function loadDemo() {
    const now = Date.now();
    const mk = (titles, base) => titles.map((t, i) => {
      const f = [1, 0.6, 2.8, 0.9, 1.3, 0.4, 1.1, 0.7, 4.1, 0.8, 1.2, 0.5][i % 12];
      const short = i % 3 === 1;
      return { id: 'demo' + base + i, title: t, published: new Date(now - (i * 3.5 + 1) * 86400000 - (i % 4) * 3600000 * 3).toISOString(), thumb: '', views: Math.round(base * f), likes: Math.round(base * f * 0.045), comments: Math.round(base * f * 0.006), secs: short ? 45 : 540 + i * 40, short, tags: [] };
    });
    const demo = [
      { title: 'Ejemplo · Gaming', handle: '@ejemplo-gaming', subs: 18400, views: 2310000, videos: 214, niche: 'videojuegos', keywords: 'minecraft, fortnite, gameplay', recent: mk(['Sobreviví 100 días en hardcore', 'El truco que nadie usa', 'Construí una ciudad entera en 24 h', 'Reaccionando a vuestras bases', '7 secretos de la nueva actualización', 'Clip: la jugada más loca', 'Probé el mod más difícil', 'Short: speedrun', 'Me pasé el juego sin saltar', 'Top 5 errores de novato', 'Torneo con suscriptores', 'Short: fail épico'], 9200) },
      { title: 'Ejemplo · Cocina', handle: '@ejemplo-cocina', subs: 3200, views: 410000, videos: 96, niche: 'recetas fáciles', keywords: 'recetas, cocina fácil, airfryer', recent: mk(['Cena en 10 minutos con 3 ingredientes', 'Short: el huevo perfecto', 'Probé recetas virales de TikTok', 'Meal prep para toda la semana', 'Airfryer: 5 recetas que no conocías', 'Short: tortilla en 30 s', 'Postre sin horno', 'Pan casero sin amasar', 'Comida de 1 € al día durante una semana', 'Short: truco de cebolla'], 2600) },
      { title: 'Ejemplo · Vlogs', handle: '@ejemplo-vlogs', subs: 640, views: 52000, videos: 41, niche: 'vlogs de viajes', keywords: 'viajes, vlog, escapadas', recent: mk(['48 h en Lisboa con 100 €', 'Short: mirador secreto', 'Mi rutina de viaje', 'Lo que nadie te cuenta de viajar sola', 'Short: maleta en 1 minuto', 'Escapada rural de fin de semana', 'Vlog: primer día en Roma', 'Cómo encuentro vuelos baratos'], 900) }
    ];
    demo.forEach((d, i) => { if (!S.channels[i].title) { const { niche, keywords, ...rest } = d; S.channels[i] = Object.assign(S.channels[i], rest, { demo: true, id: 'demo' + i }); } });
    save(); toast('👀 Modo ejemplo', 'Son datos inventados para probar la app. Conecta tus canales cuando quieras.');
    render();
  }

  // =====================================================================
  // VISTA: INICIO
  // =====================================================================
  function chCard(ch, i) {
    if (!ch.title) {
      return `<div class="ch" style="${cc(i)}" data-act="connect" data-slot="${i}">
        <div class="av">＋</div><div class="info"><div class="name">${esc(chName(i))}</div><div class="meta">${esc(MINE[i].handle)} · toca para iniciar sesión</div></div>
        <span class="btn sm primary">${UI.busy['c' + i] ? 'Conectando…' : 'Conectar'}</span></div>`;
    }
    const vals = (ch.recent || []).slice(0, 12).reverse().map(v => v.views);
    const a = AGENT.analyze(ch);
    const exp = !ro(ch) && !connected(i);
    return `<div class="ch" style="${cc(i)}" data-act="chSheet" data-slot="${i}">
      ${avatar(ch)}
      <div class="info">
        <div class="name">${esc(ch.title)}</div>
        <div class="meta">${ch.demo ? '<span class="badge demo">Ejemplo</span> ' : ch.pub ? '<span class="badge ok">Público</span> ' : exp ? '<span class="badge">Sesión caducada</span> ' : ''}${esc(ch.handle || '')}</div>
        <div class="nums"><span><b>${ch.hiddenSubs ? '—' : fmt(ch.subs)}</b> <span class="muted">subs</span></span><span><b>${a ? fmt(a.median) : '—'}</b> <span class="muted">visitas/vídeo</span></span></div>
      </div>
      ${spark(vals, ch.color)}
    </div>`;
  }
  function viewInicio() {
    rollMissions();
    const L = live();
    const tot = L.reduce((a, c) => ({ subs: a.subs + (c.subs || 0), views: a.views + (c.views || 0), videos: a.videos + (c.videos || 0) }), { subs: 0, views: 0, videos: 0 });
    const lv = level();
    const ms = AGENT.missions(S.channels, S.plan, dkey());
    const doneN = ms.filter(m => S.missions.done[m.id]).length;
    const upcoming = S.plan.filter(p => p.stage !== 'publicado').sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')).slice(0, 5);
    const h = new Date().getHours();
    const hi = h < 6 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
    const insights = L.length ? AGENT.insights(S.channels[UI.agentCh] && S.channels[UI.agentCh].title ? S.channels[UI.agentCh] : L[0]).slice(0, 2) : [];
    return `
    <header class="top">
      <img class="logo" src="icons/icon-192.png" alt="">
      <div class="grow"><h1>${hi}${S.settings.name ? ', ' + esc(S.settings.name) : ''}</h1><div class="sub">Tus canales de YouTube en un solo sitio</div></div>
      <span class="chip-xp" title="Nivel y racha"><i>⚡</i>Nv ${lv.lv} · ${S.streak}🔥</span>
    </header>

    <section class="hero">
      <div class="lbl">Suscriptores totales</div>
      <div class="big">${L.length ? fmt(tot.subs) : '—'}</div>
      <div class="stats3">
        <div><b>${L.length ? fmt(tot.views) : '—'}</b><span>visualizaciones</span></div>
        <div><b>${L.length ? fmt(tot.videos) : '—'}</b><span>vídeos</span></div>
        <div><b>${L.length}/3</b><span>canales</span></div>
      </div>
      <div class="goal" style="position:relative;z-index:1"><div class="row small" style="justify-content:space-between;margin:12px 0 6px"><span class="muted">Nivel ${lv.lv} de creador</span><span class="xp">${lv.xp}/${lv.need} XP</span></div><div class="bar"><i style="width:${Math.round(100 * lv.xp / lv.need)}%"></i></div></div>
    </section>

    <div class="sec"><h2>Mis canales</h2>${L.length ? `<button class="link" data-act="refreshAll">🔄 Actualizar</button>` : ''}</div>
    <div class="chs">${S.channels.map(chCard).join('')}</div>
    ${!L.length ? `<div class="note">¿Quieres verla funcionando antes de conectar? <button class="btn sm" data-act="demo" style="margin-left:6px">👀 Ver con datos de ejemplo</button></div>` : ''}

    <div class="sec"><h2>Misiones de hoy</h2><button class="link" data-act="go" data-v="agente" data-tab="misiones">${doneN}/${ms.length} · Ver todas</button></div>
    <div class="card">${ms.slice(0, 3).map(missionRow).join('')}</div>

    ${insights.length ? `<div class="sec"><h2>El agente dice</h2><button class="link" data-act="go" data-v="agente" data-tab="chat">Hablar</button></div>
    <div class="card glow">${insights.map(t => `<div class="li"><div class="grow small">${mdLite(t)}</div></div>`).join('')}</div>` : ''}

    <div class="sec"><h2>Próximos vídeos</h2><button class="link" data-act="newPlan">＋ Nuevo</button></div>
    <div class="card">${upcoming.length ? upcoming.map(p => `<div class="li" data-act="editPlan" data-id="${p.id}" style="cursor:pointer;${cc(p.ch)}"><span class="dot"></span><div class="grow"><div class="t ell">${esc(p.title)}</div><div class="s">${fmtDate(p.date)}${p.time ? ' · ' + p.time : ''} · ${esc(chName(p.ch))} · ${TYPES[p.type] || ''}</div></div><span class="badge">${STAGES.find(s => s[0] === p.stage)[1]}</span></div>`).join('') : `<div class="empty"><div class="e">🗓️</div>Aún no hay vídeos planificados.<br><button class="btn sm primary" data-act="newPlan" style="margin-top:10px">＋ Planificar un vídeo</button></div>`}</div>

    ${L.length ? `<div class="sec"><h2>Objetivos</h2></div><div class="card">${S.channels.map((c, i) => {
      if (!c.title) return '';
      const m = AGENT.nextMilestone(c.subs || 0);
      const goal = c.goal > (c.subs || 0) ? c.goal : m.next;
      const pct = c.goal > (c.subs || 0) ? (c.subs || 0) / c.goal : m.pct;
      return `<div class="li" style="${cc(i)}"><div class="grow"><div class="row small" style="justify-content:space-between"><b>${esc(c.title)}</b><span class="muted">${fmt(c.subs)} / ${fmt(goal)}</span></div><div class="bar cc" style="margin-top:7px"><i style="width:${Math.max(2, Math.round(pct * 100))}%"></i></div></div></div>`;
    }).join('')}</div>` : ''}
    `;
  }
  function missionRow(m) {
    const done = !!S.missions.done[m.id];
    return `<div class="li mission ${done ? 'done' : ''}">
      <button class="check ${done ? 'on' : ''}" data-act="mission" data-id="${m.id}" aria-label="Completar">✓</button>
      <div class="grow"><div class="t small">${esc(m.text)}</div></div>
      ${done ? `<span class="xp">+${m.xp}</span>` : `<button class="btn sm" data-act="missionGo" data-id="${m.id}">Hacer</button>`}
    </div>`;
  }
  function chSheet(i) {
    const ch = S.channels[i];
    const a = AGENT.analyze(ch);
    const exp = !ro(ch) && !connected(i);
    openSheet(`${sheetHead(esc(ch.title))}
      <div class="row" style="${cc(i)};gap:12px;margin:6px 0 12px">${avatar(ch)}<div class="grow"><div class="muted small">${esc(ch.handle || '')}${ch.demo ? ' · <span class="badge demo">Ejemplo</span>' : ch.pub ? ` · <span class="badge ok">Datos públicos · ${esc(PUB_AT)}</span>` : ''}</div><div><b>${fmt(ch.subs)}</b> subs · <b>${fmt(ch.views)}</b> visitas · <b>${ch.videos || 0}</b> vídeos</div></div></div>
      ${a ? `<div class="stats3" style="margin:0 0 6px"><div><b>${fmt(a.median)}</b><span>visitas/vídeo</span></div><div><b>${a.perWeek.toFixed(1)}</b><span>vídeos/semana</span></div><div><b>${a.bestDay ? a.bestDay.slice(0, 3) + (a.bestHour != null ? ' ' + a.bestHour + 'h' : '') : '—'}</b><span>mejor momento</span></div></div>` : ''}
      <div class="sec" style="margin-top:14px"><h2>Consejos del agente</h2></div>
      <div class="card">${AGENT.insights(ch).map(t => `<div class="li small"><div class="grow">${mdLite(t)}</div></div>`).join('')}</div>
      <div class="sec"><h2>Últimos vídeos</h2></div>
      <div class="card">${(ch.recent || []).slice(0, 8).map(v => vidRow(v, i, a)).join('') || '<div class="empty">Sin vídeos todavía.</div>'}</div>
      <div class="foot">
        ${ch.pub ? `<a class="btn" href="https://www.youtube.com/${esc(ch.handle)}" target="_blank" rel="noopener">Ver canal ↗</a><button class="btn primary" data-act="connect" data-slot="${i}">🔑 Iniciar sesión</button>` : ch.demo ? `<button class="btn primary" data-act="connect" data-slot="${i}">Conectar mi canal aquí</button>` : exp ? `<button class="btn primary" data-act="connect" data-slot="${i}">🔑 Volver a entrar</button>` : `<button class="btn" data-act="refresh" data-slot="${i}">${UI.busy['r' + i] ? 'Actualizando…' : '🔄 Actualizar'}</button><a class="btn" href="https://studio.youtube.com/channel/${esc(ch.id)}" target="_blank" rel="noopener">YouTube Studio ↗</a>`}
      </div>`);
  }
  function vidRow(v, slot, a) {
    const hot = a && a.median && v.views >= a.median * 2;
    const low = a && a.median && v.views < a.median * 0.45;
    return `<div class="vid">
      <a class="th" href="${v.id.startsWith('demo') ? '#' : 'https://youtu.be/' + esc(v.id)}" target="_blank" rel="noopener">${v.thumb ? `<img src="${esc(v.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<div class="sk" style="width:100%;height:100%"></div>'}<span class="dur">${v.short ? 'Short' : durTxt(v.secs || 0)}</span></a>
      <div class="grow" style="min-width:0"><div class="t">${esc(v.title)}</div><div class="s">${fmt(v.views)} visitas · ${ago(v.published)}${v.privacy && v.privacy !== 'public' ? ' · ' + (v.publishAt ? '⏰ programado' : v.privacy === 'unlisted' ? 'oculto' : 'privado') : ''}</div>
        <div class="kpis">${hot ? '<span class="badge hot">🔥 Por encima de tu media</span>' : ''}${low ? '<span class="badge">📉 Por debajo</span>' : ''}<span class="badge">👍 ${fmt(v.likes)}</span><span class="badge">💬 ${fmt(v.comments)}</span></div>
        <div class="acts"><button class="btn sm" data-act="promoFor" data-slot="${slot}" data-vid="${esc(v.id)}">📣 Promocionar</button><button class="btn sm" data-act="ideasFrom" data-t="${esc(v.title)}" data-slot="${slot}">💡 Ideas</button></div>
      </div></div>`;
  }

  // =====================================================================
  // VISTA: PLAN (tablero y calendario)
  // =====================================================================
  function chFilter(cur, act) {
    return `<div class="chips">${act === 'planCh' ? `<button class="chip ${cur === -1 ? 'on' : ''}" data-act="${act}" data-slot="-1">Todos</button>` : ''}${S.channels.map((c, i) => `<button class="chip ${cur === i ? 'on' : ''}" style="${cc(i)}" data-act="${act}" data-slot="${i}"><span class="dot"></span>${esc(chName(i))}</button>`).join('')}</div>`;
  }
  function viewPlan() {
    const items = S.plan.filter(p => UI.planCh < 0 || p.ch === UI.planCh);
    let body;
    if (UI.planMode === 'board') {
      body = `<div class="board">${STAGES.map(([k, label]) => {
        const col = items.filter(p => p.stage === k).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
        return `<div class="col"><h4><b>${label}</b><span>${col.length}</span></h4>
          ${col.map(p => `<div class="task" style="${cc(p.ch)}" data-act="editPlan" data-id="${p.id}"><div class="t">${esc(p.title)}</div><div class="s"><span>${TYPES[p.type] || ''}</span><span>· ${fmtDate(p.date)}</span>${p.date && p.date < dkey() && k !== 'publicado' ? '<span class="badge" style="color:var(--bad)">Atrasado</span>' : ''}</div></div>`).join('')}
          ${k === 'idea' ? `<button class="btn sm ghost block" data-act="newPlan" data-stage="idea">＋ Idea</button>` : ''}</div>`;
      }).join('')}</div>`;
    } else {
      const [y, m] = UI.calMonth.split('-').map(Number);
      const first = new Date(y, m - 1, 1);
      const start = new Date(y, m - 1, 1 - ((first.getDay() + 6) % 7));
      const cells = [];
      for (let i = 0; i < 42; i++) {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        const k = dkey(d);
        const its = items.filter(p => p.date === k);
        cells.push(`<button class="${d.getMonth() !== m - 1 ? 'out' : ''} ${k === dkey() ? 'today' : ''} ${k === UI.calSel ? 'sel' : ''}" data-act="calSel" data-k="${k}"><span>${d.getDate()}</span><span class="dots">${its.slice(0, 4).map(p => `<i style="${cc(p.ch)}"></i>`).join('')}</span></button>`);
      }
      const sel = items.filter(p => p.date === UI.calSel).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      body = `<div class="card">
        <div class="row" style="justify-content:space-between;margin-bottom:10px"><button class="icon-btn" data-act="calMove" data-d="-1" aria-label="Mes anterior">‹</button><b style="text-transform:capitalize">${first.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</b><button class="icon-btn" data-act="calMove" data-d="1" aria-label="Mes siguiente">›</button></div>
        <div class="cal">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(x => `<div class="h">${x}</div>`).join('')}${cells.join('')}</div></div>
        <div class="sec"><h2>${fmtDate(UI.calSel)}</h2><button class="link" data-act="newPlan" data-date="${UI.calSel}">＋ Añadir</button></div>
        <div class="card">${sel.length ? sel.map(p => `<div class="li" style="${cc(p.ch)};cursor:pointer" data-act="editPlan" data-id="${p.id}"><span class="dot"></span><div class="grow"><div class="t ell">${esc(p.title)}</div><div class="s">${p.time || '—'} · ${esc(chName(p.ch))} · ${TYPES[p.type]}</div></div><span class="badge">${STAGES.find(s => s[0] === p.stage)[1]}</span></div>`).join('') : '<div class="empty">Nada este día.</div>'}</div>`;
    }
    const rhythm = live().length ? `<div class="sec"><h2>Ritmo semanal</h2></div><div class="card">${S.channels.map((c, i) => {
      if (!c.title) return '';
      const ws = new Date(); ws.setDate(ws.getDate() - ((ws.getDay() + 6) % 7)); const wk = dkey(ws);
      const we = dkey(new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6));
      const n = S.plan.filter(p => p.ch === i && p.date >= wk && p.date <= we).length;
      const goal = c.perWeek || 1;
      return `<div class="li" style="${cc(i)}"><span class="dot"></span><div class="grow"><div class="row small" style="justify-content:space-between"><b>${esc(c.title)}</b><span class="muted">${n}/${goal} esta semana</span></div><div class="bar cc" style="margin-top:6px"><i style="width:${Math.min(100, Math.round(100 * n / goal))}%"></i></div></div></div>`;
    }).join('')}</div>` : '';
    return `<header class="top"><div class="grow"><h1>Organizar</h1><div class="sub">Del guion a publicado, por canal</div></div><button class="btn primary sm" data-act="newPlan">＋ Vídeo</button></header>
      <div class="seg" style="margin-bottom:10px"><button class="${UI.planMode === 'board' ? 'on' : ''}" data-act="planMode" data-m="board">🗂️ Tablero</button><button class="${UI.planMode === 'cal' ? 'on' : ''}" data-act="planMode" data-m="cal">🗓️ Calendario</button></div>
      ${chFilter(UI.planCh, 'planCh')}
      <div style="margin-top:10px">${body}</div>${rhythm}`;
  }
  function planSheet(p) {
    const isNew = !S.plan.some(x => x.id === p.id);
    openSheet(`${sheetHead(isNew ? 'Nuevo vídeo' : 'Editar vídeo')}
      <form id="planForm" data-id="${p.id}">
        <label class="f"><span>Título o idea</span><input type="text" name="title" value="${esc(p.title)}" maxlength="100" required placeholder="¿De qué va el vídeo?"></label>
        <div class="grid2">
          <label class="f"><span>Canal</span><select name="ch">${S.channels.map((c, i) => `<option value="${i}" ${p.ch === i ? 'selected' : ''}>${esc(chName(i))}</option>`).join('')}</select></label>
          <label class="f"><span>Tipo</span><select name="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${p.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        </div>
        <label class="f"><span>Estado</span><select name="stage">${STAGES.map(([k, v]) => `<option value="${k}" ${p.stage === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <div class="grid2">
          <label class="f"><span>Fecha de publicación</span><input type="date" name="date" value="${esc(p.date || '')}"></label>
          <label class="f"><span>Hora</span><input type="time" name="time" value="${esc(p.time || '')}"></label>
        </div>
        <label class="f"><span>Guion / notas</span><textarea name="notes" rows="5" placeholder="Gancho de los primeros 5 s, puntos clave, llamada a la acción…">${esc(p.notes || '')}</textarea></label>
        <label class="f"><span>Descripción para YouTube</span><textarea name="desc" rows="3">${esc(p.desc || '')}</textarea></label>
        <label class="f"><span>Etiquetas (separadas por comas)</span><input type="text" name="tags" value="${esc((p.tags || []).join(', '))}"></label>
        ${p.ytId ? `<p class="small muted">Subido: <a href="https://youtu.be/${esc(p.ytId)}" target="_blank" rel="noopener">youtu.be/${esc(p.ytId)}</a></p>` : ''}
        <div class="foot"><button class="btn primary" type="submit">Guardar</button></div>
        <div class="row" style="margin-top:8px">
          <button class="btn sm" type="button" data-act="planToUpload" data-id="${p.id}">⬆️ Subir</button>
          <button class="btn sm" type="button" data-act="planTitles" data-id="${p.id}">✨ Títulos</button>
          ${isNew ? '' : `<button class="btn sm danger" type="button" data-act="delPlan" data-id="${p.id}">🗑️</button>`}
        </div>
      </form>`);
  }
  function readPlanForm() {
    const f = $('#planForm');
    if (!f) return null;
    const id = f.dataset.id;
    const fd = new FormData(f);
    let p = S.plan.find(x => x.id === id);
    const isNew = !p;
    if (!p) p = { id, created: Date.now() };
    const prev = p.stage;
    Object.assign(p, {
      title: String(fd.get('title') || '').trim().slice(0, 100) || 'Sin título', ch: Number(fd.get('ch')) || 0, type: fd.get('type') || 'largo', stage: fd.get('stage') || 'idea',
      date: fd.get('date') || '', time: fd.get('time') || '', notes: fd.get('notes') || '', desc: fd.get('desc') || '',
      tags: String(fd.get('tags') || '').split(',').map(s => s.trim()).filter(Boolean)
    });
    if (isNew) S.plan.push(p);
    if (prev !== 'publicado' && p.stage === 'publicado') addXP(15, 'Vídeo publicado');
    save();
    return p;
  }

  // =====================================================================
  // VISTA: SUBIR
  // =====================================================================
  function newUp(slot, from) {
    const p = from || {};
    UI.up = { slot: slot ?? firstLive(), file: null, url: '', title: p.title || '', desc: p.desc || '', tags: (p.tags || []).join(', '), privacy: 'private', when: p.date ? `${p.date}T${p.time || '18:00'}` : '', kids: false, cat: '22', playlist: '', thumb: null, thumbUrl: '', planId: p.id || '' };
  }
  function viewSubir() {
    if (!UI.up) newUp(UI.agentCh);
    const u = UI.up, ch = S.channels[u.slot];
    const ok = ch.title && !ro(ch) && connected(u.slot);
    const ts = AGENT.scoreTitle(u.title, { keywords: kws(ch) });
    const pls = UI.playlists[u.slot];
    if (ok && !pls) loadPlaylists(u.slot);
    if (UI.uploading) {
      const up = UI.uploading;
      return `<header class="top"><div class="grow"><h1>Subiendo…</h1><div class="sub">${esc(chName(up.slot))}</div></div></header>
      <div class="card glow"><b class="ell" style="display:block">${esc(up.title)}</b><div class="progress"><i id="upBar" style="width:${Math.round(up.pct * 100)}%"></i></div>
      <div class="row small muted" style="justify-content:space-between"><span id="upPct">${Math.round(up.pct * 100)} %</span><span id="upMb">${(up.loaded / 1048576).toFixed(0)} / ${(up.total / 1048576).toFixed(0)} MB</span></div>
      <p class="small muted">No cierres esta pantalla ni bloquees el móvil hasta que termine.</p>
      <button class="btn danger block" data-act="cancelUpload">Cancelar subida</button></div>`;
    }
    return `<header class="top"><div class="grow"><h1>Subir vídeo</h1><div class="sub">Directo a tu canal, con SEO del agente</div></div>${u.planId ? '<span class="badge">Del tablero</span>' : ''}</header>
      <div class="pick">${S.channels.map((c, i) => `<button class="${u.slot === i ? 'on' : ''}" style="${cc(i)}" data-act="upSlot" data-slot="${i}">${avatar(c)}<span>${esc(chName(i))}</span></button>`).join('')}</div>
      ${!ch.title || ro(ch) ? `<div class="note">${ch.pub ? `Para subir vídeos a ${esc(ch.title)} inicia sesión con Google.` : 'Este hueco no tiene un canal real conectado.'} <button class="btn sm primary" data-act="connect" data-slot="${u.slot}" style="margin-left:6px">Conectar</button></div>` : !connected(u.slot) ? `<div class="note">La sesión de ${esc(ch.title)} ha caducado (duran 1 hora). <button class="btn sm primary" data-act="connect" data-slot="${u.slot}" style="margin-left:6px">🔑 Entrar</button></div>` : ''}

      <div style="margin-top:14px">${u.file
        ? `<video class="preview" src="${esc(u.url)}" controls playsinline muted></video><div class="row small" style="justify-content:space-between;margin-top:6px"><span class="muted ell" style="max-width:70%">${esc(u.file.name)} · ${(u.file.size / 1048576).toFixed(0)} MB</span><button class="btn sm" data-act="pickVideo">Cambiar</button></div>`
        : `<div class="drop" data-act="pickVideo" id="drop"><div class="e">🎬</div><b>Elige el vídeo</b><span class="small muted">o arrástralo aquí · MP4, MOV, WEBM…</span></div>`}</div>
      <input type="file" id="fileVideo" accept="video/*" hidden>
      <input type="file" id="fileThumb" accept="image/jpeg,image/png" hidden>

      <label class="f"><span>Título <span class="${u.title.length > 100 ? 'grad-text' : ''}">${u.title.length}/100</span></span><input type="text" data-in="upTitle" value="${esc(u.title)}" maxlength="100" placeholder="Un título que dé ganas de hacer clic"></label>
      ${u.title ? `<div class="row small" style="margin-top:8px;flex-wrap:nowrap"><span class="score ${scoreCls(ts.score)}" id="tScore">${ts.score}</span><span class="muted" id="tTips">${esc(ts.tips[0] || '¡Buen título!')}</span></div>` : ''}
      <label class="f"><span>Descripción <span>${u.desc.length}/5000</span></span><textarea data-in="upDesc" rows="6" maxlength="5000" placeholder="De qué va, capítulos, enlaces a tus otros canales…">${esc(u.desc)}</textarea></label>
      <label class="f"><span>Etiquetas</span><input type="text" data-in="upTags" value="${esc(u.tags)}" placeholder="separadas, por, comas"></label>
      <button class="btn block" style="margin-top:10px" data-act="optimize">✨ Optimizar con el agente (descripción, etiquetas y hashtags)</button>

      <div class="grid2">
        <label class="f"><span>Visibilidad</span><select data-in="upPrivacy">${[['private', '🔒 Privado'], ['unlisted', '🔗 Oculto'], ['public', '🌍 Público'], ['schedule', '⏰ Programar']].map(([k, v]) => `<option value="${k}" ${u.privacy === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="f"><span>Categoría</span><select data-in="upCat">${Object.entries(CATS).map(([k, v]) => `<option value="${k}" ${u.cat === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      </div>
      ${u.privacy === 'schedule' ? `<label class="f"><span>Publicar el</span><input type="datetime-local" data-in="upWhen" value="${esc(u.when)}"></label>${(() => { const a = AGENT.analyze(ch); return a && a.bestDay ? `<p class="small muted">💡 Tu mejor momento: <b>${a.bestDay}${a.bestHour != null ? ' a las ' + a.bestHour + ':00' : ''}</b>.</p>` : ''; })()}` : ''}
      <label class="f"><span>Lista de reproducción</span><select data-in="upPlaylist"><option value="">Ninguna</option>${(pls || []).map(p => `<option value="${esc(p.id)}" ${u.playlist === p.id ? 'selected' : ''}>${esc(p.title)} (${p.count})</option>`).join('')}</select></label>
      <div class="li" style="margin-top:10px"><div class="grow"><div class="t small">¿Es contenido para niños?</div><div class="s">Obligatorio por ley (COPPA). Si no lo es, déjalo desactivado.</div></div><label class="switch"><input type="checkbox" data-in="upKids" ${u.kids ? 'checked' : ''}><span></span></label></div>

      <label class="f"><span>Miniatura (1280×720, máx. 2 MB)</span></label>
      ${u.thumbUrl ? `<img class="thumb-prev" src="${esc(u.thumbUrl)}" alt="Miniatura"><div class="row" style="margin-top:6px"><button class="btn sm" data-act="pickThumb">Cambiar</button><button class="btn sm" data-act="noThumb">Quitar</button></div>` : `<button class="btn block" data-act="pickThumb">🖼️ Elegir miniatura</button>`}

      <button class="btn primary block" style="margin-top:20px;min-height:54px;font-size:16px" data-act="doUpload" ${ok && u.file && u.title.trim() ? '' : 'disabled'}>⬆️ Subir a ${esc(chName(u.slot))}</button>
      <p class="small muted" style="text-align:center">${!u.file ? 'Elige un vídeo para empezar.' : !u.title.trim() ? 'Escribe un título.' : ''}</p>
      <div class="note">ℹ️ Mientras la app de Google esté en «modo prueba», YouTube sube los vídeos como <b>privados</b> hasta que la verifiques. Después puedes cambiar la visibilidad en YouTube Studio.</div>`;
  }
  async function loadPlaylists(slot) {
    UI.playlists[slot] = [];
    try { UI.playlists[slot] = await YT.myPlaylists(slot); if (UI.view === 'subir') render(); } catch (e) { /* sin listas */ }
  }
  function setVideoFile(f) {
    if (!f) return;
    if (!/^video\//.test(f.type) && !/\.(mp4|mov|m4v|webm|mkv|avi|3gp)$/i.test(f.name)) { toast('Ese archivo no es un vídeo'); return; }
    if (UI.up.url) URL.revokeObjectURL(UI.up.url);
    UI.up.file = f; UI.up.url = URL.createObjectURL(f);
    if (!UI.up.title) UI.up.title = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 100);
    render();
  }
  async function doUpload() {
    const u = UI.up;
    const ch = S.channels[u.slot];
    if (u.privacy === 'schedule' && (!u.when || new Date(u.when) <= new Date())) { toast('Elige una fecha futura para programar'); return; }
    const tags = u.tags.split(',').map(s => s.trim()).filter(Boolean);
    if (tags.join(',').length > 480) { toast('Demasiadas etiquetas', 'YouTube admite unos 500 caracteres en total.'); return; }
    UI.uploading = { slot: u.slot, title: u.title, pct: 0, loaded: 0, total: u.file.size };
    render();
    let wake = null;
    try { if ('wakeLock' in navigator) wake = await navigator.wakeLock.request('screen'); } catch (e) { /* sin bloqueo */ }
    const job = YT.upload(u.slot, u.file, { title: u.title.trim(), description: u.desc, tags, categoryId: u.cat, privacy: u.privacy === 'schedule' ? 'private' : u.privacy, publishAt: u.privacy === 'schedule' ? u.when : '', kids: u.kids, lang: S.settings.lang }, (p, l, t) => {
      UI.uploading.pct = p; UI.uploading.loaded = l; UI.uploading.total = t;
      const b = $('#upBar'); if (b) { b.style.width = Math.round(p * 100) + '%'; $('#upPct').textContent = Math.round(p * 100) + ' %'; $('#upMb').textContent = `${(l / 1048576).toFixed(0)} / ${(t / 1048576).toFixed(0)} MB`; }
    });
    UI.uploading.job = job;
    try {
      const res = await job.promise;
      const extra = [];
      if (u.thumb) { try { await YT.setThumbnail(u.slot, res.id, u.thumb); extra.push('miniatura ✓'); } catch (e) { extra.push('miniatura ✗ (' + errMsg(e) + ')'); } }
      if (u.playlist) { try { await YT.addToPlaylist(u.slot, u.playlist, res.id); extra.push('lista ✓'); } catch (e) { extra.push('lista ✗'); } }
      const plan = S.plan.find(p => p.id === u.planId);
      if (plan) { plan.ytId = res.id; plan.stage = u.privacy === 'schedule' ? 'listo' : 'publicado'; }
      else S.plan.push({ id: uid(), title: u.title, ch: u.slot, type: 'largo', stage: u.privacy === 'schedule' ? 'listo' : 'publicado', date: (u.when || dkey()).slice(0, 10), time: u.when ? u.when.slice(11, 16) : '', notes: '', desc: u.desc, tags, ytId: res.id });
      addXP(40, 'Vídeo subido');
      const status = res.status || {};
      const vid = { id: res.id, title: u.title, published: new Date().toISOString(), views: 0, likes: 0, comments: 0, thumb: '', secs: 0 };
      ch.recent = [vid, ...(ch.recent || [])].slice(0, 30);
      save();
      if (u.url) URL.revokeObjectURL(u.url);
      UI.uploading = null; newUp(u.slot);
      render();
      openSheet(`${sheetHead('🎉 ¡Vídeo subido!')}
        <p><b>${esc(vid.title)}</b><br><span class="muted small">${status.publishAt ? 'Programado para ' + new Date(status.publishAt).toLocaleString('es-ES') : 'Visibilidad: ' + ({ private: 'privado', unlisted: 'oculto', public: 'público' }[status.privacyStatus] || status.privacyStatus || '—')}${extra.length ? ' · ' + extra.join(' · ') : ''}</span></p>
        <div class="foot"><a class="btn" href="https://studio.youtube.com/video/${esc(res.id)}/edit" target="_blank" rel="noopener">Abrir en Studio ↗</a><button class="btn primary" data-act="promoFor" data-slot="${u.slot}" data-vid="${esc(res.id)}">📣 Kit de promoción</button></div>`);
    } catch (e) {
      UI.uploading = null; render();
      if (e.code !== 'cancelled') toast('La subida ha fallado', errMsg(e)); else toast('Subida cancelada');
    }
    try { if (wake) wake.release(); } catch (e) { /* nada */ }
  }

  // =====================================================================
  // VISTA: AGENTE
  // =====================================================================
  const AGENT_TABS = [['misiones', '🎯 Misiones'], ['virales', '🔥 Virales'], ['ideas', '💡 Ideas y SEO'], ['promo', '📣 Promoción'], ['comentarios', '💬 Comentarios'], ['chat', '🤖 Chat']];
  function viewAgente() {
    const t = UI.agentTab;
    const body = { misiones: agMisiones, virales: agVirales, ideas: agIdeas, promo: agPromo, comentarios: agComentarios, chat: agChat }[t]();
    return `<header class="top"><img class="logo" src="icons/icon-192.png" alt=""><div class="grow"><h1>Agente de crecimiento</h1><div class="sub">Capta espectadores y suscriptores · ${aiReady() && S.settings.aiEngine === 'claude' ? '✨ con Claude' : '⚡ en tu móvil'}</div></div></header>
      <div class="seg" style="margin-bottom:12px">${AGENT_TABS.map(([k, v]) => `<button class="${t === k ? 'on' : ''}" data-act="agentTab" data-tab="${k}">${v}</button>`).join('')}</div>${body}`;
  }
  function agMisiones() {
    rollMissions();
    const ms = AGENT.missions(S.channels, S.plan, dkey());
    const doneN = ms.filter(m => S.missions.done[m.id]).length;
    const lv = level();
    return `<div class="hero"><div class="lbl">Hoy</div><div class="big">${doneN}/${ms.length} misiones</div><div class="small" style="color:#ffd2dc;position:relative;z-index:1">Nivel ${lv.lv} · ${S.xp} XP en total · racha de ${S.streak} día${S.streak === 1 ? '' : 's'} 🔥</div><div class="goal" style="position:relative;z-index:1"><div class="bar" style="margin-top:10px"><i style="width:${Math.round(100 * doneN / Math.max(1, ms.length))}%"></i></div></div></div>
      <div class="card" style="margin-top:12px">${ms.map(missionRow).join('')}</div>
      <div class="sec"><h2>Promoción cruzada entre tus canales</h2></div>
      <div class="card">${AGENT.crossPromo(S.channels).map(t => `<div class="li small"><div class="grow">${mdLite(t)}</div></div>`).join('')}</div>
      <div class="note">🛡️ El agente solo usa técnicas que YouTube permite. No compra suscriptores, ni usa bots, ni hace spam de comentarios: eso hace que YouTube borre visitas, desmonetice o cierre el canal.</div>`;
  }
  function agVirales() {
    const slot = UI.agentCh, ch = S.channels[slot];
    const v = S.viral[slot];
    const q = (v && v.q) || kws(ch).slice(0, 3).join(' ') || ch.niche || '';
    const busy = UI.busy.viral;
    let res = '';
    if (busy) res = `<div class="card">${[1, 2, 3].map(() => '<div class="sk" style="height:84px;margin:8px 0"></div>').join('')}</div>`;
    else if (v && v.items && v.items.length) {
      const items = v.items;
      const pat = AGENT.patterns(items);
      const cols = AGENT.collabs(items, ch.subs || 0);
      res = `<div class="sec"><h2>Top ${items.length} de «${esc(v.q)}»</h2><span class="small muted">${v.demo ? '<span class="badge demo">Ejemplo</span>' : ago(new Date(v.at).toISOString())}</span></div>
      <div class="card">${items.map((x, i) => `<div class="vid">
        <a class="th" href="${x.demo ? '#' : 'https://youtu.be/' + esc(x.id)}" target="_blank" rel="noopener">${x.thumb ? `<img src="${esc(x.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<div class="sk" style="width:100%;height:100%"></div>'}<span class="rank">#${i + 1}</span><span class="dur">${x.short ? 'Short' : durTxt(x.secs || 0)}</span></a>
        <div class="grow" style="min-width:0"><div class="t">${esc(x.title)}</div><div class="s">${esc(x.channelTitle)} · ${x.ch ? fmt(x.ch.subs) + ' subs · ' : ''}${ago(x.published)}</div>
          <div class="kpis"><span class="badge hot">🔥 ${x.score}</span><span class="badge">👁 ${fmt(x.views)}</span><span class="badge">⚡ ${fmt(x.vpd)}/día</span>${x.ratio >= 1 ? `<span class="badge ok">${x.ratio >= 10 ? Math.round(x.ratio) : x.ratio.toFixed(1)}× sus subs</span>` : ''}</div>
          <div class="acts"><button class="btn sm" data-act="viralIdea" data-i="${i}">＋ Idea</button><button class="btn sm" data-act="ideasFrom" data-t="${esc(x.title)}" data-slot="${slot}">✨ Títulos</button></div></div></div>`).join('')}</div>
      ${pat ? `<div class="sec"><h2>Qué tienen en común</h2></div><div class="card glow small">
        <div class="li"><div class="grow">📏 Títulos de <b>${pat.avgLen} caracteres</b> de media · <b>${pat.numbers}%</b> con números · <b>${pat.questions}%</b> preguntas · <b>${pat.caps}%</b> con una palabra en MAYÚSCULAS · <b>${pat.emoji}%</b> con emoji</div></div>
        <div class="li"><div class="grow">⏱️ ${pat.shortsPct}% son Shorts${pat.medDur ? ` · los largos duran ~<b>${pat.medDur} min</b>` : ''}${pat.bestHour != null ? ` · se publicaron sobre las <b>${pat.bestHour}:00</b>` : ''}</div></div>
        <div class="li"><div class="grow">🔑 Palabras que más se repiten:<div class="tags" style="margin-top:6px">${pat.words.map(w => `<span class="tag" data-act="ideasFrom" data-t="${esc(w)}" data-slot="${slot}">${esc(w)}</span>`).join('')}</div></div></div>
        ${pat.tags.length ? `<div class="li"><div class="grow">🏷️ Etiquetas de los virales:<div class="tags" style="margin-top:6px">${pat.tags.slice(0, 18).map(w => `<span class="tag">${esc(w)}</span>`).join('')}</div><button class="btn sm" style="margin-top:8px" data-act="copyTags">📋 Copiar etiquetas</button></div></div>` : ''}
      </div>` : ''}
      ${cols.length ? `<div class="sec"><h2>Canales para colaborar</h2></div><div class="card">${cols.map(c => `<div class="li">${c.thumb ? `<img src="${esc(c.thumb)}" alt="" style="width:40px;height:40px;border-radius:50%" referrerpolicy="no-referrer">` : `<div class="av" style="width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--card2);font-weight:800">${esc((c.title || "?")[0])}</div>`}<div class="grow"><div class="t ell">${esc(c.title)}</div><div class="s">${fmt(c.subs)} subs · viral: «${esc(c.hit.slice(0, 40))}»</div></div><button class="btn sm" data-act="collabMsg" data-name="${esc(c.title)}">✉️</button></div>`).join('')}</div>` : ''}`;
    } else if (v && v.items) res = `<div class="card empty"><div class="e">🔍</div>Sin resultados. Prueba con otras palabras o más días.</div>`;
    return `${chFilter(slot, 'agentCh')}
      <div class="card" style="margin-top:10px">
        <label class="f" style="margin-top:0"><span>Nicho / palabras de búsqueda</span><input type="search" id="vq" value="${esc(q)}" placeholder="p. ej. recetas fáciles, minecraft, viajes baratos"></label>
        <div class="grid2">
          <label class="f"><span>Periodo</span><select id="vdays">${[[2, '48 horas'], [7, '7 días'], [30, '30 días'], [90, '3 meses'], [365, '1 año']].map(([d, l]) => `<option value="${d}" ${(v ? v.days : 30) === d ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="f"><span>Formato</span><select id="vkind">${[['all', 'Todo'], ['long', 'Vídeos largos'], ['short', 'Shorts']].map(([k, l]) => `<option value="${k}" ${(v ? v.kind : 'short') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        </div>
        <button class="btn primary block" style="margin-top:14px" data-act="viralSearch" ${busy ? 'disabled' : ''}>${busy ? 'Buscando…' : '🔥 Buscar los más virales'}</button>
        <p class="tiny dim" style="margin:8px 0 0">Ordena por velocidad (visitas/día), visitas frente al tamaño del canal y participación. Cada búsqueda gasta ~102 de las 10.000 unidades diarias de la API.</p>
      </div>${res}`;
  }
  async function viralSearch() {
    const slot = UI.agentCh, ch = S.channels[slot];
    const q = ($('#vq').value || '').trim();
    const days = Number($('#vdays').value), kind = $('#vkind').value;
    if (!q) { toast('Escribe de qué va tu nicho'); return; }
    if (!ch.keywords && !ch.niche) { ch.niche = q; }
    if (!YT.anyToken() && !S.settings.apiKey) {
      if (ch.demo || !live().some(c => !c.demo)) { S.viral[slot] = demoViral(q, days, kind); save(); render(); toast('👀 Resultados de ejemplo', 'Conecta un canal o pon una clave de API para ver los reales.'); return; }
      toast('Necesitas conexión con YouTube', 'Vuelve a entrar en un canal o añade una clave de API en Ajustes.'); return;
    }
    UI.busy.viral = true; render();
    try {
      let items = await YT.searchViral({ q, days, kind, region: S.settings.region, lang: S.settings.lang, max: 30 });
      items = items.map(AGENT.scoreViral).sort((a, b) => b.score - a.score).slice(0, 20)
        .map(x => ({ id: x.id, title: x.title, channelTitle: x.channelTitle, channelId: x.channelId, published: x.published, thumb: x.thumb, views: x.views, likes: x.likes, comments: x.comments, secs: x.secs, short: x.short, tags: (x.tags || []).slice(0, 15), vpd: x.vpd, ratio: x.ratio, score: x.score, ch: x.ch && { id: x.ch.id, title: x.ch.title, thumb: x.ch.thumb, subs: x.ch.subs } }));
      S.viral[slot] = { q, days, kind, at: Date.now(), items };
      save();
      const mid = 'vir-' + slot;
      if (AGENT.missions(S.channels, S.plan, dkey()).some(m => m.id === mid)) completeMission(mid);
    } catch (e) { toast('No se pudo buscar', errMsg(e)); }
    UI.busy.viral = false; render();
  }
  function demoViral(q, days, kind) {
    const T = ['Probé {q} durante 30 días y esto pasó', 'Nadie te cuenta esto de {q}', '7 errores de {q} que todos cometen', 'El truco de {q} que nadie usa', '¿Merece la pena {q} en 2026?', '{q} con 0 € (funciona)', 'Reaccionando al peor {q}', '{q}: guía DEFINITIVA', 'Lo que pasa si haces {q} cada día', '{q} en 60 segundos'];
    const items = T.map((t, i) => {
      const subs = [12000, 450000, 3200, 88000, 1500000, 27000, 6400, 210000, 950, 54000][i];
      const views = Math.round(subs * [3.2, 0.4, 41, 1.6, 0.25, 4.4, 9, 0.9, 120, 2.1][i]);
      const short = kind === 'short' || (kind === 'all' && i % 3 === 2);
      const x = { id: 'demo-v' + i, demo: true, title: t.replace('{q}', q), channelTitle: 'Canal de ejemplo ' + (i + 1), published: new Date(Date.now() - (1 + i * days / 12) * 86400000).toISOString(), thumb: '', views, likes: Math.round(views * 0.04), comments: Math.round(views * 0.004), secs: short ? 40 : 600 + i * 30, short, tags: [q, q + ' fácil', q + ' 2026', 'tutorial'], ch: { id: 'demo-c' + i, title: 'Canal de ejemplo ' + (i + 1), thumb: '', subs } };
      return AGENT.scoreViral(x);
    }).sort((a, b) => b.score - a.score);
    return { q, days, kind, at: Date.now(), items, demo: true };
  }
  function agIdeas() {
    const slot = UI.agentCh, ch = S.channels[slot];
    const a = AGENT.analyze(ch);
    const res = UI.ideaRes;
    const tt = UI.titleTest ? AGENT.scoreTitle(UI.titleTest, { keywords: kws(ch) }) : null;
    return `${chFilter(slot, 'agentCh')}
      <div class="card" style="margin-top:10px">
        <label class="f" style="margin-top:0"><span>Tema del vídeo</span><input type="text" id="ideaTopic" value="${esc(UI.ideaTopic)}" placeholder="p. ej. airfryer, minecraft hardcore, Lisboa barato"></label>
        <button class="btn primary block" style="margin-top:12px" data-act="genTitles">✨ Generar títulos y ganchos</button>
      </div>
      ${res ? `<div class="sec"><h2>Títulos para «${esc(UI.ideaTopic)}»</h2></div><div class="card">${res.map(r => `<div class="li"><span class="score ${scoreCls(r.score)}">${r.score}</span><div class="grow"><div class="t small">${esc(r.t)}</div>${r.tips.length ? `<div class="s">${esc(r.tips[0])}</div>` : ''}</div><div class="row" style="flex-wrap:nowrap;gap:4px"><button class="icon-btn" data-act="copyText" data-t="${esc(r.t)}" aria-label="Copiar">📋</button><button class="icon-btn" data-act="titleToPlan" data-t="${esc(r.t)}" aria-label="Añadir al tablero">＋</button></div></div>`).join('')}</div>
        <div class="sec"><h2>Ganchos para los primeros 5 segundos</h2></div><div class="card">${AGENT.hooks(UI.ideaTopic).map(h => `<div class="li small"><div class="grow">🎙️ ${esc(h)}</div><button class="icon-btn" data-act="copyText" data-t="${esc(h)}">📋</button></div>`).join('')}</div>` : ''}
      <div class="sec"><h2>Puntúa tu título</h2></div>
      <div class="card"><input type="text" data-in="titleTest" value="${esc(UI.titleTest)}" placeholder="Pega aquí el título que tenías pensado">
        <div id="ttOut">${tt ? ttHtml(tt) : ''}</div></div>
      ${a && a.top ? `<div class="sec"><h2>Shorts de tu mejor vídeo</h2></div><div class="card">${AGENT.shortIdeas(a.top).map(s => `<div class="li small"><div class="grow">⚡ ${esc(s)}</div><button class="icon-btn" data-act="titleToPlan" data-t="${esc('Short: ' + s.slice(0, 80))}" data-type="short">＋</button></div>`).join('')}</div>` : ''}
      ${a && a.flops.length ? `<div class="sec"><h2>Vídeos a rescatar</h2></div><div class="card">${a.flops.map(v => `<div class="li"><div class="grow"><div class="t small">${esc(v.title)}</div><div class="s">${fmt(v.views)} visitas (tu media: ${fmt(a.median)}). Prueba otro título o miniatura.</div></div><button class="btn sm" data-act="ideasFrom" data-t="${esc(v.title)}" data-slot="${slot}">✨</button></div>`).join('')}</div>` : ''}`;
  }
  const ttHtml = tt => `<div class="row small" style="margin-top:10px;flex-wrap:nowrap"><span class="score ${scoreCls(tt.score)}">${tt.score}</span><div class="muted">${tt.tips.length ? tt.tips.map(esc).join('<br>') : '¡Muy buen título! 👌'}</div></div>`;
  function agPromo() {
    const slot = UI.promoSlot, ch = S.channels[slot];
    const vids = (ch.recent || []).slice(0, 15);
    if (!UI.promoVid && vids[0]) UI.promoVid = vids[0].id;
    const v = vids.find(x => x.id === UI.promoVid) || vids[0];
    const others = othersOf(slot);
    const kit = v ? AGENT.promoKit(v, ch, others) : [];
    const url = v && !v.id.startsWith('demo') ? 'https://youtu.be/' + v.id : '';
    const share = (k, text) => {
      const e = encodeURIComponent;
      if (k === 'x') return `https://twitter.com/intent/tweet?text=${e(text)}`;
      if (k === 'wa') return `https://wa.me/?text=${e(text)}`;
      if (k === 'reddit' && url) return `https://www.reddit.com/submit?url=${e(url)}&title=${e(v.title)}`;
      return '';
    };
    return `${chFilter(slot, 'promoSlot')}
      ${!vids.length ? `<div class="card empty" style="margin-top:10px"><div class="e">📣</div>Conecta el canal para crear kits de promoción de tus vídeos.</div>` : `
      <label class="f"><span>Vídeo a promocionar</span><select data-in="promoVid">${vids.map(x => `<option value="${esc(x.id)}" ${v && x.id === v.id ? 'selected' : ''}>${esc(x.title.slice(0, 70))}</option>`).join('')}</select></label>
      <div class="sec"><h2>Kit de promoción</h2><button class="link" data-act="shareNative">📤 Compartir</button></div>
      ${kit.map(k => { const s = share(k.key, k.text); return `<div class="card"><div class="net"><span class="ic">${k.ic}</span>${esc(k.net)}</div><div class="copybox">${esc(k.text)}</div><div class="row"><button class="btn sm" data-act="copyText" data-t="${esc(k.text)}">📋 Copiar</button>${s ? `<a class="btn sm" href="${esc(s)}" target="_blank" rel="noopener" data-act="promoShared">Publicar ↗</a>` : ''}${k.key === 'community' && ch.id && !ch.demo ? `<a class="btn sm" href="https://www.youtube.com/channel/${esc(ch.id)}/community" target="_blank" rel="noopener">Abrir Comunidad ↗</a>` : ''}</div></div>`; }).join('')}`}
      <div class="sec"><h2>Dónde más moverlo</h2></div>
      <div class="card small">
        <div class="li"><div class="grow">🧲 <b>Pantalla final + tarjeta</b> a tu vídeo más visto en los últimos 20 s.</div></div>
        <div class="li"><div class="grow">📌 <b>Comentario fijado</b> con una pregunta (más comentarios = más alcance).</div></div>
        <div class="li"><div class="grow">⚡ <b>3 Shorts</b> del vídeo enlazados con «Vídeo relacionado».</div></div>
        <div class="li"><div class="grow">🧵 Comunidades donde está tu público (Reddit, Discord, foros): aporta valor primero, enlace después.</div></div>
        <div class="li"><div class="grow">🤝 Propón colaboraciones a canales de tamaño parecido (pestaña 🔥 Virales).</div></div>
      </div>`;
  }
  function agComentarios() {
    const slot = UI.agentCh, ch = S.channels[slot];
    const st = UI.cm[slot];
    const can = ch.title && !ro(ch) && connected(slot);
    let body = '';
    if (!ch.title || ro(ch)) body = `<div class="card empty"><div class="e">💬</div>Conecta este canal para leer y responder comentarios desde aquí.<br><button class="btn sm primary" style="margin-top:10px" data-act="connect" data-slot="${slot}">Conectar</button></div>`;
    else if (!can) body = `<div class="card empty"><div class="e">🔑</div>La sesión ha caducado.<br><button class="btn sm primary" style="margin-top:10px" data-act="connect" data-slot="${slot}">Volver a entrar</button></div>`;
    else if (!st) body = `<div class="card empty"><div class="e">💬</div>Responder rápido a los comentarios hace que YouTube muestre más tus vídeos.<br><button class="btn sm primary" style="margin-top:10px" data-act="loadComments">Cargar comentarios</button></div>`;
    else if (st.loading) body = `<div class="card">${[1, 2, 3].map(() => '<div class="sk" style="height:70px;margin:8px 0"></div>').join('')}</div>`;
    else {
      const pend = st.list.filter(c => !c.mine && !c.replies && !c.done);
      const n = S.missions.replies[slot] || 0;
      body = `<div class="row small muted" style="justify-content:space-between;margin:4px 2px 8px"><span>${pend.length} sin responder · hoy has respondido ${n}</span><button class="link" data-act="loadComments" style="background:none;border:0;color:var(--red);font-weight:700">🔄</button></div>
      ${pend.length ? pend.slice(0, 20).map(c => { const r = AGENT.replyFor(c); return `<div class="card"><div class="row" style="flex-wrap:nowrap;gap:10px"><img src="${esc(c.avatar)}" alt="" style="width:34px;height:34px;border-radius:50%" referrerpolicy="no-referrer"><div class="grow" style="min-width:0"><b class="small">${esc(c.author)}</b> <span class="tiny dim">${ago(c.at)} · ${{ pregunta: '❓ pregunta', peticion: '📝 petición', critica: '🧊 crítica', elogio: '❤️ elogio', otro: '💬' }[r.kind]}</span><div class="small" style="margin-top:2px">${esc(c.text.slice(0, 400))}</div></div></div>
        <textarea id="rp-${esc(c.id)}" rows="2" style="margin-top:10px;min-height:60px">${esc(r.text)}</textarea>
        <div class="row" style="margin-top:8px"><a class="btn sm" href="https://www.youtube.com/watch?v=${esc(c.videoId)}&lc=${esc(c.id)}" target="_blank" rel="noopener">Ver ↗</a><button class="btn sm primary" data-act="sendReply" data-id="${esc(c.id)}">Responder</button></div></div>`; }).join('') : '<div class="card empty"><div class="e">🎉</div>¡Todo respondido!</div>'}`;
    }
    return `${chFilter(slot, 'agentCh')}<div style="margin-top:10px">${body}</div>`;
  }
  async function loadComments() {
    const slot = UI.agentCh, ch = S.channels[slot];
    UI.cm[slot] = { loading: true, list: [] }; render();
    try { UI.cm[slot] = { list: await YT.comments(slot, ch.id, 60) }; }
    catch (e) { UI.cm[slot] = null; toast('No se pudieron cargar', errMsg(e)); }
    render();
  }
  async function sendReply(id) {
    const slot = UI.agentCh;
    const ta = document.getElementById('rp-' + id);
    const text = ta && ta.value.trim();
    if (!text || text.includes('…')) { toast('Completa la respuesta', 'Cambia los «…» por tu respuesta.'); return; }
    try {
      await YT.reply(slot, id, text);
      const c = UI.cm[slot].list.find(x => x.id === id); if (c) c.done = true;
      S.missions.replies[slot] = (S.missions.replies[slot] || 0) + 1;
      addXP(3, 'Comentario respondido');
      if (S.missions.replies[slot] >= 5) completeMission('com-' + slot);
      save(); render();
    } catch (e) { toast('No se pudo responder', errMsg(e)); }
  }

  // ---------- chat del agente ----------
  let SAMPLE = null, SAMPLE_LIMITS = null, aiState = 'none', AIRUN = null;
  const aiReady = () => aiState === 'ready';
  function initAI() {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    window.claude.use('sample').then(async fn => {
      if (!fn) return;
      SAMPLE = fn; try { SAMPLE_LIMITS = await fn.limits(); } catch (e) { SAMPLE_LIMITS = null; }
      aiState = 'ready'; if (UI.view === 'agente' || UI.view === 'ajustes') render();
    }).catch(() => { aiState = 'none'; });
  }
  const SUGG = ['¿Cómo consigo más suscriptores?', 'Busca los virales de mi nicho', '¿Cuándo publico?', 'Dame títulos para mi próximo vídeo', 'Ideas de Shorts', '¿Qué vídeo rescato?'];
  function agChat() {
    const msgs = S.chat.slice(-30);
    return `<div class="chat">
      ${!msgs.length ? `<div class="msg bot"><p>¡Hola! Soy tu agente de crecimiento 🤖. Analizo tus 3 canales, busco lo más viral de tu nicho y te digo qué hacer cada día para ganar espectadores y suscriptores.</p><p>Pregúntame lo que quieras o toca una sugerencia 👇</p></div>` : ''}
      ${msgs.map(m => `<div class="msg ${m.role === 'user' ? 'user' : 'bot'}">${m.role === 'user' ? esc(m.content) : mdLite(m.content)}${m.acts && m.acts.length ? `<div class="acts">${m.acts.map(a => `<button class="btn sm" data-act="${esc(a.act)}" data-v="${esc(a.v || '')}" data-tab="${esc(a.tab || '')}" data-slot="${a.slot ?? ''}" data-t="${esc(a.t || '')}">${esc(a.label)}</button>`).join('')}</div>` : ''}</div>`).join('')}
      ${AIRUN ? `<div class="msg bot" id="aiLive">${AIRUN.text ? mdLite(AIRUN.text) : '<span class="typing"><span></span><span></span><span></span></span>'}</div>` : ''}
    </div>
    <div class="chips" style="margin-top:12px">${SUGG.map(s => `<button class="chip" data-act="chatSend" data-t="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <form class="composer" id="chatForm"><input type="text" id="chatIn" value="${esc(UI.chatDraft)}" placeholder="Pregunta a tu agente…" autocomplete="off"><button class="btn primary sm" type="submit" aria-label="Enviar">➤</button></form>
    ${S.chat.length ? '<button class="btn sm ghost" style="margin-top:8px" data-act="chatClear">🧹 Borrar conversación</button>' : ''}`;
  }
  function chSlotFrom(text) {
    const t = text.toLowerCase();
    const i = S.channels.findIndex(c => c.title && t.includes(c.title.toLowerCase()));
    if (i >= 0) return i;
    const m = t.match(/canal\s*([123])/); if (m) return Number(m[1]) - 1;
    return UI.agentCh;
  }
  function localReply(text) {
    const t = text.toLowerCase();
    const slot = chSlotFrom(text), ch = S.channels[slot];
    const L = live();
    if (!L.length) return { content: 'Primero conecta al menos un canal (o prueba con los **datos de ejemplo**) para que pueda analizarlo.', acts: [{ act: 'go', v: 'ajustes', label: '⚙️ Ir a Ajustes' }, { act: 'demo', label: '👀 Datos de ejemplo' }] };
    const a = AGENT.analyze(ch);
    if (/viral|tendencia|trend|petando|funciona en mi nicho/.test(t)) {
      const v = S.viral[slot];
      if (v && v.items && v.items.length) return { content: `Lo más viral de «${v.q}» ahora mismo:\n` + v.items.slice(0, 5).map((x, i) => `${i + 1}. **${x.title}** — ${fmt(x.views)} visitas, ${fmt(x.vpd)}/día${x.ratio >= 1 ? `, ${x.ratio.toFixed(1)}× sus subs` : ''}`).join('\n') + '\n\nLo que más se repite en los títulos: ' + AGENT.patterns(v.items).words.slice(0, 6).join(', ') + '. Haz **tu versión** del #1 con tu estilo.', acts: [{ act: 'go', v: 'agente', tab: 'virales', label: '🔥 Ver todos' }] };
      return { content: `Vamos a buscar lo más viral del nicho de **${ch.title}**. Abre la pestaña 🔥 Virales y pulsa «Buscar».`, acts: [{ act: 'go', v: 'agente', tab: 'virales', label: '🔥 Buscar virales' }] };
    }
    if (/t[ií]tulo/.test(t)) {
      const topic = text.replace(/.*t[ií]tulos?\s*(para|de|sobre)?\s*/i, '').replace(/mi pr[oó]ximo v[ií]deo/i, '').trim() || (a && a.wordsTop.slice(0, 2).join(' ')) || ch.niche || 'mi tema';
      const r = AGENT.titles(topic, { keywords: kws(ch), viral: (S.viral[slot] || {}).items, n: 6 });
      return { content: `Títulos para **${topic}** (puntuación de 0 a 100):\n` + r.map(x => `- ${x.t} — **${x.score}**`).join('\n'), acts: [{ act: 'ideasFrom', t: topic, slot, label: '✨ Más títulos' }] };
    }
    if (/short/.test(t)) return { content: a && a.top ? `Shorts que puedes sacar de tu vídeo más visto («${a.top.title}»):\n` + AGENT.shortIdeas(a.top).map(s => '- ' + s).join('\n') + '\n\nPublica **3 por semana**: los Shorts son lo que más suscriptores nuevos trae.' : 'Conecta el canal para sacar Shorts de tus mejores vídeos.' };
    if (/cu[aá]ndo|hora|d[ií]a.*public/.test(t)) return { content: L.map(c => { const x = AGENT.analyze(c); return `- **${c.title}**: ${x && x.bestDay ? `${x.bestDay}${x.bestHour != null ? ' sobre las ' + x.bestHour + ':00' : ''} (según tus últimos ${c.recent.length} vídeos)` : 'aún no hay datos suficientes'}`; }).join('\n') + '\n\nProgramar a esa hora hace que tus suscriptores lo vean nada más salir, y eso le dice a YouTube que lo recomiende.' };
    if (/rescat|flop|peor|no funciona/.test(t)) return { content: a && a.flops.length ? 'Vídeos por debajo de tu media que merece la pena rescatar cambiando título o miniatura:\n' + a.flops.map(v => `- «${v.title}» (${fmt(v.views)} visitas, tu media es ${fmt(a.median)})`).join('\n') : '¡No veo vídeos claramente por debajo de tu media! 👌' };
    if (/comentario/.test(t)) return { content: 'Responder en la primera hora multiplica los comentarios y el alcance. Te preparo respuestas para cada uno:', acts: [{ act: 'go', v: 'agente', tab: 'comentarios', label: '💬 Responder comentarios' }] };
    if (/promo|compart|redes|difund/.test(t)) return { content: 'Te he preparado textos para X, Instagram/TikTok, WhatsApp, Comunidad, comentario fijado y Reddit, listos para copiar:', acts: [{ act: 'go', v: 'agente', tab: 'promo', label: '📣 Kit de promoción' }] };
    if (/colab/.test(t)) return { content: 'En 🔥 Virales, debajo de los resultados, te muestro canales de **tamaño parecido** al tuyo con vídeos virales. Pulsa ✉️ para un mensaje de propuesta.', acts: [{ act: 'go', v: 'agente', tab: 'virales', label: '🤝 Ver canales' }] };
    if (/idea/.test(t)) {
      const v = S.viral[slot];
      const base = v && v.items && v.items.length ? AGENT.patterns(v.items).words.slice(0, 4) : (a ? a.wordsTop.slice(0, 4) : []);
      if (!base.length) return { content: 'Busca primero los virales de tu nicho y te propongo ideas basadas en lo que funciona.', acts: [{ act: 'go', v: 'agente', tab: 'virales', label: '🔥 Virales' }] };
      return { content: 'Ideas basadas en lo que funciona en tu nicho:\n' + base.map(w => `- ${AGENT.titles(w, { keywords: kws(ch), n: 1 })[0].t}`).join('\n'), acts: [{ act: 'go', v: 'agente', tab: 'ideas', label: '💡 Más ideas' }] };
    }
    // Crecer / suscriptores / por defecto
    const tips = AGENT.insights(ch);
    return { content: `Plan para hacer crecer **${ch.title}**:\n` + tips.map(x => '- ' + x).join('\n') + '\n\nY cada día: completa las misiones (responder comentarios, Shorts, promoción cruzada entre tus 3 canales).', acts: [{ act: 'go', v: 'agente', tab: 'misiones', label: '🎯 Misiones' }] };
  }
  function aiContext() {
    return JSON.stringify({
      hoy: dkey(),
      canales: S.channels.filter(c => c.title).map(c => { const a = AGENT.analyze(c); return { nombre: c.title, nicho: c.niche, palabras: c.keywords, subs: c.subs, visitas: c.views, videos: c.videos, mediana_visitas: a && Math.round(a.median), videos_semana: a && +a.perWeek.toFixed(1), mejor_dia: a && a.bestDay, mejor_hora: a && a.bestHour, ultimos: (c.recent || []).slice(0, 12).map(v => `${v.title} | ${v.views} visitas | ${v.published.slice(0, 10)}${v.short ? ' | Short' : ''}`) }; }),
      virales: Object.entries(S.viral).map(([s, v]) => ({ canal: chName(+s), busqueda: v.q, top: (v.items || []).slice(0, 10).map(x => `${x.title} | ${x.views} visitas | ${Math.round(x.vpd)}/día | ${x.ch ? x.ch.subs : '?'} subs`) })),
      tablero: S.plan.filter(p => p.stage !== 'publicado').slice(0, 20).map(p => `${p.date || 'sin fecha'} | ${chName(p.ch)} | ${p.title} | ${p.stage}`)
    });
  }
  const AI_RULES = `Eres el agente de crecimiento de YouTube de la app "Canales". Hablas en español de España, directo, motivador y muy práctico (listas cortas, **negritas**).
Tu misión: que el usuario consiga más espectadores y suscriptores en sus 3 canales con técnicas que YouTube permite (títulos, miniaturas, ganchos, Shorts, SEO, horarios, comunidad, colaboraciones, promoción en redes, promoción cruzada). Nunca recomiendes comprar suscriptores, bots, sub4sub ni spam: dañan el canal.
Usa los datos reales de abajo; no inventes cifras. Si te pide guardar una idea o vídeo, usa la herramienta add_video.
Datos (JSON):
`;
  async function chatSend(text) {
    text = String(text || '').trim();
    if (!text || AIRUN) return;
    S.chat.push({ role: 'user', content: text });
    UI.chatDraft = '';
    if (!(aiReady() && S.settings.aiEngine === 'claude')) {
      AIRUN = { text: '' }; render(); scrollEnd();
      setTimeout(() => { const r = localReply(text); AIRUN = null; S.chat.push({ role: 'assistant', content: r.content, acts: r.acts || [] }); S.chat = S.chat.slice(-40); save(); if (UI.view === 'agente') { render(); scrollEnd(); } }, 420);
      return;
    }
    const hist = S.chat.slice(-14).map(m => ({ role: m.role, content: m.content }));
    const turns = [{ role: 'user', content: AI_RULES + aiContext() }, { role: 'assistant', content: 'Entendido. ¿En qué te ayudo?' }, ...hist];
    const merged = []; turns.forEach(x => { if (merged.length && merged[merged.length - 1].role === x.role) merged[merged.length - 1].content += '\n\n' + x.content; else merged.push({ ...x }); });
    AIRUN = { text: '', ctl: new AbortController() }; render(); scrollEnd();
    const opts = { signal: AIRUN.ctl.signal, onText: ({ text: tx }) => { if (!AIRUN) return; AIRUN.text = tx; const el = $('#aiLive'); if (el) el.innerHTML = mdLite(tx); } };
    if (SAMPLE_LIMITS && SAMPLE_LIMITS.tools) opts.tools = [{
      name: 'add_video', description: 'Guarda una idea o vídeo en el tablero de un canal.',
      inputSchema: { type: 'object', properties: { title: { type: 'string' }, channel: { type: 'string', description: 'nombre del canal' }, date: { type: 'string', description: 'AAAA-MM-DD o vacío' }, type: { type: 'string', enum: ['largo', 'short', 'directo'] } }, required: ['title'] },
      execute(inp) { const ch = Math.max(0, S.channels.findIndex(c => c.title && inp.channel && c.title.toLowerCase().includes(String(inp.channel).toLowerCase()))); S.plan.push({ id: uid(), title: String(inp.title).slice(0, 100), ch, type: TYPES[inp.type] ? inp.type : 'largo', stage: 'idea', date: /^\d{4}-\d{2}-\d{2}$/.test(inp.date || '') ? inp.date : '', time: '', notes: '', desc: '', tags: [] }); save(); return 'Guardado'; }
    }];
    try { const r = await SAMPLE(merged, opts); S.chat.push({ role: 'assistant', content: r.text }); }
    catch (e) { S.chat.push({ role: 'assistant', content: (e && e.text ? e.text + '\n\n' : '') + '⚠️ ' + (e && e.code === 'rate_limited' ? 'Has llegado al límite de uso. Prueba en un rato.' : 'No se pudo conectar con Claude.') }); }
    AIRUN = null; S.chat = S.chat.slice(-40); save();
    if (UI.view === 'agente') { render(); scrollEnd(); }
  }
  const scrollEnd = () => setTimeout(() => window.scrollTo(0, document.documentElement.scrollHeight), 30);

  // =====================================================================
  // VISTA: AJUSTES
  // =====================================================================
  function viewAjustes() {
    const st = S.settings;
    const origin = location.origin;
    return `<header class="top"><div class="grow"><h1>Ajustes</h1><div class="sub">Canales, conexión y datos</div></div></header>
      <label class="f" style="margin-top:0"><span>Tu nombre</span><input type="text" data-in="sName" value="${esc(st.name)}" placeholder="Para saludarte"></label>

      <div class="sec"><h2>Mis 3 canales</h2></div>
      ${S.channels.map((c, i) => `<div class="card" style="${cc(i)}">
        <div class="row" style="flex-wrap:nowrap;gap:12px">${avatar(c)}<div class="grow" style="min-width:0"><b class="ell" style="display:block">${esc(chName(i))}</b><span class="small muted">${c.demo ? 'Datos de ejemplo' : c.pub ? 'Datos públicos (inicia sesión para subir)' : c.title ? (connected(i) ? '🟢 Sesión activa' : '⚪ Sesión caducada') : 'Sin conectar'}</span></div>
          ${c.title && !ro(c) ? `<button class="btn sm" data-act="connect" data-slot="${i}">${connected(i) ? 'Cambiar' : 'Entrar'}</button><button class="icon-btn" data-act="disconnect" data-slot="${i}" aria-label="Desconectar">⏏</button>` : `<button class="btn sm primary" data-act="connect" data-slot="${i}">${UI.busy['c' + i] ? '…' : 'Conectar'}</button>${c.demo && !c.pub ? `<button class="icon-btn" data-act="disconnect" data-slot="${i}" aria-label="Quitar ejemplo">✕</button>` : ''}`}</div>
        <label class="f"><span>Nicho</span><input type="text" data-in="chNiche" data-slot="${i}" value="${esc(c.niche)}" placeholder="p. ej. recetas fáciles"></label>
        <label class="f"><span>Palabras clave (comas)</span><input type="text" data-in="chKw" data-slot="${i}" value="${esc(c.keywords)}" placeholder="airfryer, cenas rápidas, meal prep"></label>
        <div class="grid2"><label class="f"><span>Objetivo de subs</span><input type="number" min="0" data-in="chGoal" data-slot="${i}" value="${c.goal || ''}" placeholder="auto"></label><label class="f"><span>Vídeos/semana</span><input type="number" min="1" max="21" data-in="chWeek" data-slot="${i}" value="${c.perWeek || 1}"></label></div>
        <label class="f"><span>Color</span></label><div class="row">${COLORS.map(col => `<button class="icon-btn" style="background:${col};${c.color === col ? 'box-shadow:0 0 0 3px #fff' : ''}" data-act="chColor" data-slot="${i}" data-c="${col}" aria-label="Color"></button>`).join('')}</div>
      </div>`).join('')}

      <div class="sec"><h2>Conexión con YouTube</h2></div>
      <div class="card">
        <label class="f" style="margin-top:0"><span>ID de cliente OAuth de Google</span><input type="text" data-in="sClient" value="${esc(st.clientId)}" placeholder="xxxx.apps.googleusercontent.com" autocomplete="off" spellcheck="false"></label>
        <label class="f"><span>Clave de API (opcional, para buscar virales sin sesión)</span><input type="text" data-in="sKey" value="${esc(st.apiKey)}" placeholder="AIza…" autocomplete="off" spellcheck="false"></label>
        <p class="tiny dim">Se guardan solo en este dispositivo. Nadie más los ve.</p>
      </div>
      <details class="card" ${st.clientId ? '' : 'open'}><summary>📘 Cómo conseguir el ID (10 minutos, una sola vez)</summary>
        <ol class="steps">
          <li>Entra en <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener">Google Cloud Console</a> con tu cuenta de Google y crea un proyecto (p. ej. «Mis canales»).</li>
          <li>Ve a <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noopener">YouTube Data API v3</a> y pulsa <b>Habilitar</b>.</li>
          <li>En <a href="https://console.cloud.google.com/auth/overview" target="_blank" rel="noopener">Pantalla de consentimiento / Google Auth Platform</a>: tipo <b>Externo</b>, pon un nombre y tu correo. En <b>Público → Usuarios de prueba</b> añade el correo de cada cuenta de Google con la que entres a tus canales.</li>
          <li>En <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Credenciales</a> → <b>Crear credenciales → ID de cliente de OAuth</b> → tipo <b>Aplicación web</b>. En «Orígenes de JavaScript autorizados» pon: <code>${esc(origin)}</code></li>
          <li>Copia el <b>ID de cliente</b> (acaba en <code>.apps.googleusercontent.com</code>) y pégalo arriba.</li>
          <li>Opcional: en Credenciales → <b>Crear clave de API</b>, restríngela a YouTube Data API v3 y pégala arriba.</li>
          <li>Pulsa <b>Conectar</b> en cada canal. Si tus canales son <b>canales de marca</b> de la misma cuenta, Google te dejará elegir cuál en la ventana de inicio de sesión.</li>
        </ol>
        <p class="small muted">La sesión de Google dura 1 hora; después solo tienes que tocar «Entrar». La API da 10.000 unidades al día gratis: una subida gasta 1.600 y una búsqueda de virales ~102.</p>
      </details>

      <div class="sec"><h2>Agente</h2></div>
      <div class="card">
        <div class="grid2"><label class="f" style="margin-top:0"><span>País de búsqueda</span><select data-in="sRegion">${Object.entries(REGIONS).map(([k, v]) => `<option value="${k}" ${st.region === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="f" style="margin-top:0"><span>Idioma</span><select data-in="sLang">${[['es', 'Español'], ['en', 'Inglés'], ['pt', 'Portugués'], ['fr', 'Francés'], ['it', 'Italiano']].map(([k, v]) => `<option value="${k}" ${st.lang === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
        <label class="f"><span>Motor del chat</span><select data-in="sEngine"><option value="local" ${st.aiEngine !== 'claude' ? 'selected' : ''}>⚡ En tu móvil (gratis, sin conexión)</option>${aiReady() ? `<option value="claude" ${st.aiEngine === 'claude' ? 'selected' : ''}>✨ Claude (más completo)</option>` : ''}</select></label>
        <p class="tiny dim">${aiReady() ? 'Claude usa tu cuenta de claude.ai.' : 'Si abres la app desde claude.ai podrás usar Claude en el chat.'}</p>
      </div>

      <div class="sec"><h2>Datos</h2></div>
      <div class="card"><div class="row"><button class="btn" data-act="export">⬇️ Exportar copia</button><button class="btn" data-act="import">⬆️ Importar</button></div>
        <input type="file" id="fileImport" accept="application/json" hidden>
        <button class="btn danger block" style="margin-top:8px" data-act="wipe">🗑️ Borrar todo</button></div>

      <div class="sec"><h2>Versión</h2></div>
      ${window.APPUPDATE ? APPUPDATE.cardHTML('card') : ''}
      <p class="tiny dim" style="text-align:center;margin-top:16px">Canales usa los servicios de la API de YouTube. <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener">Condiciones de YouTube</a> · <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Privacidad de Google</a> · <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">Revocar acceso</a></p>`;
  }

  // =====================================================================
  // RENDER Y NAVEGACIÓN
  // =====================================================================
  const NAV = [['inicio', '🏠', 'Inicio'], ['plan', '🗂️', 'Organizar'], ['subir', '⬆️', 'Subir'], ['agente', '🤖', 'Agente'], ['ajustes', '⚙️', 'Ajustes']];
  function render() {
    const v = { inicio: viewInicio, plan: viewPlan, subir: viewSubir, agente: viewAgente, ajustes: viewAjustes }[UI.view] || viewInicio;
    $('#view').innerHTML = v();
    $('.nav').innerHTML = NAV.map(([k, i, l]) => `<button class="${UI.view === k ? 'on' : ''} ${k === 'subir' ? 'up' : ''}" data-act="go" data-v="${k}" aria-label="${l}"><span class="i">${i}</span>${l}</button>`).join('');
    if (UI.view === 'subir') bindDrop();
  }
  function go(v, tab) {
    UI.view = v;
    if (tab) UI.agentTab = tab;
    history.replaceState(null, '', '#' + v + (v === 'agente' ? '/' + UI.agentTab : ''));
    render(); window.scrollTo(0, 0);
  }
  function bindDrop() {
    const d = $('#drop');
    if (!d) return;
    d.addEventListener('dragover', e => { e.preventDefault(); d.classList.add('over'); });
    d.addEventListener('dragleave', () => d.classList.remove('over'));
    d.addEventListener('drop', e => { e.preventDefault(); d.classList.remove('over'); setVideoFile(e.dataTransfer.files[0]); });
  }

  // ---------- acciones ----------
  const ACT = {
    go(el) { go(el.dataset.v, el.dataset.tab || null); closeSheet(); },
    closeSheet() { closeSheet(); },
    connect(el) { closeSheet(); connect(Number(el.dataset.slot)); },
    refresh(el) { closeSheet(); refresh(Number(el.dataset.slot)); },
    refreshAll() { let n = 0; S.channels.forEach((c, i) => { if (c.title && !ro(c) && connected(i)) { n++; refresh(i, true); } }); toast(n ? '🔄 Actualizando…' : 'Vuelve a entrar en tus canales', n ? '' : 'Las sesiones de Google caducan cada hora.'); },
    disconnect(el) { disconnect(Number(el.dataset.slot)); },
    demo() { loadDemo(); closeSheet(); },
    chSheet(el) { chSheet(Number(el.dataset.slot)); },
    mission(el) { const id = el.dataset.id; if (S.missions.done[id]) { delete S.missions.done[id]; save(); } else completeMission(id); render(); },
    missionGo(el) {
      const m = AGENT.missions(S.channels, S.plan, dkey()).find(x => x.id === el.dataset.id);
      if (!m) return;
      if (m.slot != null) { UI.agentCh = m.slot; UI.promoSlot = m.slot; }
      if (['comentarios', 'virales', 'ideas', 'promo'].includes(m.act)) go('agente', m.act); else go(m.act);
    },
    newPlan(el) { planSheet({ id: uid(), title: '', ch: UI.planCh >= 0 ? UI.planCh : firstLive(), type: 'largo', stage: el.dataset.stage || 'idea', date: el.dataset.date || '', time: '' }); },
    editPlan(el) { const p = S.plan.find(x => x.id === el.dataset.id); if (p) planSheet(p); },
    delPlan(el) { if (!confirm('¿Borrar este vídeo del tablero?')) return; S.plan = S.plan.filter(x => x.id !== el.dataset.id); save(); closeSheet(); render(); },
    planToUpload() { const p = readPlanForm(); closeSheet(); newUp(p.ch, p); go('subir'); },
    planTitles() { const p = readPlanForm(); closeSheet(); UI.agentCh = p.ch; UI.ideaTopic = p.title; UI.ideaRes = AGENT.titles(p.title, { keywords: kws(S.channels[p.ch]), viral: (S.viral[p.ch] || {}).items }); go('agente', 'ideas'); },
    planMode(el) { UI.planMode = el.dataset.m; render(); },
    planCh(el) { UI.planCh = Number(el.dataset.slot); render(); },
    calSel(el) { UI.calSel = el.dataset.k; render(); },
    calMove(el) { const [y, m] = UI.calMonth.split('-').map(Number); const d = new Date(y, m - 1 + Number(el.dataset.d), 1); UI.calMonth = dkey(d).slice(0, 7); render(); },
    upSlot(el) { UI.up.slot = Number(el.dataset.slot); render(); },
    pickVideo() { $('#fileVideo').click(); },
    pickThumb() { $('#fileThumb').click(); },
    noThumb() { if (UI.up.thumbUrl) URL.revokeObjectURL(UI.up.thumbUrl); UI.up.thumb = null; UI.up.thumbUrl = ''; render(); },
    optimize() {
      const u = UI.up, ch = S.channels[u.slot];
      const vt = ((S.viral[u.slot] || {}).items || []);
      const vtags = vt.length ? AGENT.patterns(vt).tags : [];
      const tags = AGENT.suggestTags(u.title, ch.niche || kws(ch).join(' '), vtags);
      const others = othersOf(u.slot);
      u.desc = AGENT.description({ title: u.title, topic: u.title, channel: ch, others, tags, links: ch.links });
      u.tags = tags.join(', ');
      render(); toast('✨ Descripción y etiquetas listas', 'Revisa los capítulos y los «…».');
    },
    doUpload() { doUpload(); },
    cancelUpload() { if (UI.uploading && UI.uploading.job && confirm('¿Cancelar la subida?')) UI.uploading.job.abort(); },
    agentTab(el) { go('agente', el.dataset.tab); },
    agentCh(el) { UI.agentCh = Number(el.dataset.slot); render(); },
    promoSlot(el) { UI.promoSlot = Number(el.dataset.slot); UI.promoVid = ''; render(); },
    viralSearch() { viralSearch(); },
    viralIdea(el) {
      const slot = UI.agentCh, x = S.viral[slot].items[Number(el.dataset.i)];
      S.plan.push({ id: uid(), title: `Mi versión: ${x.title}`.slice(0, 100), ch: slot, type: x.short ? 'short' : 'largo', stage: 'idea', date: '', time: '', notes: `Inspirado en «${x.title}» de ${x.channelTitle} (${fmt(x.views)} visitas)${x.demo ? '' : ' https://youtu.be/' + x.id}\n\n¿Qué haré diferente o mejor?\n- `, desc: '', tags: x.tags || [] });
      save(); toast('💡 Idea guardada en el tablero');
    },
    copyTags() { const v = S.viral[UI.agentCh]; copy(AGENT.patterns(v.items).tags.slice(0, 18).join(', ')); },
    collabMsg(el) {
      const ch = S.channels[UI.agentCh];
      const msg = `¡Hola, ${el.dataset.name}! Soy ${S.settings.name || '…'} de ${ch.title || 'mi canal'}${ch.handle ? ' (youtube.com/' + ch.handle + ')' : ''}. Me encanta tu contenido y creo que a nuestros públicos les gustaría un vídeo juntos. Tengo una idea: … ¿Te apetece que lo hablemos? 🙌`;
      openSheet(`${sheetHead('Propuesta de colaboración')}<p class="small muted">Envíala por el correo de empresa de su canal (pestaña «Más información») o por Instagram. Personalízala: los mensajes copiados en masa no funcionan.</p><div class="copybox">${esc(msg)}</div><div class="foot"><button class="btn primary" data-act="copyText" data-t="${esc(msg)}">📋 Copiar</button></div>`);
    },
    ideasFrom(el) { closeSheet(); const slot = el.dataset.slot !== '' && el.dataset.slot != null ? Number(el.dataset.slot) : UI.agentCh; UI.agentCh = slot; UI.ideaTopic = el.dataset.t; UI.ideaRes = AGENT.titles(el.dataset.t, { keywords: kws(S.channels[slot]), viral: (S.viral[slot] || {}).items }); go('agente', 'ideas'); },
    genTitles() { UI.ideaTopic = $('#ideaTopic').value.trim(); if (!UI.ideaTopic) { toast('Escribe un tema'); return; } UI.ideaRes = AGENT.titles(UI.ideaTopic, { keywords: kws(S.channels[UI.agentCh]), viral: (S.viral[UI.agentCh] || {}).items }); render(); },
    titleToPlan(el) { S.plan.push({ id: uid(), title: el.dataset.t.slice(0, 100), ch: UI.agentCh, type: el.dataset.type || 'largo', stage: 'idea', date: '', time: '', notes: '', desc: '', tags: [] }); save(); toast('＋ Añadido al tablero', chName(UI.agentCh)); const mid = 'short-' + UI.agentCh; if (el.dataset.type === 'short' && AGENT.missions(S.channels, S.plan, dkey()).some(m => m.id === mid)) completeMission(mid); },
    copyText(el) { copy(el.dataset.t); },
    promoFor(el) { closeSheet(); UI.promoSlot = Number(el.dataset.slot); UI.promoVid = el.dataset.vid; go('agente', 'promo'); },
    promoShared() { const mid = 'promo-' + UI.promoSlot; if (AGENT.missions(S.channels, S.plan, dkey()).some(m => m.id === mid)) setTimeout(() => completeMission(mid), 800); },
    shareNative() {
      const ch = S.channels[UI.promoSlot]; const v = (ch.recent || []).find(x => x.id === UI.promoVid) || (ch.recent || [])[0];
      if (!v) return;
      const url = v.id.startsWith('demo') ? '' : 'https://youtu.be/' + v.id;
      if (navigator.share) navigator.share({ title: v.title, text: `${v.title} — nuevo vídeo en ${ch.title}`, url: url || undefined }).then(() => ACT.promoShared()).catch(() => {});
      else copy(`${v.title} ${url}`);
    },
    loadComments() { loadComments(); },
    sendReply(el) { sendReply(el.dataset.id); },
    chatSend(el) { chatSend(el.dataset.t); },
    chatClear() { S.chat = []; save(); render(); },
    chColor(el) { S.channels[Number(el.dataset.slot)].color = el.dataset.c; save(); render(); },
    export() {
      const blob = new Blob([JSON.stringify(Object.assign({}, S, { settings: Object.assign({}, S.settings, { apiKey: '' }) }), null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `canales-${dkey()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },
    import() { $('#fileImport').click(); },
    wipe() { if (!confirm('¿Borrar todos los datos de la app? (No se toca nada en YouTube)')) return; [0, 1, 2].forEach(i => YT.signOut(i)); S = DEF(); save(); render(); toast('Datos borrados'); }
  };

  const INPUT = {
    upTitle(el) { UI.up.title = el.value; const ch = S.channels[UI.up.slot]; const ts = AGENT.scoreTitle(el.value, { keywords: kws(ch) }); const sc = $('#tScore'); if (sc) { sc.textContent = ts.score; sc.className = 'score ' + scoreCls(ts.score); $('#tTips').textContent = ts.tips[0] || '¡Buen título!'; } const lbl = el.closest('label').querySelector('span span'); if (lbl) lbl.textContent = el.value.length + '/100'; },
    upDesc(el) { UI.up.desc = el.value; },
    upTags(el) { UI.up.tags = el.value; },
    upPrivacy(el) { UI.up.privacy = el.value; if (el.value === 'schedule' && !UI.up.when) { const a = AGENT.analyze(S.channels[UI.up.slot]); const d = new Date(Date.now() + 86400000); if (a && a.bestDayN != null) { while (d.getDay() !== a.bestDayN) d.setDate(d.getDate() + 1); d.setHours(a.bestHour ?? 18, 0, 0, 0); } else d.setHours(18, 0, 0, 0); UI.up.when = `${dkey(d)}T${pad(d.getHours())}:00`; } render(); },
    upCat(el) { UI.up.cat = el.value; },
    upWhen(el) { UI.up.when = el.value; },
    upPlaylist(el) { UI.up.playlist = el.value; },
    upKids(el) { UI.up.kids = el.checked; },
    titleTest(el) { UI.titleTest = el.value; const o = $('#ttOut'); if (o) o.innerHTML = el.value ? ttHtml(AGENT.scoreTitle(el.value, { keywords: kws(S.channels[UI.agentCh]) })) : ''; },
    promoVid(el) { UI.promoVid = el.value; render(); },
    sName(el) { S.settings.name = el.value.trim().slice(0, 30); save(); },
    sClient(el) { S.settings.clientId = el.value.trim(); save(); },
    sKey(el) { S.settings.apiKey = el.value.trim(); YT.setKey(S.settings.apiKey); save(); },
    sRegion(el) { S.settings.region = el.value; save(); },
    sLang(el) { S.settings.lang = el.value; save(); },
    sEngine(el) { S.settings.aiEngine = el.value; save(); },
    chNiche(el) { S.channels[+el.dataset.slot].niche = el.value; save(); },
    chKw(el) { S.channels[+el.dataset.slot].keywords = el.value; save(); },
    chGoal(el) { S.channels[+el.dataset.slot].goal = Math.max(0, parseInt(el.value, 10) || 0); save(); },
    chWeek(el) { S.channels[+el.dataset.slot].perWeek = Math.min(21, Math.max(1, parseInt(el.value, 10) || 1)); save(); }
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) { if (e.target.id === 'sheet') closeSheet(); return; }
    const a = ACT[el.dataset.act];
    if (!a) return;
    if (el.tagName !== 'A' || el.getAttribute('href') === '#') e.preventDefault();
    a(el, e);
  });
  document.addEventListener('input', e => { const f = INPUT[e.target.dataset && e.target.dataset.in]; if (f && e.target.type !== 'checkbox' && e.target.tagName !== 'SELECT') f(e.target); });
  document.addEventListener('change', e => {
    const t = e.target;
    const f = INPUT[t.dataset && t.dataset.in];
    if (f && (t.type === 'checkbox' || t.tagName === 'SELECT')) f(t);
    if (t.id === 'fileVideo') { setVideoFile(t.files[0]); t.value = ''; }
    if (t.id === 'fileThumb') {
      const f2 = t.files[0]; t.value = '';
      if (!f2) return;
      if (f2.size > 2 * 1048576) { toast('Miniatura demasiado grande', 'Máximo 2 MB (JPG o PNG).'); return; }
      if (UI.up.thumbUrl) URL.revokeObjectURL(UI.up.thumbUrl);
      UI.up.thumb = f2; UI.up.thumbUrl = URL.createObjectURL(f2); render();
    }
    if (t.id === 'fileImport') {
      const f3 = t.files[0]; t.value = '';
      if (!f3) return;
      f3.text().then(txt => { const d = JSON.parse(txt); if (!d || !Array.isArray(d.channels)) throw new Error(); const key = S.settings.apiKey; S = Object.assign(DEF(), d); S.settings = Object.assign(DEF().settings, d.settings, { apiKey: key }); save(); render(); toast('✅ Copia importada'); }).catch(() => toast('Ese archivo no es una copia de Canales'));
    }
  });
  document.addEventListener('submit', e => {
    e.preventDefault();
    if (e.target.id === 'planForm') { readPlanForm(); closeSheet(); render(); toast('💾 Guardado'); }
    if (e.target.id === 'chatForm') { const i = $('#chatIn'); chatSend(i.value); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
  window.addEventListener('beforeunload', e => { if (UI.uploading) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- datos públicos de tus canales (sin iniciar sesión) ----------
  let PUB_AT = '';
  function loadPublic() {
    return fetch('data/canales.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => {
      if (!d || !Array.isArray(d.channels)) return;
      PUB_AT = new Date(d.updated + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
      let changed = false;
      d.channels.forEach((p, i) => {
        const ch = S.channels[i];
        if (!ch || (ch.title && !ch.pub && !ch.demo)) return; // ya hay sesión real: manda la sesión
        if (ch.pub && ch.pubAt === d.updated) return;
        Object.assign(ch, p, { pub: true, demo: false, pubAt: d.updated, uploads: '' });
        delete S.viral[i];
        changed = true;
      });
      if (changed) { save(); render(); }
    }).catch(() => {});
  }

  // ---------- arranque ----------
  const h = (location.hash || '').slice(1).split('/');
  if (NAV.some(n => n[0] === h[0])) { UI.view = h[0]; if (h[1] && AGENT_TABS.some(t => t[0] === h[1])) UI.agentTab = h[1]; }
  rollMissions();
  render();
  loadPublic();
  initAI();
  // Refresca en segundo plano los canales con sesión activa si los datos tienen más de 2 h
  setTimeout(() => S.channels.forEach((c, i) => { if (c.title && !ro(c) && connected(i) && (!c.fetchedAt || Date.now() - c.fetchedAt > 7200000)) refresh(i, true); }), 1200);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
