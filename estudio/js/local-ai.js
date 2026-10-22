/* Asistente local de Estudio: funciona sin conexión y sin servicios externos.
   Entiende frases en español sobre horario, tareas, exámenes, temas y técnicas
   de estudio, y hace tests con las tarjetas del usuario. */
'use strict';
window.EstudioLocalAI = function createLocalAI(api) {
  const { norm, pad, r0, r1, clamp, num, uid, DAYS, DAYS_S, CATS } = api;

  // ---------- utilidades de lenguaje ----------
  const WORD_NUM = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, medio: 0.5, media: 0.5 };
  const DAY_RE = '(lunes|martes|miercoles|jueves|viernes|sabado|domingo)';
  const DAY_IDX = { lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4, sabado: 5, domingo: 6 };
  const has = (t, re) => re.test(t);
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const fmtMin = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
  const listJoin = arr => arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1];

  function parseDays(t) {
    const today = api.dow();
    if (has(t, /todos los dias|cada dia|a diario|diariamente/)) return [0, 1, 2, 3, 4, 5, 6];
    if (has(t, /entre semana|laborables|de lunes a viernes/)) return [0, 1, 2, 3, 4];
    if (has(t, /fines? de semana/)) return [5, 6];
    const range = t.match(new RegExp(`de ${DAY_RE} a ${DAY_RE}`));
    if (range) {
      const a = DAY_IDX[range[1]], b = DAY_IDX[range[2]], out = [];
      for (let i = a; ; i = (i + 1) % 7) { out.push(i); if (i === b || out.length > 7) break; }
      return out;
    }
    const days = new Set();
    for (const m of t.matchAll(new RegExp(`\\b${DAY_RE}s?\\b`, 'g'))) days.add(DAY_IDX[m[1]]);
    if (has(t, /pasado manana/)) days.add((today + 2) % 7);
    else if (has(t, /(?<!(la|por la|de la|esta|cada) )\bmanana\b/)) days.add((today + 1) % 7);
    if (has(t, /\bhoy\b|esta tarde|esta noche|esta manana/)) days.add(today);
    return [...days].sort((a, b) => a - b);
  }

  // Convierte "17", "17:30", "5 y media" + contexto (tarde/noche) a minutos
  function toMinutes(h, m, ctx) {
    h = +h; m = +(m || 0);
    if (/noche/.test(ctx) && h >= 7 && h < 12) h += 12;
    else if (/tarde/.test(ctx) && h < 12) h += 12;
    else if (!/manana|madrugada/.test(ctx) && h >= 1 && h <= 6) h += 12;
    return clamp(h, 0, 23) * 60 + clamp(m, 0, 59);
  }
  function parseTimes(t) {
    const H = '(\\d{1,2})(?:[:.h](\\d{2}))?(?: y (media|cuarto))?';
    const frac = x => x === 'media' ? 30 : x === 'cuarto' ? 15 : 0;
    const ctxOf = idx => t.slice(idx, idx + 40);
    let m = t.match(new RegExp(`(?:de|desde)(?: las?)? ${H} (?:a|hasta)(?: las?)? ${H}`));
    if (m) {
      const ctx = ctxOf(m.index);
      let s = toMinutes(m[1], m[2] || frac(m[3]), ctx), e = toMinutes(m[4], m[5] || frac(m[6]), ctx);
      if (e <= s && e + 720 > s && e < 720) e += 720;
      return { start: s, end: Math.min(e, 1439) };
    }
    m = t.match(new RegExp(`a las? ${H}`));
    if (!m) return null;
    const start = toMinutes(m[1], m[2] || frac(m[3]), ctxOf(m.index));
    return { start, end: Math.min(start + parseDuration(t), 1439) };
  }
  function parseDuration(t) {
    if (has(t, /hora y media/)) return 90;
    if (has(t, /media hora/)) return 30;
    let m = t.match(/(\d+(?:[.,]\d+)?|una|dos|tres|cuatro|cinco)\s*(?:h\b|horas?)/);
    if (m) return r0((WORD_NUM[m[1]] || num(m[1])) * 60);
    m = t.match(/(\d+)\s*(?:min|minutos?)/);
    if (m) return +m[1];
    return 60;
  }

  const CAT_WORDS = [
    ['examen', /\bexamen|control|parcial/],
    ['clase', /\bclases?\b|instituto|universidad|academia|tutoria/],
    ['deberes', /deberes|tarea|ejercicios de|trabajo de/],
    ['estudio', /estudi|repas|apuntes|selectividad|memoriz/],
    ['gym', /\bgym\b|gimnasio|entrenar|entreno|deporte|futbol|baloncesto|correr|nadar|pesas/],
    ['comida', /\bcomer\b|comida|cenar|\bcena\b|desayun|merend|almorz/],
    ['descanso', /dormir|siesta|descansar/],
    ['ocio', /jugar|play|serie|pelicula|salir|amigos|quedar|videojuego/],
    ['rutina', /ducha|meditar|leer|pasear|caminar|aseo|limpiar|ordenar|estirar/]
  ];
  const catOf = t => (CAT_WORDS.find(([, re]) => re.test(t)) || ['otro'])[0];
  function titleFrom(raw, cat) {
    const low = raw.toLowerCase();
    const m = low.match(/(?:estudiar|repasar|leer|hacer|practicar|ir a(?:l)?|tengo|clase de|examen de)\s+([a-záéíóúñü][a-záéíóúñü ]{2,40}?)(?=\s+(?:el|los|las|de|a|desde|entre|todos|cada|hoy|mañana|por|durante|\d)|[,.!?]|$)/);
    if (m) {
      const verb = low.match(/estudiar|repasar|leer|practicar/);
      const what = m[1].trim().replace(/^(a las?|a|el|la|los|las|de|del|un|una|unos|unas)(\s+|$)/, '').trim();
      if (what && !/^(las?|los|el)$/.test(what)) return cap((verb ? verb[0] + ' ' : '') + what);
      if (verb) return cap(verb[0]);
    }
    const lone = raw.toLowerCase().match(/\b(leer|meditar|pasear|correr|caminar|estudiar|repasar|dormir|ducharme|cocinar|limpiar|ordenar|estirar)\b/);
    if (lone) return cap(lone[1] === 'ducharme' ? 'ducha' : lone[1]);
    const subj = api.S().subjects.find(s => norm(raw).includes(norm(s.name)));
    if (subj) return `Estudiar ${subj.name}`;
    return CATS[cat].label;
  }

  // ---------- horario ----------
  function addActivity(raw, t) {
    const times = parseTimes(t);
    if (!times) return null;
    let days = parseDays(t);
    if (!days.length) days = [api.dow()];
    const cat = catOf(t);
    const title = titleFrom(raw, cat);
    const S = api.S();
    const subj = cat === 'estudio' ? S.subjects.find(s => norm(raw).includes(norm(s.name))) : null;
    const remindM = t.match(/(?:avisa|avisame|recuerdame|aviso)[^\d]*(\d+)\s*min/);
    const b = { id: uid(), title, cat, start: fmtMin(times.start), end: fmtMin(times.end), days, remind: remindM ? +remindM[1] : 10, notes: '', routineId: '', subjectId: subj ? subj.id : '' };
    S.blocks.push(b); api.save();
    const dayTxt = days.length === 7 ? 'todos los días' : days.length === 5 && days.every((d, i) => d === i) ? 'de lunes a viernes' : listJoin(days.map(d => DAYS[d].toLowerCase()));
    return {
      text: `¡Hecho! He añadido **${CATS[cat].icon} ${title}** de **${b.start} a ${b.end}** (${dayTxt}). Te avisaré ${b.remind} min antes.\n\nPuedes cambiarlo cuando quieras desde la pestaña **Plan**.`,
      actions: [`Actividad: ${title} (${b.start}–${b.end}, ${days.map(d => DAYS_S[d]).join(' ')})`]
    };
  }

  function planFor(day) {
    const S = api.S(), k = api.dkey();
    const blocks = api.blocksFor(day);
    const isToday = day === api.dow();
    if (!blocks.length) return `No tienes nada planificado el **${DAYS[day].toLowerCase()}**. Puedes decirme, por ejemplo: *“añade estudiar inglés el ${DAYS[day].toLowerCase()} de 17 a 19”*.`;
    const nm = api.nowMin(), done = isToday ? (S.done[k] || []) : [];
    const shown = isToday ? blocks.filter(b => !done.includes(b.id) && api.toMin(b.start) + api.durMin(b) > nm) : blocks;
    const lines = (shown.length ? shown : blocks).map(b => {
      const s = api.toMin(b.start), e = s + api.durMin(b);
      const now = isToday && nm >= s && nm < e;
      const mark = done.includes(b.id) ? '✅' : now ? '👉' : isToday && e <= nm ? '⏺️' : '▫️';
      return `- ${mark} **${b.start}–${b.end}** ${CATS[b.cat]?.icon || ''} ${b.title}${now ? ' **(ahora)**' : ''}`;
    });
    let head = isToday ? `**Hoy, ${DAYS[day].toLowerCase()}**` : `**El ${DAYS[day].toLowerCase()}**`;
    if (isToday) {
      const cur = blocks.find(b => { const s = api.toMin(b.start); return nm >= s && nm < s + api.durMin(b); });
      const next = blocks.find(b => api.toMin(b.start) > nm);
      head += cur ? ` — ahora toca **${cur.title}** hasta las ${cur.end}.` : next ? ` — lo siguiente es **${next.title}** a las ${next.start} (en ${api.fmtH(api.toMin(next.start) - nm)}).` : ' — ya has terminado el plan de hoy. 🎉';
      const left = blocks.filter(b => !done.includes(b.id) && api.toMin(b.start) + api.durMin(b) > nm).length;
      head += left ? ` Te quedan ${left} ${left === 1 ? 'actividad' : 'actividades'}:` : '';
      if (!left) return head;
    }
    return `${head}\n\n${lines.join('\n')}`;
  }

  // ---------- fechas ----------
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  // Devuelve una fecha (AAAA-MM-DD) mencionada en el texto, o null
  function parseDate(t) {
    const today = api.dkey();
    if (/pasado manana/.test(t)) return api.addDays(today, 2);
    if (/(?<!(la|por la|de la|esta|cada) )\bmanana\b/.test(t)) return api.addDays(today, 1);
    if (/\bhoy\b|esta tarde|esta noche/.test(t)) return today;
    let m = t.match(/\ben (\d+|un|una|dos|tres|cuatro|cinco|seis|siete|diez|quince) (dias?|semanas?)\b/);
    if (m) return api.addDays(today, (WORD_NUM[m[1]] || +m[1]) * (/semana/.test(m[2]) ? 7 : 1));
    if (/semana que viene|proxima semana/.test(t) && !new RegExp(DAY_RE).test(t)) return api.addDays(today, 7);
    m = t.match(new RegExp(`(\\d{1,2})(?: de)? (${MONTHS.join('|')})(?: de (\\d{4}))?`));
    if (m) return fixYear(+m[1], MONTHS.indexOf(m[2]) + 1, m[3]);
    m = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
    if (m && +m[2] >= 1 && +m[2] <= 12) return fixYear(+m[1], +m[2], m[3]);
    m = t.match(new RegExp(`(?:el |este |proximo |el proximo |el que viene )?${DAY_RE}( que viene)?`));
    if (m) {
      const target = DAY_IDX[m[1]], cur = api.dow();
      let diff = (target - cur + 7) % 7;
      if (diff === 0) diff = 7; // "el lunes" dicho un lunes = el de la semana que viene
      return api.addDays(today, diff);
    }
    m = t.match(/\bel (\d{1,2})\b(?! de la| y)/);
    if (m && +m[1] >= 1 && +m[1] <= 31) {
      const d = new Date(); let y = d.getFullYear(), mo = d.getMonth() + 1;
      if (+m[1] < d.getDate()) { mo++; if (mo > 12) { mo = 1; y++; } }
      return `${y}-${pad(mo)}-${pad(+m[1])}`;
    }
    return null;
  }
  function fixYear(d, mo, y) {
    const now = new Date();
    let year = y ? (+y < 100 ? 2000 + +y : +y) : now.getFullYear();
    let k = `${year}-${pad(mo)}-${pad(d)}`;
    if (!y && k < api.dkey()) k = `${year + 1}-${pad(mo)}-${pad(d)}`;
    return k;
  }
  const fmtDay = k => {
    const diff = Math.round((api.parseKey(k) - api.parseKey(api.dkey())) / 864e5);
    const base = api.fmtDate(k, { weekday: 'long', day: 'numeric', month: 'long' });
    return diff === 0 ? `hoy (${base})` : diff === 1 ? `mañana (${base})` : base;
  };
  const daysTo = k => Math.round((api.parseKey(k) - api.parseKey(api.dkey())) / 864e5);

  // ---------- asignaturas ----------
  function findSubject(t) {
    const subs = api.S().subjects;
    let best = subs.find(s => t.includes(norm(s.name)));
    if (best) return best;
    // coincidencia parcial: "mates" -> "Matemáticas", "lengua" -> "Lengua castellana"
    const ALIAS = { mates: 'matematicas', mate: 'matematicas', fisica: 'fisica', quimica: 'quimica', biologia: 'biologia', bio: 'biologia', ingles: 'ingles', historia: 'historia', lengua: 'lengua', filo: 'filosofia', eco: 'economia', geo: 'geografia', tecno: 'tecnologia', dibujo: 'dibujo', frances: 'frances', aleman: 'aleman' };
    for (const w of t.split(/[^a-z0-9]+/)) {
      if (w.length < 3) continue;
      const target = ALIAS[w] || w;
      best = subs.find(s => { const n = norm(s.name); return n.startsWith(target.slice(0, 4)) || n.split(' ').some(x => x.length > 3 && x.startsWith(target.slice(0, 5))); });
      if (best) return best;
    }
    return null;
  }
  function subjectNameAfterDe(raw) {
    const m = raw.toLowerCase().match(/(?:examen|control|prueba|parcial|final|global|recuperaci[oó]n|trabajo|deberes|tarea|exposici[oó]n)\s+(?:de|del|sobre)\s+([a-záéíóúñü]+(?:\s+[a-záéíóúñü]+)?)/);
    if (!m) return null;
    const words = m[1].split(/\s+/).filter(w => !['el', 'la', 'lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado', 'domingo', 'mañana', 'hoy', 'para', 'que'].includes(w));
    return words.length ? cap(words[0]) : null;
  }
  function ensureSubject(name) {
    const S = api.S();
    let s = S.subjects.find(x => norm(x.name) === norm(name));
    if (!s) {
      const colors = ['#8b6cff', '#5ec8ff', '#2fd18b', '#ffb547', '#ff5c7a', '#f472b6', '#a3e635', '#94a3b8'];
      s = { id: uid(), name, color: colors[S.subjects.length % colors.length], goalH: 0, exams: [], topics: [] };
      S.subjects.push(s);
    }
    return s;
  }
  const statusLabel = st => ({ pendiente: '⚪ Pendiente', estudiando: '🟡 Estudiando', repasado: '🔵 Repasado', dominado: '🟢 Dominado' }[st] || st);

  // ---------- tareas y exámenes ----------
  function addTask(raw, t) {
    const date = parseDate(t);
    const sub = findSubject(t);
    let title = raw.replace(/^\s*(?:a[nñ]ade(?:me)?|apunta(?:me)?|recu[eé]rdame(?: que)?|pon(?:me)?|tengo que|crea(?:me)?|nueva tarea:?)\s*/i, '')
      .replace(/\s*(?:para |el |este |antes del? )?(?:hoy|mañana|pasado mañana|el (?:próximo |proximo )?(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)|\d{1,2}(?: de)? (?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|en \d+ d[ií]as|la semana que viene)\b.*$/i, '')
      .replace(/^(?:una |la )?tarea:?\s*(?:de |para )?/i, '').trim();
    if (!title) title = sub ? `Deberes de ${sub.name}` : 'Tarea';
    const task = { id: uid(), title: cap(title).slice(0, 100), date: date || '', subjectId: sub ? sub.id : '', done: false, note: '' };
    api.S().tasks.push(task); api.save();
    return { text: `Apuntado ✅ **${task.title}**${date ? ` para **${fmtDay(date)}**` : ' (sin fecha)'}${sub ? ` · ${sub.name}` : ''}.\n\nLa verás en **Hoy** y en **Plan → Tareas**.`, actions: [`Tarea: ${task.title}${date ? ' (' + api.fmtDate(date, { day: 'numeric', month: 'short' }) + ')' : ''}`] };
  }
  function listTasks() {
    const S = api.S(), today = api.dkey();
    const pend = S.tasks.filter(x => !x.done).sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1);
    if (!pend.length) return '¡No tienes tareas pendientes! 🎉 Añade una diciendo por ejemplo *“tengo que entregar el trabajo de historia el viernes”*.';
    const subName = id => S.subjects.find(s => s.id === id)?.name;
    return `**Tus tareas pendientes:**\n\n${pend.slice(0, 15).map(x => `- ${x.date && x.date < today ? '⚠️ ' : ''}**${x.title}**${x.date ? ` — ${fmtDay(x.date)}` : ''}${subName(x.subjectId) ? ` · ${subName(x.subjectId)}` : ''}`).join('\n')}${pend.length > 15 ? `\n\n…y ${pend.length - 15} más.` : ''}`;
  }
  function addExam(raw, t) {
    const date = parseDate(t);
    let sub = findSubject(t);
    if (!sub) { const n = subjectNameAfterDe(raw); if (n) sub = ensureSubject(n); }
    if (!sub) return { text: '¿De qué asignatura es el examen? Dímelo así: *“tengo examen de historia el 12 de noviembre”*.' };
    if (!date) return { text: `¿Qué día es el examen de **${sub.name}**? Por ejemplo: *“examen de ${sub.name.toLowerCase()} el 12 de noviembre”*.` };
    const kind = (t.match(/\b(parcial|final|global|recuperacion|control|exposicion|oral|test)\b/) || [])[1];
    const exam = { id: uid(), date, title: kind ? cap(kind === 'recuperacion' ? 'recuperación' : kind === 'exposicion' ? 'exposición' : kind) : 'Examen' };
    sub.exams = sub.exams || []; sub.exams.push(exam); api.save();
    const d = daysTo(date);
    return { text: `📝 Apuntado: **${exam.title} de ${sub.name}** el **${fmtDay(date)}**${d > 0 ? ` (faltan ${d} días)` : ''}.\n\n¿Quieres que te organice el estudio hasta ese día? Dime *“planifica el examen de ${sub.name.toLowerCase()}”*.`, actions: [`Examen: ${sub.name} (${api.fmtDate(date, { day: 'numeric', month: 'short' })})`] };
  }
  function nextExams() {
    const S = api.S(), today = api.dkey();
    const list = [];
    for (const s of S.subjects) for (const e of s.exams || []) if (e.date >= today) list.push({ s, e });
    list.sort((a, b) => a.e.date < b.e.date ? -1 : 1);
    if (!list.length) return 'No tienes exámenes apuntados. Añádelos diciendo *“tengo examen de inglés el 20 de noviembre”* o desde **Asignaturas**.';
    return `**Tus próximos exámenes:**\n\n${list.slice(0, 10).map(({ s, e }) => { const d = daysTo(e.date); const left = (s.topics || []).filter(x => x.status !== 'dominado').length; return `- **${e.title} de ${s.name}** — ${fmtDay(e.date)} · ${d === 0 ? '**¡hoy!**' : d === 1 ? '**¡mañana!**' : `faltan **${d} días**`}${(s.topics || []).length ? ` · ${left} ${left === 1 ? 'tema' : 'temas'} sin dominar` : ''}`; }).join('\n')}`;
  }

  // Reparte los temas pendientes en tareas diarias hasta el examen
  function planExam(raw, t) {
    const S = api.S(), today = api.dkey();
    let sub = findSubject(t);
    if (!sub) {
      const withExam = S.subjects.map(s => ({ s, e: (s.exams || []).filter(e => e.date >= today).sort((a, b) => a.date < b.date ? -1 : 1)[0] })).filter(x => x.e).sort((a, b) => a.e.date < b.e.date ? -1 : 1);
      if (!withExam.length) return { text: 'Para planificarte necesito la fecha del examen. Dime por ejemplo *“tengo examen de historia el 12 de noviembre”* y luego *“planifica el examen de historia”*.' };
      sub = withExam[0].s;
    }
    const exam = (sub.exams || []).filter(e => e.date >= today).sort((a, b) => a.date < b.date ? -1 : 1)[0];
    if (!exam) return { text: `No tengo la fecha del examen de **${sub.name}**. Dímela: *“examen de ${sub.name.toLowerCase()} el 15 de noviembre”*.` };
    const start = api.nowMin() < 1200 ? today : api.addDays(today, 1);
    const days = [];
    for (let d = start; d < exam.date && days.length < 60; d = api.addDays(d, 1)) days.push(d);
    const order = { pendiente: 0, estudiando: 1, repasado: 2, dominado: 3 };
    const topics = (sub.topics || []).filter(x => x.status !== 'dominado').sort((a, b) => order[a.status] - order[b.status]);
    if (!days.length) {
      const task = { id: uid(), title: `Repaso final de ${sub.name}`, date: today, subjectId: sub.id, done: false, note: '' };
      S.tasks.push(task); api.save();
      return { text: `¡El examen de **${sub.name}** es ${daysTo(exam.date) === 0 ? 'hoy' : 'mañana'}! Te he puesto un **repaso final** para hoy.\n\nConsejos:\n- Repasa esquemas y tus tarjetas, no aprendas nada nuevo.\n- Haz un examen de prueba cronometrado.\n- Duerme bien esta noche. ¡Mucho ánimo! 💪`, actions: [`Tarea: Repaso final de ${sub.name}`] };
    }
    const reserve = days.length >= 3 ? 1 : 0;
    const learn = days.slice(0, days.length - reserve);
    const plan = days.map(d => ({ d, items: [] }));
    if (topics.length) {
      topics.forEach((tp, i) => plan[Math.floor(i * learn.length / topics.length)].items.push(`${tp.status === 'pendiente' ? 'Estudiar' : 'Repasar'}: ${tp.title}`));
      // días libres: repaso de los temas ya vistos
      let r = 0;
      for (let i = 0; i < learn.length; i++) if (!plan[i].items.length && i > 0) plan[i].items.push(`Repaso: ${topics[(r++) % topics.length].title}`);
    } else {
      learn.forEach((d, i) => plan[i].items.push(`Estudiar ${sub.name} (parte ${i + 1} de ${learn.length})`));
    }
    if (reserve) plan[plan.length - 1].items.push('Repaso general + examen de prueba');
    const existing = new Set(S.tasks.map(x => x.date + '|' + x.title));
    const created = [];
    for (const p of plan) for (const it of p.items) {
      const title = `${sub.name} · ${it}`;
      if (existing.has(p.d + '|' + title)) continue;
      S.tasks.push({ id: uid(), title, date: p.d, subjectId: sub.id, done: false, note: '' });
      created.push(title);
    }
    api.save();
    return {
      text: `📅 **Plan para el ${exam.title.toLowerCase()} de ${sub.name}** (${fmtDay(exam.date)}):\n\n${plan.filter(p => p.items.length).map(p => `- **${api.fmtDate(p.d, { weekday: 'short', day: 'numeric', month: 'short' })}**: ${p.items.join(' · ')}`).join('\n')}\n\nTe he creado ${created.length} tareas; las verás cada día en **Hoy**.${topics.length ? '' : `\n\n💡 Añade los temas de ${sub.name} en **Asignaturas** y te haré un plan tema a tema.`}`,
      actions: created.length ? [`${created.length} tareas para ${sub.name}`] : []
    };
  }

  function addTopic(raw, t) {
    const sub = findSubject(t);
    const m = raw.match(/tema\s+(.+?)(?:\s+(?:a|en|de|para)\s+(?:la asignatura de\s+)?[A-Za-zÁÉÍÓÚÑáéíóúñ]+\s*$|$)/i);
    if (!sub) return { text: '¿A qué asignatura lo añado? Por ejemplo: *“añade el tema Revolución francesa a historia”*.' };
    let title = m ? m[1].trim().replace(/^(el|la)\s+/i, '') : '';
    title = title.replace(new RegExp(`\\s+(a|en|de)\\s+${sub.name}$`, 'i'), '').trim();
    if (!title) return { text: `¿Cómo se llama el tema? Por ejemplo: *“añade el tema 3 Ecuaciones a ${sub.name.toLowerCase()}”*.` };
    sub.topics = sub.topics || [];
    sub.topics.push({ id: uid(), title: cap(title).slice(0, 80), status: 'pendiente', notes: '', cards: [] });
    api.save();
    return { text: `Añadido el tema **${cap(title)}** a **${sub.name}** ✅. Puedes escribir apuntes y tarjetas de repaso dentro del tema en **Asignaturas**.`, actions: [`Tema: ${cap(title)} (${sub.name})`] };
  }
  function listTopics(t) {
    const sub = findSubject(t);
    const S = api.S();
    const subs = sub ? [sub] : S.subjects;
    if (!subs.length) return 'Aún no tienes asignaturas. Créalas en **Asignaturas**.';
    return subs.map(s => `**${s.name}**${(s.topics || []).length ? '\n' + s.topics.map(x => `- ${statusLabel(x.status)} — ${x.title}${(x.cards || []).length ? ` (${x.cards.length} tarjetas)` : ''}`).join('\n') : ' — sin temas todavía'}`).join('\n\n');
  }

  // ---------- test con las tarjetas del usuario ----------
  let QUIZ = null;
  function startQuiz(t) {
    const S = api.S();
    const sub = findSubject(t);
    let cards = [];
    for (const s of sub ? [sub] : S.subjects) for (const tp of s.topics || []) {
      (tp.cards || []).forEach((c, i) => cards.push({ s, tp, i, q: c.q, a: c.a }));
    }
    const topicHit = cards.filter(c => t.includes(norm(c.tp.title)));
    if (topicHit.length) cards = topicHit;
    if (!cards.length) return { text: `${sub ? `**${sub.name}** no tiene` : 'No tienes'} tarjetas de repaso todavía. Ve a **Asignaturas → tema → Tarjetas** y añade preguntas con su respuesta; luego dime *“pregúntame de ${sub ? sub.name.toLowerCase() : 'historia'}”*.` };
    for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    QUIZ = { cards: cards.slice(0, 10), i: 0, ok: 0 };
    return { text: `🧠 **Test${sub ? ' de ' + sub.name : ''}** — ${QUIZ.cards.length} preguntas. Responde con tus palabras (o escribe *“no sé”*; *“terminar”* para salir).\n\n**1.** ${QUIZ.cards[0].q}` };
  }
  function quizAnswer(raw, t) {
    if (/^(terminar|termina|salir|parar|para|stop|fin|basta|acabar)\b/.test(t)) {
      const r = QUIZ; QUIZ = null;
      return { text: `Test terminado: **${r.ok} de ${r.i}** correctas.` };
    }
    const c = QUIZ.cards[QUIZ.i];
    const STOPW = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'que', 'un', 'una', 'por', 'con', 'para', 'se', 'es', 'al', 'lo', 'su', 'sus', 'o']);
    const words = s => norm(s).split(/[^a-z0-9]+/).filter(w => w.length > 1 && !STOPW.has(w));
    const key = words(c.a), ans = new Set(words(raw));
    const hit = key.filter(w => ans.has(w) || [...ans].some(x => x.length > 4 && (x.startsWith(w.slice(0, 5)) || w.startsWith(x.slice(0, 5))))).length;
    const ok = !/^no (lo )?se\b/.test(t) && key.length > 0 && (hit / key.length >= 0.5 || norm(c.a).includes(norm(raw).trim()) && norm(raw).trim().length > 2);
    const card = c.tp.cards[c.i];
    if (card) card.known = ok;
    if (ok) QUIZ.ok++;
    QUIZ.i++;
    api.save();
    let out = ok ? `✅ **¡Correcto!**${norm(raw).trim() !== norm(c.a).trim() ? ` Respuesta completa: ${c.a}` : ''}` : `❌ La respuesta era: **${c.a}**`;
    if (QUIZ.i >= QUIZ.cards.length) {
      const r = QUIZ; QUIZ = null;
      const pct = r.ok / r.cards.length;
      out += `\n\n🏁 **Resultado: ${r.ok} de ${r.cards.length}** ${pct >= 0.8 ? '¡Genial! 🎉' : pct >= 0.5 ? '¡Bien! Repasa las que fallaste.' : 'Sigue repasando, ¡tú puedes! 💪'}`;
    } else out += `\n\n**${QUIZ.i + 1}.** ${QUIZ.cards[QUIZ.i].q}`;
    return { text: out };
  }

  // ---------- búsqueda en apuntes ----------
  function searchNotes(term) {
    const S = api.S();
    const q = norm(term).replace(/^(el|la|los|las|un|una|sobre|de|del)\s+/, '').trim();
    if (q.length < 3) return null;
    const words = q.split(/\s+/).filter(w => w.length > 2);
    const hits = [];
    for (const s of S.subjects) for (const tp of s.topics || []) {
      const hay = norm(tp.title + ' ' + (tp.notes || ''));
      const score = words.filter(w => hay.includes(w)).length + (norm(tp.title).includes(q) ? 2 : 0);
      if (score) {
        const notes = tp.notes || '';
        const idx = norm(notes).indexOf(words[0]);
        const snip = notes ? (idx >= 0 ? (idx > 60 ? '…' : '') + notes.slice(Math.max(0, idx - 60), idx + 160) + (idx + 160 < notes.length ? '…' : '') : notes.slice(0, 200)) : '';
        hits.push({ score, text: `**${s.name} › ${tp.title}**${snip ? '\n' + snip.replace(/\n+/g, ' ') : ''}` });
      }
      for (const c of tp.cards || []) if (words.some(w => norm(c.q + ' ' + c.a).includes(w))) hits.push({ score: 1, text: `**${s.name} › ${tp.title}** (tarjeta)\n${c.q} → ${c.a}` });
    }
    if (!hits.length) return null;
    hits.sort((a, b) => b.score - a.score);
    return `Esto es lo que tienes en tus apuntes sobre **${term.trim()}**:\n\n${hits.slice(0, 5).map(h => '- ' + h.text).join('\n')}`;
  }

  // ---------- estadísticas de estudio ----------
  function studyStats() {
    const S = api.S(), k = api.dkey(), wk = api.weekStart();
    const today = S.studyLog.filter(l => l.date === k).reduce((a, l) => a + l.min, 0);
    const week = S.studyLog.filter(l => l.date >= wk);
    const total = week.reduce((a, l) => a + l.min, 0);
    const leaves = week.filter(l => l.mode === 'focus');
    const rows = S.subjects.map(s => { const m = week.filter(l => l.subjectId === s.id).reduce((a, l) => a + l.min, 0); return `- ${s.name}: **${api.fmtH(m)}**${s.goalH ? ` de ${s.goalH} h (${r0(m / (s.goalH * 60) * 100)}%)` : ''}`; });
    const behind = S.subjects.filter(s => s.goalH && week.filter(l => l.subjectId === s.id).reduce((a, l) => a + l.min, 0) < s.goalH * 60 * 0.5);
    return `**Tu estudio**\n- Hoy: **${api.fmtH(today)}**\n- Esta semana: **${api.fmtH(total)}**\n- Racha: **${api.streak() === 1 ? '1 día' : api.streak() + ' días seguidos'}**\n${leaves.length ? `- Sesiones de concentración: **${leaves.length}** (media de ${r1(leaves.reduce((a, l) => a + (l.leaves || 0), 0) / leaves.length)} salidas)\n` : ''}${rows.length ? '\n' + rows.join('\n') : ''}${behind.length ? `\n\nVas por detrás en **${listJoin(behind.map(s => s.name))}**. ¿Empezamos? Di *“empieza a estudiar ${behind[0].name.toLowerCase()} 50 minutos”*.` : ''}`;
  }

  function startFocusFromText(raw, t) {
    const sub = findSubject(t);
    const m = t.match(/(\d+)\s*(?:min|minutos?)/) || t.match(/(\d+(?:[.,]\d)?)\s*(?:h\b|horas?)/);
    let min = 25;
    if (m) min = /h|hora/.test(m[0]) ? r0(num(m[1]) * 60) : +m[1];
    if (/hora y media/.test(t)) min = 90; else if (/media hora/.test(t)) min = 30; else if (/una hora/.test(t)) min = 60;
    min = clamp(min, 5, 240);
    api.startFocus({ subjectId: sub ? sub.id : '', min });
    return { text: `🔒 **Modo concentración activado**: ${min} min${sub ? ` de ${sub.name}` : ''}. ¡A por ello!` };
  }

  function calc(t) {
    let m = t.match(/(\d+(?:[.,]\d+)?)\s*% de (\d+(?:[.,]\d+)?)/);
    if (m) return `El ${m[1]}% de ${m[2]} es **${r1(num(m[1]) * num(m[2]) / 100)}**.`;
    const expr = t.replace(/cuanto es|calcula|cuanto son|resultado de|\?|=/g, '').replace(/\bx\b|×/g, '*').replace(/÷/g, '/').replace(/,/g, '.').replace(/\bmas\b/g, '+').replace(/\bmenos\b/g, '-').replace(/\bpor\b/g, '*').replace(/entre|dividido/g, '/').trim();
    if (!/^[\d\s+\-*/().]+$/.test(expr) || !/\d\s*[+\-*/]\s*[\d(]/.test(expr)) return null;
    try {
      const v = Function(`"use strict";return (${expr})`)();
      if (typeof v === 'number' && Number.isFinite(v)) return `${expr.replace(/\*/g, '×')} = **${Math.round(v * 1e6) / 1e6}**`;
    } catch (e) { /* no es una operación */ }
    return null;
  }

  // ---------- conocimientos de estudio ----------
  const KB = [
    [['pomodoro'], () => '**Técnica Pomodoro**: 25 min de concentración total + 5 min de descanso. Cada 4 ciclos, un descanso largo de 15–30 min.\n\nEn **Concentración** elige 25 min y 4 ciclos con descanso de 5: la app te bloquea durante el foco y te avisa en cada descanso.'],
    [['estudiar mejor', 'estudio mejor', 'tecnicas de estudio', 'tecnica de estudio', 'como estudiar', 'como estudio', 'metodo de estudio', 'aprender mas', 'rendir mas'], () => '**Técnicas de estudio que funcionan**:\n1. **Recuerdo activo**: cierra los apuntes y explica o escribe lo que recuerdas.\n2. **Repaso espaciado**: repasa al día siguiente, a los 3 días y a la semana.\n3. **Practica** con ejercicios y exámenes antiguos.\n4. **Bloques sin distracciones** con el modo concentración.\n5. **Intercala** temas o asignaturas.\n\nSubrayar y releer es lo que menos rinde. Usa las **tarjetas** de cada tema y dime *“pregúntame de …”*.'],
    [['memoriz', 'memoria', 'recordar', 'aprenderme', 'aprender de memoria', 'fechas', 'vocabulario', 'se me olvida'], () => '**Para memorizar**:\n- **Tarjetas** pregunta–respuesta y repásalas en días alternos (sistema Leitner: lo que fallas, más a menudo).\n- **Palacio de la memoria**: asocia cada dato a un lugar de tu casa.\n- **Acrónimos y frases** con las iniciales.\n- **Explícalo en voz alta** como si se lo enseñaras a alguien.\n- Repasa justo antes de dormir y otra vez al despertar.'],
    [['concentr', 'distraigo', 'distraccion', 'me distraigo', 'movil', 'redes sociales', 'instagram', 'tiktok'], () => '**Para concentrarte**:\n- Móvil en otra habitación o en **modo concentración** del sistema (mira la guía en la pestaña Concentración).\n- Una sola tarea y un objetivo concreto por bloque (*“hacer 10 ejercicios del tema 4”*).\n- Bloques de 25–50 min con descansos reales (levántate, bebe agua).\n- Mesa despejada y música sin letra o silencio.\n- Empieza por lo más difícil cuando tengas más energía.'],
    [['examen', 'examenes', 'selectividad', 'evau', 'pau', 'preparar un examen', 'prepararme'], () => '**Cómo preparar un examen**:\n1. Apunta la fecha (*“tengo examen de historia el 12 de noviembre”*).\n2. Añade los temas en **Asignaturas**.\n3. Dime *“planifica el examen de historia”* y te reparto los temas día a día.\n4. Deja el último día para **repaso general y examen de prueba**.\n5. Duerme bien la noche anterior: el sueño fija lo aprendido.'],
    [['ansiedad', 'nervios', 'estres', 'agobio', 'agobiado', 'estresado', 'me bloqueo', 'quedo en blanco'], () => 'Es normal sentir nervios. Lo que ayuda:\n- **Respiración 4-7-8**: inspira 4 s, aguanta 7 s, suelta 8 s (×4).\n- Practica con **exámenes de prueba** cronometrados: reduce la incertidumbre.\n- En el examen, empieza por la pregunta que mejor sabes.\n- Si te quedas en blanco: respira, pasa a otra y vuelve después.\n- Duerme, come y muévete: el cuerpo también estudia.\n\nSi la ansiedad no se va o te desborda, habla con alguien de confianza, tu tutor o un profesional. Y si alguna vez te sientes al límite, en España tienes el **024** (gratis, 24 h).'],
    [['procrastin', 'motivacion', 'pereza', 'no tengo ganas', 'constancia', 'disciplina', 'motivar', 'no me apetece'], () => '**Contra la procrastinación**:\n- **Regla de los 2 minutos**: empieza solo 2 minutos; lo difícil es arrancar.\n- Divide la tarea en pasos pequeños y concretos.\n- Pon una hora en el **Plan** y deja que la app te avise.\n- Activa el **modo concentración** para no poder escaparte al móvil.\n- Celebra cada sesión: mira tu racha en **Hoy**.\n\nLa motivación va y viene; los hábitos se quedan. 💪'],
    [['resumen', 'resumir', 'esquema', 'mapa mental', 'mapas mentales', 'mapa conceptual'], () => '**Resúmenes y esquemas**:\n- Primero lee el tema entero sin subrayar.\n- Haz un **esquema** con las ideas principales y sus relaciones (no copies frases).\n- Un **mapa mental**: idea central en medio y ramas con palabras clave y colores.\n- Escribe tus esquemas en las **notas del tema** para buscarlos luego desde el asistente.'],
    [['apuntes', 'tomar apuntes', 'cornell'], () => '**Método Cornell para apuntes**:\n- Columna derecha (grande): apuntes de clase.\n- Columna izquierda: preguntas y palabras clave.\n- Abajo: resumen en 2–3 frases.\n\nLuego tapa la derecha y responde las preguntas de la izquierda: recuerdo activo. Puedes pasar esas preguntas a **tarjetas** del tema.'],
    [['tarjetas', 'flashcards', 'leitner', 'repaso espaciado', 'repetir'], () => '**Tarjetas de repaso**: en **Asignaturas → tema** añade preguntas con su respuesta. Luego:\n- Pulsa **Repasar** en el tema, o\n- Dime *“pregúntame de historia”* y te hago un test.\n\nRepasa más a menudo las que fallas y espacia las que ya sabes (1, 3, 7 y 14 días).'],
    [['cuantas horas', 'cuanto estudiar', 'horas al dia', 'horas de estudio al dia'], () => 'No hay un número mágico: **2–4 horas de estudio de calidad** al día suele rendir más que 8 a medias. Mejor:\n- Bloques de 50 min con 10 de descanso.\n- Objetivos semanales por asignatura (ponlos en **Asignaturas**).\n- Más tiempo a lo que peor llevas y a lo que tiene examen antes.'],
    [['horario', 'organiz', 'planificar', 'planificarme', 'productividad', 'productivo'], () => '**Para organizarte**:\n1. Pon en **Plan** lo fijo: clases, comidas, deporte, descanso.\n2. Añade **bloques de estudio** en los huecos (mejor siempre a la misma hora).\n3. Apunta **tareas con fecha** (deberes, entregas) y **exámenes**.\n4. Cada mañana mira **Hoy**; cada noche marca ✓ lo hecho.\n\nPuedo hacerlo por ti: *“añade estudiar inglés de lunes a jueves de 17 a 18”*.'],
    [['dormir', 'sueno', 'insomnio', 'trasnochar', 'noche antes'], () => 'El sueño **fija la memoria**: dormir 7–9 h rinde más que estudiar de madrugada.\n- Evita pantallas 30–60 min antes de dormir.\n- Nada de cafeína por la tarde.\n- La noche antes del examen: repaso ligero y a la cama.'],
    [['cafe', 'cafeina', 'energetica', 'red bull', 'monster'], () => 'La cafeína (1–2 cafés) puede ayudar a concentrarte, pero no después de media tarde porque empeora el sueño, que es cuando se consolida lo estudiado. Las bebidas energéticas, mejor evitarlas.'],
    [['descanso', 'descansos', 'cada cuanto descansar', 'pausas'], () => '**Descansos**: 5–10 min cada 25–50 min de estudio, y uno largo (20–30 min) cada 2 horas. Levántate, estira, bebe agua y no cojas el móvil (te engancha). El modo concentración te avisa cuando toca.'],
    [['musica'], () => '**Música para estudiar**: mejor **sin letra** (lo-fi, clásica, sonidos de lluvia) y a volumen bajo. Para memorizar o leer textos difíciles, el silencio suele funcionar mejor.'],
    [['en grupo', 'con amigos', 'companeros'], () => '**Estudiar en grupo** funciona para resolver dudas y explicaros temas (explicar es de lo mejor para aprender). Hacedlo **después** de haber estudiado cada uno por su cuenta y con un objetivo claro.'],
    [['matematicas', 'mates', 'problemas', 'ejercicios de fisica', 'fisica', 'quimica'], () => '**Mates, física y química**:\n- La teoría se entiende **haciendo ejercicios**: muchos y variados.\n- Primero ejemplos resueltos, luego tú solo sin mirar la solución.\n- Apunta en las notas del tema tus **errores típicos**.\n- Mezcla ejercicios de distintos temas antes del examen.'],
    [['idioma', 'ingles', 'frances', 'aleman', 'listening', 'speaking', 'vocabulario en ingles'], () => '**Idiomas**:\n- Vocabulario en **tarjetas** (frase de ejemplo incluida).\n- 15–20 min **cada día** rinden más que 2 h un día.\n- Escucha series o pódcast con subtítulos en el idioma.\n- Habla en voz alta: describe lo que haces o grábate.'],
    [['tipo test', 'examen test', 'preguntas test'], () => '**Exámenes tipo test**:\n- Lee todas las opciones antes de responder.\n- Descarta las claramente falsas.\n- Ojo con “siempre/nunca”: suelen ser falsas.\n- Si restan las incorrectas, no contestes al azar si dudas entre más de dos.'],
    [['desarrollo', 'redactar', 'preguntas largas'], () => '**Preguntas de desarrollo**:\n- Haz un mini esquema antes de escribir.\n- Introducción breve, ideas en párrafos y conclusión.\n- Usa el vocabulario técnico de la asignatura.\n- Vigila el tiempo: reparte los minutos según la puntuación.'],
    [['exposicion', 'presentacion', 'oral', 'hablar en publico'], () => '**Exposiciones orales**:\n- Guion con 3–5 ideas clave, no un texto para leer.\n- Ensaya en voz alta y cronométrate 2–3 veces.\n- Diapositivas con poco texto e imágenes.\n- Mira al público y haz pausas; hablar despacio transmite seguridad.'],
    [['leer', 'lectura', 'comprension lectora', 'comprender'], () => '**Lectura comprensiva**:\n1. Vistazo general: títulos, negritas, imágenes.\n2. Lee por párrafos y resume cada uno en una frase.\n3. Hazte preguntas: ¿qué quiere decir?, ¿por qué?\n4. Al final, explica el texto sin mirarlo.'],
    [['bloquear', 'bloqueo', 'bloquear apps', 'bloquear aplicaciones'], () => 'En la pestaña **Concentración** la app se pone a pantalla completa, mantiene la pantalla encendida y te avisa al momento si te sales.\n\nPara **bloquear de verdad** otras apps usa el sistema del móvil (pulsa **“Bloquear las apps del móvil”** en esa pestaña):\n- **Android**: Bienestar digital → *Modo Concentración* pausa las apps que elijas.\n- **iPhone**: *Concentración* + *Tiempo de uso* + un *Atajo* que te devuelve a Estudio si abres Instagram o TikTok.']
  ];
  function knowledge(t) {
    let best = null, score = 0;
    for (const [keys, fn] of KB) {
      const s = keys.reduce((a, k) => a + (t.includes(k) ? k.length : 0), 0);
      if (s > score) { score = s; best = fn; }
    }
    return best ? best() : null;
  }

  const HELP = () => `¡Hola${api.S().settings.name ? ', ' + api.S().settings.name : ''}! 👋 Soy tu asistente de estudio y funciono **sin internet**. Puedo:\n\n- 📅 **Tu día**: *“¿qué me toca ahora?”*, *“¿qué tengo el martes?”*\n- ➕ **Horario**: *“añade estudiar inglés de lunes a jueves de 17 a 18”*\n- ✅ **Tareas**: *“tengo que entregar el trabajo de historia el viernes”*, *“¿qué tareas tengo?”*\n- 📝 **Exámenes**: *“tengo examen de mates el 12 de noviembre”*, *“planifica el examen de mates”*\n- 📚 **Temas**: *“añade el tema Ecuaciones a matemáticas”*, *“¿qué temas me quedan de historia?”*\n- 🧠 **Test** con tus tarjetas: *“pregúntame de historia”*\n- 🔎 **Tus apuntes**: *“busca fotosíntesis”*\n- 🔒 **Concentración**: *“empieza a estudiar física 50 minutos”*\n- 💡 **Técnicas**: memorizar, concentrarse, exámenes, organizarse…`;

  // ---------- respuesta principal ----------
  function reply(raw) {
    const t = norm(raw).replace(/[¿¡]/g, '').replace(/\s+/g, ' ').trim();
    if (!t) return { text: HELP() };
    if (QUIZ) return quizAnswer(raw, t);
    if (/^(gracias|muchas gracias|mil gracias|genial|perfecto|vale|ok|okey|guay)\b/.test(t) && t.length < 30) return { text: '¡De nada! 😊 ¡A por ello!' };

    const c = calc(t);
    if (c) return { text: c };

    if (/(preguntame|examiname|hazme (un )?(test|examen|preguntas)|ponme a prueba|repasar tarjetas|repasa conmigo|quiz)/.test(t)) return startQuiz(t);
    if (/(empieza|empezar|comienza|inicia|activa|pon|ponme|arranca)\b.*(concentracion|a estudiar|el foco|bloqueo|modo estudio|pomodoro)/.test(t)) return startFocusFromText(raw, t);
    if (/(planifica|planificame|organiza|organizame|preparame|plan de estudio|plan para)\b.*(examen|control|parcial|final|global|recuperacion)/.test(t)) return planExam(raw, t);
    if (/(tengo|hay|apunta|anade|pon)\b.*\b(examen|control|parcial|final|global|recuperacion|exposicion)\b/.test(t) && parseDate(t)) return addExam(raw, t);
    if (/\b(anade|apunta|crea|pon|mete)\b.*\btema\b/.test(t)) return addTopic(raw, t);
    if (/(que|cuales|mis) temas|temas (me quedan|pendientes|tengo)/.test(t)) return { text: listTopics(t) };
    if (/(proximo examen|proximos examenes|que examenes|cuando (es|son|tengo) (el|los|mi|mis)? ?examen|mis examenes|examenes tengo)/.test(t)) return { text: nextExams() };
    if (/(que tareas|mis tareas|tareas pendientes|que deberes|deberes pendientes|tengo deberes|que tengo que (hacer|entregar))/.test(t)) return { text: listTasks() };

    const times = parseTimes(t);
    const addVerb = /\b(anade|anademe|pon|ponme|agenda|programa|recuerdame|planifica|organiza|organizame|apunta|apuntame|crea|creame|mete|quiero|tengo que)\b/.test(t);
    if (addVerb && times) { const a = addActivity(raw, t); if (a) return a; }
    if (addVerb && (/\b(tarea|deberes|entregar|entrega|trabajo|ejercicios|hacer|terminar|acabar|leer|repasar|estudiar)\b/.test(t) || parseDate(t))) return addTask(raw, t);

    if (/(que (me )?toca|que tengo|que hago|mi dia|mi horario|mi agenda|mi plan|que me queda|siguiente actividad|lo siguiente|planes? (de|para))/.test(t)) {
      const days = parseDays(t);
      return { text: planFor(days.length ? days[0] : api.dow()) };
    }
    if (/(cuanto he estudiado|horas de estudio|mi estudio|tiempo de estudio|como voy|mi racha|estadisticas)/.test(t)) return { text: studyStats() };

    const sm = t.match(/(?:busca|buscar|buscame|que (?:tengo )?apuntado (?:sobre|de)|mis apuntes (?:sobre|de)|que dicen mis apuntes (?:sobre|de))\s+(.+)/);
    if (sm) return { text: searchNotes(sm[1]) || `No encuentro nada sobre **${sm[1]}** en tus apuntes. Escribe notas dentro de cada tema en **Asignaturas** y podré buscarlas.` };

    const k = knowledge(t);
    if (k) return { text: k };
    if (/^(hola|buenas|hey|ey|holi|que tal|buenos dias|buenas tardes|buenas noches)\b|que puedes hacer|ayuda|como funcionas|quien eres/.test(t)) return { text: HELP() };

    const em = t.match(/(?:explicame|que es|que son|quien fue|quien era|define|definicion de|resumeme|hablame de|como funciona)\s+(?:el |la |los |las |un |una )?(.+)/);
    const term = em ? em[1] : t;
    if (em) { const rm = raw.replace(/[¿?¡!]/g, '').match(/(?:expl[ií]came|qu[eé] es|qu[eé] son|qui[eé]n fue|qui[eé]n era|define|definici[oó]n de|res[uú]meme|h[aá]blame de|c[oó]mo funciona)\s+(?:el |la |los |las |un |una )?(.+)/i); if (rm) em[1] = rm[1].trim(); }
    const notes = searchNotes(term);
    if (notes) return { text: notes };
    return { text: `${em ? `No tengo internet para explicarte **${em[1]}** en el modo sin conexión 🤔.` : 'Uy, eso no lo sé responder sin conexión 🤔.'}\n\nLo que sí puedo:\n- Buscar en **tus apuntes** (escríbelos dentro de cada tema).\n- Hacerte un **test** con tus tarjetas.\n- Organizarte tareas, exámenes y horario.\n\nSi abres Estudio desde claude.ai y eliges **Claude** en Ajustes, te explico cualquier tema.` };
  }

  return { reply, inQuiz: () => !!QUIZ };
};
