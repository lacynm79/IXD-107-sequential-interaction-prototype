/* Control panel: a floating, collapsible panel on the left for tuning motion live.
   Builds itself from App.config.SCHEMA, writes through App.config.set, and can copy every
   current value (with an instruction to save them as defaults) to the clipboard. */
(() => {
  if (!App.config.showPanel) return;                  // hidden; see SHOW_PANEL in js/config.js
  const C = App.config, cfg = App.cfg;
  const INSTRUCTION = 'Apply these values as the prototype’s saved defaults. Retain the panel code for later adjustments. Commit and push the changes.';
  const h = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v); });
    kids.forEach(k => k && n.append(k));
    return n;
  };
  const decimals = step => (String(step).split('.')[1] || '').length;
  const fmtVal = (v, step) => Number(v).toFixed(decimals(step));

  // tiny drawing of an easing curve
  function curvePath(name) {
    const f = C.EASE[name], pts = [];
    for (let i = 0; i <= 40; i++) { const k = i / 40; pts.push(`${(4 + k * 52).toFixed(1)},${(30 - f(k) * 22).toFixed(1)}`); }
    return 'M' + pts.join(' L');
  }

  const panel = h('aside', { id: 'panel', 'aria-label': 'Motion controls' });
  const toggle = h('button', { id: 'panelToggle', type: 'button', 'aria-expanded': 'true', 'aria-controls': 'panelBody' },
    h('span', { class: 'chev', 'aria-hidden': 'true', text: '‹' }), h('span', { text: 'Controls' }));
  const body = h('div', { id: 'panelBody' });
  panel.append(toggle, body);

  // actions
  const restoreBtn = h('button', { type: 'button', class: 'act', text: 'Restore defaults' });
  const copyBtn = h('button', { type: 'button', class: 'act primary', text: 'Copy settings' });
  const status = h('p', { class: 'status', 'aria-live': 'polite' });
  body.append(h('div', { class: 'actions' }, restoreBtn, copyBtn), status);

  // preview: jump to any step
  const jump = h('div', { class: 'jump' }, h('span', { class: 'jumpLabel', text: 'Preview from' }));
  // Start = the sleeping opening; the others replay the lull and jolt into that round
  ['Start', 'Snooze', 'Slap', 'Fist', 'Throw'].forEach((name, i) => {
    const b = h('button', { type: 'button', text: name });
    b.addEventListener('click', () => (i === 0 ? App.seq.restart() : App.seq.jumpTo(i - 1)));
    jump.append(b);
  });
  body.append(jump);

  // controls
  const inputs = {};
  C.SCHEMA.forEach(([group, rows], gi) => {
    const det = h('details', gi < 2 ? { open: '' } : {}, h('summary', { text: group }));
    rows.forEach(([key, label, kind, min, max, step, unit, note]) => {
      const id = 'cfg-' + key;
      if (kind === 'range') {
        const out = h('output', { for: id });
        const input = h('input', { type: 'range', id, min, max, step, value: cfg[key] });
        const show = v => { out.textContent = `${fmtVal(v, step)} ${unit}`; };
        input.addEventListener('input', () => { const v = Number(input.value); C.set(key, v); show(v); });
        show(cfg[key]);
        inputs[key] = { set: v => { input.value = v; show(v); } };
        det.append(h('div', { class: 'row' },
          h('label', { for: id }, h('span', { text: label }), out),
          input,
          h('small', { text: `${fmtVal(min, step)}–${fmtVal(max, step)} ${unit}${note ? ' · ' + note : ''}` })));
      } else {
        const sel = h('select', { id });
        Object.entries(C.EASE_LABELS).forEach(([v, t]) => sel.append(h('option', { value: v, text: t })));
        sel.value = cfg[key];
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 60 36'); svg.setAttribute('class', 'curve'); svg.setAttribute('aria-hidden', 'true');
        const base = document.createElementNS(svg.namespaceURI, 'path'); base.setAttribute('d', 'M4 30 H56 M4 8 H56'); base.setAttribute('class', 'guide');
        const path = document.createElementNS(svg.namespaceURI, 'path');
        svg.append(base, path);
        const show = v => path.setAttribute('d', curvePath(v));
        sel.addEventListener('change', () => { C.set(key, sel.value); show(sel.value); });
        show(cfg[key]);
        inputs[key] = { set: v => { sel.value = v; show(v); } };
        det.append(h('div', { class: 'row ease' }, h('label', { for: id, text: label }), h('div', { class: 'easeRow' }, sel, svg)));
      }
    });
    body.append(det);
  });
  body.append(h('p', { class: 'note', text: 'Changes apply to the next move. Use Preview from to replay a step.' }));
  document.body.append(panel);

  // collapse / expand (remembered per viewer when storage is available)
  function setOpen(open) {
    panel.classList.toggle('closed', !open);
    toggle.setAttribute('aria-expanded', String(open));
    try { localStorage.setItem('fmm-panel-open', open ? '1' : '0'); } catch (_) { /* storage unavailable */ }
  }
  toggle.addEventListener('click', () => setOpen(panel.classList.contains('closed')));
  let startOpen = true;
  try { startOpen = localStorage.getItem('fmm-panel-open') !== '0'; } catch (_) { /* storage unavailable */ }
  setOpen(startOpen);

  restoreBtn.addEventListener('click', () => {
    C.restore();
    Object.keys(inputs).forEach(k => inputs[k].set(cfg[k]));
    flash('Defaults restored.');
  });

  function settingsText() {
    const lines = ['Five More Minutes: control panel settings', ''];
    C.SCHEMA.forEach(([group, rows]) => {
      lines.push(group);
      rows.forEach(([key, label, kind, , , step, unit]) => {
        const v = cfg[key];
        lines.push(kind === 'range' ? `- ${label} (${key}): ${fmtVal(v, step)} ${unit}` : `- ${label} (${key}): ${C.EASE_LABELS[v]} (${v})`);
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
})();
