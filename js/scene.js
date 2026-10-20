/* Scene: shared state and drawing for the one bedroom all four rounds play out in.
   World units: a 1600x900 room. The clock's local origin is its bottom centre and its parts
   keep the Slap the Alarm Quiet layout (a 320x300 box), drawn at CS scale. */
window.App = window.App || {};
App.scene = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const $ = id => document.getElementById(id);
  const el = {};
  ['stage', 'shake', 'cam', 'clock', 'bellL', 'bellR', 'bar', 'lines', 'display', 'clockCracks', 'looseBell',
   'arm', 'armLine', 'armShape', 'armCrease', 'hand', 'fingers', 'fist', 'blanket', 'blanketFold', 'hair', 'sleepFace', 'backHair', 'prickles', 'fx', 'roomLight', 'beam', 'blanketShade', 'armHi', 'bed', 'blanketG', 'bedContact',
   'skyDawn', 'skyMidday', 'skySunset', 'skyNight', 'rooster', 'neighbor', 'cat', 'windowFx', 'wallCracks']
    .forEach(k => { el[k] = $(k); });

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const M = reduce ? 0.35 : 1;                      // motion scale for shakes and jitters
  const CS = 0.8;                                   // clock scale in the room
  const HOME = { x: 720, y: 600 };                  // clock pivot on the nightstand
  // the bed and sleeper are drawn at size 1 around the middle of the bed's feet; "Bed and sleeper size"
  // (Triggers tab, Sleeper) scales them from there, shifted left so the bed stays clear of the nightstand
  const BED = { x: 415, y: 760 };
  const bedK = () => App.cfg.bedScale, bedDx = () => -150 * (App.cfg.bedScale - 1);
  const bedPt = (x, y) => ({ x: BED.x + bedDx() + (x - BED.x) * bedK(), y: BED.y + (y - BED.y) * bedK() });
  const SHOULDER = { x: 520, y: 612 };              // right shoulder, under the blanket (updated with the bed size)
  const UPPER = 120, FORE = 112;                    // upper arm and forearm lengths at bed size 1 (room px)
  let elbowSide = -1;
  const WALL_EDGE = 1466;
  const FLOOR = 760;
  const U = 1.6;                                    // Throw the Clock's unit (clock width / 140)

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const easeOut = x => 1 - Math.pow(1 - x, 2.2);
  const easeOutBack = x => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const approach = (v, t, rate, dt) => v + (t - v) * (1 - Math.exp(-dt / rate));
  const rnd = (a, b) => a + Math.random() * (b - a);
  // smooth tremble from Shake Your Fist: layered sines instead of per-frame random jumps
  const wob = (t, f, seed) => Math.sin(t * f + seed) * .6 + Math.sin(t * f * 1.63 + seed * 2.1) * .4;

  /* ---------- state ---------- */
  const W = {};
  function resetState() {
    W.clock = { px: HOME.x, py: HOME.y, rot: 0, sx: 1, sy: 1, jx: 0, hop: 0, bar: 0, droop: 0, swing: 0, bellBase: 16,
      linesOp: 0, linesScale: 1, linesY: 0, text: '5:59', bright: .35, broken: false };
    W.hand = { mode: 'open', x: bedPt(470, 680).x, y: bedPt(470, 680).y, rot: 0, ax: 70, ay: 63, alpha: 1, fingers: 1 };
    W.blanket = { lumpX: 440, h: 62, breath: 0, jerk: 0, roll: 0 };
    W.cam = { x: 705, y: 455, s: 1.36 };
    W.shake = 0;
    W.cast = { rooster: { y: 0, rot: 0, x: 0 }, neighbor: { y: 160, rot: 0, sx: 1, sy: 1, x: 0 }, cat: { y: 0, on: false, puff: 0, hiss: false, x: 0 } };
    W.sky = { dawn: 1, midday: 0, sunset: 0, night: 0 };
    W.looseBell = null;
    W.cracks = [];
    W.texts = [];
    el.fx.textContent = ''; el.windowFx.textContent = ''; el.wallCracks.textContent = ''; el.clockCracks.textContent = '';
    el.prickles.setAttribute('d', '');
    lastCat = '';
  }

  /* ---------- clock ---------- */
  const pivotToCenter = c => ({ x: c.px + Math.sin(c.rot * Math.PI / 180) * 80, y: c.py - Math.cos(c.rot * Math.PI / 180) * 80 });
  const barTop = () => W.clock.py - W.clock.hop + (-198 + W.clock.bar) * CS * W.clock.sy;

  function drawClock() {
    const c = W.clock;
    el.clock.setAttribute('transform', `translate(${(c.px + c.jx).toFixed(1)} ${(c.py - c.hop).toFixed(1)}) rotate(${c.rot.toFixed(2)}) scale(${(CS * c.sx).toFixed(4)} ${(CS * c.sy).toFixed(4)})`);
    const bb = c.bellBase + c.droop;
    el.bellL.setAttribute('transform', `translate(-80 -174) rotate(${(-bb + c.swing).toFixed(2)}) translate(0 ${(c.droop * .35).toFixed(1)})`);
    el.bellR.setAttribute('transform', `translate(80 -174) rotate(${(bb - c.swing).toFixed(2)}) translate(0 ${(c.droop * .35).toFixed(1)})`);
    el.bellR.style.display = c.broken ? 'none' : '';
    el.bar.setAttribute('transform', c.broken ? 'translate(-8 -12) rotate(-22 0 -186)' : `translate(0 ${c.bar.toFixed(2)})`);
    el.lines.setAttribute('transform', `translate(0 ${(-236.5 + c.linesY).toFixed(1)}) scale(${c.linesScale.toFixed(3)})`);
    el.lines.setAttribute('opacity', clamp(c.linesOp, 0, 1).toFixed(3));
    if (el.display.textContent !== c.text) el.display.textContent = c.text;
    el.display.setAttribute('opacity', clamp(c.bright, 0, 1).toFixed(2));
  }

  // shared ringing look, scaled by how hard it rings (r) and how angry it is (lvl 1..4)
  const ANGER = { 1: { jit: 4, hop: 0, swing: 11, rate: .065 }, 2: { jit: 7, hop: 5, swing: 14, rate: .08 },
                  3: { jit: 10, hop: 11, swing: 19, rate: .095 }, 4: { jit: 14, hop: 18, swing: 25, rate: .11 } };
  function ringLook(now, r, lvl) {
    const c = W.clock, A = ANGER[lvl] || ANGER[1], m = r * M * App.cfg.shake;
    c.jx = (Math.random() - .5) * A.jit * m;
    c.hop = Math.abs(Math.sin(now * .028)) * A.hop * m;
    c.swing = A.swing * m * Math.sin(now * A.rate);
    const flick = .5 + .5 * Math.abs(Math.sin(now * .018));
    c.linesOp = r * (.45 + .55 * flick) * 1.2;
    c.linesScale = 1 + (.035 + lvl * .012) * m * Math.sin(now * .05) + (1 - r) * .08;
    c.linesY = (1 - r) * 16;
    return (Math.random() - .5) * 3 * m * (lvl > 2 ? 1.6 : 1);   // extra rattle tilt
  }

  /* ---------- hand and arm ---------- */
  function handMatrix(h) {
    const a = h.rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const F = App.cfg.handScale;
    return (u, v) => { const dx = (u - h.ax) * F, dy = (v - h.ay) * F; return { x: h.x + dx * ca - dy * sa, y: h.y + dx * sa + dy * ca }; };
  }
  function drawHand() {
    const h = W.hand, open = h.mode === 'open', show = h.mode !== 'hidden', F = App.cfg.handScale;
    const tf = `translate(${h.x.toFixed(1)} ${h.y.toFixed(1)}) rotate(${h.rot.toFixed(2)}) scale(${F}) translate(${-h.ax} ${-h.ay})`;
    el.hand.setAttribute('transform', tf);
    el.fist.setAttribute('transform', tf);
    el.hand.setAttribute('opacity', show && open ? h.alpha.toFixed(2) : 0);
    el.fist.setAttribute('opacity', show && !open ? h.alpha.toFixed(2) : 0);
    el.fingers.setAttribute('transform', `translate(40 0) scale(${h.fingers.toFixed(3)} 1) translate(-40 0)`);
    // arm: a rigid upper arm and forearm hinged at the elbow (two-bone IK), so it moves like a limb.
    // Out of reach, the shoulder leans in a little first; only then does the arm stretch.
    Object.assign(SHOULDER, bedPt(442, 580));   // the top shoulder, just beside the head
    const bk = bedK(), UP = UPPER * bk, FO = FORE * bk;
    const cuff = handMatrix(h)(16, open ? 40 : 32);
    let S0 = { x: SHOULDER.x, y: SHOULDER.y };
    let dx = cuff.x - S0.x, dy = cuff.y - S0.y, d = Math.max(1, Math.hypot(dx, dy));
    const lean = clamp(d - (UP + FO) * .98, 0, 60 * bk);
    if (lean > 0) { S0 = { x: S0.x + dx / d * lean, y: S0.y + dy / d * lean }; dx = cuff.x - S0.x; dy = cuff.y - S0.y; d = Math.max(1, Math.hypot(dx, dy)); }
    const ux = dx / d, uy = dy / d, st = Math.max(1, d / (UP + FO));    // stretch only past full reach
    const L1 = UP * st, L2 = FO * st;
    // the elbow bends up and outward; which side it takes only flips on a clear change, never mid-move
    const pref = -uy * .2 - ux;
    if (Math.abs(pref) > .25) elbowSide = pref > 0 ? 1 : -1;
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), hgt = Math.sqrt(Math.max(0, L1 * L1 - a * a)) * elbowSide;
    const ex = S0.x + ux * a - uy * hgt, ey = S0.y + uy * a + ux * hgt;
    const unit = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
    const [ax, ay] = unit(ex - S0.x, ey - S0.y), [fx, fy] = unit(cuff.x - ex, cuff.y - ey);
    const aw = App.cfg.armWidth;
    // segment outlines, all wound the same way so overlaps fill as one shape
    const seg = (x0, y0, x1, y1, w0, w1, back) => {
      const [tx, ty] = unit(x1 - x0, y1 - y0), bx = x0 - tx * back, by = y0 - ty * back;
      return `M${(bx - ty * w0).toFixed(1)} ${(by + tx * w0).toFixed(1)} L${(x1 - ty * w1).toFixed(1)} ${(y1 + tx * w1).toFixed(1)} ` +
        `L${(x1 + ty * w1).toFixed(1)} ${(y1 - tx * w1).toFixed(1)} L${(bx + ty * w0).toFixed(1)} ${(by - tx * w0).toFixed(1)} Z`;
    };
    const ring = (cx, cy, r) => {   // round elbow, same winding as the segments
      let p = '';
      for (let i = 0; i < 16; i++) { const t = -i / 16 * Math.PI * 2; p += `${i ? 'L' : 'M'}${(cx + Math.cos(t) * r).toFixed(1)} ${(cy + Math.sin(t) * r).toFixed(1)} `; }
      return p + 'Z';
    };
    const wS = aw * .52, wE = aw * .44, wW = aw * .36;
    const dArm = seg(S0.x, S0.y, ex, ey, wS, wE, 28 * bk) + ' ' + seg(ex, ey, cuff.x + fx * 12, cuff.y + fy * 12, wE * 1.02, wW, 0) + ' ' + ring(ex, ey, wE);
    el.armLine.setAttribute('d', dArm); el.armShape.setAttribute('d', dArm);
    // a soft highlight along the upper-left side of each segment
    el.armHi.setAttribute('d', `M${S0.x.toFixed(1)} ${S0.y.toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)} L${cuff.x.toFixed(1)} ${cuff.y.toFixed(1)}`);
    el.armHi.setAttribute('stroke-width', (aw * .18).toFixed(1)); el.armHi.setAttribute('stroke-linejoin', 'round');
    el.armHi.setAttribute('transform', `translate(${(-aw * .12).toFixed(1)} ${(-aw * .12).toFixed(1)})`);
    // sleeve folds: one across the forearm near the cuff, one in the crook of the elbow when it bends
    const px = -fy, py = fx, cx = cuff.x - fx * 46, cy = cuff.y - fy * 46, r = aw * .32;
    let folds = `M${(cx + px * r).toFixed(1)} ${(cy + py * r).toFixed(1)} q${(-fx * 7 - px * r).toFixed(1)} ${(-fy * 7 - py * r).toFixed(1)} ${(-px * 2 * r).toFixed(1)} ${(-py * 2 * r).toFixed(1)}`;
    if (st <= 1 && d < (UP + FO) * .95) {
      const [bx, by] = unit(-(ax + fx) || 0, -(ay + fy) || 0);          // inner side of the elbow
      const mx = ex + bx * aw * .18, my = ey + by * aw * .18;
      folds += ` M${(mx - ax * aw * .3).toFixed(1)} ${(my - ay * aw * .3).toFixed(1)} Q${(mx + bx * 6).toFixed(1)} ${(my + by * 6).toFixed(1)} ${(mx + fx * aw * .3).toFixed(1)} ${(my + fy * aw * .3).toFixed(1)}`;
    }
    el.armCrease.setAttribute('d', folds);
    el.arm.setAttribute('opacity', show ? h.alpha.toFixed(2) : 0);
  }
  // anchor presets in the drawings' own units
  const ANCHOR = { palm: [70, 63], fistGrip: [60, 56], fistCenter: [48, 32] };
  function setAnchor(name) { const a = ANCHOR[name]; W.hand.ax = a[0]; W.hand.ay = a[1]; }

  /* ---------- blanket and sleeper ---------- */
  function drawBlanket() {
    const k0 = bedK(), tf = `translate(${(BED.x + bedDx()).toFixed(1)} ${BED.y}) scale(${k0}) translate(${-BED.x} ${-BED.y})`;
    el.bed.setAttribute('transform', tf); el.blanketG.setAttribute('transform', tf);
    const bc = bedPt(415, 760); el.bedContact.setAttribute('cx', bc.x.toFixed(1)); el.bedContact.setAttribute('rx', (215 * k0).toFixed(1));
    // the bed is seen end-on and the sleeper lies on their side facing the clock: the body is one mound
    // under the blanket, highest at the top shoulder; rolling over at the end swings it to the other side
    const b = W.blanket, k = ease(clamp(b.roll, 0, 1));
    const up = b.jerk * 10, br = b.breath * 3;
    // the body follows the arm: the top shoulder lifts as the hand reaches up, and the head leans toward it
    const hd = W.hand, out = hd.mode !== 'hidden' ? clamp((SHOULDER.y - hd.y) / 260, 0, 1) * hd.alpha : 0;
    b.reach = (b.reach || 0) + (out - (b.reach || 0)) * .12;
    const f = v => v.toFixed(1), pk = 552 - up - br - 6 * b.reach * (1 - k);
    // top edge as a chain of cubic curves, left to right: [start, then c1, c2, end for each curve]
    const q2c = (p0, q, p1) => [[p0[0] + (q[0] - p0[0]) * 2 / 3, p0[1] + (q[1] - p0[1]) * 2 / 3], [p1[0] + (q[0] - p1[0]) * 2 / 3, p1[1] + (q[1] - p1[1]) * 2 / 3], p1];
    const P1 = [330, 590 - up], P2 = [378, 590 - up], P3 = [448, pk], P4 = [570, 648];
    const chain = [[258, 648], [258, 616 - br], [282, 594 - up], P1, ...q2c(P1, [358, 588 - up], P2), [398, 568 - up], [420, pk], P3, [506, pk], [562, 596 - br], P4];
    // rolling over: blend point by point into the same edge mirrored across the bed (and read right to left),
    // so halfway through the body lies flat on its back instead of collapsing
    const mir = chain.map(([x, y]) => [830 - x, y]).reverse();
    const pts = chain.map((pt, i) => [pt[0] + (mir[i][0] - pt[0]) * k, pt[1] + (mir[i][1] - pt[1]) * k]);
    let d = `M256 704 L${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 1; i < pts.length; i += 3) d += ` C${pts.slice(i, i + 3).map(([x, y]) => `${f(x)} ${f(y)}`).join(' ')}`;
    d += ' L574 704 Q415 718 256 704 Z';
    const m = x => x + (830 - 2 * x) * k;
    el.blanket.setAttribute('d', d); el.blanketShade.setAttribute('d', d);
    el.blanketFold.setAttribute('d', `M${f(m(388))} ${f(602 - up)} Q${f(m(440))} ${f(574 - up)} ${f(m(512))} ${f(580 - up)}`);
    // the head turns with the body: at the end they face away from the clock (the ear swaps sides)
    const lean = b.reach * (1 - k);
    el.hair.setAttribute('transform', `translate(${f(lean * 5 + 30 * k)} ${f(-b.jerk * 8 - lean * 3)}) rotate(${(lean * 8 - 8).toFixed(2)} 400 560) translate(400 552) scale(${((k < .5 ? 1 : -1) * Math.max(.55, Math.abs(Math.cos(Math.PI * k)))).toFixed(3)} 1) translate(-400 -552)`);
    el.sleepFace.setAttribute('opacity', 1);
    el.backHair.setAttribute('opacity', 0);
  }

  /* ---------- window cast ---------- */
  let lastCat = '';
  function catSVG(p, hiss) {
    const ink = App.cfg.colCat;
    const key = `${p.toFixed(2)}|${hiss}|${ink}`;
    if (key === lastCat) return; lastCat = key;
    let s = '';
    // tail: lazy curl, or bristled straight up when spooked
    if (p < .05) s += `<path d="M14 -10 C34 -8 32 -30 38 -42 C41 -49 47 -50 50 -45" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`;
    else {
      const tx = 26 - 6 * p, ty = -48 - 34 * p;
      s += `<path d="M12 -14 C24 -22 ${tx} ${ty + 20} ${tx} ${ty}" fill="none" stroke="${ink}" stroke-width="${5 + 7 * p}" stroke-linecap="round"/>`;
      for (let i = 0; i < 7; i++) {
        const k = i / 6, x = 12 + (tx - 12) * k, y = -14 + (ty + 14) * k;
        s += `<path d="M${(x - 6 * p).toFixed(1)} ${y.toFixed(1)} l${(-6 * p).toFixed(1)} -3 M${(x + 6 * p).toFixed(1)} ${y.toFixed(1)} l${(6 * p).toFixed(1)} -3" stroke="${ink}" stroke-width="2.5" stroke-linecap="round"/>`;
      }
    }
    const lift = 9 * p, cy = -24 - lift;
    if (p > .05) s += `<path d="M-12 ${cy + 16} l-3 ${12 + lift} M-4 ${cy + 20} l-1 ${8 + lift} M6 ${cy + 20} l1 ${8 + lift} M13 ${cy + 16} l3 ${12 + lift}" stroke="${ink}" stroke-width="4.5" stroke-linecap="round"/>`;
    if (p < .05) s += `<ellipse cx="0" cy="-24" rx="18" ry="25" fill="${ink}"/>`;
    else {
      // fur puffed out into spikes, back arched
      let d = '';
      const n = 26;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, spike = i % 2 ? 1 + .32 * p : 1;
        const rx = (18 + 5 * p) * spike, ry = (25 - 2 * p) * spike;
        const archY = -6 * p * Math.max(0, -Math.sin(a));
        d += `${i ? 'L' : 'M'}${(Math.cos(a) * rx).toFixed(1)} ${(cy + Math.sin(a) * ry + archY).toFixed(1)}`;
      }
      s += `<path d="${d}Z" fill="${ink}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>`;
    }
    const hy = -58 - lift * 1.2;
    s += `<circle cx="0" cy="${hy}" r="15" fill="${ink}"/>`;
    const ear = 35 * p;
    s += `<path d="M-14 ${hy - 5} L-12 ${hy - 26} L-3 ${hy - 13} Z" fill="${ink}" transform="rotate(${-ear} -9 ${hy - 9})"/>`;
    s += `<path d="M14 ${hy - 5} L12 ${hy - 26} L3 ${hy - 13} Z" fill="${ink}" transform="rotate(${ear} 9 ${hy - 9})"/>`;
    const er = 4.5 + 2.2 * p, pr = Math.max(.8, 2 - 1.2 * p);
    s += `<circle cx="-6" cy="${hy - 1}" r="${er}" fill="#f2f2f2"/><circle cx="6" cy="${hy - 1}" r="${er}" fill="#f2f2f2"/>`;
    s += `<circle cx="-6" cy="${hy - 1}" r="${pr}" fill="${ink}"/><circle cx="6" cy="${hy - 1}" r="${pr}" fill="${ink}"/>`;
    if (hiss) s += `<path d="M-7 ${hy + 6} Q0 ${hy + 16} 7 ${hy + 6} Z" fill="#f2f2f2" stroke="#f2f2f2" stroke-width="1"/><path d="M-4 ${hy + 7} l1 3 M4 ${hy + 7} l-1 3" stroke="${ink}" stroke-width="1.5"/>`;
    // whiskers fan out when spooked
    const wy = hy + 3;
    s += `<path d="M-9 ${wy} l-14 ${-3 - 5 * p} M-9 ${wy + 2} l-14 ${2 - 2 * p} M9 ${wy} l14 ${-3 - 5 * p} M9 ${wy + 2} l14 ${2 - 2 * p}" stroke="#bdbdbd" stroke-width="1.2" stroke-linecap="round"/>`;
    el.cat.innerHTML = s;
  }
  function drawCast() {
    const { rooster: r, neighbor: n, cat } = W.cast, cfg = App.cfg;
    // figures can be switched off or resized from the Window panel
    el.rooster.style.display = cfg.winRooster ? '' : 'none';
    el.neighbor.style.display = cfg.winNeighbor ? '' : 'none';
    const rk = cfg.winRoosterSize, nk = cfg.winNeighborSize, ck = cfg.winCatSize;
    el.rooster.setAttribute('transform', `translate(${(77 + r.x).toFixed(1)} ${(269 + r.y).toFixed(1)}) rotate(${r.rot.toFixed(2)}) scale(${rk})`);
    el.neighbor.setAttribute('transform', `translate(${(214 + n.x).toFixed(1)} ${(272 + n.y).toFixed(1)}) rotate(${n.rot.toFixed(2)}) scale(${(n.sx * nk).toFixed(3)} ${(n.sy * nk).toFixed(3)})`);
    el.cat.style.display = cat.on && cfg.winCat ? '' : 'none';
    if (cat.on) {
      el.cat.setAttribute('transform', `translate(${(244 + cat.x).toFixed(1)} ${(262 + cat.y).toFixed(1)}) scale(${(1.25 * ck).toFixed(3)})`);
      catSVG(Math.round(clamp(cat.puff, 0, 1) * 20) / 20, cat.hiss);
    }
    // sky: the story's crossfade, unless the Window panel locks or previews one time of day
    const pin = (App.winPreview && App.winPreview()) || (cfg.winShow !== 'story' ? cfg.winShow : null);
    const op = pin ? { dawn: 1, midday: +(pin === 'day'), sunset: +(pin === 'sunset'), night: +(pin === 'night') } : W.sky;
    el.skyDawn.setAttribute('opacity', op.dawn.toFixed(3));
    el.skyMidday.setAttribute('opacity', op.midday.toFixed(3));
    el.skySunset.setAttribute('opacity', op.sunset.toFixed(3));
    el.skyNight.setAttribute('opacity', op.night.toFixed(3));
    drawLight(op);
  }

  /* ---------- soft 3D look: room tint and window light by time of day ---------- */
  // see-through tint for the room and the color of the light through the window, per time of day
  const LIGHT = {
    dawn:   { tint: [255, 170, 120], tintOp: .1, beam: [255, 214, 170], beamOp: .45 },
    midday: { tint: [255, 250, 235], tintOp: 0, beam: [255, 250, 225], beamOp: .5 },
    sunset: { tint: [255, 120, 60], tintOp: .14, beam: [255, 170, 110], beamOp: .5 },
    night:  { tint: [30, 36, 100], tintOp: .36, beam: [190, 205, 255], beamOp: .35 },
  };
  let lastLook = null;
  const beamStops = document.querySelectorAll('#beamGrad stop');
  function drawLight(op) {
    const cfg = App.cfg;
    const look = cfg.look3d ? 'soft' : 'flat';
    if (look !== lastLook) { el.stage.classList.remove('soft', 'flat'); el.stage.classList.add(look); document.body.classList.toggle('flat', look === 'flat'); lastLook = look; }
    // the sky layers stack (dawn underneath), so each later layer covers the ones below it
    const w = { night: op.night }; w.sunset = op.sunset * (1 - w.night); w.midday = op.midday * (1 - op.sunset) * (1 - op.night);
    w.dawn = Math.max(0, 1 - w.night - w.sunset - w.midday);
    const mix = key => [0, 1, 2].map(i => Object.keys(LIGHT).reduce((a, k) => a + LIGHT[k][key][i] * w[k], 0));
    const rgb = c => `rgb(${c.map(v => Math.round(v)).join(',')})`;
    const tintOp = Object.keys(LIGHT).reduce((a, k) => a + LIGHT[k].tintOp * w[k], 0);
    el.roomLight.setAttribute('fill', rgb(mix('tint')));
    el.roomLight.setAttribute('opacity', cfg.roomLight ? tintOp.toFixed(3) : 0);
    const beam = rgb(mix('beam'));
    beamStops.forEach(st => st.setAttribute('stop-color', beam));
    el.beam.setAttribute('opacity', Object.keys(LIGHT).reduce((a, k) => a + LIGHT[k].beamOp * w[k], 0).toFixed(3));
  }

  /* ---------- camera ---------- */
  const SHOTS = {
    sleep:  { x: 705, y: 455, s: 1.36 },
    snooze: { x: 715, y: 450, s: 1.4 },
    slap:   { x: 740, y: 450, s: 1.3 },
    fist:   { x: 745, y: 450, s: 1.17 },
    throw:  { x: 830, y: 450, s: 1 },
    end:    { x: 820, y: 470, s: 1.12 },
  };
  let camMove = null;
  function moveCam(name, dur = App.cfg.camMs) {
    const to = SHOTS[name];
    if (!dur) { Object.assign(W.cam, to); camMove = null; return; }
    camMove = { from: { ...W.cam }, to, t0: performance.now(), dur };
  }
  function fitViewBox() {
    const a = innerWidth / Math.max(1, innerHeight);
    // tall screens crop the far edges a little instead of shrinking the whole room
    const w = a < 1.2 ? 1400 : Math.max(1600, 900 * a), h = Math.max(900, w / a);
    el.stage.setAttribute('viewBox', `${(800 - w / 2).toFixed(1)} ${(450 - h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`);
  }
  addEventListener('resize', fitViewBox); fitViewBox();
  function drawCam(now) {
    if (camMove) {
      const k = clamp((now - camMove.t0) / camMove.dur, 0, 1), e = App.config.ease('camEase')(k);
      W.cam.x = lerp(camMove.from.x, camMove.to.x, e);
      W.cam.y = lerp(camMove.from.y, camMove.to.y, e);
      W.cam.s = lerp(camMove.from.s, camMove.to.s, e);
      if (k >= 1) camMove = null;
    }
    el.cam.setAttribute('transform', `translate(800 450) scale(${W.cam.s.toFixed(4)}) translate(${(-W.cam.x).toFixed(1)} ${(-W.cam.y).toFixed(1)})`);
    if (W.shake > 0) {
      const m = W.shake * 14 * M;
      el.shake.setAttribute('transform', `translate(${rnd(-m, m).toFixed(1)} ${rnd(-m, m).toFixed(1)})`);
    } else el.shake.removeAttribute('transform');
  }
  function toWorld(e) {
    const p = el.stage.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    return p.matrixTransform(el.cam.getScreenCTM().inverse());
  }
  // how many world units one CSS pixel covers right now (for speed thresholds)
  function worldPerPx() { const m = el.cam.getScreenCTM(); return m ? 1 / Math.hypot(m.a, m.b) : 1; }

  /* ---------- floating words, Zzz, cracks ---------- */
  function spawnText(str, x, y, o = {}) {
    const t = document.createElementNS(NS, 'text');
    t.textContent = str;
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-size', o.size || 24);
    t.setAttribute('fill', o.fill || '#222');
    if (o.italic) t.setAttribute('font-style', 'italic');
    (o.layer === 'window' ? el.windowFx : el.fx).appendChild(t);
    W.texts.push({ el: t, x, y, t0: performance.now(), dur: o.dur || 900, rise: o.rise ?? 30, drift: o.drift || 0, rot: o.rot || 0, pop: o.pop ?? .35, wave: o.wave || 0 });
  }
  function spawnZ(big) {
    const zp = bedPt(436, 508);
    spawnText(big ? 'Z' : 'z', zp.x + rnd(-6, 6), zp.y, { size: big ? 34 : rnd(20, 28), fill: '#555', dur: 2600, rise: 120, drift: 70, rot: rnd(-12, 8), pop: .15, wave: 8, italic: true });
  }
  function drawTexts(now) {
    W.texts = W.texts.filter(o => {
      const k = (now - o.t0) / o.dur;
      if (k >= 1) { o.el.remove(); return false; }
      const pop = 1 + o.pop * (1 - Math.min(1, k * 5));
      const x = o.x + o.drift * k + Math.sin(k * 9) * o.wave;
      o.el.setAttribute('transform', `translate(${x.toFixed(1)} ${(o.y - o.rise * k).toFixed(1)}) rotate(${o.rot.toFixed(1)}) scale(${pop.toFixed(2)})`);
      o.el.setAttribute('opacity', (1 - k * k).toFixed(2));
      return true;
    });
  }
  const CRACK = 'M78,72 l-18,-14 l-6,-18 M78,72 l-24,6 l-14,-6 l-10,8 M78,72 l-14,22 l4,18 M60,58 l-12,2 M54,78 l2,14 M78,72 l-30,-30';
  function addCrack(parent, x, y, sx, sy, rot, color, width) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', CRACK);
    p.setAttribute('transform', `translate(${x} ${y}) rotate(${rot}) scale(${sx} ${sy}) translate(-78 -72)`);
    p.setAttribute('fill', 'none'); p.setAttribute('stroke', color); p.setAttribute('stroke-width', width);
    p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
    p.setAttribute('vector-effect', 'non-scaling-stroke');
    (parent === 'wall' ? el.wallCracks : el.clockCracks).appendChild(p);
    return p;
  }

  function drawLooseBell() {
    const b = W.looseBell;
    if (!b) { el.looseBell.setAttribute('opacity', 0); return; }
    el.looseBell.setAttribute('opacity', 1);
    el.looseBell.setAttribute('transform', `translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) rotate(${(b.r * 180 / Math.PI).toFixed(1)}) scale(${CS})`);
  }

  function draw(now) {
    drawCam(now); drawClock(); drawHand(); drawBlanket(); drawCast(); drawLooseBell(); drawTexts(now);
  }

  resetState();
  return { el, W, CS, HOME, U, SHOULDER, bedPt, WALL_EDGE, FLOOR, M, reduce,
    clamp, lerp, ease, easeOut, easeOutBack, approach, rnd, wob,
    resetState, ringLook, setAnchor, handMatrix, barTop, pivotToCenter, moveCam, toWorld, worldPerPx,
    spawnText, spawnZ, addCrack, draw };
})();
