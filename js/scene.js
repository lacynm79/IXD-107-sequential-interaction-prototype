/* Scene: shared state and drawing for the one bedroom all four rounds play out in.
   World units: a 1600x900 room. The clock's local origin is its bottom centre and its parts
   keep the Slap the Alarm Quiet layout (a 320x300 box), drawn at CS scale. */
window.App = window.App || {};
App.scene = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const $ = id => document.getElementById(id);
  const el = {};
  ['stage', 'shake', 'cam', 'clock', 'bellL', 'bellR', 'bar', 'lines', 'display', 'clockCracks', 'looseBell',
   'arm', 'armRect', 'armCrease', 'hand', 'fingers', 'fist', 'blanket', 'blanketFold', 'hair', 'sleepFace', 'backHair', 'prickles', 'fx',
   'skyDawn', 'skyMidday', 'skySunset', 'skyNight', 'rooster', 'neighbor', 'cat', 'windowFx', 'wallCracks']
    .forEach(k => { el[k] = $(k); });

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const M = reduce ? 0.35 : 1;                      // motion scale for shakes and jitters
  const CS = 0.8;                                   // clock scale in the room
  const HOME = { x: 720, y: 600 };                  // clock pivot on the nightstand
  const F = 1.3;                                    // hand/fist drawing scale
  const SHOULDER = { x: 470, y: 640 };              // under the blanket
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
    W.hand = { mode: 'open', x: 470, y: 680, rot: 0, ax: 70, ay: 63, alpha: 1, fingers: 1 };
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
    return (u, v) => { const dx = (u - h.ax) * F, dy = (v - h.ay) * F; return { x: h.x + dx * ca - dy * sa, y: h.y + dx * sa + dy * ca }; };
  }
  function drawHand() {
    const h = W.hand, open = h.mode === 'open', show = h.mode !== 'hidden';
    const tf = `translate(${h.x.toFixed(1)} ${h.y.toFixed(1)}) rotate(${h.rot.toFixed(2)}) scale(${F}) translate(${-h.ax} ${-h.ay})`;
    el.hand.setAttribute('transform', tf);
    el.fist.setAttribute('transform', tf);
    el.hand.setAttribute('opacity', show && open ? h.alpha.toFixed(2) : 0);
    el.fist.setAttribute('opacity', show && !open ? h.alpha.toFixed(2) : 0);
    el.fingers.setAttribute('transform', `translate(40 0) scale(${h.fingers.toFixed(3)} 1) translate(-40 0)`);
    // arm: a capsule from the cuff back under the covers to the shoulder
    const cuff = handMatrix(h)(16, open ? 40 : 32);
    const dx = SHOULDER.x - cuff.x, dy = SHOULDER.y - cuff.y, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
    el.arm.setAttribute('transform', `translate(${cuff.x.toFixed(1)} ${cuff.y.toFixed(1)}) rotate(${ang.toFixed(2)})`);
    el.armRect.setAttribute('x', -12); el.armRect.setAttribute('width', (len + 40).toFixed(1));
    const c1 = (len * .32).toFixed(1), c2 = (len * .52).toFixed(1);
    el.armCrease.setAttribute('d', `M${c1} -17 q8 17 0 34 M${c2} -17 q8 17 0 34`);
    el.arm.setAttribute('opacity', show ? h.alpha.toFixed(2) : 0);
  }
  // anchor presets in the drawings' own units
  const ANCHOR = { palm: [70, 63], fistGrip: [60, 56], fistCenter: [48, 32] };
  function setAnchor(name) { const a = ANCHOR[name]; W.hand.ax = a[0]; W.hand.ay = a[1]; }

  /* ---------- blanket and sleeper ---------- */
  function drawBlanket() {
    const b = W.blanket;
    const lx = lerp(b.lumpX, 392, b.roll), h = lerp(b.h, 70, b.roll) * (1 + b.breath * .05) + b.jerk * 22;
    const pk = 562 - h;
    const d = `M336 572 C348 ${552 - b.jerk * 6} ${(lx - 96).toFixed(1)} ${pk.toFixed(1)} ${lx.toFixed(1)} ${pk.toFixed(1)} ` +
      `C${(lx + 96).toFixed(1)} ${pk.toFixed(1)} ${(560 - b.roll * 30).toFixed(1)} ${568 - b.roll * 12} 606 582 L616 712 Q470 730 330 712 Z`;
    el.blanket.setAttribute('d', d);
    el.blanketFold.setAttribute('d', `M344 ${578 - b.jerk * 4} q${40 + b.roll * 10} -${12 + b.roll * 6} ${84 + b.roll * 20} -6`);
    // rolling over: the head turns on the pillow
    const k = ease(clamp(b.roll, 0, 1));
    el.hair.setAttribute('transform', `translate(${(-30 * k).toFixed(1)} ${(-b.jerk * 8 + 4 * k).toFixed(1)}) translate(300 540) scale(${(1 - 2 * k).toFixed(3)} 1) translate(-300 -540)`);
    // after rolling over they face away: only the back of the head shows
    el.sleepFace.setAttribute('opacity', (1 - k).toFixed(3));
    el.backHair.setAttribute('opacity', k.toFixed(3));
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
    spawnText(big ? 'Z' : 'z', 318 + rnd(-6, 6), 520, { size: big ? 34 : rnd(20, 28), fill: '#555', dur: 2600, rise: 120, drift: 70, rot: rnd(-12, 8), pop: .15, wave: 8, italic: true });
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
  return { el, W, CS, HOME, F, U, SHOULDER, WALL_EDGE, FLOOR, M, reduce,
    clamp, lerp, ease, easeOut, easeOutBack, approach, rnd, wob,
    resetState, ringLook, setAnchor, handMatrix, barTop, pivotToCenter, moveCam, toWorld, worldPerPx,
    spawnText, spawnZ, addCrack, draw };
})();
