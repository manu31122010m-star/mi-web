/* Ilustraciones animadas de los ejercicios: un muñeco articulado (cinemática directa e inversa)
   dibujado en SVG sobre la máquina o el material, con los músculos que trabajan resaltados. */
(function () {
  'use strict';
  const L = { torso: 46, neck: 6, head: 8.5, ua: 26, fa: 24, hand: 6, th: 36, sn: 35, foot: 12 };
  const RAD = Math.PI / 180;
  const cos = a => Math.cos(a * RAD), sin = a => Math.sin(a * RAD);
  const add = (p, a, len) => [p[0] + cos(a) * len, p[1] + sin(a) * len];
  const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD;
  const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mid = (a, b, f = .5) => [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
  const r1 = n => Math.round(n * 10) / 10;
  const ease = t => .5 - Math.cos(Math.PI * t) / 2;

  // Mezcla dos poses (números y coordenadas se interpolan)
  function mix(A, B, t) {
    const o = {};
    for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const a = k in A ? A[k] : B[k], b = k in B ? B[k] : A[k];
      if (typeof a === 'number') o[k] = lerp(a, b, t);
      else if (Array.isArray(a)) o[k] = a.map((v, i) => typeof v === 'number' ? lerp(v, b[i], t) : v);
      else o[k] = t < .5 ? a : b;
    }
    return o;
  }

  // Dos huesos: raíz → articulación media → extremo que busca el objetivo
  function ik(root, target, a, b, bend) {
    let d = dist(root, target);
    d = Math.min(Math.max(d, Math.abs(a - b) + .5), a + b - .05);
    const A = Math.acos(Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d)))) / RAD;
    const m = add(root, ang(root, target) + bend * A, a);
    return [m, add(m, ang(m, target), b)];
  }

  const ARM = ['ua', 'fa', 'hand', 'handAt', 'eb', 'uaR', 'faR', 'wr', 'uaL', 'faL'];
  const LEG = ['th', 'sn', 'foot', 'kb', 'ft', 'ftR', 'thL', 'snL', 'ftL'];
  const pick = (P, keys) => { const o = {}; keys.forEach(k => { if (P[k] !== undefined) o[k] = P[k]; }); return o; };
  const pickFar = (P, keys) => {
    if (!keys.some(k => P[k + '2'] !== undefined)) return pick(P, keys);
    const o = {}; keys.forEach(k => { if (P[k + '2'] !== undefined) o[k] = P[k + '2']; }); return o;
  };

  function limb(root, s, arm, t, mirror, cx, front) {
    const la = (arm ? L.ua : L.th) * ((arm ? s.uaL : s.thL) ?? 1);
    const lb = (arm ? L.fa : L.sn) * ((arm ? s.faL : s.snL) ?? 1);
    const tgt = arm ? s.hand : s.foot;
    let m, e;
    if (tgt) {
      let p = tgt, bend = (arm ? s.eb : s.kb) ?? 1;
      if (mirror) { p = [2 * cx - p[0], p[1]]; bend = -bend; }
      [m, e] = ik(root, p, la, lb, bend);
    } else {
      let a1 = arm ? (s.uaR != null ? t + s.uaR : (s.ua ?? 90)) : (s.th ?? 90);
      let a2 = arm ? (s.faR != null ? a1 + s.faR : (s.fa ?? a1)) : (s.sn ?? a1);
      if (mirror) { a1 = 180 - a1; a2 = 180 - a2; }
      m = add(root, a1, la); e = add(m, a2, lb);
    }
    const seg = ang(m, e);
    let tip;
    if (arm) tip = add(e, seg + (s.wr || 0) * (mirror ? -1 : 1), L.hand);
    else {
      let ft = s.ft ?? (front ? 90 : seg + (s.ftR ?? -90));
      if (mirror && s.ft != null) ft = 180 - ft;
      tip = add(e, ft, L.foot * (s.ftL ?? (front ? .35 : 1)));
    }
    return [m, e, tip];
  }

  function solve(P, Q, tpl) {
    const front = tpl.view === 'front';
    const J = { hip: P.hip };
    const t = P.shp ? ang(P.hip, P.shp) : (P.t ?? -90);
    J.t = t; J.d = [cos(t), sin(t)]; J.n = tpl.flip ? [sin(t), -cos(t)] : [-sin(t), cos(t)]; J.flip = !!tpl.flip;
    J.shoulder = add(P.hip, t, L.torso);
    J.neck = add(J.shoulder, t + (P.hd || 0), L.neck);
    J.head = add(J.shoulder, t + (P.hd || 0), L.neck + L.head);
    const aN = pick(P, ARM), lN = pick(P, LEG);
    const aF = Q ? pick(Q, ARM) : pickFar(P, ARM), lF = Q ? pick(Q, LEG) : pickFar(P, LEG);
    const cx = P.hip[0];
    let rA = J.shoulder, rA2 = J.shoulder, rL = P.hip, rL2 = P.hip;
    if (front) {
      const tw = P.tw ?? 1, sl = P.sl || 0;
      J.tw = tw; J.sl = sl;
      J.shR = rA = [J.shoulder[0] + 13 * tw, J.shoulder[1] + 4 + sl];
      J.shL = rA2 = [J.shoulder[0] - 13 * tw, J.shoulder[1] + 4 + sl];
      J.hipR = rL = [cx + 7, P.hip[1]]; J.hipL = rL2 = [cx - 7, P.hip[1]];
    }
    for (const s of [aN, aF]) if (s.handAt) { const [j, dx, dy] = s.handAt; s.hand = [J[j][0] + dx, J[j][1] + dy]; }
    [J.elbow, J.hand, J.handTip] = limb(rA, aN, true, t, false, cx, front);
    [J.elbow2, J.hand2, J.handTip2] = limb(rA2, aF, true, t, front, cx, front);
    [J.knee, J.ankle, J.toe] = limb(rL, lN, false, t, false, cx, front);
    [J.knee2, J.ankle2, J.toe2] = limb(rL2, lF, false, t, front, cx, front);
    J.mid = mid(J.hand, J.hand2);
    J.chest = add(mid(J.hip, J.shoulder, .75), t + 90, 9);
    return J;
  }

  // ---------- dibujo ----------
  const ln = (a, b, w, c) => `<line x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0])}" y2="${r1(b[1])}" stroke-width="${w}" class="${c}"/>`;
  const ci = (c, r, cl) => `<circle cx="${r1(c[0])}" cy="${r1(c[1])}" r="${r}" class="${cl}"/>`;
  const poly = (pts, cl) => `<polygon points="${pts.map(p => r1(p[0]) + ',' + r1(p[1])).join(' ')}" class="${cl}"/>`;

  function hotFn(ex) {
    const P = new Set(ex.p || []), S = new Set(ex.s || []);
    return (...ms) => ms.some(m => P.has(m)) ? ' hot' : ms.some(m => S.has(m)) ? ' warm' : '';
  }

  function hair(J, front) {
    const h = J.head, r = L.head + .6, t = J.t;
    const [a0, a1] = front ? [t - 95, t + 95] : J.flip ? [t - 35, t + 100] : [t - 100, t + 35];
    const p0 = add(h, a0, r), p1 = add(h, a1, r);
    return `<path class="hair" d="M${r1(p0[0])} ${r1(p0[1])} A${r} ${r} 0 0 1 ${r1(p1[0])} ${r1(p1[1])} Z"/>`;
  }

  function figSide(J, hot) {
    const { hip, shoulder, n, d } = J;
    const far = `<g class="far">${ln(J.knee2, J.ankle2, 10, 'b' + hot('calves', 'tibialis'))}${ln(J.ankle2, J.toe2, 6, 'b')}${ln(hip, J.knee2, 12.5, 'b' + hot('quads', 'hamstrings', 'adductors', 'abductors'))}
      ${ln(J.elbow2, J.hand2, 8, 'b' + hot('forearms'))}${ln(J.hand2, J.handTip2, 6, 'b')}${ln(shoulder, J.elbow2, 9, 'b' + hot('biceps', 'triceps'))}</g>`;
    const m = mid(hip, shoulder, .5);
    const off = (p, k) => [p[0] + n[0] * k, p[1] + n[1] * k];
    const h1 = add(hip, J.t, 3), s1 = add(shoulder, J.t, -3);
    const q = (a, b, k1, k2, ms) => { const c = hot(...ms); return c ? poly([a, b, off(b, k2), off(a, k1)], 'tq' + c) : ''; };
    const torso = `${ci(off(hip, -2.5), 7.5, 'b' + hot('glutes', 'abductors'))}${ln(hip, shoulder, 17, 'b')}
      ${q(h1, m, 7, 8, ['abs', 'obliques'])}${q(m, s1, 8, 8.5, ['chest'])}${q(h1, m, -7, -8, ['lowerback'])}${q(m, s1, -8, -8.5, ['lats', 'upperback', 'traps'])}
      ${ln(shoulder, J.neck, 7, 'b')}${ci(J.head, L.head, 'b head')}${hair(J, false)}`;
    void d;
    const near = `${ln(hip, J.knee, 12.5, 'b' + hot('quads', 'hamstrings', 'adductors', 'abductors'))}${ln(J.knee, J.ankle, 10, 'b' + hot('calves', 'tibialis'))}${ln(J.ankle, J.toe, 6, 'b')}`;
    const arm = `${ci(shoulder, 6.5, 'b' + hot('delts', 'rear', 'rotator'))}${ln(shoulder, J.elbow, 9, 'b' + hot('biceps', 'triceps'))}${ln(J.elbow, J.hand, 8, 'b' + hot('forearms'))}${ln(J.hand, J.handTip, 6, 'b')}`;
    return { far, torso: torso + near, near: arm };
  }

  function figFront(J, hot) {
    const { hip, shoulder } = J, cx = hip[0], hy = hip[1], tw = J.tw;
    const sy = shoulder[1] + 2 + J.sl, wy = hy - 9, my = (sy + wy) / 2;
    const leg = (h, k, a, t, s) => `${ln(h, k, 12.5, 'b' + hot('quads', 'hamstrings', 'adductors', 'abductors'))}${ln(k, a, 10, 'b' + hot('calves', 'tibialis'))}${ln(a, t, 6, 'b')}`;
    const legs = leg(J.hipL, J.knee2, J.ankle2, J.toe2) + leg(J.hipR, J.knee, J.ankle, J.toe);
    const sx = shoulder[0], mx = (sx + cx) / 2;
    const up = [[sx - 15 * tw, sy], [sx + 15 * tw, sy], [mx + 11, my], [mx - 11, my]];
    const lo = [[mx - 11, my], [mx + 11, my], [cx + 10, wy], [cx - 10, wy]];
    const pel = [[cx - 10, wy], [cx + 10, wy], [cx + 12, hy + 5], [cx - 12, hy + 5]];
    const torso = `${poly(pel, 'tb' + hot('glutes', 'abductors'))}${poly(lo, 'tb' + hot('abs', 'obliques', 'lowerback'))}${poly(up, 'tb' + hot('chest', 'lats', 'upperback', 'traps'))}
      ${ln([sx, sy], J.neck, 7, 'b')}${ci(J.head, L.head, 'b head')}${hair(J, true)}`;
    const arm = (s, e, h, tip) => `${ci(s, 6.5, 'b' + hot('delts', 'rear', 'rotator'))}${ln(s, e, 9, 'b' + hot('biceps', 'triceps'))}${ln(e, h, 8, 'b' + hot('forearms'))}${ln(h, tip, 6, 'b')}`;
    return { far: legs, torso, near: arm(J.shL, J.elbow2, J.hand2, J.handTip2) + arm(J.shR, J.elbow, J.hand, J.handTip) };
  }

  function pt(s, J) {
    if (typeof s === 'string') return J[s];
    if (Array.isArray(s)) return s;
    let p;
    if (s.seg) { const a = J[s.seg[0]], b = J[s.seg[1]]; p = mid(a, b, s.f ?? .5); if (s.perp) p = add(p, ang(a, b) + 90, s.perp); }
    else p = J[s.j].slice();
    if (s.n) p = [p[0] + J.n[0] * s.n, p[1] + J.n[1] * s.n];
    if (s.al) p = [p[0] + J.d[0] * s.al, p[1] + J.d[1] * s.al];
    return [p[0] + (s.dx || 0), p[1] + (s.dy || 0)];
  }

  function staticSVG(list) {
    return list.map(it => {
      const [k, ...a] = it;
      if (k === 's') return ln([a[0], a[1]], [a[2], a[3]], a[4], a[5] || 'eq');
      if (k === 'c') return ci([a[0], a[1]], a[2], a[3] || 'eq');
      if (k === 'r') return `<rect x="${a[0]}" y="${a[1]}" width="${a[2]}" height="${a[3]}" rx="2" class="${a[4] || 'eqf'}"/>`;
      if (k === 'p') return `<path d="${a[0]}" class="${a[1] || 'eq'}"/>`;
      return '';
    }).join('');
  }

  function dynSVG(it, J, p) {
    switch (it.k) {
      case 'line': return ln(pt(it.a, J), pt(it.b, J), it.w || 4, it.cls || 'eq');
      case 'cable': return ln(pt(it.a, J), pt(it.b, J), 1.4, 'cable');
      case 'circle': return ci(pt(it.c, J), it.r || 5, it.cls || 'pad');
      case 'grip': return ci(pt(it.c, J), it.r || 3.2, 'grip');
      case 'plate': { const c = pt(it.c, J); return ci(c, it.r || 12, 'plate') + ci(c, 2.6, 'hub'); }
      case 'db': { const c = pt(it.c, J); return ci(c, it.r || 6.5, 'plate') + ci(c, 1.8, 'hub'); }
      case 'dbF': { const c = pt(it.c, J); return ln([c[0] - 8, c[1]], [c[0] + 8, c[1]], 2.5, 'eq') + `<rect x="${r1(c[0] - 10)}" y="${r1(c[1] - 5)}" width="4" height="10" rx="1.5" class="plateF"/><rect x="${r1(c[0] + 6)}" y="${r1(c[1] - 5)}" width="4" height="10" rx="1.5" class="plateF"/>`; }
      case 'bar2': { const a = J.hand2, b = J.hand, g = ang(a, b); return ln(add(a, g, -(it.ext ?? 10)), add(b, g, it.ext ?? 10), it.w || 3.5, 'eq'); }
      case 'plateLine': { const c = pt(it.c, J); return ln(add(c, it.ang, -it.len / 2), add(c, it.ang, it.len / 2), it.w || 5, it.cls || 'eq'); }
      case 'stack': {
        let s = '';
        const n = it.n || 9, w = it.w || 16;
        for (let i = 0; i < n; i++) {
          const lift = i >= n - 3 ? p * (it.travel || 20) : 0;
          s += `<rect x="${it.x}" y="${r1(it.y - (i + 1) * 5.2 - lift)}" width="${w}" height="4.4" rx="1" class="stack"/>`;
        }
        return s;
      }
      case 'band': return ln(pt(it.a, J), pt(it.b, J), it.w || 2.5, 'band');
      case 'ball': return ci(pt(it.c, J), it.r || 9, 'ballc');
      case 'kb': { const c = pt(it.c, J); return `<path d="M${r1(c[0] - 4)} ${r1(c[1] + 3)} Q${r1(c[0])} ${r1(c[1] - 5)} ${r1(c[0] + 4)} ${r1(c[1] + 3)}" class="eq" stroke-width="2.5"/>` + ci([c[0], c[1] + 8], it.r || 6.5, 'plate'); }
      case 'rot': { const c = pt(it.c, J), a = lerp(it.a0, it.a1, p); return ln(add(c, a, -(it.off || 0)), add(c, a, it.len - (it.off || 0)), it.w || 6, it.cls || 'eq'); }
      case 'wave': {
        const a = pt(it.a, J), b = pt(it.b, J), n = 14, amp = it.amp || 6, ph = (J.ph || 0) * Math.PI * 2;
        let d = `M${r1(a[0])} ${r1(a[1])}`;
        for (let i = 1; i <= n; i++) { const f = i / n, q = mid(a, b, f), w = Math.sin(f * 9 - ph * (it.dir || 1)) * amp * (1 - f * .6); d += ` L${r1(q[0])} ${r1(q[1] + w)}`; }
        return `<path d="${d}" class="rope wave" fill="none" stroke-width="3"/>`;
      }
      case 'jumprope': {
        const a = J.hand, b = J.hand2, th = (J.ph || 0) * Math.PI * 2, c = [100 + 34 * Math.cos(th), 104 + 96 * Math.sin(th)];
        return `<path d="M${r1(a[0])} ${r1(a[1])} Q${r1(2 * c[0] - (a[0] + b[0]) / 2)} ${r1(2 * c[1] - (a[1] + b[1]) / 2)} ${r1(b[0])} ${r1(b[1])}" class="rope" fill="none" stroke-width="2"/>`;
      }
      case 'water': return `<path d="M0 ${it.y} ${Array.from({ length: 11 }, (_, i) => `Q${i * 20 + 5} ${it.y - 4 + 8 * ((i + Math.floor((J.ph || 0) * 4)) % 2)} ${i * 20 + 10} ${it.y} T${i * 20 + 20} ${it.y}`).join(' ')}" class="water" fill="none"/>`;
      case 'crank': { const c = it.c; return ci(c, 9, 'eqo') + ln(c, J.ankle, 3, 'eq') + ln(c, J.ankle2, 3, 'eq2'); }
      default: return '';
    }
  }

  // ---------- plantillas ----------
  const FLOOR = 188;
  const seat = (x1, x2, y, post) => [['s', x1, y, x2, y, 8, 'pad'], ['s', post ?? (x1 + x2) / 2, y + 4, post ?? (x1 + x2) / 2, FLOOR, 4, 'eq']];
  const pad = (x1, y1, x2, y2, w = 9) => ['s', x1, y1, x2, y2, w, 'pad'];
  const tower = (x, top = 30, w = 22) => [['s', x, top, x, FLOOR, 4, 'eq'], ['s', x + w, top, x + w, FLOOR, 4, 'eq'], ['s', x - 2, top, x + w + 2, top, 4, 'eq'], ['s', x + w / 2 - 3, top + 4, x + w / 2 - 3, FLOOR - 4, 1, 'eq2'], ['s', x + w / 2 + 3, top + 4, x + w / 2 + 3, FLOOR - 4, 1, 'eq2']];
  const stack = (x, travel = 22, w = 22) => ({ k: 'stack', x: x + 3, y: FLOOR - 2, w: w - 6, travel, z: 'back' });
  const pulley = (x, y) => ['c', x, y, 4, 'eqo'];
  const SIT = { hip: [80, 148], t: -90, th: -2, sn: 92 };
  const STAND = { hip: [100, 113], t: -90, th: 90, sn: 90 };
  const SIT_F = { hip: [100, 140], t: -90, th: 72, thL: .38, sn: 90 };
  const STAND_F = { hip: [100, 113], t: -90, th: 86, sn: 90 };
  const frontSeat = [pad(83, 52, 83, 146, 0), ['r', 82, 56, 36, 88, 'padf'], ['s', 84, 149, 116, 149, 10, 'pad'], ['s', 100, 154, 100, FLOOR, 5, 'eq']];
  const D45 = [.707, -.707];

  const T = {};

  // --- Pecho ---
  T.chestPress = {
    st: [...tower(16), pad(66, 92, 66, 150), ...seat(64, 100, 156, 84), ['s', 150, 24, 150, FLOOR, 5, 'eq'], ['s', 38, 24, 152, 24, 4, 'eq']],
    frames: [{ ...SIT, hip: [80, 148], hand: [90, 112], eb: 1 }, { ...SIT, hip: [80, 148], hand: [127, 110], eb: 1 }],
    dyn: [{ k: 'line', a: [150, 30], b: 'hand', w: 4, z: 'back' }, { k: 'line', a: { j: 'hand', dy: -7 }, b: { j: 'hand', dy: 7 }, w: 4 }, stack(16)]
  };
  T.convergent = {
    ...T.chestPress,
    frames: [{ ...SIT, hip: [80, 148], hand: [90, 116], eb: 1 }, { ...SIT, hip: [80, 148], hand: [126, 118], eb: 1 }],
    dyn: [{ k: 'line', a: [150, 70], b: 'hand', w: 5, z: 'back' }, { k: 'line', a: { j: 'hand', dy: -7 }, b: { j: 'hand', dy: 7 }, w: 4 }, stack(16)],
    st: [...tower(16), pad(66, 92, 66, 150), ...seat(64, 100, 156, 84), ['s', 150, 60, 150, FLOOR, 5, 'eq'], ['c', 150, 70, 4, 'eqo']]
  };
  T.inclineMachine = {
    st: [...tower(14), pad(70, 154, 46, 104), ...seat(66, 100, 158, 84), ['s', 150, 20, 150, FLOOR, 5, 'eq']],
    frames: [{ hip: [84, 150], t: -115, th: -8, sn: 92, hand: [80, 102], eb: 1 }, { hip: [84, 150], t: -115, th: -8, sn: 92, hand: [92, 62], eb: 1 }],
    dyn: [{ k: 'line', a: [150, 26], b: 'hand', w: 4, z: 'back' }, { k: 'line', a: { j: 'hand', dx: -6, dy: -3 }, b: { j: 'hand', dx: 6, dy: 3 }, w: 4 }, stack(14)]
  };
  T.pecDeck = {
    view: 'front', st: [...frontSeat, ['s', 40, 20, 160, 20, 4, 'eq'], ['s', 40, 20, 40, FLOOR, 4, 'eq'], ['s', 160, 20, 160, FLOOR, 4, 'eq']],
    frames: [{ ...SIT_F, ua: -4, fa: -92, uaL: 1 }, { ...SIT_F, ua: -4, fa: -100, uaL: .28 }],
    dyn: [{ k: 'line', a: 'elbow', b: 'hand', w: 7, cls: 'pad' }, { k: 'line', a: 'elbow2', b: 'hand2', w: 7, cls: 'pad' }, { k: 'line', a: { j: 'hand', dy: -4 }, b: [150, 24], w: 2, cls: 'eq2', z: 'back' }, { k: 'line', a: { j: 'hand2', dy: -4 }, b: [50, 24], w: 2, cls: 'eq2', z: 'back' }]
  };
  T.flyMachine = {
    view: 'front', st: [...frontSeat, ['s', 40, 20, 160, 20, 4, 'eq'], ['s', 40, 20, 40, FLOOR, 4, 'eq'], ['s', 160, 20, 160, FLOOR, 4, 'eq']],
    frames: [{ ...SIT_F, ua: 2, fa: 8, uaL: 1, faL: 1 }, { ...SIT_F, ua: 2, fa: 8, uaL: .3, faL: .3 }],
    dyn: [{ k: 'line', a: { j: 'hand', dy: -6 }, b: { j: 'hand', dy: 6 }, w: 4 }, { k: 'line', a: { j: 'hand2', dy: -6 }, b: { j: 'hand2', dy: 6 }, w: 4 }, { k: 'line', a: 'hand', b: [150, 24], w: 2, cls: 'eq2', z: 'back' }, { k: 'line', a: 'hand2', b: [50, 24], w: 2, cls: 'eq2', z: 'back' }]
  };
  T.crossover = {
    view: 'front', st: [['s', 178, 18, 178, FLOOR, 5, 'eq'], ['s', 22, 18, 22, FLOOR, 5, 'eq'], pulley(174, 26), pulley(26, 26)],
    frames: [{ ...STAND_F, th: 82, ua: -28, fa: -22 }, { ...STAND_F, th: 82, ua: 112, fa: 118 }],
    dyn: [{ k: 'cable', a: [174, 26], b: 'hand' }, { k: 'cable', a: [26, 26], b: 'hand2' }, { k: 'grip', c: 'hand' }, { k: 'grip', c: 'hand2' }]
  };

  // --- Espalda ---
  T.latPulldown = {
    view: 'front', st: [...frontSeat, ['s', 100, 4, 100, 12, 3, 'eq'], pulley(100, 12), ['s', 80, 132, 120, 132, 8, 'pad']],
    frames: [{ ...SIT_F, hand: [142, 26], eb: 1 }, { ...SIT_F, hand: [130, 90], eb: 1 }],
    dyn: [{ k: 'cable', a: [100, 12], b: 'mid', z: 'back' }, { k: 'bar2', ext: 12 }]
  };
  T.closePulldown = {
    st: [...seat(62, 100, 156, 80), ['s', 120, 4, 120, FLOOR, 5, 'eq'], pulley(98, 8), ['s', 98, 8, 120, 8, 3, 'eq'], pad(108, 136, 126, 136, 8)],
    frames: [{ ...SIT, t: -92, hand: [98, 30], eb: 1 }, { ...SIT, t: -100, hand: [92, 104], eb: 1 }],
    dyn: [{ k: 'cable', a: [98, 8], b: 'hand', z: 'back' }, { k: 'line', a: { j: 'hand', dx: -4, dy: 3 }, b: { j: 'hand', dx: 5, dy: 2 }, w: 4 }]
  };
  T.seatedRow = {
    st: [['s', 30, 168, 140, 168, 8, 'pad'], ['s', 40, 172, 40, FLOOR, 4, 'eq'], ['s', 130, 172, 130, FLOOR, 4, 'eq'], ['s', 148, 142, 148, 180, 5, 'eq'], ['s', 160, 30, 160, FLOOR, 4, 'eq'], ['s', 182, 30, 182, FLOOR, 4, 'eq'], ['s', 158, 30, 184, 30, 4, 'eq'], pulley(156, 158)],
    frames: [{ hip: [70, 160], t: -78, foot: [138, 160], kb: -1, ft: -80, hand: [134, 148], eb: 1 }, { hip: [70, 160], t: -96, foot: [138, 160], kb: -1, ft: -80, hand: [86, 136], eb: 1 }],
    dyn: [{ k: 'cable', a: [156, 158], b: 'hand', z: 'back' }, { k: 'line', a: { j: 'hand', dy: -5 }, b: { j: 'hand', dy: 5 }, w: 4 }, stack(160)]
  };
  T.chestRow = {
    st: [...seat(54, 84, 158, 70), pad(98, 146, 110, 122, 10), ['s', 104, 128, 112, FLOOR, 4, 'eq'], ['s', 150, 40, 150, FLOOR, 5, 'eq']],
    frames: [{ hip: [70, 150], t: -66, th: 18, sn: 96, hand: [124, 130], eb: 1 }, { hip: [70, 150], t: -66, th: 18, sn: 96, hand: [88, 122], eb: 1 }],
    dyn: [{ k: 'line', a: [150, 46], b: 'hand', w: 4, z: 'back' }, { k: 'line', a: { j: 'hand', dy: -6 }, b: { j: 'hand', dy: 6 }, w: 4 }]
  };
  T.rowUni = { ...T.chestRow, far: { hand2: [124, 130], eb2: 1 } };
  T.pullover = {
    st: [...tower(16), pad(66, 90, 66, 150), ...seat(64, 100, 156, 84)],
    frames: [{ ...SIT, ua: -112, fa: -104 }, { ...SIT, ua: 72, fa: 66 }],
    dyn: [{ k: 'line', a: [80, 100], b: 'elbow', w: 5, z: 'back' }, { k: 'circle', c: 'elbow', r: 5.5, cls: 'pad' }, stack(16)]
  };
  T.assistedPullup = {
    st: [['s', 86, 22, 146, 22, 4, 'eq'], ['s', 146, 10, 146, FLOOR, 5, 'eq'], ['s', 166, 10, 166, FLOOR, 5, 'eq'], ['s', 144, 10, 168, 10, 4, 'eq']],
    frames: [{ hip: [100, 120], t: -93, th: 92, sn: 182, hand: [106, 22], eb: 1, ft: 180 }, { hip: [102, 86], t: -96, th: 92, sn: 182, hand: [106, 22], eb: 1, ft: 180 }],
    dyn: [{ k: 'line', a: { j: 'knee', dx: -26, dy: 6 }, b: { j: 'knee', dx: 6, dy: 6 }, w: 7, cls: 'pad' }, { k: 'line', a: { j: 'knee', dx: 4, dy: 8 }, b: [148, 172], w: 4 }, { k: 'stack', x: 149, y: FLOOR - 2, w: 14, travel: -18, z: 'back' }]
  };
  T.backExt = {
    st: [['s', 30, 176, 96, 120, 5, 'eq'], ['s', 30, 176, 30, FLOOR, 4, 'eq'], ['s', 92, 124, 104, FLOOR, 4, 'eq'], pad(84, 144, 100, 131, 9), ['c', 33, 160, 5, 'pad'], ['s', 22, 168, 34, 182, 5, 'eq']],
    frames: [{ hip: [94, 124], t: 62, th: 140, sn: 140, ft: -130, uaR: 150, faR: 18 }, { hip: [94, 124], t: -40, th: 140, sn: 140, ft: -130, uaR: 150, faR: 18 }]
  };

  // --- Hombro ---
  T.shoulderPress = {
    view: 'front', st: [...frontSeat, ['s', 160, 30, 160, FLOOR, 4, 'eq'], ['s', 40, 30, 40, FLOOR, 4, 'eq']],
    frames: [{ ...SIT_F, hand: [132, 86], eb: 1 }, { ...SIT_F, hand: [124, 44], eb: 1 }],
    dyn: [{ k: 'line', a: { j: 'hand', dx: -5 }, b: { j: 'hand', dx: 5 }, w: 4 }, { k: 'line', a: { j: 'hand2', dx: -5 }, b: { j: 'hand2', dx: 5 }, w: 4 }, { k: 'line', a: 'hand', b: [160, 120], w: 3, cls: 'eq2', z: 'back' }, { k: 'line', a: 'hand2', b: [40, 120], w: 3, cls: 'eq2', z: 'back' }]
  };
  T.lateralMachine = {
    view: 'front', st: [...frontSeat, ['s', 160, 50, 160, FLOOR, 4, 'eq'], ['s', 40, 50, 40, FLOOR, 4, 'eq']],
    frames: [{ ...SIT_F, ua: 84, fa: 90, faL: .4 }, { ...SIT_F, ua: -4, fa: 90, faL: .4 }],
    dyn: [{ k: 'circle', c: { seg: ['shR', 'elbow'], f: .85, perp: -6 }, r: 5.5 }, { k: 'circle', c: { seg: ['shL', 'elbow2'], f: .85, perp: 6 }, r: 5.5 }, { k: 'line', a: 'shR', b: { seg: ['shR', 'elbow'], f: .85, perp: -6 }, w: 3, cls: 'eq2', z: 'back' }, { k: 'line', a: 'shL', b: { seg: ['shL', 'elbow2'], f: .85, perp: 6 }, w: 3, cls: 'eq2', z: 'back' }]
  };
  T.rearDelt = {
    view: 'front', st: [['r', 84, 64, 32, 70, 'padf'], ['s', 84, 149, 116, 149, 10, 'pad'], ['s', 100, 154, 100, FLOOR, 5, 'eq'], ['s', 40, 20, 160, 20, 4, 'eq'], ['s', 40, 20, 40, FLOOR, 4, 'eq'], ['s', 160, 20, 160, FLOOR, 4, 'eq']],
    frames: [{ ...SIT_F, ua: 6, fa: 6, uaL: .3, faL: .3 }, { ...SIT_F, ua: 4, fa: 6, uaL: 1, faL: 1 }],
    dyn: [{ k: 'line', a: { j: 'hand', dy: -6 }, b: { j: 'hand', dy: 6 }, w: 4 }, { k: 'line', a: { j: 'hand2', dy: -6 }, b: { j: 'hand2', dy: 6 }, w: 4 }, { k: 'line', a: 'hand', b: [150, 24], w: 2, cls: 'eq2', z: 'back' }, { k: 'line', a: 'hand2', b: [50, 24], w: 2, cls: 'eq2', z: 'back' }],
    back: true
  };
  T.cableLateral = {
    view: 'front', st: [['s', 22, 20, 22, FLOOR, 5, 'eq'], pulley(28, 180)],
    frames: [{ ...STAND_F, ua: 100, fa: 104, ua2: 96, fa2: 70 }, { ...STAND_F, ua: -6, fa: 0, ua2: 96, fa2: 70 }],
    dyn: [{ k: 'cable', a: [28, 180], b: 'hand' }, { k: 'grip', c: 'hand' }]
  };
  T.shrug = {
    view: 'front', st: [],
    frames: [{ ...STAND_F, ua: 84, fa: 88, sl: 3 }, { ...STAND_F, ua: 84, fa: 88, sl: -7 }],
    dyn: [{ k: 'dbF', c: 'hand' }, { k: 'dbF', c: 'hand2' }]
  };

  // --- Bíceps / antebrazo ---
  const curlSeat = [...seat(60, 92, 156, 76), pad(80, 113, 97, 131, 9), ['s', 110, 132, 110, FLOOR, 4, 'eq']];
  T.machineCurl = {
    st: curlSeat,
    frames: [{ ...SIT, hip: [72, 148], t: -80, th: 2, ua: 46, fa: 38 }, { ...SIT, hip: [72, 148], t: -80, th: 2, ua: 46, fa: -96 }],
    dyn: [{ k: 'line', a: 'elbow', b: 'hand', w: 3, cls: 'eq2', z: 'back' }, { k: 'grip', c: 'hand' }]
  };
  T.preacher = { ...T.machineCurl, dyn: [{ k: 'line', a: { j: 'hand', dx: -1 }, b: { j: 'hand', dx: 1 }, w: 5 }, { k: 'plate', c: 'hand', r: 6 }] };
  T.cableCurl = {
    st: [['s', 168, 20, 168, FLOOR, 5, 'eq'], pulley(162, 180)],
    frames: [{ ...STAND, t: -88, ua: 86, fa: 72 }, { ...STAND, t: -88, ua: 80, fa: -72 }],
    dyn: [{ k: 'cable', a: [162, 180], b: 'hand' }, { k: 'line', a: { j: 'hand', dy: -3 }, b: { j: 'hand', dy: 3 }, w: 5 }]
  };
  T.dbCurl = { st: [], alt: true, frames: [{ ...STAND, ua: 88, fa: 82 }, { ...STAND, ua: 80, fa: -78 }], dyn: [{ k: 'db', c: 'hand' }, { k: 'db', c: 'hand2', z: 'mid' }] };
  T.forearm = {
    st: [...seat(54, 86, 156, 70), pad(88, 122, 124, 122, 8), ['s', 110, 126, 110, FLOOR, 4, 'eq']],
    frames: [{ ...SIT, hip: [70, 148], t: -78, hand: [124, 114], eb: 1, wr: 50 }, { ...SIT, hip: [70, 148], t: -78, hand: [124, 114], eb: 1, wr: -45 }],
    dyn: [{ k: 'line', a: { j: 'handTip', dy: -2 }, b: { j: 'handTip', dy: 4 }, w: 4 }]
  };

  // --- Tríceps ---
  T.pushdown = {
    st: [['s', 150, 6, 150, FLOOR, 5, 'eq'], pulley(140, 12), ['s', 140, 12, 150, 12, 3, 'eq']],
    frames: [{ ...STAND, t: -84, ua: 84, fa: -28 }, { ...STAND, t: -84, ua: 86, fa: 84 }],
    dyn: [{ k: 'cable', a: [140, 12], b: 'hand' }, { k: 'line', a: { j: 'hand', dx: -5, dy: 2 }, b: { j: 'hand', dx: 6, dy: -1 }, w: 4 }]
  };
  T.ropePushdown = { ...T.pushdown, dyn: [{ k: 'cable', a: [140, 12], b: 'hand' }, { k: 'line', a: { j: 'hand', dy: -6 }, b: { j: 'hand', dy: 5 }, w: 3.5, cls: 'rope' }] };
  T.assistedDip = {
    st: [['s', 96, 108, 118, 108, 5, 'eq'], ['s', 118, 108, 118, 30, 4, 'eq'], ['s', 146, 10, 146, FLOOR, 5, 'eq'], ['s', 166, 10, 166, FLOOR, 5, 'eq'], ['s', 118, 30, 168, 30, 4, 'eq']],
    frames: [{ hip: [100, 110], t: -91, th: 92, sn: 182, ft: 180, hand: [106, 108], eb: 1 }, { hip: [96, 132], t: -100, th: 92, sn: 182, ft: 180, hand: [106, 108], eb: 1 }],
    dyn: [{ k: 'line', a: { j: 'knee', dx: -26, dy: 6 }, b: { j: 'knee', dx: 6, dy: 6 }, w: 7, cls: 'pad' }, { k: 'line', a: { j: 'knee', dx: 4, dy: 8 }, b: [148, 176], w: 4 }, { k: 'stack', x: 149, y: FLOOR - 2, w: 14, travel: -18, z: 'back' }]
  };
  T.overheadExt = {
    st: [...tower(16), pad(66, 92, 66, 150), ...seat(64, 100, 156, 84)],
    frames: [{ ...SIT, ua: -78, fa: 148 }, { ...SIT, ua: -80, fa: 276 }],
    dyn: [{ k: 'line', a: { j: 'hand', dx: -4 }, b: { j: 'hand', dx: 4 }, w: 4 }, { k: 'circle', c: 'elbow', r: 4.5, cls: 'pad', z: 'back' }, stack(16)]
  };
  T.machineDip = {
    st: [...tower(16), pad(66, 92, 66, 150), ...seat(64, 100, 156, 84)],
    frames: [{ ...SIT, hand: [92, 112], eb: 1 }, { ...SIT, hand: [90, 150], eb: 1 }],
    dyn: [{ k: 'line', a: { j: 'hand', dx: -4 }, b: { j: 'hand', dx: 8 }, w: 4 }, { k: 'line', a: { j: 'hand', dx: 8 }, b: [56, 176], w: 4, z: 'back' }, stack(16)]
  };

  // --- Piernas ---
  const pressSt = [pad(64, 160, 26, 128), ...seat(62, 92, 160, 76), ['s', 92, 152, 178, 66, 4, 'eq2'], ['s', 30, 176, 186, 176, 4, 'eq'], ['s', 176, 66, 176, 176, 4, 'eq'], ['s', 30, 150, 30, 176, 4, 'eq']];
  const FB = [114, 104], FA = [FB[0] - 30 * D45[0], FB[1] - 30 * D45[1]];
  T.legPress = {
    st: pressSt,
    frames: [{ hip: [70, 152], t: -142, foot: FA, kb: -1, ft: -135, ua: 120, fa: 70 }, { hip: [70, 152], t: -142, foot: FB, kb: -1, ft: -135, ua: 120, fa: 70 }],
    dyn: [{ k: 'plateLine', c: { seg: ['ankle', 'toe'], f: .45, perp: 5 }, ang: 45, len: 44, w: 6 }, { k: 'line', a: { seg: ['ankle', 'toe'], f: .45, perp: 8 }, b: { seg: ['ankle', 'toe'], f: .2, perp: 22 }, w: 4 }, { k: 'plate', c: { seg: ['ankle', 'toe'], f: .2, perp: 22 }, r: 10 }]
  };
  T.gluteLegPress = { ...T.legPress, frames: T.legPress.frames.map(f => ({ ...f, foot: [f.foot[0] - 5, f.foot[1] - 5] })) };
  T.calfPress = {
    st: pressSt,
    frames: [{ hip: [70, 152], t: -142, foot: [FB[0] + 2, FB[1] - 2], kb: -1, ft: -150, ua: 120, fa: 70 }, { hip: [70, 152], t: -142, foot: [FB[0] + 6, FB[1] - 6], kb: -1, ft: -112, ua: 120, fa: 70 }],
    dyn: [{ k: 'plateLine', c: { seg: ['ankle', 'toe'], f: .85, perp: 4 }, ang: 45, len: 44, w: 6 }]
  };
  T.legExt = {
    st: [...seat(62, 104, 154, 80), pad(66, 92, 66, 148), ['s', 120, 150, 120, FLOOR, 4, 'eq']],
    frames: [{ ...SIT, hip: [80, 146], th: 0, sn: 96 }, { ...SIT, hip: [80, 146], th: -2, sn: 4 }],
    dyn: [{ k: 'line', a: 'knee', b: { seg: ['knee', 'ankle'], f: .86, perp: -6 }, w: 3, cls: 'eq2', z: 'back' }, { k: 'circle', c: { seg: ['knee', 'ankle'], f: .86, perp: -6 }, r: 5.5 }]
  };
  T.legExtUni = { ...T.legExt, far: { th2: 0, sn2: 96 } };
  T.hackSquat = {
    st: [['s', 40, 54, 116, 186, 5, 'eq2'], ['s', 102, 186, 140, 176, 6, 'eq'], ['s', 130, 178, 130, FLOOR, 4, 'eq']],
    frames: [{ hip: [86, 114], t: -108, foot: [120, 178], kb: -1, ft: -12, handAt: ['shoulder', 4, -6], eb: 1 }, { hip: [104, 146], t: -108, foot: [120, 178], kb: -1, ft: -12, handAt: ['shoulder', 4, -6], eb: 1 }],
    dyn: [{ k: 'line', a: { j: 'hip', n: -11, al: 2 }, b: { j: 'shoulder', n: -11 }, w: 9, cls: 'pad', z: 'back' }, { k: 'circle', c: { j: 'shoulder', dy: -3 }, r: 5.5 }]
  };
  T.pendulum = {
    ...T.hackSquat,
    st: [['s', 30, 20, 120, 20, 5, 'eq'], ['s', 30, 20, 30, FLOOR, 5, 'eq'], ['s', 102, 186, 140, 176, 6, 'eq']],
    dyn: [{ k: 'line', a: { j: 'hip', n: -11, al: 2 }, b: { j: 'shoulder', n: -11 }, w: 9, cls: 'pad', z: 'back' }, { k: 'line', a: { j: 'shoulder', n: -11 }, b: [30, 24], w: 4, z: 'back' }, { k: 'circle', c: { j: 'shoulder', dy: -3 }, r: 5.5 }]
  };
  const squatFrames = [{ hip: [100, 113], t: -88, foot: [104, 184], kb: -1, handAt: ['shoulder', 10, -2], eb: 1 }, { hip: [80, 146], t: -56, foot: [104, 184], kb: -1, handAt: ['shoulder', 10, -2], eb: 1 }];
  T.smithSquat = {
    st: [['s', 104, 10, 104, FLOOR, 2, 'eq2'], ['s', 40, 10, 168, 10, 5, 'eq'], ['s', 40, 10, 40, FLOOR, 5, 'eq'], ['s', 168, 10, 168, FLOOR, 5, 'eq']],
    frames: squatFrames, dyn: [{ k: 'plate', c: { j: 'shoulder', dx: -2, dy: -3 }, r: 13 }]
  };
  T.backSquat = {
    st: [['s', 44, 14, 44, FLOOR, 5, 'eq'], ['s', 160, 14, 160, FLOOR, 5, 'eq'], ['s', 42, 14, 162, 14, 4, 'eq'], ['s', 44, 120, 160, 120, 3, 'eq2'], ['s', 160, 60, 150, 60, 4, 'eq']],
    frames: squatFrames, dyn: [{ k: 'plate', c: { j: 'shoulder', dx: -4, dy: -2 }, r: 16 }]
  };
  T.machineSquat = {
    st: [['s', 30, 22, 30, FLOOR, 5, 'eq'], ['s', 30, 22, 120, 22, 5, 'eq']],
    frames: squatFrames.map(f => ({ ...f, handAt: ['shoulder', 6, -6] })),
    dyn: [{ k: 'line', a: { j: 'shoulder', dy: -5, dx: -8 }, b: { j: 'shoulder', dy: -5, dx: 10 }, w: 7, cls: 'pad' }, { k: 'line', a: { j: 'shoulder', dy: -5, dx: -8 }, b: [30, 30], w: 4, z: 'back' }]
  };
  T.lunge = {
    st: [], frames: [{ hip: [100, 118], t: -90, foot: [130, 184], kb: -1, foot2: [66, 178], kb2: -1, ft2: 28, ua: 90, fa: 90 }, { hip: [98, 146], t: -88, foot: [130, 184], kb: -1, foot2: [66, 178], kb2: -1, ft2: 28, ua: 90, fa: 90 }],
    dyn: [{ k: 'db', c: 'hand' }, { k: 'db', c: 'hand2', z: 'mid' }]
  };

  // --- Isquios ---
  T.seatedCurl = {
    st: [...seat(58, 100, 152, 76), pad(64, 90, 62, 146), pad(102, 132, 120, 132, 8), ['s', 112, 128, 112, 112, 3, 'eq']],
    frames: [{ hip: [78, 144], t: -98, th: 0, sn: 2, ua: 70, fa: 20 }, { hip: [78, 144], t: -98, th: 0, sn: 102, ua: 70, fa: 20 }],
    dyn: [{ k: 'line', a: 'knee', b: { seg: ['knee', 'ankle'], f: .86, perp: 6 }, w: 3, cls: 'eq2', z: 'back' }, { k: 'circle', c: { seg: ['knee', 'ankle'], f: .86, perp: 6 }, r: 5.5 }]
  };
  T.lyingCurl = {
    st: [pad(40, 142, 160, 134, 9), ['s', 60, 146, 60, FLOOR, 4, 'eq'], ['s', 150, 140, 150, FLOOR, 4, 'eq'], ['s', 162, 130, 170, 150, 4, 'eq']],
    frames: [{ hip: [96, 130], t: -4, th: 182, sn: 180, ua: 50, fa: 0 }, { hip: [96, 130], t: -4, th: 184, sn: 252, ua: 50, fa: 0 }],
    dyn: [{ k: 'line', a: 'knee', b: { seg: ['knee', 'ankle'], f: .86, perp: -6 }, w: 3, cls: 'eq2', z: 'back' }, { k: 'circle', c: { seg: ['knee', 'ankle'], f: .86, perp: -6 }, r: 5.5 }]
  };
  T.standingCurl = {
    st: [['s', 132, 60, 132, FLOOR, 5, 'eq'], pad(118, 100, 132, 100, 8), pad(110, 140, 110, 156, 8)],
    frames: [{ hip: [100, 113], t: -82, th2: 90, sn2: 90, th: 86, sn: 92, hand: [128, 100], eb: 1 }, { hip: [100, 113], t: -82, th2: 90, sn2: 90, th: 92, sn: 204, hand: [128, 100], eb: 1 }],
    dyn: [{ k: 'circle', c: { seg: ['knee', 'ankle'], f: .86, perp: 6 }, r: 5.5 }, { k: 'line', a: 'knee', b: { seg: ['knee', 'ankle'], f: .86, perp: 6 }, w: 3, cls: 'eq2', z: 'back' }]
  };
  const hinge = (bar) => ({
    frames: [{ hip: [100, 113], t: -90, foot: [102, 184], kb: -1, ua: 90, fa: 90 }, { hip: [84, 110], t: -14, foot: [102, 184], kb: -1, ua: 90, fa: 90 }],
    dyn: [bar]
  });
  T.smithRDL = { st: [['s', 108, 10, 108, FLOOR, 2, 'eq2'], ['s', 40, 10, 168, 10, 5, 'eq'], ['s', 40, 10, 40, FLOOR, 5, 'eq'], ['s', 168, 10, 168, FLOOR, 5, 'eq']], ...hinge({ k: 'plate', c: 'hand', r: 13 }) };
  T.dbRDL = { st: [], ...hinge({ k: 'db', c: 'hand' }) };
  T.deadlift = {
    st: [],
    frames: [{ hip: [82, 146], t: -32, foot: [100, 184], kb: -1, hand: [112, 172], eb: 1 }, { hip: [100, 113], t: -90, foot: [100, 184], kb: -1, hand: [104, 116], eb: 1 }],
    dyn: [{ k: 'plate', c: 'hand', r: 14 }]
  };
  T.bentRow = {
    st: [],
    frames: [{ hip: [88, 118], t: -28, foot: [104, 184], kb: -1, hand: [130, 145], eb: 1 }, { hip: [88, 118], t: -28, foot: [104, 184], kb: -1, hand: [112, 126], eb: 1 }],
    dyn: [{ k: 'plate', c: 'hand', r: 13 }]
  };
  T.dbRow = {
    st: [pad(20, 157, 128, 157, 8), ['s', 30, 161, 30, FLOOR, 4, 'eq'], ['s', 118, 161, 118, FLOOR, 4, 'eq']],
    frames: [{ hip: [74, 116], t: -10, foot: [92, 184], kb: -1, th2: 92, sn2: 180, ft2: 180, hand2: [118, 150], eb2: 1, hand: [124, 158], eb: 1 },
      { hip: [74, 116], t: -10, foot: [92, 184], kb: -1, th2: 92, sn2: 180, ft2: 180, hand2: [118, 150], eb2: 1, hand: [104, 124], eb: 1 }],
    dyn: [{ k: 'db', c: 'hand' }]
  };

  // --- Glúteo ---
  T.abductor = {
    view: 'front', st: frontSeat,
    frames: [{ ...SIT_F, th: 88, thL: .55, ua: 100, fa: 90, faL: .5 }, { ...SIT_F, th: 28, thL: .55, ua: 100, fa: 90, faL: .5 }],
    dyn: [{ k: 'circle', c: { j: 'knee', dx: 7 }, r: 6 }, { k: 'circle', c: { j: 'knee2', dx: -7 }, r: 6 }]
  };
  T.adductor = {
    view: 'front', st: frontSeat,
    frames: [{ ...SIT_F, th: 28, thL: .55, ua: 100, fa: 90, faL: .5 }, { ...SIT_F, th: 88, thL: .55, ua: 100, fa: 90, faL: .5 }],
    dyn: [{ k: 'circle', c: { j: 'knee', dx: -7 }, r: 6 }, { k: 'circle', c: { j: 'knee2', dx: 7 }, r: 6 }]
  };
  T.kickbackMachine = {
    st: [pad(116, 104, 128, 82, 9), ['s', 136, 70, 136, FLOOR, 5, 'eq'], ['s', 70, 186, 140, 186, 6, 'eq']],
    frames: [{ hip: [96, 116], t: -54, th2: 92, sn2: 88, th: 64, sn: 120, hand: [136, 100], eb: 1 }, { hip: [96, 116], t: -54, th2: 92, sn2: 88, th: 166, sn: 178, hand: [136, 100], eb: 1 }],
    dyn: [{ k: 'plateLine', c: { j: 'toe', dx: -3, dy: 0 }, ang: 70, len: 18, w: 5 }, { k: 'line', a: { j: 'toe', dx: -3 }, b: [120, 150], w: 3, cls: 'eq2', z: 'back' }]
  };
  T.cableKickback = {
    st: [['s', 168, 20, 168, FLOOR, 5, 'eq'], pulley(162, 180)],
    frames: [{ hip: [100, 113], t: -74, th2: 90, sn2: 90, th: 92, sn: 94, hand: [164, 96], eb: 1 }, { hip: [100, 113], t: -74, th2: 90, sn2: 90, th: 148, sn: 158, hand: [164, 96], eb: 1 }],
    dyn: [{ k: 'cable', a: [162, 180], b: 'ankle' }, { k: 'circle', c: 'ankle', r: 3.5, cls: 'grip' }]
  };
  T.hipThrust = {
    st: [pad(24, 132, 62, 132, 9), ['s', 40, 136, 40, FLOOR, 4, 'eq'], ['s', 150, 120, 150, FLOOR, 4, 'eq']],
    frames: [{ hip: [96, 170], shp: [56, 124], foot: [136, 184], kb: -1, handAt: ['hip', 4, -12], eb: -1 }, { hip: [100, 128], shp: [56, 124], foot: [136, 184], kb: -1, handAt: ['hip', 4, -12], eb: -1 }],
    dyn: [{ k: 'circle', c: { j: 'hip', n: 11 }, r: 6 }, { k: 'line', a: { j: 'hip', n: 11 }, b: [150, 126], w: 4, z: 'back' }]
  };
  T.bbHipThrust = { ...T.hipThrust, st: [pad(24, 132, 62, 132, 9), ['s', 40, 136, 40, FLOOR, 4, 'eq']], dyn: [{ k: 'plate', c: { j: 'hip', n: 12 }, r: 13 }] };

  // --- Gemelo ---
  T.seatedCalf = {
    st: [...seat(48, 90, 156, 66), ['r', 114, 177, 26, 11, 'eqf']],
    frames: [{ hip: [70, 148], t: -90, foot: [108, 181], kb: -1, ft: -28, ua: 60, fa: 0 }, { hip: [70, 148], t: -90, foot: [110, 166], kb: -1, ft: 42, ua: 60, fa: 0 }],
    dyn: [{ k: 'line', a: { j: 'knee', dx: -12, dy: -7 }, b: { j: 'knee', dx: 6, dy: -7 }, w: 7, cls: 'pad' }, { k: 'line', a: { j: 'knee', dx: -12, dy: -7 }, b: [60, 186], w: 3, cls: 'eq2', z: 'back' }]
  };
  T.standingCalf = {
    st: [['r', 102, 177, 30, 11, 'eqf'], ['s', 70, 20, 70, FLOOR, 5, 'eq'], ['s', 70, 26, 110, 26, 4, 'eq']],
    frames: [{ ...STAND, hip: [100, 109], ft: -16, handAt: ['shoulder', 6, -8], eb: 1 }, { ...STAND, hip: [100, 96], ft: 40, handAt: ['shoulder', 6, -8], eb: 1 }],
    dyn: [{ k: 'line', a: { j: 'shoulder', dx: -8, dy: -4 }, b: { j: 'shoulder', dx: 10, dy: -4 }, w: 7, cls: 'pad' }, { k: 'line', a: { j: 'shoulder', dx: -8, dy: -4 }, b: [70, 60], w: 4, z: 'back' }]
  };

  // --- Core ---
  T.abMachine = {
    st: [...tower(16), ...seat(64, 100, 156, 84), pad(66, 104, 66, 150)],
    frames: [{ ...SIT, t: -92, uaR: 150, faR: 16 }, { ...SIT, t: -42, uaR: 150, faR: 16 }],
    dyn: [{ k: 'circle', c: 'elbow', r: 5.5 }, { k: 'line', a: [76, 70], b: 'elbow', w: 3, cls: 'eq2', z: 'back' }, { k: 'line', a: [76, 70], b: [36, 40], w: 3, cls: 'eq2', z: 'back' }, stack(16)]
  };
  T.rotation = {
    view: 'front', st: [...frontSeat, ['s', 100, 40, 100, 60, 4, 'eq']],
    fr: [['p', 'M70 62 Q100 48 130 62', 'arrow'], ['p', 'M124 56 L131 62 L122 65', 'arrow']],
    frames: [{ ...SIT_F, tw: 1, hand: [108, 104], eb: 1, hd: 0 }, { ...SIT_F, tw: .4, hand: [100, 104], eb: 1, hd: 0 }],
    dyn: [{ k: 'line', a: 'hand', b: 'hand2', w: 6, cls: 'pad', z: 'back' }]
  };
  T.declineSitup = {
    st: [pad(30, 162, 116, 142, 9), ['s', 40, 166, 40, FLOOR, 4, 'eq'], ['s', 120, 146, 140, FLOOR, 4, 'eq'], ['c', 148, 134, 5, 'pad'], ['c', 150, 152, 5, 'pad']],
    frames: [{ hip: [104, 136], t: 167, th: -38, sn: 64, uaR: 150, faR: 18 }, { hip: [104, 136], t: 282, th: -38, sn: 64, uaR: 150, faR: 18 }]
  };
  T.legRaise = {
    st: [pad(80, 52, 80, 118, 9), pad(84, 98, 124, 98, 8), ['s', 72, 30, 72, FLOOR, 5, 'eq'], ['s', 120, 102, 120, FLOOR, 4, 'eq']],
    frames: [{ hip: [92, 114], t: -90, th: 88, sn: 92, ua: 88, fa: 0 }, { hip: [92, 114], t: -90, th: -6, sn: 72, ua: 88, fa: 0 }]
  };
  T.cableCrunch = {
    st: [['s', 170, 6, 170, FLOOR, 5, 'eq'], pulley(160, 12), ['s', 160, 12, 170, 12, 3, 'eq']],
    frames: [{ hip: [96, 150], t: -76, th: 90, sn: 182, ft: 182, uaR: 160, faR: -12 }, { hip: [96, 150], t: 22, th: 90, sn: 182, ft: 182, uaR: 160, faR: -12 }],
    dyn: [{ k: 'cable', a: [160, 12], b: 'hand' }, { k: 'line', a: { j: 'hand', dy: -5 }, b: { j: 'hand', dy: 5 }, w: 3.5, cls: 'rope' }]
  };
  T.plank = { st: [], frames: [{ hip: [96, 166], t: 180, th: 6, sn: 6, ft: 96, ua: 90, fa: 180 }, { hip: [96, 164], t: 180, th: 6, sn: 6, ft: 96, ua: 90, fa: 180 }] };

  // --- Peso libre / banco ---
  const benchSt = [pad(50, 158, 136, 158, 8), ['s', 64, 162, 64, FLOOR, 4, 'eq'], ['s', 124, 162, 124, FLOOR, 4, 'eq']];
  T.benchPress = {
    st: [...benchSt, ['s', 70, 92, 70, FLOOR, 4, 'eq'], ['s', 70, 98, 78, 98, 3, 'eq']],
    frames: [{ hip: [120, 150], t: 180, foot: [148, 184], kb: -1, hand: [80, 101], eb: 1 }, { hip: [120, 150], t: 180, foot: [148, 184], kb: -1, hand: [84, 140], eb: 1 }],
    dyn: [{ k: 'plate', c: 'hand', r: 13 }]
  };
  T.dbBench = { st: benchSt, frames: T.benchPress.frames, dyn: [{ k: 'db', c: 'hand', r: 7 }] };
  T.dbFly = { st: benchSt, frames: [{ hip: [120, 150], t: 180, foot: [148, 184], kb: -1, ua: -86, fa: -80 }, { hip: [120, 150], t: 180, foot: [148, 184], kb: -1, ua: 168, fa: 150, uaL: .6 }], dyn: [{ k: 'db', c: 'hand', r: 7 }] };
  T.inclineDb = {
    st: [pad(72, 156, 40, 106), ...seat(70, 100, 160, 86)],
    frames: [{ hip: [86, 152], t: -125, foot: [126, 184], kb: -1, hand: [74, 102], eb: 1 }, { hip: [86, 152], t: -125, foot: [126, 184], kb: -1, hand: [86, 58], eb: 1 }],
    dyn: [{ k: 'db', c: 'hand', r: 7 }]
  };
  T.dbShoulder = {
    view: 'front', st: [['r', 84, 60, 32, 84, 'padf'], ['s', 84, 149, 116, 149, 10, 'pad'], ['s', 100, 154, 100, FLOOR, 5, 'eq']],
    frames: [{ ...SIT_F, hand: [134, 84], eb: 1 }, { ...SIT_F, hand: [124, 42], eb: 1 }],
    dyn: [{ k: 'dbF', c: 'hand' }, { k: 'dbF', c: 'hand2' }]
  };
  T.dbLateral = {
    view: 'front', st: [],
    frames: [{ ...STAND_F, ua: 84, fa: 88 }, { ...STAND_F, ua: -4, fa: 2 }],
    dyn: [{ k: 'dbF', c: 'hand' }, { k: 'dbF', c: 'hand2' }]
  };
  T.pullup = {
    st: [['s', 70, 22, 150, 22, 4, 'eq'], ['s', 150, 10, 150, FLOOR, 5, 'eq']],
    frames: [{ hip: [100, 120], t: -93, th: 80, sn: 126, hand: [106, 22], eb: 1 }, { hip: [102, 86], t: -96, th: 80, sn: 126, hand: [106, 22], eb: 1 }]
  };
  T.dips = {
    st: [['s', 92, 108, 122, 108, 5, 'eq'], ['s', 118, 108, 118, FLOOR, 4, 'eq']],
    frames: [{ hip: [100, 110], t: -91, th: 80, sn: 130, hand: [106, 108], eb: 1 }, { hip: [96, 132], t: -100, th: 80, sn: 130, hand: [106, 108], eb: 1 }]
  };

  // --- Cardio (cíclicos) ---
  const TAU = Math.PI * 2;
  T.treadmill = {
    st: [['s', 30, 182, 166, 182, 7, 'eq'], ['s', 160, 182, 150, 92, 4, 'eq'], ['s', 150, 92, 164, 86, 6, 'eqo'], ['s', 150, 106, 128, 106, 3, 'eq']],
    noFloor: true, alt: true, dur: 900,
    fn: ph => {
      const s = Math.sin(ph * TAU), c = Math.cos(ph * TAU);
      const th = 92 - 32 * s;
      return { hip: [96, 112 - 3 * Math.abs(c)], t: -80, th, sn: th + 26 + 46 * Math.max(0, c), ua: 90 + 38 * s, fa: 90 + 38 * s - 95 };
    }
  };
  const pedal = (cx, cy, r) => ph => [cx + r * Math.cos(ph * TAU), cy + r * Math.sin(ph * TAU)];
  T.bike = {
    st: [['s', 82, 120, 108, 172, 5, 'eq'], ['s', 108, 172, 150, 108, 5, 'eq'], ['s', 150, 108, 146, 96, 4, 'eq'], ['s', 140, 94, 152, 94, 5, 'eq'], pad(72, 120, 92, 120, 6), ['s', 80, 186, 140, 186, 5, 'eq']],
    alt: true, dur: 1100,
    fn: ph => { const f = pedal(108, 166, 12)(ph); return { hip: [84, 115], t: -56, foot: f, kb: -1, hand: [144, 96], eb: 1, ftR: -82 }; },
    dyn: [{ k: 'crank', c: [108, 166], z: 'mid' }]
  };
  T.recumbent = {
    st: [pad(60, 148, 92, 148, 8), pad(58, 146, 44, 100), ['s', 76, 152, 140, 152, 5, 'eq'], ['s', 140, 152, 150, 186, 5, 'eq'], ['s', 70, 152, 70, 186, 4, 'eq']],
    alt: true, dur: 1100,
    fn: ph => { const f = pedal(140, 140, 11)(ph); return { hip: [70, 142], t: -112, foot: f, kb: -1, ua: 98, fa: 30, ftR: -95 }; },
    dyn: [{ k: 'crank', c: [140, 140], z: 'mid' }]
  };
  T.elliptical = {
    st: [['s', 40, 184, 160, 184, 6, 'eq'], ['s', 150, 184, 140, 70, 5, 'eq']],
    alt: true, dur: 1400,
    fn: ph => {
      const a = ph * TAU;
      return { hip: [98, 102 + 2 * Math.sin(a * 2)], t: -86, foot: [98 + 18 * Math.cos(a), 166 + 6 * Math.sin(a)], kb: -1, ft: 4, hand: [126 - 12 * Math.cos(a), 84 + 4 * Math.sin(a)], eb: 1 };
    },
    dyn: [{ k: 'line', a: 'hand', b: [138, 140], w: 4, z: 'back' }, { k: 'line', a: { j: 'ankle', dx: -8, dy: 4 }, b: { j: 'ankle', dx: 14, dy: 4 }, w: 4 }]
  };
  T.stairs = {
    st: [['p', 'M86 188 L120 120 L146 120 L146 188 Z', 'eqf'], ['s', 150, 188, 150, 70, 4, 'eq'], ['s', 150, 70, 126, 76, 4, 'eq']],
    dyn: [{ k: 'line', a: { j: 'ankle', dx: -6, dy: 5 }, b: { j: 'toe', dx: 4, dy: 5 }, w: 4, z: 'mid' }, { k: 'line', a: { j: 'ankle2', dx: -6, dy: 5 }, b: { j: 'toe2', dx: 4, dy: 5 }, w: 4, z: 'back' }],
    noFloor: false, alt: true, dur: 1500,
    fn: ph => {
      const a = ph * TAU;
      return { hip: [104, 94 + 3 * Math.sin(a * 2)], t: -84, foot: [108 + 4 * Math.cos(a), 154 + 14 * Math.sin(a)], kb: -1, ft: 0, hand: [128, 92], eb: 1 };
    }
  };
  T.rower = {
    st: [['s', 30, 176, 168, 176, 5, 'eq'], ['s', 36, 176, 36, FLOOR, 4, 'eq'], ['s', 150, 150, 150, FLOOR, 5, 'eq'], ['c', 168, 160, 15, 'eqo'], ['s', 136, 152, 142, 178, 5, 'eq']],
    noFloor: false, dur: 2400,
    fn: ph => {
      const C = { hip: [94, 166], t: -58, hand: [150, 142] }, F = { hip: [64, 166], t: -112, hand: [80, 138] };
      const u = ph < .4 ? ease(ph / .4) : 1 - ease((ph - .4) / .6);
      const legs = Math.min(1, u * 1.6), back = Math.min(1, Math.max(0, u * 1.6 - .3)), arms = Math.max(0, u * 2.5 - 1.5);
      const hip = [lerp(C.hip[0], F.hip[0], legs), 166];
      const t = lerp(C.t, F.t, back);
      const sh = add(hip, t, L.torso);
      const reach = [sh[0] + 48 * cos(12), sh[1] + 48 * sin(12)];
      const hand = mid(reach, F.hand, arms);
      return { hip, t, foot: [136, 162], kb: -1, ft: -70, hand, eb: 1, p: u };
    },
    dyn: [{ k: 'cable', a: [160, 152], b: 'hand' }, { k: 'line', a: { j: 'hand', dy: -5 }, b: { j: 'hand', dy: 5 }, w: 4 }, { k: 'line', a: { j: 'hip', dx: -9, dy: 8 }, b: { j: 'hip', dx: 9, dy: 8 }, w: 6, cls: 'pad' }]
  };

  // ================= Ampliación: ejercicios de la lista completa =================
  // Secuencia de poses clave con transiciones suaves; times = instante (0–1) en que empieza cada pose
  const seq = (keys, times) => ph => {
    const n = keys.length;
    let i = 0;
    for (let k = 0; k < n; k++) if (ph >= times[k]) i = k;
    const t0 = times[i], t1 = i + 1 < n ? times[i + 1] : 1;
    const u = ease(Math.min(1, (ph - t0) / Math.max(.001, t1 - t0)));
    return { ...mix(keys[i], keys[(i + 1) % n], u), p: i < n / 2 ? u : 1 - u };
  };
  const ping = ph => ph < .1 ? 0 : ph < .45 ? ease((ph - .1) / .35) : ph < .55 ? 1 : ph < .95 ? 1 - ease((ph - .55) / .4) : 0;
  // Cadera sobre la línea tobillo–hombro (cuerpo recto, plancha)
  const lineHip = (ank, sh) => [ank[0] + (sh[0] - ank[0]) * 71 / 117, ank[1] + (sh[1] - ank[1]) * 71 / 117];
  const lineT = (ank, sh) => ang(lineHip(ank, sh), sh);
  const plank = (ank, sh, hand, extra = {}) => ({ hip: lineHip(ank, sh), t: lineT(ank, sh), foot: ank, kb: 1, ft: 75, hand, eb: 1, ...extra });
  const walk = (o = {}) => ph => {
    const s = Math.sin(ph * TAU), c = Math.cos(ph * TAU), th = 90 - (o.amp || 20) * s;
    const arms = o.arms ? o.arms(s) : { ua: 90 + 16 * s, fa: 80 + 16 * s };
    return { hip: [o.x || 100, (o.y || 113) - 1.5 * Math.abs(c)], t: o.t ?? -88, th, sn: th + 6 + (o.knee || 30) * Math.max(0, c), ...(o.ft != null ? { ft: o.ft } : {}), ...arms, p: ph };
  };
  const SUP = { hip: [116, 177], t: 180 }; // tumbado boca arriba en el suelo, cabeza a la izquierda
  const bench = [pad(50, 158, 136, 158, 8), ['s', 64, 162, 64, FLOOR, 4, 'eq'], ['s', 124, 162, 124, FLOOR, 4, 'eq']];
  const smithRails = [['s', 40, 10, 168, 10, 5, 'eq'], ['s', 40, 10, 40, FLOOR, 5, 'eq'], ['s', 168, 10, 168, FLOOR, 5, 'eq']];
  const crossed = { uaR: 150, faR: 18 };

  // --- Pecho ---
  T.floorPress = { st: [], flip: false, frames: [{ ...SUP, foot: [146, 186], kb: -1, hand: [78, 130], eb: 1 }, { ...SUP, foot: [146, 186], kb: -1, hand: [84, 164], eb: 1 }], dyn: [{ k: 'plate', c: 'hand', r: 12 }] };
  const PU = { ank: [20, 182], hand: [128, 186] };
  T.pushup = { st: [], frames: [plank(PU.ank, [126, 137], PU.hand), plank(PU.ank, [134, 167], PU.hand)] };
  T.pushupDecline = { st: [pad(4, 154, 40, 154, 8), ['s', 22, 158, 22, FLOOR, 4, 'eq']], frames: [plank([26, 146], [128, 138], PU.hand), plank([26, 146], [136, 170], PU.hand)] };
  T.pushupIncline = { st: [pad(120, 140, 160, 140, 8), ['s', 150, 144, 150, FLOOR, 4, 'eq']], frames: [plank([22, 184], [118, 96], [126, 136]), plank([22, 184], [126, 122], [126, 136])] };
  T.declinePress = {
    st: [pad(40, 168, 134, 146, 8), ['s', 60, 168, 60, FLOOR, 4, 'eq'], ['s', 128, 150, 140, FLOOR, 4, 'eq'], ['c', 160, 134, 5, 'pad'], ['s', 70, 108, 70, 160, 3, 'eq2']],
    frames: [{ hip: [118, 144], t: 166, th: -30, sn: 72, hand: [76, 104], eb: 1 }, { hip: [118, 144], t: 166, th: -30, sn: 72, hand: [80, 142], eb: 1 }],
    dyn: [{ k: 'plate', c: 'hand', r: 13 }]
  };
  T.declineDb = { ...T.declinePress, st: T.declinePress.st.slice(0, 4), dyn: [{ k: 'db', c: 'hand', r: 7 }] };
  T.declineMachine = { ...T.declinePress, st: T.declinePress.st.slice(0, 4), dyn: [{ k: 'line', a: [150, 30], b: 'hand', w: 4, z: 'back' }, { k: 'grip', c: 'hand' }] };
  T.svend = { st: [], frames: [{ ...STAND, hand: [112, 92], eb: 1 }, { ...STAND, hand: [148, 90], eb: 1 }], dyn: [{ k: 'plateLine', c: { j: 'hand', dx: 2 }, ang: 90, len: 22, w: 5, cls: 'eq' }] };
  T.landmine = { st: [['c', 24, 184, 4, 'eqo']], frames: [{ ...STAND, t: -84, foot: [104, 184], kb: -1, hand: [112, 86], eb: 1 }, { ...STAND, t: -78, foot: [104, 184], kb: -1, hand: [138, 44], eb: 1 }], dyn: [{ k: 'line', a: [24, 184], b: { j: 'hand', dx: 6, dy: -4 }, w: 4, z: 'back' }, { k: 'plate', c: { j: 'hand', dx: 8, dy: -6 }, r: 10 }] };
  T.inclineFly = { st: [pad(72, 156, 40, 106), ...seat(70, 100, 160, 86)], frames: [{ hip: [86, 152], t: -125, foot: [126, 184], kb: -1, ua: -60, fa: -50 }, { hip: [86, 152], t: -125, foot: [126, 184], kb: -1, ua: 160, fa: 140, uaL: .6 }], dyn: [{ k: 'db', c: 'hand', r: 7 }] };
  T.cableLowHigh = { view: 'front', st: [['s', 178, 18, 178, FLOOR, 5, 'eq'], ['s', 22, 18, 22, FLOOR, 5, 'eq'], pulley(174, 178), pulley(26, 178)], frames: [{ ...STAND_F, th: 82, hand: [152, 148], eb: 1 }, { ...STAND_F, th: 82, hand: [110, 70], eb: 1 }], dyn: [{ k: 'cable', a: [174, 178], b: 'hand' }, { k: 'cable', a: [26, 178], b: 'hand2' }, { k: 'grip', c: 'hand' }, { k: 'grip', c: 'hand2' }] };
  T.cableFlySingle = { ...T.crossover, far: { ua2: 92, fa2: 92 }, dyn: [{ k: 'cable', a: [174, 26], b: 'hand' }, { k: 'grip', c: 'hand' }] };
  T.dbPullover = { st: bench, frames: [{ hip: [120, 150], t: 180, foot: [148, 184], kb: -1, ua: -88, fa: -86 }, { hip: [120, 150], t: 180, foot: [148, 184], kb: -1, ua: -172, fa: -168 }], dyn: [{ k: 'db', c: 'hand', r: 7 }] };
  T.straightArm = { st: [['s', 160, 6, 160, FLOOR, 5, 'eq'], pulley(150, 14)], frames: [{ hip: [96, 116], t: -72, foot: [100, 184], kb: -1, ua: -48, fa: -44 }, { hip: [96, 116], t: -72, foot: [100, 184], kb: -1, ua: 82, fa: 84 }], dyn: [{ k: 'cable', a: [150, 14], b: 'hand' }, { k: 'line', a: { j: 'hand', dy: -4 }, b: { j: 'hand', dy: 4 }, w: 4 }] };

  // --- Espalda ---
  T.pulldownUni = { ...T.closePulldown, far: { ua2: 70, fa2: 30 } };
  T.chinup = { ...T.pullup };
  T.tbarRow = { ...T.bentRow, st: [['c', 20, 184, 4, 'eqo']], dyn: [{ k: 'line', a: [20, 184], b: { j: 'hand', dx: 6 }, w: 4, z: 'back' }, { k: 'plate', c: { j: 'hand', dx: 8 }, r: 12 }] };
  T.meadows = { ...T.bentRow, st: [['c', 20, 184, 4, 'eqo']], far: { ua2: 80, fa2: 40 }, dyn: [{ k: 'line', a: [20, 184], b: { j: 'hand', dx: 6 }, w: 4, z: 'back' }, { k: 'plate', c: { j: 'hand', dx: 8 }, r: 12 }] };
  T.gorillaRow = { ...T.bentRow, alt: true, dyn: [{ k: 'kb', c: 'hand' }, { k: 'kb', c: 'hand2', z: 'mid' }] };
  T.smithRow = { ...T.bentRow, st: smithRails.concat([['s', 120, 10, 120, FLOOR, 2, 'eq2']]) };
  T.invertedRow = {
    flip: true, st: [['s', 132, 116, 160, 116, 4, 'eq'], ['s', 156, 116, 156, FLOOR, 4, 'eq']],
    frames: [{ hip: lineHip([24, 182], [138, 166]), t: lineT([24, 182], [138, 166]), foot: [24, 182], kb: 1, ft: -60, hand: [138, 116], eb: -1 }, { hip: lineHip([24, 182], [132, 126]), t: lineT([24, 182], [132, 126]), foot: [24, 182], kb: 1, ft: -60, hand: [138, 116], eb: -1 }]
  };
  T.uprightRow = { st: [], frames: [{ ...STAND, hand: [104, 118], eb: -1 }, { ...STAND, hand: [110, 76], eb: -1 }], dyn: [{ k: 'plate', c: 'hand', r: 12 }] };
  T.facePull = { st: [['s', 172, 20, 172, FLOOR, 5, 'eq'], pulley(166, 62)], frames: [{ ...STAND, t: -86, hand: [150, 66], eb: -1 }, { ...STAND, t: -92, hand: [108, 56], eb: -1 }], dyn: [{ k: 'cable', a: [166, 62], b: 'hand' }, { k: 'line', a: { j: 'hand', dy: -5 }, b: { j: 'hand', dy: 5 }, w: 3.5, cls: 'rope' }] };
  const ytwBase = { hip: [70, 150], t: -36, foot: [16, 186], kb: -1, ft: 60 };
  T.ytw = { st: [pad(80, 160, 116, 132, 9), ['s', 96, 150, 96, FLOOR, 4, 'eq']], frames: [{ ...ytwBase, ua: 92, fa: 92 }, { ...ytwBase, ua: -36, fa: -36 }], dyn: [{ k: 'db', c: 'hand', r: 5 }] };
  T.scapPull = { ...T.pullup, frames: [{ hip: [100, 124], t: -92, th: 82, sn: 120, hand: [106, 22], eb: 1 }, { hip: [100, 116], t: -94, th: 82, sn: 120, hand: [106, 22], eb: 1 }] };
  T.rackPull = { st: [['s', 150, 120, 150, FLOOR, 5, 'eq'], ['s', 136, 148, 156, 148, 4, 'eq']], frames: [{ hip: [86, 132], t: -46, foot: [100, 184], kb: -1, hand: [112, 148], eb: 1 }, { hip: [100, 113], t: -90, foot: [100, 184], kb: -1, hand: [104, 116], eb: 1 }], dyn: [{ k: 'plate', c: 'hand', r: 14 }] };
  T.farmer = { st: [], alt: true, dur: 1500, fn: walk({ arms: () => ({ ua: 90, fa: 90 }) }), dyn: [{ k: 'db', c: 'hand', r: 8 }, { k: 'db', c: 'hand2', r: 8, z: 'mid' }] };
  T.suitcase = { st: [], alt: true, dur: 1500, fn: walk({ arms: () => ({ ua: 90, fa: 90 }) }), dyn: [{ k: 'db', c: 'hand', r: 8 }] };
  T.sandbag = { st: [], alt: true, dur: 1600, fn: walk({ arms: () => ({ hand: [118, 100], eb: 1 }) }), dyn: [{ k: 'circle', c: { j: 'hand', dx: -4 }, r: 13, cls: 'bag' }] };
  T.sumoFront = { view: 'front', st: [], frames: [{ hip: [100, 146], t: -90, foot: [146, 184], kb: 1, hand: [110, 172], eb: 1 }, { hip: [100, 113], t: -90, foot: [138, 184], kb: 1, hand: [108, 140], eb: 1 }], dyn: [{ k: 'bar2', ext: 30 }, { k: 'circle', c: { j: 'hand', dx: 30 }, r: 12, cls: 'plate' }, { k: 'circle', c: { j: 'hand2', dx: -30 }, r: 12, cls: 'plate' }] };
  T.sumoSquat = { view: 'front', st: [], frames: [{ hip: [100, 113], t: -90, foot: [138, 184], kb: 1, hand: [106, 108], eb: 1 }, { hip: [100, 148], t: -90, foot: [146, 184], kb: 1, hand: [106, 138], eb: 1 }], dyn: [{ k: 'dbF', c: 'mid' }] };
  const gmArms = { uaR: 205, faR: -175 };
  T.goodMorning = { st: [], frames: [{ hip: [100, 113], t: -90, foot: [102, 184], kb: -1, ...gmArms }, { hip: [84, 110], t: -12, foot: [102, 184], kb: -1, ...gmArms }], dyn: [{ k: 'plate', c: { j: 'shoulder', n: -6, al: 2 }, r: 13 }] };
  T.reverseHyper = { st: [pad(76, 140, 146, 140, 9), ['s', 96, 144, 96, FLOOR, 4, 'eq'], ['s', 140, 144, 140, FLOOR, 4, 'eq']], frames: [{ hip: [84, 130], t: 0, ua: 80, fa: 60, th: 96, sn: 92 }, { hip: [84, 130], t: 0, ua: 80, fa: 60, th: 184, sn: 184 }], dyn: [{ k: 'circle', c: { seg: ['knee', 'ankle'], f: .85, perp: 6 }, r: 5 }] };
  T.superman = { st: [], frames: [{ hip: [80, 178], t: 0, ua: 0, fa: 0, th: 180, sn: 180, ft: 90 }, { hip: [80, 178], t: -14, ua: -16, fa: -16, th: 192, sn: 194, ft: 100 }] };

  // --- Hombro ---
  T.militaryPress = { st: [], frames: [{ ...STAND, hand: [112, 72], eb: 1 }, { ...STAND, hand: [104, 20], eb: 1 }], dyn: [{ k: 'plate', c: 'hand', r: 13 }] };
  T.seatedBarPress = { st: [pad(66, 92, 66, 150), ...seat(64, 100, 156, 84)], frames: [{ ...SIT, hand: [92, 106], eb: 1 }, { ...SIT, hand: [84, 55], eb: 1 }], dyn: [{ k: 'plate', c: 'hand', r: 13 }] };
  T.arnold = { ...T.dbShoulder, frames: [{ ...SIT_F, hand: [110, 92], eb: 1 }, { ...SIT_F, hand: [124, 42], eb: 1 }] };
  T.pushPress = { st: [], frames: [{ hip: [100, 122], t: -88, foot: [102, 184], kb: -1, hand: [112, 80], eb: 1 }, { hip: [100, 112], t: -90, foot: [102, 184], kb: -1, hand: [104, 18], eb: 1 }], dyn: [{ k: 'plate', c: 'hand', r: 13 }] };
  T.frontRaise = { st: [], frames: [{ ...STAND, ua: 86, fa: 84 }, { ...STAND, ua: -4, fa: -8 }], dyn: [{ k: 'db', c: 'hand' }] };
  T.frontRaisePlate = { ...T.frontRaise, dyn: [{ k: 'plateLine', c: 'hand', ang: 90, len: 24, w: 5 }] };
  T.frontRaiseCable = { ...T.frontRaise, st: [['s', 40, 30, 40, FLOOR, 5, 'eq'], pulley(46, 182)], dyn: [{ k: 'cable', a: [46, 182], b: 'hand' }, { k: 'grip', c: 'hand' }] };
  T.hspu = { st: [['s', 70, 10, 70, FLOOR, 6, 'eq2']], frames: [{ hip: [94, 92], t: 90, th: -98, sn: -96, ft: 180, hand: [104, 186], eb: 1 }, { hip: [94, 118], t: 90, th: -98, sn: -96, ft: 180, hand: [104, 186], eb: -1 }] };
  T.zPress = { st: [], frames: [{ hip: [76, 176], t: -90, th: 0, sn: 0, ft: -90, hand: [90, 136], eb: 1 }, { hip: [76, 176], t: -90, th: 0, sn: 0, ft: -90, hand: [80, 82], eb: 1 }], dyn: [{ k: 'plate', c: 'hand', r: 12 }] };
  T.lateralIncline = { view: 'front', st: [pad(40, 186, 70, 70, 9)], frames: [{ hip: [100, 113], t: -104, th: 86, sn: 90, ua: 98, fa: 98, hand2: [66, 84], eb2: 1 }, { hip: [100, 113], t: -104, th: 86, sn: 90, ua: -14, fa: -10, hand2: [66, 84], eb2: 1 }], dyn: [{ k: 'dbF', c: 'hand' }] };
  T.bandPullApart = { view: 'front', st: [], frames: [{ ...STAND_F, ua: 2, fa: 2, uaL: .3, faL: .3 }, { ...STAND_F, ua: 2, fa: 2, uaL: 1, faL: 1 }], dyn: [{ k: 'band', a: 'hand', b: 'hand2' }] };
  const rotFn = (dir, cable) => ph => {
    const e = ping(ph), th = (dir > 0 ? -70 + 140 * e : 70 - 140 * e) * RAD, sn = Math.sin(th);
    return { ...STAND_F, ua: 92, fa: sn >= 0 ? 0 : 180, faL: Math.max(.18, Math.abs(sn)), ua2: 92, fa2: 92, p: e };
  };
  T.extRot = { view: 'front', st: [['s', 24, 20, 24, FLOOR, 5, 'eq'], pulley(30, 112)], fn: rotFn(1), dyn: [{ k: 'cable', a: [30, 112], b: 'hand' }, { k: 'grip', c: 'hand' }] };
  T.intRot = { view: 'front', st: [['s', 176, 20, 176, FLOOR, 5, 'eq'], pulley(170, 112)], fn: rotFn(-1), dyn: [{ k: 'cable', a: [170, 112], b: 'hand' }, { k: 'grip', c: 'hand' }] };
  T.cuban = { view: 'front', st: [], frames: [{ ...STAND_F, ua: 88, fa: 90 }, { ...STAND_F, ua: -2, fa: -88 }], dyn: [{ k: 'dbF', c: 'hand' }, { k: 'dbF', c: 'hand2' }] };

  // --- Bíceps / antebrazo ---
  T.bbCurl = { st: [], frames: T.dbCurl.frames, dyn: [{ k: 'plate', c: 'hand', r: 12 }] };
  T.concentration = { st: [...seat(46, 96, 162, 70)], frames: [{ hip: [70, 154], t: -48, th: -6, sn: 96, ua: 94, fa: 94 }, { hip: [70, 154], t: -48, th: -6, sn: 96, ua: 94, fa: -62 }], dyn: [{ k: 'db', c: 'hand' }] };
  T.inclineCurl = { st: [pad(72, 156, 40, 106), ...seat(70, 100, 160, 86)], frames: [{ hip: [86, 152], t: -125, foot: [126, 184], kb: -1, ua: 100, fa: 98 }, { hip: [86, 152], t: -125, foot: [126, 184], kb: -1, ua: 96, fa: -40 }], dyn: [{ k: 'db', c: 'hand' }] };
  T.spiderCurl = { st: [pad(80, 160, 116, 132, 9), ['s', 96, 150, 96, FLOOR, 4, 'eq']], frames: [{ ...ytwBase, ua: 92, fa: 92 }, { ...ytwBase, ua: 92, fa: -60 }], dyn: [{ k: 'plate', c: 'hand', r: 10 }] };
  T.highCableCurl = { view: 'front', st: [['s', 180, 20, 180, FLOOR, 5, 'eq'], ['s', 20, 20, 20, FLOOR, 5, 'eq'], pulley(176, 90), pulley(24, 90)], frames: [{ ...STAND_F, ua: -4, fa: -2 }, { ...STAND_F, ua: -4, fa: -150 }], dyn: [{ k: 'cable', a: [176, 90], b: 'hand' }, { k: 'cable', a: [24, 90], b: 'hand2' }, { k: 'grip', c: 'hand' }, { k: 'grip', c: 'hand2' }] };
  T.wristRoller = { st: [], frames: [{ ...STAND, ua: 2, fa: 2, wr: 40 }, { ...STAND, ua: 2, fa: 2, wr: -40 }], dyn: [{ k: 'line', a: { j: 'hand', dx: -2 }, b: { j: 'hand', dx: -2, dy: 46 }, w: 1.5, cls: 'cable' }, { k: 'plateLine', c: { j: 'hand', dx: -2, dy: 50 }, ang: 0, len: 16, w: 6 }, { k: 'grip', c: 'hand', r: 4 }] };
  T.deadHang = { ...T.pullup, frames: [{ hip: [100, 120], t: -93, th: 84, sn: 110, hand: [106, 22], eb: 1 }, { hip: [100, 121], t: -92, th: 86, sn: 108, hand: [106, 22], eb: 1 }] };
  T.platePinch = { st: [], frames: [{ ...STAND, ua: 92, fa: 90 }, { ...STAND, ua: 91, fa: 91 }], dyn: [{ k: 'plateLine', c: { j: 'hand', dy: 6 }, ang: 90, len: 28, w: 6 }] };
  T.wristRot = { ...T.forearm, frames: [{ ...T.forearm.frames[0], wr: -80 }, { ...T.forearm.frames[1], wr: 80 }], dyn: [{ k: 'line', a: 'hand', b: { j: 'handTip', dy: 0 }, w: 4 }, { k: 'plateLine', c: 'handTip', ang: 90, len: 10, w: 5 }] };

  // --- Tríceps ---
  T.skull = { st: bench, frames: [{ hip: [120, 150], t: 180, foot: [148, 184], kb: -1, ua: -104, fa: 168 }, { hip: [120, 150], t: 180, foot: [148, 184], kb: -1, ua: -100, fa: 266 }], dyn: [{ k: 'plate', c: 'hand', r: 11 }] };
  T.skullDb = { ...T.skull, dyn: [{ k: 'db', c: 'hand', r: 7 }] };
  T.overheadStand = { st: [], frames: [{ ...STAND, ua: -84, fa: 150 }, { ...STAND, ua: -86, fa: 276 }], dyn: [{ k: 'db', c: 'hand', r: 7 }] };
  T.overheadCable = { st: [['s', 30, 20, 30, FLOOR, 5, 'eq'], pulley(36, 176)], frames: [{ hip: [100, 113], t: -76, foot: [110, 184], kb: -1, foot2: [84, 184], kb2: -1, ua: -70, fa: 150 }, { hip: [100, 113], t: -76, foot: [110, 184], kb: -1, foot2: [84, 184], kb2: -1, ua: -72, fa: 290 }], dyn: [{ k: 'cable', a: [36, 176], b: 'hand' }, { k: 'line', a: { j: 'hand', dy: -5 }, b: { j: 'hand', dy: 5 }, w: 3.5, cls: 'rope' }] };
  T.benchDips = { st: [pad(54, 140, 92, 140, 8), ['s', 60, 144, 60, FLOOR, 4, 'eq']], frames: [{ hip: [94, 138], shp: [86, 92], foot: [150, 184], kb: -1, hand: [82, 140], eb: 1 }, { hip: [96, 164], shp: [88, 118], foot: [150, 184], kb: -1, hand: [82, 140], eb: 1 }] };
  T.kickbackDb = { st: [], frames: [{ hip: [82, 116], t: -22, foot: [102, 184], kb: -1, ua: 166, fa: 92 }, { hip: [82, 116], t: -22, foot: [102, 184], kb: -1, ua: 164, fa: 168 }], dyn: [{ k: 'db', c: 'hand' }] };
  T.kickbackCable = { ...T.kickbackDb, st: [['s', 24, 30, 24, FLOOR, 5, 'eq'], pulley(30, 180)], dyn: [{ k: 'cable', a: [30, 180], b: 'hand' }, { k: 'grip', c: 'hand' }] };

  // --- Core ---
  const lie = { ...SUP, foot: [146, 186], kb: -1 };
  T.crunch = { st: [], frames: [{ ...lie, ...crossed }, { ...lie, t: 210, ...crossed }] };
  T.situp = { st: [], frames: [{ ...lie, ...crossed }, { ...lie, t: 282, ...crossed }] };
  T.reverseCrunch = { st: [], frames: [{ ...SUP, th: -50, sn: 10, ua: 6, fa: 6 }, { hip: [116, 170], t: 186, th: -128, sn: -40, ua: 6, fa: 6 }] };
  T.vup = { st: [], frames: [{ ...SUP, th: 0, sn: 0, ft: -90, ua: 180, fa: 180 }, { ...SUP, t: 228, th: -48, sn: -48, ft: -100, ua: 312, fa: 312 }] };
  T.hollow = { st: [], frames: [{ ...SUP, t: 196, th: -14, sn: -14, ft: -100, ua: 196, fa: 196 }, { ...SUP, t: 198, th: -16, sn: -16, ft: -100, ua: 198, fa: 198 }] };
  T.dragonFlag = { st: [pad(20, 162, 96, 162, 8), ['s', 30, 166, 30, FLOOR, 4, 'eq'], ['s', 90, 166, 90, FLOOR, 4, 'eq'], ['s', 22, 130, 22, 162, 4, 'eq']], flip: true, frames: [{ hip: [96, 146], shp: [52, 156], th: -12, sn: -12, ft: -100, hand: [24, 140], eb: 1 }, { hip: [72, 112], shp: [52, 156], th: -66, sn: -68, ft: -150, hand: [24, 140], eb: 1 }] };
  T.lsit = { st: [['s', 98, 150, 98, FLOOR, 4, 'eq'], ['s', 88, 150, 112, 150, 4, 'eq']], frames: [{ hip: [96, 140], t: -92, th: 0, sn: 0, ft: -80, hand: [100, 148], eb: 1 }, { hip: [96, 138], t: -92, th: -3, sn: -3, ft: -80, hand: [100, 148], eb: 1 }] };
  T.russianTwist = {
    view: 'front', st: [], fn: ph => { const s = Math.sin(ph * TAU); const hx = 100 + 22 * s; return { hip: [100, 172], t: -90, th: -60, thL: .5, sn: 96, snL: .9, tw: 1 - .4 * Math.abs(s), hand: [hx + 6, 132], eb: 1, hand2: [200 - hx + 6, 132], eb2: 1, p: ph }; },
    dyn: [{ k: 'plateLine', c: 'mid', ang: 90, len: 18, w: 7 }], dur: 2000
  };
  T.woodchop = { view: 'front', st: [['s', 178, 18, 178, FLOOR, 5, 'eq'], pulley(174, 28)], frames: [{ ...STAND_F, th: 82, hand: [146, 54], eb: 1, hand2: [64, 58], eb2: 1, tw: .7 }, { ...STAND_F, th: 82, hand: [80, 150], eb: 1, hand2: [130, 146], eb2: 1, tw: .7 }], dyn: [{ k: 'cable', a: [174, 28], b: 'mid' }, { k: 'grip', c: 'mid', r: 4 }] };
  const SPA = [10, 182], SPS = [124, 150];
  T.sidePlank = { st: [], frames: [{ hip: lineHip(SPA, SPS), t: lineT(SPA, SPS), foot: SPA, kb: 1, ft: 70, ua: 90, fa: 0, ua2: -90, fa2: -90 }, { hip: [76, 168], t: lineT(SPA, SPS) + 5, foot: SPA, kb: 1, ft: 70, ua: 90, fa: 0, ua2: -90, fa2: -90 }] };
  T.sidePlankAbd = { st: [], frames: [{ hip: lineHip(SPA, SPS), t: lineT(SPA, SPS), foot: SPA, kb: 1, ft: 70, foot2: SPA, kb2: 1, ft2: 70, ua: 90, fa: 0, ua2: -90, fa2: -90 }, { hip: lineHip(SPA, SPS), t: lineT(SPA, SPS), foot: SPA, kb: 1, ft: 70, foot2: [26, 140], kb2: 1, ft2: 40, ua: 90, fa: 0, ua2: -90, fa2: -90 }] };
  T.copenhagen = { st: [pad(4, 150, 46, 150, 8), ['s', 24, 154, 24, FLOOR, 4, 'eq']], frames: [{ hip: lineHip([26, 144], SPS), t: lineT([26, 144], SPS), foot: [26, 144], kb: 1, ft: 70, foot2: [60, 184], kb2: 1, ua: 90, fa: 0, ua2: -60, fa2: -60 }, { hip: lineHip([26, 144], SPS), t: lineT([26, 144], SPS), foot: [26, 144], kb: 1, ft: 70, foot2: [34, 150], kb2: 1, ua: 90, fa: 0, ua2: -60, fa2: -60 }] };
  T.sideBend = { view: 'front', st: [], frames: [{ ...STAND_F, t: -90, ua: 92, fa: 92, ua2: 120, fa2: 30 }, { ...STAND_F, t: -76, ua: 98, fa: 96, ua2: 120, fa2: 30 }], dyn: [{ k: 'dbF', c: 'hand' }] };
  T.bicycle = { st: [], alt: true, dur: 1600, fn: ph => { const s = Math.sin(ph * TAU); return { ...SUP, t: 204, th: -40 - 30 * Math.max(0, s), sn: 10 - 30 * Math.max(0, s) + 30 * Math.max(0, -s), ua: 230, fa: 40, uaL: .8, p: ph }; } };
  T.wipers = { st: [], fn: ph => { const s = Math.sin(ph * TAU); return { ...SUP, th: -90 + 34 * s, sn: -90 + 34 * s, ft: 0, ua: 90, fa: 90, uaL: .3, p: ph }; }, dur: 2400 };
  T.highPlank = { st: [], alt: true, fn: ph => { const e = Math.max(0, Math.sin(ph * TAU)); return { ...plank(PU.ank, [126, 137], [128 - 8 * e, 186 - 40 * e]), p: ph }; }, dur: 1600 };
  T.mountain = { st: [], alt: true, dur: 900, fn: ph => { const e = (1 - Math.cos(ph * TAU)) / 2; const P = plank(PU.ank, [126, 137], PU.hand); return { ...P, foot: [20 + 70 * e, 182 - 14 * e], kb: -1, ft: 60, p: ph }; } };
  T.deadBug = { st: [], alt: true, dur: 2600, fn: ph => { const e = Math.max(0, Math.sin(ph * TAU)), f = Math.max(0, Math.sin((ph + .5) * TAU)); return { ...SUP, ua: -90 - 90 * e, fa: -90 - 90 * e, th: -90 + 80 * f, sn: 0 + 10 * f, ft: -90, p: ph }; } };
  const QUAD = { hip: [80, 138], t: 0, th: 90, sn: 180, ft: 180, ua: 90, fa: 90 };
  T.birdDog = { st: [], alt: true, dur: 2800, fn: ph => { const e = Math.max(0, Math.sin(ph * TAU)), f = Math.max(0, Math.sin((ph + .5) * TAU)); return { ...QUAD, ua: 90 - 90 * e, fa: 90 - 90 * e, th: 90 + 90 * f, sn: 180, ft: 180 - 90 * f, p: ph }; } };
  T.donkeyKick = { st: [], frames: [{ ...QUAD, th2: 90, sn2: 180, ft2: 180 }, { ...QUAD, th: 182, sn: 268, ft: 180, th2: 90, sn2: 180, ft2: 180 }] };
  T.fireHydrant = { st: [], frames: [{ ...QUAD, th2: 90, sn2: 180, ft2: 180 }, { ...QUAD, th: 120, thL: .45, sn: 180, ft: 180, th2: 90, sn2: 180, ft2: 180 }] };
  T.pallof = { st: [['s', 24, 30, 24, FLOOR, 5, 'eq'], pulley(30, 96)], frames: [{ ...STAND, hand: [110, 96], eb: 1 }, { ...STAND, hand: [146, 96], eb: 1 }], dyn: [{ k: 'cable', a: [30, 96], b: 'hand', z: 'back' }, { k: 'grip', c: 'hand' }] };
  T.bearCrawl = { st: [], alt: true, dur: 1200, fn: ph => { const s = Math.sin(ph * TAU), c = Math.max(0, Math.cos(ph * TAU)); return { hip: [82, 142], t: -4, foot: [62 + 10 * s, 184 - 6 * c], kb: -1, ft: 50, hand: [128 - 10 * s, 186 - 6 * c], eb: 1, p: ph }; } };
  T.stirPot = { st: [['c', 136, 170, 16, 'ballc']], fn: ph => { const a = ph * TAU, P = plank([18, 184], [126, 130], [136, 154]); return { ...P, ua: 92, fa: -2, hand: undefined, hip: [P.hip[0] + 4 * Math.cos(a), P.hip[1]], p: ph }; }, dur: 2400 };

  // --- Cuádriceps ---
  T.frontSquat = { st: [], frames: [{ hip: [100, 113], t: -88, foot: [104, 184], kb: -1, handAt: ['shoulder', 13, -2], eb: -1 }, { hip: [84, 148], t: -70, foot: [104, 184], kb: -1, handAt: ['shoulder', 13, -2], eb: -1 }], dyn: [{ k: 'plate', c: { j: 'shoulder', dx: 6, dy: -4 }, r: 13 }] };
  T.goblet = { st: [], frames: [{ hip: [100, 113], t: -88, foot: [104, 184], kb: -1, handAt: ['shoulder', 12, 12], eb: 1 }, { hip: [84, 150], t: -66, foot: [104, 184], kb: -1, handAt: ['shoulder', 12, 12], eb: 1 }], dyn: [{ k: 'db', c: { j: 'hand', dy: -4 }, r: 7 }] };
  T.zercher = { ...T.frontSquat, frames: T.frontSquat.frames.map(f => ({ ...f, handAt: ['shoulder', 22, 24], eb: 1 })), dyn: [{ k: 'plate', c: 'elbow', r: 12 }] };
  T.bulgarian = { st: [pad(20, 152, 66, 152, 8), ['s', 42, 156, 42, FLOOR, 4, 'eq']], frames: [{ hip: [96, 114], t: -88, foot: [128, 184], kb: -1, foot2: [56, 146], kb2: -1, ft2: 160, ua: 90, fa: 90 }, { hip: [92, 146], t: -82, foot: [128, 184], kb: -1, foot2: [56, 146], kb2: -1, ft2: 160, ua: 90, fa: 90 }], dyn: [{ k: 'db', c: 'hand' }] };
  T.beltSquat = { st: [['s', 40, 186, 160, 186, 6, 'eq'], ['s', 150, 100, 150, 186, 4, 'eq']], frames: [{ hip: [100, 113], t: -88, foot: [104, 182], kb: -1, hand: [146, 104], eb: 1 }, { hip: [90, 146], t: -78, foot: [104, 182], kb: -1, hand: [146, 112], eb: 1 }], dyn: [{ k: 'line', a: 'hip', b: { j: 'hip', dy: 34 }, w: 2, cls: 'cable' }, { k: 'plate', c: { j: 'hip', dy: 44 }, r: 10 }] };
  T.pistol = { st: [], frames: [{ hip: [100, 113], t: -88, foot: [102, 184], kb: -1, th2: 80, sn2: 84, ua: 40, fa: 30 }, { hip: [86, 158], t: -56, foot: [102, 184], kb: -1, th2: -4, sn2: -4, ft2: -90, ua: 0, fa: 0 }] };
  T.sissy = { st: [['s', 150, 40, 150, FLOOR, 4, 'eq']], frames: [{ hip: [100, 113], t: -90, foot: [104, 182], kb: -1, ft: 20, ua: 0, fa: 0, hand: [146, 100], eb: 1 }, { hip: [104, 148], t: -112, foot: [104, 182], kb: -1, ft: 30, hand: [146, 112], eb: 1 }] };
  T.wallSit = { st: [['s', 60, 20, 60, FLOOR, 6, 'eq2']], frames: [{ hip: [74, 148], t: -90, th: 0, sn: 90, ...crossed }, { hip: [74, 148], t: -90, th: 0, sn: 90, uaR: 152, faR: 18 }] };
  T.horizPress = { st: [pad(54, 150, 40, 100), ...seat(52, 90, 156, 70), ['s', 150, 110, 150, FLOOR, 4, 'eq']], frames: [{ hip: [72, 148], t: -112, foot: [104, 128], kb: -1, ft: -100, ua: 100, fa: 40 }, { hip: [72, 148], t: -112, foot: [136, 136], kb: -1, ft: -100, ua: 100, fa: 40 }], dyn: [{ k: 'plateLine', c: { seg: ['ankle', 'toe'], f: .4, perp: 5 }, ang: 90, len: 44, w: 6 }] };
  T.legPressUni = { ...T.legPress, far: { foot2: FA, kb2: -1, ft2: -135 } };
  T.reverseLunge = { ...T.lunge, frames: [{ hip: [118, 113], t: -90, foot: [122, 184], kb: -1, foot2: [116, 184], kb2: -1, ua: 90, fa: 90 }, T.lunge.frames[1]] };
  T.walkingLunge = { ...T.lunge };
  T.lateralLunge = { view: 'front', st: [], frames: [{ hip: [100, 118], t: -90, foot: [136, 184], kb: 1, foot2: [136, 184], kb2: 1, ua: 90, fa: 90 }, { hip: [124, 148], t: -90, foot: [146, 184], kb: 1, foot2: [184, 184], kb2: 1, ua: 70, fa: 90 }] };
  T.stepUp = { st: [['r', 108, 148, 52, 40, 'eqf']], frames: [{ hip: [96, 118], t: -86, foot: [124, 146], kb: -1, foot2: [90, 184], kb2: -1, ua: 90, fa: 90 }, { hip: [118, 80], t: -90, foot: [124, 146], kb: -1, foot2: [114, 146], kb2: -1, ua: 90, fa: 90 }], dyn: [{ k: 'db', c: 'hand' }] };
  T.reverseNordic = { st: [], frames: [{ hip: [96, 148], t: -90, th: 90, sn: 180, ft: 180, ...crossed }, { hip: [75, 155], t: -125, th: 55, sn: 180, ft: 180, ...crossed }] };
  T.nordic = { st: [['c', 54, 176, 5, 'pad'], pad(40, 186, 110, 186, 5)], frames: [{ hip: [96, 148], t: -90, th: 90, sn: 180, ft: 180, ua: 60, fa: 20 }, { hip: [125, 163], t: -35, th: 145, sn: 180, ft: 180, ua: 50, fa: 10 }] };
  T.ghr = { ...T.nordic, st: [pad(80, 180, 112, 180, 8), ['c', 50, 170, 5, 'pad'], ['s', 40, 186, 120, 186, 4, 'eq']] };
  T.boxJump = {
    st: [['r', 118, 140, 50, 48, 'eqf']], dur: 2400,
    fn: ph => {
      const e = ping(ph), ax = lerp(100, 136, e), ay = lerp(184, 138, e) - 40 * Math.sin(Math.PI * e);
      const crouch = Math.sin(Math.PI * e) * 0 + (e < .15 || e > .85 ? 30 : 8);
      return { hip: [ax - 6, ay - 71 + crouch], t: -78, foot: [ax, ay], kb: -1, ua: lerp(120, -40, Math.sin(Math.PI * e)), fa: lerp(100, -40, Math.sin(Math.PI * e)), p: e };
    }
  };

  // --- Isquios ---
  T.rdlBar = { st: [], frames: T.smithRDL.frames, dyn: [{ k: 'plate', c: 'hand', r: 13 }] };
  T.stiffLeg = { st: [], frames: [{ hip: [100, 113], t: -90, foot: [102, 184], kb: -1, ua: 90, fa: 90 }, { hip: [92, 112], t: -8, foot: [102, 184], kb: -1, ua: 90, fa: 90 }], dyn: [{ k: 'plate', c: 'hand', r: 13 }] };
  T.rdlSingle = { st: [], frames: [{ hip: [100, 113], t: -90, foot: [102, 184], kb: -1, th2: 90, sn2: 90, ua: 90, fa: 90 }, { hip: [92, 112], t: -6, foot: [102, 184], kb: -1, th2: 176, sn2: 176, ft2: 90, ua: 90, fa: 90 }], dyn: [{ k: 'db', c: 'hand' }] };
  T.ballCurl = { flip: true, st: [], frames: [{ hip: [96, 166], shp: [52, 180], foot: [160, 160], kb: -1, ft: -60, ua: 6, fa: 6 }, { hip: [96, 148], shp: [52, 180], foot: [122, 158], kb: -1, ft: -60, ua: 6, fa: 6 }], dyn: [{ k: 'ball', c: { j: 'ankle', dy: 16 }, r: 14 }] };
  T.cableLegCurl = { ...T.standingCurl, st: [['s', 168, 20, 168, FLOOR, 5, 'eq'], pulley(162, 180), ['s', 132, 60, 132, 120, 4, 'eq']], dyn: [{ k: 'cable', a: [162, 180], b: 'ankle' }, { k: 'circle', c: 'ankle', r: 3.5, cls: 'grip' }] };
  T.kbSwing = { st: [], frames: [{ hip: [84, 116], t: -24, foot: [102, 184], kb: -1, ua: 112, fa: 112 }, { hip: [100, 113], t: -92, foot: [102, 184], kb: -1, ua: 2, fa: 2 }], dyn: [{ k: 'kb', c: 'hand' }] };
  T.pullThrough = { st: [['s', 20, 40, 20, FLOOR, 5, 'eq'], pulley(26, 180)], frames: [{ hip: [84, 116], t: -26, foot: [104, 184], kb: -1, ua: 112, fa: 112 }, { hip: [100, 113], t: -90, foot: [104, 184], kb: -1, ua: 96, fa: 96 }], dyn: [{ k: 'cable', a: [26, 180], b: 'hand' }, { k: 'line', a: { j: 'hand', dy: -4 }, b: { j: 'hand', dy: 4 }, w: 3.5, cls: 'rope' }] };

  // --- Glúteo ---
  T.hipThrustUni = { ...T.bbHipThrust, far: { th2: -6, sn2: -6, ft2: -90 }, dyn: [] };
  T.hipThrustBand = { ...T.hipThrust, dyn: [...T.hipThrust.dyn, { k: 'circle', c: { j: 'knee', dy: -2 }, r: 4, cls: 'bandc' }] };
  T.gluteBridge = { flip: false, st: [], frames: [{ hip: [104, 178], shp: [58, 180], foot: [136, 186], kb: -1, ua: 4, fa: 4 }, { hip: [104, 150], shp: [58, 180], foot: [136, 186], kb: -1, ua: 4, fa: 4 }] };
  T.gluteBridgeBar = { ...T.gluteBridge, dyn: [{ k: 'plate', c: { j: 'hip', n: 12 }, r: 13 }] };
  T.gluteBridgeUni = { ...T.gluteBridge, far: { th2: -14, sn2: -14, ft2: -90 } };
  T.cableAbd = { view: 'front', st: [['s', 22, 30, 22, FLOOR, 5, 'eq'], pulley(28, 182)], frames: [{ ...STAND_F, th: 88, th2: 86, sn2: 90, ua: 96, fa: 96, hand2: [46, 90], eb2: 1 }, { ...STAND_F, th: 52, th2: 86, sn2: 90, ua: 96, fa: 96, hand2: [46, 90], eb2: 1 }], dyn: [{ k: 'cable', a: [28, 182], b: 'ankle' }, { k: 'circle', c: 'ankle', r: 3.5, cls: 'grip' }] };
  T.cableAdd = { view: 'front', st: [['s', 178, 30, 178, FLOOR, 5, 'eq'], pulley(172, 182)], frames: [{ ...STAND_F, th: 58, th2: 86, sn2: 90, ua: 96, fa: 96 }, { ...STAND_F, th: 98, th2: 86, sn2: 90, ua: 96, fa: 96 }], dyn: [{ k: 'cable', a: [172, 182], b: 'ankle' }, { k: 'circle', c: 'ankle', r: 3.5, cls: 'grip' }] };
  const SIDE = { hip: [104, 172], t: 180, th: 2, sn: 2, ft: -90, th2: 2, sn2: 2, ft2: -90, ua: 140, fa: -96, ua2: 30, fa2: 10 };
  T.sideLegRaise = { st: [], frames: [SIDE, { ...SIDE, th: -36, sn: -36 }] };
  T.clamshell = { st: [], frames: [{ ...SIDE, th: 14, sn: 178, ft: 180, th2: 14, sn2: 178, ft2: 180 }, { ...SIDE, th: -30, sn: 150, ft: 160, th2: 14, sn2: 178, ft2: 180 }] };
  T.bandWalk = { view: 'front', st: [], alt: true, dur: 1500, fn: ph => { const e = Math.max(0, Math.sin(ph * TAU)); return { hip: [100, 124], t: -90, th: 70 - 14 * e, sn: 96 - 4 * e, ua: 96, fa: 60, p: ph }; }, dyn: [{ k: 'band', a: { seg: ['knee', 'ankle'], f: .5 }, b: { seg: ['knee2', 'ankle2'], f: .5 } }] };
  T.hipHike = { view: 'front', st: [['r', 88, 172, 34, 16, 'eqf']], frames: [{ hip: [100, 106], t: -90, th: 88, sn: 92, th2: 92, sn2: 90, ua: 96, fa: 96 }, { hip: [100, 100], t: -90, th: 88, sn: 92, th2: 96, sn2: 92, ua: 96, fa: 96 }] };
  T.ballSqueeze = { ...T.adductor, dyn: [{ k: 'ball', c: { seg: ['knee', 'knee2'] }, r: 8 }] };

  // --- Gemelo y tibial ---
  T.calfDb = { st: [['r', 102, 177, 30, 11, 'eqf']], frames: [{ ...STAND, hip: [100, 109], ft: -16, ua: 90, fa: 90 }, { ...STAND, hip: [100, 96], ft: 40, ua: 90, fa: 90 }], dyn: [{ k: 'db', c: 'hand' }] };
  T.calfUni = { ...T.calfDb, far: { th2: 92, sn2: 160, ft2: 120 } };
  T.calfSmith = { ...T.calfDb, st: [['r', 102, 177, 30, 11, 'eqf'], ...smithRails, ['s', 104, 10, 104, FLOOR, 2, 'eq2']], frames: T.calfDb.frames.map(f => ({ ...f, ua: undefined, fa: undefined, handAt: ['shoulder', 8, -4], eb: 1 })), dyn: [{ k: 'plate', c: { j: 'shoulder', dx: -2, dy: -3 }, r: 13 }] };
  T.donkeyCalf = { st: [['r', 70, 177, 30, 11, 'eqf'], pad(130, 120, 160, 120, 8), ['s', 150, 124, 150, FLOOR, 4, 'eq']], frames: [{ hip: [84, 106], t: -8, th: 90, sn: 90, ft: -14, hand: [140, 116], eb: 1 }, { hip: [84, 94], t: -8, th: 90, sn: 90, ft: 40, hand: [140, 116], eb: 1 }] };
  T.jumpRope = { st: [], dur: 700, fn: ph => { const h = Math.abs(Math.sin(ph * Math.PI)); return { hip: [100, 112 - 7 * h], t: -90, th: 90, sn: 92, ft: 30 + 20 * h, ua: 80, fa: 10, p: ph }; }, dyn: [{ k: 'jumprope', z: 'back' }] };
  T.calfJumps = { st: [], dur: 700, fn: ph => { const h = Math.abs(Math.sin(ph * Math.PI)); return { hip: [100, 110 - 9 * h], t: -90, th: 90, sn: 90, ft: 40, ua: 90 - 20 * h, fa: 70, p: ph }; } };
  T.tiptoeWalk = { st: [], alt: true, dur: 1300, fn: walk({ ft: 55, y: 106, amp: 14, knee: 14 }) };
  T.heelWalk = { st: [], alt: true, dur: 1300, fn: walk({ ft: -40, amp: 14, knee: 14 }) };
  T.toeRaise = { st: [['s', 72, 30, 72, FLOOR, 6, 'eq2']], frames: [{ hip: [86, 116], t: -96, foot: [104, 184], kb: -1, ft: 0, ua: 90, fa: 90 }, { hip: [86, 116], t: -96, foot: [104, 184], kb: -1, ft: -38, ua: 90, fa: 90 }] };

  // --- Cuerpo completo ---
  const ST = { hip: [100, 113], t: -90, foot: [102, 184], kb: -1, ft: 0, hand: [102, 116], eb: 1 };
  const SQ = { hip: [90, 150], t: -42, foot: [102, 184], kb: -1, ft: 0, hand: [128, 186], eb: 1 };
  const PL = { ...plank([22, 182], [126, 137], [128, 186]), ft: 75, kb: 1 };
  const JP = { hip: [100, 92], t: -90, foot: [102, 166], kb: -1, ft: 40, hand: [104, 8], eb: 1 };
  T.burpee = { st: [], dur: 3200, fn: seq([ST, SQ, PL, PL, SQ, JP], [0, .14, .28, .42, .56, .74]) };
  T.devilPress = { st: [], dur: 3600, fn: seq([ST, SQ, PL, SQ, { ...SQ, hand: [118, 170] }, { ...ST, hand: [104, 20] }], [0, .14, .3, .46, .6, .76]), dyn: [{ k: 'db', c: 'hand', r: 7 }] };
  const DL0 = { hip: [82, 146], t: -32, foot: [100, 184], kb: -1, ft: 0, hand: [112, 172], eb: 1 };
  const EXT = { hip: [100, 112], t: -96, foot: [100, 180], kb: -1, ft: 30, hand: [106, 118], eb: 1 };
  const RACK = { hip: [100, 113], t: -88, foot: [102, 184], kb: -1, ft: 0, hand: [114, 64], eb: -1 };
  const RACKSQ = { hip: [90, 134], t: -76, foot: [102, 184], kb: -1, ft: 0, hand: [116, 86], eb: -1 };
  T.powerClean = { st: [], dur: 3000, fn: seq([DL0, EXT, RACKSQ, RACK, RACK, EXT], [0, .25, .45, .6, .8, .92]), dyn: [{ k: 'plate', c: 'hand', r: 13 }] };
  T.hangClean = { st: [], dur: 2600, fn: seq([EXT, { ...EXT, hip: [90, 116], t: -60, foot: [100, 184], ft: 0, hand: [112, 130] }, EXT, RACKSQ, RACK], [0, .2, .38, .55, .75]), dyn: [{ k: 'plate', c: 'hand', r: 13 }] };
  const OHS = { hip: [94, 140], t: -74, foot: [102, 184], kb: -1, ft: 0, hand: [96, 22], eb: 1 };
  const OH = { ...ST, hand: [100, 18] };
  T.snatch = { st: [], dur: 3000, fn: seq([DL0, EXT, OHS, OH, OH, EXT], [0, .25, .45, .62, .8, .92]), dyn: [{ k: 'plate', c: 'hand', r: 13 }] };
  const SPLIT = { hip: [98, 124], t: -90, foot: [126, 184], kb: -1, ft: 0, foot2: [70, 182], kb2: -1, ft2: 30, hand: [102, 22], eb: 1 };
  const two = f => ({ foot2: f.foot, kb2: f.kb, ft2: f.ft, ...f });
  T.cleanJerk = { st: [], dur: 4200, fn: seq([DL0, EXT, RACKSQ, RACK, { ...RACK, hip: [100, 122], foot: [102, 184] }, SPLIT, OH].map(two), [0, .15, .28, .4, .52, .64, .82]), dyn: [{ k: 'plate', c: 'hand', r: 13 }] };
  const TH_SQ = { hip: [84, 148], t: -70, foot: [104, 184], kb: -1, ft: 0, hand: [114, 100], eb: -1 };
  const TH_ST = { hip: [100, 113], t: -88, foot: [104, 184], kb: -1, ft: 0, hand: [114, 64], eb: -1 };
  const TH_UP = { ...TH_ST, hand: [104, 18], eb: 1 };
  T.thruster = { st: [], dur: 2800, fn: seq([TH_ST, TH_SQ, TH_ST, TH_UP], [0, .25, .5, .7]), dyn: [{ k: 'plate', c: 'hand', r: 13 }] };
  T.squatPress = { ...T.thruster, dyn: [{ k: 'db', c: 'hand', r: 7 }] };
  T.wallBall = { st: [['s', 176, 10, 176, FLOOR, 6, 'eq2'], ['c', 168, 22, 5, 'eqo']], dur: 2400, fn: seq([{ ...TH_ST, hand: [116, 86], eb: 1 }, { ...TH_SQ, hand: [118, 116], eb: 1 }, { ...TH_ST, hand: [116, 86], eb: 1 }, { ...TH_UP, hand: [120, 24] }], [0, .3, .6, .78]), dyn: [{ k: 'ball', c: { j: 'hand', dx: 4, dy: -6 }, r: 10 }] };
  const TG = [
    { hip: [104, 178], t: 180, foot: [132, 186], kb: -1, ft: 0, foot2: [174, 180], kb2: 1, ft2: -90, hand: [66, 130], eb: 1, hand2: [130, 186], eb2: 1 },
    { hip: [104, 176], t: 230, foot: [132, 186], kb: -1, ft: 0, foot2: [174, 180], kb2: 1, ft2: -90, hand: [80, 98], eb: 1, hand2: [74, 186], eb2: 1 },
    { hip: [100, 140], t: 268, foot: [128, 184], kb: -1, ft: 0, foot2: [64, 184], kb2: 1, ft2: 180, hand: [100, 46], eb: 1, hand2: [96, 132], eb2: 1 },
    { hip: [100, 113], t: 270, foot: [104, 184], kb: -1, ft: 0, foot2: [98, 184], kb2: -1, ft2: 0, hand: [100, 18], eb: 1, hand2: [100, 116], eb2: 1 }
  ];
  T.getUp = { st: [], dur: 6000, fn: seq([TG[0], TG[1], TG[2], TG[3], TG[3], TG[2], TG[1]], [0, .14, .28, .42, .55, .7, .85]), dyn: [{ k: 'kb', c: { j: 'hand', dy: -10 } }] };
  T.sledPush = { st: [['r', 140, 150, 40, 34, 'eqf'], ['s', 144, 150, 140, 104, 4, 'eq']], alt: true, dur: 1300, fn: ph => { const s = Math.sin(ph * TAU), c = Math.max(0, Math.cos(ph * TAU)); return { hip: [92, 124], t: -34, th: 70 + 40 * s, sn: 130 + 30 * s - 30 * c, ft: 60, hand: [140, 106], eb: 1, p: ph }; } };
  T.battleRopes = { st: [['c', 194, 182, 4, 'eqo']], alt: true, dur: 700, fn: ph => { const s = Math.sin(ph * TAU); return { hip: [96, 128], t: -76, foot: [104, 184], kb: -1, foot2: [90, 184], kb2: -1, ua: 30 - 34 * s, fa: 10 - 40 * s, p: ph }; }, dyn: [{ k: 'wave', a: 'hand', b: [194, 182], amp: 7 }, { k: 'wave', a: 'hand2', b: [194, 182], amp: 7, dir: -1, z: 'mid' }] };
  T.slamBall = { st: [], frames: [{ hip: [100, 108], t: -94, foot: [102, 182], kb: -1, ft: 30, hand: [102, 16], eb: 1 }, { hip: [88, 146], t: -36, foot: [102, 184], kb: -1, ft: 0, hand: [132, 168], eb: 1 }], dyn: [{ k: 'ball', c: { j: 'hand', dx: 2, dy: 4 }, r: 11 }] };
  T.tireFlip = { st: [], frames: [{ hip: [76, 146], t: -26, foot: [96, 184], kb: -1, hand: [124, 176], eb: 1 }, { hip: [96, 112], t: -74, foot: [100, 184], kb: -1, hand: [146, 110], eb: 1 }], dyn: [{ k: 'rot', c: [176, 176], a0: 180, a1: 250, len: 70, off: 0, w: 22, cls: 'tire' }] };
  T.jacks = { view: 'front', st: [], dur: 900, fn: ph => { const e = ping(ph); return { hip: [100, 113 - 6 * Math.sin(Math.PI * e)], t: -90, th: 88 - 20 * e, sn: 90 - 18 * e, ua: lerp(84, -70, e), fa: lerp(86, -80, e), p: e }; } };
  T.walkPlain = { st: [], alt: true, dur: 1500, fn: walk() };

  // --- Cardio ---
  T.treadWalk = { ...T.treadmill, dur: 1500, fn: walk({ x: 96, amp: 18, knee: 24 }) };
  T.treadIncline = { st: [['s', 30, 186, 166, 168, 7, 'eq'], ['s', 160, 170, 150, 84, 4, 'eq'], ['s', 150, 84, 164, 78, 6, 'eqo'], ['s', 150, 98, 128, 98, 3, 'eq']], noFloor: true, alt: true, dur: 1600, fn: walk({ x: 96, y: 106, t: -82, amp: 20, knee: 34 }) };
  T.spinning = { ...T.bike, fn: ph => ({ ...T.bike.fn(ph), hip: [90, 104], t: -50 }) };
  T.airBike = { ...T.bike, fn: ph => { const P = T.bike.fn(ph); return { ...P, hand: [144 + 10 * Math.cos(ph * TAU), 92 + 3 * Math.sin(ph * TAU)] }; }, dyn: [...T.bike.dyn, { k: 'line', a: 'hand', b: [140, 150], w: 4, z: 'back' }, { k: 'circle', c: [150, 150], r: 18, cls: 'eqo' }] };
  T.skiErg = { st: [['s', 150, 6, 150, FLOOR, 6, 'eq'], pulley(140, 12)], frames: [{ hip: [100, 112], t: -94, foot: [104, 184], kb: -1, hand: [116, 22], eb: 1 }, { hip: [90, 124], t: -38, foot: [104, 184], kb: -1, hand: [126, 156], eb: 1 }], dyn: [{ k: 'cable', a: [140, 12], b: 'hand' }, { k: 'grip', c: 'hand' }], dur: 1800 };
  T.swim = { st: [], noFloor: true, alt: true, dur: 1800, fn: ph => { const a = ph * 360, k = Math.sin(ph * TAU * 2); return { hip: [96, 108], t: -2, ua: -180 + a, fa: -180 + a + 10, th: 180 + 10 * k, sn: 180 + 16 * k, ft: 180, p: ph }; }, dyn: [{ k: 'water', y: 104, z: 'front' }] };

  // --- Variantes adicionales ---
  T.smithBench = { ...T.benchPress, st: [...bench, ...smithRails, ['s', 82, 10, 82, FLOOR, 2, 'eq2']] };
  T.inclineBar = { ...T.inclineDb, st: [...T.inclineDb.st, ['s', 64, 60, 64, 150, 3, 'eq2']], dyn: [{ k: 'plate', c: 'hand', r: 13 }] };
  T.smithIncline = { ...T.inclineBar, st: [...T.inclineDb.st, ...smithRails, ['s', 80, 10, 80, FLOOR, 2, 'eq2']] };
  T.smithShoulder = { ...T.seatedBarPress, st: [...T.seatedBarPress.st, ...smithRails, ['s', 88, 10, 88, FLOOR, 2, 'eq2']] };
  T.shrugBar = { view: 'front', st: [], frames: T.shrug.frames, dyn: [{ k: 'bar2', ext: 26 }, { k: 'circle', c: { j: 'hand', dx: 26 }, r: 11, cls: 'plate' }, { k: 'circle', c: { j: 'hand2', dx: -26 }, r: 11, cls: 'plate' }] };
  T.lumbarMachine = { st: [...tower(14), ...seat(64, 100, 156, 84)], frames: [{ ...SIT, t: -42, ...crossed }, { ...SIT, t: -100, ...crossed }], dyn: [{ k: 'line', a: { j: 'shoulder', n: -10, al: -14 }, b: { j: 'shoulder', n: -10, al: 4 }, w: 9, cls: 'pad' }, { k: 'line', a: { j: 'shoulder', n: -12, al: -6 }, b: [80, 152], w: 3, cls: 'eq2', z: 'back' }, stack(14)] };
  T.dbShoulderStand = { view: 'front', st: [], frames: [{ ...STAND_F, hand: [134, 58], eb: 1 }, { ...STAND_F, hand: [124, 16], eb: 1 }], dyn: [{ k: 'dbF', c: 'hand' }, { k: 'dbF', c: 'hand2' }] };
  T.frontRaiseBar = { ...T.frontRaise, dyn: [{ k: 'plate', c: 'hand', r: 11 }] };
  T.rearFlyDb = { st: [], frames: [{ hip: [84, 114], t: -14, foot: [102, 184], kb: -1, ua: 92, fa: 92 }, { hip: [84, 114], t: -14, foot: [102, 184], kb: -1, ua: 150, fa: 150, uaL: .55, faL: .55 }], dyn: [{ k: 'db', c: 'hand' }] };
  T.reverseCross = { view: 'front', st: [['s', 178, 18, 178, FLOOR, 5, 'eq'], ['s', 22, 18, 22, FLOOR, 5, 'eq'], pulley(174, 70), pulley(26, 70)], frames: [{ ...STAND_F, ua: 4, fa: 4, uaL: .3, faL: .3 }, { ...STAND_F, ua: 2, fa: 2 }], dyn: [{ k: 'cable', a: [26, 70], b: 'hand' }, { k: 'cable', a: [174, 70], b: 'hand2' }, { k: 'grip', c: 'hand' }, { k: 'grip', c: 'hand2' }] };
  T.skullCable = { ...T.skull, st: [...bench, ['s', 20, 120, 20, FLOOR, 5, 'eq'], pulley(26, 150)], dyn: [{ k: 'cable', a: [26, 150], b: 'hand' }, { k: 'line', a: { j: 'hand', dy: -4 }, b: { j: 'hand', dy: 4 }, w: 4 }] };
  T.hangingLegRaise = { ...T.pullup, frames: [{ hip: [100, 120], t: -92, th: 92, sn: 92, hand: [106, 22], eb: 1 }, { hip: [102, 118], t: -96, th: -4, sn: -4, ft: -80, hand: [106, 22], eb: 1 }] };
  T.hangingKneeRaise = { ...T.pullup, frames: [{ hip: [100, 120], t: -92, th: 92, sn: 96, hand: [106, 22], eb: 1 }, { hip: [102, 118], t: -96, th: -24, sn: 92, hand: [106, 22], eb: 1 }] };
  T.abWheel = { st: [], frames: [{ hip: [72, 146], t: -44, th: 104, sn: 180, ft: 180, hand: [116, 176], eb: 1 }, { hip: [96, 166], t: -8, th: 152, sn: 180, ft: 180, hand: [168, 176], eb: 1 }], dyn: [{ k: 'circle', c: { j: 'hand', dy: 4 }, r: 8, cls: 'plate' }] };
  T.hackBar = { st: [], frames: [{ hip: [100, 113], t: -88, foot: [104, 184], kb: -1, handAt: ['hip', -4, 6], eb: -1 }, { hip: [84, 146], t: -60, foot: [104, 184], kb: -1, handAt: ['hip', -4, 18], eb: -1 }], dyn: [{ k: 'plate', c: 'hand', r: 13 }] };
  T.calfBar = { ...T.calfSmith, st: [['r', 102, 177, 30, 11, 'eqf']] };

  T.generic = { st: [], frames: [{ ...STAND }, { ...STAND, ua: 0, fa: 0 }] };

  // ---------- motor ----------
  function poseAt(tpl, ph) {
    ph = ((ph % 1) + 1) % 1;
    if (tpl.fn) { const P = tpl.fn(ph); return [P, P.p ?? 0]; }
    const [A, B] = tpl.frames;
    let e;
    if (ph < .1) e = 0; else if (ph < .45) e = ease((ph - .1) / .35); else if (ph < .55) e = 1; else if (ph < .95) e = 1 - ease((ph - .55) / .4); else e = 0;
    return [mix(A, B, e), e];
  }

  function render(key, ex, ph) {
    const tpl = T[key] || T.generic;
    let [P, p] = poseAt(tpl, ph);
    if (tpl.far) P = { ...P, ...tpl.far };
    const Q = tpl.alt ? poseAt(tpl, ph + .5)[0] : null;
    const J = solve(P, Q, tpl);
    J.ph = ((ph % 1) + 1) % 1;
    const hot = hotFn(ex || {});
    const fig = tpl.view === 'front' ? figFront(J, hot) : figSide(J, hot);
    const dyn = z => (tpl.dyn || []).filter(d => (d.z || 'front') === z).map(d => dynSVG(d, J, p)).join('');
    return `${tpl.noFloor ? '' : ln([10, FLOOR + 1], [190, FLOOR + 1], 2, 'floor')}${staticSVG(tpl.st || [])}${dyn('back')}${fig.far}${dyn('mid')}${fig.torso}${fig.near}${dyn('front')}${staticSVG(tpl.fr || [])}`;
  }

  const svg = (key, ex, ph = .5, cls = '') => `<svg viewBox="0 0 200 200" class="ex-anim ${cls}" aria-hidden="true">${render(key, ex, ph)}</svg>`;

  // Animación de todos los elementos [data-anim] visibles con un único bucle
  const live = new Map();
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { const a = live.get(e.target); if (a) a.vis = e.isIntersecting; }), { rootMargin: '40px' }) : null;
  let running = false;
  function tick(now) {
    running = live.size > 0;
    for (const [el, a] of live) {
      if (!el.isConnected) { live.delete(el); io && io.unobserve(el); continue; }
      if (!a.vis || a.paused || now - a.last < (a.big ? 30 : 50)) continue;
      a.last = now;
      const tpl = T[a.key] || T.generic;
      const dur = (tpl.dur || 2800) / (a.speed || 1);
      a.ph = (a.ph + (now - (a.prev || now)) / dur) % 1;
      a.prev = now;
      a.svg.innerHTML = render(a.key, a.ex, a.ph);
    }
    for (const a of live.values()) if (a.paused || !a.vis) a.prev = 0;
    if (running) requestAnimationFrame(tick);
  }
  function mount(el, key, ex, opts = {}) {
    el.innerHTML = svg(key, ex, opts.ph ?? .05);
    if (reduce && !opts.force) return;
    const a = { key, ex, ph: opts.ph ?? Math.random() * .3, last: 0, prev: 0, vis: !io, svg: el.firstChild, big: !!opts.big, speed: 1, paused: false };
    live.set(el, a);
    io && io.observe(el);
    if (!running) { running = true; requestAnimationFrame(tick); }
    return a;
  }
  function control(el) { return live.get(el); }

  window.ANIM = { T, svg, mount, control, render };
})();
