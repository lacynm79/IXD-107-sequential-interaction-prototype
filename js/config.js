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
      ['snoozeReleaseEase', 'Bar spring-back motion', 'ease'],
    ]],
    ['2 · Slap', [
      ['slapSquash', 'Squish depth', 'range', .3, 1.5, .05, '×'],
      ['slapBounceMs', 'Bounce-back duration', 'range', 200, 1500, 10, 'ms'],
      ['slapBounceEase', 'Bounce-back motion', 'ease'],
    ]],
    ['3 · Fist', [
      ['punchWindupMs', 'Punch wind-up', 'range', 100, 800, 10, 'ms'],
      ['punchEase', 'Punch strike motion', 'ease'],
    ]],
    ['4 · Throw', [
      ['flightEase', 'Flight motion', 'ease'],
    ]],
    ['Ending', [
      ['burstDelayMs', 'Last gasp after the smash', 'range', 2500, 9000, 100, 'ms'],
      ['rollMs', 'Roll-over duration', 'range', 400, 3000, 50, 'ms'],
      ['rollEase', 'Roll-over motion', 'ease'],
    ]],
  ];

  // Trigger panel: what it takes to complete each step (distances, times, counts).
  // "room px" are units of the 1600-wide room; the clock drawing is 0.8 room px per unit.
  const TRIGGER_SCHEMA = [
    ['Opening', [
      ['wakeDelayMs', 'Wake-up before the snooze unlocks', 'range', 300, 3000, 50, 'ms'],
    ]],
    ['1 · Snooze', [
      ['snoozeHoldMs', 'Hold time to snooze', 'range', 400, 3000, 50, 'ms'],
      ['snoozeTravel', 'Snooze bar travel', 'range', 4, 40, 1, 'clock px', '14 = flush with the clock top'],
    ]],
    ['2 · Slap', [
      ['slapsNeeded', 'Slaps to silence it', 'range', 1, 8, 1, 'slaps'],
      ['slapGapMs', 'Minimum time between slaps', 'range', 0, 1000, 10, 'ms', 'faster slaps are ignored'],
      ['slapPad', 'Hit area around the clock', 'range', 0, 150, 5, 'room px', 'extra margin that still counts'],
    ]],
    ['3 · Fist', [
      ['fistShakes', 'Shakes to fill the rage', 'range', 1, 10, 1, 'shakes'],
      ['fistSwingPx', 'Minimum swing distance', 'range', 5, 150, 1, 'room px'],
      ['fistSwingMs', 'Maximum time per swing', 'range', 300, 3000, 50, 'ms'],
      ['fistReachPx', 'Start shaking within', 'range', 150, 900, 10, 'room px', 'distance from the clock'],
      ['fistFadeMs', 'Rage starts fading after', 'range', 500, 8000, 100, 'ms', 'with no new shake'],
    ]],
    ['4 · Throw', [
      ['throwGrabPx', 'Grab radius', 'range', 60, 260, 1, 'room px'],
      ['throwDragPx', 'Minimum drag distance', 'range', 0, 400, 5, 'room px'],
      ['throwSpeed', 'Minimum fling speed', 'range', 300, 2500, 50, 'room px/s'],
    ]],
  ];

  // Color panel: one entry per recolorable part. The rooster, neighbor, window frame, skies and
  // ring lines are bitmaps from the studies and keep their own colors.
  const COLOR_SCHEMA = [
    ['Room', [
      ['colWall', 'Back wall', 'color'],
      ['colSideWall', 'Side wall (the one it hits)', 'color'],
      ['colFloor', 'Floor', 'color'],
      ['colFloorLine', 'Floorboard lines', 'color'],
      ['colBaseboard', 'Baseboard', 'color'],
      ['colPage', 'Page edges', 'color'],
      ['colInk', 'Outlines and lettering', 'color'],
    ]],
    ['Bed', [
      ['colHeadboard', 'Headboard', 'color'],
      ['colBedBase', 'Bed frame', 'color'],
      ['colSheet', 'Sheet', 'color'],
      ['colPillow', 'Pillow', 'color'],
      ['colBlanket', 'Blanket', 'color'],
      ['colBlanketCheck', 'Blanket checks', 'color'],
      ['colLegs', 'Bed and nightstand legs', 'color'],
    ]],
    ['Sleeper', [
      ['colHair', 'Hair', 'color'],
      ['colSleeve', 'Arm (sleeve)', 'color'],
      ['colSkin', 'Hand and fist', 'color'],
      ['colCuff', 'Cuff', 'color'],
    ]],
    ['Nightstand', [
      ['colStandTop', 'Top', 'color'],
      ['colStandBody', 'Body', 'color'],
      ['colDrawer', 'Drawer', 'color'],
      ['colKnob', 'Knob', 'color'],
    ]],
    ['Alarm clock', [
      ['colClockBody', 'Body', 'color'],
      ['colClockFeet', 'Feet', 'color'],
      ['colScreen', 'Screen', 'color'],
      ['colDigits', 'Digits', 'color'],
      ['colBell', 'Bells', 'color'],
      ['colSnooze', 'Snooze bar', 'color'],
    ]],
    ['Window cast', [
      ['colCat', 'Cat', 'color'],
      ['colCatRim', 'Cat outline glow', 'color'],
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
    // trigger panel
    wakeDelayMs: 950, snoozeTravel: 14,
    slapsNeeded: 4, slapGapMs: 0, slapPad: 0,
    fistSwingPx: 21, fistSwingMs: 1300, fistReachPx: 380, fistFadeMs: 2500,
    throwGrabPx: 131, throwDragPx: 112,
    // color panel
    colWall: '#ececec', colSideWall: '#bcbcbc', colFloor: '#d2d2d2', colFloorLine: '#bcbcbc', colBaseboard: '#bdbdbd',
    colPage: '#d6d6d6', colInk: '#222222',
    colHeadboard: '#8c8c8c', colBedBase: '#9c9c9c', colSheet: '#e2e2e2', colPillow: '#f2f2f2',
    colBlanket: '#a9a9a9', colBlanketCheck: '#8f8f8f', colLegs: '#7a7a7a',
    colHair: '#2b2b2b', colSleeve: '#8c8c8c', colSkin: '#d0d0d0', colCuff: '#6f6f6f',
    colStandTop: '#9a9a9a', colStandBody: '#8a8a8a', colDrawer: '#9c9c9c', colKnob: '#d9d9d9',
    colClockBody: '#7a7a7a', colClockFeet: '#d9d9d9', colScreen: '#2b2b2b', colDigits: '#cfcfcf', colBell: '#e2e2e2', colSnooze: '#e2e2e2',
    colCat: '#111111', colCatRim: '#d9d9d9',
  };

  // The motion panel is hidden. Set SHOW_PANEL to true to bring the same panel back
  // (or add ?panel to the page URL to show it for one visit).
  const SHOW_PANEL = false;
  // The trigger and color panels are shown. Set these to false to hide them again.
  const SHOW_TRIGGER_PANEL = true;
  const SHOW_COLOR_PANEL = true;

  const listeners = [];
  App.cfg = { ...DEFAULTS };
  App.config = {
    SCHEMA, TRIGGER_SCHEMA, COLOR_SCHEMA, DEFAULTS, EASE, EASE_LABELS,
    showColorPanel: SHOW_COLOR_PANEL,
    showPanel: SHOW_PANEL || /[?&]panel\b/.test(location.search),
    showTriggerPanel: SHOW_TRIGGER_PANEL,
    ease: name => EASE[App.cfg[name]] || EASE.easeInOut,
    set(key, value) { App.cfg[key] = value; listeners.forEach(fn => fn(key, value)); },
    restore(keys = Object.keys(DEFAULTS)) { keys.forEach(k => App.config.set(k, DEFAULTS[k])); },
    onChange(fn) { listeners.push(fn); },
  };

  // Colors are written straight onto the parts they belong to (inline styles beat the drawing's own
  // fill attributes in every browser and don't depend on a cached stylesheet). The CSS custom
  // properties are set too, so parts drawn later (cracks, floating words) pick up the outline color.
  const ink = () => document.querySelectorAll('#stage [stroke="#222"], #stage [stroke="#222222"]');
  const inkText = () => document.querySelectorAll('#stage text[fill="#222"], #stage text[fill="#1c1c1c"]');
  function applyColor(k, v) {
    if (!k.startsWith('col')) return;
    document.documentElement.style.setProperty('--' + k, v);
    if (k === 'colPage') { document.body.style.background = v; return; }
    if (k === 'colCat') return;                         // the cat is redrawn from App.cfg (js/scene.js)
    if (k === 'colInk') { ink().forEach(n => { n.style.stroke = v; }); inkText().forEach(n => { n.style.fill = v; }); return; }
    if (k === 'colDigits') { const d = document.getElementById('display'); if (d) d.style.fill = v; return; }
    const cls = 'col-' + k[3].toLowerCase() + k.slice(4);
    const prop = k === 'colFloorLine' ? 'stroke' : k === 'colCatRim' ? 'floodColor' : 'fill';
    document.querySelectorAll('.' + cls).forEach(n => { n.style[prop] = v; });
  }
  Object.keys(DEFAULTS).forEach(k => applyColor(k, App.cfg[k]));
  App.config.onChange(applyColor);
})();
