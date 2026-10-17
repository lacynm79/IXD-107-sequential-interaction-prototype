/* Tunable settings. DEFAULTS are the prototype's saved values; App.cfg holds the live values the
   control panel edits. Motion code reads App.cfg every time it starts a move, so changes show
   up on the next move without a reload. */
window.App = window.App || {};
(() => {
  // easing curves offered in the panel (k runs 0 → 1)
  const EASE = {
    linear: k => k,
    easeIn: k => k * k * k,
    easeOut: k => 1 - Math.pow(1 - k, 3),
    easeInOut: k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2,
    spring: k => k >= 1 ? 1 : 1 - Math.exp(-6.5 * k) * Math.cos(k * Math.PI * 3.2),
  };
  const EASE_LABELS = { linear: 'Linear', easeIn: 'Ease In', easeOut: 'Ease Out', easeInOut: 'Ease In-Out', spring: 'Spring/Bounce' };

  // group, key, label, kind ('range' | 'ease'), and for ranges: min, max, step, unit, note
  const SCHEMA = [
    ['Overall', [
      ['volume', 'Volume', 'range', 0, 100, 1, '%'],
      ['shake', 'Ring shake intensity', 'range', 0, 2, .05, '×'],
      ['lullMs', 'Snooze lull length', 'range', 2000, 8000, 100, 'ms'],
    ]],
    ['Camera', [
      ['camMs', 'Pan / zoom duration', 'range', 600, 5000, 100, 'ms'],
      ['camEase', 'Pan / zoom motion', 'ease'],
    ]],
    ['Sky & window cast', [
      ['skyScale', 'Sky fade time', 'range', .25, 3, .05, '×', '1× = 1.5–2.6 s'],
      ['skyEase', 'Sky fade motion', 'ease'],
      ['castInMs', 'Neighbor pops up', 'range', 200, 2500, 50, 'ms'],
      ['castInEase', 'Pop-up motion', 'ease'],
      ['castOutEase', 'Falls, sinks & leaps', 'ease'],
    ]],
    ["Sleeper's hand", [
      ['handOutMs', 'Back under the covers', 'range', 300, 2500, 50, 'ms'],
      ['handOutEase', 'Retreat motion', 'ease'],
      ['handInMs', 'Fumbles back out', 'range', 200, 1500, 50, 'ms'],
      ['handInEase', 'Fumble motion', 'ease'],
    ]],
    ['Clock jolt (between rounds)', [
      ['joltMs', 'Jolt duration', 'range', 250, 1500, 10, 'ms'],
      ['joltEase', 'Jolt motion', 'ease'],
      ['joltHop', 'Jolt hop height', 'range', 0, 3, .05, '×', '1× = 62–98 room px'],
    ]],
    ['1 · Snooze', [
      ['snoozeHoldMs', 'Hold time to snooze', 'range', 400, 3000, 50, 'ms'],
      ['snoozeReleaseEase', 'Bar spring-back motion', 'ease'],
    ]],
    ['2 · Slap', [
      ['slapSquash', 'Squish depth', 'range', .3, 1.5, .05, '×'],
      ['slapBounceMs', 'Bounce-back duration', 'range', 200, 1500, 10, 'ms'],
      ['slapBounceEase', 'Bounce-back motion', 'ease'],
    ]],
    ['3 · Fist', [
      ['fistShakes', 'Shakes to fill the rage', 'range', 1, 10, 1, 'shakes'],
      ['punchWindupMs', 'Punch wind-up', 'range', 100, 800, 10, 'ms'],
      ['punchEase', 'Punch strike motion', 'ease'],
    ]],
    ['4 · Throw', [
      ['throwSpeed', 'Minimum fling speed', 'range', 300, 2500, 50, 'room px/s'],
      ['flightEase', 'Flight motion', 'ease'],
    ]],
    ['Ending', [
      ['burstDelayMs', 'Last gasp after the smash', 'range', 2500, 9000, 100, 'ms'],
      ['rollMs', 'Roll-over duration', 'range', 400, 3000, 50, 'ms'],
      ['rollEase', 'Roll-over motion', 'ease'],
    ]],
  ];

  const DEFAULTS = {
    volume: 90, shake: 1, lullMs: 3600,
    camMs: 2400, camEase: 'easeInOut',
    skyScale: 1, skyEase: 'easeInOut', castInMs: 900, castInEase: 'easeInOut', castOutEase: 'easeIn',
    handOutMs: 900, handOutEase: 'easeIn', handInMs: 600, handInEase: 'easeInOut',
    joltMs: 560, joltEase: 'easeInOut', joltHop: 1,
    snoozeHoldMs: 1000, snoozeReleaseEase: 'easeInOut',
    slapSquash: 1, slapBounceMs: 650, slapBounceEase: 'spring',
    fistShakes: 3, punchWindupMs: 280, punchEase: 'easeIn',
    throwSpeed: 900, flightEase: 'linear',
    burstDelayMs: 5200, rollMs: 1300, rollEase: 'easeInOut',
  };

  // The control panel is hidden. Set SHOW_PANEL to true to bring the same panel back
  // (or add ?panel to the page URL to show it for one visit).
  const SHOW_PANEL = false;

  const listeners = [];
  App.cfg = { ...DEFAULTS };
  App.config = {
    SCHEMA, DEFAULTS, EASE, EASE_LABELS,
    showPanel: SHOW_PANEL || /[?&]panel\b/.test(location.search),
    ease: name => EASE[App.cfg[name]] || EASE.easeInOut,
    set(key, value) { App.cfg[key] = value; listeners.forEach(fn => fn(key, value)); },
    restore() { Object.keys(DEFAULTS).forEach(k => App.config.set(k, DEFAULTS[k])); },
    onChange(fn) { listeners.push(fn); },
  };
})();
