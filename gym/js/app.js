/* GYM — rutinas, biblioteca animada, entreno en vivo, historial y progreso. Todo se guarda en el dispositivo. */
(function () {
  'use strict';
  const D = window.GYMDATA, AN = window.ANIM;
  const KEY = 'gym-app-v1';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
  const r1 = n => Math.round(n * 10) / 10;
  const pad2 = n => String(n).padStart(2, '0');
  const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const DAYS_S = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const COLORS = ['#5ad1ff', '#ff6b81', '#7be495', '#ffb04d', '#c792ea', '#f78fb3', '#56e0c8', '#a3b1c2'];
  const dow = (d = new Date()) => (d.getDay() + 6) % 7;
  const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
  const weekStart = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - dow(d)); return d.getTime(); };
  const fmtDate = t => { const d = new Date(t); return `${DAYS[dow(d)].toLowerCase()} ${d.getDate()} de ${MONTHS[d.getMonth()]}`; };
  const fmtShort = t => { const d = new Date(t); return `${d.getDate()}/${d.getMonth() + 1}`; };
  const fmtClock = ms => { const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return (h ? h + ':' + pad2(m) : m) + ':' + pad2(s % 60); };
  const fmtDur = ms => { const m = Math.round(ms / 60000); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; };
  const fmtKg = n => (Math.round(n * 10) / 10).toLocaleString('es-ES');
  const e1rm = (kg, reps) => reps <= 0 || kg <= 0 ? 0 : reps === 1 ? kg : kg * (1 + reps / 30);

  // ---------- estado ----------
  const fresh = () => ({
    v: 1, profile: { name: '', goal: 4, rest: 90, sound: true, vibrate: true },
    routines: [], workouts: [], live: null, custom: [], bw: [], fav: [], chat: []
  });
  let S;
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  if (!S || !S.v) S = fresh();
  S = Object.assign(fresh(), S);
  S.profile = Object.assign(fresh().profile, S.profile);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('No se pudo guardar: almacenamiento lleno'); } };

  const EX = {};
  const indexEx = () => { D.EXERCISES.forEach(e => { EX[e.id] = e; }); S.custom.forEach(e => { EX[e.id] = e; }); };
  indexEx();
  const exOf = id => EX[id] || { id, n: 'Ejercicio eliminado', g: '', a: 'generic', e: [], p: [], s: [], t: 'r', steps: [], errs: [] };

  const UI = { tab: (location.hash.slice(1) || 'hoy').split('/')[0], sheets: [], libQ: '', libG: 'Todos', libFav: false, histTab: 'entrenos', calMonth: null, liveOpen: false, progEx: '' };
  if (!['hoy', 'rutinas', 'ejercicios', 'gymbro', 'historial', 'perfil'].includes(UI.tab)) UI.tab = 'hoy';

  // ---------- utilidades de historial ----------
  const doneSets = it => (it.sets || []).filter(s => s.done);
  function sessionsOf(exId) {
    const out = [];
    for (const w of S.workouts) for (const it of w.items) if (it.ex === exId && doneSets(it).length) out.push({ w, it, date: w.start });
    return out.sort((a, b) => b.date - a.date);
  }
  function bestOf(exId, before = Infinity) {
    let best = null;
    for (const { it, date } of sessionsOf(exId)) {
      if (date >= before) continue;
      for (const s of doneSets(it)) {
        const kg = num(s.kg), reps = num(s.reps), v = e1rm(kg, reps);
        if (!best || v > best.e1 || (v === best.e1 && kg > best.kg)) best = { kg, reps, e1: v, date };
      }
    }
    return best;
  }
  const maxKg = (exId, before = Infinity) => sessionsOf(exId).filter(x => x.date < before).reduce((m, { it }) => Math.max(m, ...doneSets(it).map(s => num(s.kg))), 0);
  const workoutVolume = w => w.items.reduce((v, it) => exOf(it.ex).t === 'r' ? v + doneSets(it).reduce((a, s) => a + num(s.kg) * num(s.reps), 0) : v, 0);
  const workoutSets = w => w.items.reduce((n, it) => n + doneSets(it).length, 0);

  // ---------- mapa muscular (vista frontal y posterior) ----------
  const shift = (x0, list) => list.map(sh => sh[0] === 'p' ? ['p', sh[1].replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (m, x, y) => `${+x + x0} ${y}`)] : [sh[0], sh[1] + x0, ...sh.slice(2)]);
  const BODY_FRONT = {
    _base: [['c', 50, 15, 9], ['r', 45.5, 23, 9, 8, 2], ['p', 'M33 35 Q50 30 67 35 L66 95 Q50 102 34 95 Z'], ['p', 'M34 92 Q50 100 66 92 L67 110 Q50 116 33 110 Z'], ['c', 19, 94, 3.6], ['c', 81, 94, 3.6], ['c', 41.5, 149, 5], ['c', 58.5, 149, 5], ['e', 40.5, 185, 6, 3], ['e', 59.5, 185, 6, 3]],
    delts: [['e', 31, 41, 7.5, 6.5], ['e', 69, 41, 7.5, 6.5]],
    chest: [['p', 'M50 37 Q40 35 35 42 Q35 52 42 55 Q48 55 50 52 Z'], ['p', 'M50 37 Q60 35 65 42 Q65 52 58 55 Q52 55 50 52 Z']],
    biceps: [['e', 26, 57, 4.8, 10], ['e', 74, 57, 4.8, 10]],
    forearms: [['e', 22, 80, 4.2, 11], ['e', 78, 80, 4.2, 11]],
    abs: [['r', 44, 57, 12, 31, 4]],
    obliques: [['e', 38.5, 72, 3.8, 12], ['e', 61.5, 72, 3.8, 12]],
    adductors: [['e', 47.3, 117, 2.6, 10], ['e', 52.7, 117, 2.6, 10]],
    quads: [['e', 41.5, 128, 7.3, 19], ['e', 58.5, 128, 7.3, 19]],
    calves: [['e', 40.5, 167, 5, 14], ['e', 59.5, 167, 5, 14]],
    tibialis: [['e', 42.5, 165, 2.2, 11], ['e', 57.5, 165, 2.2, 11]]
  };
  const BODY_BACK = {
    _base: [['c', 50, 15, 9], ['r', 45.5, 23, 9, 8, 2], ['p', 'M33 35 Q50 30 67 35 L66 95 Q50 102 34 95 Z'], ['c', 19, 94, 3.6], ['c', 81, 94, 3.6], ['c', 41.5, 151, 5], ['c', 58.5, 151, 5], ['e', 40.5, 185, 6, 3], ['e', 59.5, 185, 6, 3]],
    traps: [['p', 'M50 28 L39 35 L44 44 L50 56 L56 44 L61 35 Z']],
    rear: [['e', 31, 41, 7.5, 6.5], ['e', 69, 41, 7.5, 6.5]],
    rotator: [['e', 39, 47, 4, 3], ['e', 61, 47, 4, 3]],
    upperback: [['p', 'M43 46 L50 57 L57 46 L59 58 L50 66 L41 58 Z']],
    lats: [['p', 'M35 47 L41 50 L46 80 L39 75 Q34 62 35 47 Z'], ['p', 'M65 47 L59 50 L54 80 L61 75 Q66 62 65 47 Z']],
    lowerback: [['r', 44.5, 70, 11, 21, 4]],
    triceps: [['e', 26, 57, 4.8, 10], ['e', 74, 57, 4.8, 10]],
    forearms: [['e', 22, 80, 4.2, 11], ['e', 78, 80, 4.2, 11]],
    abductors: [['e', 33.5, 100, 3, 7.5], ['e', 66.5, 100, 3, 7.5]],
    glutes: [['e', 42.5, 105, 8.5, 9], ['e', 57.5, 105, 8.5, 9]],
    hamstrings: [['e', 41.5, 134, 7, 16], ['e', 58.5, 134, 7, 16]],
    calves: [['e', 40.5, 166, 5.5, 12.5], ['e', 59.5, 166, 5.5, 12.5]]
  };
  function shapeSVG(sh, fill) {
    if (sh[0] === 'c') return `<circle cx="${sh[1]}" cy="${sh[2]}" r="${sh[3]}" fill="${fill}"/>`;
    if (sh[0] === 'e') return `<ellipse cx="${sh[1]}" cy="${sh[2]}" rx="${sh[3]}" ry="${sh[4]}" fill="${fill}"/>`;
    if (sh[0] === 'r') return `<rect x="${sh[1]}" y="${sh[2]}" width="${sh[3]}" height="${sh[4]}" rx="${sh[5]}" fill="${fill}"/>`;
    return `<path d="${sh[1]}" fill="${fill}"/>`;
  }
  function bodyMap(fillOf, label) {
    const view = (map, x0) => Object.entries(map).map(([m, list]) => shift(x0, list).map(sh => shapeSVG(sh, m === '_base' ? 'var(--body)' : fillOf(m))).join('')).join('');
    return `<svg class="body-map" viewBox="0 0 210 196" role="img" aria-label="${esc(label)}">${view(BODY_FRONT, 0)}${view(BODY_BACK, 110)}<text x="50" y="196" class="bm-t">Delante</text><text x="160" y="196" class="bm-t">Detrás</text></svg>`;
  }
  const exBodyMap = e => { const P = new Set(e.p), Sc = new Set(e.s); return bodyMap(m => P.has(m) ? 'var(--mp)' : Sc.has(m) ? 'var(--ms)' : 'var(--muscle)', 'Trabaja: ' + e.p.map(m => D.MUSCLES[m]).join(', ')); };
  const muscleChips = e => `${e.p.map(m => `<span class="badge mp">${esc(D.MUSCLES[m])}</span>`).join('')}${e.s.map(m => `<span class="badge ms">${esc(D.MUSCLES[m])}</span>`).join('')}`;
  const anim = (e, cls = '') => `<div class="anim ${cls}" data-anim="${esc(e.a)}" data-ex="${esc(e.id)}"></div>`;

  // ---------- gráficos ----------
  function lineChart(pts, unit = '') {
    if (pts.length < 2) return '<div class="muted small center pad">Necesitas al menos 2 registros para ver la gráfica.</div>';
    const W = 320, H = 140, P = 26;
    const ys = pts.map(p => p.y), lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
    const X = i => P + (W - P - 8) * i / (pts.length - 1), Y = v => H - 20 - (H - 34) * (v - lo) / span;
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');
    const area = `${d} L${X(pts.length - 1).toFixed(1)} ${H - 20} L${X(0).toFixed(1)} ${H - 20} Z`;
    const step = Math.ceil(pts.length / 6);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img"><path d="${area}" class="ch-area"/><path d="${d}" class="ch-line"/>
      ${pts.map((p, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3" class="ch-dot"/>`).join('')}
      <text x="2" y="${Y(hi) + 4}" class="ch-t">${fmtKg(hi)}</text><text x="2" y="${Y(lo) + 4}" class="ch-t">${fmtKg(lo)}</text>
      ${pts.map((p, i) => i % step === 0 || i === pts.length - 1 ? `<text x="${X(i).toFixed(1)}" y="${H - 4}" class="ch-t" text-anchor="middle">${esc(p.x)}</text>` : '').join('')}
      <text x="${W - 4}" y="12" class="ch-t" text-anchor="end">${esc(unit)}</text></svg>`;
  }
  function barChart(pts, unit = '') {
    const W = 320, H = 140, hi = Math.max(1, ...pts.map(p => p.y)), bw = (W - 20) / pts.length;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${pts.map((p, i) => {
      const h = (H - 36) * p.y / hi, x = 10 + i * bw;
      return `<rect x="${(x + bw * .18).toFixed(1)}" y="${(H - 20 - h).toFixed(1)}" width="${(bw * .64).toFixed(1)}" height="${Math.max(1.5, h).toFixed(1)}" rx="3" class="${i === pts.length - 1 ? 'ch-bar now' : 'ch-bar'}"/>
        <text x="${(x + bw / 2).toFixed(1)}" y="${H - 5}" class="ch-t" text-anchor="middle">${esc(p.x)}</text>${p.y ? `<text x="${(x + bw / 2).toFixed(1)}" y="${(H - 24 - h).toFixed(1)}" class="ch-t" text-anchor="middle">${esc(p.label ?? p.y)}</text>` : ''}`;
    }).join('')}<text x="${W - 4}" y="12" class="ch-t" text-anchor="end">${esc(unit)}</text></svg>`;
  }

  // ---------- vistas ----------
  const todayRoutines = (d = dow()) => S.routines.filter(r => (r.days || []).includes(d));
  const routineMuscles = r => [...new Set(r.items.flatMap(it => exOf(it.ex).p))];
  const estMin = r => Math.round(r.items.reduce((m, it) => m + (exOf(it.ex).t === 'c' ? 20 : it.sets * (0.8 + (it.rest || S.profile.rest) / 60)), 0));

  function routineCard(r) {
    const ms = routineMuscles(r).slice(0, 4).map(m => D.MUSCLES[m]).join(' · ');
    return `<div class="card rcard" style="--rc:${esc(r.color)}">
      <div class="row between top"><div class="grow" data-act="editRoutine" data-id="${r.id}">
        <div class="rname">${esc(r.name)}</div>
        <div class="muted small">${r.items.length} ejercicios · ~${estMin(r)} min${(r.days || []).length ? ' · ' + r.days.slice().sort().map(d => DAYS_S[d]).join(' ') : ''}</div>
        ${ms ? `<div class="small dim mt4">${esc(ms)}</div>` : ''}</div>
        <button class="icon-btn" data-act="routineMenu" data-id="${r.id}" aria-label="Más opciones">⋯</button></div>
      <div class="thumbs" data-act="editRoutine" data-id="${r.id}">${r.items.slice(0, 5).map(it => `<div class="thumb">${AN.svg(exOf(it.ex).a, exOf(it.ex), .5)}</div>`).join('')}${r.items.length > 5 ? `<div class="thumb more">+${r.items.length - 5}</div>` : ''}</div>
      <button class="btn primary block" data-act="startRoutine" data-id="${r.id}">▶ Empezar</button></div>`;
  }

  function viewHoy() {
    const p = S.profile, now = new Date(), wk = weekStart();
    const weekW = S.workouts.filter(w => w.start >= wk);
    const daysDone = new Set(weekW.map(w => dow(new Date(w.start))));
    let streak = 0;
    for (let w = wk; ; w -= 7 * 864e5) { const has = S.workouts.some(x => x.start >= w && x.start < w + 7 * 864e5); if (has) streak++; else if (w !== wk) break; if (streak > 200) break; }
    const tr = todayRoutines();
    const last = S.workouts.slice().sort((a, b) => b.start - a.start)[0];
    const pct = Math.min(1, weekW.length / (p.goal || 1));
    return `
      <header class="hero">
        <img src="icons/icon-192.png" alt="" class="avatar">
        <div class="grow"><div class="muted small">${esc(fmtDate(now))}</div><h1>${p.name ? 'Hola, ' + esc(p.name) : '¡A entrenar!'}</h1></div>
      </header>
      ${!p.name ? `<div class="card"><b>Bienvenido 👋</b><p class="muted small">¿Cómo te llamas? Así personalizo la app.</p><div class="row"><input id="nameIn" placeholder="Tu nombre" maxlength="24"><button class="btn primary" data-act="saveName">Guardar</button></div></div>` : ''}
      ${S.live ? `<div class="card live-card" data-act="openLive"><div class="row between"><div><div class="small accent">● Entreno en curso</div><b>${esc(S.live.name)}</b></div><span class="timer" data-clock>${fmtClock(Date.now() - S.live.start)}</span></div></div>` : ''}
      <div class="card">
        <div class="row between"><div><div class="muted small">Esta semana</div><div class="big-n">${weekW.length}<span class="muted"> / ${p.goal} entrenos</span></div></div>
          <div class="ring" style="--p:${pct}"><span>${streak ? '🔥' + streak : '💪'}</span></div></div>
        <div class="week">${DAYS_S.map((d, i) => `<div class="wd ${daysDone.has(i) ? 'on' : ''} ${i === dow() ? 'today' : ''}"><span>${d}</span><i>${daysDone.has(i) ? '✓' : todayRoutines(i).length ? '•' : ''}</i></div>`).join('')}</div>
        ${streak ? `<div class="small muted mt8">${streak} ${streak === 1 ? 'semana' : 'semanas'} seguidas entrenando</div>` : ''}
      </div>
      <div class="sec">Hoy · ${DAYS[dow()]}</div>
      ${tr.length ? tr.map(routineCard).join('') : `<div class="card empty"><div class="emoji">🛌</div><div>No tienes rutina asignada para hoy.</div>
        <div class="row center wrap mt8"><button class="btn primary" data-act="startEmpty">▶ Entreno libre</button>${S.routines.length ? `<button class="btn" data-act="tab" data-tab="rutinas">Elegir rutina</button>` : `<button class="btn" data-act="newRoutine">+ Crear rutina</button>`}</div></div>`}
      <div class="card bro-card" data-act="askBro" data-q="¿Qué entreno hoy?"><img src="icons/icon-192.png" alt="" class="avatar sm"><div class="grow"><b>GymBro</b><div class="small muted">Pregúntame qué entrenar, técnica, rutinas, dieta…</div></div><span class="btn sm primary">Hablar</span></div>
      ${last ? `<div class="sec">Último entreno</div>${workoutRow(last)}` : ''}`;
  }

  function viewRutinas() {
    return `<div class="row between"><h1 class="title">Rutinas</h1><button class="btn" data-act="templates">📋 Plantillas</button></div>
      <div class="card"><div class="small muted">Tu semana</div><div class="planner">${DAYS.map((d, i) => { const rs = todayRoutines(i); return `<div class="pday ${i === dow() ? 'today' : ''}"><b>${DAYS_S[i]}</b>${rs.length ? rs.map(r => `<span class="pchip" style="--rc:${esc(r.color)}" data-act="editRoutine" data-id="${r.id}">${esc(r.name)}</span>`).join('') : '<span class="dim small">Descanso</span>'}</div>`; }).join('')}</div></div>
      ${S.routines.map(routineCard).join('') || `<div class="card empty"><div class="emoji">📝</div>Aún no tienes rutinas.<div class="small muted">Crea la tuya eligiendo ejercicios o parte de una plantilla.</div></div>`}
      <button class="btn primary block" data-act="newRoutine">+ Nueva rutina</button>
      <button class="btn block mt8" data-act="startEmpty">▶ Entreno libre (sin rutina)</button>`;
  }

  function libFilter(list) {
    const q = norm(UI.libQ);
    return list.filter(e => (UI.libG === 'Todos' || inGroup(e, UI.libG)) && (!q || norm([e.n, e.g, e.sg, e.v, ...e.p.map(m => D.MUSCLES[m]), ...(e.also || []).flat()].join(' ')).includes(q)) && (!UI.libFav || S.fav.includes(e.id)));
  }
  function libControls() {
    return `<input type="search" placeholder="🔍 Buscar ejercicio o músculo…" value="${esc(UI.libQ)}" data-in="libQ" id="libQ" autocomplete="off">
      <div class="chips">${['Todos', ...D.GROUPS].map(g => `<button class="chip ${g === UI.libG ? 'on' : ''}" data-act="libG" data-g="${esc(g)}">${g === 'Todos' ? 'Todos' : D.GROUP_ICON[g] + ' ' + esc(g)}</button>`).join('')}</div>
      <div class="chips"><button class="chip ${UI.libFav ? 'on' : ''}" data-act="libFav">★ Favoritos</button></div>`;
  }
  // Un ejercicio puede pertenecer a otros grupos además del suyo (p. ej. el paseo del granjero)
  const inGroup = (e, g) => e.g === g || (e.also || []).some(a => a[0] === g);
  const subOf = (e, g) => e.g === g ? (e.sg || 'Mis ejercicios') : ((e.also || []).find(a => a[0] === g) || [])[1];
  function exGrid(list, pick) {
    if (!list.length) return '<div class="card empty">No hay ejercicios con ese filtro.</div>';
    const card = e => {
      const on = pick && pick.has(e.id);
      return `<div class="excard ${on ? 'sel' : ''}" data-act="${pick ? 'pickToggle' : 'openEx'}" data-id="${e.id}">${anim(e)}
        ${pick ? `<span class="check">${on ? '✓' : '+'}</span>` : S.fav.includes(e.id) ? '<span class="star">★</span>' : ''}
        <div class="exn">${esc(e.n)}</div><div class="exm">${esc(e.p.map(m => D.MUSCLES[m]).join(', '))}</div></div>`;
    };
    const groups = UI.libG === 'Todos' ? D.GROUPS : [UI.libG];
    return groups.map(g => {
      const es = list.filter(e => UI.libG === 'Todos' ? e.g === g : inGroup(e, g));
      if (!es.length) return '';
      const subs = [...(D.SUBGROUPS[g] || []), 'Mis ejercicios'];
      const parts = subs.map(sg => { const xs = es.filter(e => subOf(e, g) === sg || (e.also || []).some(x => x[0] === g && x[1] === sg)).sort((a, b) => (a.g !== g) - (b.g !== g)); return xs.length ? `${subs.length > 2 ? `<div class="subsec">${esc(sg)} <span class="dim">${xs.length}</span></div>` : ''}<div class="grid">${xs.map(card).join('')}</div>` : ''; }).join('');
      return `<div class="sec">${D.GROUP_ICON[g] || '•'} ${esc(g)} <span class="dim">${es.length}</span></div>${parts}`;
    }).join('');
  }
  function viewEjercicios() {
    const all = Object.values(EX);
    const list = libFilter(all);
    return `<div class="row between"><h1 class="title">Ejercicios</h1><button class="btn sm" data-act="newExercise">+ Crear</button></div>
      ${libControls()}<div id="libList">${exGrid(list)}</div>`;
  }

  function workoutRow(w) {
    const prs = (w.prs || []).length;
    return `<div class="card wrow" data-act="openWorkout" data-id="${w.id}"><div class="row between"><div><b>${esc(w.name)}</b><div class="small muted">${esc(fmtDate(w.start))}</div></div>${prs ? `<span class="badge pr">🏆 ${prs}</span>` : ''}</div>
      <div class="stats3"><div><b>${fmtDur((w.end || w.start) - w.start)}</b><span>Duración</span></div><div><b>${fmtKg(workoutVolume(w))} kg</b><span>Volumen</span></div><div><b>${workoutSets(w)}</b><span>Series</span></div></div>
      <div class="small dim">${w.items.filter(it => doneSets(it).length).map(it => `${doneSets(it).length}× ${esc(exOf(it.ex).n)}`).slice(0, 4).join(' · ')}</div></div>`;
  }

  function calendar() {
    const now = new Date(), base = UI.calMonth ?? (now.getFullYear() * 12 + now.getMonth());
    const y = Math.floor(base / 12), m = base % 12, first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate();
    const trained = {};
    S.workouts.forEach(w => { const k = dayKey(w.start); trained[k] = (trained[k] || 0) + 1; });
    let cells = '';
    for (let i = 0; i < dow(first); i++) cells += '<i></i>';
    for (let d = 1; d <= days; d++) { const k = `${y}-${pad2(m + 1)}-${pad2(d)}`; cells += `<i class="${trained[k] ? 'on' : ''} ${k === dayKey(Date.now()) ? 'today' : ''}">${d}</i>`; }
    const count = S.workouts.filter(w => { const d = new Date(w.start); return d.getFullYear() === y && d.getMonth() === m; }).length;
    return `<div class="card"><div class="row between"><button class="icon-btn" data-act="calMove" data-d="-1" aria-label="Mes anterior">‹</button><b>${MONTHS[m][0].toUpperCase() + MONTHS[m].slice(1)} ${y} · <span class="accent">${count}</span> <span class="muted small">entrenos</span></b><button class="icon-btn" data-act="calMove" data-d="1" aria-label="Mes siguiente">›</button></div>
      <div class="cal">${DAYS_S.map(d => `<b>${d}</b>`).join('')}${cells}</div></div>`;
  }

  function viewHistorial() {
    const tabs = `<div class="seg"><button class="${UI.histTab === 'entrenos' ? 'on' : ''}" data-act="histTab" data-t="entrenos">Entrenos</button><button class="${UI.histTab === 'progreso' ? 'on' : ''}" data-act="histTab" data-t="progreso">Progreso</button></div>`;
    if (UI.histTab === 'entrenos') {
      const ws = S.workouts.slice().sort((a, b) => b.start - a.start);
      return `<h1 class="title">Historial</h1>${tabs}${calendar()}${ws.map(workoutRow).join('') || '<div class="card empty"><div class="emoji">📅</div>Cuando termines tu primer entreno aparecerá aquí.</div>'}`;
    }
    // progreso
    const weeks = [];
    for (let i = 7; i >= 0; i--) { const ws = weekStart() - i * 7 * 864e5; const v = S.workouts.filter(w => w.start >= ws && w.start < ws + 7 * 864e5).reduce((a, w) => a + workoutVolume(w), 0); weeks.push({ x: fmtShort(ws), y: Math.round(v), label: v >= 1000 ? r1(v / 1000) + 'k' : Math.round(v) }); }
    const bw = S.bw.slice().sort((a, b) => a.t - b.t);
    const used = [...new Set(S.workouts.flatMap(w => w.items.filter(it => doneSets(it).length && exOf(it.ex).t === 'r').map(it => it.ex)))];
    const prs = used.map(id => ({ id, b: bestOf(id) })).filter(x => x.b).sort((a, b) => b.b.date - a.b.date);
    const sel = UI.progEx && used.includes(UI.progEx) ? UI.progEx : used[0];
    return `<h1 class="title">Progreso</h1>${tabs}
      <div class="sec">Peso corporal</div>
      <div class="card"><div class="row"><input id="bwIn" type="number" inputmode="decimal" step="0.1" placeholder="Peso de hoy (kg)" value=""><button class="btn primary" data-act="addBW">Añadir</button></div>
        ${bw.length ? `<div class="row between mt8"><span class="muted small">Último: <b>${fmtKg(bw[bw.length - 1].kg)} kg</b></span>${bw.length > 1 ? `<span class="small ${bw[bw.length - 1].kg - bw[0].kg > 0 ? 'up' : 'down'}">${bw[bw.length - 1].kg - bw[0].kg > 0 ? '+' : ''}${fmtKg(bw[bw.length - 1].kg - bw[0].kg)} kg desde el inicio</span>` : ''}</div>${lineChart(bw.slice(-20).map(b => ({ x: fmtShort(b.t), y: b.kg })), 'kg')}
        <button class="link small" data-act="delBW">Borrar último registro</button>` : '<div class="small muted mt8">Apunta tu peso para ver la evolución.</div>'}</div>
      <div class="sec">Volumen semanal (kg × reps)</div>
      <div class="card">${barChart(weeks, 'kg')}</div>
      <div class="sec">Evolución por ejercicio</div>
      <div class="card">${used.length ? `<select data-in="progEx">${used.map(id => `<option value="${id}" ${id === sel ? 'selected' : ''}>${esc(exOf(id).n)}</option>`).join('')}</select>
        ${lineChart(sessionsOf(sel).slice().reverse().slice(-20).map(({ it, date }) => ({ x: fmtShort(date), y: r1(Math.max(...doneSets(it).map(s => e1rm(num(s.kg), num(s.reps))))) })), '1RM estimado (kg)')}` : '<div class="small muted">Completa series con peso para ver tu evolución.</div>'}</div>
      <div class="sec">Récords personales 🏆</div>
      <div class="card">${prs.length ? prs.map(({ id, b }) => `<div class="li" data-act="openEx" data-id="${id}"><div class="grow"><b>${esc(exOf(id).n)}</b><div class="small muted">${fmtKg(b.kg)} kg × ${b.reps} · ${esc(fmtShort(b.date))}</div></div><span class="badge">1RM ~${fmtKg(Math.round(b.e1))} kg</span></div>`).join('') : '<div class="small muted">Aún no hay récords.</div>'}</div>`;
  }

  function viewPerfil() {
    const p = S.profile;
    return `<h1 class="title">Perfil</h1>
      <div class="card profile"><img src="icons/icon-192.png" alt="" class="avatar lg"><div class="grow"><input value="${esc(p.name)}" placeholder="Tu nombre" data-in="name" maxlength="24"><div class="small muted mt4">${S.workouts.length} entrenos · ${S.routines.length} rutinas</div></div></div>
      <div class="sec">Objetivos y entreno</div>
      <div class="card">
        <div class="li"><div class="grow">Entrenos por semana</div><div class="stepper"><button data-act="goal" data-d="-1">−</button><b>${p.goal}</b><button data-act="goal" data-d="1">+</button></div></div>
        <div class="li"><div class="grow">Descanso por defecto</div><select data-in="rest">${[30, 45, 60, 75, 90, 120, 150, 180, 240].map(s => `<option value="${s}" ${s === p.rest ? 'selected' : ''}>${fmtClock(s * 1000)}</option>`).join('')}</select></div>
        <label class="li"><div class="grow">Sonido al acabar el descanso</div><input type="checkbox" class="sw" data-in="sound" ${p.sound ? 'checked' : ''}></label>
        <label class="li"><div class="grow">Vibración</div><input type="checkbox" class="sw" data-in="vibrate" ${p.vibrate ? 'checked' : ''}></label>
      </div>
      <div class="sec">Actualizaciones</div>
      ${window.APPUPDATE ? APPUPDATE.cardHTML() : ''}
      <div class="sec">Copia de seguridad</div>
      <div class="card"><div class="small muted">Tus datos solo se guardan en este dispositivo. Exporta una copia de vez en cuando.</div>
        <div class="row mt8"><button class="btn grow" data-act="export">⬇️ Exportar</button><label class="btn grow">⬆️ Importar<input type="file" accept="application/json,.json" id="importIn" hidden></label></div>
        <button class="btn danger block mt8" data-act="reset">Borrar todos los datos</button></div>
      <div class="small dim center mt8">Mi Gym · v<span data-upd-ver>${(window.APPUPDATE && APPUPDATE.version) || '1'}</span></div>`;
  }

  // ---------- GymBro ----------
  const GB = window.createGymBro({ EX, state: () => S, exOf, sessionsOf, bestOf, maxKg, e1rm, doneSets, num, fmtKg, fmtDate, DAYS, dow, uid, COLORS });
  function broMsg(m, i) {
    const used = m.used || [];
    return `<div class="msg ${m.from}">${m.from === 'bot' ? '<img src="icons/icon-192.png" alt="" class="msg-av">' : ''}<div class="bubble">${m.from === 'bot' ? m.html : esc(m.text)}
      ${(m.actions || []).length ? `<div class="msg-acts">${m.actions.map((a, k) => `<button class="chip ${used.includes(k) ? 'done' : ''}" data-act="broAct" data-m="${i}" data-a="${k}" ${used.includes(k) ? 'disabled' : ''}>${used.includes(k) ? '✓ ' : ''}${esc(a.label)}</button>`).join('')}</div>` : ''}</div></div>`;
  }
  function viewGymBro() {
    if (!S.chat.length) S.chat.push({ from: 'bot', html: GB.reply('ayuda').html, actions: GB.SUGGEST });
    return `<div class="bro-head"><img src="icons/icon-192.png" alt="" class="avatar"><div class="grow"><h1>GymBro</h1><div class="small muted">Tu compañero de gym · funciona sin conexión</div></div><button class="icon-btn" data-act="broClear" aria-label="Borrar conversación">🗑</button></div>
      <div class="chat" id="chat">${S.chat.map(broMsg).join('')}</div>
      <form class="bro-in" id="broForm"><div class="chips">${['¿Qué entreno hoy?', 'Rutina de pierna 1 hora', 'Plan de 4 días', '¿Cuánta proteína necesito?', 'Alternativas a la prensa', '100 kg x 5', 'Estoy estancado'].map(q => `<button type="button" class="chip" data-act="askBro" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
        <div class="row"><input id="broIn" placeholder="Pregúntale a GymBro…" autocomplete="off" enterkeyhint="send"><button class="btn primary" type="submit" aria-label="Enviar">➤</button></div></form>`;
  }
  function broScroll() { requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight)); }
  function broSay(text) {
    text = String(text || '').trim();
    if (!text) return;
    S.chat.push({ from: 'me', text });
    let r;
    try { r = GB.reply(text); } catch (e) { r = { html: 'Uy, algo ha fallado al responder. Prueba a decirlo de otra forma.', actions: [] }; }
    S.chat.push({ from: 'bot', html: r.html, actions: r.actions });
    if (S.chat.length > 80) S.chat = S.chat.slice(-80);
    save();
    if (UI.tab !== 'gymbro') { UI.tab = 'gymbro'; history.replaceState(history.state, '', '#gymbro'); }
    renderView(); broScroll();
  }
  const cloneRoutine = r => Object.assign(JSON.parse(JSON.stringify(r)), { id: uid() });
  function broAct(b) {
    const m = S.chat[+b.dataset.m], k = +b.dataset.a, a = m && m.actions[k];
    if (!a) return;
    const mark = () => { m.used = [...(m.used || []), k]; save(); };
    const p = a.payload;
    switch (a.type) {
      case 'ask': return broSay(p);
      case 'openEx': return openSheet({ type: 'ex', id: p });
      case 'startEmpty': return startWorkout('Entreno libre', [], null);
      case 'startRoutineId': { const r = S.routines.find(x => x.id === p); if (r) startWorkout(r.name, r.items.map(it => makeItem(it.ex, it.sets, it.reps, it.rest, it.note)), r.id); return; }
      case 'startRoutine': return startWorkout(p.name, p.items.map(it => makeItem(it.ex, it.sets, it.reps, it.rest, it.note)), null);
      case 'saveRoutine': { const r = cloneRoutine(p); S.routines.push(r); mark(); renderView(); toast(`Rutina “${r.name}” guardada ✓`); return; }
      case 'editRoutine': { const r = cloneRoutine(p); S.routines.push(r); mark(); save(); renderView(); openSheet({ type: 'routine', draft: JSON.parse(JSON.stringify(r)) }); return; }
      case 'savePlan': { p.forEach(r => S.routines.push(cloneRoutine(r))); mark(); renderView(); toast(`${p.length} rutinas creadas y asignadas a sus días ✓`); return; }
    }
  }

  // ---------- hojas (detalle, editor, selector…) ----------
  function sheetEx(sh) {
    const e = exOf(sh.id), hist = sessionsOf(e.id), b = bestOf(e.id), fav = S.fav.includes(e.id);
    const tipo = { r: 'Peso × repeticiones', a: 'Asistida: apunta los kg de ayuda', b: 'Peso corporal', t: 'Por tiempo', c: 'Cardio: minutos y distancia' }[e.t];
    return `<div class="sh-head"><button class="icon-btn" data-act="closeSheet" aria-label="Cerrar">✕</button><b class="grow center">${esc(e.g)}</b><button class="icon-btn ${fav ? 'accent' : ''}" data-act="fav" data-id="${e.id}" aria-label="Favorito">${fav ? '★' : '☆'}</button></div>
      <div class="anim-wrap">${anim(e, 'big')}<div class="anim-ctl"><button class="chip" data-act="animPause">⏸ Pausa</button><button class="chip" data-act="animSpeed">🐢 Lento</button></div></div>
      <h2>${esc(e.n)}</h2>
      ${e.sg ? `<div class="small muted">${esc(e.g)} · ${esc(e.sg)}${(e.also || []).length ? ' · también en ' + e.also.map(a => esc(a[1])).join(', ') : ''}</div>` : ''}
      ${e.v ? `<div class="small mt4"><b>Variantes:</b> ${esc(e.v)}</div>` : ''}
      <div class="chips wrap">${muscleChips(e)}</div>
      <div class="legend"><span><i style="background:var(--mp)"></i>Principal</span><span><i style="background:var(--ms)"></i>Secundario</span></div>
      <div class="card">${exBodyMap(e)}</div>
      <div class="small muted">${e.e.map(k => (D.EQUIP[k] || ['?', ''])[1] + ' ' + (D.EQUIP[k] || [k])[0]).join(' · ')}${tipo ? ' · ' + tipo : ''}</div>
      ${e.steps.length ? `<div class="sec">Cómo hacerlo</div><ol class="steps">${e.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
      ${e.errs.length ? `<div class="sec">Errores comunes</div><ul class="errs">${e.errs.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
      <div class="sec">Tu historial</div>
      ${hist.length ? `<div class="card">${b && e.t === 'r' ? `<div class="stats3"><div><b>${fmtKg(maxKg(e.id))} kg</b><span>Máximo</span></div><div><b>${fmtKg(Math.round(b.e1))} kg</b><span>1RM estimado</span></div><div><b>${hist.length}</b><span>Sesiones</span></div></div>` : ''}
        ${e.t === 'r' ? lineChart(hist.slice().reverse().slice(-15).map(({ it, date }) => ({ x: fmtShort(date), y: r1(Math.max(...doneSets(it).map(s => e1rm(num(s.kg), num(s.reps))))) })), '1RM est.') : ''}
        ${hist.slice(0, 5).map(({ it, date }) => `<div class="li"><span class="small muted" style="width:52px">${fmtShort(date)}</span><div class="grow small">${doneSets(it).map(s => setText(e, s)).join(' · ')}</div></div>`).join('')}</div>` : '<div class="card small muted">Aún no lo has hecho. ¡Añádelo a una rutina!</div>'}
      <div class="sh-foot">${S.live ? `<button class="btn primary grow" data-act="addToLive" data-id="${e.id}">+ Al entreno</button>` : ''}<button class="btn ${S.live ? '' : 'primary'} grow" data-act="addToRoutine" data-id="${e.id}">+ A una rutina</button>${e.custom ? `<button class="btn danger" data-act="delExercise" data-id="${e.id}">Borrar</button>` : ''}</div>`;
  }
  const setText = (e, s) => e.t === 'c' ? `${num(s.min)} min${num(s.km) ? ' · ' + fmtKg(num(s.km)) + ' km' : ''}` : e.t === 't' ? `${num(s.sec)} s` : e.t === 'a' ? `${num(s.reps)} reps (−${fmtKg(num(s.kg))} kg)` : e.t === 'b' && !num(s.kg) ? `${num(s.reps)} reps` : `${fmtKg(num(s.kg))}×${num(s.reps)}`;

  function sheetRoutine(sh) {
    const r = sh.draft;
    return `<div class="sh-head"><button class="icon-btn" data-act="closeSheet" aria-label="Cancelar">✕</button><b class="grow center">${sh.isNew ? 'Nueva rutina' : 'Editar rutina'}</b><button class="btn primary sm" data-act="saveRoutine">Guardar</button></div>
      <input class="big-in" placeholder="Nombre (p. ej. Pecho y tríceps)" value="${esc(r.name)}" data-in="rName" maxlength="40">
      <div class="colors">${COLORS.map(c => `<button class="sw-c ${c === r.color ? 'on' : ''}" style="background:${c}" data-act="rColor" data-c="${c}" aria-label="Color"></button>`).join('')}</div>
      <div class="small muted mt8">Días de la semana</div>
      <div class="days">${DAYS_S.map((d, i) => `<button class="dchip ${r.days.includes(i) ? 'on' : ''}" data-act="rDay" data-d="${i}" aria-label="${DAYS[i]}">${d}</button>`).join('')}</div>
      <div class="sec">Ejercicios <span class="dim">${r.items.length}</span></div>
      ${r.items.map((it, i) => { const e = exOf(it.ex); return `<div class="card ritem">
        <div class="row top"><div class="thumb" data-act="openEx" data-id="${e.id}">${AN.svg(e.a, e, .5)}</div>
          <div class="grow"><b data-act="openEx" data-id="${e.id}">${i + 1}. ${esc(e.n)}</b><div class="small muted">${esc(e.p.map(m => D.MUSCLES[m]).join(', '))}</div></div>
          <div class="col"><button class="icon-btn sm" data-act="rMove" data-i="${i}" data-d="-1" aria-label="Subir" ${i ? '' : 'disabled'}>↑</button><button class="icon-btn sm" data-act="rMove" data-i="${i}" data-d="1" aria-label="Bajar" ${i < r.items.length - 1 ? '' : 'disabled'}>↓</button></div></div>
        <div class="rparams">
          <label>Series<div class="stepper"><button data-act="rSets" data-i="${i}" data-d="-1">−</button><b>${it.sets}</b><button data-act="rSets" data-i="${i}" data-d="1">+</button></div></label>
          ${e.t === 'c' ? `<label>Minutos<input inputmode="numeric" value="${esc(it.reps)}" data-in="rReps" data-i="${i}" placeholder="20"></label>` : e.t === 't' ? `<label>Segundos<input inputmode="numeric" value="${esc(it.reps)}" data-in="rReps" data-i="${i}" placeholder="45"></label>` : `<label>Reps<input value="${esc(it.reps)}" data-in="rReps" data-i="${i}" placeholder="8-12"></label>`}
          <label>Descanso<select data-in="rRest" data-i="${i}">${[30, 45, 60, 75, 90, 120, 150, 180, 240].map(s => `<option value="${s}" ${s === it.rest ? 'selected' : ''}>${fmtClock(s * 1000)}</option>`).join('')}</select></label>
        </div>
        <div class="row"><input class="grow note" placeholder="Nota (asiento en 4, agarre…)" value="${esc(it.note || '')}" data-in="rNote" data-i="${i}"><button class="icon-btn danger" data-act="rDel" data-i="${i}" aria-label="Quitar">🗑</button></div>
      </div>`; }).join('')}
      <button class="btn block" data-act="pickFor" data-mode="routine">+ Añadir ejercicios</button>
      ${!sh.isNew ? `<button class="btn danger block mt8" data-act="delRoutine">Borrar rutina</button>` : ''}`;
  }

  function sheetPicker(sh) {
    const list = libFilter(Object.values(EX));
    return `<div class="sh-head"><button class="icon-btn" data-act="closeSheet" aria-label="Cerrar">✕</button><b class="grow center">${sh.mode === 'replace' ? 'Cambiar ejercicio' : 'Añadir ejercicios'}</b><button class="btn primary sm" data-act="pickDone" ${sh.sel.size ? '' : 'disabled'}>${sh.mode === 'replace' ? 'Cambiar' : 'Añadir'}${sh.sel.size ? ' (' + sh.sel.size + ')' : ''}</button></div>
      ${libControls()}<div id="libList">${exGrid(list, sh.sel)}</div>`;
  }

  function sheetTemplates() {
    return `<div class="sh-head"><button class="icon-btn" data-act="closeSheet" aria-label="Cerrar">✕</button><b class="grow center">Plantillas</b><span style="width:40px"></span></div>
      <p class="small muted">Puntos de partida inspirados en las divisiones más usadas (empuje/tirón/pierna, torso/pierna, full body). Se añaden como rutinas tuyas y puedes cambiarlo todo.</p>
      ${D.TEMPLATES.map((t, i) => `<div class="card rcard" style="--rc:${t.color}"><div class="rname">${esc(t.name)}</div><div class="small muted">${t.items.map(id => esc(exOf(id).n)).join(' · ')}</div>
        <div class="thumbs">${t.items.slice(0, 5).map(id => `<div class="thumb">${AN.svg(exOf(id).a, exOf(id), .5)}</div>`).join('')}</div>
        <button class="btn block" data-act="useTemplate" data-i="${i}">Usar esta plantilla</button></div>`).join('')}`;
  }

  function sheetAddToRoutine(sh) {
    return `<div class="sh-head"><button class="icon-btn" data-act="closeSheet" aria-label="Cerrar">✕</button><b class="grow center">Añadir a rutina</b><span style="width:40px"></span></div>
      <p class="small muted">${esc(exOf(sh.id).n)}</p>
      ${S.routines.map(r => `<div class="card li" data-act="addToRoutineGo" data-r="${r.id}"><span class="dot" style="background:${esc(r.color)}"></span><div class="grow"><b>${esc(r.name)}</b><div class="small muted">${r.items.length} ejercicios</div></div><span>＋</span></div>`).join('')}
      <button class="btn primary block" data-act="addToRoutineGo" data-r="">+ Nueva rutina con este ejercicio</button>`;
  }

  function sheetWorkout(sh) {
    const w = S.workouts.find(x => x.id === sh.id);
    if (!w) return '<div class="pad">No encontrado.</div>';
    return `<div class="sh-head"><button class="icon-btn" data-act="closeSheet" aria-label="Cerrar">✕</button><b class="grow center">${sh.summary ? '¡Entreno completado! 🎉' : 'Entreno'}</b><span style="width:40px"></span></div>
      ${sh.summary ? `<div class="center"><img src="icons/icon-192.png" class="avatar lg" alt=""></div>` : ''}
      <h2>${esc(w.name)}</h2><div class="muted small">${esc(fmtDate(w.start))} · ${new Date(w.start).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
      <div class="card stats3"><div><b>${fmtDur((w.end || w.start) - w.start)}</b><span>Duración</span></div><div><b>${fmtKg(workoutVolume(w))} kg</b><span>Volumen</span></div><div><b>${workoutSets(w)}</b><span>Series</span></div></div>
      ${(w.prs || []).length ? `<div class="card pr-card"><b>🏆 Nuevos récords</b>${w.prs.map(p => `<div class="small">${esc(exOf(p.ex).n)}: ${esc(p.txt)}</div>`).join('')}</div>` : ''}
      ${w.items.filter(it => doneSets(it).length).map(it => { const e = exOf(it.ex); return `<div class="card"><div class="row"><div class="thumb">${AN.svg(e.a, e, .5)}</div><div class="grow"><b>${esc(e.n)}</b>${it.note ? `<div class="small muted">${esc(it.note)}</div>` : ''}</div></div>
        ${doneSets(it).map((s, i) => `<div class="li small"><span class="setn ${s.type || ''}">${s.type === 'w' ? 'C' : s.type === 'd' ? 'D' : s.type === 'f' ? 'F' : i + 1}</span><div class="grow">${setText(e, s)}</div>${e.t === 'r' ? `<span class="dim">~${fmtKg(Math.round(e1rm(num(s.kg), num(s.reps))))} kg</span>` : ''}</div>`).join('')}</div>`; }).join('')}
      <div class="sh-foot">${sh.summary && !w.routineId ? `<button class="btn grow" data-act="saveAsRoutine" data-id="${w.id}">Guardar como rutina</button>` : ''}${sh.summary ? `<button class="btn primary grow" data-act="closeSheet">Hecho</button>` : `<button class="btn grow" data-act="repeatWorkout" data-id="${w.id}">↻ Repetir</button><button class="btn danger" data-act="delWorkout" data-id="${w.id}">Borrar</button>`}</div>`;
  }

  function sheetNewExercise(sh) {
    const d = sh.draft;
    const anims = Object.keys(AN.T).filter(k => k !== 'generic');
    return `<div class="sh-head"><button class="icon-btn" data-act="closeSheet" aria-label="Cancelar">✕</button><b class="grow center">Crear ejercicio</b><button class="btn primary sm" data-act="saveExercise">Guardar</button></div>
      <input class="big-in" placeholder="Nombre del ejercicio" value="${esc(d.n)}" data-in="xName" maxlength="50">
      <label class="small muted">Grupo<select data-in="xGroup">${D.GROUPS.map(g => `<option ${g === d.g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></label>
      <label class="small muted">Tipo<select data-in="xType">${[['r', 'Peso × repeticiones'], ['b', 'Peso corporal'], ['a', 'Asistida'], ['t', 'Por tiempo'], ['c', 'Cardio']].map(([k, n]) => `<option value="${k}" ${k === d.t ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <div class="small muted mt8">Músculos principales (toca para marcar)</div>
      <div class="chips wrap">${Object.entries(D.MUSCLES).map(([k, n]) => `<button class="chip ${d.p.includes(k) ? 'on' : d.s.includes(k) ? 'half' : ''}" data-act="xMuscle" data-k="${k}">${esc(n)}</button>`).join('')}</div>
      <div class="small dim">1 toque = principal · 2 = secundario · 3 = quitar</div>
      <div class="small muted mt8">Animación más parecida</div>
      <div class="grid small-grid">${anims.map(k => `<div class="excard ${k === d.a ? 'sel' : ''}" data-act="xAnim" data-k="${k}"><div class="anim">${AN.svg(k, d, .5)}</div></div>`).join('')}</div>`;
  }

  const SHEETS = { ex: sheetEx, routine: sheetRoutine, picker: sheetPicker, templates: sheetTemplates, addToRoutine: sheetAddToRoutine, workout: sheetWorkout, newEx: sheetNewExercise };

  // ---------- entreno en vivo ----------
  function prevSets(exId) { const s = sessionsOf(exId)[0]; return s ? doneSets(s.it) : []; }
  function makeItem(exId, sets, reps, rest, note) {
    const e = exOf(exId), prev = prevSets(exId);
    const n = sets || Math.max(prev.length, e.t === 'c' ? 1 : 3);
    return { ex: exId, rest: rest || S.profile.rest, note: note || '', target: reps || '', sets: Array.from({ length: n }, () => ({ kg: '', reps: '', min: '', km: '', sec: '', done: false, type: '' })) };
  }
  function startWorkout(name, items, routineId) {
    if (S.live && !confirm('Ya hay un entreno en curso. ¿Descartarlo y empezar otro?')) return;
    S.live = { id: uid(), name, routineId: routineId || null, start: Date.now(), items, restEnd: 0, restTotal: 0 };
    save(); openLive();
  }
  function openLive() {
    UI.liveOpen = true; history.pushState({ live: 1 }, '');
    render(); keepAwake(true);
  }
  function liveHTML() {
    const L = S.live;
    if (!L) return '';
    return `<div class="live-head"><button class="icon-btn" data-act="minLive" aria-label="Minimizar">⌄</button>
        <div class="grow center"><input class="live-name" value="${esc(L.name)}" data-in="liveName" aria-label="Nombre del entreno"><div class="timer" data-clock>${fmtClock(Date.now() - L.start)}</div></div>
        <button class="btn primary sm" data-act="finishLive">Terminar</button></div>
      <div class="live-body" id="liveBody">
        ${L.items.map((it, i) => liveItem(it, i)).join('') || '<div class="card empty">Añade ejercicios para empezar.</div>'}
        <button class="btn primary block" data-act="pickFor" data-mode="live">+ Añadir ejercicio</button>
        <button class="btn danger block mt8" data-act="cancelLive">Descartar entreno</button>
        <div style="height:120px"></div>
      </div>`;
  }
  function liveItem(it, i) {
    const e = exOf(it.ex), prev = prevSets(it.ex);
    const cols = e.t === 'c' ? ['Min', 'Km'] : e.t === 't' ? ['Seg'] : e.t === 'a' ? ['Ayuda kg', 'Reps'] : e.t === 'b' ? ['+kg', 'Reps'] : ['Kg', 'Reps'];
    const fields = e.t === 'c' ? ['min', 'km'] : e.t === 't' ? ['sec'] : ['kg', 'reps'];
    const tgtReps = String(it.target || '').match(/\d+/g);
    const ph = (s, f, k) => { const p = prev[k]; if (p && num(p[f])) return p[f]; if (f === 'reps' && tgtReps) return tgtReps[tgtReps.length - 1]; if (f === 'min' && it.target) return it.target; if (f === 'sec' && it.target) return it.target; return f === 'kg' && e.t === 'b' ? '0' : ''; };
    const done = it.sets.filter(s => s.done).length;
    return `<div class="card litem ${done === it.sets.length && done ? 'complete' : ''}">
      <div class="row top"><div class="thumb" data-act="openEx" data-id="${e.id}">${anim(e)}</div>
        <div class="grow"><b data-act="openEx" data-id="${e.id}">${esc(e.n)}</b><div class="small muted">${it.target ? 'Objetivo: ' + esc(it.target) + (e.t === 'c' ? ' min' : e.t === 't' ? ' s' : ' reps') + ' · ' : ''}Descanso ${fmtClock(it.rest * 1000)}</div>
        ${it.note ? `<div class="small accent">📝 ${esc(it.note)}</div>` : ''}</div>
        <button class="icon-btn" data-act="itemMenu" data-i="${i}" aria-label="Opciones">⋯</button></div>
      <div class="sets c${fields.length}"><span>Serie</span><span>Anterior</span>${cols.map(c => `<span>${c}</span>`).join('')}<span>✓</span>
        ${it.sets.map((s, k) => `<button class="setn ${s.type}" data-act="setType" data-i="${i}" data-k="${k}" aria-label="Tipo de serie">${s.type === 'w' ? 'C' : s.type === 'd' ? 'D' : s.type === 'f' ? 'F' : k + 1}</button>
          <span class="prev">${prev[k] ? esc(setText(e, prev[k])) : '—'}</span>
          ${fields.map(f => `<input class="${s.done ? 'ok' : ''}" inputmode="decimal" value="${esc(s[f])}" placeholder="${esc(ph(s, f, k))}" data-in="setVal" data-i="${i}" data-k="${k}" data-f="${f}" aria-label="${f}">`).join('')}
          <button class="tick ${s.done ? 'on' : ''}" data-act="setDone" data-i="${i}" data-k="${k}" aria-label="Completar serie">✓</button>`).join('')}
      </div>
      <div class="row between mt4"><button class="link" data-act="addSet" data-i="${i}">+ Serie</button>${it.sets.length > 1 ? `<button class="link dim" data-act="delSet" data-i="${i}">− Quitar última</button>` : ''}</div>
    </div>`;
  }
  function renderLive() {
    const el = $('#live');
    if (!S.live || !UI.liveOpen) { el.hidden = true; el.innerHTML = ''; return; }
    const body = $('#liveBody'), top = body ? body.scrollTop : 0;
    el.hidden = false; el.innerHTML = liveHTML();
    const nb = $('#liveBody'); if (nb) nb.scrollTop = top;
    hydrate(el);
  }

  function finishLive() {
    const L = S.live;
    const any = L.items.some(it => it.sets.some(s => s.done));
    if (!any) { if (confirm('No has completado ninguna serie. ¿Descartar el entreno?')) { S.live = null; save(); closeLive(); } return; }
    if (L.items.some(it => it.sets.some(s => !s.done)) && !confirm('Hay series sin marcar. Se guardarán solo las completadas. ¿Terminar?')) return;
    const w = { id: L.id, name: L.name || 'Entreno', routineId: L.routineId, start: L.start, end: Date.now(), items: L.items.map(it => ({ ex: it.ex, note: it.note, sets: it.sets.filter(s => s.done) })).filter(it => it.sets.length), prs: [] };
    for (const it of w.items) {
      const e = exOf(it.ex);
      if (e.t !== 'r') continue;
      const prev = bestOf(it.ex, w.start), pmax = maxKg(it.ex, w.start);
      if (!prev) continue;
      const top = it.sets.reduce((b, s) => { const v = e1rm(num(s.kg), num(s.reps)); return v > b.v ? { v, s } : b; }, { v: 0 });
      const mk = Math.max(...it.sets.map(s => num(s.kg)));
      if (mk > pmax) w.prs.push({ ex: it.ex, txt: `peso máximo ${fmtKg(mk)} kg` });
      else if (top.v > prev.e1 + .01) w.prs.push({ ex: it.ex, txt: `1RM estimado ${fmtKg(Math.round(top.v))} kg (${fmtKg(num(top.s.kg))}×${num(top.s.reps)})` });
    }
    // Actualiza la rutina con el nº de series realizado
    const r = S.routines.find(x => x.id === L.routineId);
    if (r) r.lastDone = w.end;
    S.workouts.push(w); S.live = null; save();
    UI.liveOpen = false; keepAwake(false); stopRest();
    render();
    history.replaceState(null, '');
    openSheet({ type: 'workout', id: w.id, summary: true });
  }
  function closeLive() { UI.liveOpen = false; keepAwake(false); stopRest(); render(); }

  // descanso
  let restTimer = null, audioCtx = null;
  function beep() {
    if (!S.profile.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      [0, .22, .44].forEach((t, i) => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = i === 2 ? 1175 : 880; g.gain.setValueAtTime(.0001, audioCtx.currentTime + t); g.gain.exponentialRampToValueAtTime(.3, audioCtx.currentTime + t + .02); g.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + t + .18); o.connect(g).connect(audioCtx.destination); o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + .2); });
    } catch (e) { /* sin audio */ }
  }
  function startRest(sec) {
    if (!S.live) return;
    S.live.restEnd = Date.now() + sec * 1000; S.live.restTotal = sec; save();
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (e) { /* */ }
    tickRest();
  }
  function stopRest() { if (S.live) { S.live.restEnd = 0; save(); } $('#rest').hidden = true; }
  function tickRest() {
    const el = $('#rest'), L = S.live;
    if (!L || !L.restEnd) { el.hidden = true; return; }
    const left = L.restEnd - Date.now();
    if (left <= 0) {
      L.restEnd = 0; save(); el.hidden = true; beep();
      if (S.profile.vibrate && navigator.vibrate) navigator.vibrate([300, 120, 300]);
      if (document.hidden && 'serviceWorker' in navigator && window.Notification && Notification.permission === 'granted') navigator.serviceWorker.ready.then(r => r.showNotification('¡Descanso terminado!', { body: 'A por la siguiente serie 💪', icon: 'icons/icon-192.png', tag: 'rest', vibrate: [300, 120, 300] })).catch(() => {});
      toast('⏰ ¡A por la siguiente serie!');
      return;
    }
    el.hidden = false;
    el.innerHTML = `<div class="rest-bar" style="--p:${(left / 1000 / L.restTotal).toFixed(3)}"></div><div class="row between"><button class="btn sm" data-act="restAdd" data-d="-15">−15</button><div class="center"><div class="small muted">Descanso</div><b class="rest-t">${fmtClock(left)}</b></div><button class="btn sm" data-act="restAdd" data-d="15">+15</button><button class="btn sm primary" data-act="restSkip">Saltar</button></div>`;
  }
  setInterval(() => {
    if (S.live && S.live.restEnd) tickRest();
    if (S.live) document.querySelectorAll('[data-clock]').forEach(el => { el.textContent = fmtClock(Date.now() - S.live.start); });
  }, 500);

  let wakeLock = null;
  async function keepAwake(on) {
    try {
      if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
      if (!on && wakeLock) { wakeLock.release(); wakeLock = null; }
    } catch (e) { /* no soportado */ }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.live && UI.liveOpen) keepAwake(true); if (!document.hidden) tickRest(); });

  // ---------- render ----------
  const VIEWS = { hoy: viewHoy, rutinas: viewRutinas, ejercicios: viewEjercicios, gymbro: viewGymBro, historial: viewHistorial, perfil: viewPerfil };
  function hydrate(root) {
    root.querySelectorAll('[data-anim]').forEach(el => {
      if (el.dataset.m) return;
      el.dataset.m = 1;
      const a = AN.mount(el, el.dataset.anim, exOf(el.dataset.ex), { big: el.classList.contains('big'), force: el.classList.contains('big') });
      if (el.classList.contains('big')) UI.bigAnim = a;
    });
  }
  function renderView() {
    const v = $('#view');
    v.innerHTML = VIEWS[UI.tab]();
    hydrate(v);
    document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === UI.tab));
    document.body.classList.toggle('bro', UI.tab === 'gymbro');
  }
  function renderSheet() {
    const el = $('#sheet'), top = UI.sheets[UI.sheets.length - 1];
    if (!top) { el.hidden = true; el.innerHTML = ''; el.dataset.k = 0; document.body.classList.remove('locked'); return; }
    const body = el.querySelector('.sheet-body'), prevK = +el.dataset.k || 0, prev = UI.sheets[prevK - 1];
    if (body && prev) prev.scroll = body.scrollTop;
    el.hidden = false; document.body.classList.add('locked');
    el.dataset.k = UI.sheets.length;
    el.innerHTML = `<div class="sheet-body${UI.sheets.length > prevK ? ' enter' : ''}">${SHEETS[top.type](top)}</div>`;
    el.querySelector('.sheet-body').scrollTop = top.scroll || 0;
    hydrate(el);
  }
  function renderMini() {
    const m = $('#mini');
    if (S.live && !UI.liveOpen) { m.hidden = false; m.innerHTML = `<div class="grow"><div class="small accent">● Entreno en curso</div><b>${esc(S.live.name)}</b></div><span class="timer" data-clock>${fmtClock(Date.now() - S.live.start)}</span><span class="btn sm primary">Abrir</span>`; }
    else m.hidden = true;
  }
  function render() { renderView(); renderLive(); renderMini(); renderSheet(); tickRest(); }

  function openSheet(s) {
    UI.sheets.push(s);
    history.pushState({ sheet: UI.sheets.length }, '');
    renderSheet();
  }

  // Menú de opciones (no usa el historial)
  let menuFns = [];
  function showMenu(title, items) {
    menuFns = items.map(x => x[1]);
    const m = $('#menu');
    m.innerHTML = `<div class="menu-box"><div class="menu-t">${esc(title)}</div>${items.map(([label, , cls], i) => `<button class="menu-i ${cls || ''}" data-mi="${i}">${label}</button>`).join('')}<button class="menu-i dim" data-mi="-1">Cancelar</button></div>`;
    m.hidden = false;
  }
  $('#menu').addEventListener('click', ev => {
    const b = ev.target.closest('[data-mi]');
    if (!b && ev.target.id !== 'menu') return;
    ev.stopPropagation();
    $('#menu').hidden = true;
    const fn = b ? menuFns[+b.dataset.mi] : null;
    menuFns = [];
    if (fn) fn();
  });
  const closeSheet = () => history.back();
  window.addEventListener('popstate', () => {
    if (UI.sheets.length) { UI.sheets.pop(); renderSheet(); if (UI.liveOpen) renderLive(); else renderView(); return; }
    if (UI.liveOpen) { UI.liveOpen = false; keepAwake(false); render(); }
  });

  let toastT = null;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600);
  }

  function refreshLib() {
    const top = UI.sheets[UI.sheets.length - 1];
    const box = top && top.type === 'picker' ? $('#sheet #libList') : $('#view #libList');
    if (!box) return;
    box.innerHTML = exGrid(libFilter(Object.values(EX)), top && top.type === 'picker' ? top.sel : null);
    hydrate(box);
  }

  // ---------- acciones ----------
  const sheetTop = () => UI.sheets[UI.sheets.length - 1];
  const ACT = {
    tab: b => { if (b.dataset.tab === 'ejercicios' && UI.tab !== 'ejercicios') { UI.libG = 'Todos'; UI.libQ = ''; } UI.tab = b.dataset.tab; history.replaceState(history.state, '', '#' + UI.tab); renderView(); if (UI.tab === 'gymbro') broScroll(); else window.scrollTo(0, 0); },
    askBro: b => broSay(b.dataset.q),
    broAct: b => broAct(b),
    broClear: () => { if (!confirm('¿Borrar la conversación con GymBro?')) return; S.chat = []; save(); renderView(); },
    saveName: () => { const v = $('#nameIn').value.trim(); if (v) { S.profile.name = v; save(); renderView(); } },
    // rutinas
    newRoutine: () => openSheet({ type: 'routine', isNew: true, draft: { id: uid(), name: '', color: COLORS[S.routines.length % COLORS.length], days: [], items: [] } }),
    editRoutine: b => { const r = S.routines.find(x => x.id === b.dataset.id); if (r) openSheet({ type: 'routine', draft: JSON.parse(JSON.stringify(r)) }); },
    routineMenu: b => {
      const r = S.routines.find(x => x.id === b.dataset.id); if (!r) return;
      showMenu(r.name, [
        ['▶ Empezar', () => ACT.startRoutine(b)],
        ['✏️ Editar', () => ACT.editRoutine(b)],
        ['⧉ Duplicar', () => { const n = JSON.parse(JSON.stringify(r)); n.id = uid(); n.name += ' (copia)'; n.days = []; S.routines.push(n); save(); renderView(); toast('Rutina duplicada'); }],
        ['🗑 Borrar', () => { if (confirm(`¿Borrar “${r.name}”?`)) { S.routines = S.routines.filter(x => x !== r); save(); renderView(); } }, 'danger']
      ]);
    },
    rColor: b => { sheetTop().draft.color = b.dataset.c; renderSheet(); },
    rDay: b => { const d = sheetTop().draft, i = +b.dataset.d; d.days = d.days.includes(i) ? d.days.filter(x => x !== i) : [...d.days, i]; renderSheet(); },
    rSets: b => { const it = sheetTop().draft.items[+b.dataset.i]; it.sets = Math.max(1, Math.min(10, it.sets + +b.dataset.d)); renderSheet(); },
    rMove: b => { const a = sheetTop().draft.items, i = +b.dataset.i, j = i + +b.dataset.d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; renderSheet(); },
    rDel: b => { sheetTop().draft.items.splice(+b.dataset.i, 1); renderSheet(); },
    saveRoutine: () => {
      const sh = sheetTop(), d = sh.draft;
      if (!d.name.trim()) d.name = d.items.length ? [...new Set(d.items.map(it => exOf(it.ex).g))].slice(0, 2).join(' y ') : 'Mi rutina';
      const i = S.routines.findIndex(x => x.id === d.id);
      if (i >= 0) S.routines[i] = d; else S.routines.push(d);
      save(); closeSheet(); toast('Rutina guardada ✓');
    },
    delRoutine: () => { const d = sheetTop().draft; if (!confirm(`¿Borrar “${d.name}”?`)) return; S.routines = S.routines.filter(x => x.id !== d.id); save(); closeSheet(); },
    templates: () => openSheet({ type: 'templates' }),
    useTemplate: b => {
      const t = D.TEMPLATES[+b.dataset.i];
      const r = { id: uid(), name: t.name, color: t.color, days: [], items: t.items.filter(id => EX[id]).map(id => ({ ex: id, sets: exOf(id).t === 'c' ? 1 : 3, reps: exOf(id).t === 'c' ? '15' : '8-12', rest: S.profile.rest, note: '' })) };
      UI.sheets.pop(); UI.sheets.push({ type: 'routine', isNew: true, draft: r }); renderSheet();
    },
    startRoutine: b => { const r = S.routines.find(x => x.id === b.dataset.id); if (r) startWorkout(r.name, r.items.map(it => makeItem(it.ex, it.sets, it.reps, it.rest, it.note)), r.id); },
    startEmpty: () => startWorkout('Entreno libre', [], null),
    // biblioteca
    libG: b => { UI.libG = b.dataset.g; const box = b.closest('.sheet-body') || $('#view'); box.querySelectorAll('[data-act="libG"]').forEach(x => x.classList.toggle('on', x === b)); refreshLib(); },
    libFav: b => { UI.libFav = !UI.libFav; b.classList.toggle('on', UI.libFav); refreshLib(); },
    openEx: b => openSheet({ type: 'ex', id: b.dataset.id }),
    fav: b => { const id = b.dataset.id; S.fav = S.fav.includes(id) ? S.fav.filter(x => x !== id) : [...S.fav, id]; save(); renderSheet(); },
    animPause: b => { const a = UI.bigAnim; if (!a) return; a.paused = !a.paused; b.textContent = a.paused ? '▶ Reanudar' : '⏸ Pausa'; },
    animSpeed: b => { const a = UI.bigAnim; if (!a) return; a.speed = a.speed === 1 ? .5 : 1; b.textContent = a.speed === 1 ? '🐢 Lento' : '🐇 Normal'; },
    addToRoutine: b => openSheet({ type: 'addToRoutine', id: b.dataset.id }),
    addToRoutineGo: b => {
      const id = sheetTop().id, rid = b.dataset.r;
      const item = { ex: id, sets: exOf(id).t === 'c' ? 1 : 3, reps: exOf(id).t === 'c' ? '15' : '8-12', rest: S.profile.rest, note: '' };
      if (!rid) { UI.sheets.pop(); UI.sheets.push({ type: 'routine', isNew: true, draft: { id: uid(), name: '', color: COLORS[S.routines.length % COLORS.length], days: [], items: [item] } }); renderSheet(); return; }
      const r = S.routines.find(x => x.id === rid); r.items.push(item); save(); closeSheet(); toast(`Añadido a ${r.name} ✓`);
    },
    addToLive: b => { S.live.items.push(makeItem(b.dataset.id)); save(); closeSheet(); toast('Añadido al entreno ✓'); },
    pickFor: b => { UI.libG = 'Todos'; UI.libQ = ''; UI.libFav = false; openSheet({ type: 'picker', mode: b.dataset.mode, sel: new Set(), i: b.dataset.i }); },
    pickToggle: b => {
      const sh = sheetTop(), id = b.dataset.id;
      if (sh.mode === 'replace') sh.sel = new Set([id]);
      else if (sh.sel.has(id)) sh.sel.delete(id); else sh.sel.add(id);
      if (sh.mode === 'replace') document.querySelectorAll('#sheet .excard.sel').forEach(x => { x.classList.remove('sel'); x.querySelector('.check').textContent = '+'; });
      const on = sh.sel.has(id); b.classList.toggle('sel', on); b.querySelector('.check').textContent = on ? '✓' : '+';
      const btn = document.querySelector('#sheet [data-act="pickDone"]');
      btn.disabled = !sh.sel.size; btn.textContent = (sh.mode === 'replace' ? 'Cambiar' : 'Añadir') + (sh.sel.size ? ` (${sh.sel.size})` : '');
    },
    pickDone: () => {
      const sh = sheetTop(), ids = [...sh.sel];
      if (sh.mode === 'routine') { const d = UI.sheets[UI.sheets.length - 2].draft; ids.forEach(id => d.items.push({ ex: id, sets: exOf(id).t === 'c' ? 1 : 3, reps: exOf(id).t === 'c' ? '15' : '8-12', rest: S.profile.rest, note: '' })); }
      else if (sh.mode === 'live') { ids.forEach(id => S.live.items.push(makeItem(id))); save(); }
      else if (sh.mode === 'replace') { const it = S.live.items[+sh.i]; S.live.items[+sh.i] = Object.assign(makeItem(ids[0], it.sets.length, '', it.rest), { note: it.note }); save(); }
      closeSheet();
    },
    newExercise: () => openSheet({ type: 'newEx', draft: { n: '', g: UI.libG !== 'Todos' ? UI.libG : 'Pecho', t: 'r', p: [], s: [], a: 'chestPress' } }),
    xMuscle: b => { const d = sheetTop().draft, k = b.dataset.k; if (d.p.includes(k)) { d.p = d.p.filter(x => x !== k); d.s.push(k); } else if (d.s.includes(k)) d.s = d.s.filter(x => x !== k); else d.p.push(k); renderSheet(); },
    xAnim: b => { sheetTop().draft.a = b.dataset.k; renderSheet(); },
    saveExercise: () => {
      const d = sheetTop().draft;
      if (!d.n.trim()) return toast('Ponle un nombre');
      if (!d.p.length) return toast('Marca al menos un músculo principal');
      const e = { id: 'c-' + uid(), n: d.n.trim(), g: d.g, a: d.a, e: [], p: d.p, s: d.s, t: d.t, steps: [], errs: [], custom: true };
      S.custom.push(e); EX[e.id] = e; save(); closeSheet(); renderView(); toast('Ejercicio creado ✓');
    },
    delExercise: b => { if (!confirm('¿Borrar este ejercicio personalizado?')) return; S.custom = S.custom.filter(e => e.id !== b.dataset.id); delete EX[b.dataset.id]; save(); closeSheet(); },
    // historial y progreso
    histTab: b => { UI.histTab = b.dataset.t; renderView(); },
    calMove: b => { const now = new Date(); UI.calMonth = (UI.calMonth ?? now.getFullYear() * 12 + now.getMonth()) + +b.dataset.d; renderView(); },
    openWorkout: b => openSheet({ type: 'workout', id: b.dataset.id }),
    delWorkout: b => { if (!confirm('¿Borrar este entreno del historial?')) return; S.workouts = S.workouts.filter(w => w.id !== b.dataset.id); save(); closeSheet(); },
    repeatWorkout: b => { const w = S.workouts.find(x => x.id === b.dataset.id); if (!w) return; closeSheet(); setTimeout(() => startWorkout(w.name, w.items.map(it => makeItem(it.ex, it.sets.length, '', null, it.note)), w.routineId), 120); },
    saveAsRoutine: b => {
      const w = S.workouts.find(x => x.id === b.dataset.id);
      const r = { id: uid(), name: w.name === 'Entreno libre' ? 'Mi rutina' : w.name, color: COLORS[S.routines.length % COLORS.length], days: [], items: w.items.map(it => ({ ex: it.ex, sets: it.sets.length, reps: '8-12', rest: S.profile.rest, note: it.note || '' })) };
      UI.sheets.pop(); UI.sheets.push({ type: 'routine', isNew: true, draft: r }); renderSheet();
    },
    addBW: () => { const v = num($('#bwIn').value); if (v < 20 || v > 400) return toast('Introduce un peso válido'); S.bw.push({ t: Date.now(), kg: v }); save(); renderView(); toast('Peso guardado ✓'); },
    delBW: () => { if (!S.bw.length || !confirm('¿Borrar el último registro de peso?')) return; S.bw.sort((a, b) => a.t - b.t).pop(); save(); renderView(); },
    // perfil
    goal: b => { S.profile.goal = Math.max(1, Math.min(7, S.profile.goal + +b.dataset.d)); save(); renderView(); },
    export: () => {
      const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `gym-copia-${dayKey(Date.now())}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },
    reset: () => { if (!confirm('Se borrarán rutinas, historial y ajustes de este dispositivo. ¿Seguro?')) return; if (!confirm('Esta acción no se puede deshacer. ¿Borrar todo?')) return; S = fresh(); save(); indexEx(); render(); toast('Datos borrados'); },
    // entreno en vivo
    openLive: () => openLive(),
    minLive: () => history.back(),
    finishLive: () => finishLive(),
    cancelLive: () => { if (!confirm('¿Descartar este entreno? No se guardará nada.')) return; S.live = null; save(); history.back(); },
    itemMenu: b => {
      const i = +b.dataset.i, it = S.live.items[i];
      const L = S.live.items, swap = j => { [L[i], L[j]] = [L[j], L[i]]; save(); renderLive(); };
      showMenu(exOf(it.ex).n, [
        ['📖 Ver técnica y animación', () => openSheet({ type: 'ex', id: it.ex })],
        ['🔄 Cambiar por otro ejercicio', () => openSheet({ type: 'picker', mode: 'replace', sel: new Set(), i })],
        ['📝 ' + (it.note ? 'Editar nota' : 'Añadir nota'), () => { const n = prompt('Nota (asiento, agarre, sensaciones…):', it.note || ''); if (n !== null) { it.note = n.trim(); save(); renderLive(); } }],
        ['⏱ Cambiar descanso (' + fmtClock(it.rest * 1000) + ')', () => { const n = parseInt(prompt('Descanso en segundos:', it.rest), 10); if (n > 0) { it.rest = n; save(); renderLive(); } }],
        ...(i > 0 ? [['↑ Subir', () => swap(i - 1)]] : []),
        ...(i < L.length - 1 ? [['↓ Bajar', () => swap(i + 1)]] : []),
        ['🗑 Quitar del entreno', () => { if (confirm('¿Quitar este ejercicio?')) { L.splice(i, 1); save(); renderLive(); } }, 'danger']
      ]);
    },
    addSet: b => { const it = S.live.items[+b.dataset.i], last = it.sets[it.sets.length - 1] || {}; it.sets.push({ kg: last.kg || '', reps: last.reps || '', min: '', km: '', sec: '', done: false, type: '' }); save(); renderLive(); },
    delSet: b => { const it = S.live.items[+b.dataset.i]; if (it.sets.length > 1) it.sets.pop(); save(); renderLive(); },
    setType: b => { const s = S.live.items[+b.dataset.i].sets[+b.dataset.k], order = ['', 'w', 'd', 'f']; s.type = order[(order.indexOf(s.type || '') + 1) % 4]; save(); renderLive(); if (s.type) toast({ w: 'Serie de calentamiento', d: 'Drop set', f: 'Serie al fallo' }[s.type]); },
    setDone: b => {
      const i = +b.dataset.i, k = +b.dataset.k, it = S.live.items[i], s = it.sets[k];
      const row = [...document.querySelectorAll(`#live input[data-i="${i}"][data-k="${k}"]`)];
      if (!s.done) {
        for (const inp of row) { const f = inp.dataset.f; if (!String(s[f]).trim() && inp.placeholder) s[f] = inp.placeholder; }
        const e = exOf(it.ex);
        if ((e.t === 'r' || e.t === 'a' || e.t === 'b') && !num(s.reps)) return toast('Escribe las repeticiones');
        if (e.t === 'c' && !num(s.min)) return toast('Escribe los minutos');
        if (e.t === 't' && !num(s.sec)) return toast('Escribe los segundos');
        s.done = true;
        if (e.t === 'r' && num(s.kg) > 0) { const pm = maxKg(it.ex); if (pm && num(s.kg) > pm) toast(`🏆 ¡Nuevo récord de peso en ${e.n}!`); }
        if (S.profile.vibrate && navigator.vibrate) navigator.vibrate(30);
        if (e.t !== 'c' && !(k === it.sets.length - 1 && i === S.live.items.length - 1)) startRest(it.rest || S.profile.rest);
        if (window.Notification && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
      } else s.done = false;
      save(); renderLive();
    },
    restAdd: b => { if (!S.live || !S.live.restEnd) return; S.live.restEnd += +b.dataset.d * 1000; S.live.restTotal = Math.max(S.live.restTotal + +b.dataset.d, 1); save(); tickRest(); },
    restSkip: () => stopRest(),
    closeSheet: () => closeSheet()
  };

  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (b && !b.disabled && ACT[b.dataset.act]) { ev.preventDefault(); ACT[b.dataset.act](b, ev); return; }
    if (ev.target.closest('#mini')) openLive();
    else if (ev.target.id === 'sheet') closeSheet();
  });

  const INPUT = {
    libQ: el => { UI.libQ = el.value; refreshLib(); },
    name: el => { S.profile.name = el.value.trim(); save(); },
    rest: el => { S.profile.rest = +el.value; save(); },
    sound: el => { S.profile.sound = el.checked; save(); },
    vibrate: el => { S.profile.vibrate = el.checked; save(); },
    progEx: el => { UI.progEx = el.value; renderView(); },
    rName: el => { sheetTop().draft.name = el.value; },
    rReps: el => { sheetTop().draft.items[+el.dataset.i].reps = el.value; },
    rRest: el => { sheetTop().draft.items[+el.dataset.i].rest = +el.value; },
    rNote: el => { sheetTop().draft.items[+el.dataset.i].note = el.value; },
    xName: el => { sheetTop().draft.n = el.value; },
    xGroup: el => { sheetTop().draft.g = el.value; },
    xType: el => { sheetTop().draft.t = el.value; },
    liveName: el => { S.live.name = el.value; save(); },
    setVal: el => { const s = S.live.items[+el.dataset.i].sets[+el.dataset.k]; s[el.dataset.f] = el.value.replace(',', '.'); save(); }
  };
  const onInput = ev => { const el = ev.target.closest('[data-in]'); if (el && INPUT[el.dataset.in]) INPUT[el.dataset.in](el); };
  document.addEventListener('input', ev => { const el = ev.target.closest('[data-in]'); if (el && el.type !== 'checkbox' && el.tagName !== 'SELECT') onInput(ev); });
  document.addEventListener('change', ev => { const el = ev.target.closest('[data-in]'); if (el && (el.type === 'checkbox' || el.tagName === 'SELECT')) onInput(ev); });
  document.addEventListener('change', ev => {
    if (ev.target.id !== 'importIn' || !ev.target.files[0]) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const d = JSON.parse(fr.result);
        if (!d || !Array.isArray(d.workouts) || !Array.isArray(d.routines)) throw new Error('formato');
        if (!confirm(`Copia con ${d.routines.length} rutinas y ${d.workouts.length} entrenos. ¿Sustituir los datos actuales?`)) return;
        S = Object.assign(fresh(), d); S.profile = Object.assign(fresh().profile, d.profile); save(); indexEx(); render(); toast('Copia importada ✓');
      } catch (e) { alert('El archivo no es una copia válida.'); }
    };
    fr.readAsText(ev.target.files[0]);
    ev.target.value = '';
  });
  document.addEventListener('submit', ev => {
    if (ev.target.id !== 'broForm') return;
    ev.preventDefault();
    const inp = $('#broIn'), v = inp.value;
    inp.value = '';
    broSay(v);
    const n = $('#broIn'); if (n) n.focus();
  });
  document.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.id === 'bwIn') ACT.addBW(); if (ev.key === 'Enter' && ev.target.id === 'nameIn') ACT.saveName(); });


  // arranque
  history.replaceState(null, '', '#' + UI.tab);
  render();
  if (UI.tab === 'gymbro') broScroll();
  if (S.live) toast('Tienes un entreno en curso: toca la barra para continuar');
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
