/* Versions: keeps panel edits in this browser (localStorage) so they survive reloads.
   - Auto-save (on/off): the current settings are written as you edit and loaded on the next visit.
   - Versions: snapshots you save by hand, plus automatic ones taken while you edit (at most one a
     minute) and right before any restore, so every restore can be undone.
   Nothing here touches the saved defaults in js/config.js; those change only via Copy settings. */
window.App = window.App || {};
App.versions = (() => {
  const C = App.config, cfg = App.cfg;
  const K_AUTO = 'fmm-autosave', K_CUR = 'fmm-current', K_LIST = 'fmm-versions';
  const MAX_AUTO = 20, MAX_MANUAL = 50, AUTO_EVERY = 60000;
  let ok = true;
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { ok = false; return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_) { ok = false; return false; } };

  let auto = get(K_AUTO, true);
  let list = get(K_LIST, []);
  const listeners = [];
  const changed = () => listeners.forEach(fn => fn());

  // only keep values that still exist and have the right type
  const snapshot = () => { const v = {}; Object.keys(C.DEFAULTS).forEach(k => { v[k] = cfg[k]; }); return v; };
  function apply(values) {
    Object.keys(C.DEFAULTS).forEach(k => {
      if (k in values && typeof values[k] === typeof C.DEFAULTS[k] && values[k] !== cfg[k]) C.set(k, values[k]);
    });
  }
  const differs = v => Object.keys(C.DEFAULTS).some(k => v[k] !== C.DEFAULTS[k]);
  // the auto-saved state keeps only what you changed, so new saved defaults still come through
  const edits = () => { const v = {}; Object.keys(C.DEFAULTS).forEach(k => { if (cfg[k] !== C.DEFAULTS[k]) v[k] = cfg[k]; }); return v; };

  function add(name, kind) {
    list.unshift({ id: Date.now() + '-' + Math.random().toString(36).slice(2, 6), name, kind, t: Date.now(), values: snapshot() });
    const autos = list.filter(v => v.kind !== 'manual'), manual = list.filter(v => v.kind === 'manual');
    const keep = new Set([...autos.slice(0, MAX_AUTO), ...manual.slice(0, MAX_MANUAL)]);
    list = list.filter(v => keep.has(v));
    put(K_LIST, list); changed();
  }

  // on load: bring back the last edits if auto-save is on
  // Not on GitHub Pages: that site always shows the saved defaults (the same for every visitor),
  // so an old auto-save in this browser can't hide newer defaults there.
  if (auto && C.tools) { const cur = get(K_CUR, null); if (cur) apply(cur); }

  // while editing: keep the current state, and take an automatic snapshot at most once a minute
  let saveT = null, lastAuto = 0, applying = false;
  C.onChange(() => {
    if (!auto || applying || !C.tools) return;          // only the panels make edits
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      put(K_CUR, edits());
      if (Date.now() - lastAuto > AUTO_EVERY && differs(cfg)) { lastAuto = Date.now(); add('Auto-save', 'auto'); }
    }, 600);
  });

  return {
    get available() { return ok; },
    get auto() { return auto; },
    setAuto(on) {
      auto = !!on; put(K_AUTO, auto);
      if (auto) put(K_CUR, edits()); else { try { localStorage.removeItem(K_CUR); } catch (_) { /* unavailable */ } }
      changed();
    },
    list: () => list.slice(),
    save(name) { add(name || 'Saved version', 'manual'); if (auto) put(K_CUR, edits()); },
    // restore a version; the current state is kept as a snapshot first so this can be undone
    restore(id, refresh) {
      const v = list.find(x => x.id === id); if (!v) return;
      add('Before restoring “' + v.name + '”', 'auto');
      applying = true; apply(v.values); applying = false;
      if (auto) put(K_CUR, edits());
      if (refresh) refresh();
    },
    beforeReset(label) { add('Before ' + label, 'auto'); },
    remove(id) { list = list.filter(v => v.id !== id); put(K_LIST, list); changed(); },
    onChange(fn) { listeners.push(fn); },
  };
})();
