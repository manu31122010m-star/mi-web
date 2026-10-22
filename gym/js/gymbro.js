/* GymBro: asistente de gimnasio que funciona sin conexión. Entiende frases en español,
   consulta tus rutinas e historial, crea rutinas y planes, y resuelve dudas de técnica,
   progresión, descanso, nutrición básica y recuperación. */
'use strict';
window.createGymBro = function (api) {
  const D = window.GYMDATA;
  const { exOf, sessionsOf, bestOf, maxKg, e1rm, doneSets, num, fmtKg, fmtDate, DAYS, dow, uid, COLORS } = api;
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!.,;:()]/g, ' ').replace(/\s+/g, ' ').trim();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Texto con **negrita** y saltos de línea → HTML seguro
  const fmt = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const listJoin = a => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1];
  const has = (t, re) => re.test(t);
  const out = (text, actions = []) => ({ html: fmt(text), actions });
  const S = () => api.state();
  const allEx = () => Object.values(api.EX);

  // ---------- comprensión ----------
  const DAY_IDX = { lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4, sabado: 5, domingo: 6 };
  function parseDays(t) {
    const days = new Set();
    if (/entre semana|de lunes a viernes/.test(t)) [0, 1, 2, 3, 4].forEach(d => days.add(d));
    for (const m of t.matchAll(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)s?\b/g)) days.add(DAY_IDX[m[1]]);
    if (/pasado manana/.test(t)) days.add((dow() + 2) % 7);
    else if (/\bmanana\b/.test(t) && !/por la manana|de manana|esta manana/.test(t)) days.add((dow() + 1) % 7);
    if (/\bhoy\b/.test(t)) days.add(dow());
    return [...days].sort((a, b) => a - b);
  }
  const WORDN = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7 };
  function daysPerWeek(t) {
    const m = t.match(/\b(\d|un|una|dos|tres|cuatro|cinco|seis|siete)\s*(dias|veces|sesiones)/);
    return m ? (WORDN[m[1]] || +m[1]) : 0;
  }
  function minutes(t) {
    const h = t.match(/(\d+(?:[.,]\d+)?)\s*(h|hora|horas)\b/), m = t.match(/(\d+)\s*(min|minutos)\b/);
    if (/hora y media/.test(t)) return 90;
    if (/media hora/.test(t)) return 30;
    if (/una hora|1 hora/.test(t)) return 60;
    return h ? num(h[1]) * 60 : m ? +m[1] : 0;
  }
  const GOALS = {
    fuerza: { reps: '4-6', sets: 4, rest: 180, label: 'fuerza' },
    hipertrofia: { reps: '8-12', sets: 3, rest: 90, label: 'ganar músculo' },
    resistencia: { reps: '12-15', sets: 3, rest: 60, label: 'definir / resistencia' }
  };
  const goalOf = t => /fuerza|fuerte|pesad/.test(t) ? GOALS.fuerza : /definir|definicion|resistencia|tonificar|perder (grasa|peso)|adelgazar|quemar/.test(t) ? GOALS.resistencia : GOALS.hipertrofia;

  const GROUP_WORDS = [
    [/pecho|pectoral/, ['Pecho']],
    [/espalda|dorsal/, ['Espalda']],
    [/hombro|deltoide/, ['Hombros']],
    [/biceps/, ['Bíceps y antebrazos']],
    [/triceps/, ['Tríceps']],
    [/\bbrazos?\b/, ['Bíceps y antebrazos', 'Tríceps']],
    [/cuadriceps/, ['Cuádriceps y piernas']],
    [/isquio|femoral/, ['Isquiotibiales']],
    [/gluteo|culo|abductor/, ['Glúteos y abductores']],
    [/gemelo/, ['Gemelos']],
    [/pierna|tren inferior|\bleg/, ['Cuádriceps y piernas', 'Isquiotibiales', 'Glúteos y abductores', 'Gemelos']],
    [/abdominal|abdomen|\babs\b|core|\bcore\b/, ['Abdominales y core']],
    [/cardio/, ['Cardio']],
    [/empuje|\bpush\b/, ['Pecho', 'Hombros', 'Tríceps']],
    [/tiron|\bpull\b/, ['Espalda', 'Bíceps y antebrazos']],
    [/torso|tren superior/, ['Pecho', 'Espalda', 'Hombros', 'Bíceps y antebrazos', 'Tríceps']],
    [/full ?body|cuerpo completo|todo el cuerpo/, ['Cuádriceps y piernas', 'Pecho', 'Espalda', 'Hombros', 'Isquiotibiales', 'Abdominales y core']]
  ];
  function groupsIn(t) {
    const g = [];
    for (const [re, gs] of GROUP_WORDS) if (re.test(t)) gs.forEach(x => { if (!g.includes(x)) g.push(x); });
    return g;
  }

  // Busca un ejercicio mencionado en la frase
  const STOP = new Set(['de', 'en', 'con', 'para', 'la', 'el', 'los', 'las', 'del', 'al', 'maquina', 'sentado', 'polea', 'y', 'a']);
  const ALIAS = [
    [/press (de )?banca|press banca|bench/, 'press-de-banca-con-barra'], [/sentadilla hack|\bhack\b/, 'sentadilla-hack'], [/peso muerto rumano|\brdl\b/, 'peso-muerto-rumano-con-mancuernas'],
    [/peso muerto/, 'peso-muerto-con-barra'], [/hip ?thrust/, 'maquina-de-hip-thrust'], [/prensa/, 'prensa-de-piernas'], [/jalon/, 'jalon-al-pecho'],
    [/dominada/, 'dominadas'], [/fondos?/, 'fondos-en-paralelas'], [/sentadilla/, 'sentadilla-con-barra'], [/pec ?deck|contractora/, 'contractora-pec-deck'],
    [/press militar|press (de )?hombro/, 'press-de-hombros'], [/curl femoral/, 'curl-femoral-tumbado'], [/curl (de )?biceps|\bcurl\b/, 'curl-de-biceps-en-maquina'],
    [/extension(es)? de cuadriceps|extension de piernas/, 'extension-de-cuadriceps'], [/remo/, 'remo-sentado-en-polea'], [/elevaciones laterales|laterales/, 'elevaciones-laterales-en-maquina'],
    [/cruce de poleas|crossover/, 'cruce-de-poleas'], [/zancada/, 'zancadas-con-mancuernas'], [/plancha/, 'plancha'], [/cinta/, 'cinta-de-correr'], [/eliptica/, 'eliptica'], [/bici/, 'bicicleta-estatica']
  ];
  function findExercise(t) {
    let best = null, bestScore = 0;
    for (const e of allEx()) {
      const words = norm(e.n).split(' ').filter(w => w.length > 2 && !STOP.has(w));
      if (!words.length) continue;
      const hit = words.filter(w => t.includes(w) || (w.length > 5 && t.includes(w.slice(0, 5)))).length;
      const sc = hit / words.length + (t.includes(norm(e.n)) ? 1 : 0);
      if (hit && sc > bestScore) { bestScore = sc; best = e; }
    }
    if (bestScore >= .99) return best;
    for (const [re, id] of ALIAS) if (re.test(t) && api.EX[id]) return api.EX[id];
    return bestScore >= .66 ? best : null;
  }

  // ---------- creación de rutinas ----------
  const EQUIP_PREF = t => /mancuerna/.test(t) ? ['manc'] : /barra|peso libre|libre/.test(t) ? ['barra', 'manc'] : /maquina/.test(t) ? ['maquina', 'polea'] : null;
  const PER_GROUP = { 'Cuádriceps y piernas': 1.4, 'Espalda': 1.3, 'Pecho': 1.2, 'Isquiotibiales': 1, 'Glúteos y abductores': 1, 'Hombros': 1, 'Bíceps y antebrazos': .8, 'Tríceps': .8, 'Gemelos': .5, 'Abdominales y core': .6, 'Cardio': .4 };
  // Orden preferido dentro de cada grupo (los demás van después, en el orden de la biblioteca)
  const PRIORITY = {
    'Glúteos y abductores': ['maquina-de-hip-thrust', 'patada-de-gluteo-en-maquina', 'maquina-de-abductores'],
    'Espalda': ['jalon-al-pecho', 'remo-sentado-en-polea', 'remo-con-mancuerna-a-una-mano', 'remo-con-pecho-apoyado', 'jalon-con-agarre-estrecho'],
    'Hombros': ['press-de-hombros', 'press-de-hombros-con-mancuernas', 'elevaciones-laterales-en-maquina', 'elevaciones-laterales-con-mancuernas', 'pajaros-deltoide-posterior'],
    'Cuádriceps y piernas': ['prensa-de-piernas', 'sentadilla-hack', 'zancadas-con-mancuernas', 'extension-de-cuadriceps'],
    'Isquiotibiales': ['curl-femoral-sentado', 'peso-muerto-rumano-con-mancuernas', 'curl-femoral-tumbado']
  };
  const restTxt = s => s % 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min` : `${s / 60} min`;
  function buildRoutine(groups, { n = 0, goal = GOALS.hipertrofia, pref = null, name = '', days = [] } = {}) {
    if (!groups.length) groups = ['Pecho', 'Espalda', 'Cuádriceps y piernas', 'Hombros'];
    if (!n) n = Math.min(9, Math.max(4, Math.round(groups.reduce((a, g) => a + (PER_GROUP[g] || 1), 0) * 1.6)));
    const total = groups.reduce((a, g) => a + (PER_GROUP[g] || 1), 0);
    const quota = groups.map(g => Math.max(1, Math.round(n * (PER_GROUP[g] || 1) / total)));
    const items = [], usedAnim = new Set();
    groups.forEach((g, gi) => {
      const pr = PRIORITY[g] || [], rank = e => pr.includes(e.id) ? pr.indexOf(e.id) : 99;
      let pool = allEx().filter(e => e.g === g && !e.custom).sort((a, b) => rank(a) - rank(b));
      if (pref) pool = [...pool.filter(e => e.e.some(k => pref.includes(k))), ...pool.filter(e => !e.e.some(k => pref.includes(k)))];
      for (const e of pool) {
        if (items.filter(x => exOf(x.ex).g === g).length >= quota[gi]) break;
        if (usedAnim.has(e.a)) continue;
        usedAnim.add(e.a);
        const cardio = e.t === 'c';
        items.push({ ex: e.id, sets: cardio ? 1 : (items.length === 0 ? goal.sets + (goal === GOALS.fuerza ? 0 : 1) : goal.sets), reps: cardio ? '15' : e.t === 't' ? '45' : goal.reps, rest: cardio ? 60 : goal.rest, note: '' });
      }
    });
    const nm = name || (groups.length >= 5 ? 'Full body' : groups.map(g => g.split(' ')[0]).join(' + '));
    return { id: uid(), name: nm, color: COLORS[(S().routines.length + nm.length) % COLORS.length], days, items };
  }
  const routineText = r => r.items.map((it, i) => { const e = exOf(it.ex); return `${i + 1}. **${e.n}** — ${it.sets}×${it.reps}${e.t === 'c' ? ' min' : e.t === 't' ? ' s' : ''}`; }).join('\n');
  const routineActions = r => [{ label: '💾 Guardar rutina', type: 'saveRoutine', payload: r }, { label: '▶ Empezar ahora', type: 'startRoutine', payload: r }, { label: '✏️ Guardar y editar', type: 'editRoutine', payload: r }];

  // ---------- historial ----------
  function lastTrainedByGroup() {
    const last = {};
    for (const w of S().workouts) for (const it of w.items) {
      if (!doneSets(it).length) continue;
      const g = exOf(it.ex).g;
      last[g] = Math.max(last[g] || 0, w.start);
    }
    return last;
  }
  const hoursAgo = t => t ? (Date.now() - t) / 36e5 : Infinity;

  // ---------- respuestas ----------
  const TIPS = [
    [/proteina/, () => {
      const kg = latestBW();
      return `Para ganar o mantener músculo, la recomendación habitual es **1,6–2,2 g de proteína por kg de peso al día**${kg ? ` → para tus ${fmtKg(kg)} kg serían unos **${Math.round(kg * 1.6)}–${Math.round(kg * 2.2)} g/día**` : ''}.\n\nRepártela en 3–5 comidas (20–40 g cada una): carne, pescado, huevos, lácteos, legumbres o tofu. Un batido solo es útil si no llegas con la comida.`;
    }],
    [/creatina/, () => 'La **creatina monohidrato** es el suplemento con más evidencia para fuerza y masa muscular.\n\n• Dosis: **3–5 g al día**, todos los días (también los de descanso).\n• No hace falta fase de carga ni tomarla a una hora concreta.\n• Puede subir 1–2 kg de agua dentro del músculo: es normal.\n\nSi tienes algún problema renal o tomas medicación, consúltalo antes con un médico.'],
    [/calentar|calentamiento/, () => 'Un buen calentamiento en 5–10 min:\n\n1. **3–5 min de cardio suave** (bici, elíptica) para subir la temperatura.\n2. **Movilidad** de las articulaciones que vas a usar (hombros, cadera, tobillos).\n3. **Series de aproximación** en el primer ejercicio: 1×10 al 40–50 %, 1×5 al 60–70 % y 1×2–3 al 80 % del peso de trabajo.\n\nMárcalas en el entreno tocando el número de serie → **C** (calentamiento).'],
    [/agujeta|dolor muscular|doms/, () => 'Las **agujetas** aparecen 24–72 h después, sobre todo al empezar o cambiar de ejercicios. No indican que el entreno fuese mejor.\n\n• Muévete suave (caminar, bici ligera).\n• Duerme bien y come suficiente proteína.\n• Puedes entrenar otros grupos; si el músculo está muy dolorido, espera.\n\nSi es un **dolor punzante o en una articulación**, para y consulta a un profesional.'],
    [/lesion|me duele|dolor (de|en)|me he hecho dano|lumbar duele/, () => 'Si notas **dolor agudo, punzante o en una articulación**, para ese ejercicio. No entrenes a través del dolor.\n\n• Prueba variantes que no molesten (máquina guiada, menos recorrido o menos peso).\n• Si dura más de unos días, se hincha o pierdes fuerza, **ve a un fisioterapeuta o médico**.\n\nYo te puedo buscar ejercicios alternativos: dime cuál te molesta (p. ej. «alternativa a la prensa»).'],
    [/dormir|sueno|descansar de noche/, () => 'Dormir **7–9 horas** es de lo que más influye en la recuperación, la fuerza y la composición corporal. Intenta mantener horarios regulares y evita pantallas y cafeína tarde.'],
    [/hidrat|agua/, () => 'Bebe agua a lo largo del día (una referencia: **~35 ml por kg de peso**, más si sudas mucho). Durante el entreno, sorbos cada 15–20 min.'],
    [/estirar|estiramiento|flexibilidad|movilidad/, () => 'Los **estiramientos estáticos** mejor al final o en otro momento; antes de entrenar, usa **movilidad dinámica** (círculos de brazos, balanceos de pierna, sentadillas sin peso). Entrenar con todo el recorrido también mejora la flexibilidad.'],
    [/(cuantas|cuantos) series|volumen semanal|cuanto volumen/, () => 'Para ganar músculo, una buena referencia es **10–20 series efectivas por grupo muscular a la semana**, repartidas en 2 días o más.\n\n• Empieza por la parte baja (10–12) y sube si progresas bien y te recuperas.\n• Por sesión, unas 6–10 series de un mismo músculo suelen bastar.'],
    [/(cuantas|cuantos|que) rep|rango de rep/, () => '• **Fuerza:** 3–6 repeticiones, descanso 2–4 min.\n• **Ganar músculo:** 6–15 repeticiones (todas funcionan si llegas cerca del fallo), descanso 1,5–3 min.\n• **Resistencia:** 15–25 repeticiones, descanso 30–90 s.\n\nLo importante: dejar **1–3 repeticiones en la recámara** y ir subiendo peso o repeticiones con el tiempo.'],
    [/descanso entre series|cuanto descans|tiempo de descanso/, () => '• Ejercicios grandes (prensa, sentadilla, press, remo): **2–3 min**.\n• Ejercicios pequeños (curl, laterales, extensiones): **60–90 s**.\n\nEl temporizador arranca solo al marcar cada serie. Puedes cambiar el descanso de cada ejercicio en la rutina o desde ⋯ durante el entreno.'],
    [/fallo|al fallo|rir|rpe/, () => 'No hace falta llegar al fallo en cada serie. Trabaja con **RIR 1–3** (dejar 1–3 repeticiones sin hacer). Reserva el fallo para la **última serie** de ejercicios seguros en máquina. En el entreno puedes marcar una serie como **F** (fallo) tocando su número.'],
    [/sobrecarga|progresar|progresion|estancad|no subo|no avanzo|como subo/, () => 'Usa la **doble progresión**:\n\n1. Elige un rango, p. ej. 8–12 reps.\n2. Cuando hagas **12 reps en todas las series** con buena técnica, sube el peso (2,5–5 %).\n3. Vuelves a 8 reps con el nuevo peso y repites.\n\nSi llevas 3 semanas sin mejorar: duerme más, come más, cambia la variante del ejercicio o haz una **semana de descarga** (la mitad de series).'],
    [/descarga|deload/, () => 'Una **semana de descarga** cada 6–10 semanas (o cuando estés muy cansado o estancado): mismos ejercicios, **la mitad de series** y un poco menos de peso. Vuelves con más energía.'],
    [/frecuencia|cuantas veces (entreno|por semana|a la semana)|cada cuanto/, () => 'Entrenar cada músculo **2 veces por semana** suele dar mejores resultados que 1. Con 3 días: full body; con 4: torso/pierna; con 5–6: empuje/tirón/pierna.\n\nPídeme «**plan de 4 días**» y te lo monto.'],
    [/perder grasa|adelgazar|definir|quemar grasa|bajar de peso/, () => {
      const kg = latestBW();
      return `Para perder grasa sin perder músculo:\n\n• **Déficit moderado**: unas 300–500 kcal menos de las que gastas${kg ? ` (tu mantenimiento rondará ${Math.round(kg * 30)}–${Math.round(kg * 34)} kcal si te mueves algo)` : ''}.\n• **Sigue entrenando pesado** con pesas: es la señal para conservar el músculo.\n• Proteína alta: **1,8–2,2 g/kg**.\n• Cardio y pasos diarios (8–10 mil) como extra.\n• Objetivo: perder 0,5–1 % del peso por semana.`;
    }],
    [/ganar (musculo|masa|peso)|volumen|crecer|hipertrofia/, () => {
      const kg = latestBW();
      return `Para ganar músculo:\n\n• **Ligero superávit**: +200–300 kcal sobre tu mantenimiento${kg ? ` (≈${Math.round(kg * 33)}–${Math.round(kg * 36)} kcal/día)` : ''}.\n• Proteína: **1,6–2,2 g/kg**.\n• **10–20 series por músculo/semana**, 6–15 reps cerca del fallo.\n• Sube peso o reps poco a poco (doble progresión).\n• Duerme 7–9 h.\n\nGanar 0,25–0,5 kg al mes es un buen ritmo.`;
    }],
    [/calorias|cuanto (debo )?comer|mantenimiento/, () => {
      const kg = latestBW();
      if (!kg) return 'Apunta tu peso en **Historial → Progreso** y te calculo una estimación. Como referencia, el mantenimiento suele estar entre **30 y 35 kcal por kg** de peso según tu actividad.';
      return `Con ${fmtKg(kg)} kg, tu mantenimiento aproximado es **${Math.round(kg * 30)}–${Math.round(kg * 35)} kcal/día** (depende de lo activo que seas).\n\n• Perder grasa: ~${Math.round(kg * 30 - 400)} kcal.\n• Ganar músculo: ~${Math.round(kg * 34 + 250)} kcal.\n\nEs una estimación: ajústala viendo cómo cambia tu peso en 2–3 semanas.`;
    }],
    [/antes de entrenar|pre ?entreno|que como antes/, () => '1–3 h antes: una comida con **hidratos y algo de proteína** (p. ej. arroz con pollo, avena con yogur, tostadas con pavo). Si entrenas pronto, algo ligero 30–60 min antes: plátano, yogur o tostada. El café (cafeína) puede ayudar al rendimiento.'],
    [/despues de entrenar|post ?entreno|que como despues/, () => 'Después de entrenar, una comida normal con **20–40 g de proteína** e hidratos en las 2 h siguientes es suficiente. No hace falta correr a por el batido.'],
    [/motiva|no tengo ganas|pereza|desmotivad/, () => pick([
      '💪 No hace falta tener ganas, hace falta empezar. Ponte la ropa, ve al gym y haz solo el primer ejercicio: el resto viene solo.',
      '🔥 La constancia gana a la intensidad. Un entreno «regular» hoy vale más que el entreno perfecto que nunca haces.',
      '🏆 Mira tu historial: cada serie que marcas es progreso. ¡Vamos a sumar otra!'
    ])],
    [/cardio y pesas|orden.*(cardio|pesas)|cardio antes|cardio despues/, () => 'Si tu objetivo es ganar fuerza o músculo, haz **primero las pesas** y después el cardio (o en otro momento del día). Un calentamiento corto de cardio antes sí está bien.'],
    [/principiante|empezar en el gym|soy nuevo|primera vez/, () => 'Para empezar:\n\n1. **3 días por semana de full body** en máquinas (son más fáciles de aprender).\n2. **2–3 series** de 10–12 reps por ejercicio, sin llegar al fallo.\n3. Aprende la técnica: toca cada ejercicio para ver la **animación** y los pasos.\n4. Sube peso cuando completes todas las reps.\n\n¿Te creo ya una rutina full body?'],
    [/supersere|superserie|biserie/, () => 'Una **superserie** son 2 ejercicios seguidos sin descanso (p. ej. curl + extensión de tríceps). Ahorra tiempo y va bien para músculos opuestos. Descansa al terminar los dos.'],
    [/abdominal(es)? (marcad|plano)|six ?pack|tableta/, () => 'Para que se marquen los abdominales influye sobre todo el **porcentaje de grasa** (dieta). Entrénalos 2–3 veces/semana con carga progresiva (máquina, polea, elevaciones de piernas) como cualquier otro músculo.']
  ];
  const latestBW = () => { const b = S().bw.slice().sort((a, c) => c.t - a.t)[0]; return b ? b.kg : 0; };

  function exInfo(e) {
    const hist = sessionsOf(e.id), b = bestOf(e.id);
    let txt = `**${e.n}** (${e.g})\nTrabaja: **${e.p.map(m => D.MUSCLES[m]).join(', ')}**${e.s.length ? ` · también ${e.s.map(m => D.MUSCLES[m]).join(', ')}` : ''}.\n\n`;
    if (e.steps.length) txt += 'Cómo hacerlo:\n' + e.steps.map((s, i) => `${i + 1}. ${s}`).join('\n') + '\n\n';
    if (e.errs.length) txt += 'Evita: ' + e.errs.join(' · ') + '.\n';
    if (b && e.t === 'r') txt += `\nTu mejor serie: **${fmtKg(b.kg)} kg × ${b.reps}** (1RM ≈ ${fmtKg(Math.round(b.e1))} kg) en ${hist.length} sesiones.`;
    return out(txt, [{ label: '🎬 Ver animación', type: 'openEx', payload: e.id }, { label: '🔄 Alternativas', type: 'ask', payload: 'alternativas a ' + e.n }]);
  }

  function alternatives(e) {
    const alts = allEx().filter(x => x.id !== e.id && x.p.some(m => e.p.includes(m)) && x.t !== 'c')
      .sort((a, b) => b.p.filter(m => e.p.includes(m)).length - a.p.filter(m => e.p.includes(m)).length).slice(0, 6);
    if (!alts.length) return out(`No encuentro alternativas claras a **${e.n}**.`);
    return out(`Alternativas a **${e.n}** que trabajan ${listJoin(e.p.map(m => D.MUSCLES[m].toLowerCase()))}:\n\n` + alts.map(a => `• **${a.n}** — ${a.e.map(k => (D.EQUIP[k] || [k])[0]).join(', ')}`).join('\n'),
      alts.slice(0, 4).map(a => ({ label: a.n, type: 'openEx', payload: a.id })));
  }

  function progressSummary() {
    const st = S(), ws = st.workouts.slice().sort((a, b) => b.start - a.start);
    if (!ws.length) return out('Aún no tienes entrenos guardados. Cuando completes el primero podré decirte tu progreso, récords y qué músculos llevas más o menos trabajados. 💪', [{ label: '▶ Entreno libre', type: 'startEmpty' }]);
    const wk = Date.now() - 7 * 864e5, week = ws.filter(w => w.start >= wk);
    const vol = w => w.items.reduce((v, it) => exOf(it.ex).t === 'r' ? v + doneSets(it).reduce((a, s) => a + num(s.kg) * num(s.reps), 0) : v, 0);
    const prs = ws.flatMap(w => (w.prs || []).map(p => ({ ...p, t: w.start }))).slice(0, 5);
    const last = lastTrainedByGroup();
    const forgotten = D.GROUPS.filter(g => g !== 'Cardio' && hoursAgo(last[g]) > 8 * 24);
    let txt = `📊 **Tu resumen**\n• Entrenos totales: **${ws.length}**\n• Últimos 7 días: **${week.length}** entrenos · ${fmtKg(Math.round(week.reduce((a, w) => a + vol(w), 0)))} kg de volumen\n• Último: ${ws[0].name} (${fmtDate(ws[0].start)})`;
    if (prs.length) txt += '\n\n🏆 **Récords recientes**\n' + prs.map(p => `• ${exOf(p.ex).n}: ${p.txt}`).join('\n');
    if (forgotten.length) txt += `\n\n👀 Hace más de una semana que no entrenas: ${listJoin(forgotten.map(g => g.toLowerCase()))}.`;
    return out(txt, [{ label: '¿Qué entreno hoy?', type: 'ask', payload: '¿Qué entreno hoy?' }]);
  }

  function exProgress(e) {
    const hist = sessionsOf(e.id);
    if (!hist.length) return out(`Aún no has hecho **${e.n}**. Añádelo a una rutina y aquí verás tu evolución.`, [{ label: '🎬 Ver ejercicio', type: 'openEx', payload: e.id }]);
    const b = bestOf(e.id);
    const lines = hist.slice(0, 5).map(({ it, date }) => `• ${fmtDate(date)}: ${doneSets(it).map(s => e.t === 'r' ? `${fmtKg(num(s.kg))}×${num(s.reps)}` : `${num(s.reps || s.min || s.sec)}`).join(', ')}`);
    let txt = `📈 **${e.n}**\n${b && e.t === 'r' ? `Mejor serie: **${fmtKg(b.kg)} kg × ${b.reps}** · máximo ${fmtKg(maxKg(e.id))} kg · 1RM ≈ **${fmtKg(Math.round(b.e1))} kg**\n` : ''}\nÚltimas sesiones:\n${lines.join('\n')}`;
    if (e.t === 'r' && hist.length >= 2) {
      const top = x => Math.max(...doneSets(x.it).map(s => e1rm(num(s.kg), num(s.reps))));
      const d = top(hist[0]) - top(hist[hist.length - 1]);
      txt += `\n\n${d > 0 ? `🔺 Has mejorado unos **${fmtKg(Math.round(d))} kg** de 1RM estimado desde la primera vez.` : '➖ Sin mejora de 1RM respecto a la primera vez: prueba la doble progresión (pregúntame «¿cómo progreso?»).'}`;
      const lastSets = doneSets(hist[0].it), maxReps = Math.max(...lastSets.map(s => num(s.reps)));
      if (maxReps >= 12) txt += `\n💡 La última vez llegaste a ${maxReps} reps: **sube el peso un 2,5–5 %** la próxima sesión.`;
    }
    return out(txt, [{ label: '🎬 Ver ejercicio', type: 'openEx', payload: e.id }]);
  }

  function oneRM(t) {
    const m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos)?\s*(?:x|por|a|×)\s*(\d+)/);
    if (!m) return null;
    const kg = num(m[1]), reps = +m[2];
    if (!kg || !reps || reps > 20) return out('Dime el peso y las repeticiones así: «**80 kg x 6**» (hasta 20 reps).');
    const rm = e1rm(kg, reps);
    const tab = [[95, 2], [90, 4], [85, 6], [80, 8], [75, 10], [70, 12], [65, 15]].map(([p, r]) => `• ${p} % → **${fmtKg(Math.round(rm * p / 100 * 2) / 2)} kg** (~${r} reps)`).join('\n');
    return out(`Con **${fmtKg(kg)} kg × ${reps}**, tu 1RM estimado es **${fmtKg(Math.round(rm * 2) / 2)} kg** (fórmula de Epley).\n\nPesos de referencia:\n${tab}`);
  }

  function splitPlan(n, t) {
    const goal = goalOf(t), pref = EQUIP_PREF(t);
    const P = {
      1: [['Full body', ['Cuádriceps y piernas', 'Pecho', 'Espalda', 'Hombros', 'Isquiotibiales', 'Abdominales y core']]],
      2: [['Full body A', ['Cuádriceps y piernas', 'Pecho', 'Espalda', 'Hombros', 'Abdominales y core']], ['Full body B', ['Isquiotibiales', 'Glúteos y abductores', 'Espalda', 'Pecho', 'Bíceps y antebrazos', 'Tríceps']]],
      3: [['Full body A', ['Cuádriceps y piernas', 'Pecho', 'Espalda', 'Hombros', 'Abdominales y core']], ['Full body B', ['Isquiotibiales', 'Glúteos y abductores', 'Espalda', 'Pecho', 'Bíceps y antebrazos', 'Tríceps']], ['Full body C', ['Cuádriceps y piernas', 'Hombros', 'Espalda', 'Pecho', 'Gemelos', 'Abdominales y core']]],
      4: [['Torso A', ['Pecho', 'Espalda', 'Hombros', 'Bíceps y antebrazos', 'Tríceps']], ['Pierna A', ['Cuádriceps y piernas', 'Isquiotibiales', 'Glúteos y abductores', 'Gemelos']], ['Torso B', ['Espalda', 'Pecho', 'Hombros', 'Tríceps', 'Bíceps y antebrazos']], ['Pierna B', ['Glúteos y abductores', 'Isquiotibiales', 'Cuádriceps y piernas', 'Abdominales y core']]],
      5: [['Empuje', ['Pecho', 'Hombros', 'Tríceps']], ['Tirón', ['Espalda', 'Bíceps y antebrazos']], ['Pierna', ['Cuádriceps y piernas', 'Isquiotibiales', 'Glúteos y abductores', 'Gemelos']], ['Torso', ['Pecho', 'Espalda', 'Hombros', 'Bíceps y antebrazos', 'Tríceps']], ['Pierna y glúteo', ['Glúteos y abductores', 'Isquiotibiales', 'Cuádriceps y piernas', 'Abdominales y core']]],
      6: [['Empuje A', ['Pecho', 'Hombros', 'Tríceps']], ['Tirón A', ['Espalda', 'Bíceps y antebrazos']], ['Pierna A', ['Cuádriceps y piernas', 'Isquiotibiales', 'Gemelos']], ['Empuje B', ['Hombros', 'Pecho', 'Tríceps']], ['Tirón B', ['Espalda', 'Bíceps y antebrazos', 'Abdominales y core']], ['Pierna B', ['Glúteos y abductores', 'Isquiotibiales', 'Cuádriceps y piernas']]]
    };
    n = Math.max(1, Math.min(6, n));
    const DAYSETS = { 1: [2], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] };
    const routines = P[n].map(([name, gs], i) => {
      const r = buildRoutine(gs, { goal, pref, name, days: [DAYSETS[n][i]] });
      r.color = COLORS[i % COLORS.length];
      return r;
    });
    const txt = `Plan de **${n} ${n === 1 ? 'día' : 'días'}** para ${goal.label} (${goal.reps} reps):\n\n` + routines.map(r => `**${DAYS[r.days[0]]} · ${r.name}**\n${r.items.map(it => '• ' + exOf(it.ex).n + ` ${it.sets}×${it.reps}`).join('\n')}`).join('\n\n') + '\n\nDescansa los días libres. Si quieres otros días, guárdalo y cámbialos en cada rutina.';
    return out(txt, [{ label: `💾 Crear las ${routines.length} rutinas`, type: 'savePlan', payload: routines }]);
  }

  function whatToday() {
    const st = S(), today = st.routines.filter(r => (r.days || []).includes(dow()));
    if (today.length) {
      const r = today[0];
      return out(`Hoy (${DAYS[dow()].toLowerCase()}) te toca **${r.name}**:\n\n${routineText(r)}`, [{ label: '▶ Empezar ' + r.name, type: 'startRoutineId', payload: r.id }]);
    }
    const last = lastTrainedByGroup();
    const combos = [['Pecho', 'Tríceps'], ['Espalda', 'Bíceps y antebrazos'], ['Cuádriceps y piernas', 'Isquiotibiales', 'Glúteos y abductores', 'Gemelos'], ['Hombros', 'Abdominales y core']];
    const score = c => Math.min(...c.map(g => hoursAgo(last[g])));
    const best = combos.slice().sort((a, b) => score(b) - score(a))[0];
    const yesterday = st.workouts.some(w => hoursAgo(w.start) < 20);
    const r = buildRoutine(best, { name: best.length > 3 ? 'Pierna' : best.map(g => g.split(' ')[0]).join(' + ') });
    const why = score(best) === Infinity ? 'aún no los has entrenado' : `hace ${Math.round(score(best) / 24)} días o más que no los trabajas`;
    return out(`No tienes rutina para hoy. Te recomiendo **${r.name}** porque ${why}${yesterday ? ' (ayer entrenaste otros músculos, así que estos están descansados)' : ''}:\n\n${routineText(r)}`, routineActions(r));
  }

  function exercisesFor(groups) {
    const list = allEx().filter(e => groups.includes(e.g)).slice(0, 12);
    return out(`Ejercicios de **${listJoin(groups.map(g => g.toLowerCase()))}** (toca para ver la animación):\n\n` + list.map(e => `• **${e.n}** — ${e.p.map(m => D.MUSCLES[m]).join(', ')}`).join('\n'),
      list.slice(0, 6).map(e => ({ label: e.n, type: 'openEx', payload: e.id })).concat([{ label: '🏋️ Crear rutina con estos', type: 'ask', payload: 'crea una rutina de ' + groups.join(' y ').toLowerCase() }]));
  }

  const HELP = 'Soy **GymBro** 🤜🤛, tu compañero de gym. Puedo:\n\n• **Crear rutinas**: «hazme una rutina de pecho y tríceps de 45 min para el lunes»\n• **Planes semanales**: «plan de 4 días para ganar músculo»\n• Decirte **qué entrenar hoy** según tu historial\n• Explicar la **técnica** de cualquier ejercicio y darte **alternativas**\n• Ver tu **progreso y récords**: «¿cómo voy en prensa?»\n• Calcular tu **1RM**: «100 kg x 5»\n• Dudas de **series, reps, descanso, proteína, creatina, agujetas, definir o volumen…**\n\nFunciono sin conexión, con los datos de tu móvil.';
  const SUGGEST = [{ label: '¿Qué entreno hoy?', type: 'ask', payload: '¿Qué entreno hoy?' }, { label: 'Plan de 4 días', type: 'ask', payload: 'Hazme un plan de 4 días para ganar músculo' }, { label: 'Mi progreso', type: 'ask', payload: '¿Cómo voy?' }];

  function reply(raw) {
    const t = norm(raw);
    if (!t) return out('Escríbeme algo 🙂');
    if (/^(hola|buenas|hey|ey|que tal|holi|wenas|buenos dias|buenas tardes)\b/.test(t) && t.split(' ').length <= 4) {
      const name = S().profile.name;
      return out(`¡${pick(['Qué pasa', 'Hola', 'Buenas'])}${name ? ', ' + name : ''}! 💪 ¿Qué entrenamos hoy?\n\n` + HELP.split('\n\n')[1], SUGGEST);
    }
    if (/^(gracias|genial|perfecto|ok|vale|guay|crack|top)\b/.test(t)) return out(pick(['¡A tope! 💪', '¡Para eso estoy, bro! 🤜🤛', '¡Vamos a por ello! 🔥']));
    if (/ayuda|que puedes hacer|que sabes|como funcionas|quien eres/.test(t)) return out(HELP, SUGGEST);

    const r1 = /1\s*rm|rm\b|repeticion maxima|maximo teorico|calcula/.test(t) || /\d+\s*(kg|kilos)?\s*(x|×)\s*\d+/.test(t) ? oneRM(t) : null;
    if (r1) return r1;

    const ex = findExercise(t);
    const groups = groupsIn(t);
    const wantsRoutine = /rutina|entreno de|entrenamiento de|sesion de|dia de|hazme|creame|crea |monta|genera|disena|preparame|dame un entreno/.test(t);
    const wantsPlan = /plan|split|semana|dias a la semana|dias por semana|veces (a|por) (la )?semana/.test(t) && (daysPerWeek(t) || /plan|split/.test(t));

    if (/que (entreno|hago|toca|entrenar)|que deberia entrenar|que me toca/.test(t) && !groups.length) return whatToday();
    if (wantsPlan && !(wantsRoutine && groups.length && !/plan|split/.test(t))) return splitPlan(daysPerWeek(t) || S().profile.goal || 4, t);
    if (wantsRoutine && (groups.length || !ex)) {
      const goal = goalOf(t), mins = minutes(t), days = parseDays(t);
      const n = mins ? Math.max(3, Math.min(10, Math.round(mins / 8))) : 0;
      const r = buildRoutine(groups, { n, goal, pref: EQUIP_PREF(t), days });
      return out(`Aquí tienes una rutina de **${r.name}** para ${goal.label}${days.length ? ` (${days.map(d => DAYS[d].toLowerCase()).join(', ')})` : ''}, descanso ${restTxt(goal.rest)}:\n\n${routineText(r)}\n\n¿La guardo?`, routineActions(r));
    }
    if (ex && /alternativ|sustitu|en vez de|reemplaz|cambiar|ocupad|no tengo|me molesta|me duele/.test(t)) return alternatives(ex);
    if (ex && /progreso|como voy|record|maximo|cuanto (levanto|hago|muevo)|evolucion|mejor marca/.test(t)) return exProgress(ex);
    if (/como voy|mi progreso|resumen|estadistica|mis record|cuantos entrenos|mi historial/.test(t)) return progressSummary();
    for (const [re, fn] of TIPS) if (re.test(t)) return out(fn(), /principiante|empezar|nuevo/.test(t) ? [{ label: '🏋️ Rutina full body', type: 'ask', payload: 'crea una rutina full body en máquinas' }] : []);
    if (ex) return exInfo(ex);
    if (groups.length) return exercisesFor(groups);
    return out('No te he entendido del todo 🤔. Prueba con algo como:\n\n• «Rutina de espalda y bíceps de 1 hora»\n• «Plan de 3 días»\n• «¿Cómo se hace el hip thrust?»\n• «Alternativas a la prensa»\n• «¿Cuánta proteína necesito?»', SUGGEST);
  }

  return { reply, HELP, SUGGEST };
};
