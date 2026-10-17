/* Control panels: floating, collapsible panels on the left for tuning the prototype live.
   Each builds itself from a schema in js/config.js, writes through App.config.set, and can copy
   every current value (with an instruction to save them as defaults) to the clipboard.
   - Motion panel (durations and easing): hidden; see SHOW_PANEL in js/config.js.
   - Trigger panel (distances, times and counts needed to complete each step): shown; see
     SHOW_TRIGGER_PANEL in js/config.js.
   - Color panel (component colors): shown; see SHOW_COLOR_PANEL in js/config.js.
   Visible panels stack in one dock on the left. */
(() => {
  const C = App.config, cfg = App.cfg;
  const INSTRUCTION = 'Apply these values as the prototype’s saved defaults. Retain the panel code for later adjustments. Commit and push the changes.';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const h = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v); });
    kids.forEach(k => k && n.append(k));
    return n;
  };
  const decimals = step => (String(step).split('.')[1] || '').length;
  const fmtVal = (v, step) => Number(v).toFixed(decimals(step));
  const dock = h('div', { id: 'dock' });
  document.body.append(dock);

  // tiny drawing of an easing curve
  function curvePath(name) {
    const f = C.EASE[name], pts = [];
    for (let i = 0; i <= 40; i++) { const k = i / 40; pts.push(`${(4 + k * 52).toFixed(1)},${(30 - f(k) * 22).toFixed(1)}`); }
    return 'M' + pts.join(' L');
  }

  function buildPanel({ id, title, label, schema, copyTitle, note, storageKey, extra }) {
    const panel = h('aside', { id, class: 'tpanel', 'aria-label': label });
    const bodyId = id + 'Body';
    const toggle = h('button', { class: 'panelToggle', type: 'button', 'aria-expanded': 'true', 'aria-controls': bodyId },
      h('span', { class: 'chev', 'aria-hidden': 'true', text: '‹' }), h('span', { text: title }));
    const body = h('div', { id: bodyId, class: 'panelBody' });
    panel.append(toggle, body);

    // actions
    const restoreBtn = h('button', { type: 'button', class: 'act', text: 'Restore defaults' });
    const copyBtn = h('button', { type: 'button', class: 'act primary', text: 'Copy settings' });
    const status = h('p', { class: 'status', 'aria-live': 'polite' });
    body.append(h('div', { class: 'actions' }, restoreBtn, copyBtn), status);

    // preview: Start = the sleeping opening; the others replay the lull and jolt into that round
    const jump = h('div', { class: 'jump' }, h('span', { class: 'jumpLabel', text: 'Preview from' }));
    ['Start', 'Snooze', 'Slap', 'Fist', 'Throw'].forEach((name, i) => {
      const b = h('button', { type: 'button', text: name });
      b.addEventListener('click', () => (i === 0 ? App.seq.restart() : App.seq.jumpTo(i - 1)));
      jump.append(b);
    });
    body.append(jump);
    if (extra) body.append(extra);

    // controls
    const inputs = {}, keys = [];
    schema.forEach(([group, rows], gi) => {
      const det = h('details', gi < 2 ? { open: '' } : {}, h('summary', { text: group }));
      rows.forEach(([key, text, kind, min, max, step, unit, hint]) => {
        keys.push(key);
        const iid = id + '-' + key;
        if (kind === 'range') {
          const out = h('output', { for: iid });
          const input = h('input', { type: 'range', id: iid, min, max, step, value: cfg[key] });
          const show = v => { out.textContent = `${fmtVal(v, step)} ${unit}`; };
          input.addEventListener('input', () => { const v = Number(input.value); C.set(key, v); show(v); });
          show(cfg[key]);
          inputs[key] = { set: v => { input.value = v; show(v); } };
          det.append(h('div', { class: 'row' },
            h('label', { for: iid }, h('span', { text }), out),
            input,
            h('small', { text: `${fmtVal(min, step)}–${fmtVal(max, step)} ${unit}${hint ? ' · ' + hint : ''}` })));
        } else if (kind === 'color') {
          const input = h('input', { type: 'color', id: iid, value: cfg[key] });
          const out = h('output', { for: iid });
          const show = v => { out.textContent = v; };
          input.addEventListener('input', () => { C.set(key, input.value); show(input.value); });
          show(cfg[key]);
          inputs[key] = { set: v => { input.value = v; show(v); } };
          det.append(h('div', { class: 'colorRow' }, h('label', { for: iid, text }), out, input));
        } else {
          const sel = h('select', { id: iid });
          Object.entries(C.EASE_LABELS).forEach(([v, t]) => sel.append(h('option', { value: v, text: t })));
          sel.value = cfg[key];
          const svg = document.createElementNS(SVGNS, 'svg');
          svg.setAttribute('viewBox', '0 0 60 36'); svg.setAttribute('class', 'curve'); svg.setAttribute('aria-hidden', 'true');
          const base = document.createElementNS(SVGNS, 'path'); base.setAttribute('d', 'M4 30 H56 M4 8 H56'); base.setAttribute('class', 'guide');
          const path = document.createElementNS(SVGNS, 'path');
          svg.append(base, path);
          const show = v => path.setAttribute('d', curvePath(v));
          sel.addEventListener('change', () => { C.set(key, sel.value); show(sel.value); });
          show(cfg[key]);
          inputs[key] = { set: v => { sel.value = v; show(v); } };
          det.append(h('div', { class: 'row ease' }, h('label', { for: iid, text }), h('div', { class: 'easeRow' }, sel, svg)));
        }
      });
      body.append(det);
    });
    body.append(h('p', { class: 'note', text: note }));
    dock.append(panel);

    // collapse / expand (remembered per viewer when storage is available)
    function setOpen(open) {
      panel.classList.toggle('closed', !open);
      toggle.setAttribute('aria-expanded', String(open));
      try { localStorage.setItem(storageKey, open ? '1' : '0'); } catch (_) { /* storage unavailable */ }
    }
    toggle.addEventListener('click', () => setOpen(panel.classList.contains('closed')));
    let startOpen = true;
    try { startOpen = localStorage.getItem(storageKey) !== '0'; } catch (_) { /* storage unavailable */ }
    setOpen(startOpen);

    restoreBtn.addEventListener('click', () => {
      C.restore(keys);
      keys.forEach(k => inputs[k].set(cfg[k]));
      flash('Defaults restored.');
    });

    function settingsText() {
      const lines = [copyTitle, ''];
      schema.forEach(([group, rows]) => {
        lines.push(group);
        rows.forEach(([key, text, kind, , , step, unit]) => {
          const v = cfg[key];
          lines.push(kind === 'range' ? `- ${text} (${key}): ${fmtVal(v, step)} ${unit}`
            : kind === 'color' ? `- ${text} (${key}): ${v}`
            : `- ${text} (${key}): ${C.EASE_LABELS[v]} (${v})`);
        });
        lines.push('');
      });
      lines.push(INSTRUCTION);
      return lines.join('\n');
    }
    let flashT = null;
    function flash(msg) { status.textContent = msg; clearTimeout(flashT); flashT = setTimeout(() => { status.textContent = ''; }, 2600); }
    function legacyCopy(text) {
      const ta = h('textarea', { class: 'copyBox', readonly: '' }); ta.value = text;
      body.insertBefore(ta, jump);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      if (ok) { ta.remove(); flash('Settings copied.'); }
      else { status.textContent = 'Copying is blocked here. Select the text above and copy it.'; ta.focus(); ta.select(); }
    }
    copyBtn.addEventListener('click', () => {
      body.querySelectorAll('.copyBox').forEach(n => n.remove());
      const text = settingsText();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => flash('Settings copied.'), () => legacyCopy(text));
      } else legacyCopy(text);
    });
    return panel;
  }

  /* ---------- trigger zones: dashed outlines of the current step's hit areas ---------- */
  function zoneOverlay(panel, checkbox) {
    const S = App.scene, W = S.W;
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('id', 'zones'); g.setAttribute('pointer-events', 'none');
    S.el.cam.appendChild(g);
    const shape = (tag, attrs) => {
      const n = document.createElementNS(SVGNS, tag);
      Object.entries({ fill: 'none', stroke: '#222', 'stroke-width': 3, 'stroke-dasharray': '10 7', 'vector-effect': 'non-scaling-stroke', ...attrs })
        .forEach(([k, v]) => n.setAttribute(k, v));
      g.appendChild(n); return n;
    };
    const rect = shape('rect', {});
    const circle = shape('circle', {});
    const swing = shape('path', { 'stroke-dasharray': 'none', 'stroke-width': 4 });
    const tag = document.createElementNS(SVGNS, 'text');
    tag.setAttribute('font-size', 20); tag.setAttribute('font-family', 'ui-monospace, Menlo, monospace'); tag.setAttribute('fill', '#222');
    g.appendChild(tag);
    const show = (n, on) => n.setAttribute('display', on ? '' : 'none');
    function frame() {
      const on = checkbox.checked && !panel.classList.contains('closed') && App.seq.phase === 'round';
      show(g, on);
      if (on) {
        const r = App.seq.round;
        [rect, circle, swing, tag].forEach(n => show(n, false));
        if (r === 0 || r === 1) {
          const pad = r === 1 ? cfg.slapPad : 0;
          Object.entries({ x: 590 - pad, y: 330 - pad, width: 260 + pad * 2, height: 282 + pad * 2, rx: 14 }).forEach(([k, v]) => rect.setAttribute(k, v));
          show(rect, true);
          tag.textContent = r === 0 ? 'press here' : 'slap zone'; tag.setAttribute('x', 596 - pad); tag.setAttribute('y', 322 - pad); show(tag, true);
        } else if (r === 2) {
          circle.setAttribute('cx', S.HOME.x); circle.setAttribute('cy', S.HOME.y - 80); circle.setAttribute('r', cfg.fistReachPx); show(circle, true);
          const y = W.hand.y - 70;
          swing.setAttribute('d', `M${W.hand.x - cfg.fistSwingPx / 2} ${y} h${cfg.fistSwingPx} M${W.hand.x - cfg.fistSwingPx / 2} ${y - 8} v16 M${W.hand.x + cfg.fistSwingPx / 2} ${y - 8} v16`);
          show(swing, true);
          tag.textContent = 'min swing'; tag.setAttribute('x', W.hand.x - 48); tag.setAttribute('y', y - 14); show(tag, true);
        } else if (r === 3) {
          const c = S.pivotToCenter(W.clock);
          circle.setAttribute('cx', c.x); circle.setAttribute('cy', c.y - 10 * S.U); circle.setAttribute('r', cfg.throwGrabPx); show(circle, true);
          tag.textContent = 'grab zone'; tag.setAttribute('x', c.x - 50); tag.setAttribute('y', c.y - 10 * S.U - cfg.throwGrabPx - 10); show(tag, true);
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (C.showTriggerPanel) {
    const box = h('input', { type: 'checkbox', id: 'showZones', checked: '' });
    const zoneRow = h('label', { class: 'check', for: 'showZones' }, box, h('span', { text: 'Show trigger zones on the stage' }));
    const p = buildPanel({
      id: 'triggerPanel', title: 'Triggers', label: 'Trigger controls',
      schema: C.TRIGGER_SCHEMA, copyTitle: 'Five More Minutes: trigger settings', storageKey: 'fmm-trigger-panel-open',
      note: 'Changes apply right away to the step in progress. Use Preview from to replay a step.',
      extra: zoneRow,
    });
    zoneOverlay(p, box);
  }
  if (C.showColorPanel) {
    buildPanel({
      id: 'colorPanel', title: 'Colors', label: 'Color controls',
      schema: C.COLOR_SCHEMA, copyTitle: 'Five More Minutes: color settings', storageKey: 'fmm-color-panel-open',
      note: 'Colors change on the stage as you pick them. The rooster, neighbor, window frame, skies and ring lines are drawings from the studies and keep their own colors.',
    });
  }
  if (C.showPanel) {
    buildPanel({
      id: 'motionPanel', title: 'Motion', label: 'Motion controls',
      schema: C.SCHEMA, copyTitle: 'Five More Minutes: motion settings', storageKey: 'fmm-panel-open',
      note: 'Changes apply to the next move. Use Preview from to replay a step.',
    });
  }
})();
