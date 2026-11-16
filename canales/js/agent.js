/* Agente de crecimiento: analiza tus canales, puntúa vídeos virales del nicho, genera títulos,
   etiquetas, descripciones, kits de promoción, respuestas a comentarios y misiones diarias.
   Todo funciona en el móvil, sin conexión y sin cuentas extra. */
(function () {
  'use strict';
  const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const STOP = new Set('a al algo ante así aunque bien cada como con contra cual cuando de del desde donde dos el ella ellos en entre era es esa ese eso esta este esto estos fue ha hacer han hasta hay la las le les lo los más me mi mis mucho muy nada ni no nos o os para pero poco por porque que qué quien se ser si sí sin sobre son su sus también te tengo ti tiene todo tu tus un una uno unos y ya yo vs the of to and in for is on with you your my how what this that it i are be at from new video videos vídeo vídeos parte part ep episodio shorts short official oficial'.split(' '));

  const fmt = v => { v = Number(v) || 0; if (v >= 1e9) return (v / 1e9).toFixed(1).replace('.0', '') + ' mil M'; if (v >= 1e6) return (v / 1e6).toFixed(1).replace('.0', '') + ' M'; if (v >= 1e4) return Math.round(v / 1e3) + ' mil'; if (v >= 1e3) return (v / 1e3).toFixed(1).replace('.0', '') + ' mil'; return String(Math.round(v)); };
  const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];
  const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const words = s => String(s || '').toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}\s#]/gu, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));

  // ---------- análisis de un canal ----------
  function analyze(ch) {
    const vids = (ch && ch.recent) || [];
    if (!vids.length) return null;
    const now = Date.now();
    const ageD = v => Math.max(1, (now - new Date(v.published).getTime()) / 86400000);
    const longs = vids.filter(v => !v.short), shorts = vids.filter(v => v.short);
    const views = vids.map(v => v.views);
    const med = median(views);
    // Ritmo: vídeos publicados en los últimos 28 días
    const last28 = vids.filter(v => ageD(v) <= 28).length;
    // Mejor día y hora (media de visitas por día de publicación)
    const byDay = {}, byHour = {};
    vids.forEach(v => {
      const d = new Date(v.published);
      const k = d.getDay(), h = d.getHours();
      (byDay[k] = byDay[k] || []).push(v.views);
      (byHour[h] = byHour[h] || []).push(v.views);
    });
    const best = obj => Object.entries(obj).filter(([, a]) => a.length).map(([k, a]) => [Number(k), a.reduce((x, y) => x + y, 0) / a.length, a.length]).sort((a, b) => b[1] - a[1])[0];
    const bd = best(byDay), bh = best(byHour);
    const top = [...vids].sort((a, b) => b.views - a.views)[0];
    const outliers = vids.filter(v => med && v.views >= med * 2.2).slice(0, 5);
    const flops = vids.filter(v => ageD(v) > 7 && med && v.views < med * 0.45).slice(0, 5);
    const eng = vids.reduce((a, v) => a + (v.views ? (v.likes + v.comments) / v.views : 0), 0) / vids.length;
    const half = Math.floor(vids.length / 2);
    const recentMed = median(vids.slice(0, half).map(v => v.views)), olderMed = median(vids.slice(half).map(v => v.views));
    const trend = olderMed ? (recentMed - olderMed) / olderMed : 0;
    const lastAge = ageD(vids[0]);
    const wordsTop = topWords([...outliers, top].filter(Boolean).map(v => v.title).join(' '), 6);
    return {
      median: med, avg: views.reduce((a, b) => a + b, 0) / views.length, last28, perWeek: last28 / 4,
      bestDay: bd ? DAYS[bd[0]] : null, bestDayN: bd ? bd[0] : null, bestHour: bh ? bh[0] : null,
      top, outliers, flops, eng, trend, lastAge, shorts: shorts.length, longs: longs.length,
      shortsMed: median(shorts.map(v => v.views)), longsMed: median(longs.map(v => v.views)), wordsTop
    };
  }

  function nextMilestone(subs) {
    const m = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1e6, 2e6, 5e6, 1e7];
    const next = m.find(x => x > subs) || subs * 2;
    const prev = [...m].reverse().find(x => x <= subs) || 0;
    return { next, prev, pct: next > prev ? (subs - prev) / (next - prev) : 0 };
  }

  // ---------- virales ----------
  function scoreViral(v) {
    const days = Math.max(0.5, (Date.now() - new Date(v.published).getTime()) / 86400000);
    const vpd = v.views / days;
    const subs = (v.ch && v.ch.subs) || 0;
    const ratio = subs ? v.views / subs : 0; // veces sus suscriptores
    const eng = v.views ? (v.likes + v.comments * 2) / v.views : 0;
    // Puntuación 0-100: velocidad (log), ventaja sobre el tamaño del canal y participación
    const sSpeed = Math.min(1, Math.log10(vpd + 1) / 6);
    const sRatio = Math.min(1, Math.log10(ratio + 1) / 2);
    const sEng = Math.min(1, eng / 0.08);
    const score = Math.round(100 * (0.5 * sSpeed + 0.35 * sRatio + 0.15 * sEng));
    return Object.assign(v, { vpd, ratio, eng, days, score });
  }

  function topWords(text, n = 12) {
    const f = {};
    words(text).forEach(w => { f[w] = (f[w] || 0) + 1; });
    return Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w);
  }

  function patterns(items) {
    if (!items.length) return null;
    const t = items.map(v => v.title);
    const pct = re => Math.round(100 * t.filter(x => re.test(x)).length / t.length);
    const tagF = {};
    items.forEach(v => (v.tags || []).forEach(tg => { const k = tg.toLowerCase().trim(); if (k.length > 2) tagF[k] = (tagF[k] || 0) + 1; }));
    const tags = Object.entries(tagF).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k]) => k);
    const avgLen = Math.round(t.reduce((a, x) => a + x.length, 0) / t.length);
    const durs = items.filter(v => !v.short).map(v => v.secs);
    return {
      avgLen, numbers: pct(/\d/), questions: pct(/[?¿]/), caps: pct(/\b[A-ZÁÉÍÓÚÑ]{4,}\b/), emoji: pct(/\p{Extended_Pictographic}/u),
      paren: pct(/[([|]/), you: pct(/\b(tú|tu|te|ti|you|your)\b/i), words: topWords(t.join(' '), 14), tags,
      medDur: durs.length ? Math.round(median(durs) / 60) : 0, shortsPct: Math.round(100 * items.filter(v => v.short).length / items.length),
      bestHour: (() => { const h = {}; items.forEach(v => { const x = new Date(v.published).getHours(); h[x] = (h[x] || 0) + v.score; }); const e = Object.entries(h).sort((a, b) => b[1] - a[1])[0]; return e ? Number(e[0]) : null; })()
    };
  }

  // Canales de tamaño parecido en los resultados → posibles colaboraciones
  function collabs(items, mySubs) {
    const seen = new Set(), out = [];
    items.forEach(v => {
      const c = v.ch;
      if (!c || seen.has(c.id)) return;
      seen.add(c.id);
      const r = mySubs ? c.subs / mySubs : 1;
      if (!mySubs || (r >= 0.25 && r <= 6)) out.push(Object.assign({ hit: v.title, hitViews: v.views }, c));
    });
    return out.sort((a, b) => b.hitViews - a.hitViews).slice(0, 8);
  }

  // ---------- títulos ----------
  const TPL = [
    'Probé {t} durante 30 días y esto pasó',
    'Nadie te cuenta esto sobre {t}',
    '{n} errores de {t} que te están frenando',
    'Así es {t} de verdad (sin filtros)',
    'El MEJOR truco de {t} que he encontrado',
    '¿Merece la pena {t} en {y}?',
    'De 0 a experto en {t} en 10 minutos',
    '{t}: lo que nadie esperaba',
    'Hice {t} con 0 € (y funcionó)',
    'He reaccionado al {t} más viral',
    '{n} cosas que ojalá hubiera sabido antes de {t}',
    'Por qué todo el mundo habla de {t}',
    '{t} vs {t2}: ¿cuál gana?',
    'Intenté el reto de {t} más difícil',
    'Lo que pasa cuando haces {t} cada día',
    'La verdad sobre {t} que nadie dice',
    'Guía DEFINITIVA de {t} ({y})',
    'No hagas {t} sin ver esto',
    '{t} en 60 segundos',
    'Esto cambió mi forma de ver {t}'
  ];
  function scoreTitle(title, ctx = {}) {
    const t = String(title || '').trim();
    const tips = [];
    let s = 50;
    const len = t.length;
    if (len >= 35 && len <= 65) s += 14; else if (len < 25) { s -= 8; tips.push('Muy corto: añade el beneficio o la curiosidad.'); } else if (len > 75) { s -= 10; tips.push('Largo: en el móvil se corta a ~60 caracteres.'); } else s += 5;
    if (/\d/.test(t)) s += 7; else tips.push('Prueba con un número concreto (3, 7, 30 días…).');
    if (/[?¿]/.test(t) || /\b(por qué|cómo|qué|nadie|secreto|verdad|nunca|error|probé|intenté)\b/i.test(t)) s += 10; else tips.push('Añade curiosidad: «por qué», «nadie», «la verdad»…');
    if (/\b(tú|tu|te|ti)\b/i.test(t)) s += 5;
    if (/\b[A-ZÁÉÍÓÚÑ]{4,}\b/.test(t)) s += 4;
    if ((t.match(/\b[A-ZÁÉÍÓÚÑ]{2,}\b/g) || []).length > 3) { s -= 10; tips.push('Demasiadas MAYÚSCULAS: usa una sola palabra.'); }
    if (/[!]{2,}|[?]{2,}/.test(t)) { s -= 6; tips.push('Evita signos repetidos (!!!).'); }
    if (/\b(parte|ep\.?|episodio|vlog)\s*\d/i.test(t)) { s -= 8; tips.push('«Parte 2/Vlog 14» no atrae a gente nueva.'); }
    const kws = (ctx.keywords || []).filter(Boolean);
    if (kws.length) { if (kws.some(k => t.toLowerCase().includes(k.toLowerCase()))) s += 8; else tips.push('Incluye una palabra clave de tu nicho al principio.'); }
    return { score: Math.max(5, Math.min(99, Math.round(s))), tips: tips.slice(0, 3) };
  }
  function titles(topic, opts = {}) {
    topic = String(topic || '').trim();
    if (!topic) return [];
    const kws = (opts.keywords || []).filter(Boolean);
    const t2 = kws.find(k => !topic.toLowerCase().includes(k.toLowerCase())) || 'lo de siempre';
    const y = new Date().getFullYear();
    const seed = hash(topic);
    const out = new Set();
    const order = TPL.map((x, i) => [x, (hash(x) ^ seed) % 997]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
    order.forEach((p, i) => out.add(p.replace(/\{t\}/g, topic).replace('{t2}', t2).replace('{y}', y).replace('{n}', [3, 5, 7, 10][(seed + i) % 4])));
    // Variantes inspiradas en los títulos virales del nicho
    (opts.viral || []).slice(0, 6).forEach(v => {
      const w = topWords(v.title, 2);
      if (w.length) out.add(cap(`${topic}: ${v.title.length < 50 ? 'mi versión de «' + v.title.replace(/[«»"]/g, '') + '»' : 'lo que aprendí de ' + w.join(' y ')}`));
    });
    return [...out].map(t => Object.assign({ t }, scoreTitle(t, { keywords: kws }))).sort((a, b) => b.score - a.score).slice(0, opts.n || 12);
  }

  function hooks(topic) {
    topic = topic || 'esto';
    return [
      `Si haces ${topic}, para un segundo: estás cometiendo este error.`,
      `En 30 segundos te enseño lo que a mí me costó meses con ${topic}.`,
      `Nadie habla de esto sobre ${topic}… y debería.`,
      `Esto es lo que pasa cuando pruebas ${topic} de verdad.`,
      `¿${cap(topic)}? Mira hasta el final, el último paso es el importante.`
    ];
  }

  function shortIdeas(video) {
    const t = video ? video.title : 'tu último vídeo';
    return [
      `El momento más fuerte de «${t}» en 30 s con subtítulos grandes y pregunta al final.`,
      `«3 cosas que no sabías» sacadas de «${t}» (una por cada 15 s).`,
      `Reacción/opinión rápida a un comentario de «${t}» (responde con vídeo).`,
      `Antes y después / resultado final de «${t}» en bucle perfecto.`,
      `Bloopers o tomas falsas de «${t}» con un rótulo «vídeo completo en el canal».`
    ];
  }

  // ---------- descripciones y etiquetas ----------
  function description({ title, topic, channel, others = [], tags = [], links = '' }) {
    const hs = tags.slice(0, 3).map(t => '#' + t.replace(/[^\p{L}\p{N}]/gu, '')).filter(x => x.length > 2);
    const lines = [
      `${title || topic || ''}`.trim(),
      '',
      `En este vídeo: ${topic || title || 'te cuento todo paso a paso'}. Si te aporta algo, suscríbete y activa la 🔔 para no perderte el siguiente.`,
      '',
      '⏱️ Capítulos',
      '00:00 Introducción',
      '00:30 …',
      '',
      '📌 Mis otros canales:',
      ...(others.length ? others.map(o => `▶ ${o.title}${o.handle ? ' — https://youtube.com/' + o.handle : ''}`) : ['▶ (conecta tus canales en Ajustes)']),
      links ? '\n🔗 ' + links : '',
      '',
      '💬 Cuéntame en los comentarios: ¿qué vídeo quieres que haga después?',
      '',
      hs.join(' ')
    ];
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function suggestTags(title, niche, viralTags = []) {
    const base = [...words(title), ...words(niche)];
    const set = new Set();
    if (niche) set.add(niche.toLowerCase().trim());
    base.forEach(w => set.add(w));
    if (base.length >= 2) set.add(base.slice(0, 2).join(' '));
    viralTags.slice(0, 15).forEach(t => set.add(t));
    const out = [];
    let total = 0;
    for (const t of set) { if (total + t.length + 1 > 480) break; out.push(t); total += t.length + 1; }
    return out.slice(0, 30);
  }

  // ---------- promoción ----------
  function promoKit(video, channel, others = []) {
    const t = video.title || 'mi nuevo vídeo';
    const url = video.id ? 'https://youtu.be/' + video.id : (channel && channel.handle ? 'https://youtube.com/' + channel.handle : '');
    const name = channel ? channel.title : 'mi canal';
    const tagWords = topWords(t + ' ' + ((channel && channel.niche) || ''), 3).map(w => '#' + w);
    const hs = tagWords.join(' ');
    return [
      { net: 'X / Twitter', ic: '𝕏', key: 'x', text: `${t} 👇\n\nTe lo cuento todo en el vídeo nuevo de ${name}:\n${url}\n\n${hs}` },
      { net: 'Instagram / TikTok', ic: '📸', key: 'ig', text: `${t} 🔥\n\nVídeo completo en YouTube (enlace en la bio) → ${name}\n\n¿Lo habías probado? Cuéntamelo 👇\n\n${hs} #youtube #nuevovideo` },
      { net: 'WhatsApp / Telegram', ic: '💬', key: 'wa', text: `¡He subido vídeo nuevo! «${t}». Si te gusta, un like y un comentario me ayudan muchísimo 🙏\n${url}` },
      { net: 'Comunidad de YouTube', ic: '📣', key: 'community', text: `🚨 VÍDEO NUEVO: «${t}»\n\nPregunta rápida antes de verlo 👇\n¿Qué crees que pasa al final?\n🅰️ Sale bien\n🅱️ Sale fatal\n\n(Ponlo como encuesta y enlaza el vídeo)` },
      { net: 'Comentario fijado', ic: '📌', key: 'pin', text: `Gracias por verlo 🙌 ¿Qué parte te ha gustado más? Respondo a todos los comentarios de hoy.\n\nSi quieres más, en ${others.length ? others.map(o => o.title).join(' y ') : 'mis otros canales'} subo contenido parecido 👀` },
      { net: 'Reddit / foros', ic: '🧵', key: 'reddit', text: `${t} — he hecho un vídeo con lo que aprendí (resumen en los comentarios)\n\nResumen: 1) … 2) … 3) …\n\nVídeo por si alguien quiere el detalle: ${url}\n\n(Lee las normas del subforo: aporta valor en el post, no solo el enlace.)` },
      { net: 'Guion de Short (gancho)', ic: '⚡', key: 'short', text: hooks(topWords(t, 2).join(' ') || t).slice(0, 3).map((h, i) => `${i + 1}. ${h}`).join('\n') + `\n\nCierre: «El vídeo completo está en el canal, enlazado aquí arriba.»` }
    ];
  }

  function crossPromo(chs) {
    const live = chs.filter(c => c.title);
    if (live.length < 2) return ['Conecta al menos 2 canales para planificar promoción cruzada entre ellos.'];
    const out = [];
    live.forEach(a => live.filter(b => b !== a).forEach(b => {
      out.push(`En la pantalla final de los vídeos de **${a.title}**, añade un elemento «Canal» que lleve a **${b.title}**.`);
    }));
    out.push('Pon una sección «Canales destacados» en la página de cada canal con los otros dos.');
    out.push('Haz 1 vídeo al mes de colaboración entre tus canales (uno presenta al otro) y enlázalos en la descripción.');
    out.push('Comenta desde un canal en el vídeo nuevo de otro (solo 1 comentario útil, nada de spam).');
    return out;
  }

  // ---------- comentarios ----------
  function classify(text) {
    const t = String(text || '').toLowerCase();
    if (/[?¿]|\b(cómo|como se|qué|que app|cuál|cual|dónde|donde|cuándo|cuando|puedes|podrías|se puede)\b/.test(t)) return 'pregunta';
    if (/\b(haz|hazlo|sube|subid|podrías hacer|próximo|proximo|siguiente|parte 2|segunda parte)\b/.test(t)) return 'peticion';
    if (/\b(malo|aburrido|mentira|clickbait|peor|no me gusta|fatal|basura|cringe)\b/.test(t)) return 'critica';
    if (/\b(genial|increíble|increible|crack|me encanta|buenísimo|buenisimo|top|mejor|gracias|grande|brutal|❤|🔥|👏)\b/.test(t) || /[❤🔥👏😍🙌]/u.test(t)) return 'elogio';
    return 'otro';
  }
  function replyFor(c) {
    const kind = classify(c.text);
    const name = (c.author || '').replace(/^@/, '').split(/\s+/)[0];
    const s = hash(c.id || c.text);
    const R = {
      pregunta: [`¡Buena pregunta, ${name}! Te respondo: … Si quieres lo explico en un vídeo entero 😉`, `Hola ${name}: … ¿Te ha quedado claro? Si no, dímelo y lo amplío.`],
      peticion: [`¡Apuntado, ${name}! 📝 Si este comentario llega a 20 likes lo hago seguro.`, `Me lo apunto para los próximos vídeos, ${name} 🙌 ¿Algo más que quieras ver?`],
      critica: [`Gracias por decirlo, ${name}. ¿Qué cambiarías tú? Lo tengo en cuenta para el siguiente 🙏`, `Entiendo, ${name}. Intento mejorar en cada vídeo: ¿qué te habría gustado ver?`],
      elogio: [`¡Mil gracias, ${name}! 🔥 Me alegra mucho que te haya gustado. ¿Qué quieres para el siguiente?`, `¡Gracias, ${name}! ❤️ Comentarios así me animan a seguir. ¿Desde dónde me ves?`],
      otro: [`¡Gracias por comentar, ${name}! 🙌`, `¡Jaja, gracias ${name}! ¿Qué te ha parecido el resto del vídeo?`]
    };
    return { kind, text: pick(R[kind], s) };
  }

  // ---------- misiones diarias ----------
  function missions(chs, plan, today) {
    const live = chs.map((c, i) => Object.assign({ slot: i }, c)).filter(c => c.title);
    const seed = hash(today);
    const out = [];
    const add = (id, text, xp, act, slot) => out.push({ id, text, xp, act, slot });
    if (!live.length) {
      add('conectar', 'Conecta tu primer canal de YouTube', 50, 'ajustes');
      add('nicho', 'Escribe el nicho y las palabras clave de cada canal', 20, 'ajustes');
      add('idea3', 'Apunta 3 ideas de vídeo en el tablero', 20, 'plan');
      return out;
    }
    const c = live[seed % live.length];
    const c2 = live[(seed + 1) % live.length];
    const a = analyze(c);
    add('com-' + c.slot, `Responde 5 comentarios en ${c.title}`, 25, 'comentarios', c.slot);
    add('vir-' + c2.slot, `Busca los vídeos virales del nicho de ${c2.title} y guarda 2 ideas`, 20, 'virales', c2.slot);
    if (a && a.top) add('short-' + c.slot, `Saca un Short del vídeo «${a.top.title.slice(0, 50)}» (es tu más visto)`, 30, 'ideas', c.slot);
    const lastV = c.recent && c.recent[0];
    if (lastV) add('promo-' + c.slot, `Comparte «${lastV.title.slice(0, 50)}» en 2 redes`, 20, 'promo', c.slot);
    const pending = plan.filter(p => p.stage !== 'publicado' && p.date && p.date <= today);
    if (pending.length) add('plan-late', `Tienes ${pending.length} vídeo${pending.length > 1 ? 's' : ''} en el tablero para hoy o atrasado${pending.length > 1 ? 's' : ''}: muévelos`, 15, 'plan');
    else add('plan-next', 'Programa en el tablero el próximo vídeo de cada canal', 15, 'plan');
    if (live.length > 1) add('cross', `Añade una pantalla final en ${c.title} que lleve a ${c2.title}`, 15, 'promo', c.slot);
    add('community-' + c2.slot, `Publica una encuesta en la pestaña Comunidad de ${c2.title}`, 15, 'promo', c2.slot);
    if (a && a.flops.length) add('fix-' + c.slot, `Cambia título o miniatura de «${a.flops[0].title.slice(0, 40)}» (rinde por debajo de lo normal)`, 25, 'ideas', c.slot);
    return out.slice(0, 6);
  }

  // ---------- consejos del agente para un canal ----------
  function insights(ch) {
    const a = analyze(ch);
    if (!a) return ['Conecta el canal para que el agente analice tus vídeos.'];
    const out = [];
    if (a.lastAge > 10) out.push(`⏰ Llevas **${Math.round(a.lastAge)} días** sin publicar. Los canales que publican cada semana crecen más rápido: programa uno ya.`);
    if (a.perWeek < 1) out.push(`📅 Publicas ~${a.perWeek.toFixed(1)} vídeos/semana. Objetivo: **1 largo + 3 Shorts por semana**.`);
    if (a.bestDay) out.push(`📈 Tus vídeos publicados en **${a.bestDay}** sobre las **${a.bestHour}:00** son los que más visitas tienen. Programa ahí.`);
    if (a.outliers.length) out.push(`🔥 «${a.outliers[0].title}» hizo **${(a.outliers[0].views / Math.max(1, a.median)).toFixed(1)}×** tu media: haz una segunda parte o una versión mejorada.`);
    if (a.shorts && a.longs && a.shortsMed > a.longsMed * 1.5) out.push(`⚡ Tus Shorts tienen ${fmt(a.shortsMed)} visitas de mediana frente a ${fmt(a.longsMed)} los largos: úsalos de escaparate con enlace al vídeo largo.`);
    if (!a.shorts) out.push('⚡ No tienes Shorts recientes: son la forma más rápida de conseguir suscriptores nuevos. Saca 3 de tu mejor vídeo.');
    if (a.eng < 0.03) out.push('💬 Participación baja: termina cada vídeo con una pregunta concreta y fija un comentario.');
    if (a.trend > 0.2) out.push(`🚀 Tus últimos vídeos rinden **${Math.round(a.trend * 100)}% más** que los anteriores. ¡No cambies de rumbo!`);
    if (a.trend < -0.2) out.push(`📉 Los últimos vídeos rinden ${Math.round(-a.trend * 100)}% menos. Revisa títulos y miniaturas y vuelve a los temas de tus mejores vídeos (${a.wordsTop.slice(0, 3).join(', ')}).`);
    return out.slice(0, 5);
  }

  window.AGENT = { analyze, nextMilestone, scoreViral, patterns, collabs, titles, scoreTitle, hooks, shortIdeas, description, suggestTags, promoKit, crossPromo, classify, replyFor, missions, insights, topWords, fmt, median, DAYS };
})();
