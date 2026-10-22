/* Mi Rutina — planificador diario, gym, nutrición y estudio */
'use strict';
(() => {
  const D = window.APPDATA;
  const CATS = D.CATS;
  const MEALS = D.MEALS;

  // ---------- utilidades ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = n => String(n).padStart(2, '0');
  const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dkey(d); };
  const dow = (d = new Date()) => (d.getDay() + 6) % 7; // 0 = lunes
  const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const durMin = b => { const d = toMin(b.end) - toMin(b.start); return d >= 0 ? d : d + 1440; };
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const matches = (text, q) => { const t = norm(text); return norm(q).split(/\s+/).filter(Boolean).every(w => t.includes(w)); };
  const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const num = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const r1 = n => Math.round(n * 10) / 10;
  const r0 = n => Math.round(n);
  const vibrate = pat => { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(pat); } catch (e) { /* no soportado */ } };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const fmtH = min => { const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`; };
  const fmtClock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${pad(m)}:${pad(x)}` : `${pad(m)}:${pad(x)}`; };
  const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const DAYS_S = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const fmtDate = (k, opts = { weekday: 'long', day: 'numeric', month: 'long' }) => parseKey(k).toLocaleDateString('es-ES', opts);
  const weekStart = (k = dkey()) => addDays(k, -dow(parseKey(k)));
  const mealName = id => (MEALS.find(m => m[0] === id) || MEALS[5])[1];
  const guessMeal = (m = nowMin()) => m < 630 ? 'desayuno' : m < 750 ? 'mediamanana' : m < 990 ? 'comida' : m < 1170 ? 'merienda' : 'cena';

  // ---------- ejercicios ----------
  let EX = {};
  let EX_GROUPS = [];
  function buildEx() {
    EX = {};
    EX_GROUPS = D.EXERCISES.map(([g]) => g);
    for (const [group, items] of D.EXERCISES) {
      for (const [name, equip, type] of items) {
        const id = slug(name);
        EX[id] = { id, name, group, equip, type: type || 'strength' };
      }
    }
    for (const c of S.customEx) {
      EX[c.id] = { ...c, custom: true };
      if (!EX_GROUPS.includes(c.group)) EX_GROUPS.push(c.group);
    }
  }
  const exAvail = id => S.equipment['ex:' + id] !== false;

  // ---------- alimentos ----------
  const DBFOODS = D.FOODS.map(a => ({
    id: 'db-' + slug(a[0]), name: a[0],
    n: { kcal: a[1], p: a[2], c: a[3], f: a[4], fib: a[5], sug: a[6], sat: a[7], sod: a[8] },
    portion: { g: a[9], label: a[10] }
  }));
  const NKEYS = ['kcal', 'p', 'c', 'f', 'fib', 'sug', 'sat', 'sod'];
  const zeroN = () => ({ kcal: 0, p: 0, c: 0, f: 0, fib: 0, sug: 0, sat: 0, sod: 0 });
  const scaleN = (n, g) => { const o = zeroN(); for (const k of NKEYS) o[k] = (num(n?.[k]) * g) / 100; return o; };
  const addN = (a, b) => { for (const k of NKEYS) a[k] += b[k]; return a; };

  // ---------- estado ----------
  const KEY = 'mirutina.v1';
  function defaults() {
    return {
      version: 1,
      settings: { name: '', notify: true, sound: true, remind: 10, waterEvery: 0, apiKey: '', aiModel: 'claude-sonnet-5-5', theme: 'auto' },
      blocks: [], done: {},
      routines: [], workouts: [], active: null, equipment: {}, customEx: [],
      foods: [], meals: {}, photos: {}, water: {},
      profile: { sex: 'h', age: 20, weight: 70, height: 175, activity: 1.55, goal: 'mantener' },
      goals: { kcal: 2500, p: 140, c: 300, f: 75, fib: 30, water: 2500 },
      subjects: [], studyLog: [],
      timer: { mode: 'focus', running: false, endAt: 0, left: 25 * 60000, subjectId: '', focus: 25, brk: 5, long: 15, count: 0 },
      gymTab: 'rutinas', lastWaterNotif: 0
    };
  }
  let S;
  function load() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) { raw = null; }
    if (!raw || typeof raw !== 'object') { S = seed(); save(); return; }
    const d = defaults();
    S = { ...d, ...raw };
    for (const k of ['settings', 'goals', 'profile', 'timer']) S[k] = { ...d[k], ...(raw[k] || {}) };
    for (const k of ['blocks', 'routines', 'workouts', 'customEx', 'foods', 'subjects', 'studyLog']) if (!Array.isArray(S[k])) S[k] = [];
    for (const k of ['done', 'meals', 'photos', 'water', 'equipment']) if (!S[k] || typeof S[k] !== 'object') S[k] = {};
  }
  let saveWarned = false;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); saveWarned = false; return true; } catch (e) {
      if (!saveWarned) toast('⚠️ Almacenamiento lleno', 'Borra fotos antiguas o exporta una copia en Ajustes.');
      saveWarned = true; return false;
    }
  }

  function seed() {
    const s = defaults();
    const R = (name, color, list) => ({ id: uid(), name, color, exercises: list.map(([n, sets, reps, rest]) => ({ exId: slug(n), sets, reps, kg: '', rest: rest || 90 })) });
    const push = R('Empuje (pecho, hombro, tríceps)', '#ff5c7a', [
      ['Press de pecho sentado', 4, 10, 120], ['Press de pecho inclinado', 3, 10], ['Cruce de poleas', 3, 12, 60],
      ['Press de hombros', 3, 10], ['Elevaciones laterales en máquina', 3, 15, 60], ['Extensión de tríceps en polea', 3, 12, 60], ['Polea alta con cuerda', 3, 12, 60]]);
    const pull = R('Tirón (espalda, bíceps)', '#5ec8ff', [
      ['Jalón al pecho', 4, 10, 120], ['Remo sentado en polea', 3, 10], ['Remo con pecho apoyado', 3, 10],
      ['Pájaros / deltoide posterior', 3, 15, 60], ['Encogimientos para trapecio', 3, 12, 60], ['Curl de bíceps en máquina', 3, 12, 60], ['Banco Scott para bíceps', 3, 10, 60]]);
    const legs = R('Pierna y core', '#2fd18b', [
      ['Sentadilla Hack', 4, 8, 150], ['Prensa de piernas', 3, 10, 120], ['Extensión de cuádriceps', 3, 12],
      ['Curl femoral tumbado', 3, 12], ['Máquina de hip thrust', 3, 10], ['Elevación de gemelos de pie', 4, 15, 60], ['Máquina de abdominales', 3, 15, 60]]);
    s.routines = [push, pull, legs];
    const subj = [{ id: uid(), name: 'Matemáticas', color: '#8b6cff', goalH: 6 }, { id: uid(), name: 'Inglés', color: '#5ec8ff', goalH: 3 }, { id: uid(), name: 'Historia', color: '#ffb547', goalH: 3 }];
    s.subjects = subj;
    s.timer.subjectId = subj[0].id;
    const B = (title, cat, start, end, days, extra = {}) => ({ id: uid(), title, cat, start, end, days, remind: 10, notes: '', ...extra });
    const wk = [0, 1, 2, 3, 4];
    s.blocks = [
      B('Despertar, agua y aseo', 'rutina', '07:00', '07:20', wk, { remind: 0 }),
      B('Desayuno', 'comida', '07:20', '07:45', wk),
      B('Estudio — bloque 1', 'estudio', '08:30', '10:30', wk, { subjectId: subj[0].id }),
      B('Media mañana', 'comida', '10:30', '10:50', wk, { remind: 5 }),
      B('Estudio — bloque 2', 'estudio', '11:00', '13:00', wk, { subjectId: subj[1].id }),
      B('Comida', 'comida', '14:00', '14:45', [0, 1, 2, 3, 4, 5, 6]),
      B('Estudio — repaso', 'estudio', '16:00', '17:30', [0, 1, 2, 3], { subjectId: subj[2].id }),
      B('Merienda', 'comida', '17:45', '18:00', wk, { remind: 5 }),
      B('Gym — Empuje', 'gym', '18:30', '20:00', [0, 3], { routineId: push.id, remind: 30 }),
      B('Gym — Tirón', 'gym', '18:30', '20:00', [1, 4], { routineId: pull.id, remind: 30 }),
      B('Gym — Pierna', 'gym', '18:30', '20:00', [2], { routineId: legs.id, remind: 30 }),
      B('Cena', 'comida', '21:00', '21:40', [0, 1, 2, 3, 4, 5, 6]),
      B('Preparar mañana y desconectar', 'rutina', '22:30', '23:00', [6, 0, 1, 2, 3], { notes: 'Mochila, ropa del gym y pantallas fuera.' }),
      B('Desayuno tranquilo', 'comida', '10:00', '10:30', [5, 6]),
      B('Estudio ligero', 'estudio', '11:00', '13:00', [5], { subjectId: subj[0].id }),
      B('Tiempo libre', 'ocio', '17:00', '20:00', [5, 6], { remind: -1 })
    ];
    return s;
  }

  // ---------- UI runtime ----------
  const UI = { view: 'hoy', planDay: dow(), foodDate: dkey(), libGroup: 'Todos', libQ: '', onlyAvail: false };
  let REST = null; // {endAt, total}
  let lastDay = dkey();

  // ---------- toasts / sonido / notificaciones ----------
  function toast(title, body = '', ms = 4000) {
    const box = $('#toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<b>${esc(title)}</b>${body ? `<small class="muted">${esc(body)}</small>` : ''}`;
    el.addEventListener('click', () => el.remove());
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, ms);
  }
  let audioCtx = null;
  function unlockAudio() {
    if (audioCtx) return;
    try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audioCtx = new AC(); } catch (e) { audioCtx = null; }
  }
  function beep() {
    if (!audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const t = audioCtx.currentTime;
      [0, 0.18, 0.36].forEach((d, i) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine'; o.frequency.value = i === 2 ? 1046 : 880;
        g.gain.setValueAtTime(0.0001, t + d);
        g.gain.exponentialRampToValueAtTime(0.25, t + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.16);
        o.connect(g).connect(audioCtx.destination);
        o.start(t + d); o.stop(t + d + 0.18);
      });
    } catch (e) { /* sin audio */ }
  }
  let swReg = null;
  async function notify(title, body = '', tag = '') {
    toast('🔔 ' + title, body, 7000);
    if (S.settings.sound) beep();
    vibrate([200, 100, 200]);
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const opts = { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: tag || title, renotify: true, vibrate: [200, 100, 200] };
    try {
      const reg = swReg || (navigator.serviceWorker ? await navigator.serviceWorker.getRegistration() : null);
      if (reg && reg.showNotification) { await reg.showNotification(title, opts); return; }
    } catch (e) { /* probar alternativa */ }
    try { new Notification(title, opts); } catch (e) { /* no soportado */ }
  }
  async function askNotif() {
    if (!('Notification' in window)) { toast('Tu navegador no soporta notificaciones', 'Prueba con Chrome, Edge o Safari (instalando la app en la pantalla de inicio).'); return; }
    try {
      const p = await Notification.requestPermission();
      if (p === 'granted') { S.settings.notify = true; save(); notify('¡Avisos activados!', 'Te avisaré antes de cada actividad de tu plan.'); }
      else toast('Permiso denegado', 'Actívalo desde los ajustes del navegador para recibir avisos.');
    } catch (e) { toast('No se pudo pedir permiso', String(e.message || e)); }
    render();
  }

  // ---------- recordatorios ----------
  let notified = new Set();
  try { notified = new Set(JSON.parse(sessionStorage.getItem('mr.notified') || '[]')); } catch (e) { notified = new Set(); }
  const markNotified = k => { notified.add(k); try { sessionStorage.setItem('mr.notified', JSON.stringify([...notified].slice(-300))); } catch (e) { /* ignorar */ } };
  function checkReminders() {
    const k = dkey();
    if (k !== lastDay) { lastDay = k; UI.foodDate = k; UI.planDay = dow(); render(); }
    if (!S.settings.notify) return;
    const nm = nowMin();
    const done = S.done[k] || [];
    for (const b of blocksFor(dow())) {
      if (b.remind < 0 || done.includes(b.id)) continue;
      const st = toMin(b.start);
      const cat = CATS[b.cat] || CATS.otro;
      if (b.remind > 0) {
        const key = `${k}|${b.id}|pre`;
        if (nm >= st - b.remind && nm < st && !notified.has(key)) {
          markNotified(key);
          notify(`En ${st - nm} min: ${b.title}`, `${cat.icon} ${b.start} – ${b.end}${b.notes ? ' · ' + b.notes : ''}`, b.id);
        }
      }
      const key2 = `${k}|${b.id}|start`;
      if (nm >= st && nm < st + 3 && !notified.has(key2)) {
        markNotified(key2);
        notify(`Ahora: ${b.title}`, `${cat.icon} ${cat.label} · hasta las ${b.end}`, b.id);
      }
    }
    const every = num(S.settings.waterEvery);
    if (every > 0 && nm >= 540 && nm <= 1320 && Date.now() - (S.lastWaterNotif || 0) >= every * 3600000) {
      S.lastWaterNotif = Date.now(); save();
      const w = S.water[k] || 0;
      notify('💧 Hora de beber agua', `Llevas ${w} ml de ${S.goals.water} ml.`, 'water');
    }
  }

  // ---------- plan ----------
  const blocksFor = day => S.blocks.filter(b => b.days.includes(day)).sort((a, b) => toMin(a.start) - toMin(b.start));
  const isCurrent = (b, nm) => { const s = toMin(b.start), e = toMin(b.end); return e > s ? nm >= s && nm < e : nm >= s || nm < e; };

  // ---------- gráficos ----------
  function ring(pct, color, size, stroke, inner) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = clamp(pct || 0, 0, 1);
    return `<div class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - p)).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg><div class="ring-in">${inner}</div></div>`;
  }
  function bars(vals, labels, { goal = 0, color = 'var(--accent)', highlight = -1, unit = '' } = {}) {
    const W = 320, H = 140, top = 14, bottom = 22, n = vals.length;
    const max = Math.max(goal * 1.1, ...vals, 1);
    const bw = (W / n) * 0.56, gap = W / n;
    let out = '';
    vals.forEach((v, i) => {
      const h = ((H - top - bottom) * v) / max;
      const x = i * gap + (gap - bw) / 2, y = H - bottom - h;
      out += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h, v > 0 ? 2 : 0).toFixed(1)}" rx="5" fill="${color}" opacity="${i === highlight || highlight < 0 ? 1 : 0.55}"><title>${esc(labels[i])}: ${r0(v)}${unit}</title></rect>`;
      out += `<text x="${(i * gap + gap / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(labels[i])}</text>`;
      if (v > 0) out += `<text x="${(i * gap + gap / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle">${v >= 1000 ? r1(v / 1000) + 'k' : r0(v)}</text>`;
    });
    if (goal > 0) {
      const gy = H - bottom - ((H - top - bottom) * goal) / max;
      out += `<line x1="0" x2="${W}" y1="${gy.toFixed(1)}" y2="${gy.toFixed(1)}" stroke="var(--warn)" stroke-dasharray="4 4" stroke-width="1.5"/>`;
    }
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img">${out}</svg></div>`;
  }
  const meter = (label, val, goal, color, unit = 'g', limit = false) => {
    const pct = goal > 0 ? val / goal : 0;
    const over = limit && val > goal;
    return `<div class="macro"><div class="row between"><span>${label}</span><span><b>${r0(val)}</b><span class="muted"> / ${r0(goal)} ${unit}</span></span></div>
      <div class="bar"><i style="width:${clamp(pct * 100, 0, 100)}%;background:${over ? 'var(--bad)' : color}"></i></div></div>`;
  };

  // ---------- modal ----------
  const modal = () => $('#modal');
  let onModalClose = null;
  function openModal(html, onClose) {
    if (onModalClose) { const f = onModalClose; onModalClose = null; f(); }
    $('#modalBody').innerHTML = html;
    onModalClose = onClose || null;
    const m = modal();
    if (!m.open) { try { m.showModal(); } catch (e) { m.setAttribute('open', ''); } }
    $('#modalBody').scrollTop = 0;
  }
  function setModal(html) { $('#modalBody').innerHTML = html; }
  function closeModal() {
    if (onModalClose) { const f = onModalClose; onModalClose = null; f(); }
    stopCamera();
    const m = modal();
    if (m.open) { try { m.close(); } catch (e) { m.removeAttribute('open'); } }
  }
  const mHead = title => `<div class="m-head"><h2>${title}</h2><button class="m-close" data-act="closeModal" aria-label="Cerrar">×</button></div>`;
  function confirmBox(title, text, okLabel, onOk, danger = true) {
    openModal(`${mHead(esc(title))}<p class="muted">${esc(text)}</p>
      <div class="m-foot"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" id="cfOk">${esc(okLabel)}</button></div>`);
    $('#cfOk').onclick = () => { closeModal(); onOk(); };
  }

  // =====================================================================
  // VISTA: HOY
  // =====================================================================
  function viewHoy() {
    const k = dkey(), nm = nowMin();
    const blocks = blocksFor(dow());
    const done = S.done[k] || [];
    const cur = blocks.find(b => isCurrent(b, nm) && !done.includes(b.id));
    const next = blocks.find(b => toMin(b.start) > nm);
    const tot = dayTotals(k);
    const water = S.water[k] || 0;
    const studyMin = S.studyLog.filter(l => l.date === k).reduce((a, l) => a + l.min, 0);
    const pctDone = blocks.length ? done.filter(id => blocks.some(b => b.id === id)).length / blocks.length : 0;
    const hello = nm < 720 ? 'Buenos días' : nm < 1260 ? 'Buenas tardes' : 'Buenas noches';
    const name = S.settings.name ? `, ${esc(S.settings.name)}` : '';

    let hero;
    if (cur) {
      const c = CATS[cur.cat] || CATS.otro;
      hero = `<div class="muted">Ahora mismo · hasta las ${cur.end}</div><h2>${c.icon} ${esc(cur.title)}</h2>${blockAction(cur, true)}`;
    } else if (next) {
      const c = CATS[next.cat] || CATS.otro;
      hero = `<div class="muted">Siguiente en ${fmtH(toMin(next.start) - nm)} · ${next.start}</div><h2>${c.icon} ${esc(next.title)}</h2>`;
    } else {
      hero = `<div class="muted">${blocks.length ? 'Has terminado el plan de hoy' : 'No hay nada planificado hoy'}</div><h2>${blocks.length ? '¡Buen trabajo! 🎉' : 'Día libre ✨'}</h2>`;
    }

    const notifBanner = ('Notification' in window) && Notification.permission === 'default' && S.settings.notify
      ? `<div class="banner"><span style="font-size:22px">🔔</span><div class="grow">Activa los avisos para que te recuerde cada actividad.</div><button class="btn sm primary" data-act="askNotif">Activar</button></div>` : '';

    return `
      ${notifBanner}
      <div class="card hero"><div style="position:relative;z-index:1">
        <div class="muted" style="font-size:13px">${hello}${name} 👋</div>
        <div class="mt">${hero}</div>
      </div></div>

      <div class="stats">
        <div class="stat"><b>${r0(pctDone * 100)}%</b><span>Plan</span></div>
        <div class="stat"><b>${r0(tot.kcal)}</b><span>kcal</span></div>
        <div class="stat"><b>${r1(water / 1000)} L</b><span>Agua</span></div>
        <div class="stat"><b>${fmtH(studyMin).replace(' min', 'm').replace(' h', 'h')}</b><span>Estudio</span></div>
      </div>

      <div class="card mt">
        <div class="row">
          ${ring(tot.kcal / (S.goals.kcal || 1), 'var(--accent)', 92, 10, `<div><b style="font-size:17px">${r0(Math.max(0, S.goals.kcal - tot.kcal))}</b><small class="muted">kcal rest.</small></div>`)}
          <div class="grow">
            ${meter('Proteína', tot.p, S.goals.p, 'var(--p)')}
            ${meter('Carbohidratos', tot.c, S.goals.c, 'var(--c)')}
            ${meter('Grasas', tot.f, S.goals.f, 'var(--f)')}
          </div>
        </div>
        <div class="row mt between">
          <div class="row"><span style="font-size:20px">💧</span><span><b>${water}</b> <span class="muted">/ ${S.goals.water} ml</span></span></div>
          <div class="row"><button class="btn sm" data-act="water" data-ml="-250">−</button><button class="btn sm primary" data-act="water" data-ml="250">+250 ml</button></div>
        </div>
      </div>

      <div class="row between" style="margin:22px 4px 10px"><div class="sec-title" style="margin:0">Tu día · ${DAYS[dow()]}</div><button class="link" data-act="newBlock" data-day="${dow()}">+ Añadir</button></div>
      <div class="tl">${blocks.length ? blocks.map(b => tlItem(b, done.includes(b.id), cur && cur.id === b.id)).join('') : `<div class="card empty"><div class="big">🗓️</div>Aún no hay actividades para hoy.<div class="mt"><button class="btn primary" data-act="newBlock" data-day="${dow()}">Planificar hoy</button></div></div>`}</div>
    `;
  }
  function tlItem(b, isDone, isNow) {
    const c = CATS[b.cat] || CATS.otro;
    return `<div class="tl-item ${isNow ? 'now' : ''} ${isDone ? 'done' : ''}" style="--c:${c.color}">
      <button class="check ${isDone ? 'on' : ''}" data-act="toggleDone" data-id="${b.id}" aria-label="Marcar como hecho">✓</button>
      <div class="tl-main" data-act="editBlock" data-id="${b.id}">
        ${isNow ? '<div class="tl-now">● AHORA</div>' : ''}
        <div class="tl-time">${b.start} – ${b.end} · ${fmtH(durMin(b))}${b.remind >= 0 ? ' · 🔔' : ''}</div>
        <div class="tl-title">${c.icon} ${esc(b.title)}</div>
        ${b.notes ? `<div class="tl-notes">${esc(b.notes)}</div>` : ''}
      </div>
      <div class="tl-act">${isDone ? '' : blockAction(b)}</div>
    </div>`;
  }
  function blockAction(b, big = false) {
    const cls = big ? 'btn sm mt' : 'btn sm';
    if (b.cat === 'gym') return `<button class="${cls}" data-act="startWorkout" data-id="${b.routineId || ''}">▶ Entrenar</button>`;
    if (b.cat === 'comida') return `<button class="${cls}" data-act="addFoodFromBlock" data-start="${b.start}">+ Comida</button>`;
    if (b.cat === 'estudio') return `<button class="${cls}" data-act="studyFromBlock" data-sub="${b.subjectId || ''}">▶ Estudiar</button>`;
    return '';
  }

  // =====================================================================
  // VISTA: PLAN
  // =====================================================================
  function viewPlan() {
    const day = UI.planDay;
    const blocks = blocksFor(day);
    const total = blocks.reduce((a, b) => a + durMin(b), 0);
    const perCat = {};
    for (const b of S.blocks) perCat[b.cat] = (perCat[b.cat] || 0) + durMin(b) * b.days.length;
    const catRows = Object.entries(perCat).sort((a, b) => b[1] - a[1]);
    const maxCat = Math.max(1, ...catRows.map(r => r[1]));
    return `
      <div class="daypick mb">${DAYS_S.map((d, i) => `<button class="${i === day ? 'on' : ''}" data-act="planDay" data-day="${i}">${d}${i === dow() ? '•' : ''}</button>`).join('')}</div>
      <div class="row between" style="margin:4px 4px 12px">
        <div><h2>${DAYS[day]}</h2><small>${blocks.length} actividades · ${fmtH(total)} planificadas</small></div>
        <button class="btn primary sm" data-act="newBlock" data-day="${day}">+ Añadir</button>
      </div>
      ${blocks.length ? blocks.map(b => planItem(b, blocks)).join('') : `<div class="card empty"><div class="big">📝</div>Nada planificado el ${DAYS[day].toLowerCase()}.<div class="row mt" style="justify-content:center"><button class="btn" data-act="copyDay" data-day="${day}">Copiar de otro día</button></div></div>`}
      ${blocks.length ? `<div class="row mt" style="justify-content:center"><button class="btn sm" data-act="copyDay" data-day="${day}">Copiar de otro día</button></div>` : ''}

      <div class="sec-title">Resumen semanal</div>
      <div class="card">
        ${catRows.length ? catRows.map(([cat, m]) => { const c = CATS[cat] || CATS.otro; return `<div class="macro"><div class="row between"><span>${c.icon} ${c.label}</span><b>${fmtH(m)}</b></div><div class="bar"><i style="width:${(m / maxCat) * 100}%;background:${c.color}"></i></div></div>`; }).join('') : '<div class="muted">Añade actividades para ver tu semana.</div>'}
      </div>

      <div class="card flat">
        <div class="row"><span style="font-size:22px">📅</span><div class="grow"><b>Avisos aunque la app esté cerrada</b><div class="li-sub">Exporta tu plan a Google Calendar o al calendario del móvil con todas las alarmas.</div></div></div>
        <button class="btn block mt" data-act="exportICS">Exportar a calendario (.ics)</button>
      </div>`;
  }
  function planItem(b, dayBlocks) {
    const c = CATS[b.cat] || CATS.otro;
    const overlap = dayBlocks.some(o => o.id !== b.id && overlaps(o, b));
    const extra = b.cat === 'gym' && b.routineId ? (S.routines.find(r => r.id === b.routineId)?.name || '') :
      b.cat === 'estudio' && b.subjectId ? (S.subjects.find(s => s.id === b.subjectId)?.name || '') : '';
    return `<div class="tl-item" style="--c:${c.color}">
      <div class="tl-main" data-act="editBlock" data-id="${b.id}">
        <div class="tl-time">${b.start} – ${b.end} · ${fmtH(durMin(b))} ${overlap ? '<span class="badge" style="color:var(--warn)">⚠ solapa</span>' : ''}</div>
        <div class="tl-title">${c.icon} ${esc(b.title)}</div>
        <div class="tl-notes">${b.days.length === 7 ? 'Todos los días' : b.days.map(d => DAYS_S[d]).join(' · ')}${extra ? ' · ' + esc(extra) : ''}${b.remind > 0 ? ` · aviso ${b.remind} min antes` : b.remind === 0 ? ' · aviso al empezar' : ''}</div>
      </div>
      <div class="tl-act"><button class="btn sm" data-act="editBlock" data-id="${b.id}">Editar</button></div>
    </div>`;
  }
  function overlaps(a, b) {
    const as = toMin(a.start), ae = as + durMin(a), bs = toMin(b.start), be = bs + durMin(b);
    return as < be && bs < ae;
  }
  function blockForm(b, isNew) {
    const cat = b.cat;
    const reminders = [[-1, 'Sin aviso'], [0, 'Al empezar'], [5, '5 min antes'], [10, '10 min antes'], [15, '15 min antes'], [30, '30 min antes'], [60, '1 hora antes']];
    openModal(`${mHead(isNew ? 'Nueva actividad' : 'Editar actividad')}
      <label>Tipo</label>
      <div class="catpick" id="bfCats">${Object.entries(CATS).map(([k, c]) => `<button class="${k === cat ? 'on' : ''}" style="--c:${c.color}" data-act="bfCat" data-cat="${k}"><span>${c.icon}</span>${c.label}</button>`).join('')}</div>
      <label for="bfTitle">Título</label>
      <input id="bfTitle" maxlength="80" value="${esc(b.title)}" placeholder="Ej. Estudiar matemáticas">
      <div class="grid2">
        <div><label for="bfStart">Empieza</label><input id="bfStart" type="time" value="${b.start}"></div>
        <div><label for="bfEnd">Termina</label><input id="bfEnd" type="time" value="${b.end}"></div>
      </div>
      <label>Días</label>
      <div class="daypick" id="bfDays">${DAYS_S.map((d, i) => `<button class="${b.days.includes(i) ? 'on' : ''}" data-act="bfDay" data-day="${i}">${d}</button>`).join('')}</div>
      <div class="row mt" style="gap:6px"><button class="chip" data-act="bfDaysPreset" data-p="wk">Lun–Vie</button><button class="chip" data-act="bfDaysPreset" data-p="we">Fin de semana</button><button class="chip" data-act="bfDaysPreset" data-p="all">Todos</button></div>
      <div id="bfGym" class="${cat === 'gym' ? '' : 'hidden'}"><label for="bfRoutine">Rutina de gym</label>
        <select id="bfRoutine"><option value="">— Entreno libre —</option>${S.routines.map(r => `<option value="${r.id}" ${r.id === b.routineId ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
      <div id="bfStudy" class="${cat === 'estudio' ? '' : 'hidden'}"><label for="bfSubject">Asignatura</label>
        <select id="bfSubject"><option value="">— Sin asignatura —</option>${S.subjects.map(s => `<option value="${s.id}" ${s.id === b.subjectId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
      <label for="bfRemind">Recordatorio</label>
      <select id="bfRemind">${reminders.map(([v, l]) => `<option value="${v}" ${v === b.remind ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <label for="bfNotes">Notas</label>
      <textarea id="bfNotes" maxlength="300" placeholder="Opcional">${esc(b.notes || '')}</textarea>
      <div class="m-foot">
        ${isNew ? '<button class="btn" data-act="closeModal">Cancelar</button>' : `<button class="btn danger" data-act="delBlock" data-id="${b.id}">Eliminar</button>`}
        <button class="btn primary" data-act="saveBlock" data-id="${b.id}" data-new="${isNew ? 1 : 0}">Guardar</button>
      </div>`);
    $('#bfCats').dataset.cat = cat;
  }
  function saveBlockFromForm(id, isNew) {
    const title = $('#bfTitle').value.trim();
    const cat = $('#bfCats').dataset.cat || 'otro';
    const start = $('#bfStart').value, end = $('#bfEnd').value;
    const days = $$('#bfDays button.on').map(x => +x.dataset.day);
    if (!start || !end) return toast('Indica la hora de inicio y fin');
    if (!days.length) return toast('Elige al menos un día');
    const b = {
      id, title: title || CATS[cat].label, cat, start, end, days,
      remind: parseInt($('#bfRemind').value, 10),
      notes: $('#bfNotes').value.trim(),
      routineId: cat === 'gym' ? $('#bfRoutine').value : '',
      subjectId: cat === 'estudio' ? $('#bfSubject').value : ''
    };
    const i = S.blocks.findIndex(x => x.id === id);
    if (i >= 0) S.blocks[i] = b; else S.blocks.push(b);
    save(); closeModal();
    const clash = S.blocks.filter(o => o.id !== b.id && o.days.some(d => b.days.includes(d)) && overlaps(o, b));
    toast(isNew ? 'Actividad añadida ✅' : 'Cambios guardados ✅', clash.length ? `⚠ Se solapa con: ${clash.slice(0, 2).map(c => c.title).join(', ')}` : '');
    render();
  }
  function copyDayModal(target) {
    openModal(`${mHead('Copiar actividades')}<p class="muted">Elige de qué día copiar las actividades al ${DAYS[target].toLowerCase()}. Se añadirán a las que ya tengas.</p>
      <div class="stack">${DAYS.map((d, i) => i === target ? '' : `<button class="btn block" data-act="doCopyDay" data-from="${i}" data-to="${target}">${d} · ${blocksFor(i).length} actividades</button>`).join('')}</div>`);
  }
  function exportICS() {
    const BY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
    const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const fmt = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mi Rutina//ES', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Mi Rutina'];
    for (const b of S.blocks) {
      if (!b.days.length) continue;
      const d = new Date(); d.setHours(0, 0, 0, 0);
      for (let i = 0; i < 7 && !b.days.includes(dow(d)); i++) d.setDate(d.getDate() + 1);
      const st = new Date(d); st.setMinutes(toMin(b.start));
      const en = new Date(st.getTime() + Math.max(durMin(b), 5) * 60000);
      const c = CATS[b.cat] || CATS.otro;
      L.push('BEGIN:VEVENT', `UID:${b.id}@mirutina`, `DTSTAMP:${stamp}`, `DTSTART:${fmt(st)}`, `DTEND:${fmt(en)}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${[...b.days].sort().map(x => BY[x]).join(',')}`,
        `SUMMARY:${icsEsc(c.icon + ' ' + b.title)}`, `DESCRIPTION:${icsEsc(c.label + (b.notes ? ' — ' + b.notes : ''))}`, `CATEGORIES:${icsEsc(c.label)}`);
      if (b.remind >= 0) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(b.title)}`, `TRIGGER:-PT${b.remind}M`, 'END:VALARM');
      L.push('END:VEVENT');
    }
    L.push('END:VCALENDAR');
    download('mi-rutina.ics', L.join('\r\n'), 'text/calendar');
    toast('Calendario exportado 📅', 'Ábrelo con Google Calendar o el calendario del móvil para importar el plan con sus alarmas.');
  }
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // =====================================================================
  // VISTA: GYM
  // =====================================================================
  function viewGym() {
    if (S.active) return viewSession();
    const tab = S.gymTab;
    const tabs = [['rutinas', 'Rutinas'], ['biblioteca', 'Ejercicios'], ['material', 'Material'], ['historial', 'Progreso']];
    const body = tab === 'biblioteca' ? gymLibrary() : tab === 'material' ? gymEquipment() : tab === 'historial' ? gymHistory() : gymRoutines();
    return `<div class="seg">${tabs.map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-act="gymTab" data-tab="${k}">${l}</button>`).join('')}</div>${body}`;
  }
  function gymRoutines() {
    const wk = weekStart();
    const thisWeek = S.workouts.filter(w => w.date >= wk).length;
    return `
      <div class="card hero"><div style="position:relative;z-index:1" class="row between">
        <div><div class="muted">Esta semana</div><h2>${thisWeek} ${thisWeek === 1 ? 'entreno' : 'entrenos'} 💪</h2></div>
        <button class="btn" data-act="startWorkout" data-id="">▶ Entreno libre</button>
      </div></div>
      <div class="row between" style="margin:18px 4px 10px"><div class="sec-title" style="margin:0">Mis rutinas</div><button class="link" data-act="newRoutine">+ Nueva</button></div>
      ${S.routines.length ? S.routines.map(r => {
        const sets = r.exercises.reduce((a, e) => a + num(e.sets), 0);
        const mins = r.exercises.reduce((a, e) => a + (EX[e.exId]?.type === 'cardio' ? num(e.reps) : num(e.sets) * (0.75 + num(e.rest) / 60)), 0);
        return `<div class="card" style="border-left:4px solid ${esc(r.color || 'var(--accent)')}">
          <div class="row between"><div class="grow"><h3>${esc(r.name)}</h3><small>${r.exercises.length} ejercicios · ${sets} series · ~${r0(mins)} min</small></div></div>
          <div class="li-sub mt">${r.exercises.slice(0, 5).map(e => esc(EX[e.exId]?.name || '?')).join(' · ')}${r.exercises.length > 5 ? ' …' : ''}</div>
          <div class="row mt"><button class="btn primary sm grow" data-act="startWorkout" data-id="${r.id}">▶ Empezar</button><button class="btn sm" data-act="editRoutine" data-id="${r.id}">Editar</button></div>
        </div>`;
      }).join('') : '<div class="card empty"><div class="big">🏋️</div>Crea tu primera rutina.</div>'}`;
  }
  function gymLibrary() {
    const q = norm(UI.libQ);
    const groups = ['Todos', ...EX_GROUPS];
    const list = Object.values(EX).filter(e => (UI.libGroup === 'Todos' || e.group === UI.libGroup) && (!q || matches(e.name, q)) && (!UI.onlyAvail || exAvail(e.id)));
    return `
      <input placeholder="🔍 Buscar ejercicio…" value="${esc(UI.libQ)}" data-in="libQ" id="libQ">
      <div class="chips mt">${groups.map(g => `<button class="chip ${g === UI.libGroup ? 'on' : ''}" data-act="libGroup" data-g="${esc(g)}">${esc(g)}</button>`).join('')}</div>
      <div class="row between mt"><label class="row" style="margin:0;cursor:pointer"><input type="checkbox" style="width:18px;height:18px;accent-color:var(--accent)" data-act="onlyAvail" ${UI.onlyAvail ? 'checked' : ''}> Solo disponibles en mi gym</label><button class="link" data-act="newExercise">+ Crear</button></div>
      <div class="card mt" id="libList">${libListHTML(list)}</div>`;
  }
  function libListHTML(list) {
    if (!list.length) return '<div class="empty">No hay ejercicios con ese filtro.</div>';
    return list.map(e => {
      const pr = exPR(e.id);
      return `<div class="list-item ${exAvail(e.id) ? '' : 'dim'}"><div class="grow" data-act="exDetail" data-id="${e.id}">
        <div class="li-title">${esc(e.name)}</div><div class="li-sub">${esc(e.group)} · ${esc(e.equip)}${exAvail(e.id) ? '' : ' · no disponible'}${e.custom ? ' · personalizado' : ''}</div></div>
        ${pr ? `<span class="badge">🏆 ${pr.kg} kg × ${pr.reps}</span>` : ''}</div>`;
    }).join('');
  }
  function gymEquipment() {
    const total = Object.keys(EX).length + D.GENERAL_EQUIPMENT.length;
    const avail = Object.keys(EX).filter(exAvail).length + D.GENERAL_EQUIPMENT.filter(e => S.equipment['eq:' + slug(e)] !== false).length;
    return `
      <div class="banner"><span style="font-size:22px">🏢</span><div class="grow">Marca lo que tiene tu gimnasio (${avail}/${total}). Lo que desmarques aparecerá como “no disponible” en los ejercicios.</div></div>
      <div class="card"><h3>Máquinas y material general</h3><div class="mt">${D.GENERAL_EQUIPMENT.map(e => {
        const k = 'eq:' + slug(e);
        return `<label class="equip-row"><input type="checkbox" data-act="equip" data-k="${k}" ${S.equipment[k] !== false ? 'checked' : ''}><span class="grow">${esc(e)}</span></label>`;
      }).join('')}</div></div>
      ${EX_GROUPS.map(g => {
        const items = Object.values(EX).filter(e => e.group === g);
        if (!items.length) return '';
        return `<div class="card"><div class="row between"><h3>${esc(g)}</h3><small>${items.filter(e => exAvail(e.id)).length}/${items.length}</small></div><div class="mt">${items.map(e =>
          `<label class="equip-row"><input type="checkbox" data-act="equip" data-k="ex:${e.id}" ${exAvail(e.id) ? 'checked' : ''}><span class="grow">${esc(e.name)}</span><span class="badge">${esc(e.equip)}</span></label>`).join('')}</div></div>`;
      }).join('')}`;
  }
  const workoutVolume = w => w.exercises.reduce((a, e) => EX[e.exId]?.type === 'cardio' ? a : a + e.sets.reduce((s, x) => s + num(x.a) * num(x.b), 0), 0);
  function gymHistory() {
    const ws = [...S.workouts].sort((a, b) => b.start - a.start);
    if (!ws.length) return '<div class="card empty"><div class="big">📈</div>Aquí verás tu progreso cuando completes tu primer entreno.</div>';
    const last = ws.slice(0, 8).reverse();
    const wk = weekStart();
    const setsByGroup = {};
    for (const w of ws.filter(w => w.date >= wk)) for (const e of w.exercises) { const g = EX[e.exId]?.group || 'Otros'; setsByGroup[g] = (setsByGroup[g] || 0) + e.sets.length; }
    const sg = Object.entries(setsByGroup).sort((a, b) => b[1] - a[1]);
    const maxSg = Math.max(1, ...sg.map(x => x[1]));
    const month = dkey().slice(0, 7);
    const totalMin = ws.filter(w => w.date.startsWith(month)).reduce((a, w) => a + (w.end - w.start) / 60000, 0);
    return `
      <div class="grid3 mb">
        <div class="stat"><b>${ws.length}</b><span>Entrenos</span></div>
        <div class="stat"><b>${ws.filter(w => w.date.startsWith(month)).length}</b><span>Este mes</span></div>
        <div class="stat"><b>${fmtH(totalMin).replace(' min', 'm').replace(' h', 'h')}</b><span>Tiempo mes</span></div>
      </div>
      <div class="card"><h3>Volumen por sesión (kg)</h3><div class="mt">${bars(last.map(workoutVolume), last.map(w => fmtDate(w.date, { day: 'numeric', month: 'numeric' })), { color: 'var(--p)', unit: ' kg' })}</div></div>
      <div class="card"><h3>Series por grupo esta semana</h3><small>Recomendado: 10–20 series semanales por grupo muscular.</small>
        ${sg.length ? sg.map(([g, n]) => `<div class="macro"><div class="row between"><span>${esc(g)}</span><b>${n}</b></div><div class="bar"><i style="width:${(n / maxSg) * 100}%;background:${n >= 10 ? 'var(--ok)' : 'var(--accent)'}"></i></div></div>`).join('') : '<div class="muted mt">Sin entrenos esta semana.</div>'}
      </div>
      <div class="sec-title">Historial</div>
      <div class="card">${ws.map(w => `<div class="list-item"><div class="grow" data-act="workoutDetail" data-id="${w.id}">
        <div class="li-title">${esc(w.name)}</div><div class="li-sub">${fmtDate(w.date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmtH((w.end - w.start) / 60000)} · ${w.exercises.reduce((a, e) => a + e.sets.length, 0)} series · ${r0(workoutVolume(w))} kg</div></div><span class="dim">›</span></div>`).join('')}</div>`;
  }
  function exHistory(exId, exceptId) {
    const out = [];
    for (const w of [...S.workouts].sort((a, b) => b.start - a.start)) {
      if (w.id === exceptId) continue;
      const e = w.exercises.find(x => x.exId === exId);
      if (e && e.sets.length) out.push({ date: w.date, sets: e.sets });
    }
    return out;
  }
  function exPR(exId) {
    if (EX[exId]?.type === 'cardio') return null;
    let best = null;
    for (const w of S.workouts) for (const e of w.exercises) if (e.exId === exId) for (const s of e.sets) {
      const kg = num(s.a), reps = num(s.b);
      if (kg > 0 && reps > 0 && (!best || kg > best.kg || (kg === best.kg && reps > best.reps))) best = { kg, reps, rm: r1(kg * (1 + reps / 30)) };
    }
    return best;
  }
  const setsStr = (sets, cardio) => sets.map(s => cardio ? `${num(s.b)} min${num(s.a) ? ' · ' + num(s.a) + ' km' : ''}` : `${num(s.a)}×${num(s.b)}`).join(', ');

  function exDetail(id) {
    const e = EX[id];
    if (!e) return;
    const pr = exPR(id), hist = exHistory(id).slice(0, 8);
    const cardio = e.type === 'cardio';
    openModal(`${mHead(esc(e.name))}
      <div class="row wrap"><span class="badge">${esc(e.group)}</span><span class="badge">${esc(e.equip)}</span>${exAvail(id) ? '<span class="badge" style="color:var(--ok)">Disponible</span>' : '<span class="badge" style="color:var(--bad)">No disponible</span>'}</div>
      ${pr ? `<div class="grid2 mt"><div class="stat"><b>${pr.kg} kg × ${pr.reps}</b><span>Mejor serie</span></div><div class="stat"><b>${pr.rm} kg</b><span>1RM estimado</span></div></div>` : ''}
      <div class="sec-title">Últimas sesiones</div>
      <div class="card flat">${hist.length ? hist.map(h => `<div class="list-item"><div class="grow"><div class="li-title">${fmtDate(h.date, { weekday: 'short', day: 'numeric', month: 'short' })}</div><div class="li-sub">${setsStr(h.sets, cardio)}</div></div></div>`).join('') : '<div class="muted">Todavía no lo has registrado.</div>'}</div>
      <label for="exToR">Añadir a rutina</label>
      <div class="row"><select id="exToR" class="grow">${S.routines.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select><button class="btn primary" data-act="exToRoutine" data-id="${id}" ${S.routines.length ? '' : 'disabled'}>Añadir</button></div>
      ${e.custom ? `<div class="m-foot"><button class="btn danger" data-act="delExercise" data-id="${id}">Eliminar ejercicio</button></div>` : ''}`);
  }
  function newExerciseModal() {
    openModal(`${mHead('Crear ejercicio')}
      <label for="neName">Nombre</label><input id="neName" maxlength="60" placeholder="Ej. Press banca con mancuernas">
      <label for="neGroup">Grupo muscular</label><select id="neGroup">${EX_GROUPS.map(g => `<option>${esc(g)}</option>`).join('')}</select>
      <label for="neEquip">Material</label><select id="neEquip">${['Mancuernas', 'Barra', 'Máquina', 'Polea', 'Smith', 'Banco', 'Peso corporal', 'Kettlebell', 'Bandas', 'Cardio'].map(x => `<option>${x}</option>`).join('')}</select>
      <label for="neType">Tipo</label><select id="neType"><option value="strength">Fuerza (kg × reps)</option><option value="cardio">Cardio (minutos y km)</option></select>
      <div class="m-foot"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="saveExercise">Crear</button></div>`);
  }

  // --- editor de rutinas ---
  let RED = null; // copia de trabajo
  function routineEditor(r) {
    RED = JSON.parse(JSON.stringify(r));
    renderRoutineEditor();
  }
  function renderRoutineEditor() {
    const isNew = !S.routines.some(x => x.id === RED.id);
    const colors = ['#ff5c7a', '#5ec8ff', '#2fd18b', '#8b6cff', '#ffb547', '#f472b6'];
    const html = `${mHead(isNew ? 'Nueva rutina' : 'Editar rutina')}
      <label for="reName">Nombre</label><input id="reName" data-in="reName" maxlength="60" value="${esc(RED.name)}" placeholder="Ej. Torso A">
      <div class="row mt">${colors.map(c => `<button data-act="reColor" data-c="${c}" style="width:30px;height:30px;border-radius:50%;background:${c};border:3px solid ${c === RED.color ? 'var(--text)' : 'transparent'}" aria-label="Color"></button>`).join('')}</div>
      <div class="sec-title">Ejercicios (${RED.exercises.length})</div>
      ${RED.exercises.map((e, i) => {
        const ex = EX[e.exId] || { name: 'Ejercicio eliminado', type: 'strength', group: '' };
        const cardio = ex.type === 'cardio';
        return `<div class="r-ex"><div class="row between"><div class="grow"><b>${esc(ex.name)}</b><div class="li-sub">${esc(ex.group)}</div></div>
          <div class="mini-btns"><button data-act="reMove" data-i="${i}" data-d="-1" aria-label="Subir">↑</button><button data-act="reMove" data-i="${i}" data-d="1" aria-label="Bajar">↓</button><button data-act="reDel" data-i="${i}" aria-label="Quitar">✕</button></div></div>
          <div class="nums">
            ${cardio ? `<div style="grid-column:span 2"><label>Minutos</label><input type="number" inputmode="numeric" min="1" data-in="reF" data-i="${i}" data-f="reps" value="${esc(e.reps)}"></div><div></div><div></div>` : `
            <div><label>Series</label><input type="number" inputmode="numeric" min="1" data-in="reF" data-i="${i}" data-f="sets" value="${esc(e.sets)}"></div>
            <div><label>Reps</label><input type="number" inputmode="numeric" min="1" data-in="reF" data-i="${i}" data-f="reps" value="${esc(e.reps)}"></div>
            <div><label>Kg</label><input type="number" inputmode="decimal" step="any" data-in="reF" data-i="${i}" data-f="kg" value="${esc(e.kg)}" placeholder="—"></div>
            <div><label>Desc. (s)</label><input type="number" inputmode="numeric" step="15" data-in="reF" data-i="${i}" data-f="rest" value="${esc(e.rest)}"></div>`}
          </div></div>`;
      }).join('') || '<div class="muted center">Añade ejercicios a la rutina.</div>'}
      <button class="btn block mt" data-act="rePick">+ Añadir ejercicios</button>
      <div class="m-foot">${isNew ? '<button class="btn" data-act="closeModal">Cancelar</button>' : `<button class="btn danger" data-act="delRoutine" data-id="${RED.id}">Eliminar</button>`}<button class="btn primary" data-act="saveRoutine">Guardar</button></div>`;
    if (modal().open) setModal(html); else openModal(html);
  }

  // --- selector de ejercicios ---
  let PICK = null; // {sel:Set, q, g, done(ids), back()}
  function openPicker(done, back) {
    PICK = { sel: new Set(), q: '', g: 'Todos', done, back };
    const html = `${mHead('Elegir ejercicios')}
      <input id="pkQ" data-in="pkQ" placeholder="🔍 Buscar…">
      <div class="chips mt" id="pkG">${['Todos', ...EX_GROUPS].map(g => `<button class="chip ${g === 'Todos' ? 'on' : ''}" data-act="pkGroup" data-g="${esc(g)}">${esc(g)}</button>`).join('')}</div>
      <div id="pkList" class="mt"></div>
      <div class="m-foot"><button class="btn" data-act="pkBack">Volver</button><button class="btn primary" data-act="pkDone" id="pkBtn">Añadir</button></div>`;
    if (modal().open) setModal(html); else openModal(html);
    renderPickList();
  }
  function renderPickList() {
    const q = norm(PICK.q);
    const list = Object.values(EX).filter(e => (PICK.g === 'Todos' || e.group === PICK.g) && (!q || matches(e.name, q)));
    $('#pkList').innerHTML = list.map(e => `<label class="pick ${exAvail(e.id) ? '' : 'na'}"><input type="checkbox" data-act="pkTgl" data-id="${e.id}" ${PICK.sel.has(e.id) ? 'checked' : ''}>
      <div class="grow"><div class="li-title">${esc(e.name)}</div><div class="li-sub">${esc(e.group)} · ${esc(e.equip)}${exAvail(e.id) ? '' : ' · no disponible'}</div></div></label>`).join('') || '<div class="empty">Sin resultados</div>';
    $('#pkBtn').textContent = PICK.sel.size ? `Añadir (${PICK.sel.size})` : 'Añadir';
  }

  // --- sesión de entreno ---
  function makeSessionEx(exId, cfg) {
    const ex = EX[exId];
    const cardio = ex?.type === 'cardio';
    const last = exHistory(exId)[0];
    const n = cardio ? 1 : clamp(r0(num(cfg?.sets)) || last?.sets.length || 3, 1, 20);
    const sets = [];
    for (let i = 0; i < n; i++) {
      const ls = last?.sets[Math.min(i, (last?.sets.length || 1) - 1)];
      sets.push({
        a: cardio ? (ls?.a ?? '') : (cfg?.kg !== '' && cfg?.kg != null ? cfg.kg : (ls?.a ?? '')),
        b: cfg?.reps ?? ls?.b ?? (cardio ? 20 : 10),
        done: false
      });
    }
    return { exId, rest: num(cfg?.rest) || 90, sets };
  }
  function startWorkout(routineId) {
    const go = () => {
      const r = S.routines.find(x => x.id === routineId);
      S.active = { id: uid(), routineId: r ? r.id : '', name: r ? r.name : 'Entreno libre', start: Date.now(), exercises: r ? r.exercises.filter(e => EX[e.exId]).map(e => makeSessionEx(e.exId, e)) : [] };
      save();
      if (UI.view !== 'gym') location.hash = 'gym'; else render();
      toast('¡A entrenar! 💪', r ? `${r.exercises.length} ejercicios` : 'Añade ejercicios sobre la marcha');
    };
    if (S.active) { closeModal(); location.hash = 'gym'; toast('Ya tienes un entreno en curso', 'Termínalo o descártalo para empezar otro.'); return; }
    go();
  }
  function viewSession() {
    const a = S.active;
    const doneSets = a.exercises.reduce((s, e) => s + e.sets.filter(x => x.done).length, 0);
    const totalSets = a.exercises.reduce((s, e) => s + e.sets.length, 0);
    return `
      <div class="card hero"><div style="position:relative;z-index:1">
        <div class="muted">Entreno en curso</div><h2>${esc(a.name)}</h2>
        <div class="row between mt"><div><b style="font-size:26px" data-tick="elapsed">${fmtClock(Date.now() - a.start)}</b></div><div class="muted">${doneSets}/${totalSets} series</div></div>
      </div></div>
      ${a.exercises.map((e, i) => {
        const ex = EX[e.exId] || { name: 'Ejercicio', group: '', type: 'strength' };
        const cardio = ex.type === 'cardio';
        const last = exHistory(e.exId, a.id)[0];
        return `<div class="ex-card">
          <div class="row between"><div class="grow"><h3>${esc(ex.name)}</h3><div class="li-sub">${esc(ex.group)}${cardio ? '' : ` · descanso ${e.rest}s`}</div></div>
            <div class="mini-btns"><button data-act="sxMove" data-i="${i}" data-d="-1" aria-label="Subir">↑</button><button data-act="sxMove" data-i="${i}" data-d="1" aria-label="Bajar">↓</button><button data-act="sxDel" data-i="${i}" aria-label="Quitar">✕</button></div></div>
          ${last ? `<div class="hint">Última vez (${fmtDate(last.date, { day: 'numeric', month: 'short' })}): ${setsStr(last.sets, cardio)}</div>` : ''}
          <div class="set-head"><span>#</span><span>${cardio ? 'km' : 'kg'}</span><span>${cardio ? 'min' : 'reps'}</span><span></span><span></span></div>
          ${e.sets.map((s, j) => `<div class="set-row ${s.done ? 'done' : ''}">
            <span class="set-n">${j + 1}</span>
            <input type="number" inputmode="decimal" step="any" min="0" placeholder="${cardio ? 'km' : 'kg'}" value="${esc(s.a)}" data-in="sxA" data-i="${i}" data-j="${j}">
            <input type="number" inputmode="numeric" step="any" min="0" placeholder="${cardio ? 'min' : 'reps'}" value="${esc(s.b)}" data-in="sxB" data-i="${i}" data-j="${j}">
            <button class="set-ok" data-act="sxDone" data-i="${i}" data-j="${j}" aria-label="Serie hecha">✓</button>
            <button class="x" data-act="sxSetDel" data-i="${i}" data-j="${j}" aria-label="Borrar serie">×</button>
          </div>`).join('')}
          <button class="btn sm" data-act="sxSetAdd" data-i="${i}">+ Serie</button>
        </div>`;
      }).join('')}
      <button class="btn block" data-act="sxPick">+ Añadir ejercicio</button>
      <div class="row mt"><button class="btn danger grow" data-act="sxCancel">Descartar</button><button class="btn primary grow" data-act="sxFinish">Finalizar entreno</button></div>`;
  }
  function startRest(sec) {
    REST = { endAt: Date.now() + sec * 1000, total: sec };
    renderFloating();
  }
  function finishWorkout(updateRoutine) {
    const a = S.active;
    const exercises = a.exercises.map(e => ({ exId: e.exId, sets: e.sets.filter(s => s.done).map(s => ({ a: num(s.a), b: num(s.b) })) })).filter(e => e.sets.length);
    if (!exercises.length) { toast('No hay series completadas', 'Marca las series con ✓ o descarta el entreno.'); return; }
    const w = { id: a.id, date: dkey(new Date(a.start)), start: a.start, end: Date.now(), name: a.name, routineId: a.routineId, exercises };
    S.workouts.push(w);
    if (updateRoutine && a.routineId) {
      const r = S.routines.find(x => x.id === a.routineId);
      if (r) for (const e of exercises) {
        const re = r.exercises.find(x => x.exId === e.exId);
        if (re && EX[e.exId]?.type !== 'cardio') { const mx = Math.max(...e.sets.map(s => s.a)); if (mx > 0) re.kg = mx; }
      }
    }
    const k = dkey();
    const gb = blocksFor(dow()).find(b => b.cat === 'gym' && (!a.routineId || !b.routineId || b.routineId === a.routineId));
    if (gb) { S.done[k] = S.done[k] || []; if (!S.done[k].includes(gb.id)) S.done[k].push(gb.id); }
    S.active = null; REST = null;
    save(); closeModal();
    const prs = exercises.filter(e => { const before = S.workouts.filter(x => x.id !== w.id); let best = 0; for (const x of before) for (const ee of x.exercises) if (ee.exId === e.exId) for (const s of ee.sets) best = Math.max(best, num(s.a)); return best > 0 && Math.max(...e.sets.map(s => s.a)) > best; });
    toast('¡Entreno guardado! 🏆', `${fmtH((w.end - w.start) / 60000)} · ${r0(workoutVolume(w))} kg de volumen${prs.length ? ` · ${prs.length} récord${prs.length > 1 ? 's' : ''} nuevo${prs.length > 1 ? 's' : ''}` : ''}`, 6000);
    S.gymTab = 'historial'; save();
    render();
  }
  function workoutDetail(id) {
    const w = S.workouts.find(x => x.id === id);
    if (!w) return;
    openModal(`${mHead(esc(w.name))}
      <small>${fmtDate(w.date)} · ${new Date(w.start).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · ${fmtH((w.end - w.start) / 60000)}</small>
      <div class="grid2 mt"><div class="stat"><b>${r0(workoutVolume(w))} kg</b><span>Volumen</span></div><div class="stat"><b>${w.exercises.reduce((a, e) => a + e.sets.length, 0)}</b><span>Series</span></div></div>
      <div class="card flat mt">${w.exercises.map(e => { const ex = EX[e.exId]; return `<div class="list-item"><div class="grow"><div class="li-title">${esc(ex?.name || 'Ejercicio')}</div><div class="li-sub">${setsStr(e.sets, ex?.type === 'cardio')}</div></div></div>`; }).join('')}</div>
      <div class="m-foot"><button class="btn danger" data-act="delWorkout" data-id="${w.id}">Eliminar</button><button class="btn" data-act="closeModal">Cerrar</button></div>`);
  }

  // =====================================================================
  // VISTA: COMIDAS
  // =====================================================================
  function dayTotals(k) {
    const t = zeroN();
    for (const e of S.meals[k] || []) addN(t, scaleN(e.n, e.g));
    return t;
  }
  function viewComidas() {
    const k = UI.foodDate;
    const t = dayTotals(k), g = S.goals;
    const entries = S.meals[k] || [];
    const photos = S.photos[k] || [];
    const water = S.water[k] || 0;
    const isToday = k === dkey();
    const kcalM = t.p * 4 + t.c * 4 + t.f * 9;
    const pp = kcalM ? (t.p * 4) / kcalM * 100 : 0, pc = kcalM ? (t.c * 4) / kcalM * 100 : 0, pf = kcalM ? (t.f * 9) / kcalM * 100 : 0;
    const last7 = [...Array(7)].map((_, i) => addDays(k, i - 6));
    return `
      <div class="row between mb">
        <button class="btn sm" data-act="foodDay" data-d="-1" aria-label="Día anterior">‹</button>
        <div class="center"><b style="text-transform:capitalize">${isToday ? 'Hoy' : fmtDate(k, { weekday: 'long' })}</b><div class="li-sub">${fmtDate(k, { day: 'numeric', month: 'long' })}</div></div>
        <button class="btn sm" data-act="foodDay" data-d="1" ${isToday ? 'disabled' : ''} aria-label="Día siguiente">›</button>
      </div>

      <div class="card">
        <div class="row" style="gap:16px">
          ${ring(t.kcal / (g.kcal || 1), t.kcal > g.kcal * 1.05 ? 'var(--bad)' : 'var(--accent)', 128, 13, `<div><b>${r0(t.kcal)}</b><small class="muted">de ${g.kcal} kcal</small></div>`)}
          <div class="grow">
            ${meter('Proteína', t.p, g.p, 'var(--p)')}
            ${meter('Carbohidratos', t.c, g.c, 'var(--c)')}
            ${meter('Grasas', t.f, g.f, 'var(--f)')}
          </div>
        </div>
        <div class="row between mt"><small>${t.kcal <= g.kcal ? `Te quedan <b>${r0(g.kcal - t.kcal)}</b> kcal` : `Te has pasado <b style="color:var(--bad)">${r0(t.kcal - g.kcal)}</b> kcal`}</small><button class="link" data-act="goalsModal">Objetivos ⚙</button></div>
      </div>

      <div class="grid2">
        <button class="btn primary" data-act="addFood" data-meal="${guessMeal()}">+ Añadir alimento</button>
        <button class="btn" data-act="addFood" data-meal="${guessMeal()}" data-tab="foto">📷 Foto / escanear</button>
      </div>

      ${MEALS.map(([id, label, icon]) => {
        const items = entries.filter(e => e.meal === id);
        const ph = photos.filter(p => p.meal === id);
        const mt = items.reduce((a, e) => addN(a, scaleN(e.n, e.g)), zeroN());
        return `<div class="card mt">
          <div class="row between"><div><h3>${icon} ${label}</h3>${items.length ? `<div class="li-sub">P ${r0(mt.p)} g · C ${r0(mt.c)} g · G ${r0(mt.f)} g</div>` : ''}</div>
            <div class="row"><span class="kcal">${r0(mt.kcal)} kcal</span><button class="btn sm" data-act="addFood" data-meal="${id}" aria-label="Añadir a ${label}">+</button></div></div>
          ${items.length ? `<div class="mt">${items.map(e => { const n = scaleN(e.n, e.g); return `<div class="list-item"><div class="grow" data-act="editEntry" data-id="${e.id}"><div class="li-title">${esc(e.name)}</div><div class="li-sub">${r0(e.g)} g · P ${r1(n.p)} · C ${r1(n.c)} · G ${r1(n.f)}</div></div><span class="kcal">${r0(n.kcal)}</span></div>`; }).join('')}</div>` : ''}
          ${ph.length ? `<div class="thumbs">${ph.map(p => `<img src="${p.img}" alt="Foto de ${label}" data-act="viewPhoto" data-id="${p.id}">`).join('')}</div>` : ''}
        </div>`;
      }).join('')}

      <div class="card">
        <div class="row between"><h3>💧 Agua</h3><span><b>${water}</b> <span class="muted">/ ${g.water} ml</span></span></div>
        <div class="bar mt"><i style="width:${clamp((water / (g.water || 1)) * 100, 0, 100)}%;background:var(--accent2)"></i></div>
        <div class="row mt"><button class="btn sm" data-act="water" data-ml="-250" data-date="${k}">−250</button><button class="btn sm grow" data-act="water" data-ml="250" data-date="${k}">+ Vaso 250 ml</button><button class="btn sm grow" data-act="water" data-ml="500" data-date="${k}">+ Botella 500 ml</button></div>
      </div>

      <div class="sec-title">Análisis nutricional</div>
      <div class="card">
        <h3>Distribución de calorías</h3>
        <div class="stackbar mt"><i style="width:${pp}%;background:var(--p)"></i><i style="width:${pc}%;background:var(--c)"></i><i style="width:${pf}%;background:var(--f)"></i></div>
        <div class="legend"><span><i class="dot" style="background:var(--p)"></i>Proteína ${r0(pp)}%</span><span><i class="dot" style="background:var(--c)"></i>Carbohidratos ${r0(pc)}%</span><span><i class="dot" style="background:var(--f)"></i>Grasas ${r0(pf)}%</span></div>
        <div class="mt">
          ${meter('Fibra', t.fib, g.fib, 'var(--ok)')}
          ${meter('Azúcares', t.sug, 50, 'var(--warn)', 'g', true)}
          ${meter('Grasas saturadas', t.sat, Math.max(1, (g.kcal * 0.1) / 9), 'var(--warn)', 'g', true)}
          ${meter('Sodio', t.sod, 2000, 'var(--warn)', 'mg', true)}
        </div>
      </div>
      <div class="card"><h3>Valoración del día</h3><ul class="insights mt">${insights(t, k).map(([ic, tx]) => `<li><span>${ic}</span><span>${tx}</span></li>`).join('')}</ul></div>
      <div class="card"><h3>Calorías últimos 7 días</h3><small>La línea discontinua es tu objetivo.</small>
        <div class="mt">${bars(last7.map(d => dayTotals(d).kcal), last7.map(d => DAYS_S[dow(parseKey(d))]), { goal: g.kcal, highlight: 6, unit: ' kcal' })}</div>
        <div class="grid3 mt">${(() => { const tt = last7.map(dayTotals).filter(x => x.kcal > 0); const n = tt.length || 1; const avg = f => tt.reduce((a, x) => a + x[f], 0) / n; return `<div class="stat"><b>${r0(avg('kcal'))}</b><span>kcal/día</span></div><div class="stat"><b>${r0(avg('p'))} g</b><span>proteína/día</span></div><div class="stat"><b>${tt.length}/7</b><span>días registrados</span></div>`; })()}</div>
      </div>
      <div class="row" style="justify-content:center"><button class="btn sm" data-act="copyMeals" data-date="${k}">Copiar comidas del día anterior</button></div>`;
  }
  function insights(t, k) {
    const g = S.goals, out = [];
    if (!(S.meals[k] || []).length) return [['📝', 'Registra lo que comes para ver un análisis completo de tu día.']];
    const w = num(S.profile.weight) || 70;
    const pk = t.p / w;
    out.push(t.p >= g.p * 0.9 ? ['✅', `Proteína en objetivo: <b>${r1(pk)} g/kg</b> de peso corporal.`] : ['⚠️', `Te faltan <b>${r0(g.p - t.p)} g</b> de proteína (${r1(pk)} g/kg). Prueba con huevos, skyr, pollo, atún o legumbres.`]);
    const diff = t.kcal - g.kcal;
    out.push(Math.abs(diff) <= g.kcal * 0.07 ? ['✅', 'Calorías muy cerca de tu objetivo.'] : diff < 0 ? ['ℹ️', `Vas <b>${r0(-diff)} kcal</b> por debajo del objetivo.`] : ['⚠️', `Vas <b>${r0(diff)} kcal</b> por encima del objetivo.`]);
    out.push(t.fib >= 25 ? ['✅', `Buena fibra: ${r0(t.fib)} g.`] : ['⚠️', `Fibra baja (${r0(t.fib)} g, se recomiendan 25–35 g). Añade fruta, verdura, legumbres o avena.`]);
    if (t.sug > 50) out.push(['⚠️', `Azúcares altos: ${r0(t.sug)} g (la OMS recomienda menos de 50 g de azúcares libres).`]);
    if (t.sat * 9 > t.kcal * 0.1 && t.kcal > 0) out.push(['⚠️', `Las grasas saturadas superan el 10% de las calorías (${r0(t.sat)} g).`]);
    if (t.sod > 2000) out.push(['⚠️', `Sodio elevado: ${r0(t.sod)} mg (≈ ${r1(t.sod * 2.5 / 1000)} g de sal). Límite recomendado: 2000 mg.`]);
    const water = S.water[k] || 0;
    out.push(water >= g.water ? ['✅', '¡Objetivo de agua cumplido!'] : ['💧', `Te faltan ${g.water - water} ml de agua.`]);
    return out;
  }
  function goalsModal() {
    const p = S.profile, g = S.goals;
    openModal(`${mHead('Objetivos nutricionales')}
      <div class="card flat"><h3>Calculadora</h3><small>Fórmula Mifflin-St Jeor + nivel de actividad.</small>
        <div class="grid2"><div><label for="gSex">Sexo</label><select id="gSex"><option value="h" ${p.sex === 'h' ? 'selected' : ''}>Hombre</option><option value="m" ${p.sex === 'm' ? 'selected' : ''}>Mujer</option></select></div>
        <div><label for="gAge">Edad</label><input id="gAge" type="number" inputmode="numeric" value="${p.age}"></div>
        <div><label for="gW">Peso (kg)</label><input id="gW" type="number" inputmode="decimal" step="any" value="${p.weight}"></div>
        <div><label for="gH">Altura (cm)</label><input id="gH" type="number" inputmode="numeric" value="${p.height}"></div></div>
        <label for="gAct">Actividad</label><select id="gAct">${[[1.2, 'Sedentario'], [1.375, 'Ligera (1–3 días/sem)'], [1.55, 'Moderada (3–5 días/sem)'], [1.725, 'Alta (6–7 días/sem)'], [1.9, 'Muy alta (doble sesión / trabajo físico)']].map(([v, l]) => `<option value="${v}" ${num(p.activity) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <label for="gGoal">Objetivo</label><select id="gGoal">${[['perder', 'Perder grasa (−20%)'], ['mantener', 'Mantener'], ['ganar', 'Ganar músculo (+10%)']].map(([v, l]) => `<option value="${v}" ${p.goal === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <button class="btn block mt" data-act="calcGoals">Calcular</button>
        <div id="gRes" class="li-sub mt"></div>
      </div>
      <div class="grid2">
        <div><label for="gKcal">Calorías (kcal)</label><input id="gKcal" type="number" inputmode="numeric" value="${g.kcal}"></div>
        <div><label for="gP">Proteína (g)</label><input id="gP" type="number" inputmode="numeric" value="${g.p}"></div>
        <div><label for="gC">Carbohidratos (g)</label><input id="gC" type="number" inputmode="numeric" value="${g.c}"></div>
        <div><label for="gF">Grasas (g)</label><input id="gF" type="number" inputmode="numeric" value="${g.f}"></div>
        <div><label for="gFib">Fibra (g)</label><input id="gFib" type="number" inputmode="numeric" value="${g.fib}"></div>
        <div><label for="gWater">Agua (ml)</label><input id="gWater" type="number" inputmode="numeric" step="250" value="${g.water}"></div>
      </div>
      <div class="m-foot"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="saveGoals">Guardar</button></div>`);
  }
  function calcGoals() {
    const sex = $('#gSex').value, age = num($('#gAge').value), w = num($('#gW').value), h = num($('#gH').value), act = num($('#gAct').value), goal = $('#gGoal').value;
    if (!(age > 0 && w > 0 && h > 0)) return toast('Revisa edad, peso y altura');
    const bmr = 10 * w + 6.25 * h - 5 * age + (sex === 'h' ? 5 : -161);
    const tdee = bmr * act;
    const kcal = r0((goal === 'perder' ? tdee * 0.8 : goal === 'ganar' ? tdee * 1.1 : tdee) / 10) * 10;
    const p = r0(w * (goal === 'perder' ? 2.2 : goal === 'ganar' ? 2 : 1.8));
    const f = r0(w * 0.9);
    const c = Math.max(0, r0((kcal - p * 4 - f * 9) / 4));
    $('#gKcal').value = kcal; $('#gP').value = p; $('#gC').value = c; $('#gF').value = f;
    $('#gFib').value = r0((kcal / 1000) * 14); $('#gWater').value = r0((w * 35) / 250) * 250;
    $('#gRes').innerHTML = `Metabolismo basal: <b>${r0(bmr)} kcal</b> · Gasto diario: <b>${r0(tdee)} kcal</b>. Revisa los valores y pulsa Guardar.`;
    S.profile = { sex, age, weight: w, height: h, activity: act, goal };
  }

  // --- añadir alimento ---
  let AF = null; // {date, meal, tab, q, food, online, onlineQ, loading, photo, ai}
  function openAddFood(meal, tab = 'buscar', date = UI.foodDate) {
    AF = { date, meal: meal || guessMeal(), tab, q: '', food: null, online: null, loading: false, photo: null, ai: null, aiErr: '' };
    openModal('<div id="afRoot"></div>', () => { AF = null; });
    renderAF();
  }
  function renderAF() {
    if (!AF) return;
    const root = $('#afRoot');
    if (!root) return;
    if (AF.food) { root.innerHTML = portionHTML(); updatePortion(); return; }
    const tabs = [['buscar', '🔍 Buscar'], ['escanear', '▥ Código'], ['foto', '📷 Foto'], ['crear', '✏️ Crear']];
    root.innerHTML = `${mHead('Añadir a ' + esc(mealName(AF.meal)))}
      <div class="chips mb">${MEALS.map(([id, l]) => `<button class="chip ${id === AF.meal ? 'on' : ''}" data-act="afMeal" data-m="${id}">${l}</button>`).join('')}</div>
      <div class="seg">${tabs.map(([k, l]) => `<button class="${k === AF.tab ? 'on' : ''}" data-act="afTab" data-tab="${k}">${l}</button>`).join('')}</div>
      <div id="afBody">${AF.tab === 'escanear' ? scanHTML() : AF.tab === 'foto' ? photoHTML() : AF.tab === 'crear' ? createFoodHTML() : searchHTML()}</div>`;
    if (AF.tab === 'buscar') { renderFoodResults(); const i = $('#afQ'); if (i && !matchMedia('(pointer:coarse)').matches) i.focus(); }
    if (AF.tab === 'escanear') startScanner();
  }
  function recentFoods() {
    const seen = new Map();
    const keys = Object.keys(S.meals).sort().reverse().slice(0, 30);
    for (const k of keys) for (const e of [...S.meals[k]].reverse()) if (!seen.has(e.name)) seen.set(e.name, { id: 'r-' + slug(e.name), name: e.name, n: e.n, portion: { g: e.g, label: 'última vez' }, recent: true });
    return [...seen.values()].slice(0, 12);
  }
  function searchHTML() {
    return `<input id="afQ" data-in="afQ" placeholder="Busca: pollo, arroz, yogur…" value="${esc(AF.q)}" autocomplete="off">
      <div id="afRes" class="mt"></div>`;
  }
  function renderFoodResults() {
    const box = $('#afRes');
    if (!box) return;
    const q = norm(AF.q.trim());
    let local;
    if (!q) local = recentFoods();
    else {
      const all = [...S.foods, ...DBFOODS];
      const first = q.split(/\s+/)[0];
      local = all.filter(f => matches(f.name + ' ' + (f.brand || ''), q))
        .sort((a, b) => norm(a.name).indexOf(first) - norm(b.name).indexOf(first)).slice(0, 40);
    }
    const head = !q ? (local.length ? '<div class="li-sub mb">Recientes</div>' : '<div class="li-sub mb">Escribe para buscar entre más de 100 alimentos, o busca productos de marca online.</div>') : '';
    const item = f => `<div class="list-item"><div class="grow" data-act="afPick" data-id="${esc(f.id)}"><div class="li-title">${esc(f.name)}</div><div class="li-sub">${f.brand ? esc(f.brand) + ' · ' : ''}${r0(f.n.kcal)} kcal · P ${r1(f.n.p)} · C ${r1(f.n.c)} · G ${r1(f.n.f)} /100 g</div></div><span class="dim">›</span></div>`;
    let online = '';
    if (q) {
      if (AF.loading) online = '<div class="mt"><div class="spinner"></div></div>';
      else if (AF.online && AF.onlineQ === AF.q.trim()) online = AF.online.length ? `<div class="li-sub mt mb">Open Food Facts</div>${AF.online.map(item).join('')}` : '<div class="muted mt center">Sin resultados online.</div>';
      else online = `<button class="btn block mt" data-act="afOnline">🌐 Buscar “${esc(AF.q.trim())}” en Open Food Facts</button>`;
    }
    box.innerHTML = `${head}${local.map(item).join('')}${q && !local.length ? '<div class="muted center">No está en la base local.</div>' : ''}${online}`;
  }
  const offToFood = p => {
    const n = p.nutriments || {};
    const kcal = num(n['energy-kcal_100g']) || (num(n['energy_100g']) / 4.184);
    return {
      id: 'off-' + (p.code || uid()), name: (p.product_name_es || p.product_name || 'Producto sin nombre').trim(), brand: (p.brands || '').split(',')[0].trim(),
      n: { kcal: r1(kcal), p: r1(num(n.proteins_100g)), c: r1(num(n.carbohydrates_100g)), f: r1(num(n.fat_100g)), fib: r1(num(n.fiber_100g)), sug: r1(num(n.sugars_100g)), sat: r1(num(n['saturated-fat_100g'])), sod: r0(num(n.sodium_100g) * 1000) },
      portion: { g: num(p.serving_quantity) || 100, label: p.serving_size || '1 ración' }
    };
  };
  async function searchOnline() {
    const q = AF.q.trim();
    if (!q) return;
    AF.loading = true; renderFoodResults();
    try {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=code,product_name,product_name_es,brands,nutriments,serving_quantity,serving_size`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      if (!AF) return;
      AF.online = (j.products || []).filter(p => p.product_name || p.product_name_es).map(offToFood).filter(f => f.n.kcal > 0 || f.n.p > 0);
      AF.onlineQ = q;
    } catch (e) {
      if (AF) { AF.online = null; toast('No se pudo buscar online', 'Comprueba tu conexión a internet.'); }
    }
    if (AF) { AF.loading = false; renderFoodResults(); }
  }
  function findFood(id) {
    return [...S.foods, ...DBFOODS, ...recentFoods(), ...(AF?.online || [])].find(f => f.id === id);
  }
  function portionHTML() {
    const f = AF.food;
    const pg = f.portion?.g || 100;
    const quick = [...new Set([pg, 50, 100, 150, 200].map(r0))].filter(x => x > 0);
    return `${mHead(esc(f.name))}
      ${f.brand ? `<div class="li-sub">${esc(f.brand)}</div>` : ''}
      <label for="fpG">Cantidad (gramos o ml)</label>
      <input id="fpG" type="number" inputmode="decimal" step="any" min="0" value="${r0(pg)}" data-in="fpG">
      <div class="chips mt">${quick.map(x => `<button class="chip" data-act="fpQuick" data-g="${x}">${x === r0(pg) && f.portion?.label ? esc(f.portion.label) + ' · ' : ''}${x} g</button>`).join('')}</div>
      <label for="fpMeal">Comida</label>
      <select id="fpMeal">${MEALS.map(([id, l]) => `<option value="${id}" ${id === AF.meal ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <div class="prev" id="fpPrev"></div>
      <div class="sec-title">Información por 100 g</div>
      <table class="nut-table"><tbody>
        <tr><td>Energía</td><td>${r0(f.n.kcal)} kcal</td></tr><tr><td>Proteínas</td><td>${r1(f.n.p)} g</td></tr>
        <tr><td>Hidratos de carbono</td><td>${r1(f.n.c)} g</td></tr><tr><td>· de los cuales azúcares</td><td>${r1(f.n.sug)} g</td></tr>
        <tr><td>Grasas</td><td>${r1(f.n.f)} g</td></tr><tr><td>· de las cuales saturadas</td><td>${r1(f.n.sat)} g</td></tr>
        <tr><td>Fibra</td><td>${r1(f.n.fib)} g</td></tr><tr><td>Sodio</td><td>${r0(f.n.sod)} mg</td></tr>
      </tbody></table>
      ${String(f.id).startsWith('off-') ? `<button class="btn sm mt" data-act="afSaveCustom">⭐ Guardar en mis alimentos</button>` : ''}
      <div class="m-foot"><button class="btn" data-act="afBack">Volver</button><button class="btn primary" data-act="afAdd">Añadir</button></div>`;
  }
  function updatePortion() {
    const el = $('#fpPrev');
    if (!el || !AF?.food) return;
    const n = scaleN(AF.food.n, num($('#fpG').value));
    el.innerHTML = `<div><b>${r0(n.kcal)}</b><span>kcal</span></div><div><b style="color:var(--p)">${r1(n.p)}</b><span>prot. g</span></div><div><b style="color:var(--c)">${r1(n.c)}</b><span>carbs g</span></div><div><b style="color:var(--f)">${r1(n.f)}</b><span>grasa g</span></div>`;
  }
  function addEntry(date, meal, food, g) {
    if (!(g > 0)) { toast('Indica una cantidad válida'); return false; }
    (S.meals[date] = S.meals[date] || []).push({ id: uid(), meal, name: food.brand ? `${food.name} (${food.brand})` : food.name, g, n: { ...zeroN(), ...food.n } });
    return true;
  }
  function createFoodHTML(code = '') {
    const f = (id, l, ph = '') => `<div><label for="${id}">${l}</label><input id="${id}" type="number" inputmode="decimal" step="any" min="0" placeholder="${ph}"></div>`;
    return `<p class="li-sub">Copia los valores de la etiqueta nutricional (por 100 g). Quedará guardado en “Mis alimentos”.</p>
      <label for="cfName">Nombre</label><input id="cfName" maxlength="80" placeholder="Ej. Tortitas de maíz Hacendado">
      <input id="cfCode" type="hidden" value="${esc(code)}">
      <div class="grid2">${f('cfKcal', 'Calorías (kcal)', '0')}${f('cfP', 'Proteínas (g)', '0')}${f('cfC', 'Carbohidratos (g)', '0')}${f('cfF', 'Grasas (g)', '0')}${f('cfSug', 'Azúcares (g)', '0')}${f('cfSat', 'Saturadas (g)', '0')}${f('cfFib', 'Fibra (g)', '0')}${f('cfSod', 'Sodio (mg)', '0')}${f('cfPortion', 'Ración habitual (g)', '100')}</div>
      <div class="m-foot"><button class="btn primary" data-act="afCreate">Guardar y añadir</button></div>`;
  }

  // --- cámara: código de barras ---
  let camStream = null, scanTimer = null, zxReader = null;
  function stopCamera() {
    if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
    if (zxReader) { try { zxReader.reset(); } catch (e) { /* ignorar */ } zxReader = null; }
    if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  }
  const camSupported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && window.isSecureContext;
  function scanHTML() {
    return `${camSupported() ? '<div class="cam"><video id="scanVideo" playsinline muted autoplay></video><div class="scanline"></div></div><p class="li-sub center" id="scanMsg">Apunta al código de barras del envase…</p>' : '<div class="banner warn">La cámara solo funciona si abres la app desde una dirección https (o instalada). Puedes escribir el código a mano.</div>'}
      <label for="scanCode">O escribe el código</label>
      <div class="row"><input id="scanCode" inputmode="numeric" placeholder="8410000000000" class="grow"><button class="btn primary" data-act="scanLookup">Buscar</button></div>`;
  }
  async function startScanner() {
    stopCamera();
    if (!camSupported()) return;
    const video = $('#scanVideo');
    if (!video) return;
    const onCode = code => { if (!AF || AF.tab !== 'escanear') return; stopCamera(); vibrate(80); lookupBarcode(code); };
    let native = false;
    if ('BarcodeDetector' in window) {
      try { const f = await window.BarcodeDetector.getSupportedFormats(); native = f.includes('ean_13'); } catch (e) { native = false; }
    }
    try {
      if (native) {
        camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (!AF || AF.tab !== 'escanear' || !$('#scanVideo')) { stopCamera(); return; }
        video.srcObject = camStream; await video.play().catch(() => {});
        const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
        let busy = false;
        scanTimer = setInterval(async () => {
          if (busy || video.readyState < 2) return;
          busy = true;
          try { const r = await det.detect(video); if (r && r[0]) onCode(r[0].rawValue); } catch (e) { /* frame no válido */ }
          busy = false;
        }, 300);
      } else {
        const msg = $('#scanMsg'); if (msg) msg.textContent = 'Cargando lector…';
        await loadScript('js/vendor/zxing.min.js');
        if (!AF || AF.tab !== 'escanear' || !$('#scanVideo')) return;
        if (!window.ZXing) throw new Error('lector no disponible');
        zxReader = new window.ZXing.BrowserMultiFormatReader();
        if (msg) msg.textContent = 'Apunta al código de barras del envase…';
        await zxReader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, video, (result) => { if (result) onCode(result.getText()); });
      }
    } catch (e) {
      const msg = $('#scanMsg');
      if (msg) msg.textContent = e && e.name === 'NotAllowedError' ? 'Permiso de cámara denegado. Actívalo en el navegador o escribe el código.' : 'No se pudo abrir la cámara. Escribe el código a mano.';
    }
  }
  const scripts = {};
  function loadScript(src) {
    if (!scripts[src]) scripts[src] = new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = ok; s.onerror = () => { delete scripts[src]; ko(new Error('No se pudo cargar ' + src)); }; document.head.appendChild(s); });
    return scripts[src];
  }
  async function lookupBarcode(code) {
    code = String(code || '').replace(/\D/g, '');
    if (code.length < 6) return toast('Código no válido');
    const local = S.foods.find(f => f.code === code);
    if (local) { AF.food = local; renderAF(); return; }
    const msg = $('#scanMsg'); if (msg) msg.textContent = `Buscando ${code}…`;
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=code,product_name,product_name_es,brands,nutriments,serving_quantity,serving_size`);
      const j = await res.json();
      if (!AF) return;
      if (j.status === 1 && j.product) { j.product.code = j.product.code || code; AF.online = [offToFood(j.product)]; AF.food = AF.online[0]; renderAF(); return; }
      toast('Producto no encontrado', 'Créalo con los datos de la etiqueta.');
      AF.tab = 'crear'; renderAF();
      const c = $('#cfCode'); if (c) c.value = code;
    } catch (e) {
      toast('Sin conexión', 'No se pudo consultar el código. Inténtalo de nuevo o créalo a mano.');
      if (AF && AF.tab === 'escanear') startScanner();
    }
  }

  // --- cámara: foto del plato ---
  function photoHTML() {
    const hasKey = !!S.settings.apiKey;
    if (AF.photo) {
      let ai = '';
      if (AF.ai === 'loading') ai = '<div class="card flat center mt"><div class="spinner"></div><p class="li-sub">Analizando el plato…</p></div>';
      else if (Array.isArray(AF.ai)) ai = `<div class="sec-title">Alimentos detectados</div><p class="li-sub">Revisa y ajusta los gramos antes de añadir.</p>
        ${AF.ai.map((it, i) => `<div class="ai-item"><input type="checkbox" data-act="aiTgl" data-i="${i}" ${it.on ? 'checked' : ''}><div><div class="li-title">${esc(it.name)}</div><div class="li-sub">${r0((it.n.kcal * it.g) / 100)} kcal · P ${r1((it.n.p * it.g) / 100)} · C ${r1((it.n.c * it.g) / 100)} · G ${r1((it.n.f * it.g) / 100)}</div></div><input type="number" inputmode="numeric" value="${r0(it.g)}" data-in="aiG" data-i="${i}" aria-label="Gramos"></div>`).join('')}
        ${AF.aiNote ? `<p class="li-sub mt">💡 ${esc(AF.aiNote)}</p>` : ''}
        <button class="btn primary block mt" data-act="aiAdd">Añadir seleccionados</button>`;
      else if (AF.aiErr) ai = `<div class="banner warn mt">${esc(AF.aiErr)}</div>`;
      return `<div class="cam"><img src="${AF.photo}" alt="Foto del plato"></div>
        <div class="row mt"><button class="btn grow" data-act="photoRetake">↺ Otra foto</button><button class="btn grow" data-act="photoSave">💾 Guardar foto</button></div>
        ${hasKey ? (AF.ai === 'loading' ? '' : `<button class="btn primary block mt" data-act="photoAnalyze">✨ Analizar con IA</button>`) : `<div class="banner mt"><span>✨</span><div class="grow li-sub">Para estimar alimentos y macros automáticamente desde la foto, añade tu clave de API de Claude en Ajustes. Mientras, guarda la foto y añade los alimentos con el buscador.</div></div>`}
        ${ai}`;
    }
    return `${camSupported() ? `<div class="cam" id="photoCam"><video id="photoVideo" playsinline muted autoplay></video></div>
        <div class="row mt"><button class="btn primary grow" data-act="photoOpenCam" id="photoCamBtn">📷 Abrir cámara</button><button class="btn grow" data-act="photoUpload">🖼️ Galería</button></div>` :
        `<button class="btn primary block" data-act="photoUpload">📷 Hacer foto / elegir imagen</button>`}
      <input type="file" accept="image/*" capture="environment" id="photoFile" class="hidden">
      <p class="li-sub center mt">Haz una foto a tu plato para guardarla en tu diario${S.settings.apiKey ? ' y analizar sus macros con IA' : ''}. Para productos envasados usa “Código”.</p>`;
  }
  async function openPhotoCam() {
    const btn = $('#photoCamBtn');
    const v = $('#photoVideo');
    if (camStream && v) { // capturar
      const img = await captureVideo(v);
      stopCamera();
      if (img) { AF.photo = img; AF.ai = null; AF.aiErr = ''; renderAF(); }
      return;
    }
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      if (!$('#photoVideo')) { stopCamera(); return; }
      v.srcObject = camStream; await v.play().catch(() => {});
      if (btn) btn.textContent = '⚪ Capturar';
    } catch (e) {
      toast('No se pudo abrir la cámara', e && e.name === 'NotAllowedError' ? 'Permiso denegado. Usa “Galería” o activa el permiso.' : 'Usa “Galería” para elegir una foto.');
    }
  }
  function captureVideo(v) {
    const w = v.videoWidth, h = v.videoHeight;
    if (!w || !h) return Promise.resolve(null);
    return Promise.resolve(drawScaled(v, w, h, 1024, 0.82));
  }
  function drawScaled(src, w, h, max, q) {
    const s = Math.min(1, max / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * s); c.height = Math.round(h * s);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', q);
  }
  function fileToImage(file) {
    return new Promise((ok, ko) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => { const d = drawScaled(im, im.naturalWidth, im.naturalHeight, 1024, 0.82); URL.revokeObjectURL(url); ok(d); };
      im.onerror = () => { URL.revokeObjectURL(url); ko(new Error('Imagen no válida')); };
      im.src = url;
    });
  }
  function thumbOf(dataUrl) {
    return new Promise(ok => { const im = new Image(); im.onload = () => ok(drawScaled(im, im.naturalWidth, im.naturalHeight, 320, 0.7)); im.onerror = () => ok(null); im.src = dataUrl; });
  }
  async function savePhoto() {
    const th = await thumbOf(AF.photo);
    if (!th) return toast('No se pudo guardar la foto');
    (S.photos[AF.date] = S.photos[AF.date] || []).push({ id: uid(), meal: AF.meal, img: th, ts: Date.now() });
    if (save()) toast('Foto guardada en ' + mealName(AF.meal) + ' 📸');
    AF.photoSaved = true;
  }
  async function analyzePhoto() {
    AF.ai = 'loading'; AF.aiErr = ''; renderAF();
    const prompt = `Eres un nutricionista. Analiza la foto de esta comida. Identifica cada alimento visible, estima su peso en gramos según el tamaño de la ración y da sus valores nutricionales por 100 g (usa tablas estándar como BEDCA/USDA). Responde SOLO con JSON válido, sin texto adicional, con este formato:
{"items":[{"name":"nombre en español","grams":0,"kcal_100g":0,"protein_100g":0,"carbs_100g":0,"fat_100g":0,"fiber_100g":0,"sugar_100g":0,"satfat_100g":0,"sodium_mg_100g":0}],"note":"comentario breve sobre el plato (1 frase)"}
Si no es comida, devuelve {"items":[],"note":"No se detecta comida"}.`;
    try {
      const b64 = AF.photo.split(',')[1];
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': S.settings.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: S.settings.aiModel || 'claude-sonnet-5-5', max_tokens: 2000, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }, { type: 'text', text: prompt }] }] })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message || `Error ${res.status}`);
      const txt = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
      const m = txt.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('Respuesta no válida de la IA');
      const data = JSON.parse(m[0]);
      if (!AF) return;
      AF.ai = (data.items || []).map(it => ({
        on: true, name: String(it.name || 'Alimento'), g: num(it.grams) || 100,
        n: { kcal: num(it.kcal_100g), p: num(it.protein_100g), c: num(it.carbs_100g), f: num(it.fat_100g), fib: num(it.fiber_100g), sug: num(it.sugar_100g), sat: num(it.satfat_100g), sod: num(it.sodium_mg_100g) }
      }));
      AF.aiNote = data.note || '';
      if (!AF.ai.length) { AF.ai = null; AF.aiErr = data.note || 'No se detectaron alimentos.'; }
    } catch (e) {
      if (!AF) return;
      AF.ai = null; AF.aiErr = 'No se pudo analizar: ' + (e.message || e);
    }
    renderAF();
  }

  function editEntry(id) {
    const k = UI.foodDate;
    const e = (S.meals[k] || []).find(x => x.id === id);
    if (!e) return;
    openModal(`${mHead(esc(e.name))}
      <label for="eeG">Cantidad (g)</label><input id="eeG" type="number" inputmode="decimal" step="any" value="${r0(e.g)}" data-in="eeG" data-id="${id}">
      <label for="eeMeal">Comida</label><select id="eeMeal">${MEALS.map(([m, l]) => `<option value="${m}" ${m === e.meal ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <div class="prev" id="eePrev"></div>
      <div class="m-foot"><button class="btn danger" data-act="delEntry" data-id="${id}">Eliminar</button><button class="btn primary" data-act="saveEntry" data-id="${id}">Guardar</button></div>`);
    updateEntryPrev(e);
  }
  function updateEntryPrev(e) {
    const n = scaleN(e.n, num($('#eeG').value));
    $('#eePrev').innerHTML = `<div><b>${r0(n.kcal)}</b><span>kcal</span></div><div><b style="color:var(--p)">${r1(n.p)}</b><span>prot. g</span></div><div><b style="color:var(--c)">${r1(n.c)}</b><span>carbs g</span></div><div><b style="color:var(--f)">${r1(n.f)}</b><span>grasa g</span></div>`;
  }

  // =====================================================================
  // VISTA: ESTUDIO
  // =====================================================================
  const timerDur = mode => (mode === 'focus' ? S.timer.focus : mode === 'long' ? S.timer.long : S.timer.brk) * 60000;
  const timerLeft = () => S.timer.running ? S.timer.endAt - Date.now() : S.timer.left;
  function viewEstudio() {
    const T = S.timer;
    const k = dkey(), wk = weekStart();
    const today = S.studyLog.filter(l => l.date === k).reduce((a, l) => a + l.min, 0);
    const week = S.studyLog.filter(l => l.date >= wk);
    const weekMin = week.reduce((a, l) => a + l.min, 0);
    const planned = S.blocks.filter(b => b.cat === 'estudio').reduce((a, b) => a + durMin(b) * b.days.length, 0);
    const goalMin = S.subjects.reduce((a, s) => a + num(s.goalH) * 60, 0) || planned;
    const days = [...Array(7)].map((_, i) => addDays(wk, i));
    const modeLabel = T.mode === 'focus' ? 'Concentración' : T.mode === 'long' ? 'Descanso largo' : 'Descanso';
    const left = timerLeft();
    const dur = timerDur(T.mode);
    return `
      <div class="card pomo">
        <div class="pomo-mode">${modeLabel} · ciclo ${(T.count % 4) + 1}/4</div>
        <div class="row mt" style="justify-content:center">${ring(1 - left / dur, T.mode === 'focus' ? 'var(--accent)' : 'var(--ok)', 230, 12, `<div><div class="pomo-time" data-tick="pomo">${fmtClock(left)}</div></div>`)}</div>
        <select class="mt" data-in="pomoSub" aria-label="Asignatura">${S.subjects.length ? '' : '<option value="">Sin asignaturas</option>'}${S.subjects.map(s => `<option value="${s.id}" ${s.id === T.subjectId ? 'selected' : ''}>📘 ${esc(s.name)}</option>`).join('')}</select>
        <div class="row mt">
          <button class="btn grow" data-act="pomoReset">↺ Reiniciar</button>
          <button class="btn primary grow" data-act="pomoToggle">${T.running ? '❚❚ Pausar' : '▶ Empezar'}</button>
          <button class="btn grow" data-act="pomoSkip">⏭ Saltar</button>
        </div>
        <div class="row mt" style="justify-content:center;gap:6px">${[[25, 5, 15], [50, 10, 20], [90, 15, 30]].map(([f, b, l]) => `<button class="chip ${T.focus === f ? 'on' : ''}" data-act="pomoPreset" data-f="${f}" data-b="${b}" data-l="${l}">${f}/${b}</button>`).join('')}</div>
      </div>

      <div class="grid3">
        <div class="stat"><b>${fmtH(today).replace(' min', 'm').replace(' h', 'h')}</b><span>Hoy</span></div>
        <div class="stat"><b>${fmtH(weekMin).replace(' min', 'm').replace(' h', 'h')}</b><span>Semana</span></div>
        <div class="stat"><b>${goalMin ? r0((weekMin / goalMin) * 100) : 0}%</b><span>de ${fmtH(goalMin).replace(' min', 'm').replace(' h', 'h')}</span></div>
      </div>

      <div class="card mt"><h3>Esta semana (minutos)</h3><div class="mt">${bars(days.map(d => S.studyLog.filter(l => l.date === d).reduce((a, l) => a + l.min, 0)), DAYS_S, { highlight: dow(), unit: ' min' })}</div>
        <small>Planificado en tu horario: ${fmtH(planned)} / semana.</small></div>

      <div class="row between" style="margin:22px 4px 10px"><div class="sec-title" style="margin:0">Asignaturas</div><button class="link" data-act="subjectForm">+ Nueva</button></div>
      <div class="card">${S.subjects.length ? S.subjects.map(s => {
        const m = week.filter(l => l.subjectId === s.id).reduce((a, l) => a + l.min, 0);
        const g = num(s.goalH) * 60;
        return `<div class="macro" data-act="subjectForm" data-id="${s.id}" style="cursor:pointer"><div class="row between"><span><i class="dot" style="background:${esc(s.color)}"></i> ${esc(s.name)}</span><span><b>${fmtH(m)}</b><span class="muted">${g ? ' / ' + fmtH(g) : ''}</span></span></div>
          <div class="bar"><i style="width:${g ? clamp((m / g) * 100, 0, 100) : 0}%;background:${esc(s.color)}"></i></div></div>`;
      }).join('') : '<div class="muted">Añade tus asignaturas para seguir tus horas.</div>'}</div>

      <div class="row between" style="margin:22px 4px 10px"><div class="sec-title" style="margin:0">Sesiones recientes</div><button class="link" data-act="studyManual">+ Registrar</button></div>
      <div class="card">${S.studyLog.length ? [...S.studyLog].sort((a, b) => b.ts - a.ts).slice(0, 10).map(l => {
        const s = S.subjects.find(x => x.id === l.subjectId);
        return `<div class="list-item"><i class="dot" style="background:${esc(s?.color || 'var(--dim)')}"></i><div class="grow"><div class="li-title">${esc(s?.name || 'General')}</div><div class="li-sub">${fmtDate(l.date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmtH(l.min)}</div></div><button class="x" data-act="delStudy" data-id="${l.id}" aria-label="Borrar">×</button></div>`;
      }).join('') : '<div class="muted">Usa el temporizador para registrar tu estudio automáticamente.</div>'}</div>`;
  }
  function logStudy(min, subjectId, date = dkey()) {
    if (!(min > 0)) return;
    S.studyLog.push({ id: uid(), date, subjectId: subjectId || '', min: r0(min), ts: Date.now() });
  }
  function pomoComplete() {
    const T = S.timer;
    T.running = false;
    if (T.mode === 'focus') {
      logStudy(T.focus, T.subjectId);
      T.count++;
      T.mode = T.count % 4 === 0 ? 'long' : 'break';
      const s = S.subjects.find(x => x.id === T.subjectId);
      notify('¡Bloque de estudio completado! 🎉', `${T.focus} min${s ? ' de ' + s.name : ''}. Toca descansar ${T.mode === 'long' ? T.long : T.brk} min.`, 'pomo');
    } else {
      T.mode = 'focus';
      notify('Descanso terminado', 'Vuelve a concentrarte 💪', 'pomo');
    }
    T.left = timerDur(T.mode);
    save(); render();
  }
  function subjectForm(id) {
    const s = S.subjects.find(x => x.id === id) || { id: '', name: '', color: '#8b6cff', goalH: 3 };
    const colors = ['#8b6cff', '#5ec8ff', '#2fd18b', '#ffb547', '#ff5c7a', '#f472b6', '#a3e635', '#94a3b8'];
    openModal(`${mHead(s.id ? 'Editar asignatura' : 'Nueva asignatura')}
      <label for="sbName">Nombre</label><input id="sbName" maxlength="40" value="${esc(s.name)}" placeholder="Ej. Física">
      <label for="sbGoal">Objetivo semanal (horas)</label><input id="sbGoal" type="number" inputmode="decimal" step="0.5" min="0" value="${esc(s.goalH)}">
      <label>Color</label><div class="row wrap" id="sbColors" data-c="${esc(s.color)}">${colors.map(c => `<button data-act="sbColor" data-c="${c}" style="width:32px;height:32px;border-radius:50%;background:${c};border:3px solid ${c === s.color ? 'var(--text)' : 'transparent'}" aria-label="Color"></button>`).join('')}</div>
      <div class="m-foot">${s.id ? `<button class="btn danger" data-act="delSubject" data-id="${s.id}">Eliminar</button>` : '<button class="btn" data-act="closeModal">Cancelar</button>'}<button class="btn primary" data-act="saveSubject" data-id="${s.id}">Guardar</button></div>`);
  }

  // =====================================================================
  // VISTA: AJUSTES
  // =====================================================================
  function viewAjustes() {
    const st = S.settings;
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    const permTxt = { granted: '✅ Permitidas', denied: '⛔ Bloqueadas en el navegador', default: 'Sin permiso todavía', unsupported: 'No soportadas en este navegador' }[perm];
    const sw = (k, on) => `<label class="switch"><input type="checkbox" data-act="setToggle" data-k="${k}" ${on ? 'checked' : ''}><span></span></label>`;
    let used = 0;
    try { used = (localStorage.getItem(KEY) || '').length; } catch (e) { used = 0; }
    return `
      <div class="card">
        <label for="stName" style="margin-top:0">Tu nombre</label><input id="stName" data-in="stName" maxlength="30" value="${esc(st.name)}" placeholder="¿Cómo te llamas?">
        <label for="stTheme">Tema</label><select id="stTheme" data-in="stTheme"><option value="auto" ${st.theme === 'auto' ? 'selected' : ''}>Automático</option><option value="dark" ${st.theme === 'dark' ? 'selected' : ''}>Oscuro</option><option value="light" ${st.theme === 'light' ? 'selected' : ''}>Claro</option></select>
      </div>
      <div class="sec-title">Avisos</div>
      <div class="card">
        <div class="set-line"><div><b>Recordatorios</b><div class="li-sub">${permTxt}</div></div>${sw('notify', st.notify)}</div>
        ${perm === 'default' ? '<button class="btn primary block mb" data-act="askNotif">Permitir notificaciones</button>' : ''}
        <div class="set-line"><div><b>Sonido y vibración</b><div class="li-sub">Al recibir un aviso con la app abierta</div></div>${sw('sound', st.sound)}</div>
        <div class="set-line"><div class="grow"><b>Recordatorio de agua</b><div class="li-sub">Entre las 9:00 y las 22:00</div></div>
          <select style="width:auto" data-in="stWater">${[[0, 'No'], [1, 'Cada hora'], [2, 'Cada 2 h'], [3, 'Cada 3 h']].map(([v, l]) => `<option value="${v}" ${num(st.waterEvery) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <button class="btn block mt" data-act="testNotif">Probar aviso</button>
        <p class="li-sub mt">💡 Los avisos funcionan mientras la app está abierta o en segundo plano. Para recibirlos con el móvil bloqueado y la app cerrada, exporta el plan a tu calendario desde la pestaña Plan.</p>
      </div>
      <div class="sec-title">Análisis de fotos con IA (opcional)</div>
      <div class="card">
        <p class="li-sub" style="margin-top:0">Con una clave de API de Claude (console.anthropic.com) la app estima alimentos, gramos y macros a partir de la foto de tu plato. La clave se guarda solo en este dispositivo.</p>
        <label for="stKey">Clave de API</label><input id="stKey" type="password" autocomplete="off" data-in="stKey" value="${esc(st.apiKey)}" placeholder="sk-ant-…">
        <label for="stModel">Modelo</label><select id="stModel" data-in="stModel">${[['claude-sonnet-5-5', 'Claude Sonnet 5.5 (recomendado)'], ['claude-opus-5-5', 'Claude Opus 5.5 (más preciso)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (más rápido)']].map(([v, l]) => `<option value="${v}" ${st.aiModel === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </div>
      <div class="sec-title">Datos</div>
      <div class="card">
        <div class="li-sub">Todo se guarda en este dispositivo (${r1(used / 1024)} KB usados).</div>
        <div class="grid2 mt"><button class="btn" data-act="exportJSON">⬇ Exportar copia</button><button class="btn" data-act="importJSON">⬆ Importar copia</button></div>
        <input type="file" accept="application/json,.json" id="importFile" class="hidden">
        <button class="btn block mt" data-act="exportICS">📅 Exportar plan a calendario</button>
        <button class="btn block mt" data-act="clearPhotos">🗑 Borrar fotos de comidas</button>
        <button class="btn danger block mt" data-act="resetAll">Borrar todos los datos</button>
      </div>
      <p class="center dim" style="font-size:12px">Mi Rutina · v1.0</p>`;
  }

  // =====================================================================
  // RENDER
  // =====================================================================
  const VIEWS = { hoy: ['Hoy', viewHoy], plan: ['Planificador', viewPlan], gym: ['Gym', viewGym], comidas: ['Comidas', viewComidas], estudio: ['Estudio', viewEstudio], ajustes: ['Ajustes', viewAjustes] };
  function render() {
    const [title, fn] = VIEWS[UI.view] || VIEWS.hoy;
    $('#topTitle').textContent = UI.view === 'gym' && S.active ? 'Entrenando' : title;
    $('#topDate').textContent = fmtDate(dkey());
    let html;
    try { html = fn(); } catch (e) {
      console.error(e);
      html = `<div class="card empty"><div class="big">😵</div>Algo ha fallado al mostrar esta sección.<div class="li-sub mt">${esc(e.message)}</div></div>`;
    }
    $('#view').innerHTML = html;
    $$('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.v === UI.view));
    renderFloating();
  }
  function renderFloating() {
    const box = $('#floating');
    let h = '';
    if (REST) {
      h += `<div class="float rest"><span style="font-size:20px">⏱️</span><div class="grow"><div style="font-size:12px;opacity:.85">Descanso</div><b style="font-size:20px" data-tick="rest">${fmtClock(REST.endAt - Date.now())}</b></div>
        <button class="btn sm" data-act="restAdd" data-s="-15">−15</button><button class="btn sm" data-act="restAdd" data-s="15">+15</button><button class="btn sm" data-act="restSkip">Saltar</button></div>`;
    }
    if (S.active && UI.view !== 'gym') h += `<div class="float"><span style="font-size:20px">🏋️</span><div class="grow"><div class="li-sub">Entreno en curso</div><b data-tick="elapsed">${fmtClock(Date.now() - S.active.start)}</b></div><button class="btn sm primary" data-act="go" data-v="gym">Ver</button></div>`;
    if (S.timer.running && UI.view !== 'estudio') h += `<div class="float"><span style="font-size:20px">📚</span><div class="grow"><div class="li-sub">${S.timer.mode === 'focus' ? 'Estudiando' : 'Descanso'}</div><b data-tick="pomo">${fmtClock(timerLeft())}</b></div><button class="btn sm primary" data-act="go" data-v="estudio">Ver</button></div>`;
    box.innerHTML = h;
    document.body.style.paddingBottom = h ? `calc(${84 + box.children.length * 70}px + env(safe-area-inset-bottom, 0px))` : '';
  }
  function tick() {
    if (S.active) $$('[data-tick="elapsed"]').forEach(el => { el.textContent = fmtClock(Date.now() - S.active.start); });
    if (REST) {
      const left = REST.endAt - Date.now();
      if (left <= 0) { REST = null; renderFloating(); notify('⏱️ Descanso terminado', '¡A por la siguiente serie!', 'rest'); }
      else $$('[data-tick="rest"]').forEach(el => { el.textContent = fmtClock(left); });
    }
    if (S.timer.running) {
      const left = timerLeft();
      if (left <= 0) pomoComplete();
      else {
        $$('[data-tick="pomo"]').forEach(el => { el.textContent = fmtClock(left); });
        if (UI.view === 'estudio') {
          const c = $('.pomo .ring circle:nth-child(2)');
          if (c) { const len = parseFloat(c.getAttribute('stroke-dasharray')); c.setAttribute('stroke-dashoffset', (len * (left / timerDur(S.timer.mode))).toFixed(2)); }
        }
      }
    }
  }
  function applyTheme() {
    const t = S.settings.theme;
    const light = t === 'light' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches);
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    const m = $('meta[name="theme-color"]'); if (m) m.content = light ? '#f4f5fa' : '#0b0d14';
  }

  // =====================================================================
  // ACCIONES
  // =====================================================================
  const A = {
    go(el) { const v = el.dataset.v; closeModal(); if (UI.view === v) { render(); window.scrollTo(0, 0); } else location.hash = v; },
    closeModal() { closeModal(); },
    askNotif() { askNotif(); },
    testNotif() { notify('Así se verán tus avisos', 'Ej.: En 10 min: Gym — Empuje', 'test'); },

    // hoy / plan
    toggleDone(el) {
      const k = dkey(), id = el.dataset.id;
      const arr = S.done[k] = S.done[k] || [];
      const i = arr.indexOf(id);
      if (i >= 0) arr.splice(i, 1); else arr.push(id);
      save(); render();
    },
    water(el) {
      const k = el.dataset.date || dkey();
      S.water[k] = Math.max(0, (S.water[k] || 0) + parseInt(el.dataset.ml, 10));
      save(); render();
      if (S.water[k] >= S.goals.water && parseInt(el.dataset.ml, 10) > 0 && S.water[k] - parseInt(el.dataset.ml, 10) < S.goals.water) toast('💧 ¡Objetivo de agua cumplido!');
    },
    planDay(el) { UI.planDay = +el.dataset.day; render(); },
    newBlock(el) {
      const day = el.dataset.day != null ? +el.dataset.day : dow();
      const last = blocksFor(day).slice(-1)[0];
      const start = last ? last.end : '09:00';
      const sm = toMin(start) + 60;
      blockForm({ id: uid(), title: '', cat: 'estudio', start, end: `${pad(Math.floor(sm / 60) % 24)}:${pad(sm % 60)}`, days: [day], remind: num(S.settings.remind), notes: '', routineId: '', subjectId: S.subjects[0]?.id || '' }, true);
    },
    editBlock(el) { const b = S.blocks.find(x => x.id === el.dataset.id); if (b) blockForm(b, false); },
    bfCat(el) {
      const box = $('#bfCats'); box.dataset.cat = el.dataset.cat;
      $$('button', box).forEach(b => b.classList.toggle('on', b === el));
      $('#bfGym').classList.toggle('hidden', el.dataset.cat !== 'gym');
      $('#bfStudy').classList.toggle('hidden', el.dataset.cat !== 'estudio');
      const t = $('#bfTitle');
      if (!t.value.trim() || Object.values(CATS).some(c => c.label === t.value.trim())) t.value = CATS[el.dataset.cat].label;
    },
    bfDay(el) { el.classList.toggle('on'); },
    bfDaysPreset(el) {
      const set = { wk: [0, 1, 2, 3, 4], we: [5, 6], all: [0, 1, 2, 3, 4, 5, 6] }[el.dataset.p];
      $$('#bfDays button').forEach(b => b.classList.toggle('on', set.includes(+b.dataset.day)));
    },
    saveBlock(el) { saveBlockFromForm(el.dataset.id, el.dataset.new === '1'); },
    delBlock(el) {
      const b = S.blocks.find(x => x.id === el.dataset.id);
      confirmBox('Eliminar actividad', `¿Eliminar “${b?.title}” de todos sus días?`, 'Eliminar', () => { S.blocks = S.blocks.filter(x => x.id !== el.dataset.id); save(); render(); toast('Actividad eliminada'); });
    },
    copyDay(el) { copyDayModal(+el.dataset.day); },
    doCopyDay(el) {
      const from = +el.dataset.from, to = +el.dataset.to;
      const src = blocksFor(from);
      for (const b of src) S.blocks.push({ ...b, id: uid(), days: [to] });
      save(); closeModal(); UI.planDay = to; render();
      toast(`${src.length} actividades copiadas al ${DAYS[to].toLowerCase()}`);
    },
    exportICS() { exportICS(); },
    addFoodFromBlock(el) { UI.foodDate = dkey(); openAddFood(guessMeal(toMin(el.dataset.start))); },
    studyFromBlock(el) { if (el.dataset.sub) S.timer.subjectId = el.dataset.sub; save(); location.hash = 'estudio'; },

    // gym
    gymTab(el) { S.gymTab = el.dataset.tab; save(); render(); },
    libGroup(el) { UI.libGroup = el.dataset.g; render(); },
    onlyAvail(el) { UI.onlyAvail = el.checked; render(); },
    exDetail(el) { exDetail(el.dataset.id); },
    exToRoutine(el) {
      const r = S.routines.find(x => x.id === $('#exToR').value);
      if (!r) return;
      const cardio = EX[el.dataset.id]?.type === 'cardio';
      r.exercises.push({ exId: el.dataset.id, sets: cardio ? 1 : 3, reps: cardio ? 20 : 10, kg: '', rest: 90 });
      save(); closeModal(); toast(`Añadido a ${r.name} ✅`);
    },
    equip(el) { if (el.checked) delete S.equipment[el.dataset.k]; else S.equipment[el.dataset.k] = false; save(); },
    newExercise() { newExerciseModal(); },
    saveExercise() {
      const name = $('#neName').value.trim();
      if (!name) return toast('Escribe un nombre');
      const id = 'c-' + slug(name) + '-' + uid().slice(-4);
      S.customEx.push({ id, name, group: $('#neGroup').value, equip: $('#neEquip').value, type: $('#neType').value });
      save(); buildEx(); closeModal(); render(); toast('Ejercicio creado ✅');
    },
    delExercise(el) {
      confirmBox('Eliminar ejercicio', 'Se quitará de tus rutinas. El historial se conserva.', 'Eliminar', () => {
        S.customEx = S.customEx.filter(x => x.id !== el.dataset.id);
        for (const r of S.routines) r.exercises = r.exercises.filter(e => e.exId !== el.dataset.id);
        save(); buildEx(); render();
      });
    },
    newRoutine() { routineEditor({ id: uid(), name: '', color: '#8b6cff', exercises: [] }); },
    editRoutine(el) { const r = S.routines.find(x => x.id === el.dataset.id); if (r) routineEditor(r); },
    reColor(el) { RED.color = el.dataset.c; renderRoutineEditor(); },
    reMove(el) {
      const i = +el.dataset.i, j = i + +el.dataset.d;
      if (j < 0 || j >= RED.exercises.length) return;
      [RED.exercises[i], RED.exercises[j]] = [RED.exercises[j], RED.exercises[i]];
      renderRoutineEditor();
    },
    reDel(el) { RED.exercises.splice(+el.dataset.i, 1); renderRoutineEditor(); },
    rePick() {
      openPicker(ids => {
        for (const id of ids) { const cardio = EX[id]?.type === 'cardio'; RED.exercises.push({ exId: id, sets: cardio ? 1 : 3, reps: cardio ? 20 : 10, kg: '', rest: 90 }); }
        renderRoutineEditor();
      }, () => renderRoutineEditor());
    },
    saveRoutine() {
      RED.name = RED.name.trim();
      if (!RED.name) return toast('Ponle un nombre a la rutina');
      if (!RED.exercises.length) return toast('Añade al menos un ejercicio');
      const i = S.routines.findIndex(x => x.id === RED.id);
      if (i >= 0) S.routines[i] = RED; else S.routines.push(RED);
      RED = null; save(); closeModal(); render(); toast('Rutina guardada ✅');
    },
    delRoutine(el) {
      confirmBox('Eliminar rutina', 'El historial de entrenos se conserva.', 'Eliminar', () => {
        S.routines = S.routines.filter(x => x.id !== el.dataset.id);
        for (const b of S.blocks) if (b.routineId === el.dataset.id) b.routineId = '';
        save(); render();
      });
    },
    pkGroup(el) { PICK.g = el.dataset.g; $$('#pkG .chip').forEach(c => c.classList.toggle('on', c === el)); renderPickList(); },
    pkTgl(el) { if (el.checked) PICK.sel.add(el.dataset.id); else PICK.sel.delete(el.dataset.id); $('#pkBtn').textContent = PICK.sel.size ? `Añadir (${PICK.sel.size})` : 'Añadir'; },
    pkDone() { const p = PICK; PICK = null; if (!p.sel.size) return p.back(); p.done([...p.sel]); },
    pkBack() { const p = PICK; PICK = null; p.back(); },
    startWorkout(el) { startWorkout(el.dataset.id); },
    sxDone(el) {
      const e = S.active.exercises[+el.dataset.i], j = +el.dataset.j, s = e.sets[j];
      s.done = !s.done;
      if (s.done) {
        const nx = e.sets[j + 1];
        if (nx && !nx.done) { if (nx.a === '' || nx.a == null) nx.a = s.a; if (nx.b === '' || nx.b == null) nx.b = s.b; }
        if (EX[e.exId]?.type !== 'cardio' && S.active.exercises.some(x => x.sets.some(y => !y.done))) startRest(e.rest || 90);
      }
      save(); render();
    },
    sxSetAdd(el) { const e = S.active.exercises[+el.dataset.i]; const l = e.sets[e.sets.length - 1]; e.sets.push({ a: l ? l.a : '', b: l ? l.b : 10, done: false }); save(); render(); },
    sxSetDel(el) { const e = S.active.exercises[+el.dataset.i]; e.sets.splice(+el.dataset.j, 1); if (!e.sets.length) S.active.exercises.splice(+el.dataset.i, 1); save(); render(); },
    sxMove(el) {
      const x = S.active.exercises, i = +el.dataset.i, j = i + +el.dataset.d;
      if (j < 0 || j >= x.length) return;
      [x[i], x[j]] = [x[j], x[i]]; save(); render();
    },
    sxDel(el) { S.active.exercises.splice(+el.dataset.i, 1); save(); render(); },
    sxPick() {
      openPicker(ids => {
        for (const id of ids) S.active.exercises.push(makeSessionEx(id, null));
        save(); closeModal(); render();
      }, () => closeModal());
    },
    sxCancel() { confirmBox('Descartar entreno', 'Se perderán las series de esta sesión.', 'Descartar', () => { S.active = null; REST = null; save(); render(); }); },
    sxFinish() {
      const a = S.active;
      const done = a.exercises.reduce((s, e) => s + e.sets.filter(x => x.done).length, 0);
      const pending = a.exercises.reduce((s, e) => s + e.sets.filter(x => !x.done).length, 0);
      openModal(`${mHead('Finalizar entreno')}
        <div class="grid2"><div class="stat"><b>${fmtClock(Date.now() - a.start)}</b><span>Duración</span></div><div class="stat"><b>${done}</b><span>Series hechas</span></div></div>
        ${pending ? `<p class="li-sub mt">Hay ${pending} series sin marcar; no se guardarán.</p>` : ''}
        ${a.routineId ? '<label class="row mt" style="cursor:pointer"><input type="checkbox" id="fwUpd" checked style="width:20px;height:20px;accent-color:var(--accent)"> Actualizar los kg de la rutina con lo de hoy</label>' : ''}
        <div class="m-foot"><button class="btn" data-act="closeModal">Seguir</button><button class="btn primary" data-act="sxFinishOk">Guardar entreno</button></div>`);
    },
    sxFinishOk() { finishWorkout(!!$('#fwUpd')?.checked); },
    restAdd(el) { if (REST) { REST.endAt += +el.dataset.s * 1000; if (REST.endAt <= Date.now()) REST = null; renderFloating(); } },
    restSkip() { REST = null; renderFloating(); },
    workoutDetail(el) { workoutDetail(el.dataset.id); },
    delWorkout(el) { confirmBox('Eliminar entreno', 'Esta acción no se puede deshacer.', 'Eliminar', () => { S.workouts = S.workouts.filter(w => w.id !== el.dataset.id); save(); render(); }); },

    // comidas
    foodDay(el) { const n = addDays(UI.foodDate, +el.dataset.d); if (n <= dkey()) { UI.foodDate = n; render(); } },
    addFood(el) { openAddFood(el.dataset.meal, el.dataset.tab || 'buscar'); },
    afMeal(el) { AF.meal = el.dataset.m; renderAF(); },
    afTab(el) { stopCamera(); AF.tab = el.dataset.tab; renderAF(); },
    afOnline() { searchOnline(); },
    afPick(el) { const f = findFood(el.dataset.id); if (f) { stopCamera(); AF.food = f; renderAF(); } },
    afBack() { AF.food = null; if (AF.tab === 'escanear') AF.tab = 'buscar'; renderAF(); },
    fpQuick(el) { $('#fpG').value = el.dataset.g; updatePortion(); },
    afAdd() {
      const g = num($('#fpG').value), meal = $('#fpMeal').value;
      if (addEntry(AF.date, meal, AF.food, g)) { const n = AF.food.name; save(); closeModal(); render(); toast(`Añadido a ${mealName(meal)} ✅`, `${n} · ${r0(g)} g`); }
    },
    afSaveCustom() {
      const f = AF.food;
      if (S.foods.some(x => x.id === f.id)) return toast('Ya está en tus alimentos');
      S.foods.unshift({ ...f, code: String(f.id).replace('off-', '') }); save(); toast('Guardado en tus alimentos ⭐');
    },
    afCreate() {
      const name = $('#cfName').value.trim();
      if (!name) return toast('Escribe el nombre del alimento');
      const v = id => num($('#' + id).value);
      const f = { id: 'u-' + uid(), name, code: $('#cfCode').value || '', n: { kcal: v('cfKcal'), p: v('cfP'), c: v('cfC'), f: v('cfF'), fib: v('cfFib'), sug: v('cfSug'), sat: v('cfSat'), sod: v('cfSod') }, portion: { g: v('cfPortion') || 100, label: 'ración' } };
      if (!f.n.kcal) f.n.kcal = r0(f.n.p * 4 + f.n.c * 4 + f.n.f * 9);
      S.foods.unshift(f); save();
      AF.food = f; renderAF();
    },
    scanLookup() { const c = $('#scanCode').value; stopCamera(); lookupBarcode(c); },
    photoOpenCam() { openPhotoCam(); },
    photoUpload() {
      const inp = $('#photoFile');
      inp.onchange = async () => {
        const f = inp.files && inp.files[0];
        if (!f) return;
        try { stopCamera(); AF.photo = await fileToImage(f); AF.ai = null; AF.aiErr = ''; renderAF(); } catch (e) { toast('No se pudo leer la imagen'); }
      };
      inp.click();
    },
    photoRetake() { AF.photo = null; AF.ai = null; AF.aiErr = ''; AF.photoSaved = false; renderAF(); },
    photoSave() { if (AF.photoSaved) return toast('La foto ya está guardada'); savePhoto().then(() => { closeModal(); render(); }); },
    photoAnalyze() { analyzePhoto(); },
    aiTgl(el) { AF.ai[+el.dataset.i].on = el.checked; },
    async aiAdd() {
      const items = AF.ai.filter(x => x.on && x.g > 0);
      if (!items.length) return toast('Selecciona al menos un alimento');
      const meal = AF.meal;
      for (const it of items) addEntry(AF.date, meal, { name: it.name, n: it.n }, it.g);
      if (!AF.photoSaved) await savePhoto();
      save(); closeModal(); render();
      toast(`${items.length} alimentos añadidos a ${mealName(meal)} ✅`);
    },
    editEntry(el) { editEntry(el.dataset.id); },
    saveEntry(el) {
      const e = (S.meals[UI.foodDate] || []).find(x => x.id === el.dataset.id);
      const g = num($('#eeG').value);
      if (!e || !(g > 0)) return toast('Cantidad no válida');
      e.g = g; e.meal = $('#eeMeal').value; save(); closeModal(); render();
    },
    delEntry(el) { S.meals[UI.foodDate] = (S.meals[UI.foodDate] || []).filter(x => x.id !== el.dataset.id); save(); closeModal(); render(); },
    viewPhoto(el) {
      const k = UI.foodDate, p = (S.photos[k] || []).find(x => x.id === el.dataset.id);
      if (!p) return;
      openModal(`${mHead(esc(mealName(p.meal)))}<img src="${p.img}" alt="Foto" style="width:100%;border-radius:14px"><small>${new Date(p.ts).toLocaleString('es-ES')}</small>
        <div class="m-foot"><button class="btn danger" data-act="delPhoto" data-id="${p.id}">Eliminar foto</button><button class="btn" data-act="closeModal">Cerrar</button></div>`);
    },
    delPhoto(el) { S.photos[UI.foodDate] = (S.photos[UI.foodDate] || []).filter(x => x.id !== el.dataset.id); save(); closeModal(); render(); },
    copyMeals(el) {
      const k = el.dataset.date, prev = S.meals[addDays(k, -1)] || [];
      if (!prev.length) return toast('El día anterior no tiene comidas registradas');
      S.meals[k] = [...(S.meals[k] || []), ...prev.map(e => ({ ...e, id: uid() }))];
      save(); render(); toast(`${prev.length} alimentos copiados ✅`);
    },
    goalsModal() { goalsModal(); },
    calcGoals() { calcGoals(); },
    saveGoals() {
      const v = id => r0(num($('#' + id).value));
      const g = { kcal: v('gKcal'), p: v('gP'), c: v('gC'), f: v('gF'), fib: v('gFib'), water: v('gWater') };
      if (!(g.kcal > 0)) return toast('Las calorías deben ser mayores que 0');
      S.goals = g;
      const w = num($('#gW').value); if (w > 0) S.profile.weight = w;
      save(); closeModal(); render(); toast('Objetivos guardados ✅');
    },

    // estudio
    pomoToggle() {
      const T = S.timer;
      if (T.running) { T.left = Math.max(0, T.endAt - Date.now()); T.running = false; }
      else { if (T.left <= 0) T.left = timerDur(T.mode); T.endAt = Date.now() + T.left; T.running = true; if ('Notification' in window && Notification.permission === 'default') askNotif(); }
      save(); render();
    },
    pomoReset() {
      const T = S.timer;
      if (T.mode === 'focus') { const spent = (timerDur('focus') - timerLeft()) / 60000; if (spent >= 1) logStudy(spent, T.subjectId); if (spent >= 1) toast(`Registrados ${r0(spent)} min de estudio`); }
      T.running = false; T.left = timerDur(T.mode); save(); render();
    },
    pomoSkip() {
      const T = S.timer;
      if (T.mode === 'focus') { const spent = (timerDur('focus') - timerLeft()) / 60000; if (spent >= 1) { logStudy(spent, T.subjectId); toast(`Registrados ${r0(spent)} min de estudio`); } T.count++; T.mode = T.count % 4 === 0 ? 'long' : 'break'; }
      else T.mode = 'focus';
      T.running = false; T.left = timerDur(T.mode); save(); render();
    },
    pomoPreset(el) {
      const T = S.timer;
      if (T.running) return toast('Pausa el temporizador para cambiar la duración');
      T.focus = +el.dataset.f; T.brk = +el.dataset.b; T.long = +el.dataset.l; T.left = timerDur(T.mode); save(); render();
    },
    subjectForm(el) { subjectForm(el.dataset.id); },
    sbColor(el) { $('#sbColors').dataset.c = el.dataset.c; $$('#sbColors button').forEach(b => { b.style.borderColor = b === el ? 'var(--text)' : 'transparent'; }); },
    saveSubject(el) {
      const name = $('#sbName').value.trim();
      if (!name) return toast('Escribe el nombre');
      const s = { id: el.dataset.id || uid(), name, goalH: num($('#sbGoal').value), color: $('#sbColors').dataset.c };
      const i = S.subjects.findIndex(x => x.id === s.id);
      if (i >= 0) S.subjects[i] = s; else S.subjects.push(s);
      if (!S.timer.subjectId) S.timer.subjectId = s.id;
      save(); closeModal(); render();
    },
    delSubject(el) {
      confirmBox('Eliminar asignatura', 'Las horas registradas se conservarán como “General”.', 'Eliminar', () => {
        S.subjects = S.subjects.filter(x => x.id !== el.dataset.id);
        if (S.timer.subjectId === el.dataset.id) S.timer.subjectId = S.subjects[0]?.id || '';
        save(); render();
      });
    },
    studyManual() {
      openModal(`${mHead('Registrar estudio')}
        <label for="smSub">Asignatura</label><select id="smSub"><option value="">General</option>${S.subjects.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
        <div class="grid2"><div><label for="smMin">Minutos</label><input id="smMin" type="number" inputmode="numeric" value="60" min="1"></div><div><label for="smDate">Fecha</label><input id="smDate" type="date" value="${dkey()}" max="${dkey()}"></div></div>
        <div class="m-foot"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="saveStudy">Guardar</button></div>`);
    },
    saveStudy() {
      const m = num($('#smMin').value), d = $('#smDate').value || dkey();
      if (!(m > 0)) return toast('Minutos no válidos');
      logStudy(m, $('#smSub').value, d); save(); closeModal(); render();
    },
    delStudy(el) { S.studyLog = S.studyLog.filter(l => l.id !== el.dataset.id); save(); render(); },

    // ajustes
    setToggle(el) { S.settings[el.dataset.k] = el.checked; save(); if (el.dataset.k === 'notify' && el.checked && 'Notification' in window && Notification.permission === 'default') askNotif(); },
    exportJSON() { download(`mi-rutina-copia-${dkey()}.json`, JSON.stringify(S), 'application/json'); toast('Copia exportada ✅'); },
    importJSON() {
      const inp = $('#importFile');
      inp.onchange = () => {
        const f = inp.files && inp.files[0];
        if (!f) return;
        const rd = new FileReader();
        rd.onload = () => {
          try {
            const data = JSON.parse(rd.result);
            if (!data || typeof data !== 'object' || !Array.isArray(data.blocks)) throw new Error('Formato no válido');
            localStorage.setItem(KEY, JSON.stringify(data));
            load(); buildEx(); applyTheme(); render(); toast('Copia importada ✅');
          } catch (e) { toast('No se pudo importar', e.message); }
        };
        rd.readAsText(f);
      };
      inp.click();
    },
    clearPhotos() { confirmBox('Borrar fotos', 'Se eliminarán todas las fotos de comidas (los alimentos registrados se mantienen).', 'Borrar', () => { S.photos = {}; save(); render(); toast('Fotos borradas'); }); },
    resetAll() {
      confirmBox('Borrar todos los datos', 'Se eliminará tu plan, entrenos, comidas y estudio. Se cargará el plan de ejemplo.', 'Borrar todo', () => {
        try { localStorage.removeItem(KEY); } catch (e) { /* ignorar */ }
        REST = null; load(); buildEx(); applyTheme(); location.hash = 'hoy'; render(); toast('Datos borrados');
      });
    }
  };

  // --- inputs ---
  const IN = {
    libQ(el) { UI.libQ = el.value; const q = norm(el.value); const list = Object.values(EX).filter(e => (UI.libGroup === 'Todos' || e.group === UI.libGroup) && (!q || matches(e.name, q)) && (!UI.onlyAvail || exAvail(e.id))); $('#libList').innerHTML = libListHTML(list); },
    reName(el) { RED.name = el.value; },
    reF(el) { RED.exercises[+el.dataset.i][el.dataset.f] = el.dataset.f === 'kg' ? el.value : num(el.value); },
    pkQ(el) { PICK.q = el.value; renderPickList(); },
    sxA(el) { S.active.exercises[+el.dataset.i].sets[+el.dataset.j].a = el.value; save(); },
    sxB(el) { S.active.exercises[+el.dataset.i].sets[+el.dataset.j].b = el.value; save(); },
    afQ(el) { AF.q = el.value; renderFoodResults(); },
    fpG() { updatePortion(); },
    aiG(el) { AF.ai[+el.dataset.i].g = num(el.value); },
    eeG(el) { const e = (S.meals[UI.foodDate] || []).find(x => x.id === el.dataset.id); if (e) updateEntryPrev(e); },
    pomoSub(el) { S.timer.subjectId = el.value; save(); },
    stName(el) { S.settings.name = el.value.trim(); save(); },
    stTheme(el) { S.settings.theme = el.value; save(); applyTheme(); },
    stWater(el) { S.settings.waterEvery = num(el.value); S.lastWaterNotif = Date.now(); save(); },
    stKey(el) { S.settings.apiKey = el.value.trim(); save(); },
    stModel(el) { S.settings.aiModel = el.value; save(); }
  };

  // ---------- eventos globales ----------
  document.addEventListener('click', e => {
    unlockAudio();
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = A[el.dataset.act];
    if (!fn) return;
    if (el.tagName !== 'INPUT') e.preventDefault();
    try { fn(el, e); } catch (err) { console.error(err); toast('Ups, algo no ha ido bien', err.message); }
  });
  const onInput = e => {
    const el = e.target.closest('[data-in]');
    if (!el) return;
    const fn = IN[el.dataset.in];
    if (fn) try { fn(el, e); } catch (err) { console.error(err); }
  };
  document.addEventListener('input', onInput);
  document.addEventListener('change', e => { if (e.target.tagName === 'SELECT') onInput(e); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'afQ' && AF && AF.q.trim()) searchOnline();
    if (e.key === 'Enter' && e.target.id === 'scanCode') A.scanLookup();
  });
  modal().addEventListener('click', e => { if (e.target === modal()) closeModal(); });
  modal().addEventListener('cancel', e => { e.preventDefault(); closeModal(); });
  window.addEventListener('hashchange', () => {
    const v = location.hash.slice(1);
    UI.view = VIEWS[v] ? v : 'hoy';
    closeModal();
    render(); window.scrollTo(0, 0);
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkReminders(); tick(); render(); } });
  if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyTheme); } catch (e) { /* navegadores antiguos */ } }

  // ---------- arranque ----------
  load();
  buildEx();
  applyTheme();
  { const v = location.hash.slice(1); UI.view = VIEWS[v] ? v : 'hoy'; }
  if (S.timer.running && S.timer.endAt <= Date.now()) pomoComplete();
  render();
  setInterval(tick, 1000);
  setInterval(checkReminders, 15000);
  setTimeout(checkReminders, 1500);
  if ('serviceWorker' in navigator && window.isSecureContext && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then(r => { swReg = r; }).catch(() => { /* sin modo offline */ });
  }
})();
