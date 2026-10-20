/* The four rounds, each adapted from its study. A round owns the clock and the hand while it
   is active and calls App.seq.done(i) once its action succeeds; nothing else is accepted
   until then. Distances from the studies are scaled into room units. */
window.App = window.App || {};
App.rounds = (() => {
  const S = App.scene, W = S.W, A = App.audio;
  const { clamp, approach, ease, easeOut, easeOutBack, rnd, wob, M } = S;
  const seq = () => App.seq;
  const CLOCK_C = { x: S.HOME.x, y: S.HOME.y - 80 };          // body centre when standing on the nightstand
  const overClock = (p, pad = 0) => p.x > 590 - pad && p.x < 850 + pad && p.y > 330 - pad && p.y < 612 + pad;

  /* =====================================================================
     1. Snooze: press and hold the snooze bar (Sticky Snooze Bar)
     ===================================================================== */
  const snooze = (() => {
    const CONTACT_MS = 90, CONTACT_DEPTH = .14;
    let s;
    const easeInOut = x => -(Math.cos(Math.PI * x) - 1) / 2;
    function start(now) {
      s = { phase: 'ringing', depth: 0, contact: 0, ring: 1, t0: 0, from: 0, idleSince: now, doneAt: 0 };
    }
    function press() {
      if (s.phase === 'done' || s.phase === 'pressing') return;
      s.phase = 'pressing'; s.t0 = performance.now(); s.from = s.depth; s.idleSince = s.t0;
    }
    function release() {
      if (s.phase !== 'pressing') return;
      s.phase = 'releasing'; s.t0 = performance.now(); s.from = s.depth; s.idleSince = s.t0;
    }
    function complete(t) {
      s.phase = 'done'; s.depth = 1; s.doneAt = t;
      A.click();
      seq().done(0);
    }
    // idle hint: the hand presses partway, trembles, lifts
    function hint(t) {
      const idle = t - s.idleSince - 2600;
      if (idle < 0) return { d: 0, c: 0, shake: 0 };
      const c = idle % 2600;
      if (c < 500) { const p = easeInOut(c / 500); return { d: .2 * p, c: p, shake: 0 }; }
      if (c < 1150) return { d: .2, c: 1, shake: 1 };
      if (c < 1750) { const p = 1 - easeInOut((c - 1150) / 600); return { d: .2 * p, c: p, shake: 0 }; }
      return { d: 0, c: 0, shake: 0 };
    }
    function update(t, dt) {
      let tremble = 0, contactPulse = 0, clickDip = 0;
      if (s.phase === 'ringing') {
        const h = hint(t);
        s.depth = h.d; s.contact = h.c;
        tremble = h.shake * 1.6 * Math.sin(t * .09);
        s.ring = approach(s.ring, 1, 160, dt);
      } else if (s.phase === 'pressing') {
        const e = t - s.t0;
        let d;
        if (s.from < CONTACT_DEPTH && e < CONTACT_MS) {
          d = s.from + (CONTACT_DEPTH - s.from) * easeOut(e / CONTACT_MS);
          contactPulse = Math.sin(Math.PI * clamp(e / 220, 0, 1));
        } else {
          // slower the deeper it goes
          const base = Math.max(s.from, CONTACT_DEPTH);
          const span = App.cfg.snoozeHoldMs * (1 - (base - CONTACT_DEPTH) / (1 - CONTACT_DEPTH));
          const eStart = s.from < CONTACT_DEPTH ? CONTACT_MS : 0;
          const x = clamp((e - eStart) / Math.max(span, 1), 0, 1);
          d = base + (1 - base) * easeOut(x);
          if (e < 220) contactPulse = Math.sin(Math.PI * e / 220);
          tremble = (1 - x * .5) * 1.1 * Math.sin(t * .11) + .5 * Math.sin(t * .37);
          if (x >= 1) { complete(t); d = 1; }
        }
        s.depth = d;
        s.contact = approach(s.contact, 1, 25, dt);
        s.ring = approach(s.ring, 0, 45, dt);
      } else if (s.phase === 'releasing') {
        const dur = 700 + 1100 * s.from;
        const p = clamp((t - s.t0) / dur, 0, 1);
        const back = App.config.ease('snoozeReleaseEase')(p);
        s.depth = s.from * (1 - back);
        s.contact = approach(s.contact, 0, 80, dt);
        s.ring = Math.max(s.ring, clamp(back, 0, 1));
        if (p >= 1) { s.phase = 'ringing'; s.idleSince = t; }
      } else if (s.phase === 'done') {
        const e = t - s.doneAt;
        clickDip = .05 * Math.exp(-e / 70) * Math.cos(e / 30);
        s.depth = 1;
        s.contact = approach(s.contact, 0, 260, dt);
        s.ring = approach(s.ring, 0, 60, dt);
      }
      // clock squash: brief on contact, slight compression with depth, damped settle on completion
      let squash = .035 * contactPulse + .008 * (s.phase === 'pressing' ? s.depth : 0);
      if (s.phase === 'done') { const e = t - s.doneAt; squash = .03 * Math.exp(-e / 160) * Math.cos(e / 55); }
      const c = W.clock;
      c.sy = 1 - squash; c.sx = 1 + squash * .6; c.rot = 0;
      S.ringLook(t, s.ring, 1);
      c.hop = 0;
      c.jx = s.ring * 1.6 * M * Math.sin(t * .13) * 1.3;
      c.bar = (s.depth + clickDip) * App.cfg.snoozeTravel + tremble * .6;   // bar travel in clock units
      A.ring(s.ring, 1);
      // the rooster crows along with the ring and goes quiet as it fades
      W.cast.rooster.rot = s.ring * 3 * M * Math.sin(t * .02);
      // hand rides the bar top through the squash
      const h = W.hand;
      h.mode = 'open'; S.setAnchor('palm'); h.fingers = 1; h.alpha = 1;
      const hover = (1 - s.contact) * (20 + (s.phase === 'ringing' ? 3 * Math.sin(t * .004) : 0));
      h.x = 728 + c.jx * .3 + tremble * .4;
      h.y = S.barTop() + 6 - hover + tremble * .5;
      h.rot = 16;
    }
    function down(p, e) { if (overClock(p)) { e.preventDefault(); press(); } }
    function up() { release(); }
    function key(e, isDown) {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      if (isDown && !e.repeat) press(); else if (!isDown) release();
    }
    const pose = () => ({ mode: 'open', anchor: 'palm', x: 728, y: CLOCK_C.y - 78 - 20, rot: 16, fingers: 1 });
    return { start, update, down, up, key, pose, hint: 'Press and hold the snooze bar.' };
  })();

  /* =====================================================================
     2. Slap: slap the clock quiet, four times (Slap the Alarm Quiet)
     ===================================================================== */
  const slap = (() => {
    // the study's four-slap curves; other slap counts sample them by fraction done
    const REST = [1, .84, .71, .6, .42];
    const RING = [1, .62, .4, .22, 0];
    const at = (arr, f) => { const x = clamp(f, 0, 1) * 4, i = Math.min(3, Math.floor(x)); return arr[i] + (arr[i + 1] - arr[i]) * (x - i); };
    // resting hand hovers this far above the snooze bar between slaps (Triggers panel: slapLift)
    const REST_PALM = { x: 720, get y() { return S.HOME.y - 198 * S.CS - App.cfg.slapLift; } };
    let s, timers = [], missT = null;
    function start(now) {
      s = { hits: 0, done: false, busy: false, bounce: null, lastSlap: -1e9,
        sy: { v: 1, t: 1, r: .1 }, sx: { v: 1, t: 1, r: .1 }, droop: { v: 0, t: 0, r: .1 }, tilt: { v: 0, t: 0, r: .03 },
        hy: { v: 0, t: 0, r: .1 }, hx: { v: 0, t: 0, r: .1 }, rot: { v: 0, t: 0, r: .2 }, ring: { v: 1, t: 1, r: .05 }, bar: { v: 0, t: 0, r: .1 },
        lastInput: now, contact: false };
      clear();
    }
    const set = (k, t, r) => { s[k].t = t; if (r != null) s[k].r = r; };
    const later = (ms, fn) => timers.push(setTimeout(fn, ms));
    function clear() { timers.forEach(clearTimeout); timers = []; clearTimeout(missT); }
    const barTopAt = sc => S.HOME.y + (-198) * S.CS * sc;
    function slapIt() {
      if (s.done || s.busy) return;                     // wait until the clock is back to full size
      const N = App.cfg.slapsNeeded, now = performance.now();
      if (now - s.lastSlap < App.cfg.slapGapMs) return;   // too soon after the last one
      s.lastSlap = now; s.busy = true;
      s.lastInput = now; clear();
      s.hits++; const h = s.hits, last = h >= N, rest = at(REST, h / N);
      // wind-up: a quick lift with the fingers cocked back, then the drop
      set('hx', -6, .5); set('hy', -20, .55); set('rot', -7, .45);
      if (last) s.done = true;
      const k = App.cfg.slapSquash;
      const sc = 1 - (1 - (last ? REST[4] * .82 : rest * .55)) * k;
      later(60, () => {
        // contact: squish it down, droop the bells, cut the ring (deeper each slap); the palm lands flat-to-forward
        s.contact = true; s.bounce = null;
        ['sy', 'sx', 'droop', 'bar', 'tilt'].forEach(n => { s[n].t = s[n].v; });
        set('sy', sc, .35); set('sx', 1 + (last ? .32 : .22) * k, .35); set('droop', 58, .35); set('bar', 10, .35); set('ring', 0, .6);
        set('hx', 4, .3); set('hy', barTopAt(sc) + 10 - REST_PALM.y, .42); set('rot', 8, .35);
      });
      setTimeout(A.thud, 100);
      // the neighbor flinches every time
      seq().react('slap', h);
      // the hand peels off and floats back up, and the clock springs back to full height, a little quieter each time
      later(320, () => { s.contact = false; set('hy', 0, last ? .03 : .06); set('hx', 0, .08); set('rot', 0, .08); });
      later(360, () => {
        s.bounce = { t0: performance.now(), from: { sy: s.sy.v, sx: s.sx.v, droop: s.droop.v, bar: s.bar.v, tilt: s.tilt.v } };
        A.pop();
      });
      if (!last) later(710, () => set('ring', at(RING, h / N), .012));
      else later(510, () => seq().done(1));
    }
    function miss(p) {
      if (s.contact || s.done) return;
      s.lastInput = performance.now();
      clearTimeout(missT);
      let x = clamp(p.x, 470, 1250), y = clamp(p.y, 200, 720);
      if (x < 640) y = Math.min(y, 520);              // don't dive under the covers
      set('hx', x - REST_PALM.x, .45); set('hy', y - REST_PALM.y, .5);
      setTimeout(A.smack, 70);
      missT = setTimeout(() => { set('hx', 0, .18); set('hy', 0, .18); }, 150);
    }
    function update(t, dt) {
      const f = Math.min(3, dt / 16.7);
      ['sy', 'sx', 'droop', 'tilt', 'hy', 'hx', 'rot', 'ring', 'bar'].forEach(k => { const o = s[k]; o.v += (o.t - o.v) * (1 - Math.pow(1 - o.r, f)); });
      if (s.bounce) {
        // bounce-back: from the squished shape to full height with the chosen curve
        const k = clamp((t - s.bounce.t0) / App.cfg.slapBounceMs, 0, 1), e = App.config.ease('slapBounceEase')(k), b = s.bounce.from;
        const go = (n, to) => { s[n].v = s[n].t = b[n] + (to - b[n]) * e; };
        go('sy', 1); go('sx', 1); go('droop', 0); go('bar', 0); go('tilt', 0);
        if (k >= 1) { s.bounce = null; s.busy = false; }
      }
      const c = W.clock, ring = s.ring.v;
      const jr = S.ringLook(t, ring, 2);
      c.sx = s.sx.v; c.sy = s.sy.v; c.droop = s.droop.v; c.bar = s.bar.v; c.rot = s.tilt.v + jr;
      A.ring(ring, 2);
      // idle pats: quick light taps that stop short of the clock
      let pat = 0;
      if (!s.done && !s.contact && t - s.lastInput > 1800 && Math.abs(s.hy.v) < 4 && Math.abs(s.hx.v) < 4) {
        const ph = (t / 1000) % 1.5; if (ph < .6) pat = Math.abs(Math.sin(ph * Math.PI / .15)) * 13 * M;
      }
      const h = W.hand;
      h.mode = 'open'; S.setAnchor('palm'); h.fingers = 1; h.alpha = 1; h.rot = s.rot.v;
      h.x = REST_PALM.x + s.hx.v; h.y = REST_PALM.y + s.hy.v + pat;
      seq().react('slapRing', ring);
    }
    function down(p, e) { e.preventDefault(); if (s.busy) return; if (overClock(p, App.cfg.slapPad)) slapIt(); else miss(p); }
    function key(e, isDown) { if (isDown && (e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); slapIt(); } }
    function stop() { clear(); }
    const pose = () => ({ mode: 'open', anchor: 'palm', x: REST_PALM.x, y: REST_PALM.y, rot: 0, fingers: 1 });
    return { start, update, down, key, stop, pose, hint: 'Slap the clock down. It takes a few.' };
  })();

  /* =====================================================================
     3. Fist: shake your fist at it until the rage fills, then THWACK (Shake Your Fist)
     ===================================================================== */
  const fist = (() => {
    const K = 1.3;                                     // study units to room units
    const HOMEF = { x: 515, y: 440 };
    const MAXX = 548;                                  // the fist can't reach the clock without the punch
    let s;
    function start(now) {
      s = { phase: 'clench', t0: now, rage: 0, lastGain: 0, fist: { ...HOMEF }, target: null,
        contact: false, lastMove: 0, prevX: null, lastDir: 0, turnX: 0, turnTime: 0,
        missT0: 0, punchT0: 0, from: null, hit: false, hitT: 0, down: null, keyDir: 0, keyT: 0 };
      S.el.prickles.setAttribute('d', '');
    }
    function gain(now) {
      s.rage = Math.floor(s.rage) + 1;
      s.lastGain = now;
      const fill = s.rage / App.cfg.fistShakes;          // how full the rage is, 0..1
      const word = fill < .4 ? 'grr' : fill < .8 ? 'grrr' : 'GRRR';
      S.spawnText(word, s.fist.x + rnd(-40, 40), s.fist.y - 80, { size: 22 + fill * 36, dur: 700, rise: 44, rot: rnd(-14, 14) });
      A.growl(s.rage);
      if (s.rage >= App.cfg.fistShakes) { s.phase = 'punch'; s.punchT0 = now; s.from = { ...s.fist }; s.missT0 = 0; }
    }
    function doHit(now) {
      s.hit = true; s.hitT = now;
      S.spawnText('THWACK', 640, CLOCK_C.y - 110, { size: 70, fill: '#1c1c1c', dur: 1200, rise: 30, rot: -6 });
      A.thwack();
      W.shake = 1;
      seq().done(2);
    }
    function makeContact(p, now) {
      s.contact = true;
      s.fist.x = Math.min(MAXX, p.x); s.fist.y = clamp(p.y, 270, 480);
      s.turnX = p.x; s.turnTime = now; s.prevX = p.x; s.lastDir = 0;
    }
    function move(p) {
      const now = performance.now();
      if (s.phase !== 'ready') { s.prevX = p.x; return; }
      // shaking counts once the fist has been brought up at the clock
      if (!s.contact) { if (Math.hypot(p.x - CLOCK_C.x, p.y - CLOCK_C.y) < App.cfg.fistReachPx) makeContact(p, now); return; }
      s.target = p; s.lastMove = now;
      if (s.missT0) { s.prevX = p.x; return; }        // mid-swing: no progress
      const dx = p.x - s.prevX;
      if (Math.abs(dx) < 2) return;
      const dir = Math.sign(dx);
      if (s.lastDir && dir !== s.lastDir) {
        const amp = Math.abs(s.prevX - s.turnX);
        // forgiving: a modest swing within about a second counts
        if (amp > App.cfg.fistSwingPx && now - s.turnTime < App.cfg.fistSwingMs) gain(now);
        s.turnX = s.prevX; s.turnTime = now;
      }
      s.lastDir = dir; s.prevX = p.x;
    }
    function down(p, e) {
      e.preventDefault();
      s.down = { t: performance.now(), x: e.clientX, y: e.clientY };
      move(p);
    }
    function up(p, e) {
      const now = performance.now(), d = s.down; s.down = null;
      if (!d || s.phase !== 'ready' || s.missT0) return;
      if (now - d.t < 240 && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 10) {
        if (!s.contact) makeContact(p, now);
        s.target = p; s.lastMove = now; s.missT0 = now;
        S.spawnText('thud', s.fist.x + 110, s.fist.y + 50, { size: 22, fill: '#8f8f8d', dur: 650, rise: 12 });
        A.fistThud();
      }
    }
    // keyboard: alternate left/right arrows to shake, Space for a weak jab
    function key(e, isDown) {
      if (!isDown || s.phase !== 'ready') return;
      const now = performance.now();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const dir = e.key === 'ArrowLeft' ? -1 : 1;
        s.contact = true; s.lastMove = now;
        s.target = { x: clamp(s.fist.x + dir * 60, 380, MAXX), y: s.fist.y };
        if (s.keyDir && dir !== s.keyDir && now - s.keyT < App.cfg.fistSwingMs) gain(now);
        s.keyDir = dir; s.keyT = now;
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!s.missT0) { s.missT0 = now; s.lastMove = now; A.fistThud(); }
      }
    }
    function drawPrickles(cx, cy, n, len) {
      let d = '';
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd(-.25, .25);
        const r0 = 78 + rnd(0, 8), r1 = r0 + len * rnd(.6, 1.1);
        d += `M${(cx + Math.cos(a) * r0).toFixed(1)} ${(cy + Math.sin(a) * r0).toFixed(1)}L${(cx + Math.cos(a) * r1).toFixed(1)} ${(cy + Math.sin(a) * r1).toFixed(1)}`;
      }
      S.el.prickles.setAttribute('d', d);
    }
    function placeFist(x, y, rot) {
      const h = W.hand; h.mode = 'fist'; S.setAnchor('fistCenter'); h.x = x; h.y = y; h.rot = rot; h.alpha = 1;
    }
    function update(now, dt) {
      const c = W.clock, J = M;
      if (!s.hit) {
        const jr = S.ringLook(now, 1, 3);
        c.rot = jr; c.sx = 1; c.sy = 1; c.droop = 0; c.bar = 0;
        A.ring(1, 3);
      } else {
        // knocked aside, left teetering on the edge of the nightstand
        const k = Math.min(1, (now - s.hitT) / 650), e = easeOutBack(k);
        c.jx = 0; c.hop = 0; c.swing = 0; c.linesOp = 0;
        // knocked clean off the nightstand: tips onto its side and drops to the floor
        const fall = Math.pow(clamp((now - s.hitT - 260) / 340, 0, 1), 2);
        c.rot = 90 * Math.min(1, e); c.px = S.HOME.x + 160 * e;
        c.py = S.HOME.y + (S.FLOOR - S.HOME.y) * fall - 112 * Math.sin(c.rot * Math.PI / 180);
        if (fall >= 1 && !s.landed) { s.landed = true; A.clank(.7); }
        A.ring(0, 3);
        W.shake = Math.max(0, 1 - (now - s.hitT) / 320);
      }

      if (s.phase === 'clench') {
        const t = now - s.t0;
        const k = clamp((t - 600) / 1100, 0, 1);
        const amp = (.3 + k * 2.2) * J * K;
        const h = W.hand;
        h.mode = 'open'; h.ax = 60; h.ay = 40; h.alpha = 1; h.rot = 0;
        h.fingers = 1 - .72 * ease(k);
        h.x = HOMEF.x + amp * wob(now, .04, 0); h.y = HOMEF.y + amp * wob(now, .045, 3);
        if (t > 1700) { s.phase = 'ready'; placeFist(h.x, h.y, 0); h.fingers = 1; }
      } else if (s.phase === 'ready') {
        if (now - s.lastGain > App.cfg.fistFadeMs && s.rage > 0) s.rage = Math.max(0, s.rage - dt * .0004);
        const active = s.contact && s.target && now - s.lastMove < 1400;
        let bx, by, rot = 0;
        if (active) {
          const tx = Math.min(MAXX, s.target.x), ty = clamp(s.target.y, 270, 480);
          const fk = 1 - Math.pow(1 - .22, dt / 16.7);
          s.fist.x += (tx - s.fist.x) * fk; s.fist.y += (ty - s.fist.y) * fk;
          bx = s.fist.x; by = s.fist.y;
        } else {
          const ix = CLOCK_C.x - 210 * K, iy = CLOCK_C.y - 30;
          const ik = 1 - Math.pow(1 - .05, dt / 16.7);
          s.fist.x += (ix - s.fist.x) * ik; s.fist.y += (iy - s.fist.y) * ik;
          const ph = (now % 1100) / 1100;
          const jab = ph < .14 ? Math.sin(ph / .14 * Math.PI) * 42 * K : 0;   // jabs, stops short
          bx = s.fist.x + jab; by = s.fist.y;
        }
        if (s.missT0) {
          const k = (now - s.missT0) / 460;
          if (k < 1) {
            bx += Math.sin(k * Math.PI) * 74 * K;
            by += Math.sin(k * Math.PI) * 34 * K * Math.min(1, k * 2);
            rot = Math.sin(k * Math.PI) * 22;
          } else s.missT0 = 0;
        }
        const r5 = s.rage / App.cfg.fistShakes * 5;      // rage on the study's 0..5 scale
        const amp = ((active ? 1.6 : 1) + r5 * 2.1) * J * K;
        const f = .035 + r5 * .006;
        placeFist(bx + amp * wob(now, f, 0), by + amp * wob(now, f * 1.17, 3), rot + amp * .6 * wob(now, f * .9, 6));
        if (active) drawPrickles(bx, by, 5 + Math.floor(r5 * 4.5), (5 + r5 * 3.6) * K);
        else drawPrickles(bx, by, 3, 5 * K);
      } else if (s.phase === 'punch') {
        const t = now - s.punchT0;
        const pull = { x: s.from.x - 70 * K, y: s.from.y + 12 * K }, hitPt = { x: 560, y: CLOCK_C.y - 6 };
        const L = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
        let p, rot = 0, amp = 0;
        const WU = App.cfg.punchWindupMs, strike = App.config.ease('punchEase');
        if (t < WU) {
          const k = ease(t / WU); p = L(s.from, pull, k); rot = -12 * k; amp = 9 * J;
          drawPrickles(p.x, p.y, 28, 24 * K);
        } else if (t < WU + 120) {
          const k = strike((t - WU) / 120); p = L(pull, hitPt, k); rot = -12 + 12 * k;
          S.el.prickles.setAttribute('d', '');
        } else {
          if (!s.hit) doHit(now);
          p = { x: hitPt.x - 14 * Math.sin(clamp((t - WU - 120) / 500, 0, 1) * Math.PI), y: hitPt.y };
          if (t > WU + 620) s.phase = 'done';
        }
        placeFist(p.x + amp * wob(now, .09, 0), p.y + amp * wob(now, .1, 3), rot);
      }
    }
    const pose = () => ({ mode: 'open', ax: 60, ay: 40, x: HOMEF.x, y: HOMEF.y, rot: 0, fingers: 1 });
    return { start, update, down, move, up, key, pose, hint: 'Shake your fist at it, side to side.' };
  })();

  /* =====================================================================
     4. Throw: grab it and fling it into the wall (Throw the Clock)
     ===================================================================== */
  const toss = (() => {
    const u = S.U, L = 62 * u;
    const rest = { ...CLOCK_C };
    const floorY = S.FLOOR - 80;
    let s;
    const c = { x: 0, y: 0, rot: 0, sx: 1, sy: 1 };
    const hand = { x: 0, y: 0, vx: 0, vy: 0, mode: 'mime', alpha: .55 };
    const ptr = { x: 0, y: 0 };
    function start(now) {
      s = { state: 'idle', mimeStart: now / 1000 + .5, grabOff: { x: 0, y: 0 }, th: 0, thd: 0, dragDist: 0, lastPtr: null,
        fly: null, drop: null, impact: null, slideV: 0, landed: false, T: now / 1000, burstUntil: 0 };
      c.x = rest.x; c.y = rest.y; c.rot = 0; c.sx = c.sy = 1;
      hand.mode = 'mime'; hand.alpha = .55; hand.vx = hand.vy = 0;
    }
    const ease2 = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    function mimePose(T) {
      const gx = rest.x, gy = rest.y - L;
      const hover = { x: gx, y: gy - 34 * u + Math.sin(T * 2.4) * 3 * u };
      if (T < s.mimeStart) return { ...hover, closed: false };
      const p = ((T - s.mimeStart) % 3.8) / 3.8;
      if (p < .22) return { ...hover, closed: false };
      if (p < .34) { const k = ease2((p - .22) / .12); return { x: hover.x, y: hover.y + (gy - hover.y) * k, closed: false }; }
      if (p < .42) return { x: gx, y: gy, closed: true };
      const sw = k => ({ x: gx - 45 * u * Math.sin(k * Math.PI) * (1 - k) + 95 * u * k * k, y: gy + 18 * u * Math.sin(k * Math.PI) - 34 * u * k * k });
      if (p < .74) return { ...sw(ease2((p - .42) / .32)), closed: true };
      const E = sw(1);
      if (p < .8) { const k = (p - .74) / .06; return { x: E.x + 18 * u * k, y: E.y - 18 * u * k, closed: false }; }
      const k = ease2((p - .8) / .2), sx = E.x + 18 * u, sy = E.y - 18 * u;
      return { x: sx + (hover.x - sx) * k, y: sy + (hover.y - sy) * k, closed: false };
    }
    const overIt = p => Math.hypot(p.x - c.x, p.y - (c.y - 10 * u)) < App.cfg.throwGrabPx;
    function down(p, e) {
      if (s.state !== 'idle' || !overIt(p)) return;
      e.preventDefault();
      ptr.x = p.x; ptr.y = p.y; s.lastPtr = p;
      const px = c.x + Math.sin(c.rot) * L, py = c.y - Math.cos(c.rot) * L;
      hand.x = px; hand.y = py; hand.vx = 0; hand.vy = 0; hand.mode = 'fist'; hand.alpha = 1;
      s.grabOff = { x: px - p.x, y: py - p.y };
      s.th = -c.rot; s.thd = 0; s.dragDist = 0;
      s.state = 'held';
      seq().react('grab');
    }
    function move(p) {
      if (s.state !== 'held') return;
      if (s.lastPtr) s.dragDist += Math.hypot(p.x - s.lastPtr.x, p.y - s.lastPtr.y);
      s.lastPtr = p; ptr.x = p.x; ptr.y = p.y;
    }
    function up() {
      if (s.state !== 'held') return;
      const vx = hand.vx + L * s.thd * Math.cos(s.th), vy = hand.vy - L * s.thd * Math.sin(s.th);
      const speed = Math.hypot(vx, vy);
      hand.mode = 'open';
      if (speed > App.cfg.throwSpeed && s.dragDist > App.cfg.throwDragPx) startFly(vx, vy, speed);
      else startDrop();
    }
    function key(e, isDown) {
      if (!isDown || s.state !== 'idle' || (e.key !== ' ' && e.key !== 'Enter')) return;
      e.preventDefault();
      hand.mode = 'fist'; hand.alpha = 1; seq().react('grab');
      startFly(2600, -500, 2650);
    }
    function startDrop() { s.state = 'drop'; s.drop = { t: 0, x0: c.x, y0: c.y, r0: c.rot }; }
    function bez(a, b, cc, d, t) { const m = 1 - t; return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * cc + t * t * t * d; }
    function startFly(vx, vy, speed) {
      s.state = 'fly';
      A.whoosh();
      const dur = Math.max(.34, Math.min(.56, .62 - speed / 9000));
      const P0 = { x: c.x, y: c.y };
      const P1 = { x: clamp(P0.x + vx * dur * .3, 40, 1560), y: clamp(P0.y + vy * dur * .3, 120, 860) };
      const iy = clamp(c.y + vy * .1, 330, 600);
      const P3 = { x: S.WALL_EDGE - 66 * u, y: iy };
      const P2 = { x: P3.x - 1600 * .16, y: P3.y - 900 * .14 - 20 * u };
      const dir = Math.sign(vx) || 1;
      s.fly = { t: 0, dur, P0, P1, P2, P3, r0: c.rot, r1: .18 + dir * .12 };
      seq().react('fly');
    }
    function hitWall() {
      s.state = 'smash';
      s.impact = { t: s.T };
      W.clock.broken = true;
      W.shake = S.reduce ? .25 : 1;
      c.sx = .78; c.sy = 1.12;
      const r = Math.atan2(Math.sin(c.rot), Math.cos(c.rot));
      c.rot = r; s.slideV = 0; s.landed = false;
      const bx = 44 * u, by = -44 * u;
      W.looseBell = { x: c.x + bx * Math.cos(r) - by * Math.sin(r), y: c.y + bx * Math.sin(r) + by * Math.cos(r), vx: -160, vy: -320, r: r + .4, vr: -9, done: false };
      S.addCrack('wall', S.WALL_EDGE, c.y.toFixed(1), (-1.4 * u).toFixed(2), (3.2 * u).toFixed(2), 0, '#222', 3);
      S.addCrack('wall', S.WALL_EDGE, c.y.toFixed(1), (-1.1 * u).toFixed(2), (-2.4 * u).toFixed(2), 11, '#222', 2.4);
      // shattered display and cracked casing on the wall side (clock units)
      S.addCrack('clock', 52, -150, 1.1, .85, 8, '#9a9a9a', 2);
      S.addCrack('clock', 110, -30, .8, .8, 30, '#222', 2.2);
      A.crash(); A.die();
      seq().done(3);
    }
    function displayText() {
      const since = s.T - s.impact.t;
      if (since > 1.7) return null;
      const tick = Math.floor(since / .075);
      const r = Math.abs(Math.sin(tick * 12.9898) * 43758.5453) % 1;
      if (r < .45 - since * .15) return { s: '8:88', a: .55 + r };
      if (r > .9 && since < .6) return { s: '1:2', a: .4 };
      return null;
    }
    function burst(ms) { s.burstUntil = performance.now() + ms; }
    function update(now, dt) {
      const dts = dt / 1000;
      s.T += dts;
      const T = s.T;
      if (s.state === 'idle') {
        const m = mimePose(T);
        hand.x = m.x; hand.y = m.y; hand.mode = m.closed ? 'fistGhost' : 'mime';
        hand.alpha += (.55 - hand.alpha) * Math.min(1, dts * 4);
        c.x = rest.x; c.y = rest.y; c.rot = 0;
      }
      if (s.state === 'held') {
        const steps = 4, h = dts / steps, k = 110, d = 2 * Math.sqrt(k) * .75, G = 2600, sag = k * 7 * u;
        for (let i = 0; i < steps; i++) {
          const tx = ptr.x + s.grabOff.x, ty = ptr.y + s.grabOff.y;
          const ax = k * (tx - hand.x) - d * hand.vx;
          const ay = k * (ty - hand.y) - d * hand.vy + sag;
          hand.vx += ax * h; hand.vy += ay * h;
          hand.x += hand.vx * h; hand.y += hand.vy * h;
          const thdd = -((G + ay) / L) * Math.sin(s.th) - (ax / L) * Math.cos(s.th) - 1.3 * s.thd;
          s.thd += thdd * h; s.th += s.thd * h;
          if (s.th > 1) { s.th = 1; if (s.thd > 0) s.thd *= -.25; }
          if (s.th < -1) { s.th = -1; if (s.thd < 0) s.thd *= -.25; }
        }
        hand.x = clamp(hand.x, 600, 1440); hand.y = clamp(hand.y, 120, 820);
        c.x = hand.x + L * Math.sin(s.th); c.y = hand.y + L * Math.cos(s.th); c.rot = -s.th;
      }
      if (s.state === 'drop') {
        s.drop.t += dts; const k = Math.min(1, s.drop.t / .55);
        const bounce = k < .7 ? Math.pow(k / .7, 2) : 1 - Math.sin((k - .7) / .3 * Math.PI) * .08;
        c.x = s.drop.x0 + (rest.x - s.drop.x0) * ease2(k);
        c.y = s.drop.y0 + (rest.y - s.drop.y0) * bounce;
        c.rot = s.drop.r0 * (1 - ease2(k)) + Math.sin(k * 14) * .05 * (1 - k);
        const hx = rest.x, hy = rest.y - L - 34 * u;
        hand.x += (hx - hand.x) * Math.min(1, dts * 5); hand.y += (hy - hand.y) * Math.min(1, dts * 5);
        if (k >= 1) { s.state = 'idle'; s.mimeStart = T + 1; A.clank(.5); }
      }
      if (s.state === 'fly') {
        s.fly.t += dts; const k = Math.min(1, s.fly.t / s.fly.dur), kk = App.config.ease('flightEase')(k);
        c.x = bez(s.fly.P0.x, s.fly.P1.x, s.fly.P2.x, s.fly.P3.x, kk);
        c.y = bez(s.fly.P0.y, s.fly.P1.y, s.fly.P2.y, s.fly.P3.y, kk);
        c.rot = s.fly.r0 + (s.fly.r1 - s.fly.r0) * kk;
        if (k >= 1) hitWall();
      }
      if (s.state === 'fly' || s.state === 'smash' || s.state === 'dead') {
        hand.mode = 'open';
      }
      if (s.state === 'smash' || s.state === 'dead') {
        const since = T - s.impact.t;
        c.sx += (1 - c.sx) * Math.min(1, dts * 14); c.sy += (1 - c.sy) * Math.min(1, dts * 14);
        if (since > .22 && !s.landed) {
          s.slideV = Math.min(520, s.slideV + 1100 * dts);
          c.y += s.slideV * dts;
          c.x += (S.WALL_EDGE - 66 * u - c.x) * Math.min(1, dts * 8);
          c.rot += (.1 - c.rot) * Math.min(1, dts * 3);
          if (c.y >= floorY) { c.y = floorY; s.landed = true; s.state = 'dead'; W.shake = Math.max(W.shake, S.reduce ? .1 : .3); A.clank(.8); }
        }
        if (s.landed) c.rot += (0 - c.rot) * Math.min(1, dts * 6);
      }
      const b = W.looseBell;
      if (b && !b.done) {
        b.vy += 1900 * dts; b.x += b.vx * dts; b.y += b.vy * dts; b.r += b.vr * dts;
        const fy = S.FLOOR - 8;
        if (b.y >= fy) {
          b.y = fy;
          if (Math.abs(b.vy) < 160) { b.done = true; b.r = -.3; }
          else { b.vy *= -.3; b.vx *= .5; b.vr *= .4; A.clank(.4); }
        }
      }
      if (W.shake > 0) W.shake = Math.max(0, W.shake - dts * 3.5);

      // write the clock out through the shared pivot (bottom centre)
      const wc = W.clock;
      const broken = s.state === 'smash' || s.state === 'dead';
      wc.px = c.x - Math.sin(c.rot) * 80; wc.py = c.y + Math.cos(c.rot) * 80;
      wc.rot = c.rot * 180 / Math.PI; wc.sx = c.sx; wc.sy = c.sy; wc.bar = 0; wc.droop = broken ? 10 : 0;
      const ringing = !broken;
      if (ringing) {
        S.ringLook(now, 1, 4);
        if (s.state !== 'idle') { wc.jx = 0; wc.hop = 0; }
        A.ring(1, 4);
      } else {
        wc.jx = 0; wc.hop = 0; wc.swing = 0; wc.linesOp = 0;
        wc.bellBase = 16 + 31;                          // remaining bell knocked askew
        const t = displayText();
        if (now < s.burstUntil) { wc.text = '8:88'; wc.bright = 1; wc.jx = rnd(-6, 6); wc.linesOp = .8; wc.linesScale = 1.05; }
        else if (t) { wc.text = t.s; wc.bright = Math.min(1, t.a); }
        else wc.bright = 0;
      }
      // hand: only drawn by the round until the throw; the sequence takes it back after
      if (!broken && s.state !== 'fly') {
        const h = W.hand;
        const closed = hand.mode === 'fist' || hand.mode === 'fistGhost';
        h.mode = closed ? 'fist' : 'open';
        S.setAnchor(closed ? 'fistGrip' : 'palm');
        h.x = hand.x; h.y = hand.y; h.alpha = hand.alpha; h.fingers = 1;
        const sx = S.SHOULDER.x, sy = S.SHOULDER.y;
        h.rot = clamp(Math.atan2(hand.y - sy, hand.x - sx) * .6, -.3, .3) * 180 / Math.PI;
      } else if (s.state === 'fly') {
        // released hand opens, follows through and starts to fall back
        const h = W.hand; h.mode = 'open'; S.setAnchor('palm');
        h.x += 220 * dts; h.y -= 60 * dts;
      }
    }
    const pose = () => ({ mode: 'open', anchor: 'palm', x: rest.x, y: rest.y - L - 34 * u, rot: 0, fingers: 1, alpha: .55 });
    return { start, update, down, move, up, key, pose, burst, hint: 'Grab the clock and throw it at the wall.' };
  })();

  return [snooze, slap, fist, toss];
})();
