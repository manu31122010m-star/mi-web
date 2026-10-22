/* Asistente local de FOCUS: funciona sin conexión y sin servicios externos.
   Entiende frases en español, consulta los datos del usuario y puede crear
   actividades, rutinas y registrar comidas. */
'use strict';
window.FocusLocalAI = function createLocalAI(api) {
  const { norm, slug, pad, r0, r1, clamp, num, uid, DAYS, DAYS_S, CATS, MEALS } = api;

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
    ['estudio', /estudi|repas|deberes|examen|tarea|apuntes|clase|selectividad|ejercicios de/],
    ['gym', /\bgym\b|gimnasio|entrenar|entreno|pesas|crossfit/],
    ['comida', /\bcomer\b|comida|cenar|\bcena\b|desayun|merend|almorz/],
    ['descanso', /dormir|siesta|descansar/],
    ['trabajo', /trabaj|reunion|oficina/],
    ['ocio', /jugar|play|serie|pelicula|salir|amigos|quedar|videojuego/],
    ['rutina', /ducha|meditar|leer|pasear|caminar|correr|aseo|limpiar|ordenar|estirar/]
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

  // ---------- intenciones ----------
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

  const GROUP_WORDS = [
    [/pecho|pectoral/, ['Pecho']],
    [/espalda|dorsal/, ['Espalda']],
    [/hombro|deltoide/, ['Hombros']],
    [/biceps/, ['Bíceps y antebrazos']],
    [/triceps/, ['Tríceps']],
    [/brazo/, ['Bíceps y antebrazos', 'Tríceps']],
    [/cuadriceps/, ['Cuádriceps y piernas']],
    [/isquio|femoral/, ['Isquiotibiales']],
    [/gluteo|culo|cadera/, ['Glúteos y abductores']],
    [/gemelo/, ['Gemelos']],
    [/pierna|tren inferior/, ['Cuádriceps y piernas', 'Isquiotibiales', 'Glúteos y abductores', 'Gemelos']],
    [/abdominal|abdomen|\babs\b|core/, ['Abdominales y core']],
    [/cardio/, ['Cardio']],
    [/empuje|push/, ['Pecho', 'Hombros', 'Tríceps']],
    [/tiron|pull/, ['Espalda', 'Bíceps y antebrazos']],
    [/torso|tren superior/, ['Pecho', 'Espalda', 'Hombros']],
    [/full ?body|cuerpo completo|todo el cuerpo/, ['Pecho', 'Espalda', 'Cuádriceps y piernas', 'Isquiotibiales', 'Hombros', 'Abdominales y core']]
  ];
  const GROUP_MAIN = { 'Glúteos y abductores': 'glutes', 'Cuádriceps y piernas': 'quads', 'Isquiotibiales': 'hamstrings', 'Espalda': 'lats', 'Bíceps y antebrazos': 'biceps', 'Hombros': 'delts' };
  function createRoutine(raw, t) {
    const groups = [];
    for (const [re, gs] of GROUP_WORDS) if (re.test(t)) for (const g of gs) if (!groups.includes(g)) groups.push(g);
    if (!groups.length) groups.push('Pecho', 'Espalda', 'Cuádriceps y piernas', 'Isquiotibiales', 'Hombros', 'Abdominales y core');
    const goal = has(t, /fuerza/) ? 'fuerza' : has(t, /resistencia|definir|definicion|tonificar/) ? 'resistencia' : 'hipertrofia';
    const scheme = { fuerza: [4, 6, 150], hipertrofia: [3, 10, 90], resistencia: [3, 15, 60] }[goal];
    const S = api.S(), EX = api.EX();
    const perGroup = g => {
      if (groups.length === 1) return g === 'Cardio' ? 2 : 5;
      if (g === 'Gemelos' || g === 'Cardio' || g === 'Abdominales y core') return 1;
      return groups.length === 2 ? 3 : 2;
    };
    const offset = S.routines.length;
    const exercises = [];
    for (const g of groups) {
      const main = GROUP_MAIN[g];
      const pool = Object.values(EX).filter(e => e.group === g && api.exAvail(e.id))
        .map((e, i) => ({ e, i, k: main && (e.primary || []).includes(main) ? 0 : 1 })).sort((a, b) => a.k - b.k || a.i - b.i).map(x => x.e);
      if (!pool.length) continue;
      const n = Math.min(perGroup(g), pool.length);
      // los dos primeros (compuestos) siempre; el resto rota para variar
      const picked = pool.slice(0, Math.min(2, n));
      const rest = pool.slice(2);
      for (let i = 0; picked.length < n && rest.length; i++) picked.push(rest.splice((offset + i) % rest.length, 1)[0]);
      for (const e of picked) {
        const cardio = e.type === 'cardio';
        exercises.push({ exId: e.id, sets: cardio ? 1 : scheme[0], reps: cardio ? 20 : (g === 'Gemelos' || g === 'Abdominales y core' ? Math.max(scheme[1], 15) : scheme[1]), kg: '', rest: cardio ? 0 : scheme[2] });
      }
    }
    if (!exercises.length) return { text: 'No he encontrado ejercicios disponibles para esos músculos. Revisa en **Gym → Material** que tengas marcadas las máquinas de tu gimnasio.' };
    let days = parseDays(t);
    if (!days.length) days = [api.dow()];
    const short = groups.length >= 6 ? 'Full body' : groups.length === 4 && groups.includes('Gemelos') ? 'Pierna' : listJoin(groups.map(g => g.split(' ')[0]));
    const name = `${short}${goal !== 'hipertrofia' ? ' · ' + goal : ''}`;
    const colors = ['#ff5c7a', '#5ec8ff', '#2fd18b', '#8b6cff', '#ffb547', '#f472b6'];
    const r = { id: uid(), name, color: colors[S.routines.length % 6], days, exercises };
    S.routines.push(r); api.save();
    const lines = exercises.map(e => `- **${EX[e.exId].name}** — ${EX[e.exId].type === 'cardio' ? e.reps + ' min' : `${e.sets} × ${e.reps}`}`);
    return {
      text: `Te he creado la rutina **${name}** para ${listJoin(days.map(d => DAYS[d].toLowerCase()))}:\n\n${lines.join('\n')}\n\nDescanso entre series: **${scheme[2]} s**. La tienes en **Gym → Rutinas**; puedes cambiar ejercicios, series o kilos desde **Editar**.`,
      actions: [`Rutina: ${name} (${days.map(d => DAYS_S[d]).join(' ')})`]
    };
  }

  function mealFrom(t) {
    if (has(t, /desayun/)) return 'desayuno';
    if (has(t, /media manana|almuerzo/)) return 'mediamanana';
    if (has(t, /merend/)) return 'merienda';
    if (has(t, /cena|cenado|cenar/)) return 'cena';
    if (has(t, /snack|picoteo|picar/)) return 'snack';
    if (has(t, /\bcomida\b|al mediodia|a mediodia/)) return 'comida';
    if (has(t, /he comido|me he comido/) && api.nowMin() >= 720) return api.nowMin() < 1080 ? 'comida' : api.guessMeal();
    return api.guessMeal();
  }
  const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'un', 'una', 'unos', 'unas', 'y', 'al', 'en', 'para', 'mi', 'he', 'comido', 'tomado', 'cenado', 'desayunado', 'merendado', 'apunta', 'anade', 'registra', 'me', 'sobre', 'mas', 'poco', 'plato', 'racion', 'vaso', 'taza', 'trozo', 'gramos', 'g', 'gr', 'ml', 'kg', 'desayuno', 'comida', 'cena', 'merienda', 'snack', 'hoy', 'ahora']);
  function findFood(part) {
    const words = norm(part).split(/[^a-z0-9%]+/).filter(w => w.length > 2 && !STOP.has(w));
    if (!words.length) return null;
    let best = null, bestScore = 0;
    for (const f of api.allFoods()) {
      const fw = norm(f.name).split(/[^a-z0-9%]+/).filter(Boolean);
      let score = 0;
      for (const w of words) {
        const stem = w.replace(/(es|s)$/, '');
        if (fw.some(x => x === w || x.replace(/(es|s)$/, '') === stem)) score += 3;
        else if (fw.some(x => x.startsWith(stem) || stem.startsWith(x) && x.length > 3)) score += 1.5;
      }
      if (fw[0] && words.some(w => fw[0].startsWith(w.replace(/(es|s)$/, '')))) score += 1;
      score -= fw.length * 0.05;
      const nn = norm(f.name);
      if (!/crud/.test(part) && /crud/.test(nn)) score -= 0.6;
      if (/cocid|plancha/.test(nn)) score += 0.3;
      if (score > bestScore) { bestScore = score; best = f; }
    }
    return bestScore >= 2.5 ? best : null;
  }
  function logFood(raw, t) {
    const body = t.replace(/^.*?(he comido|me he comido|he cenado|he desayunado|he merendado|he almorzado|he tomado|me he tomado|apunta(?:me)?|registra|anade|anademe)\s*/, '');
    const parts = body.split(/,|\by\b|\bcon\b|\+|\bmas\b/).map(s => s.trim()).filter(Boolean);
    const meal = mealFrom(t);
    const done = [], missing = [];
    for (const part of parts) {
      const food = findFood(part);
      if (!food) { if (norm(part).replace(/[^a-z]/g, '').length > 2) missing.push(part); continue; }
      let g = food.portion?.g || 100;
      let m = part.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilos?|g\b|gr\b|gramos?|ml|l\b|litros?)/);
      if (m) g = num(m[1]) * (/^(kg|kilo|l|litro)/.test(m[2]) ? 1000 : 1);
      else if ((m = part.match(/^(\d+(?:[.,]\d+)?)\b/) || part.match(/\b(\d+(?:[.,]\d+)?)\s+[a-z]/))) g = num(m[1]) * (food.portion?.g || 100);
      else if ((m = part.match(/\b(un|una|uno|dos|tres|cuatro|cinco|seis|medio|media)\b/))) g = WORD_NUM[m[1]] * (food.portion?.g || 100);
      g = clamp(r0(g), 1, 3000);
      api.addEntry(api.dkey(), meal, food, g);
      const n = api.scaleN(food.n, g);
      done.push({ name: food.name, g, n });
    }
    if (!done.length) return null;
    api.save();
    const tot = done.reduce((a, d) => ({ kcal: a.kcal + d.n.kcal, p: a.p + d.n.p }), { kcal: 0, p: 0 });
    return {
      text: `Apuntado en **${api.mealName(meal)}**:\n\n${done.map(d => `- **${d.name}** · ${d.g} g → ${r0(d.n.kcal)} kcal, ${r1(d.n.p)} g proteína`).join('\n')}\n\nTotal: **${r0(tot.kcal)} kcal** y **${r0(tot.p)} g de proteína**.${missing.length ? `\n\nNo he encontrado: *${missing.join(', ')}*. Puedes añadirlo desde **Comidas → Buscar** o **Crear**.` : ''}`,
      actions: done.map(d => `${api.mealName(meal)}: ${d.name} ${d.g} g`)
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

  const PROTEIN_FOODS = ['Pechuga de pollo a la plancha', 'Atún al natural (lata)', 'Skyr / yogur proteico', 'Huevo entero', 'Queso fresco batido 0%', 'Proteína whey en polvo', 'Lentejas cocidas', 'Pechuga de pavo (fiambre)'];
  function macros() {
    const S = api.S(), g = S.goals, t = api.dayTotals(api.dkey());
    const left = { kcal: g.kcal - t.kcal, p: g.p - t.p, c: g.c - t.c, f: g.f - t.f };
    let out = `**Hoy llevas:**\n- 🔥 ${r0(t.kcal)} / ${g.kcal} kcal\n- 🥩 Proteína: ${r0(t.p)} / ${g.p} g\n- 🍚 Carbohidratos: ${r0(t.c)} / ${g.c} g\n- 🥑 Grasas: ${r0(t.f)} / ${g.f} g\n- 🌾 Fibra: ${r0(t.fib)} / ${g.fib} g\n\n`;
    out += left.kcal >= 0 ? `Te quedan **${r0(left.kcal)} kcal**.` : `Te has pasado **${r0(-left.kcal)} kcal** del objetivo.`;
    if (left.p > 15) {
      const ideas = PROTEIN_FOODS.map(n => api.allFoods().find(f => f.name === n)).filter(Boolean).slice(0, 4)
        .map(f => `${f.name} (${f.portion.label}: ${r0(f.n.p * f.portion.g / 100)} g prot.)`);
      out += ` Para llegar a la proteína te faltan **${r0(left.p)} g**. Ideas: ${listJoin(ideas)}.`;
    } else if (t.p >= g.p * 0.9) out += ' ¡La proteína va genial! 💪';
    if (t.fib < 20 && t.kcal > 600) out += '\n\nVas algo bajo de fibra: añade fruta, verdura, legumbres o avena.';
    if (t.sug > 50) out += `\n\nOjo con el azúcar: llevas ${r0(t.sug)} g.`;
    return out;
  }

  const MEAL_IDEAS = {
    desayuno: [
      ['Porridge de avena con plátano y proteína', [['Copos de avena', 50], ['Leche semidesnatada', 200], ['Plátano', 120], ['Proteína whey en polvo', 30]]],
      ['Tostadas integrales con huevos revueltos y tomate', [['Pan integral', 60], ['Huevo entero', 120], ['Tomate', 100], ['Aceite de oliva', 5]]],
      ['Skyr con arándanos, nueces y miel', [['Skyr / yogur proteico', 200], ['Arándanos', 80], ['Nueces', 15], ['Miel', 10]]],
      ['Tostada con jamón serrano, tomate y aceite', [['Pan blanco (barra)', 60], ['Jamón serrano', 40], ['Tomate', 60], ['Aceite de oliva', 5]]],
      ['Tortitas de avena y claras con plátano', [['Copos de avena', 50], ['Clara de huevo', 150], ['Plátano', 60]]]
    ],
    comida: [
      ['Pollo a la plancha con arroz y brócoli', [['Pechuga de pollo a la plancha', 150], ['Arroz blanco cocido', 200], ['Brócoli', 150], ['Aceite de oliva', 10]]],
      ['Pasta con atún y tomate', [['Pasta cocida', 220], ['Atún al natural (lata)', 112], ['Tomate', 100], ['Aceite de oliva', 10]]],
      ['Salmón con patata y judías verdes', [['Salmón', 150], ['Patata cocida', 200], ['Judías verdes', 150]]],
      ['Ternera con quinoa y pimiento', [['Filete de ternera', 150], ['Quinoa cocida', 150], ['Pimiento rojo', 120], ['Aceite de oliva', 10]]],
      ['Lentejas con ensalada', [['Lentejas cocidas', 250], ['Ensalada mixta', 150], ['Aceite de oliva', 10], ['Pan integral', 40]]]
    ],
    cena: [
      ['Merluza con calabacín y champiñones', [['Merluza', 200], ['Calabacín', 150], ['Champiñones', 100], ['Aceite de oliva', 10]]],
      ['Tortilla francesa de 3 huevos con ensalada', [['Huevo entero', 180], ['Ensalada mixta', 200], ['Pan integral', 40]]],
      ['Wrap de pollo con queso fresco', [['Tortilla de trigo (wrap)', 60], ['Pechuga de pollo a la plancha', 120], ['Lechuga', 40], ['Tomate', 60], ['Queso fresco tipo Burgos', 40]]],
      ['Ensalada de garbanzos con atún y huevo', [['Garbanzos cocidos', 150], ['Atún al natural (lata)', 56], ['Huevo entero', 60], ['Tomate', 100], ['Aceite de oliva', 10]]],
      ['Tofu salteado con espinacas y arroz integral', [['Tofu firme', 200], ['Espinacas', 100], ['Pimiento rojo', 80], ['Arroz integral cocido', 120]]]
    ],
    snack: [
      ['Yogur griego con fresas', [['Yogur griego natural', 125], ['Fresas', 100]]],
      ['Batido de proteína con plátano', [['Proteína whey en polvo', 30], ['Leche semidesnatada', 250], ['Plátano', 120]]],
      ['Tortitas de arroz con crema de cacahuete', [['Tortitas de arroz', 18], ['Crema de cacahuete', 15], ['Plátano', 60]]],
      ['Queso batido con nueces y miel', [['Queso fresco batido 0%', 250], ['Nueces', 15], ['Miel', 10]]],
      ['Bocadillo de pavo y tomate', [['Pan integral', 80], ['Pechuga de pavo (fiambre)', 60], ['Tomate', 40]]],
      ['Manzana con almendras', [['Manzana', 180], ['Almendras', 25]]]
    ]
  };
  function mealIdeas(t) {
    const meal = has(t, /desayun/) ? 'desayuno' : has(t, /\bcena|ceno|cenar/) ? 'cena' : has(t, /merend|snack|picar|media manana|tentempie/) ? 'snack' : has(t, /\bcomida|como hoy|almorzar|que como/) ? 'comida' : ({ desayuno: 'desayuno', mediamanana: 'snack', comida: 'comida', merienda: 'snack', cena: 'cena' }[api.guessMeal()] || 'comida');
    const foods = api.allFoods();
    const ideas = MEAL_IDEAS[meal].map(([name, ings]) => {
      const n = { kcal: 0, p: 0, c: 0, f: 0 };
      for (const [fn, g] of ings) { const f = foods.find(x => x.name === fn); if (f) { const s = api.scaleN(f.n, g); n.kcal += s.kcal; n.p += s.p; n.c += s.c; n.f += s.f; } }
      return { name, ings, n };
    });
    const S = api.S(), tt = api.dayTotals(api.dkey());
    const leftP = S.goals.p - tt.p, leftK = S.goals.kcal - tt.kcal;
    const wantProtein = has(t, /proteina|proteic/) || leftP > 40;
    ideas.sort((a, b) => wantProtein ? b.n.p - a.n.p : Math.abs(a.n.kcal - leftK / 2) - Math.abs(b.n.kcal - leftK / 2));
    const cm = t.match(/\b([2-6]|dos|tres|cuatro|cinco|seis)\b/);
    const count = Math.min(ideas.length, cm ? (WORD_NUM[cm[1]] || +cm[1]) : 3);
    const label = { desayuno: 'desayunos', comida: 'comidas', cena: 'cenas', snack: 'meriendas / snacks' }[meal];
    return `Aquí tienes ${count} ideas de ${label}${wantProtein ? ' altas en proteína' : ''}:\n\n${ideas.slice(0, count).map((x, i) => `${i + 1}. **${x.name}** — ${r0(x.n.kcal)} kcal · P ${r0(x.n.p)} g · C ${r0(x.n.c)} g · G ${r0(x.n.f)} g\n   ${x.ings.map(([n, g]) => `${n} ${g} g`).join(', ')}`).join('\n')}\n\n${leftK > 0 ? `Hoy te quedan **${r0(leftK)} kcal** y **${r0(Math.max(0, leftP))} g de proteína**.` : ''} Si te comes una, dime por ejemplo *“he cenado ${norm(ideas[0].ings[0][0]).split(' ')[0]} ${ideas[0].ings[0][1]} g”* y lo apunto.`;
  }

  function progress() {
    const S = api.S(), EX = api.EX();
    const ws = [...S.workouts].sort((a, b) => b.start - a.start);
    if (!ws.length) return 'Aún no has registrado ningún entreno. Empieza uno desde **Gym** y aquí te contaré tu progreso. 💪';
    const wk = api.weekStart(), month = api.dkey().slice(0, 7);
    const last = ws[0];
    const prs = Object.keys(EX).map(id => ({ id, pr: api.exPR(id) })).filter(x => x.pr).sort((a, b) => b.pr.rm - a.pr.rm).slice(0, 6);
    return `**Tu progreso en el gym**\n- Esta semana: **${ws.filter(w => w.date >= wk).length}** entrenos\n- Este mes: **${ws.filter(w => w.date.startsWith(month)).length}** entrenos\n- Último: **${last.name}** (${api.fmtDate(last.date, { weekday: 'long', day: 'numeric', month: 'short' })}), ${last.exercises.reduce((a, e) => a + e.sets.length, 0)} series y ${r0(api.workoutVolume(last))} kg de volumen\n${prs.length ? `\n**Tus mejores marcas:**\n${prs.map(x => `- ${EX[x.id].name}: **${x.pr.kg} kg × ${x.pr.reps}** (1RM estimado ${x.pr.rm} kg)`).join('\n')}` : ''}`;
  }

  function study() {
    const S = api.S(), k = api.dkey(), wk = api.weekStart();
    const today = S.studyLog.filter(l => l.date === k).reduce((a, l) => a + l.min, 0);
    const week = S.studyLog.filter(l => l.date >= wk);
    const total = week.reduce((a, l) => a + l.min, 0);
    const rows = S.subjects.map(s => { const m = week.filter(l => l.subjectId === s.id).reduce((a, l) => a + l.min, 0); return `- ${s.name}: **${api.fmtH(m)}**${s.goalH ? ` de ${s.goalH} h (${r0(m / (s.goalH * 60) * 100)}%)` : ''}`; });
    const behind = S.subjects.filter(s => s.goalH && week.filter(l => l.subjectId === s.id).reduce((a, l) => a + l.min, 0) < s.goalH * 60 * 0.5);
    return `**Tu estudio**\n- Hoy: **${api.fmtH(today)}**\n- Esta semana: **${api.fmtH(total)}**\n${rows.length ? '\n' + rows.join('\n') : ''}${behind.length ? `\n\nVas por detrás en **${listJoin(behind.map(s => s.name))}**. ¿Quieres que te añada un bloque? Dime por ejemplo *“añade estudiar ${behind[0].name.toLowerCase()} mañana de 17 a 19”*.` : ''}`;
  }

  function exerciseInfo(t) {
    const EX = api.EX();
    let best = null, bestScore = 0;
    for (const e of Object.values(EX)) {
      const words = norm(e.name).split(/[^a-z]+/).filter(w => w.length > 2 && !['de', 'con', 'para', 'en', 'maquina'].includes(w));
      const hit = words.filter(w => t.includes(w)).length;
      const score = words.length ? hit / words.length + hit * 0.2 : 0;
      if (hit >= Math.min(2, words.length) && score > bestScore) { bestScore = score; best = e; }
    }
    if (!best) return null;
    const ms = m => (m || []).map(x => api.MUSCLE_ES[x] || x);
    return `**${best.name}** (${best.group} · ${best.equip})\n\n${best.how ? '**Cómo hacerlo:** ' + best.how + '\n\n' : ''}- Músculos principales: **${listJoin(ms(best.primary))}**${best.secondary?.length ? `\n- Secundarios: ${listJoin(ms(best.secondary))}` : ''}${api.exPR(best.id) ? `\n- Tu mejor serie: **${api.exPR(best.id).kg} kg × ${api.exPR(best.id).reps}**` : ''}\n\nPuedes ver el dibujo de los músculos en **Gym → Ejercicios**.`;
  }
  function exercisesFor(t) {
    const EX = api.EX();
    const muscle = Object.entries(api.MUSCLE_ES).find(([, es]) => t.includes(norm(es).replace(/s$/, '')));
    let list = [];
    if (muscle) list = Object.values(EX).filter(e => (e.primary || []).includes(muscle[0]));
    if (!list.length) for (const [re, gs] of GROUP_WORDS) if (re.test(t)) list = list.concat(Object.values(EX).filter(e => gs.includes(e.group)));
    if (!list.length) return null;
    list = list.filter((e, i, a) => a.indexOf(e) === i && (e.type !== 'cardio' || /cardio/.test(t))).slice(0, 10);
    if (!list.length) return null;
    return `Ejercicios que puedes hacer en tu gym:\n\n${list.map(e => `- **${e.name}**${api.exAvail(e.id) ? '' : ' *(no disponible en tu gym)*'}`).join('\n')}\n\nSi quieres, te monto una rutina: *“créame una rutina de ${norm(muscle ? api.MUSCLE_ES[muscle[0]] : list[0].group).split(' ')[0]} para hoy”*.`;
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

  // ---------- conocimientos ----------
  const KB = [
    [['sobrecarga', 'progresion', 'progresar', 'estancad', 'subir peso', 'subir de peso en'], () => '**Sobrecarga progresiva** = pedirle al músculo un poco más cada semana para que siga adaptándose.\n\n- Sube **reps** dentro de tu rango (p. ej. de 8 a 12) y, cuando llegues arriba en todas las series, **sube el peso** un 2,5–5 %.\n- También cuenta: una serie más, mejor técnica o menos descanso.\n- Apunta tus series en FOCUS: en cada ejercicio verás **“Última vez”** para intentar superarla.\n- Si te estancas 2–3 semanas: revisa sueño, proteína y calorías, o haz una semana más suave.'],
    [['cuanta proteina', 'proteina al dia', 'proteinas necesito', 'gramos de proteina', 'cuanta proteina'], () => { const w = num(api.S().profile.weight) || 70; return `Para ganar músculo o mantenerlo mientras pierdes grasa se recomiendan **1,6–2,2 g de proteína por kg** de peso al día.\n\nCon tus ${w} kg serían unos **${r0(w * 1.6)}–${r0(w * 2.2)} g/día**. Tu objetivo en FOCUS es **${api.S().goals.p} g**.\n\nRepártela en 3–5 comidas de 25–40 g (pollo, huevos, atún, skyr, legumbres, tofu…).`; }],
    [['creatina'], () => 'La **creatina monohidrato** es el suplemento con más evidencia para fuerza y masa muscular.\n\n- Dosis: **3–5 g al día**, todos los días (da igual la hora).\n- No hace falta fase de carga ni descansar de ella.\n- Puede subir 1–2 kg de peso por agua dentro del músculo: es normal.\n- Si tienes algún problema de riñón, consúltalo antes con tu médico.'],
    [['perder grasa', 'adelgazar', 'bajar de peso', 'perder peso', 'definir', 'definicion', 'deficit', 'quemar grasa'], () => `Para **perder grasa** la clave es un **déficit calórico** moderado (comer ~15–20 % menos de lo que gastas):\n\n- Proteína alta (1,8–2,2 g/kg) para no perder músculo.\n- Sigue entrenando con pesas: le dice al cuerpo que conserve el músculo.\n- Muévete más: 8.000–10.000 pasos al día ayudan mucho.\n- Duerme 7–9 h.\n- Ritmo sano: **0,5–1 % de tu peso por semana**.\n\nEn **Comidas → Objetivos** puedes calcular tus calorías eligiendo “Perder grasa”.`],
    [['ganar musculo', 'hipertrofia', 'masa muscular', 'crecer', 'ganar peso', 'volumen limpio', 'coger musculo'], () => 'Para **ganar músculo**:\n\n- Entrena cada músculo **2 veces por semana**, con **10–20 series semanales** por grupo.\n- Series de 6–15 reps, cerca del fallo (dejando 1–3 reps en reserva).\n- **Sobrecarga progresiva**: intenta mejorar algo cada semana.\n- Come un pequeño **superávit** (+5–10 % de calorías) y 1,6–2,2 g/kg de proteína.\n- Duerme 7–9 h.\n\nEn **Gym → Progreso** ves tus series por grupo de la semana.'],
    [['cuantas series', 'series por musculo', 'series a la semana', 'volumen semanal'], () => 'Una buena referencia: **10–20 series efectivas por grupo muscular a la semana**, repartidas en 2 sesiones.\n\nSi empiezas, con 8–12 es suficiente. Lo verás en **Gym → Progreso → Series por grupo esta semana**.'],
    [['descanso entre series', 'cuanto descanso', 'cuanto descansar', 'descansar entre'], () => '**Descanso entre series**:\n- Ejercicios grandes (prensa, sentadilla, remo, press): **2–3 min**.\n- Ejercicios de aislamiento (curl, extensiones, elevaciones): **60–90 s**.\n- Si buscas fuerza máxima: 3–5 min.\n\nFOCUS pone el temporizador solo al marcar cada serie ✓.'],
    [['calentar', 'calentamiento'], () => '**Calentamiento rápido (5–10 min):**\n1. 5 min de cardio suave (bici, elíptica).\n2. Movilidad de las articulaciones que vas a usar.\n3. 2–3 series de aproximación del primer ejercicio: 50 % × 10, 70 % × 5, 85 % × 2.'],
    [['agujetas', 'dolor muscular'], () => 'Las **agujetas** son normales tras un estímulo nuevo y suelen durar 24–72 h.\n\n- Moverte suave (caminar, bici) ayuda más que el reposo total.\n- No indican que el entreno fuera mejor.\n- Si el dolor es agudo, en una articulación o no mejora, consulta a un profesional.'],
    [['cuantos dias', 'cuantas veces', 'frecuencia', 'dias a la semana'], () => '**Días de entreno**:\n- 2–3 días: full body.\n- 4 días: torso / pierna × 2.\n- 5–6 días: empuje / tirón / pierna.\n\nLo importante es la constancia semanal. Puedo crearte las rutinas: *“créame una rutina full body para lunes y jueves”*.'],
    [['cardio', 'correr', 'aerobico', 'hiit'], () => '**Cardio**:\n- Mejora el corazón, la recuperación y ayuda a gastar calorías.\n- 150 min/semana de cardio moderado (o 75 de intenso) es la recomendación general.\n- Si quieres ganar músculo, hazlo después de las pesas o en otro momento del día.\n- El HIIT ahorra tiempo, pero cansa más: 1–2 sesiones/semana bastan.'],
    [['dormir', 'sueno', 'insomnio', 'descansar mejor'], () => '**Para dormir mejor**:\n- **7–9 h** y a horas parecidas cada día (también el finde).\n- Sin pantallas 30–60 min antes; luz tenue.\n- Nada de cafeína 6–8 h antes de dormir.\n- Habitación fresca, oscura y silenciosa.\n\nAñade un bloque de **Descanso** en el Plan para que te avise de ir a dormir.'],
    [['pomodoro'], () => '**Técnica Pomodoro**: 25 min de concentración total + 5 min de descanso. Cada 4 ciclos, un descanso largo de 15–30 min.\n\nEn la pestaña **Estudio** tienes el temporizador (también 50/10 y 90/15) y registra tus horas por asignatura.'],
    [['estudiar mejor', 'tecnicas de estudio', 'memorizar', 'concentrar', 'concentracion', 'recordar', 'como estudiar', 'aprender'], () => '**Técnicas de estudio que funcionan**:\n1. **Recuerdo activo**: cierra los apuntes y explica o escribe lo que recuerdas.\n2. **Repaso espaciado**: repasa al día siguiente, a los 3 días y a la semana.\n3. **Practica con ejercicios y exámenes** antiguos.\n4. **Bloques sin distracciones** (móvil fuera) con Pomodoro.\n5. **Intercala** temas o asignaturas.\n\nSubrayar y releer es lo que menos rinde.'],
    [['examen', 'examenes', 'selectividad', 'evau', 'pau'], () => '**Plan para un examen**:\n- Divide el temario en bloques y repártelos en los días que quedan.\n- Deja los **2 últimos días** solo para repasar y hacer exámenes.\n- Duerme bien la noche anterior: el sueño fija la memoria.\n\nDime por ejemplo *“añade estudiar historia de lunes a viernes de 17 a 19”* y te lo pongo en el horario.'],
    [['procrastin', 'motivacion', 'pereza', 'no tengo ganas', 'constancia', 'disciplina', 'motivar'], () => '**Contra la procrastinación**:\n- **Regla de los 2 minutos**: empieza solo 2 minutos; lo difícil es arrancar.\n- Divide la tarea en pasos pequeños y concretos.\n- Ten el plan **con hora**: en FOCUS cada bloque te avisa.\n- Quita el móvil de la vista.\n- Celebra lo hecho: marca ✓ tus actividades en **Hoy**.\n\nLa motivación va y viene; los hábitos se quedan. 💪'],
    [['estres', 'ansiedad', 'agobio', 'agobiado', 'nervios', 'estresado'], () => 'Siento que estés así. Algunas cosas que ayudan:\n- **Respiración 4-7-8**: inspira 4 s, aguanta 7 s, suelta 8 s (×4).\n- Muévete: un paseo de 10–20 min baja mucho el estrés.\n- Escribe lo que te preocupa y el siguiente paso pequeño de cada cosa.\n- Duerme y come a horas regulares.\n\nSi la ansiedad no se va o te desborda, habla con alguien de confianza o con un profesional. Y si alguna vez te sientes al límite, en España tienes el **024** (gratis, 24 h) y el **112** para urgencias.'],
    [['ayuno'], () => 'El **ayuno intermitente** (p. ej. 16:8) no quema más grasa por sí mismo: funciona si te ayuda a comer menos en total.\n\nSi te resulta cómodo, adelante; si te da ansiedad o atracones, no lo uses. Mantén la proteína alta.'],
    [['hidratos por la noche', 'carbohidratos por la noche', 'cenar hidratos', 'cenar carbohidratos', 'engorda cenar'], () => 'Cenar **carbohidratos no engorda** por ser de noche: lo que cuenta es el total de calorías del día. Incluso pueden ayudarte a dormir y a recuperar si entrenas por la tarde.'],
    [['antes de entrenar', 'despues de entrenar', 'post entreno', 'pre entreno', 'postentreno', 'preentreno'], () => '**Antes de entrenar** (1–2 h): carbohidratos + algo de proteína. P. ej. tostada con pavo o yogur con plátano.\n\n**Después** (en las 2 h siguientes): proteína (25–40 g) + carbohidratos. P. ej. pollo con arroz o batido con plátano.\n\nLo más importante es el total del día.'],
    [['suplemento', 'whey', 'proteina en polvo', 'batido de proteina'], () => '**Suplementos útiles** (opcionales):\n- **Proteína en polvo**: comodidad para llegar a tu proteína. No es imprescindible.\n- **Creatina** 3–5 g/día: la más estudiada para fuerza.\n- **Cafeína** antes de entrenar: mejora el rendimiento.\n\nEl resto (quemagrasas, BCAA…) tiene poca evidencia. Primero comida, sueño y entreno.'],
    [['agua', 'hidrat', 'cuanto beber'], () => 'Como guía, unos **30–35 ml de agua por kg** de peso al día, y más si sudas o hace calor. La orina de color amarillo claro indica que vas bien hidratado.'],
    [['alcohol', 'cerveza', 'cubata', 'beber alcohol'], () => 'El **alcohol** empeora el sueño, la recuperación y la síntesis de músculo, y aporta 7 kcal/g. Cuanto menos, mejor; si bebes, que sea poco y no cerca del entreno.'],
    [['lesion', 'me duele', 'dolor de', 'me he hecho dano', 'tendinitis'], () => 'Si tienes **dolor o una lesión**, para el ejercicio que lo provoca y **consulta con un médico o fisioterapeuta**. Mientras tanto puedes entrenar otras zonas que no duelan. No entrenes con dolor agudo.'],
    [['respirar', 'respiracion'], () => 'En pesas: **coge aire antes de bajar** el peso y **suéltalo al empujar o tirar** (la parte difícil). En cargas pesadas, mantener el aire con el abdomen apretado da estabilidad.'],
    [['organizar', 'organizarme', 'productividad', 'productivo', 'habito', 'habitos', 'planificar mi'], () => '**Para organizarte mejor**:\n1. Planifica la semana el domingo en **Plan** (estudio, gym, comidas, descanso).\n2. Lo importante, a primera hora.\n3. Bloques de tiempo con hora de inicio y fin.\n4. Deja huecos libres para imprevistos.\n5. Revisa cada noche qué has hecho (✓ en **Hoy**).\n\nTambién puedo añadirte bloques: *“añade gym de lunes a viernes a las 18:30”*.'],
    [['cafe', 'cafeina'], () => 'La **cafeína** (3–6 mg/kg, unos 1–2 cafés) 30–60 min antes de entrenar o estudiar mejora el rendimiento y la concentración. Evítala 6–8 h antes de dormir.'],
    [['imc', 'peso ideal', 'indice de masa'], () => { const p = api.S().profile; const imc = num(p.weight) / Math.pow(num(p.height) / 100, 2); return `Con ${p.weight} kg y ${p.height} cm tu **IMC es ${r1(imc)}** (${imc < 18.5 ? 'bajo peso' : imc < 25 ? 'normal' : imc < 30 ? 'sobrepeso' : 'obesidad'}).\n\nOjo: el IMC no distingue músculo de grasa; si entrenas fuerza, el perímetro de cintura o el % de grasa son mejores referencias. Puedes cambiar tus datos en **Comidas → Objetivos**.`; }],
    [['cuantas calorias', 'calorias necesito', 'mantenimiento', 'metabolismo', 'gasto calorico'], () => { const p = api.S().profile; const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'h' ? 5 : -161); const tdee = bmr * p.activity; return `Según tus datos (${p.weight} kg, ${p.height} cm, ${p.age} años):\n- Metabolismo basal: **${r0(bmr)} kcal**\n- Gasto diario estimado: **${r0(tdee)} kcal** (mantenimiento)\n- Para perder grasa: ~**${r0(tdee * 0.8)} kcal**\n- Para ganar músculo: ~**${r0(tdee * 1.1)} kcal**\n\nTu objetivo actual en FOCUS es **${api.S().goals.kcal} kcal**. Ajústalo en **Comidas → Objetivos**.`; }],
    [['azucar', 'dulces', 'chocolate', 'antojo'], () => 'La OMS recomienda menos de **50 g de azúcares añadidos** al día (mejor menos de 25 g). Para los antojos: fruta, yogur con canela, chocolate negro 85 % o tenerlos planificados en tus calorías.'],
    [['fibra'], () => 'Se recomiendan **25–35 g de fibra al día**: fruta, verdura, legumbres, avena, pan integral y frutos secos. Ayuda a la saciedad y a la digestión.'],
    [['estirar', 'estiramientos', 'flexibilidad', 'movilidad'], () => '**Estiramientos**: mejor **después** del entreno o en otro momento (20–30 s por músculo). Antes de entrenar, mejor movilidad dinámica (círculos de brazos, zancadas, rotaciones).']
  ];
  function knowledge(t) {
    let best = null, score = 0;
    for (const [keys, fn] of KB) {
      const s = keys.reduce((a, k) => a + (t.includes(k) ? k.length : 0), 0);
      if (s > score) { score = s; best = fn; }
    }
    return best ? best() : null;
  }

  const HELP = () => `¡Hola${api.S().settings.name ? ', ' + api.S().settings.name : ''}! 👋 Soy tu asistente de FOCUS y funciono **sin internet**. Puedo:\n\n- 📅 **Tu plan**: *“¿qué me toca ahora?”*, *“¿qué tengo el martes?”*\n- ➕ **Añadir actividades**: *“añade estudiar inglés mañana de 17 a 19”*\n- 🏋️ **Crear rutinas**: *“créame una rutina de pierna para el lunes”*\n- 🍽️ **Apuntar comidas**: *“he comido 200 g de arroz y una pechuga de pollo”*\n- 📊 **Macros**: *“¿cómo voy de proteína?”*, *“¿qué ceno?”*\n- 📈 **Progreso y estudio**: *“mis récords”*, *“¿cuánto he estudiado?”*\n- 💡 **Dudas** de gym, nutrición, estudio, sueño y hábitos\n- 🧮 **Cálculos**: *“cuánto es 15% de 80”*`;

  // ---------- respuesta principal ----------
  function reply(raw) {
    const t = norm(raw).replace(/[¿¡]/g, '').replace(/\s+/g, ' ').trim();
    if (!t) return { text: HELP() };
    if (/^(gracias|muchas gracias|mil gracias|genial|perfecto|vale|ok|okey|guay)\b/.test(t) && t.length < 30) return { text: '¡De nada! 😊 Aquí estoy para lo que necesites.' };

    const c = calc(t);
    if (c) return { text: c };

    const wantsCreate = /\b(crea|creame|crear|hazme|haz|monta|montame|disena|genera|prepara|preparame|quiero|dame|ponme|organiza|organizame|planifica|planificame|necesito)\b/.test(t);
    if (/\b(rutina|entreno|entrenamiento|sesion de gym|dia de)\b/.test(t) && wantsCreate && !/\b(estudi|repas)/.test(t)) return createRoutine(raw, t);

    const foodVerb = /(he comido|me he comido|he cenado|he desayunado|he merendado|he almorzado|he tomado|me he tomado)/.test(t);
    const addVerb = /\b(anade|anademe|pon|ponme|agenda|programa|recuerdame|planifica|organiza|organizame|apunta|apuntame|registra|mete|crea|quiero)\b/.test(t);
    if (foodVerb) { const r = logFood(raw, t); if (r) return r; }
    if (addVerb || wantsCreate) {
      const a = addActivity(raw, t);
      if (a) return a;
      if (/\b(apunta|registra|anade)\b/.test(t)) { const r = logFood(raw, t); if (r) return r; }
      if (/(horas? de estudio|estudiar|estudio)/.test(t)) return { text: 'Dime también **cuándo**, por ejemplo: *“añade estudiar matemáticas mañana de 17 a 19”* o *“de lunes a viernes a las 16:00 durante 2 horas”*.' };
    }

    if (/(que (me )?toca|que tengo|que hago|mi dia|mi horario|mi agenda|mi plan|que me queda|siguiente actividad|lo siguiente|planes? (de|para))/.test(t)) {
      const days = parseDays(t);
      return { text: planFor(days.length ? days[0] : api.dow()) };
    }
    if (/(macro|calori|kcal|como voy|me queda|cuanto he comido|cuanta proteina llevo|proteina llevo|proteina hoy)/.test(t) && !/necesito|cuantas calorias/.test(t)) return { text: macros() };
    if (/(que (como|ceno|desayuno|meriendo|puedo comer|puedo cenar)|ideas? de|receta|menu|que me hago de|dame \d* ?(desayunos|cenas|comidas|meriendas|snacks)|(desayunos|cenas|comidas|meriendas|snacks) (alt|con|rico|sano))/.test(t)) return { text: mealIdeas(t) };
    if (/(record|marcas|progreso|1rm|cuanto levanto|ultimo entreno|mis entrenos|como voy en el gym|volumen)/.test(t)) return { text: progress() };
    if (/(cuanto he estudiado|horas de estudio|mi estudio|tiempo de estudio|como voy (con|en) (el )?estudio)/.test(t)) return { text: study() };

    if (/(ejercicios? (para|de)|que (ejercicios|maquinas)|como entreno|como trabajo)/.test(t)) { const r = exercisesFor(t); if (r) return { text: r }; }
    if (/(como se hace|como hago|tecnica|que musculos?|como hacer|para que sirve|explicame)/.test(t) || t.split(' ').length <= 6) { const r = exerciseInfo(t); if (r) return { text: r }; }

    const k = knowledge(t);
    if (k) return { text: k };
    if (/^(hola|buenas|hey|ey|holi|que tal|buenos dias|buenas tardes|buenas noches)\b|que puedes hacer|ayuda|como funcionas|quien eres/.test(t)) return { text: HELP() };

    const r = exerciseInfo(t);
    if (r) return { text: r };
    return { text: `Uy, eso no lo sé responder en el modo sin conexión 🤔.\n\nPrueba a preguntarme de otra forma, o pídeme algo como:\n- *“¿Qué me toca ahora?”*\n- *“Créame una rutina de espalda para hoy”*\n- *“He desayunado 2 huevos y una tostada”*\n- *“¿Cuántas series hago por músculo?”*` };
  }

  return { reply };
};
