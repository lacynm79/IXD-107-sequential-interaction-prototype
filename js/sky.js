/* Window skies: draws each time of day's layer from the Window panel settings in js/config.js —
   gradient, the study's own artwork (on by default), and optional sun, moon, stars, comet, planets
   and clouds. Redraws whenever a win* setting changes. Pane units: 311 x 269. */
window.App = window.App || {};
App.sky = (() => {
  const cfg = App.cfg, PW = 311, PH = 269;
  const layers = {};
  document.querySelectorAll('#window [data-tod]').forEach(g => {
    const T = g.dataset.tod;
    layers[T] = { art: g.querySelector('.art'), cel: g.querySelector('.cel'),
      top: document.querySelector(`#skyGrad${T} .top`), bottom: document.querySelector(`#skyGrad${T} .bottom`) };
  });

  // small seeded random so stars and the like stay put between redraws
  const rng = seed => () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const f1 = n => n.toFixed(1);

  const CLOUD = 'M14 34 q4 -12 16 -9 q6 -10 18 -4 q12 -2 12 10 q6 4 0 9 h-42 q-8 -1 -4 -6 z';
  const CLOUD_AT = [[.04, .06], [.5, .4], [.1, .4], [.6, .62]];
  const PLANET_AT = [[.3, .26, 10], [.9, .1, 6], [.62, .5, 4.5]];

  function draw(T) {
    const L = layers[T]; if (!L) return;
    const c = k => cfg[`win${T}${k}`];
    L.top.setAttribute('stop-color', c('Top'));
    L.bottom.setAttribute('stop-color', c('Bottom'));
    L.art.style.display = c('Art') ? '' : 'none';
    let s = '';
    // stars
    const rs = rng(T.length * 977 + 13);
    for (let i = 0; i < c('Stars'); i++) {
      const x = rs() * PW, y = rs() * PH * .8, r = (.6 + rs() * 1.1) * c('StarSize');
      const tw = i % 3 === 0 ? ` class="twk" style="animation-delay:${f1(rs() * 3)}s"` : '';
      s += `<circle${tw} cx="${f1(x)}" cy="${f1(y)}" r="${r.toFixed(2)}" fill="${c('StarColor')}"/>`;
    }
    // planets (the first has rings)
    for (let i = 0; i < c('Planets'); i++) {
      const [px, py, pr] = PLANET_AT[i], r = pr * c('PlanetSize'), x = px * PW, y = py * PH, col = c('PlanetColor');
      if (i === 0) s += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(r * 1.95)}" ry="${f1(r * .55)}" transform="rotate(-18 ${f1(x)} ${f1(y)})" fill="none" stroke="${col}" stroke-width="${f1(Math.max(1.2, r * .22))}" opacity=".9"/>`;
      s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${col}" stroke="#222" stroke-width="1.5"/>`;
      if (i === 0) s += `<path d="M${f1(x - r * 1.95)} ${f1(y)} A${f1(r * 1.95)} ${f1(r * .55)} 0 0 0 ${f1(x + r * 1.95)} ${f1(y)}" transform="rotate(-18 ${f1(x)} ${f1(y)})" fill="none" stroke="${col}" stroke-width="${f1(Math.max(1.2, r * .22))}"/>`;
    }
    // moon
    if (c('Moon')) {
      const r = c('MoonSize'), x = c('MoonX') / 100 * PW, y = c('MoonY') / 100 * PH, ph = c('MoonPhase'), id = `moonMask${T}`;
      s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r * 1.45)}" fill="${c('MoonColor')}" opacity=".12"/>`;
      if (ph !== 'full') {
        const cut = ph === 'half' ? `<rect x="${f1(x - r - 2)}" y="${f1(y - r - 2)}" width="${f1(r + 2)}" height="${f1(r * 2 + 4)}" fill="#000"/>`
          : `<circle cx="${f1(x - r * .5)}" cy="${f1(y - r * .15)}" r="${f1(r * .92)}" fill="#000"/>`;
        s += `<mask id="${id}"><rect width="${PW}" height="${PH}" fill="#fff"/>${cut}</mask>`;
      }
      s += `<g${ph !== 'full' ? ` mask="url(#${id})"` : ''}><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${c('MoonColor')}" stroke="#b5b5b5" stroke-width="2"/>` +
        `<circle cx="${f1(x - r * .3)}" cy="${f1(y - r * .2)}" r="${f1(r * .16)}" fill="#000" opacity=".12"/>` +
        `<circle cx="${f1(x + r * .3)}" cy="${f1(y + r * .32)}" r="${f1(r * .12)}" fill="#000" opacity=".12"/></g>`;
    }
    // sun, with rays
    if (c('Sun')) {
      const r = c('SunSize'), x = c('SunX') / 100 * PW, y = c('SunY') / 100 * PH, col = c('SunColor');
      let rays = '';
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2, r0 = r + 4 + r * .1, r1 = r + 9 + r * .35;
        rays += `M${f1(x + Math.cos(a) * r0)} ${f1(y + Math.sin(a) * r0)}L${f1(x + Math.cos(a) * r1)} ${f1(y + Math.sin(a) * r1)}`;
      }
      s += `<path d="${rays}" stroke="${col}" stroke-width="${f1(Math.max(2, r * .14))}" stroke-linecap="round" opacity=".85"/>`;
      s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${col}" stroke="#222" stroke-width="2.5"/>`;
    }
    // comet: streaks across now and then
    if (c('Comet')) {
      const k = c('CometSize'), col = c('CometColor');
      s += `<g class="comet"><g transform="scale(${k.toFixed(2)})">` +
        `<path d="M0 -3 L-58 -20 L-54 -13 L0 3 Z" fill="${col}" opacity=".5"/>` +
        `<path d="M0 -1.5 L-34 -11 L-32 -7 L0 1.5 Z" fill="${col}" opacity=".8"/>` +
        `<circle r="3.6" fill="${col}"/></g></g>`;
    }
    // clouds in front
    for (let i = 0; i < c('Clouds'); i++) {
      const [cx, cy] = CLOUD_AT[i], k = 1.5 * c('CloudSize');
      s += `<path d="${CLOUD}" transform="translate(${f1(cx * PW)} ${f1(cy * PH)}) scale(${k.toFixed(2)})" fill="${c('CloudColor')}" stroke="#222" stroke-width="${(3 / k).toFixed(2)}" stroke-linejoin="round"/>`;
    }
    L.cel.innerHTML = s;
  }

  const drawAll = () => App.config.TODS.forEach(([T]) => draw(T));
  let queued = null;
  App.config.onChange(k => {
    if (!k.startsWith('win')) return;
    if (!queued) queued = requestAnimationFrame(() => { queued = null; drawAll(); });
  });
  drawAll();
  return { draw, drawAll };
})();
