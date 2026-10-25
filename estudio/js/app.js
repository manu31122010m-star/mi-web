/* Estudio — organizador del día, asignaturas y modo concentración */
'use strict';
(() => {
  const D = window.APPDATA;
  const CATS = D.CATS;

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


  // ---------- UI runtime ----------
  const UI = { chatDraft: '', view: 'hoy', planDay: dow(), subj: '', guideOs: '' };
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

  // ---------- IA (Claude a través de claude.ai) ----------
  let SAMPLE = null, SAMPLE_LIMITS = null;
  const useClaude = () => S.settings.aiEngine === 'claude' && aiState === 'ready';
  function initAI() {
    const done = ok => { aiState = ok ? 'ready' : 'none'; if (UI.view === 'asistente' || UI.view === 'ajustes') render(); };
    if (!window.claude || typeof window.claude.use !== 'function') { aiState = 'none'; return; }
    window.claude.use('sample').then(async fn => {
      if (!fn) return done(false);
      SAMPLE = fn;
      try { SAMPLE_LIMITS = await fn.limits(); } catch (e) { SAMPLE_LIMITS = null; }
      done(true);
    }).catch(() => { SAMPLE = null; done(false); });
  }
  function aiErrMsg(e) {
    const code = e && e.code;
    if (code === 'not_granted' || code === 'sampling_disabled' || code === 'capability_disabled' || code === 'not_declared') return 'No se ha dado permiso para usar Claude en FOCUS.';
    if (code === 'rate_limited') return 'Has hecho muchas preguntas seguidas o has llegado a tu límite de uso. Prueba en un rato.';
    if (code === 'session_expired') return 'Tu sesión de claude.ai ha caducado. Vuelve a iniciar sesión.';
    if (code === 'image_rejected' || code === 'images_unavailable') return 'No se pudo enviar esa imagen. Prueba con otra foto.';
    if (code === 'refused') return 'Claude no puede responder a eso. Prueba a preguntarlo de otra forma.';
    if (code === 'prompt_too_large') return 'La conversación es demasiado larga. Bórrala y empieza de nuevo.';
    if (code === 'invalid_json') return 'No se pudo interpretar la respuesta. Inténtalo otra vez.';
    return 'No se pudo conectar con el asistente. Inténtalo de nuevo.';
  }

  // ---------- recordatorios ----------
  let notified = new Set();
  try { notified = new Set(JSON.parse(sessionStorage.getItem('mr.notified') || '[]')); } catch (e) { notified = new Set(); }
  const markNotified = k => { notified.add(k); try { sessionStorage.setItem('mr.notified', JSON.stringify([...notified].slice(-300))); } catch (e) { /* ignorar */ } };
  function checkReminders() {
    const k = dkey();
    if (k !== lastDay) { lastDay = k; UI.planDay = dow(); render(); }
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

  // ---------- modal ----------
  const modal = () => $('#modal');
  let onModalClose = null;
  function openModal(html, onClose) {
    if (onModalClose) { const f = onModalClose; onModalClose = null; f(); }
    $('#modalBody').innerHTML = html;
    onModalClose = onClose || null;
    const m = modal();
    if (!m.open) { document.documentElement.classList.add('modal-open'); try { m.showModal(); } catch (e) { m.setAttribute('open', ''); } }
    $('#modalBody').scrollTop = 0;
  }
  function setModal(html) { $('#modalBody').innerHTML = html; }
  function closeModal() {
    if (onModalClose) { const f = onModalClose; onModalClose = null; f(); }
    const m = modal();
    if (m.open) { try { m.close(); } catch (e) { m.removeAttribute('open'); } }
    document.documentElement.classList.remove('modal-open');
  }
  const mHead = title => `<div class="m-head"><h2>${title}</h2><button class="m-close" data-act="closeModal" aria-label="Cerrar">×</button></div>`;
  function confirmBox(title, text, okLabel, onOk, danger = true) {
    openModal(`${mHead(esc(title))}<p class="muted">${esc(text)}</p>
      <div class="m-foot"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" id="cfOk">${esc(okLabel)}</button></div>`);
    $('#cfOk').onclick = () => { closeModal(); onOk(); };
  }

  // ---------- estado ----------
  const KEY = 'estudio.v1';
  function defaults() {
    return {
      version: 1,
      settings: { name: '', notify: true, sound: true, remind: 10, theme: 'auto', aiEngine: 'local' },
      blocks: [], done: {}, tasks: [],
      subjects: [], studyLog: [],
      focus: null,
      fs: { subjectId: '', topicId: '', min: 50, cycles: 1, brk: 10, strict: true },
      planTab: 'horario',
      chat: []
    };
  }
  let S;
  function load() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) { raw = null; }
    const d = defaults();
    if (!raw || typeof raw !== 'object') { S = d; save(); return; }
    S = { ...d };
    for (const k of Object.keys(d)) if (raw[k] !== undefined) S[k] = raw[k];
    S.settings = { ...d.settings, ...(raw.settings || {}) };
    S.fs = { ...d.fs, ...(raw.fs || {}) };
    for (const k of ['blocks', 'tasks', 'subjects', 'studyLog', 'chat']) if (!Array.isArray(S[k])) S[k] = [];
    if (!S.done || typeof S.done !== 'object') S.done = {};
    for (const s of S.subjects) { s.exams = Array.isArray(s.exams) ? s.exams : []; s.topics = Array.isArray(s.topics) ? s.topics : []; for (const tp of s.topics) tp.cards = Array.isArray(tp.cards) ? tp.cards : []; }
  }
  let saveWarned = false;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); saveWarned = false; return true; } catch (e) {
      if (!saveWarned) toast('⚠️ Almacenamiento lleno', 'Exporta una copia en Ajustes y borra datos antiguos.');
      saveWarned = true; return false;
    }
  }
  const subjectById = id => S.subjects.find(s => s.id === id);
  const topicById = (s, id) => (s?.topics || []).find(t => t.id === id);
  const studyMin = (from, to = '9999') => S.studyLog.filter(l => l.date >= from && l.date <= to).reduce((a, l) => a + l.min, 0);
  function streak() {
    const days = new Set(S.studyLog.filter(l => l.min > 0).map(l => l.date));
    let k = dkey(), n = 0;
    if (!days.has(k)) k = addDays(k, -1);
    while (days.has(k)) { n++; k = addDays(k, -1); }
    return n;
  }
  function upcomingExams(limitDays = 60) {
    const today = dkey(), max = addDays(today, limitDays), out = [];
    for (const s of S.subjects) for (const e of s.exams || []) if (e.date >= today && e.date <= max) out.push({ s, e, days: Math.round((parseKey(e.date) - parseKey(today)) / 864e5) });
    return out.sort((a, b) => a.e.date < b.e.date ? -1 : 1);
  }
  const STATUS = D.TOPIC_STATUS;
  const statusOf = st => STATUS.find(x => x[0] === st) || STATUS[0];

  // =====================================================================
  // VISTA: HOY
  // =====================================================================
  function viewHoy() {
    const k = dkey(), nm = nowMin();
    const blocks = blocksFor(dow());
    const done = S.done[k] || [];
    const cur = blocks.find(b => isCurrent(b, nm) && !done.includes(b.id));
    const next = blocks.find(b => toMin(b.start) > nm);
    const hello = nm < 720 ? 'Buenos días' : nm < 1260 ? 'Buenas tardes' : 'Buenas noches';
    const name = S.settings.name ? `, ${esc(S.settings.name)}` : '';
    const tasks = S.tasks.filter(t => !t.done && t.date && t.date <= k).sort((a, b) => a.date < b.date ? -1 : 1);
    const exams = upcomingExams(30).slice(0, 3);
    const wk = weekStart();

    let hero;
    if (cur) {
      const c = CATS[cur.cat] || CATS.otro;
      hero = `<div class="muted">Ahora mismo · hasta las ${cur.end}</div><h2>${c.icon} ${esc(cur.title)}</h2>${blockAction(cur, true)}`;
    } else if (next) {
      const c = CATS[next.cat] || CATS.otro;
      hero = `<div class="muted">Siguiente en ${fmtH(toMin(next.start) - nm)} · ${next.start}</div><h2>${c.icon} ${esc(next.title)}</h2><button class="btn sm mt" data-act="go" data-v="foco">🔒 Concentrarme ya</button>`;
    } else {
      hero = `<div class="muted">${blocks.length ? 'Has terminado el horario de hoy' : 'Aún no has planificado hoy'}</div><h2>${blocks.length ? '¡Buen trabajo! 🎉' : '¿Organizamos tu día?'}</h2><div class="row mt" style="gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="newBlock" data-day="${dow()}">+ Añadir actividad</button><button class="btn sm" data-act="go" data-v="foco">🔒 Estudiar</button></div>`;
    }
    const notifBanner = ('Notification' in window) && Notification.permission === 'default' && S.settings.notify
      ? `<div class="banner"><span style="font-size:22px">🔔</span><div class="grow">Activa los avisos para que te recuerde cada actividad y te avise si sales del modo concentración.</div><button class="btn sm primary" data-act="askNotif">Activar</button></div>` : '';
    const fmtS = m => fmtH(m).replace(' min', 'm').replace(' h', 'h');
    return `
      ${notifBanner}
      <div class="card hero"><div style="position:relative;z-index:1">
        <div class="muted" style="font-size:13px">${hello}${name} 👋</div>
        <div class="mt">${hero}</div>
      </div></div>
      <div class="stats">
        <div class="stat"><b>${fmtS(studyMin(k, k))}</b><span>Hoy</span></div>
        <div class="stat"><b>${fmtS(studyMin(wk))}</b><span>Semana</span></div>
        <div class="stat"><b>${streak()} 🔥</b><span>Racha</span></div>
        <div class="stat"><b>${S.tasks.filter(t => !t.done).length}</b><span>Tareas</span></div>
      </div>
      ${exams.length ? `<div class="sec-title">Próximos exámenes</div><div class="card">${exams.map(({ s, e, days }) => `<div class="list-item" data-act="openSubject" data-id="${s.id}" style="cursor:pointer"><i class="dot" style="background:${esc(s.color)}"></i><div class="grow"><div class="li-title">${esc(e.title)} · ${esc(s.name)}</div><div class="li-sub">${fmtDate(e.date, { weekday: 'long', day: 'numeric', month: 'long' })}</div></div><span class="badge" style="${days <= 3 ? 'color:var(--bad);border-color:var(--bad)' : ''}">${days === 0 ? '¡Hoy!' : days === 1 ? 'Mañana' : days + ' días'}</span></div>`).join('')}</div>` : ''}
      <div class="row between" style="margin:22px 4px 10px"><div class="sec-title" style="margin:0">Tareas de hoy</div><button class="link" data-act="newTask" data-date="${k}">+ Tarea</button></div>
      <div class="card">${tasks.length ? tasks.map(taskItem).join('') : '<div class="muted">No tienes tareas para hoy.</div>'}</div>
      <button class="card flat row mt" data-act="go" data-v="asistente" style="width:100%;text-align:left;cursor:pointer">
        <span style="font-size:24px">✨</span><div class="grow"><b>Tu asistente de estudio</b><div class="li-sub">Planifica exámenes, apunta tareas, te hace tests y te ayuda a organizarte.</div></div><span class="dim">›</span>
      </button>
      <div class="row between" style="margin:22px 4px 10px"><div class="sec-title" style="margin:0">Tu día · ${DAYS[dow()]}</div><button class="link" data-act="newBlock" data-day="${dow()}">+ Añadir</button></div>
      <div class="tl">${blocks.length ? blocks.map(b => tlItem(b, done.includes(b.id), cur && cur.id === b.id)).join('') : `<div class="card empty"><div class="big">🗓️</div>No hay actividades para hoy.<div class="mt"><button class="btn primary" data-act="newBlock" data-day="${dow()}">Planificar hoy</button></div></div>`}</div>`;
  }

  // =====================================================================
  // TAREAS
  // =====================================================================
  function taskItem(t) {
    const s = subjectById(t.subjectId), k = dkey();
    const late = t.date && t.date < k && !t.done;
    const when = !t.date ? '' : t.date === k ? 'Hoy' : t.date === addDays(k, 1) ? 'Mañana' : fmtDate(t.date, { weekday: 'short', day: 'numeric', month: 'short' });
    return `<div class="list-item ${t.done ? 'dim' : ''}">
      <button class="check ${t.done ? 'on' : ''}" data-act="toggleTask" data-id="${t.id}" aria-label="Completar tarea">✓</button>
      <div class="grow" data-act="editTask" data-id="${t.id}" style="cursor:pointer"><div class="li-title" style="${t.done ? 'text-decoration:line-through' : ''}">${esc(t.title)}</div>
        <div class="li-sub">${s ? `<i class="dot" style="background:${esc(s.color)};width:7px;height:7px"></i> ${esc(s.name)}` : ''}${s && when ? ' · ' : ''}${when ? `<span style="${late ? 'color:var(--bad);font-weight:700' : ''}">${late ? '⚠ ' : ''}${when}</span>` : ''}</div></div>
    </div>`;
  }
  function viewTasks() {
    const k = dkey(), tm = addDays(k, 1), wkEnd = addDays(k, 7);
    const pend = S.tasks.filter(t => !t.done).sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1);
    const groups = [
      ['⚠️ Atrasadas', pend.filter(t => t.date && t.date < k)],
      ['Hoy', pend.filter(t => t.date === k)],
      ['Mañana', pend.filter(t => t.date === tm)],
      ['Próximos 7 días', pend.filter(t => t.date > tm && t.date <= wkEnd)],
      ['Más adelante', pend.filter(t => t.date > wkEnd)],
      ['Sin fecha', pend.filter(t => !t.date)]
    ].filter(g => g[1].length);
    const doneList = S.tasks.filter(t => t.done).slice(-10).reverse();
    return `<div class="row between" style="margin:4px 4px 12px"><div><h2>Tareas</h2><small>${pend.length} pendientes</small></div><button class="btn primary sm" data-act="newTask">+ Nueva tarea</button></div>
      ${groups.length ? groups.map(([g, list]) => `<div class="sec-title">${g}</div><div class="card">${list.map(taskItem).join('')}</div>`).join('') : '<div class="card empty"><div class="big">✅</div>No tienes tareas pendientes.<div class="li-sub mt">Apunta deberes, entregas o cosas por hacer con fecha.</div></div>'}
      ${doneList.length ? `<div class="sec-title">Completadas</div><div class="card">${doneList.map(taskItem).join('')}</div>` : ''}`;
  }
  function taskForm(t, isNew) {
    openModal(`${mHead(isNew ? 'Nueva tarea' : 'Editar tarea')}
      <label for="tkTitle">Tarea</label><input id="tkTitle" maxlength="100" value="${esc(t.title)}" placeholder="¿Qué tienes que hacer?">
      <div class="grid2"><div><label for="tkDate">Fecha</label><input id="tkDate" type="date" value="${esc(t.date)}"></div>
      <div><label for="tkSub">Asignatura</label><select id="tkSub"><option value="">—</option>${S.subjects.map(s => `<option value="${s.id}" ${s.id === t.subjectId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div></div>
      <label for="tkNote">Notas</label><textarea id="tkNote" maxlength="500" placeholder="Opcional">${esc(t.note || '')}</textarea>
      <div class="m-foot">${isNew ? '<button class="btn" data-act="closeModal">Cancelar</button>' : `<button class="btn danger" data-act="delTask" data-id="${t.id}">Eliminar</button>`}<button class="btn primary" data-act="saveTask" data-id="${t.id}">Guardar</button></div>`);
    if (isNew) setTimeout(() => { const i = $('#tkTitle'); if (i && !matchMedia('(pointer:coarse)').matches) i.focus(); }, 50);
  }

  // =====================================================================
  // VISTA: ASIGNATURAS
  // =====================================================================
  function viewAsignaturas() {
    if (UI.subj && subjectById(UI.subj)) return viewSubject(subjectById(UI.subj));
    const wk = weekStart();
    return `<div class="row between" style="margin:4px 4px 12px"><div><h2>Asignaturas</h2><small>${S.subjects.length} asignaturas</small></div><button class="btn primary sm" data-act="subjectForm">+ Nueva</button></div>
      ${S.subjects.length ? S.subjects.map(s => {
        const m = S.studyLog.filter(l => l.date >= wk && l.subjectId === s.id).reduce((a, l) => a + l.min, 0);
        const g = num(s.goalH) * 60;
        const dom = s.topics.filter(t => t.status === 'dominado').length;
        const ex = (s.exams || []).filter(e => e.date >= dkey()).sort((a, b) => a.date < b.date ? -1 : 1)[0];
        return `<div class="card" data-act="openSubject" data-id="${s.id}" style="cursor:pointer;border-left:4px solid ${esc(s.color)}">
          <div class="row between"><h3>${esc(s.name)}</h3><span class="dim">›</span></div>
          <div class="li-sub">${s.topics.length ? `${dom}/${s.topics.length} temas dominados` : 'Sin temas'}${ex ? ` · 📝 ${esc(ex.title)} el ${fmtDate(ex.date, { day: 'numeric', month: 'short' })}` : ''}</div>
          <div class="macro"><div class="row between"><span class="li-sub">Esta semana</span><span><b>${fmtH(m)}</b><span class="muted">${g ? ' / ' + fmtH(g) : ''}</span></span></div><div class="bar"><i style="width:${g ? clamp(m / g * 100, 0, 100) : 0}%;background:${esc(s.color)}"></i></div></div>
        </div>`;
      }).join('') : '<div class="card empty"><div class="big">📚</div>Añade tus asignaturas para organizar temas, exámenes y horas de estudio.<div class="mt"><button class="btn primary" data-act="subjectForm">+ Añadir asignatura</button></div></div>'}`;
  }
  function viewSubject(s) {
    const wk = weekStart(), today = dkey();
    const week = S.studyLog.filter(l => l.date >= wk && l.subjectId === s.id).reduce((a, l) => a + l.min, 0);
    const total = S.studyLog.filter(l => l.subjectId === s.id).reduce((a, l) => a + l.min, 0);
    const dom = s.topics.filter(t => t.status === 'dominado').length;
    const exams = [...(s.exams || [])].sort((a, b) => a.date < b.date ? -1 : 1);
    return `<button class="link" data-act="closeSubject">‹ Asignaturas</button>
      <div class="card hero mt" style="background:linear-gradient(135deg, ${esc(s.color)}, color-mix(in srgb, ${esc(s.color)} 50%, #1e1b4b))"><div style="position:relative;z-index:1">
        <div class="row between"><h2>${esc(s.name)}</h2><button class="btn sm" data-act="subjectForm" data-id="${s.id}">Editar</button></div>
        <div class="muted mt">${fmtH(week)} esta semana${s.goalH ? ` de ${s.goalH} h` : ''} · ${fmtH(total)} en total · ${dom}/${s.topics.length} temas dominados</div>
        <button class="btn sm mt" data-act="focusSubject" data-id="${s.id}">🔒 Estudiar ahora</button>
      </div></div>
      <div class="row between" style="margin:22px 4px 10px"><div class="sec-title" style="margin:0">Exámenes</div><button class="link" data-act="examForm" data-sid="${s.id}">+ Examen</button></div>
      <div class="card">${exams.length ? exams.map(e => { const d = Math.round((parseKey(e.date) - parseKey(today)) / 864e5); return `<div class="list-item ${e.date < today ? 'dim' : ''}"><span style="font-size:20px">📝</span><div class="grow"><div class="li-title">${esc(e.title)}</div><div class="li-sub">${fmtDate(e.date, { weekday: 'long', day: 'numeric', month: 'long' })}${e.date >= today ? ` · ${d === 0 ? '¡hoy!' : d === 1 ? 'mañana' : 'faltan ' + d + ' días'}` : ' · pasado'}</div></div><button class="x" data-act="delExam" data-sid="${s.id}" data-id="${e.id}" aria-label="Borrar examen">×</button></div>`; }).join('') : '<div class="muted">Sin exámenes apuntados.</div>'}</div>
      <div class="row between" style="margin:22px 4px 10px"><div class="sec-title" style="margin:0">Temas</div><span class="li-sub">Toca el estado para cambiarlo</span></div>
      <div class="card">
        ${s.topics.map(t => { const st = statusOf(t.status); return `<div class="list-item"><div class="grow" data-act="openTopic" data-sid="${s.id}" data-id="${t.id}" style="cursor:pointer"><div class="li-title">${esc(t.title)}</div><div class="li-sub">${t.cards.length} tarjetas${t.notes ? ' · con apuntes' : ''}</div></div><button class="badge" data-act="cycleStatus" data-sid="${s.id}" data-id="${t.id}" style="color:${st[2]};border-color:${st[2]}">${st[1]}</button></div>`; }).join('')}
        <div class="row ${s.topics.length ? 'mt' : ''}"><input id="newTopic" class="grow" maxlength="80" placeholder="Nuevo tema…"><button class="btn primary" data-act="addTopic" data-sid="${s.id}">Añadir</button></div>
      </div>`;
  }
  function subjectForm(id) {
    const s = subjectById(id) || { id: '', name: '', color: '#8b6cff', goalH: 3 };
    const colors = ['#8b6cff', '#5ec8ff', '#2fd18b', '#ffb547', '#ff5c7a', '#f472b6', '#a3e635', '#94a3b8'];
    openModal(`${mHead(s.id ? 'Editar asignatura' : 'Nueva asignatura')}
      <label for="sbName">Nombre</label><input id="sbName" maxlength="40" value="${esc(s.name)}" placeholder="Nombre de la asignatura">
      <label for="sbGoal">Objetivo semanal (horas)</label><input id="sbGoal" type="number" inputmode="decimal" step="0.5" min="0" value="${esc(s.goalH)}">
      <label>Color</label><div class="row wrap" id="sbColors" data-c="${esc(s.color)}">${colors.map(c => `<button data-act="sbColor" data-c="${c}" style="width:32px;height:32px;border-radius:50%;background:${c};border:3px solid ${c === s.color ? 'var(--text)' : 'transparent'}" aria-label="Color"></button>`).join('')}</div>
      <div class="m-foot">${s.id ? `<button class="btn danger" data-act="delSubject" data-id="${s.id}">Eliminar</button>` : '<button class="btn" data-act="closeModal">Cancelar</button>'}<button class="btn primary" data-act="saveSubject" data-id="${s.id}">Guardar</button></div>`);
  }
  // --- tema: apuntes y tarjetas ---
  let REV = null; // repaso de tarjetas {sid, tid, order, i, show, ok}
  function topicModal(sid, tid) {
    const s = subjectById(sid), t = topicById(s, tid);
    if (!t) return;
    REV = null;
    const html = `${mHead(esc(t.title))}
      <div class="li-sub">${esc(s.name)}</div>
      <label for="tpTitle">Nombre del tema</label><input id="tpTitle" maxlength="80" value="${esc(t.title)}" data-in="tpField" data-f="title" data-sid="${sid}" data-id="${tid}">
      <label>Estado</label><div class="chips wrap">${STATUS.map(([k, l, c]) => `<button class="chip ${t.status === k ? 'on' : ''}" data-act="setStatus" data-sid="${sid}" data-id="${tid}" data-st="${k}" style="${t.status === k ? `background:${c};border-color:${c};color:#fff` : ''}">${l}</button>`).join('')}</div>
      <label for="tpNotes">Apuntes</label><textarea id="tpNotes" rows="6" maxlength="20000" placeholder="Escribe aquí tus apuntes, esquemas o fórmulas. El asistente podrá buscar en ellos." data-in="tpField" data-f="notes" data-sid="${sid}" data-id="${tid}">${esc(t.notes || '')}</textarea>
      <div class="row between" style="margin:18px 0 6px"><b>Tarjetas de repaso (${t.cards.length})</b>${t.cards.length ? `<button class="btn sm primary" data-act="startReview" data-sid="${sid}" data-id="${tid}">🧠 Repasar</button>` : ''}</div>
      ${t.cards.map((c, i) => `<div class="list-item"><div class="grow"><div class="li-title">${esc(c.q)}</div><div class="li-sub">${esc(c.a)}</div></div>${c.known === true ? '<span class="badge ok">✓</span>' : c.known === false ? '<span class="badge" style="color:var(--bad)">✗</span>' : ''}<button class="x" data-act="delCard" data-sid="${sid}" data-id="${tid}" data-i="${i}" aria-label="Borrar tarjeta">×</button></div>`).join('')}
      <input id="cardQ" class="mt" maxlength="300" placeholder="Pregunta">
      <input id="cardA" class="mt" maxlength="500" placeholder="Respuesta">
      <button class="btn block mt" data-act="addCard" data-sid="${sid}" data-id="${tid}">+ Añadir tarjeta</button>
      <div class="m-foot"><button class="btn danger" data-act="delTopic" data-sid="${sid}" data-id="${tid}">Eliminar tema</button><button class="btn primary" data-act="closeModal">Listo</button></div>`;
    if (modal().open) setModal(html); else openModal(html, () => { REV = null; if (UI.view === 'asignaturas') render(); });
  }
  function renderReview() {
    const s = subjectById(REV.sid), t = topicById(s, REV.tid);
    if (!t) return closeModal();
    if (REV.i >= REV.order.length) {
      setModal(`${mHead('Repaso terminado')}<div class="center" style="padding:20px 0"><div style="font-size:48px">${REV.ok / REV.order.length >= 0.8 ? '🎉' : '💪'}</div><h2>${REV.ok} de ${REV.order.length}</h2><p class="muted">${REV.ok === REV.order.length ? '¡Las sabes todas!' : 'Repasa otra vez las que fallaste.'}</p></div>
        <div class="m-foot"><button class="btn" data-act="openTopic" data-sid="${REV.sid}" data-id="${REV.tid}">Volver al tema</button><button class="btn primary" data-act="startReview" data-sid="${REV.sid}" data-id="${REV.tid}">Repetir</button></div>`);
      return;
    }
    const c = t.cards[REV.order[REV.i]];
    setModal(`${mHead(`Tarjeta ${REV.i + 1} de ${REV.order.length}`)}
      <div class="card flat center" style="padding:28px 16px"><div class="li-sub">Pregunta</div><h2 style="margin-top:8px">${esc(c.q)}</h2>
      ${REV.show ? `<div class="li-sub mt">Respuesta</div><p style="font-size:17px;margin:6px 0 0">${esc(c.a)}</p>` : ''}</div>
      ${REV.show ? '<div class="m-foot"><button class="btn danger" data-act="revAnswer" data-ok="0">✗ No la sabía</button><button class="btn ok" data-act="revAnswer" data-ok="1">✓ La sabía</button></div>' : '<button class="btn primary block mt" data-act="revShow">Ver respuesta</button>'}`);
  }

  // =====================================================================
  // VISTA: CONCENTRACIÓN (bloqueo)
  // =====================================================================
  let wakeLock = null;
  async function keepAwake() {
    try { if ('wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { wakeLock = null; }
  }
  function releaseAwake() { try { if (wakeLock) wakeLock.release(); } catch (e) { /* ignorar */ } wakeLock = null; }
  const canFullscreen = () => !!(document.documentElement.requestFullscreen) && document.fullscreenEnabled !== false;
  function enterFullscreen() { try { if (canFullscreen() && !document.fullscreenElement) document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); } catch (e) { /* no soportado */ } }
  function exitFullscreen() { try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) { /* ignorar */ } }

  function startFocus(opts = {}) {
    if (S.focus) { toast('Ya estás en una sesión de concentración'); return; }
    const fs = { ...S.fs, ...opts };
    const min = clamp(r0(num(fs.min)) || 25, 1, 240);
    S.focus = {
      subjectId: fs.subjectId || '', topicId: fs.topicId || '', min, cycles: clamp(r0(num(fs.cycles)) || 1, 1, 8), brk: clamp(r0(num(fs.brk)) || 5, 1, 60),
      strict: fs.strict !== false, cycle: 1, phase: 'focus', startAt: Date.now(), phaseStart: Date.now(), endAt: Date.now() + min * 60000,
      leaves: 0, awayMs: 0, phaseAway: 0, hiddenAt: 0, focusedMin: 0
    };
    save(); closeModal();
    enterFullscreen(); keepAwake();
    try { history.pushState({ lock: 1 }, ''); } catch (e) { /* ignorar */ }
    if ('Notification' in window && Notification.permission === 'default') askNotif();
    render();
  }
  function focusLeft() { return S.focus ? S.focus.endAt - Date.now() : 0; }
  function logFocusPhase() {
    const f = S.focus;
    const elapsed = Math.min(Date.now(), f.endAt) - f.phaseStart;
    const mins = Math.max(0, (elapsed - f.phaseAway) / 60000);
    f.focusedMin += mins;
    if (mins >= 1) {
      S.studyLog.push({ id: uid(), date: dkey(), subjectId: f.subjectId, topicId: f.topicId, min: r0(mins), ts: Date.now(), mode: 'focus', leaves: f.phaseLeaves || 0 });
      const t = topicById(subjectById(f.subjectId), f.topicId);
      if (t && t.status === 'pendiente') t.status = 'estudiando';
    }
  }
  function phaseEnd() {
    const f = S.focus;
    if (f.phase === 'focus') {
      logFocusPhase();
      if (f.cycle < f.cycles) {
        f.phase = 'break'; f.phaseStart = Date.now(); f.endAt = Date.now() + f.brk * 60000;
        notify('☕ ¡Descanso!', `Bloque ${f.cycle} de ${f.cycles} completado. Descansa ${f.brk} min.`, 'focus');
      } else return finishFocus(true);
    } else {
      f.cycle++; f.phase = 'focus'; f.phaseStart = Date.now(); f.phaseAway = 0; f.phaseLeaves = 0; f.endAt = Date.now() + f.min * 60000;
      notify('🔒 Vuelta al foco', `Bloque ${f.cycle} de ${f.cycles}: ${f.min} min.`, 'focus');
      keepAwake();
    }
    save(); renderLock();
  }
  function finishFocus(completed) {
    const f = S.focus;
    if (!f) return;
    if (!completed && f.phase === 'focus') logFocusPhase();
    S.focus = null;
    save(); exitFullscreen(); releaseAwake();
    const s = subjectById(f.subjectId);
    renderLock(); render();
    if (completed) notify('🎉 ¡Sesión completada!', `${r0(f.focusedMin)} min de estudio${s ? ' de ' + s.name : ''}.`, 'focus');
    openModal(`${mHead(completed ? '¡Sesión completada! 🎉' : 'Sesión terminada')}
      <div class="grid3 mt"><div class="stat"><b>${r0(f.focusedMin)}</b><span>min de foco</span></div><div class="stat"><b>${f.leaves}</b><span>${f.leaves === 1 ? 'salida' : 'salidas'}</span></div><div class="stat"><b>${fmtClock(f.awayMs)}</b><span>fuera</span></div></div>
      <p class="muted center mt">${completed ? (f.leaves === 0 ? 'Concentración perfecta. ¡Así se hace!' : 'Bien hecho. La próxima vez intenta no salir de la app.') : 'Has terminado antes de tiempo. Lo estudiado se ha guardado igualmente.'}</p>
      <div class="m-foot"><button class="btn" data-act="closeModal">Cerrar</button><button class="btn primary" data-act="go" data-v="foco">Otra sesión</button></div>`);
  }
  function lockHTML() {
    const f = S.focus;
    const s = subjectById(f.subjectId), t = topicById(s, f.topicId);
    const left = focusLeft(), total = (f.phase === 'focus' ? f.min : f.brk) * 60000;
    const quote = D.QUOTES[Math.floor(f.startAt / 1000) % D.QUOTES.length];
    const isBreak = f.phase === 'break';
    return `<div class="lock-in">
      <div class="row between" style="width:100%"><span class="badge" style="${isBreak ? '' : 'color:var(--accent);border-color:var(--accent)'}">${isBreak ? '☕ Descanso' : '🔒 Modo concentración'}</span>${f.cycles > 1 ? `<span class="li-sub">Bloque ${f.cycle}/${f.cycles}</span>` : ''}</div>
      <div class="lock-subj">${s ? `<i class="dot" style="background:${esc(s.color)}"></i> ${esc(s.name)}${t ? ' · ' + esc(t.title) : ''}` : 'Estudio libre'}</div>
      <div class="lock-ring">${ring(1 - left / total, isBreak ? 'var(--ok)' : 'var(--accent)', 250, 12, `<div><div class="pomo-time" id="lockTime">${fmtClock(left)}</div><div class="li-sub">${isBreak ? 'puedes descansar' : 'de concentración'}</div></div>`)}</div>
      <p class="lock-quote">${isBreak ? 'Levántate, estira y bebe agua. Sin redes sociales 😉' : esc(quote)}</p>
      <div class="li-sub">${f.leaves ? `Has salido ${f.leaves} ${f.leaves === 1 ? 'vez' : 'veces'} (${fmtClock(f.awayMs)} fuera)` : 'Sin salidas. ¡Sigue así!'}</div>
      <div class="lock-actions">
        ${!isBreak && canFullscreen() && !document.fullscreenElement ? '<button class="btn" data-act="lockFull">⛶ Pantalla completa</button>' : ''}
        ${isBreak ? '<button class="btn primary" data-act="lockSkipBreak">Saltar descanso</button>' : ''}
        <button class="btn danger hold" data-hold="abandon" style="--hold:${f.strict ? 5 : 2}s"><span>Mantén pulsado ${f.strict ? '5' : '2'} s para abandonar</span></button>
      </div>
    </div>`;
  }
  let lockSig = '';
  function renderLock() {
    let el = $('#lock');
    if (!S.focus) { if (el) el.remove(); document.documentElement.classList.remove('locked'); lockSig = ''; return; }
    if (!el) { el = document.createElement('div'); el.id = 'lock'; el.className = 'lock'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Modo concentración'); document.body.appendChild(el); }
    document.documentElement.classList.add('locked');
    const f = S.focus;
    const sig = [f.phase, f.cycle, f.leaves, !!document.fullscreenElement].join('|');
    if (sig !== lockSig || !el.firstChild) { el.innerHTML = lockHTML(); lockSig = sig; }
  }
  function tickLock() {
    if (!S.focus) return;
    const left = focusLeft();
    if (left <= 0) return phaseEnd();
    const t = $('#lockTime'); if (t) t.textContent = fmtClock(left);
    const c = $('#lock .ring circle:nth-child(2)');
    if (c) { const len = parseFloat(c.getAttribute('stroke-dasharray')); const total = (S.focus.phase === 'focus' ? S.focus.min : S.focus.brk) * 60000; c.setAttribute('stroke-dashoffset', (len * (left / total)).toFixed(2)); }
  }
  // Salir de la app durante el foco: aviso inmediato y se cuenta como distracción
  function onVisibility() {
    const f = S.focus;
    if (!f || f.phase !== 'focus') return;
    if (document.visibilityState === 'hidden') {
      f.hiddenAt = Date.now(); f.leaves++; f.phaseLeaves = (f.phaseLeaves || 0) + 1; save();
      notify('🔒 ¡Estás estudiando!', `Vuelve a Estudio: te quedan ${Math.max(1, Math.ceil(focusLeft() / 60000))} min de concentración.`, 'focus-leave');
    } else if (f.hiddenAt) {
      const away = Date.now() - f.hiddenAt;
      f.awayMs += away; f.phaseAway += away; f.hiddenAt = 0; save();
      keepAwake();
      if (away > 3000) { toast('👀 Has salido de la app', `${fmtClock(away)} fuera. ¡Vuelve al foco!`); if (S.settings.sound) beep(); }
      lockSig = ''; renderLock();
    }
  }
  function viewFoco() {
    const fs = S.fs;
    const s = subjectById(fs.subjectId);
    const wk = weekStart();
    const sessions = S.studyLog.filter(l => l.mode === 'focus' && l.date >= wk);
    const chip = (k, v, label) => `<button class="chip ${num(fs[k]) === v ? 'on' : ''}" data-act="fsSet" data-k="${k}" data-v="${v}">${label}</button>`;
    return `
      <div class="card hero"><div style="position:relative;z-index:1">
        <div class="muted">Modo concentración</div><h2>🔒 Bloquea las distracciones</h2>
        <div class="muted mt" style="font-size:14px">Pantalla completa, pantalla siempre encendida y aviso al momento si te sales. No podrás salir de la sesión hasta que acabe.</div>
      </div></div>
      <div class="card">
        <label for="fsSub" style="margin-top:0">Asignatura</label>
        <select id="fsSub" data-in="fsSub"><option value="">Estudio libre</option>${S.subjects.map(x => `<option value="${x.id}" ${x.id === fs.subjectId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
        ${s && s.topics.length ? `<label for="fsTopic">Tema</label><select id="fsTopic" data-in="fsTopic"><option value="">Todos</option>${s.topics.map(t => `<option value="${t.id}" ${t.id === fs.topicId ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select>` : ''}
        <label>Duración de cada bloque</label>
        <div class="chips wrap">${chip('min', 25, '25 min')}${chip('min', 45, '45 min')}${chip('min', 50, '50 min')}${chip('min', 60, '1 h')}${chip('min', 90, '1 h 30')}<input type="number" inputmode="numeric" min="1" max="240" value="${esc(fs.min)}" data-in="fsMin" style="width:86px;padding:8px 10px" aria-label="Minutos personalizados"></div>
        <label>Bloques</label>
        <div class="chips wrap">${[1, 2, 3, 4].map(n => chip('cycles', n, n === 1 ? '1 bloque' : n + ' bloques')).join('')}</div>
        ${num(fs.cycles) > 1 ? `<label>Descanso entre bloques</label><div class="chips wrap">${[5, 10, 15].map(n => chip('brk', n, n + ' min')).join('')}</div>` : ''}
        <div class="set-line mt"><div><b>Modo estricto</b><div class="li-sub">Para abandonar hay que mantener pulsado 5 s y no funciona el botón atrás</div></div><label class="switch"><input type="checkbox" data-act="fsStrict" ${fs.strict !== false ? 'checked' : ''}><span></span></label></div>
        <button class="btn primary block mt" data-act="focusStart" style="padding:15px">🔒 Empezar a estudiar · ${fmtH(num(fs.min) * num(fs.cycles))}</button>
      </div>
      <button class="card flat row" data-act="blockGuide" style="width:100%;text-align:left;cursor:pointer">
        <span style="font-size:24px">📵</span><div class="grow"><b>Bloquear las apps del móvil</b><div class="li-sub">Configura una vez el bloqueo del sistema (Android o iPhone) para que Instagram, TikTok y compañía no se abran mientras estudias.</div></div><span class="dim">›</span>
      </button>
      <div class="sec-title">Esta semana</div>
      <div class="grid3"><div class="stat"><b>${sessions.length}</b><span>Sesiones</span></div><div class="stat"><b>${fmtH(sessions.reduce((a, l) => a + l.min, 0)).replace(' min', 'm').replace(' h', 'h')}</b><span>De foco</span></div><div class="stat"><b>${sessions.length ? r1(sessions.reduce((a, l) => a + (l.leaves || 0), 0) / sessions.length) : 0}</b><span>Salidas/sesión</span></div></div>
      <div class="card mt"><h3>Minutos de estudio por día</h3><div class="mt">${bars([...Array(7)].map((_, i) => studyMin(addDays(wk, i), addDays(wk, i))), DAYS_S, { highlight: dow(), unit: ' min' })}</div></div>
      <div class="row between" style="margin:22px 4px 10px"><div class="sec-title" style="margin:0">Sesiones recientes</div><button class="link" data-act="studyManual">+ Registrar a mano</button></div>
      <div class="card">${S.studyLog.length ? [...S.studyLog].sort((a, b) => b.ts - a.ts).slice(0, 8).map(l => { const sb = subjectById(l.subjectId); return `<div class="list-item"><i class="dot" style="background:${esc(sb?.color || 'var(--dim)')}"></i><div class="grow"><div class="li-title">${esc(sb?.name || 'Estudio libre')}</div><div class="li-sub">${fmtDate(l.date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmtH(l.min)}${l.mode === 'focus' ? ` · 🔒 ${l.leaves || 0} salidas` : ''}</div></div><button class="x" data-act="delStudy" data-id="${l.id}" aria-label="Borrar">×</button></div>`; }).join('') : '<div class="muted">Aquí aparecerán tus sesiones.</div>'}</div>`;
  }
  function guideModal(os) {
    os = os || UI.guideOs || (/iphone|ipad|ipod|macintosh/i.test(navigator.userAgent) && 'ontouchend' in document ? 'ios' : 'android');
    UI.guideOs = os;
    const url = location.href.split('#')[0];
    const steps = os === 'ios' ? [
      ['Crea un modo Concentración', 'Ajustes → <b>Concentración</b> → <b>+</b> → Personalizado → llámalo <b>Estudio</b>.'],
      ['Silencia las distracciones', 'En ese modo: Notificaciones → <b>Silenciar notificaciones de</b> → añade Instagram, TikTok, WhatsApp, YouTube, juegos…'],
      ['Oculta las apps', 'Personalizar pantallas → deja solo una pantalla de inicio con <b>Estudio</b> y lo necesario.'],
      ['Pon límites que no puedas saltarte', 'Ajustes → <b>Tiempo de uso</b> → Límites de apps → añade Redes sociales y Juegos con 1 min y activa <b>Bloquear al final del límite</b>. Pide a alguien que ponga el código de Tiempo de uso.'],
      ['Que te devuelva a Estudio', `App <b>Atajos</b> → Automatización → <b>+</b> → <b>App</b> → elige Instagram, TikTok… → “Se abra” → <b>Ejecutar inmediatamente</b> → acción <b>Abrir URL</b>: <span class="badge" style="user-select:all">${esc(url)}</span>`],
      ['Al estudiar', 'Activa la Concentración <b>Estudio</b> desde el Centro de control y empieza la sesión aquí.']
    ] : [
      ['Abre Bienestar digital', 'Ajustes → <b>Bienestar digital y controles parentales</b> → <b>Modo Concentración</b>. (En Samsung: Ajustes → Bienestar digital → <b>Modos</b>).'],
      ['Elige las apps que te distraen', 'Marca Instagram, TikTok, WhatsApp, YouTube, juegos… Esas apps se <b>pausan</b>: no se pueden abrir y no llegan sus notificaciones.'],
      ['Ponlo en los ajustes rápidos', 'Desliza desde arriba → ✏️ editar → arrastra <b>Modo Concentración</b> a tus botones.'],
      ['Programa tus horas (opcional)', 'En Modo Concentración → <b>Establecer horario</b> con tus horas de estudio: se activará solo.'],
      ['Al estudiar', 'Activa <b>Modo Concentración</b> desde los ajustes rápidos y empieza la sesión aquí. Para desactivarlo hay que ir a propósito a ajustes, lo que corta el impulso.'],
      ['Más estricto (opcional)', 'Con <b>Family Link</b> otra persona puede bloquear apps por horario y tú no podrás quitarlo.']
    ];
    const html = `${mHead('Bloquear las apps del móvil')}
      <p class="li-sub" style="margin-top:0">Una web no puede bloquear otras apps; el bloqueo real lo hace el propio sistema. Configúralo una vez y úsalo junto al modo concentración.</p>
      <div class="seg"><button class="${os === 'android' ? 'on' : ''}" data-act="guideOs" data-os="android">🤖 Android</button><button class="${os === 'ios' ? 'on' : ''}" data-act="guideOs" data-os="ios">🍎 iPhone</button></div>
      <ol class="guide">${steps.map(([h, d]) => `<li><b>${h}</b><div class="li-sub">${d}</div></li>`).join('')}</ol>
      <div class="m-foot"><button class="btn primary" data-act="closeModal">Entendido</button></div>`;
    if (modal().open) setModal(html); else openModal(html);
  }

  // =====================================================================
  // IA: contexto y herramientas para Claude (si se abre desde claude.ai)
  // =====================================================================
  const SUGGESTIONS = [
    '¿Qué me toca ahora?',
    '¿Qué tareas tengo?',
    '¿Cuándo es mi próximo examen?',
    'Planifica mi próximo examen',
    'Pregúntame de mis tarjetas',
    '¿Cómo memorizo mejor?',
    '¿Qué puedes hacer?'
  ];
  function aiContext() {
    const k = dkey(), nm = nowMin(), wk = weekStart();
    const ctx = {
      ahora: `${fmtDate(k)} ${pad(Math.floor(nm / 60))}:${pad(nm % 60)} (${DAYS[dow()]}, día ${dow()})`,
      usuario: S.settings.name || '',
      horario_hoy: blocksFor(dow()).map(b => `${b.start}-${b.end} ${b.title} [${CATS[b.cat]?.label}]`),
      horario_semana: DAYS.map((d, i) => `${d}: ${blocksFor(i).map(b => `${b.start}-${b.end} ${b.title}`).join('; ') || '—'}`),
      tareas_pendientes: S.tasks.filter(t => !t.done).map(t => `${t.date || 'sin fecha'}: ${t.title}${subjectById(t.subjectId) ? ' (' + subjectById(t.subjectId).name + ')' : ''}`),
      asignaturas: S.subjects.map(s => ({ nombre: s.name, objetivo_h_semana: s.goalH, minutos_esta_semana: S.studyLog.filter(l => l.date >= wk && l.subjectId === s.id).reduce((a, l) => a + l.min, 0), examenes: (s.exams || []).map(e => `${e.date} ${e.title}`), temas: s.topics.map(t => `${t.title} [${t.status}]${t.notes ? ' apuntes: ' + t.notes.slice(0, 400) : ''}`) })),
      racha_dias: streak()
    };
    return JSON.stringify(ctx);
  }
  const AI_RULES = `Eres el asistente de estudio de la app "Estudio". Hablas en español de España, cercano y motivador, claro y práctico (respuestas breves, listas cortas y **negritas** cuando ayuden).
Ayudas con: explicar temas de cualquier asignatura, resolver dudas y ejercicios paso a paso (explicando el razonamiento, no solo la solución), técnicas de estudio, planificación y organización.
Usa los datos del usuario (abajo) para personalizar. No inventes datos que no estén ahí.
Herramientas: úsalas SOLO cuando pida guardar algo (actividad del horario, tarea con fecha o examen). Días: 0 = lunes … 6 = domingo. Fechas en formato AAAA-MM-DD. Después, resume en una frase lo guardado.
Si notas mucha ansiedad o malestar, sé comprensivo y recomienda hablar con alguien de confianza o un profesional.
Datos actuales del usuario (JSON):
`;
  function aiTools() {
    const subjFor = name => { const n = norm(String(name || '')); if (!n) return null; let s = S.subjects.find(x => norm(x.name) === n) || S.subjects.find(x => norm(x.name).includes(n) || n.includes(norm(x.name))); if (!s) { s = { id: uid(), name: String(name).slice(0, 40), color: '#8b6cff', goalH: 0, exams: [], topics: [] }; S.subjects.push(s); } return s; };
    const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
    return [
      {
        name: 'add_activity',
        description: 'Añade una actividad semanal al horario (se repite los días indicados y avisa antes). Devuelve confirmación.',
        inputSchema: { type: 'object', properties: {
          title: { type: 'string' }, category: { type: 'string', enum: Object.keys(CATS) },
          start: { type: 'string', description: 'HH:MM' }, end: { type: 'string', description: 'HH:MM' },
          days: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 } }, remind_minutes: { type: 'integer' }
        }, required: ['title', 'category', 'start', 'end', 'days'] },
        execute(inp) {
          const hm = /^([01]?\d|2[0-3]):[0-5]\d$/;
          if (!hm.test(String(inp.start)) || !hm.test(String(inp.end))) throw new Error('Horas no válidas');
          const days = [...new Set((inp.days || []).map(Number).filter(d => d >= 0 && d <= 6))];
          if (!days.length) throw new Error('Indica al menos un día');
          const cat = CATS[inp.category] ? inp.category : 'otro';
          const fix = x => (x.length === 4 ? '0' + x : x);
          const b = { id: uid(), title: String(inp.title).slice(0, 80), cat, start: fix(String(inp.start)), end: fix(String(inp.end)), days, remind: Number.isFinite(+inp.remind_minutes) ? clamp(r0(+inp.remind_minutes), -1, 120) : 10, notes: '', routineId: '', subjectId: '' };
          S.blocks.push(b); save();
          AIRUN && AIRUN.actions.push(`Actividad: ${b.title} (${b.start}–${b.end})`);
          return 'Guardado';
        }
      },
      {
        name: 'add_task',
        description: 'Añade una tarea con fecha (deberes, entregas, repasos). Devuelve confirmación.',
        inputSchema: { type: 'object', properties: { title: { type: 'string' }, date: { type: 'string', description: 'AAAA-MM-DD o vacío' }, subject: { type: 'string' } }, required: ['title'] },
        execute(inp) {
          const s = inp.subject ? subjFor(inp.subject) : null;
          const t = { id: uid(), title: String(inp.title).slice(0, 100), date: isDate(inp.date) ? inp.date : '', subjectId: s ? s.id : '', done: false, note: '' };
          S.tasks.push(t); save();
          AIRUN && AIRUN.actions.push(`Tarea: ${t.title}`);
          return 'Guardada';
        }
      },
      {
        name: 'add_exam',
        description: 'Apunta un examen de una asignatura en una fecha. Devuelve confirmación.',
        inputSchema: { type: 'object', properties: { subject: { type: 'string' }, date: { type: 'string', description: 'AAAA-MM-DD' }, title: { type: 'string', description: 'p. ej. Examen, Parcial, Final' } }, required: ['subject', 'date'] },
        execute(inp) {
          if (!isDate(inp.date)) throw new Error('Fecha no válida');
          const s = subjFor(inp.subject);
          s.exams.push({ id: uid(), date: inp.date, title: String(inp.title || 'Examen').slice(0, 40) }); save();
          AIRUN && AIRUN.actions.push(`Examen: ${s.name} (${inp.date})`);
          return 'Guardado';
        }
      }
    ];
  }

  // ---------- flotantes y reloj ----------
  function renderFloating() {
    const box = $('#floating');
    box.innerHTML = '';
    document.body.style.paddingBottom = '';
  }
  function tick() { tickLock(); }

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
    if (['estudio', 'deberes', 'examen'].includes(b.cat)) return `<button class="${cls}" data-act="focusFromBlock" data-sub="${b.subjectId || ''}">🔒 Concentrarme</button>`;
    return '';
  }

  // =====================================================================
  // VISTA: PLAN
  // =====================================================================
  function viewPlan() {
    const seg = `<div class="seg"><button class="${S.planTab !== 'tareas' ? 'on' : ''}" data-act="planTab" data-tab="horario">🗓️ Horario</button><button class="${S.planTab === 'tareas' ? 'on' : ''}" data-act="planTab" data-tab="tareas">✅ Tareas${S.tasks.filter(t => !t.done).length ? ' (' + S.tasks.filter(t => !t.done).length + ')' : ''}</button></div>`;
    if (S.planTab === 'tareas') return seg + viewTasks();
    return seg + viewHorario();
  }
  function viewHorario() {
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
    const extra = b.subjectId ? (S.subjects.find(s => s.id === b.subjectId)?.name || '') : '';
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
      <div id="bfStudy" class="${['estudio', 'clase', 'deberes', 'examen'].includes(cat) ? '' : 'hidden'}"><label for="bfSubject">Asignatura</label>
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
      routineId: '',
      subjectId: ['estudio', 'clase', 'deberes', 'examen'].includes(cat) ? $('#bfSubject').value : ''
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
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Estudio//ES', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Estudio'];
    for (const b of S.blocks) {
      if (!b.days.length) continue;
      const d = new Date(); d.setHours(0, 0, 0, 0);
      for (let i = 0; i < 7 && !b.days.includes(dow(d)); i++) d.setDate(d.getDate() + 1);
      const st = new Date(d); st.setMinutes(toMin(b.start));
      const en = new Date(st.getTime() + Math.max(durMin(b), 5) * 60000);
      const c = CATS[b.cat] || CATS.otro;
      L.push('BEGIN:VEVENT', `UID:${b.id}@estudio`, `DTSTAMP:${stamp}`, `DTSTART:${fmt(st)}`, `DTEND:${fmt(en)}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${[...b.days].sort().map(x => BY[x]).join(',')}`,
        `SUMMARY:${icsEsc(c.icon + ' ' + b.title)}`, `DESCRIPTION:${icsEsc(c.label + (b.notes ? ' — ' + b.notes : ''))}`, `CATEGORIES:${icsEsc(c.label)}`);
      if (b.remind >= 0) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(b.title)}`, `TRIGGER:-PT${b.remind}M`, 'END:VALARM');
      L.push('END:VEVENT');
    }
    L.push('END:VCALENDAR');
    download('estudio-horario.ics', L.join('\r\n'), 'text/calendar');
    toast('Calendario exportado 📅', 'Ábrelo con Google Calendar o el calendario del móvil para importar el plan con sus alarmas.');
  }
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // =====================================================================
  // VISTA: ASISTENTE
  // =====================================================================
  let AIRUN = null; // {ctl, text, actions}
  let aiState = 'pending'; // pending | ready | none
  function mdLite(t) {
    const inline = x => esc(x).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
    const out = []; let list = null;
    for (const raw of String(t).split('\n')) {
      const line = raw.trimEnd();
      const li = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (li) { if (!list) { list = line.trim().match(/^\d/) ? 'ol' : 'ul'; out.push(`<${list}>`); } out.push(`<li>${inline(li[1])}</li>`); continue; }
      if (list) { out.push(`</${list}>`); list = null; }
      const h = line.match(/^#{1,4}\s+(.*)$/);
      if (h) out.push(`<p class="md-h">${inline(h[1])}</p>`);
      else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    }
    if (list) out.push(`</${list}>`);
    return out.join('');
  }
  function viewAsistente() {
    const msgs = S.chat.map(m => m.role === 'user'
      ? `<div class="msg user">${esc(m.content).replace(/\n/g, '<br>')}</div>`
      : `<div class="msg ai ${m.err ? 'err' : ''}">${mdLite(m.content)}${m.actions && m.actions.length ? `<div class="ai-acts">${m.actions.map(a => `<span class="badge ok">✓ ${esc(a)}</span>`).join('')}</div>` : ''}</div>`).join('');
    const live = AIRUN ? `<div class="msg ai" id="aiLive">${AIRUN.text ? mdLite(AIRUN.text) : '<span class="typing"><i></i><i></i><i></i></span> <span class="muted">Pensando…</span>'}</div>` : '';
    const mode = useClaude() ? '✨ Claude' : '⚡ Sin conexión · en tu móvil';
    const empty = !S.chat.length && !AIRUN ? `<div class="card hero"><div style="position:relative;z-index:1"><div class="muted">Asistente personal · ${mode}</div><h2>¿En qué te ayudo${S.settings.name ? ', ' + esc(S.settings.name) : ''}? ✨</h2>
        <div class="muted mt" style="font-size:14px">Conozco tu horario, tareas, exámenes y asignaturas. Puedo organizarte, planificar exámenes, hacerte tests con tus tarjetas y buscar en tus apuntes.</div></div></div>
      <div class="sec-title">Prueba con</div>
      <div class="stack">${SUGGESTIONS.map(q => `<button class="btn block" style="justify-content:flex-start;white-space:normal;text-align:left" data-act="askAI" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : '';
    return `${empty}${S.chat.length || AIRUN ? `<div class="row between mb"><span class="badge">${mode}</span><button class="link" data-act="clearChat">Borrar chat</button></div>` : ''}<div class="chat">${msgs}${live}</div>
      <div class="chatbar"><div class="chatbar-in">
        <textarea id="chatIn" data-in="chatIn" rows="1" maxlength="2000" placeholder="Escribe tu pregunta…">${esc(UI.chatDraft || '')}</textarea>
        ${AIRUN ? '<button class="btn danger" data-act="aiStop" aria-label="Parar">■</button>' : '<button class="btn primary" data-act="aiSend" aria-label="Enviar">➤</button>'}
      </div></div>`;
  }
  function chatTurns(text) {
    const hist = S.chat.filter(m => !m.err).slice(-16).map(m => ({ role: m.role, content: m.content }));
    const turns = [{ role: 'user', content: AI_RULES + aiContext() }, { role: 'assistant', content: 'Entendido. ¿En qué te ayudo?' }, ...hist, { role: 'user', content: text }];
    const out = [];
    for (const t of turns) { if (out.length && out[out.length - 1].role === t.role) out[out.length - 1].content += '\n\n' + t.content; else out.push({ ...t }); }
    return out;
  }
  const chatAtBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 140;
  const chatScroll = () => window.scrollTo(0, document.documentElement.scrollHeight);
  let LOCAL = null;
  function sendLocal(text) {
    S.chat.push({ role: 'user', content: text, ts: Date.now() });
    UI.chatDraft = '';
    AIRUN = { ctl: new AbortController(), text: '', actions: [] };
    render(); chatScroll();
    setTimeout(() => {
      let res;
      try { res = LOCAL.reply(text); } catch (e) { console.error(e); res = { text: 'Ups, algo ha fallado al responder. Prueba a decirlo de otra forma.' }; }
      AIRUN = null;
      S.chat.push({ role: 'assistant', content: res.text, actions: res.actions || [], ts: Date.now() });
      S.chat = S.chat.slice(-40);
      save();
      if (UI.view === 'asistente') { render(); chatScroll(); }
    }, 450);
  }
  async function sendChat(text) {
    text = String(text || '').trim();
    if (!text || AIRUN) return;
    if (!useClaude()) return sendLocal(text);
    const turns = chatTurns(text);
    S.chat.push({ role: 'user', content: text, ts: Date.now() });
    S.chat = S.chat.slice(-40);
    UI.chatDraft = ''; save();
    AIRUN = { ctl: new AbortController(), text: '', actions: [] };
    render(); chatScroll();
    const useTools = !!(SAMPLE_LIMITS && SAMPLE_LIMITS.tools);
    const opts = {
      signal: AIRUN.ctl.signal,
      onText: ({ text: t }) => {
        if (!AIRUN) return;
        AIRUN.text = t;
        const el = $('#aiLive');
        if (el) { const stick = chatAtBottom(); el.innerHTML = mdLite(t); if (stick) chatScroll(); }
      }
    };
    if (useTools) opts.tools = aiTools(); else opts.cache = false;
    const run = AIRUN;
    try {
      const res = await SAMPLE(turns, opts);
      S.chat.push({ role: 'assistant', content: res.text + (res.truncated ? '\n\n*(respuesta cortada: pídemelo por partes)*' : ''), actions: run.actions, ts: Date.now() });
    } catch (e) {
      if (e && e.code === 'cancelled') { if (e.text) S.chat.push({ role: 'assistant', content: e.text + '\n\n*(detenido)*', actions: run.actions, ts: Date.now() }); }
      else S.chat.push({ role: 'assistant', content: (e && e.text && e.code !== 'refused' ? e.text + '\n\n' : '') + '⚠️ ' + aiErrMsg(e), err: true, actions: run.actions, ts: Date.now() });
    }
    AIRUN = null;
    S.chat = S.chat.slice(-40);
    save();
    if (UI.view === 'asistente') { render(); chatScroll(); }
    else toast('✨ Tu asistente ha respondido', 'Toca la pestaña Asistente para verlo.');
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
        <button class="btn block mt" data-act="testNotif">Probar aviso</button>
        <p class="li-sub mt">💡 Los avisos funcionan mientras la app está abierta o en segundo plano. Para recibirlos con la app cerrada, exporta tu horario al calendario.</p>
      </div>
      <div class="sec-title">Asistente</div>
      <div class="card">
        <label for="stEngine" style="margin-top:0">Cómo responde</label>
        <select id="stEngine" data-in="stEngine"><option value="local" ${st.aiEngine !== 'claude' ? 'selected' : ''}>⚡ Sin conexión (en tu móvil, gratis)</option>${aiState === 'ready' ? `<option value="claude" ${st.aiEngine === 'claude' ? 'selected' : ''}>✨ Claude (más completo, usa tu cuenta)</option>` : ''}</select>
        <p class="li-sub">${aiState === 'ready' ? 'Con Claude te explica cualquier tema y resuelve ejercicios; consume uso de tu cuenta de Claude.' : 'El asistente funciona sin internet y sin ninguna cuenta.'}</p>
      </div>
      <div class="sec-title">Actualizaciones</div>
      ${window.APPUPDATE ? APPUPDATE.cardHTML() : ''}
      <div class="sec-title">Datos</div>
      <div class="card">
        <div class="li-sub">Todo se guarda en este dispositivo (${r1(used / 1024)} KB usados).</div>
        <div class="grid2 mt"><button class="btn" data-act="exportJSON">⬇ Exportar copia</button><button class="btn" data-act="importJSON">⬆ Importar copia</button></div>
        <input type="file" accept="application/json,.json" id="importFile" class="hidden">
        <button class="btn block mt" data-act="exportICS">📅 Exportar plan a calendario</button>
        <button class="btn block mt" data-act="clearChat">💬 Borrar conversación del asistente</button>
        <button class="btn danger block mt" data-act="resetAll">Borrar todos los datos</button>
      </div>
      <p class="center dim" style="font-size:12px">Estudio · v<span data-upd-ver>${(window.APPUPDATE && APPUPDATE.version) || '1'}</span></p>`;
  }

  const VIEWS = { hoy: ['Hoy', viewHoy], plan: ['Plan', viewPlan], asignaturas: ['Asignaturas', viewAsignaturas], foco: ['Concentración', viewFoco], asistente: ['Asistente', viewAsistente], ajustes: ['Ajustes', viewAjustes] };
  function render() {
    const [title, fn] = VIEWS[UI.view] || VIEWS.hoy;
    $('#topTitle').textContent = title;
    $('#topDate').textContent = 'Estudio · ' + fmtDate(dkey());
    let html;
    try { html = fn(); } catch (e) {
      console.error(e);
      html = `<div class="card empty"><div class="big">😵</div>Algo ha fallado al mostrar esta sección.<div class="li-sub mt">${esc(e.message)}</div></div>`;
    }
    // Mantener la posición: que nada se mueva al interactuar
    const y = window.scrollY;
    const chipX = $$('#view .chips').map(c => c.scrollLeft);
    $('#view').innerHTML = html;
    $$('#view .chips').forEach((c, i) => { if (chipX[i]) c.scrollLeft = chipX[i]; });
    if (window.scrollY !== y) window.scrollTo(0, y);
    document.body.classList.toggle('has-chatbar', UI.view === 'asistente');
    $$('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.v === UI.view));
    renderFloating();
    renderLock();
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
    testNotif() { notify('Así se verán tus avisos', 'Ej.: En 10 min: Estudiar', 'test'); },
    toggleDone(el) {
      const k = dkey(), id = el.dataset.id;
      const arr = S.done[k] = S.done[k] || [];
      const i = arr.indexOf(id);
      if (i >= 0) arr.splice(i, 1); else arr.push(id);
      save(); render();
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
      $('#bfStudy').classList.toggle('hidden', !['estudio', 'clase', 'deberes', 'examen'].includes(el.dataset.cat));
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
    askAI(el) {
      const q = el.dataset.q;
      if (UI.view !== 'asistente') location.hash = 'asistente';
      setTimeout(() => sendChat(q), 0);
    },
    aiSend() { const t = $('#chatIn'); sendChat(t ? t.value : UI.chatDraft); },
    aiStop() { if (AIRUN) AIRUN.ctl.abort(); },
    clearChat() { confirmBox('Borrar conversación', 'Se borrará el historial del chat con tu asistente.', 'Borrar', () => { S.chat = []; save(); render(); }); },
    setToggle(el) { S.settings[el.dataset.k] = el.checked; save(); if (el.dataset.k === 'notify' && el.checked && 'Notification' in window && Notification.permission === 'default') askNotif(); },
    exportJSON() { download(`estudio-copia-${dkey()}.json`, JSON.stringify(S), 'application/json'); toast('Copia exportada ✅'); },
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
            load(); applyTheme(); render(); toast('Copia importada ✅');
          } catch (e) { toast('No se pudo importar', e.message); }
        };
        rd.readAsText(f);
      };
      inp.click();
    },
    resetAll() {
      confirmBox('Borrar todos los datos', 'Se eliminará tu horario, tareas, asignaturas, apuntes y horas de estudio.', 'Borrar todo', () => {
        try { localStorage.removeItem(KEY); } catch (e) { /* ignorar */ }
        S.focus = null; renderLock(); load(); applyTheme(); location.hash = 'hoy'; render(); toast('Datos borrados');
      });
    },
    // tareas
    planTab(el) { S.planTab = el.dataset.tab; save(); render(); },
    newTask(el) { taskForm({ id: uid(), title: '', date: el.dataset.date || '', subjectId: '', note: '' }, true); },
    editTask(el) { const t = S.tasks.find(x => x.id === el.dataset.id); if (t) taskForm(t, false); },
    saveTask(el) {
      const title = $('#tkTitle').value.trim();
      if (!title) return toast('Escribe la tarea');
      const id = el.dataset.id, old = S.tasks.find(x => x.id === id);
      const t = { id, title, date: $('#tkDate').value, subjectId: $('#tkSub').value, note: $('#tkNote').value.trim(), done: old ? old.done : false };
      if (old) Object.assign(old, t); else S.tasks.push(t);
      save(); closeModal(); render(); toast(old ? 'Tarea guardada ✅' : 'Tarea añadida ✅');
    },
    toggleTask(el) {
      const t = S.tasks.find(x => x.id === el.dataset.id);
      if (!t) return;
      t.done = !t.done; t.doneAt = t.done ? Date.now() : 0;
      save(); render();
      if (t.done) toast('¡Tarea completada! ✅', t.title);
    },
    delTask(el) { S.tasks = S.tasks.filter(x => x.id !== el.dataset.id); save(); closeModal(); render(); },
    focusFromBlock(el) { if (el.dataset.sub) S.fs.subjectId = el.dataset.sub; S.fs.topicId = ''; save(); location.hash = 'foco'; },

    // asignaturas
    openSubject(el) { UI.subj = el.dataset.id; if (UI.view !== 'asignaturas') location.hash = 'asignaturas'; else { render(); window.scrollTo(0, 0); } },
    closeSubject() { UI.subj = ''; render(); window.scrollTo(0, 0); },
    subjectForm(el) { subjectForm(el.dataset.id); },
    sbColor(el) { $('#sbColors').dataset.c = el.dataset.c; $$('#sbColors button').forEach(b => { b.style.borderColor = b === el ? 'var(--text)' : 'transparent'; }); },
    saveSubject(el) {
      const name = $('#sbName').value.trim();
      if (!name) return toast('Escribe el nombre');
      const old = subjectById(el.dataset.id);
      if (old) Object.assign(old, { name, goalH: num($('#sbGoal').value), color: $('#sbColors').dataset.c });
      else S.subjects.push({ id: uid(), name, goalH: num($('#sbGoal').value), color: $('#sbColors').dataset.c, exams: [], topics: [] });
      save(); closeModal(); render();
    },
    delSubject(el) {
      const s = subjectById(el.dataset.id);
      confirmBox('Eliminar asignatura', `Se borrarán los temas, apuntes, tarjetas y exámenes de “${s ? s.name : ''}”. Las horas estudiadas se conservan.`, 'Eliminar', () => {
        S.subjects = S.subjects.filter(x => x.id !== el.dataset.id);
        if (S.fs.subjectId === el.dataset.id) { S.fs.subjectId = ''; S.fs.topicId = ''; }
        UI.subj = ''; save(); render();
      });
    },
    focusSubject(el) { S.fs.subjectId = el.dataset.id; S.fs.topicId = ''; save(); location.hash = 'foco'; },
    examForm(el) {
      openModal(`${mHead('Nuevo examen')}
        <label for="exTitle">Tipo</label><input id="exTitle" maxlength="40" value="Examen" placeholder="Examen, parcial, final…">
        <label for="exDate">Fecha</label><input id="exDate" type="date" min="${dkey()}">
        <div class="m-foot"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="saveExam" data-sid="${el.dataset.sid}">Guardar</button></div>`);
    },
    saveExam(el) {
      const s = subjectById(el.dataset.sid), date = $('#exDate').value;
      if (!s) return closeModal();
      if (!date) return toast('Elige la fecha del examen');
      s.exams.push({ id: uid(), date, title: $('#exTitle').value.trim() || 'Examen' });
      save(); closeModal(); render(); toast('Examen apuntado 📝', 'Pídele al asistente “planifica el examen de ' + s.name.toLowerCase() + '”.');
    },
    delExam(el) { const s = subjectById(el.dataset.sid); if (s) { s.exams = s.exams.filter(e => e.id !== el.dataset.id); save(); render(); } },
    addTopic(el) {
      const s = subjectById(el.dataset.sid), inp = $('#newTopic');
      const title = inp ? inp.value.trim() : '';
      if (!s || !title) return toast('Escribe el nombre del tema');
      s.topics.push({ id: uid(), title: title.slice(0, 80), status: 'pendiente', notes: '', cards: [] });
      save(); render();
      const n = $('#newTopic'); if (n && !matchMedia('(pointer:coarse)').matches) n.focus();
    },
    cycleStatus(el) {
      const t = topicById(subjectById(el.dataset.sid), el.dataset.id);
      if (!t) return;
      const i = STATUS.findIndex(x => x[0] === t.status);
      t.status = STATUS[(i + 1) % STATUS.length][0]; save(); render();
    },
    setStatus(el) { const t = topicById(subjectById(el.dataset.sid), el.dataset.id); if (t) { t.status = el.dataset.st; save(); topicModal(el.dataset.sid, el.dataset.id); } },
    openTopic(el) { topicModal(el.dataset.sid, el.dataset.id); },
    delTopic(el) {
      const s = subjectById(el.dataset.sid);
      confirmBox('Eliminar tema', 'Se borrarán sus apuntes y tarjetas.', 'Eliminar', () => { if (s) s.topics = s.topics.filter(t => t.id !== el.dataset.id); save(); render(); });
    },
    addCard(el) {
      const t = topicById(subjectById(el.dataset.sid), el.dataset.id);
      const q = $('#cardQ').value.trim(), a = $('#cardA').value.trim();
      if (!t) return;
      if (!q || !a) return toast('Escribe la pregunta y la respuesta');
      t.cards.push({ q, a }); save(); topicModal(el.dataset.sid, el.dataset.id);
      setTimeout(() => { const i = $('#cardQ'); if (i) { i.scrollIntoView({ block: 'center' }); if (!matchMedia('(pointer:coarse)').matches) i.focus(); } }, 30);
    },
    delCard(el) { const t = topicById(subjectById(el.dataset.sid), el.dataset.id); if (t) { t.cards.splice(+el.dataset.i, 1); save(); topicModal(el.dataset.sid, el.dataset.id); } },
    startReview(el) {
      const t = topicById(subjectById(el.dataset.sid), el.dataset.id);
      if (!t || !t.cards.length) return;
      const order = t.cards.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      REV = { sid: el.dataset.sid, tid: el.dataset.id, order, i: 0, show: false, ok: 0 };
      renderReview();
    },
    revShow() { REV.show = true; renderReview(); },
    revAnswer(el) {
      const t = topicById(subjectById(REV.sid), REV.tid);
      const ok = el.dataset.ok === '1';
      if (t) t.cards[REV.order[REV.i]].known = ok;
      if (ok) REV.ok++;
      REV.i++; REV.show = false; save(); renderReview();
    },

    // concentración
    fsSet(el) { S.fs[el.dataset.k] = +el.dataset.v; save(); render(); },
    fsStrict(el) { S.fs.strict = el.checked; save(); },
    focusStart() { startFocus(); },
    lockFull() { enterFullscreen(); setTimeout(() => { lockSig = ''; renderLock(); }, 400); },
    lockSkipBreak() { if (S.focus && S.focus.phase === 'break') { S.focus.endAt = Date.now(); phaseEnd(); } },
    blockGuide() { guideModal(); },
    guideOs(el) { guideModal(el.dataset.os); },
    studyManual() {
      openModal(`${mHead('Registrar estudio')}
        <label for="smSub">Asignatura</label><select id="smSub"><option value="">General</option>${S.subjects.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
        <div class="grid2"><div><label for="smMin">Minutos</label><input id="smMin" type="number" inputmode="numeric" value="60" min="1"></div><div><label for="smDate">Fecha</label><input id="smDate" type="date" value="${dkey()}" max="${dkey()}"></div></div>
        <div class="m-foot"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="saveStudy">Guardar</button></div>`);
    },
    saveStudy() {
      const m = num($('#smMin').value), d = $('#smDate').value || dkey();
      if (!(m > 0)) return toast('Minutos no válidos');
      S.studyLog.push({ id: uid(), date: d, subjectId: $('#smSub').value, min: r0(m), ts: Date.now(), mode: 'manual' });
      save(); closeModal(); render();
    },
    delStudy(el) { S.studyLog = S.studyLog.filter(l => l.id !== el.dataset.id); save(); render(); }
  };

  // --- inputs ---
  const IN = {
    stName(el) { S.settings.name = el.value.trim(); save(); },
    stTheme(el) { S.settings.theme = el.value; save(); applyTheme(); },
    stEngine(el) { S.settings.aiEngine = el.value === 'claude' ? 'claude' : 'local'; save(); },
    chatIn(el) { UI.chatDraft = el.value; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px'; },
    fsSub(el) { S.fs.subjectId = el.value; S.fs.topicId = ''; save(); render(); },
    fsTopic(el) { S.fs.topicId = el.value; save(); },
    fsMin(el) { const v = r0(num(el.value)); if (v >= 1 && v <= 240) { S.fs.min = v; save(); } },
    tpField(el) { const t = topicById(subjectById(el.dataset.sid), el.dataset.id); if (t) { t[el.dataset.f] = el.dataset.f === 'title' ? (el.value.trim() || t.title) : el.value; save(); } }
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
    if (e.key === 'Enter' && e.target.id === 'newTopic') { const b = $('[data-act=addTopic]'); if (b) A.addTopic(b); }
    if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'chatIn' && !matchMedia('(pointer:coarse)').matches) { e.preventDefault(); A.aiSend(); }
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


  // Mantener pulsado para abandonar el modo concentración
  let holdTimer = null;
  const holdStop = () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } $$('.hold.holding').forEach(b => b.classList.remove('holding')); };
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-hold]');
    if (!b || !S.focus) return;
    e.preventDefault();
    holdStop();
    b.classList.add('holding');
    holdTimer = setTimeout(() => { holdTimer = null; b.classList.remove('holding'); if (S.focus) finishFocus(false); }, (S.focus.strict ? 5 : 2) * 1000);
  });
  document.addEventListener('pointerup', holdStop, true);
  document.addEventListener('pointercancel', holdStop, true);
  document.addEventListener('contextmenu', e => { if (e.target.closest('[data-hold]')) e.preventDefault(); });
  document.addEventListener('visibilitychange', onVisibility);
  // Botón atrás de Android: no deja salir durante la sesión
  window.addEventListener('popstate', () => {
    if (S.focus && S.focus.strict) { try { history.pushState({ lock: 1 }, ''); } catch (e) { /* ignorar */ } toast('🔒 Estás en modo concentración', 'Termina la sesión o mantén pulsado “abandonar”.'); }
  });
  window.addEventListener('beforeunload', e => { if (S.focus && S.focus.phase === 'focus') { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('fullscreenchange', () => { lockSig = ''; renderLock(); });

  // ---------- arranque ----------
  load();
  initAI();
  LOCAL = window.EstudioLocalAI({
    S: () => S, save, uid, norm, pad, r0, r1, clamp, num, DAYS, DAYS_S, CATS,
    dkey, addDays, parseKey, dow, nowMin, toMin, durMin, fmtH, fmtDate, weekStart, blocksFor, streak,
    startFocus: opts => setTimeout(() => startFocus(opts), 600)
  });
  applyTheme();
  { const v = location.hash.slice(1); UI.view = VIEWS[v] ? v : 'hoy'; }
  render();
  if (S.focus) { keepAwake(); try { history.pushState({ lock: 1 }, ''); } catch (e) { /* ignorar */ } }
  setInterval(tick, 1000);
  setInterval(checkReminders, 15000);
  setTimeout(checkReminders, 1500);
  if ('serviceWorker' in navigator && window.isSecureContext && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then(r => { swReg = r; }).catch(() => { /* sin modo offline */ });
  }
})();
