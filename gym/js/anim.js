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
    J.t = t; J.d = [cos(t), sin(t)]; J.n = [-sin(t), cos(t)];
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
    const [a0, a1] = front ? [t - 95, t + 95] : [t - 100, t + 35];
    const p0 = add(h, a0, r), p1 = add(h, a1, r);
    return `<path class="hair" d="M${r1(p0[0])} ${r1(p0[1])} A${r} ${r} 0 0 1 ${r1(p1[0])} ${r1(p1[1])} Z"/>`;
  }

  function figSide(J, hot) {
    const { hip, shoulder, n, d } = J;
    const far = `<g class="far">${ln(J.knee2, J.ankle2, 10, 'b' + hot('calves'))}${ln(J.ankle2, J.toe2, 6, 'b')}${ln(hip, J.knee2, 12.5, 'b' + hot('quads', 'hamstrings', 'adductors', 'abductors'))}
      ${ln(J.elbow2, J.hand2, 8, 'b' + hot('forearms'))}${ln(J.hand2, J.handTip2, 6, 'b')}${ln(shoulder, J.elbow2, 9, 'b' + hot('biceps', 'triceps'))}</g>`;
    const m = mid(hip, shoulder, .5);
    const off = (p, k) => [p[0] + n[0] * k, p[1] + n[1] * k];
    const h1 = add(hip, J.t, 3), s1 = add(shoulder, J.t, -3);
    const q = (a, b, k1, k2, ms) => { const c = hot(...ms); return c ? poly([a, b, off(b, k2), off(a, k1)], 'tq' + c) : ''; };
    const torso = `${ci(off(hip, -2.5), 7.5, 'b' + hot('glutes', 'abductors'))}${ln(hip, shoulder, 17, 'b')}
      ${q(h1, m, 7, 8, ['abs', 'obliques'])}${q(m, s1, 8, 8.5, ['chest'])}${q(h1, m, -7, -8, ['lowerback'])}${q(m, s1, -8, -8.5, ['lats', 'upperback', 'traps'])}
      ${ln(shoulder, J.neck, 7, 'b')}${ci(J.head, L.head, 'b head')}${hair(J, false)}`;
    void d;
    const near = `${ln(hip, J.knee, 12.5, 'b' + hot('quads', 'hamstrings', 'adductors', 'abductors'))}${ln(J.knee, J.ankle, 10, 'b' + hot('calves'))}${ln(J.ankle, J.toe, 6, 'b')}`;
    const arm = `${ci(shoulder, 6.5, 'b' + hot('delts', 'rear'))}${ln(shoulder, J.elbow, 9, 'b' + hot('biceps', 'triceps'))}${ln(J.elbow, J.hand, 8, 'b' + hot('forearms'))}${ln(J.hand, J.handTip, 6, 'b')}`;
    return { far, torso: torso + near, near: arm };
  }

  function figFront(J, hot) {
    const { hip, shoulder } = J, cx = hip[0], hy = hip[1], tw = J.tw;
    const sy = shoulder[1] + 2 + J.sl, wy = hy - 9, my = (sy + wy) / 2;
    const leg = (h, k, a, t, s) => `${ln(h, k, 12.5, 'b' + hot('quads', 'hamstrings', 'adductors', 'abductors'))}${ln(k, a, 10, 'b' + hot('calves'))}${ln(a, t, 6, 'b')}`;
    const legs = leg(J.hipL, J.knee2, J.ankle2, J.toe2) + leg(J.hipR, J.knee, J.ankle, J.toe);
    const up = [[cx - 15 * tw, sy], [cx + 15 * tw, sy], [cx + 11, my], [cx - 11, my]];
    const lo = [[cx - 11, my], [cx + 11, my], [cx + 10, wy], [cx - 10, wy]];
    const pel = [[cx - 10, wy], [cx + 10, wy], [cx + 12, hy + 5], [cx - 12, hy + 5]];
    const torso = `${poly(pel, 'tb' + hot('glutes', 'abductors'))}${poly(lo, 'tb' + hot('abs', 'obliques', 'lowerback'))}${poly(up, 'tb' + hot('chest', 'lats', 'upperback', 'traps'))}
      ${ln([cx, sy], J.neck, 7, 'b')}${ci(J.head, L.head, 'b head')}${hair(J, true)}`;
    const arm = (s, e, h, tip) => `${ci(s, 6.5, 'b' + hot('delts', 'rear'))}${ln(s, e, 9, 'b' + hot('biceps', 'triceps'))}${ln(e, h, 8, 'b' + hot('forearms'))}${ln(h, tip, 6, 'b')}`;
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
