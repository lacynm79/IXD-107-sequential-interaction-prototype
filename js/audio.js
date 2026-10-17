/* Sound: everything is synthesized with the Web Audio API, as in the studies.
   The alarm ring is the Slap the Alarm Quiet bell (metallic partials chopped by a hammer
   LFO), extended with a nightstand rattle, drive and a pitch bend so it can get angrier
   each round and die out at the end. Other one-shots come from Slap (thud, smack) and
   Shake Your Fist (growl, thwack, thud); the rest are new for the sequence. */
window.App = window.App || {};
App.audio = (() => {
  let C = null, master = null, R = null;
  let override = false;              // die() / burst() take over the ring for a moment

  // ring character per round (1 = snooze ... 4 = throw)
  const LEVELS = {
    0: { vol: 0, ham: 14, bright: 3000, wob: 0, rattle: 0, drive: 0 },
    1: { vol: .12, ham: 18, bright: 4500, wob: 0, rattle: 0, drive: 0 },
    2: { vol: .16, ham: 22, bright: 5500, wob: 25, rattle: .06, drive: .15 },
    3: { vol: .21, ham: 26, bright: 6500, wob: 55, rattle: .14, drive: .4 },
    4: { vol: .27, ham: 31, bright: 7500, wob: 85, rattle: .22, drive: .7 },
  };

  function noiseBuf(dur) {
    const b = C.createBuffer(1, Math.max(1, Math.floor(C.sampleRate * dur)), C.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function driveCurve(k) {
    const n = 1024, c = new Float32Array(n), a = 1 + k * 8;
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = k ? Math.tanh(x * a) / Math.tanh(a) : x; }
    return c;
  }

  function build() {
    master = C.createGain(); master.gain.value = .9;
    const comp = C.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 4;
    master.connect(comp).connect(C.destination);

    const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000; lp.Q.value = .7;
    const shaper = C.createWaveShaper(); shaper.curve = driveCurve(0); shaper.oversample = '2x';
    const ringGain = C.createGain(); ringGain.gain.value = 0;
    const chop = C.createGain(); chop.gain.value = .5;
    const ham = C.createOscillator(); ham.type = 'square'; ham.frequency.value = 22;
    const hamDepth = C.createGain(); hamDepth.gain.value = .5; ham.connect(hamDepth).connect(chop.gain);
    const wob = C.createOscillator(); wob.frequency.value = 5;
    const wobDepth = C.createGain(); wobDepth.gain.value = 0; wob.connect(wobDepth);
    const bend = C.createConstantSource(); bend.offset.value = 0;
    [1840, 2710, 4100].forEach((f, i) => {
      const o = C.createOscillator(); o.type = i ? 'sine' : 'triangle'; o.frequency.value = f;
      wobDepth.connect(o.detune); bend.connect(o.detune);
      const g = C.createGain(); g.gain.value = [.5, .3, .12][i];
      o.connect(g).connect(chop); o.start();
    });
    // rattle: the clock hammering against the nightstand, gated by the same hammer
    const rn = C.createBufferSource(); rn.buffer = noiseBuf(1.3); rn.loop = true;
    const rbp = C.createBiquadFilter(); rbp.type = 'bandpass'; rbp.frequency.value = 850; rbp.Q.value = 1.6;
    const rattle = C.createGain(); rattle.gain.value = 0;
    rn.connect(rbp).connect(rattle).connect(chop);
    chop.connect(shaper).connect(lp).connect(ringGain).connect(master);
    ham.start(); wob.start(); bend.start(); rn.start();
    R = { lp, shaper, ringGain, ham, wobDepth, bend, rattle, drive: -1 };
  }

  function unlock() {
    if (!C) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      C = new AC(); build();
    }
    if (C.state === 'suspended') C.resume();
  }

  // called every frame: r = how hard it is ringing (0..1), lvl = round 1..4
  function ring(r, lvl) {
    if (!C || override) return;
    r = Math.max(0, Math.min(1, r || 0));
    const P = LEVELS[lvl] || LEVELS[0], ct = C.currentTime;
    if (R.drive !== P.drive) { R.shaper.curve = driveCurve(P.drive); R.drive = P.drive; }
    R.ringGain.gain.setTargetAtTime(P.vol * r, ct, .03);
    R.lp.frequency.setTargetAtTime(500 + P.bright * Math.pow(r, 1.6), ct, .05);
    R.ham.frequency.setTargetAtTime(10 + (P.ham - 10) * r, ct, .1);
    R.wobDepth.gain.setTargetAtTime(r > 0 ? P.wob : 0, ct, .1);
    R.rattle.gain.setTargetAtTime(P.rattle * r, ct, .05);
  }

  // end of the throw: hits the wall at full volume, then slows, warps and fades fast
  function die() {
    if (!C) return;
    override = true;
    const t = C.currentTime, g = R.ringGain.gain;
    [g, R.bend.offset, R.ham.frequency, R.lp.frequency].forEach(p => p.cancelScheduledValues(t));
    g.setValueAtTime(.32, t); g.setValueAtTime(.32, t + .2); g.exponentialRampToValueAtTime(.0001, t + 1.7);
    R.bend.offset.setValueAtTime(0, t + .15); R.bend.offset.linearRampToValueAtTime(-1700, t + 1.6);
    R.ham.frequency.setValueAtTime(31, t + .15); R.ham.frequency.exponentialRampToValueAtTime(2.2, t + 1.6);
    R.lp.frequency.setValueAtTime(7500, t + .15); R.lp.frequency.exponentialRampToValueAtTime(220, t + 1.6);
    setTimeout(() => { R.bend.offset.setValueAtTime(0, C.currentTime); override = false; }, 1900);
  }

  // the broken clock's last gasp: a short, sour burst of ring, cut off sharply
  function burst(dur) {
    if (!C) return;
    override = true;
    const t = C.currentTime, g = R.ringGain.gain;
    [g, R.bend.offset, R.ham.frequency, R.lp.frequency].forEach(p => p.cancelScheduledValues(t));
    R.bend.offset.setValueAtTime(-420, t);
    R.ham.frequency.setValueAtTime(27, t);
    R.lp.frequency.setValueAtTime(5200, t);
    R.rattle.gain.setValueAtTime(.15, t);
    g.setValueAtTime(.0001, t); g.exponentialRampToValueAtTime(.3, t + .03);
    g.setValueAtTime(.3, t + dur); g.exponentialRampToValueAtTime(.0001, t + dur + .04);
    R.rattle.gain.setValueAtTime(0, t + dur + .04);
    setTimeout(() => { R.bend.offset.setValueAtTime(0, C.currentTime); override = false; }, dur * 1000 + 200);
  }

  /* ---------- one-shots ---------- */
  function tone(type, f0, f1, dur, g, when = 0, filt = 0) {
    if (!C) return;
    const t = C.currentTime + when;
    const o = C.createOscillator(), gn = C.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gn.gain.setValueAtTime(.0001, t);
    gn.gain.exponentialRampToValueAtTime(g, t + .008);
    gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
    let n = o;
    if (filt) { const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filt; o.connect(f); n = f; }
    n.connect(gn); gn.connect(master); o.start(t); o.stop(t + dur + .03);
  }
  function noise(dur, g, type, freq, when = 0, q = .7, attack = .005) {
    if (!C) return;
    const t = C.currentTime + when;
    const s = C.createBufferSource(); s.buffer = noiseBuf(dur);
    const f = C.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const gn = C.createGain();
    gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(g, t + attack);
    gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f).connect(gn).connect(master); s.start(t);
    return f;
  }
  // a rough vocal: sawtooth through two formants, with vibrato
  function voice(f0, f1, dur, g, formants, when = 0) {
    if (!C) return;
    const t = C.currentTime + when;
    const o = C.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const vib = C.createOscillator(); vib.frequency.value = 5.5;
    const vd = C.createGain(); vd.gain.value = f0 * .03; vib.connect(vd).connect(o.frequency);
    const gn = C.createGain();
    gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(g, t + .06);
    gn.gain.setValueAtTime(g, t + dur * .6); gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
    formants.forEach(fq => {
      const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = 5;
      o.connect(bp).connect(gn);
    });
    gn.connect(master); o.start(t); vib.start(t); o.stop(t + dur + .05); vib.stop(t + dur + .05);
  }

  const S = {
    // Slap the Alarm Quiet
    thud() {
      if (!C) return; const t = C.currentTime;
      const o = C.createOscillator(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(38, t + .35);
      const g = C.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.7, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .45);
      o.connect(g).connect(master); o.start(t); o.stop(t + .5);
      noise(.35, .35, 'lowpass', 500);
    },
    smack() { noise(.06, .5, 'highpass', 1800); },
    // Shake Your Fist
    growl(r) {
      const g = .05 + r * .03;
      for (let i = 0; i < 4; i++) tone('sawtooth', 80 + r * 6 + (i % 2) * 14, 68 + r * 5, .07, g, i * .06, 550 + r * 110);
    },
    thwack() { noise(.22, .9, 'lowpass', 1500); tone('sine', 160, 38, .38, .9); tone('square', 90, 40, .12, .22, 0, 500); },
    fistThud() { tone('sine', 95, 55, .2, .35, 0, 300); noise(.08, .12, 'lowpass', 380); },
    // new for the sequence
    click() { tone('square', 2200, 1600, .02, .2); tone('sine', 180, 90, .08, .3); },
    jolt() { tone('sine', 140, 420, .12, .35); noise(.1, .3, 'lowpass', 900); },
    groan(k = 1) { voice(150, 92, .85, .2 * k, [620, 1050]); },
    grumble() { voice(120, 100, .35, .12, [500, 900]); voice(110, 95, .3, .1, [500, 900], .4); },
    sigh() {
      noise(1.3, .22, 'bandpass', 900, 0, 1.2, .35);
      voice(132, 88, 1.1, .06, [550, 950], .05);
    },
    snore(k = 1) {
      if (!C) return;
      const t = C.currentTime;
      // inhale with a soft palate rattle
      const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 58;
      const am = C.createOscillator(); am.frequency.value = 26; const amd = C.createGain(); amd.gain.value = .5;
      const og = C.createGain(); og.gain.value = 0; am.connect(amd).connect(og.gain);
      const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
      const env = C.createGain();
      env.gain.setValueAtTime(.0001, t); env.gain.exponentialRampToValueAtTime(.16 * k, t + .8); env.gain.exponentialRampToValueAtTime(.0001, t + 1.15);
      o.connect(og).connect(lp).connect(env).connect(master);
      o.start(t); am.start(t); o.stop(t + 1.2); am.stop(t + 1.2);
      noise(1.1, .05 * k, 'lowpass', 600, 0, .7, .7);
      // exhale: a little whistle
      noise(.7, .04 * k, 'lowpass', 380, 1.35, .7, .15);
      tone('sine', 980, 760, .5, .02 * k, 1.4);
    },
    crow() {
      [[520, 700, .12, 0], [700, 640, .1, .14], [640, 900, .18, .27], [900, 560, .5, .48]].forEach(([a, b, d, w]) => {
        voice(a, b, d, .1, [1200, 2400], w);
      });
    },
    yell() { voice(270, 200, .28, .14, [800, 1300]); voice(300, 210, .4, .16, [800, 1300], .36); },
    hiss(k = 1) { noise(.75, .32 * k, 'highpass', 2600, 0, .7, .01); noise(.08, .25 * k, 'bandpass', 3800, 0, 2); },
    meow() { voice(700, 1100, .18, .06, [1500, 3000]); voice(1100, 600, .3, .07, [1500, 3000], .18); },
    whoosh() { const f = noise(.35, .25, 'bandpass', 500, 0, 1.5, .12); if (f) f.frequency.exponentialRampToValueAtTime(2600, C.currentTime + .3); },
    crash() { noise(.5, .9, 'lowpass', 2400); tone('sine', 120, 35, .5, .9); tone('square', 300, 90, .15, .3, 0, 1200); noise(.25, .4, 'highpass', 3000, .03); },
    clank(k = 1) { tone('triangle', 2200, 2100, .25, .12 * k); tone('sine', 3300, 3250, .2, .06 * k); tone('sine', 140, 70, .12, .25 * k); },
    pop() { tone('sine', 260, 620, .09, .25); },
    pullClick() { tone('square', 1500, 900, .025, .18); tone('square', 600, 300, .03, .12, .03); },
    fireflyBlip() { tone('sine', 1400, 2400, .12, .06); tone('sine', 2400, 1800, .18, .04, .12); },
  };

  return Object.assign({ unlock, ring, die, burst, get ready() { return !!C; } }, S);
})();
