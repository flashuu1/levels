(function (root) {
  const KEY = 'levels.v1';
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const blank = () => ({ solved: Object.create(null), hints: Object.create(null), notes: Object.create(null) });
  const validateData = (data) => {
    if (!isObj(data) || !isObj(data.solved) || !isObj(data.hints) || !isObj(data.notes)) return false;
    for (const k in data.solved) if (typeof data.solved[k] !== 'number') return false;
    for (const k in data.hints) { const v = data.hints[k]; if (!Number.isInteger(v) || v < 0 || v > 4) return false; }
    for (const k in data.notes) if (typeof data.notes[k] !== 'string') return false;
    if (data.mine !== undefined && !isObj(data.mine)) return false; // legacy key from an older export: accepted, then discarded
    return true;
  };
  // Fresh null-prototype state from validated data (a legacy `mine` key is never copied).
  const fromData = (d) => {
    const o = blank();
    Object.assign(o.solved, d.solved); Object.assign(o.hints, d.hints); Object.assign(o.notes, d.notes);
    return o;
  };
  function create(storage) {
    let st = blank();
    try { const raw = storage && storage.getItem(KEY); if (raw) { const loaded = JSON.parse(raw); if (validateData(loaded)) st = fromData(loaded); } } catch (e) { st = blank(); }
    const save = () => { try { storage && storage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* memory only */ } };
    return {
      markSolved(id) { st.solved[id] = Date.now(); save(); },
      isSolved(id) { return Object.prototype.hasOwnProperty.call(st.solved, id) && !!st.solved[id]; },
      recordHint(id, tier) { if (Number.isInteger(tier) && tier >= 1 && tier <= 4 && tier > (st.hints[id] || 0)) { st.hints[id] = tier; save(); } },
      solvedIds() { return Object.keys(st.solved).filter(k => !!st.solved[k]); },
      hintTier(id) { return st.hints[id] || 0; },
      setNote(id, t) { st.notes[id] = String(t); save(); },
      getNote(id) { return st.notes[id] || ''; },
      exportJSON() { return JSON.stringify(st, null, 2); },
      importJSON(str) {
        let o; try { o = JSON.parse(str); } catch (e) { return { ok: false, error: 'Not valid JSON' }; }
        if (!validateData(o)) return { ok: false, error: 'Not a LEVELS progress file' };
        st = fromData(o); save(); return { ok: true };
      }
    };
  }
  const api = { create };
  if (typeof module !== 'undefined') module.exports = api; else root.Store = api;
})(typeof window !== 'undefined' ? window : globalThis);
