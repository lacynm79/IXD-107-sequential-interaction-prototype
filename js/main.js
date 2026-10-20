/* Sequence: sleep → (tap) wake → Snooze → lull → Slap → lull → Fist → lull → Throw → ending.
   One linear path. Each round unlocks only after the previous one succeeds. Between rounds a
   snooze lull lets the day move on in the window before the clock jolts back angrier. */
window.App = window.App || {};
App.seq = (() => {
  const S = App.scene, W = S.W, A = App.audio, R = App.rounds;
  const { clamp, lerp, ease, rnd, M } = S;
  const SHOTS = ['snooze', 'slap', 'fist', 'throw'];
  const MINUTES = [360, 767, 1098, 1407];              // 6:00, 12:47, 6:18 pm, 11:27 pm
  const fmt = m => { m = Math.round(m); const h = Math.floor(m / 60) % 24, mm = m % 60; return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')}`; };
  const REST = { get x() { return S.bedPt(470, 680).x; }, get y() { return S.bedPt(470, 680).y; }, rot: 0 };   // hand tucked under the blanket
  const hintEl = document.getElementById('hint'), kbd = document.getElementById('kbd');

  let phase = 'sleep', cur = -1, t0 = 0, timers = [], tweens = [];
  let sleepy = true, nextZ = 0, wakeR = 0, jolt = null, roll = null, catHop = 0, nbShake = 0, last = performance.now();

  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  function tween(obj, key, to, dur, delay = 0, fn = ease) {
    tweens = tweens.filter(t => !(t.obj === obj && t.key === key));
    tweens.push({ obj, key, from: null, to, t0: performance.now() + delay, dur, fn });
  }
  const easeIn = k => k * k * k;
  const cfg = App.cfg, cE = name => App.config.ease(name);
  function runTweens(now) {
    tweens = tweens.filter(t => {
      if (now < t.t0) return true;
      if (t.from === null) t.from = t.obj[t.key];
      const k = clamp((now - t.t0) / t.dur, 0, 1);
      t.obj[t.key] = t.from + (t.to - t.from) * t.fn(k);
      return k < 1;
    });
  }
  function moveHand(pose, dur, delay = 0, fn = ease) {
    ['x', 'y', 'rot'].forEach(k => tween(W.hand, k, pose[k], dur, delay, fn));
  }
  function say(text) { hintEl.textContent = text; kbd.setAttribute('aria-label', text); }
  const winText = (str, x, y, o = {}) => S.spawnText(str, x, y, { layer: 'window', size: 26, dur: 1100, rise: 22, ...o });

  /* ---------- opening: asleep, the hand fumbling for a clock that isn't ringing yet ---------- */
  function sleepUpdate(now) {
    const c = W.clock;
    c.text = '5:59'; c.bright = Math.floor(now / 600) % 2 ? .62 : .16;   // flashing, like it wants attention
    c.jx = 0; c.hop = 0; c.swing = 0; c.linesOp = 0;
    const h = W.hand;
    h.mode = 'open'; S.setAnchor('palm'); h.alpha = 1; h.fingers = 1;
    const cyc = (now % 2600) / 2600;
    const pat = cyc < .22 ? Math.sin(cyc / .22 * Math.PI) * 46 : 0;     // pats the air, never finds it
    h.x = 700 + 150 * Math.sin(now * .0009);
    h.y = 336 + 16 * Math.sin(now * .0021) + pat;
    h.rot = 8 * Math.sin(now * .0013);
  }
  function wake() {
    if (phase !== 'sleep') return;
    A.unlock();
    phase = 'wake'; t0 = performance.now(); wakeR = 0; sleepy = false;
    W.clock.text = fmt(MINUTES[0]); W.clock.bright = 1;
    A.groan();
    W.blanket.jerk = 1; tween(W.blanket, 'jerk', 0, 700, 80);
    S.spawnText('?!', 360, 492, { size: 34, dur: 900, rise: 40, rot: -8 });
    // the rooster jumps out of its skin, then crows along
    tween(W.cast.rooster, 'y', -30, 140, 0, k => k);
    later(150, () => tween(W.cast.rooster, 'y', 0, 320));
    winText('!', 92, 100, { size: 34 });
    later(380, () => A.crow());
    say('The alarm is ringing.');
    later(cfg.wakeDelayMs, () => startRound(0));
  }
  function wakeUpdate(now, dt) {
    wakeR = Math.min(1, (now - t0) / 600);
    S.ringLook(now, wakeR, 1);
    W.clock.bar = 0; W.clock.rot = 0;
    A.ring(wakeR, 1);
    W.cast.rooster.rot = wakeR * 3 * M * Math.sin(now * .02);
    // fumbling: lunges at the clock, jittery, homing in on the snooze bar
    const target = R[0].pose(), k = clamp((now - t0) / 900, 0, 1), j = (1 - k) * 26 * M;
    const h = W.hand;
    h.x = lerp(h.x, target.x + rnd(-j, j), Math.min(1, dt / 90));
    h.y = lerp(h.y, target.y + rnd(-j, j), Math.min(1, dt / 90));
    h.rot = lerp(h.rot, target.rot, Math.min(1, dt / 120));
  }

  /* ---------- rounds ---------- */
  function startRound(i) {
    phase = 'round'; cur = i; jolt = null;
    R[i].start(performance.now());
    say(R[i].hint);
  }
  // called by a round the moment its action succeeds
  function done(i) {
    if (i === 0) {
      // Sticky Snooze Bar's payoff: midday, the rooster drops out, the neighbor appears
      tween(W.cast.rooster, 'rot', -70, 420);
      tween(W.cast.rooster, 'y', 180, 700, 260, cE('castOutEase'));
      winText('bawk?', 80, 96, { size: 20, dur: 900 });
      tween(W.sky, 'midday', 1, 1600 * cfg.skyScale, 0, cE('skyEase'));
      tween(W.cast.neighbor, 'y', 0, cfg.castInMs, 1600, cE('castInEase'));
      later(2500, () => winText('...?', 214, 92, { size: 22, dur: 1200 }));
      later(700, () => lull(1));
    } else if (i === 1) {
      // Slap's payoff: sunset, and the neighbor gives up
      tween(W.sky, 'sunset', 1, 1500 * cfg.skyScale, 250, cE('skyEase'));
      winText('FINALLY', 214, 96, { size: 22, dur: 1100 });
      tween(W.cast.neighbor, 'y', 175, 550, 350, cE('castOutEase'));
      later(900, () => lull(2));
    } else if (i === 2) {
      // Shake Your Fist's payoff: night falls, a cat hops onto the sill
      later(600, () => tween(W.sky, 'night', 1, 2600 * cfg.skyScale, 0, cE('skyEase')));
      later(2900, () => { W.cast.cat.on = true; catHop = performance.now(); A.meow(); });
      later(2000, () => lull(3));
    } else if (i === 3) {
      ending();
    }
  }
  // little reactions the rounds ask for
  function react(type, arg) {
    const n = W.cast.neighbor, cat = W.cast.cat;
    if (type === 'slap') {
      n.sy = .82; n.sx = 1.12; tween(n, 'sy', 1, 320); tween(n, 'sx', 1, 320);
      winText(['!', '#!', '@#!', 'ARGH'][arg - 1] || '!', 214 + rnd(-20, 20), 96, { size: 22 + arg * 4 });
    } else if (type === 'slapRing') {
      nbShake = arg;
    } else if (type === 'grab') {
      tween(cat, 'puff', .55, 260);
      winText('!', 244, 150, { size: 26, dur: 700 });
    } else if (type === 'fly') {
      tween(cat, 'puff', .85, 150);
    }
  }

  /* ---------- snooze lull, then the jolt ---------- */
  function lull(next) {
    phase = 'lull'; t0 = performance.now(); sleepy = true; nextZ = t0 + 500;
    S.el.prickles.setAttribute('d', '');
    if (R[next - 1].stop) R[next - 1].stop();
    const c = W.clock; c.jx = 0; c.hop = 0;
    tween(c, 'swing', 0, 300); tween(c, 'linesOp', 0, 300);
    moveHand(REST, cfg.handOutMs, 0, cE('handOutEase'));
    later(cfg.handOutMs + 50, () => { W.hand.mode = 'open'; S.setAnchor('palm'); W.hand.fingers = 1; });
    S.moveCam(SHOTS[next]);
    later(600, () => A.snore());
    // the minutes roll forward while they sleep
    roll = { from: MINUTES[next - 1], to: MINUTES[next], t0: t0 + 800, dur: Math.max(400, cfg.lullMs - 2000) };
    say('Snoozing...');
    later(cfg.lullMs - 450, () => { tween(W.clock, 'sy', .9, 300); tween(W.clock, 'sx', 1.06, 300); });   // the clock winds up
    later(cfg.lullMs, () => startJolt(next));
  }
  function lullUpdate(now) {
    if (roll) {
      const k = clamp((now - roll.t0) / roll.dur, 0, 1);
      W.clock.text = fmt(lerp(roll.from, roll.to, ease(k)));
      if (k >= 1) roll = null;
    }
    A.ring(0, cur + 1);
  }
  function startJolt(next) {
    const c = W.clock;
    jolt = { next, t0: performance.now(), from: { px: c.px, py: c.py, rot: c.rot, sx: c.sx, sy: c.sy, droop: c.droop, bar: c.bar } };
    phase = 'jolt'; sleepy = false;
    c.text = fmt(MINUTES[next]); c.bright = 1;
    A.jolt(); later(120, () => A.groan(1 + next * .15));
    W.blanket.jerk = 1; tween(W.blanket, 'jerk', 0, 650, 80);
    S.spawnText(['', 'ugh', 'AGAIN?', 'NO.'][next], 360, 490, { size: 26 + next * 4, dur: 1000, rise: 36, rot: rnd(-10, 6) });
    const n = W.cast.neighbor, cat = W.cast.cat;
    if (next === 1) {
      tween(n, 'y', -20, 120); later(140, () => tween(n, 'y', 0, 300));
      later(160, () => { winText('#@!', 214, 92, { size: 26 }); A.yell(); });
    } else if (next === 2) {
      // the neighbor pops back up, furious, then gives up again
      tween(n, 'y', 0, cfg.castInMs * .29, 0, cE('castInEase'));
      later(260, () => { winText('AGAIN?!', 214, 92, { size: 24, dur: 1300 }); A.yell(); });
      later(1500, () => tween(n, 'y', 175, 500, 0, cE('castOutEase')));
    } else if (next === 3) {
      tween(cat, 'puff', .4, 200);
      later(60, () => { winText('!', 244, 150, { size: 26, dur: 700 }); A.hiss(.4); });
      tween(cat, 'puff', .15, 1400, 900);
    }
    moveHand(R[next].pose(), cfg.handInMs, 80, cE('handInEase'));
  }
  function joltUpdate(now) {
    const k = clamp((now - jolt.t0) / cfg.joltMs, 0, 1), e = cE('joltEase')(k), f = jolt.from, c = W.clock, lvl = jolt.next + 1;
    // hops up off the nightstand, shakes off the last round, lands angry
    c.px = lerp(f.px, S.HOME.x, e); c.py = lerp(f.py, S.HOME.y, e);
    c.rot = lerp(f.rot, 0, e); c.droop = lerp(f.droop, 0, e); c.bar = lerp(f.bar, 0, e);
    const land = k > .8 ? Math.sin((k - .8) / .2 * Math.PI) * .14 : 0;
    c.sy = lerp(f.sy, 1, e) - land; c.sx = lerp(f.sx, 1, e) + land * .6;
    S.ringLook(now, Math.min(1, k * 3), lvl);
    c.hop += Math.sin(k * Math.PI) * (50 + lvl * 12) * cfg.joltHop;
    A.ring(Math.min(1, k * 4), lvl);
    // the hand fumbles back out from under the covers
    const j = (1 - k) * 18 * M; W.hand.x += rnd(-j, j); W.hand.y += rnd(-j, j);
    const p = R[jolt.next].pose();
    W.hand.alpha = lerp(W.hand.alpha, p.alpha ?? 1, .2);
    if (p.ax != null) { W.hand.ax = p.ax; W.hand.ay = p.ay; }
    if (k >= 1) startRound(jolt.next);
  }

  /* ---------- ending ---------- */
  function ending() {
    phase = 'end'; t0 = performance.now();
    const cat = W.cast.cat;
    // the cat loses it
    tween(cat, 'puff', 1, 120); cat.hiss = true; A.hiss();
    winText('HSSS!', 244, 136, { size: 28, dur: 1000 });
    later(1100, () => { cat.hiss = false; tween(cat, 'puff', .25, 2200); });
    later(250, () => { W.hand.mode = 'open'; S.setAnchor('palm'); W.hand.alpha = 1; moveHand(REST, 1000); });
    later(1500, () => S.moveCam('end'));
    const B = cfg.burstDelayMs;
    later(2600, () => { sleepy = true; nextZ = performance.now(); say('Quiet, finally.'); });
    // ...a few seconds later: one last gasp
    later(B, () => {
      sleepy = false;
      A.burst(.42); R[3].burst(420);
      S.spawnText('BRRRI—', 1300, 560, { size: 40, dur: 700, rise: 20, rot: -4 });
      W.shake = .25;
      tween(cat, 'puff', 1, 80); cat.hiss = true; A.hiss(.8);
      // and the cat is out of here
      later(220, () => { tween(cat, 'y', 8, 90); later(100, () => tween(cat, 'y', -360, 480, 0, cE('castOutEase'))); });
    });
    // the hand rises, and it stops
    later(B + 90, () => moveHand({ x: 600, y: 320, rot: -78 }, 200, 0, k => 1 - Math.pow(1 - k, 3)));
    later(B + 950, () => moveHand(REST, 520, 0, easeIn));
    later(B + 1450, () => {
      A.sigh();
      S.spawnText('*sigh*', 340, 500, { size: 26, dur: 1600, rise: 30, fill: '#555' });
      tween(W.blanket, 'roll', 1, cfg.rollMs, 200, cE('rollEase'));
      later(450, () => A.grumble());
    });
    later(B + 1650 + cfg.rollMs, () => { phase = 'done'; sleepy = true; say('Asleep. Pull the light chain to start again.'); });
  }

  /* ---------- reset ---------- */
  function resetAll() {
    timers.forEach(clearTimeout); timers = []; tweens = [];
    R.forEach(r => r.stop && r.stop());
    S.resetState();
    phase = 'sleep'; cur = -1; jolt = null; roll = null; sleepy = true; nextZ = performance.now() + 400; catHop = 0; nbShake = 0;
    S.moveCam('sleep', 0);
    A.ring(0, 1);
    say('Someone is asleep. Tap anywhere to disturb them.');
  }

  // control panel preview: jump straight to round i (0 = snooze ... 3 = throw), with the room
  // set up as if the earlier rounds happened
  function jumpTo(i) {
    resetAll(); A.unlock();
    if (i === 0) { wake(); return; }
    const c = W.clock, cast = W.cast;
    W.sky.dawn = 1; W.sky.midday = 1; cast.rooster.y = 180; cast.rooster.rot = -70; cast.neighbor.y = 0;
    c.text = fmt(MINUTES[i - 1]); c.bright = 1;
    if (i === 1) c.bar = cfg.snoozeTravel;
    if (i >= 2) { W.sky.sunset = 1; cast.neighbor.y = 175; }
    if (i === 3) { W.sky.night = 1; cast.cat.on = true; Object.assign(c, { rot: 90, px: S.HOME.x + 160, py: S.FLOOR - 112 }); }
    S.moveCam(SHOTS[i - 1], 0);
    cur = i - 1;
    lull(i);
  }

  /* ---------- frame loop ---------- */
  function frame() {
    const now = performance.now();                    // one clock for timers, tweens and frames
    const dt = clamp(now - last, 0, 50); last = now;
    runTweens(now);
    if (phase === 'sleep') sleepUpdate(now);
    else if (phase === 'wake') wakeUpdate(now, dt);
    else if (phase === 'round' || phase === 'end' || phase === 'done') { if (cur >= 0) R[cur].update(now, dt); }
    else if (phase === 'lull') lullUpdate(now);
    else if (phase === 'jolt') joltUpdate(now);
    if (W.shake > 0 && phase !== 'round' && phase !== 'end' && phase !== 'done') W.shake = Math.max(0, W.shake - dt / 300);

    // sleeper breathing, Zzz and snores
    W.blanket.breath = sleepy ? Math.sin(now / 3400 * Math.PI * 2) : W.blanket.breath * .9;
    if (sleepy && now > nextZ) {
      S.spawnZ(false); later(500, () => sleepy && S.spawnZ(true));
      if (A.ready && phase !== 'lull') A.snore(phase === 'sleep' ? .8 : 1);
      nextZ = now + 3400;
    }
    // the neighbor shakes along with the ring during the slaps
    if (phase === 'round' && cur === 1) W.cast.neighbor.rot = 5 * nbShake * M * Math.sin(now * .05);
    else W.cast.neighbor.rot *= .9;
    // cat hop-in (Shake Your Fist keyframes)
    if (catHop) {
      const k = (now - catHop) / 900, cat = W.cast.cat;
      if (k >= 1) { catHop = 0; cat.y = 0; }
      else cat.y = k < .55 ? lerp(90, -22, ease(k / .55)) : k < .78 ? lerp(-22, 4, (k - .55) / .23) : lerp(4, 0, (k - .78) / .22);
    }
    S.draw(now);
    requestAnimationFrame(frame);
  }

  /* ---------- input ---------- */
  const stage = S.el.stage;
  let activePointer = null;
  stage.addEventListener('pointerdown', e => {
    if (phase === 'sleep') { wake(); return; }
    A.unlock();
    if (phase !== 'round') return;
    activePointer = e.pointerId;
    try { stage.setPointerCapture(e.pointerId); } catch (_) {}
    R[cur].down(S.toWorld(e), e);
  });
  stage.addEventListener('pointermove', e => {
    if (phase !== 'round' || !R[cur].move) return;
    R[cur].move(S.toWorld(e), e);
  });
  const up = e => {
    if (e.pointerId !== activePointer) return;
    activePointer = null;
    if (phase === 'round' && R[cur].up) R[cur].up(S.toWorld(e), e);
  };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('contextmenu', e => e.preventDefault());
  const bulb = document.getElementById('bulb');
  const inPanel = e => !!(e.target && e.target.closest && e.target.closest('.tpanel'));
  addEventListener('keydown', e => {
    if (document.activeElement === bulb || inPanel(e) || e.key === 'Tab' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (phase === 'sleep') { e.preventDefault(); wake(); return; }
    if (phase === 'round' && R[cur].key) R[cur].key(e, true);
  });
  addEventListener('keyup', e => {
    if (document.activeElement === bulb || inPanel(e)) return;
    if (phase === 'round' && R[cur].key) R[cur].key(e, false);
  });
  addEventListener('blur', () => { if (phase === 'round' && cur === 0) R[0].up(); });

  /* ---------- the reset bulb: pull the chain, lights out, the firefly flashes ---------- */
  const B = {
    swing: document.getElementById('bulbSwing'), chain: document.getElementById('chain'),
    halo: document.getElementById('bulbHalo'), glass: document.getElementById('bulbGlass'),
    fly: document.getElementById('firefly'), glow: document.getElementById('flyGlow'),
    tail: document.getElementById('flyTail'), wings: document.getElementById('flyWings'),
    dark: document.getElementById('dark'),
  };
  let pullT = 0, pulling = false;
  function pull() {
    if (pulling) return;
    pulling = true; pullT = performance.now();
    A.unlock(); A.pullClick();
    B.dark.style.transition = 'opacity .12s linear'; B.dark.style.opacity = '.94';
    setTimeout(() => A.fireflyBlip(), 160);
    setTimeout(() => A.fireflyBlip(), 520);
    setTimeout(resetAll, 300);
    setTimeout(() => { B.dark.style.transition = 'opacity .8s ease'; B.dark.style.opacity = '0'; }, 1050);
    setTimeout(() => { pulling = false; }, 1900);
  }
  bulb.addEventListener('click', pull);
  // size of the lamp, chain and reset tag (Triggers panel > Reset light)
  const bulbSvg = document.querySelector('#bulb svg'), chainLine = document.getElementById('chainLine'), bead = document.getElementById('chainBead');
  function bulbLayout() {
    const c = App.cfg, end = 176 + 64 * (c.chainLen - 1), r = 11 * c.tagScale, cy = end + r;
    chainLine.setAttribute('d', `M72 112 L72 ${end.toFixed(1)}`);
    bead.setAttribute('transform', `translate(72 ${cy.toFixed(1)}) scale(${c.tagScale}) translate(-72 -187)`);
    const H = Math.max(230, cy + r + 8);
    bulbSvg.setAttribute('viewBox', `0 0 120 ${H.toFixed(1)}`);
    document.documentElement.style.setProperty('--bulbS', c.bulbScale);
    document.documentElement.style.setProperty('--bulbK', (c.bulbScale * H / 230).toFixed(4));
  }
  App.config.onChange(k => { if (['bulbScale', 'chainLen', 'tagScale'].includes(k)) bulbLayout(); });
  bulbLayout();

  function bulbFrame() {
    const now = performance.now();
    const k = pulling ? (now - pullT) : 1e9;
    const yank = k < 400 ? Math.sin(Math.min(1, k / 120) * Math.PI / 2) * 18 * (k < 120 ? 1 : 1 - (k - 120) / 280) : 0;
    const sw = 2 * Math.sin(now * .0012) * M + (k < 1400 ? 6 * Math.exp(-k / 500) * Math.sin(k / 90) * M : 0);
    B.swing.setAttribute('transform', `rotate(${sw.toFixed(2)} 60 0)`);
    B.chain.setAttribute('transform', `translate(0 ${yank.toFixed(1)})`);
    const lit = !(pulling && k > 60 && k < 1050);
    B.halo.setAttribute('opacity', lit ? .35 : 0);
    B.glass.setAttribute('fill', lit ? App.cfg.colBulbGlass : '#5a5a5a');
    // firefly loops the bulb; flashes in the dark, then sulks
    const a = now * .0021;
    const x = 60 + 36 * Math.cos(a), y = 96 + 13 * Math.sin(a) + 4 * Math.sin(now * .006);
    const face = -Math.sin(a) >= 0 ? 1 : -1;
    const bs = App.cfg.bugScale;
    B.fly.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(face * bs).toFixed(3)} ${bs})`);
    B.wings.setAttribute('transform', `scale(1 ${Math.sin(now * .09) > 0 ? 1 : .4})`);
    let g = .5, r = 16;
    if (pulling && k > 100 && k < 900) { const f = Math.abs(Math.sin((k - 100) / 800 * Math.PI * 2)); g = .6 + .4 * f; r = 16 + 46 * f; }
    else if (pulling || (k < 3000)) g = .18;
    B.glow.setAttribute('opacity', g.toFixed(2)); B.glow.setAttribute('r', r.toFixed(1));
    B.tail.setAttribute('fill', g > .55 ? App.cfg.colBulbGlow : App.cfg.colFireflyTail);
    requestAnimationFrame(bulbFrame);
  }

  // keyboard focus ring around the clock
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  Object.entries({ x: -175, y: -318, width: 350, height: 336, rx: 36, fill: 'none', stroke: '#222', 'stroke-width': 4, 'stroke-dasharray': '10 8', display: 'none' })
    .forEach(([k, v]) => ring.setAttribute(k, v));
  S.el.clock.appendChild(ring);
  kbd.addEventListener('focus', () => ring.setAttribute('display', ''));
  kbd.addEventListener('blur', () => ring.setAttribute('display', 'none'));

  resetAll();
  requestAnimationFrame(frame);
  requestAnimationFrame(bulbFrame);
  return { done, react, jumpTo, restart: resetAll, get phase() { return phase; }, get round() { return cur; } };
})();
