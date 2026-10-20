/* Control panels: floating, collapsible panels on the left for tuning the prototype live.
   Each builds itself from a schema in js/config.js, writes through App.config.set, and can copy
   every current value (with an instruction to save them as defaults) to the clipboard.
   - Motion panel (durations and easing): hidden; see SHOW_PANEL in js/config.js.
   - Trigger panel (distances, times and counts needed to complete each step): shown; see
     SHOW_TRIGGER_PANEL in js/config.js.
   - Color panel (component colors): shown; see SHOW_COLOR_PANEL in js/config.js.
   Visible panels share one Tools window on the left, a tab each. */
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
  // the window grows with the screen like the room and the bulb do (fixed pixels look tiny on a big monitor)
  function uiScale() {
    const s = Math.max(1, Math.min(1.7, innerHeight / 760, (innerWidth - 24) / 290));
    document.documentElement.style.setProperty('--ui', s.toFixed(3));
  }
  addEventListener('resize', uiScale); uiScale();

  /* ---------- the Tools window: one collapsible window with a tab per panel ---------- */
  const tools = h('aside', { id: 'tools', class: 'tpanel', 'aria-label': 'Modify the prototype' });
  const toolsToggle = h('button', { class: 'panelToggle', type: 'button', 'aria-expanded': 'true', 'aria-controls': 'toolsBody' },
    h('span', { class: 'chev', 'aria-hidden': 'true', text: '‹' }), h('span', { text: 'Modify' }));
  const toolsBody = h('div', { id: 'toolsBody', class: 'panelBody' });
  const tabBar = h('div', { class: 'toolTabs', role: 'tablist', 'aria-label': 'Tool panels' });
  // preview: Start = the sleeping opening; the others replay the lull and jolt into that round
  const jump = h('div', { class: 'jump' }, h('span', { class: 'jumpLabel', text: 'Preview from' }));
  ['Start', 'Snooze', 'Slap', 'Fist', 'Throw'].forEach((name, i) => {
    const b = h('button', { type: 'button', text: name });
    b.addEventListener('click', () => (i === 0 ? App.seq.restart() : App.seq.jumpTo(i - 1)));
    jump.append(b);
  });
  toolsBody.append(tabBar, jump);
  tools.append(toolsToggle, toolsBody);
  const tabs = [];
  function addTab(id, title, label) {
    const pane = h('section', { id, class: 'tpane', role: 'tabpanel', 'aria-label': label, 'aria-labelledby': id + 'Tab' });
    const btn = h('button', { type: 'button', role: 'tab', id: id + 'Tab', 'aria-controls': id, text: title });
    btn.addEventListener('click', () => selectTab(id));
    tabBar.append(btn); toolsBody.append(pane);
    tabs.push({ id, btn, pane });
    return pane;
  }
  function selectTab(id, focus) {
    if (!tabs.some(t => t.id === id)) id = tabs[0].id;
    tabs.forEach(t => {
      const on = t.id === id;
      t.btn.setAttribute('aria-selected', String(on)); t.btn.tabIndex = on ? 0 : -1; t.btn.classList.toggle('on', on);
      t.pane.hidden = !on;
      if (on && focus) t.btn.focus();
    });
    try { localStorage.setItem('fmm-tools-tab', id); } catch (_) { /* storage unavailable */ }
  }
  // arrow keys move between tabs
  tabBar.addEventListener('keydown', e => {
    const i = tabs.findIndex(t => t.btn === document.activeElement);
    if (i < 0) return;
    const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
    if (n == null) return;
    e.preventDefault(); selectTab(tabs[(n + tabs.length) % tabs.length].id, true);
  });
  function setToolsOpen(open) {
    tools.classList.toggle('closed', !open);
    toolsToggle.setAttribute('aria-expanded', String(open));
    try { localStorage.setItem('fmm-tools-open', open ? '1' : '0'); } catch (_) { /* storage unavailable */ }
  }
  toolsToggle.addEventListener('click', () => setToolsOpen(tools.classList.contains('closed')));
  // a pane is on screen when the window is open and its tab is selected
  const shown = pane => !tools.classList.contains('closed') && !pane.hidden;
  // every built panel registers here so a restored version can refresh all controls
  const registry = [];
  const refreshAll = () => registry.forEach(({ keys, inputs, refresh }) => {
    keys.forEach(k => inputs[k] && inputs[k].set(cfg[k]));
    if (refresh) refresh();
  });

  // tiny drawing of an easing curve
  function curvePath(name) {
    const f = C.EASE[name], pts = [];
    for (let i = 0; i <= 40; i++) { const k = i / 40; pts.push(`${(4 + k * 52).toFixed(1)},${(30 - f(k) * 22).toFixed(1)}`); }
    return 'M' + pts.join(' L');
  }

  // one control row for a schema entry: [key, label, kind, ...]
  //   range: min, max, step, unit, hint · color · ease · check · select: [[value, label], ...]
  function controlRow(prefix, [key, text, kind, min, max, step, unit, hint], inputs) {
    const iid = prefix + '-' + key;
    if (kind === 'range') {
      const out = h('output', { for: iid });
      const input = h('input', { type: 'range', id: iid, min, max, step, value: cfg[key] });
      const show = v => { out.textContent = `${fmtVal(v, step)} ${unit}`; };
      input.addEventListener('input', () => { const v = Number(input.value); C.set(key, v); show(v); });
      show(cfg[key]);
      inputs[key] = { set: v => { input.value = v; show(v); } };
      return h('div', { class: 'row' },
        h('label', { for: iid }, h('span', { text }), out),
        input,
        h('small', { text: `${fmtVal(min, step)}–${fmtVal(max, step)} ${unit}${hint ? ' · ' + hint : ''}` }));
    }
    if (kind === 'check') {
      const input = h('input', { type: 'checkbox', id: iid });
      input.checked = !!cfg[key];
      input.addEventListener('change', () => C.set(key, input.checked));
      inputs[key] = { set: v => { input.checked = !!v; } };
      return h('label', { class: 'check', for: iid }, input, h('span', { text }));
    }
    if (kind === 'select') {
      const sel = h('select', { id: iid });
      min.forEach(([v, t]) => sel.append(h('option', { value: v, text: t })));
      sel.value = cfg[key];
      sel.addEventListener('change', () => C.set(key, sel.value));
      inputs[key] = { set: v => { sel.value = v; } };
      return h('div', { class: 'row' }, h('label', { for: iid, text }), sel);
    }
    if (kind === 'color') {
      const input = h('input', { type: 'color', id: iid, value: cfg[key] });
      const out = h('output', { for: iid });
      const show = v => { out.textContent = v; };
      input.addEventListener('input', () => { C.set(key, input.value); show(input.value); });
      show(cfg[key]);
      inputs[key] = { set: v => { input.value = v; show(v); } };
      return h('div', { class: 'colorRow' }, h('label', { for: iid, text }), out, input);
    }
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
    return h('div', { class: 'row ease' }, h('label', { for: iid, text }), h('div', { class: 'easeRow' }, sel, svg));
  }

  function buildPanel({ id, title, label, schema, copyTitle, note, extra, custom }) {
    const panel = addTab(id, title, label), body = panel;

    // actions
    const restoreBtn = h('button', { type: 'button', class: 'act', text: 'Restore defaults' });
    const copyBtn = h('button', { type: 'button', class: 'act primary', text: 'Copy settings' });
    const status = h('p', { class: 'status', 'aria-live': 'polite' });
    body.append(h('div', { class: 'actions' }, restoreBtn, copyBtn), status);
    if (extra) body.append(extra);

    // controls
    const inputs = {}, keys = [];
    // a panel can draw its own controls (the color picker) instead of one row per setting
    let refresh = null;
    if (custom) { schema.forEach(([, rows]) => rows.forEach(([key]) => keys.push(key))); refresh = custom(body, inputs, panel); }
    else schema.forEach(([group, rows], gi) => {
      const det = h('details', gi < 2 ? { open: '' } : {}, h('summary', { text: group }));
      rows.forEach(row => { keys.push(row[0]); det.append(controlRow(id, row, inputs)); });
      body.append(det);
    });
    body.append(h('p', { class: 'note', text: note }));

    registry.push({ keys, inputs, get refresh() { return refresh; }, text: () => settingsText(false) });
    restoreBtn.addEventListener('click', () => {
      if (App.versions) App.versions.beforeReset(`${title} defaults`);   // so this can be undone
      C.restore(keys);
      keys.forEach(k => inputs[k] && inputs[k].set(cfg[k]));
      if (refresh) refresh();
      flash('Defaults restored.');
    });

    function settingsText(withInstruction = true) {
      const lines = [copyTitle, ''];
      schema.forEach(([group, rows]) => {
        lines.push(group);
        rows.forEach(([key, text, kind, opts, , step, unit]) => {
          const v = cfg[key];
          lines.push(kind === 'range' ? `- ${text} (${key}): ${fmtVal(v, step)} ${unit}`
            : kind === 'color' ? `- ${text} (${key}): ${v}`
            : kind === 'check' ? `- ${text} (${key}): ${v ? 'On' : 'Off'}`
            : kind === 'select' ? `- ${text} (${key}): ${(opts.find(o => o[0] === v) || [, v])[1]} (${v})`
            : `- ${text} (${key}): ${C.EASE_LABELS[v]} (${v})`);
        });
        lines.push('');
      });
      if (withInstruction) lines.push(INSTRUCTION);
      return lines.join('\n');
    }
    let flashT = null;
    function flash(msg) { status.textContent = msg; clearTimeout(flashT); flashT = setTimeout(() => { status.textContent = ''; }, 2600); }
    function legacyCopy(text) {
      const ta = h('textarea', { class: 'copyBox', readonly: '' }); ta.value = text;
      status.after(ta);
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
      const on = checkbox.checked && shown(panel) && App.seq.phase === 'round';
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

  /* ---------- versions: auto-save on/off, save by hand, restore past versions ---------- */
  function versionsPanel() {
    const V = App.versions;
    const body = addTab('versionsPanel', 'Versions', 'Saved versions');
    const autoBox = h('input', { type: 'checkbox', id: 'autoSave' });
    autoBox.checked = V.auto;
    autoBox.addEventListener('change', () => { V.setAuto(autoBox.checked); flash(autoBox.checked ? 'Auto-save is on.' : 'Auto-save is off. Use Save version to keep your edits.'); });
    const name = h('input', { type: 'text', class: 'verName', placeholder: 'Name (optional)', maxlength: '40', 'aria-label': 'Version name' });
    const saveBtn = h('button', { type: 'button', class: 'act primary', text: 'Save version' });
    // every panel's values in one go, so they can be sent to Claude to become the saved defaults
    const copyAll = h('button', { type: 'button', class: 'act copyAll', text: 'Copy all settings' });
    copyAll.addEventListener('click', () => {
      body.querySelectorAll('.copyBox').forEach(n => n.remove());
      const text = registry.map(r => r.text()).join('\n') + '\n' + INSTRUCTION;
      const fallback = () => {
        const ta = h('textarea', { class: 'copyBox', readonly: '' }); ta.value = text;
        copyAll.after(ta); ta.select();
        let done = false; try { done = document.execCommand('copy'); } catch (_) { done = false; }
        if (done) { ta.remove(); flash('All settings copied. Paste them to Claude.'); }
        else { status.textContent = 'Copying is blocked here. Select the text above and copy it.'; ta.focus(); ta.select(); }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => flash('All settings copied. Paste them to Claude.'), fallback);
      else fallback();
    });
    const status = h('p', { class: 'status', 'aria-live': 'polite' });
    const ul = h('ul', { class: 'verList' });
    body.append(
      h('label', { class: 'check', for: 'autoSave' }, autoBox, h('span', { text: 'Auto-save my edits in this browser' })),
      h('div', { class: 'verSave' }, name, saveBtn), copyAll, status, ul,
      h('p', { class: 'note', text: V.available
        ? 'Versions are kept in this browser only. Auto-snapshots are taken while you edit (at most one a minute) and before every restore. To make values permanent for everyone, use Copy settings and send it to Claude.'
        : 'This browser is blocking storage here, so versions can\u2019t be kept. Use Copy settings to keep your values.' }));
    let flashT = null;
    function flash(msg) { status.textContent = msg; clearTimeout(flashT); flashT = setTimeout(() => { status.textContent = ''; }, 3000); }
    const when = t => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    function render() {
      ul.textContent = '';
      const items = V.list();
      if (!items.length) { ul.append(h('li', { class: 'empty', text: 'No versions yet.' })); return; }
      items.forEach(v => {
        const restore = h('button', { type: 'button', class: 'act small', text: 'Restore' });
        const del = h('button', { type: 'button', class: 'step del', 'aria-label': 'Delete ' + v.name, title: 'Delete', text: '×' });
        restore.addEventListener('click', () => { V.restore(v.id, refreshAll); flash(`Restored “${v.name}”. The previous state was saved as a version.`); });
        del.addEventListener('click', () => V.remove(v.id));
        ul.append(h('li', { class: v.kind === 'manual' ? 'manual' : 'auto' },
          h('div', { class: 'verInfo' }, h('strong', { text: v.name }), h('small', { text: (v.kind === 'manual' ? '' : 'auto · ') + when(v.t) })),
          restore, del));
      });
    }
    saveBtn.addEventListener('click', () => { V.save(name.value.trim()); name.value = ''; flash('Version saved.'); });
    name.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click(); });
    V.onChange(render); render();
  }

  if (C.showTriggerPanel) {
    const box = h('input', { type: 'checkbox', id: 'showZones', checked: '' });
    const zoneRow = h('label', { class: 'check', for: 'showZones' }, box, h('span', { text: 'Show trigger zones on the stage' }));
    const p = buildPanel({
      id: 'triggerPanel', title: 'Triggers', label: 'Trigger controls',
      schema: C.TRIGGER_SCHEMA, copyTitle: 'Five More Minutes: trigger settings',
      note: 'Changes apply right away to the step in progress. Use Preview from to replay a step.',
      extra: zoneRow,
    });
    zoneOverlay(p, box);
  }
  /* ---------- color picker: choose an item, then pick from the full spectrum ---------- */
  const hexToRgb = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let hh = 0;
    if (d) hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(hh * 60 + 360) % 360, mx ? d / mx : 0, mx];
  }
  function hsvToHex(hh, sat, val) {
    const f = n => { const k = (n + hh / 60) % 6; return val - val * sat * Math.max(0, Math.min(k, 4 - k, 1)); };
    return rgbToHex(f(5) * 255, f(3) * 255, f(1) * 255);
  }
  const SWATCHES = ['#111111', '#222222', '#444444', '#6f6f6f', '#9a9a9a', '#c4c4c4', '#e2e2e2', '#ffffff',
    '#b03030', '#e0663a', '#e8b23a', '#f2e3b3', '#5f9e4a', '#2f7f7a', '#3a6fb0', '#7a4fb0', '#c45a8f', '#7a5230'];

  function spectrumPicker(body, groups, inputs, selectId, onPick) {
    const items = [];
    const sel = h('select', { id: selectId, class: 'colorItem', 'aria-label': 'Item to color' });
    groups.forEach(([group, rows]) => {
      const og = h('optgroup', { label: group });
      rows.forEach(([key, text]) => { og.append(h('option', { value: key, text })); items.push(key); });
      sel.append(og);
    });
    const prev = h('button', { type: 'button', class: 'step', 'aria-label': 'Previous item', text: '‹' });
    const next = h('button', { type: 'button', class: 'step', 'aria-label': 'Next item', text: '›' });
    const sw = h('span', { class: 'itemSwatch', 'aria-hidden': 'true' });

    const sv = h('div', { class: 'svBox', role: 'slider', tabindex: '0', 'aria-label': 'Saturation and brightness' }, h('span', { class: 'knob' }));
    const hue = h('div', { class: 'hueBar', role: 'slider', tabindex: '0', 'aria-label': 'Hue', 'aria-valuemin': '0', 'aria-valuemax': '360' }, h('span', { class: 'knob' }));
    const hex = h('input', { type: 'text', class: 'hexIn', maxlength: '7', spellcheck: 'false', 'aria-label': 'Hex color' });
    const native = h('input', { type: 'color', class: 'nativePick', 'aria-label': 'System color picker' });
    const resetItem = h('button', { type: 'button', class: 'act small', text: 'Item default' });
    const swatches = h('div', { class: 'swatches' });
    SWATCHES.forEach(c => {
      const b = h('button', { type: 'button', class: 'sw', 'aria-label': c, title: c });
      b.style.background = c;
      b.addEventListener('click', () => commit(c, true));
      swatches.append(b);
    });

    body.append(
      h('div', { class: 'itemRow' }, prev, sel, next),
      h('div', { class: 'pickRow' }, sw, hex, native, resetItem),
      sv, hue, swatches);

    let key = items[0], H = 0, Sat = 0, Val = 0;
    function paint() {
      const cur = hsvToHex(H, Sat, Val);
      sv.style.background = `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, ${hsvToHex(H, 1, 1)})`;
      sv.firstChild.style.left = (Sat * 100) + '%'; sv.firstChild.style.top = ((1 - Val) * 100) + '%';
      sv.firstChild.style.background = cur;
      hue.firstChild.style.left = (H / 360 * 100) + '%';
      hue.setAttribute('aria-valuenow', Math.round(H));
      sv.setAttribute('aria-valuetext', `saturation ${Math.round(Sat * 100)}%, brightness ${Math.round(Val * 100)}%`);
    }
    function load(k) {
      key = k; sel.value = k;
      const c = cfg[k], [hh, ss, vv] = rgbToHsv(...hexToRgb(c));
      if (ss > 0.01) H = hh;                         // grays have no hue: keep the last one
      Sat = ss; Val = vv;
      hex.value = c; native.value = c; sw.style.background = c;
      paint();
    }
    function commit(c, reload) {
      C.set(key, c);
      if (onPick) onPick(key);
      hex.value = c; native.value = c; sw.style.background = c;
      if (reload) load(key); else paint();
    }
    const fromHsv = () => commit(hsvToHex(H, Sat, Val));

    function drag(el, onMove) {
      el.addEventListener('pointerdown', e => {
        e.preventDefault(); el.setPointerCapture(e.pointerId); el.focus();
        const move = ev => { const r = el.getBoundingClientRect(); onMove(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height))); };
        move(e);
        const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
        el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      });
    }
    drag(sv, (x, y) => { Sat = x; Val = 1 - y; fromHsv(); });
    drag(hue, x => { H = x * 360; if (Sat < .05) Sat = .6; if (Val < .05) Val = .7; fromHsv(); });
    // keyboard: arrows nudge the square and the hue strip
    sv.addEventListener('keydown', e => {
      const d = e.shiftKey ? .1 : .02;
      if (e.key === 'ArrowLeft') Sat = Math.max(0, Sat - d); else if (e.key === 'ArrowRight') Sat = Math.min(1, Sat + d);
      else if (e.key === 'ArrowUp') Val = Math.min(1, Val + d); else if (e.key === 'ArrowDown') Val = Math.max(0, Val - d); else return;
      e.preventDefault(); fromHsv();
    });
    hue.addEventListener('keydown', e => {
      const d = e.shiftKey ? 30 : 5;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') H = (H - d + 360) % 360; else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') H = (H + d) % 360; else return;
      e.preventDefault(); fromHsv();
    });
    hex.addEventListener('input', () => { const v = hex.value.trim(); if (/^#[0-9a-f]{6}$/i.test(v)) commit(v.toLowerCase(), true); });
    native.addEventListener('input', () => commit(native.value, true));
    sel.addEventListener('change', () => load(sel.value));
    prev.addEventListener('click', () => load(items[(items.indexOf(key) - 1 + items.length) % items.length]));
    next.addEventListener('click', () => load(items[(items.indexOf(key) + 1) % items.length]));
    resetItem.addEventListener('click', () => commit(C.DEFAULTS[key], true));
    // Restore defaults refreshes the picker for whichever item is showing
    items.forEach(k => { inputs[k] = { set: () => { if (k === key) load(k); } }; });
    load(key);
  }
  const colorPicker = (body, inputs) => spectrumPicker(body, C.COLOR_SCHEMA, inputs, 'colorItem');

  /* ---------- window panel: what the window shows, figures, and a tab per time of day ---------- */
  function windowPanel(body, inputs, panel) {
    const [general, ...skies] = C.WINDOW_SCHEMA;
    general[1].forEach(row => body.append(controlRow('win', row, inputs)));
    const tabs = h('div', { class: 'todTabs', role: 'tablist', 'aria-label': 'Time of day to edit' });
    const preview = h('input', { type: 'checkbox', id: 'winPreview', checked: '' });
    const area = h('div', { class: 'todArea' });
    body.append(h('p', { class: 'jumpLabel', text: 'Edit the sky for' }), tabs,
      h('label', { class: 'check', for: 'winPreview' }, preview, h('span', { text: 'Preview this time of day in the window while editing it' })), area);
    const NAMES = { Dawn: 'dawn', Day: 'day', Sunset: 'sunset', Night: 'night' };
    let cur = 'Night';
    const btns = {};
    skies.forEach(([T]) => {
      const b = h('button', { type: 'button', role: 'tab', text: T });
      b.addEventListener('click', () => show(T));
      btns[T] = b; tabs.append(b);
    });
    // section headings inside a tab, by the setting they start at
    const SECTIONS = { Art: 'Sky', Sun: 'Sun', Moon: 'Moon', Stars: 'Stars', Comet: 'Comet', Planets: 'Planets', Clouds: 'Clouds' };
    function show(T) {
      cur = T;
      Object.entries(btns).forEach(([n, b]) => { b.setAttribute('aria-selected', String(n === T)); b.classList.toggle('on', n === T); });
      area.textContent = '';
      const rows = skies.find(([n]) => n === T)[1];
      let det = null;
      rows.filter(r => r[2] !== 'color').forEach(row => {
        const part = row[0].slice(3 + T.length);
        if (SECTIONS[part]) { det = h('details', { open: '' }, h('summary', { text: SECTIONS[part] })); area.append(det); }
        det.append(controlRow('win', row, inputs));
      });
      const colors = rows.filter(r => r[2] === 'color').map(([k, text]) => [k, text]);
      const cdet = h('details', { open: '' }, h('summary', { text: `${T} colors` }));
      area.append(cdet);
      // the study artwork sits on top of the gradient, so picking a sky color turns the artwork off
      spectrumPicker(cdet, [[`${T} colors`, colors]], inputs, 'winColorItem', k => {
        const art = `win${T}Art`;
        if (/(Top|Bottom)$/.test(k) && cfg[art]) { C.set(art, false); if (inputs[art]) inputs[art].set(false); }
      });
    }
    // the scene asks which time of day to preview: only while you're working in the sky editor
    // (pointer over it, or a change in the last 2.5 s); otherwise the story's sky shows
    let hovering = false, lastEdit = -1e9;
    const touch = () => { lastEdit = performance.now(); };
    [tabs, area].forEach(el => {
      el.addEventListener('pointerenter', () => { hovering = true; touch(); });
      el.addEventListener('pointerleave', () => { hovering = false; touch(); });
      ['input', 'change', 'click', 'focusin', 'pointerdown'].forEach(ev => el.addEventListener(ev, touch));
    });
    App.winPreview = () => (preview.checked && shown(panel) &&
      (hovering || performance.now() - lastEdit < 2500) ? NAMES[cur] : null);
    show(cur);
    return () => show(cur);
  }

  if (C.showColorPanel) {
    buildPanel({
      id: 'colorPanel', title: 'Colors', label: 'Color controls',
      schema: C.COLOR_SCHEMA, copyTitle: 'Five More Minutes: color settings',
      custom: colorPicker,
      note: 'Pick an item, then drag in the color square and the rainbow strip. The stage updates as you go. The window frame, the original sky artwork and the ring lines are bitmaps from the studies and keep their own colors.',
    });
  }
  if (C.showWindowPanel) {
    buildPanel({
      id: 'windowPanel', title: 'Window', label: 'Window controls',
      schema: C.WINDOW_SCHEMA, copyTitle: 'Five More Minutes: window settings',
      custom: windowPanel,
      note: 'Pick a time of day, then add or remove the sun, moon, stars, comet, planets and clouds, and set their sizes and colors. Turn off the original artwork for a clean gradient sky.',
    });
  }
  if (C.showPanel) {
    buildPanel({
      id: 'motionPanel', title: 'Motion', label: 'Motion controls',
      schema: C.SCHEMA, copyTitle: 'Five More Minutes: motion settings',
      note: 'Changes apply to the next move. Use Preview from to replay a step.',
    });
  }
  // Versions comes last: it saves and copies what the other tabs set
  if (App.versions && tabs.length) versionsPanel();

  if (tabs.length) {
    dock.append(tools);
    let open = true, tab = tabs[0].id;
    try { open = localStorage.getItem('fmm-tools-open') !== '0'; tab = localStorage.getItem('fmm-tools-tab') || tab; } catch (_) { /* storage unavailable */ }
    selectTab(tab);
    setToolsOpen(open);
  }
})();
