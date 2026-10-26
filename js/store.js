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
    let st = blank(), lastRaw = null; // lastRaw: what we last read or wrote, so a change made in another tab is noticed
    // Every read and write first re-reads storage if another tab changed it, so tabs never overwrite each other's progress.
    function sync() {
      try {
        const raw = storage ? storage.getItem(KEY) : null;
        if (raw === lastRaw) return;
        lastRaw = raw;
        if (raw) { const loaded = JSON.parse(raw); if (validateData(loaded)) st = fromData(loaded); }
      } catch (e) { /* keep what we have */ }
    }
    sync();
    const save = () => { try { if (storage) { const raw = JSON.stringify(st); storage.setItem(KEY, raw); lastRaw = raw; } } catch (e) { /* memory only */ } };
    return {
      markSolved(id) { sync(); st.solved[id] = Date.now(); save(); },
      solvedAt(id) { sync(); return Object.prototype.hasOwnProperty.call(st.solved, id) ? st.solved[id] : 0; },
      isSolved(id) { sync(); return Object.prototype.hasOwnProperty.call(st.solved, id) && !!st.solved[id]; },
      recordHint(id, tier) { sync(); if (Number.isInteger(tier) && tier >= 1 && tier <= 4 && tier > (st.hints[id] || 0)) { st.hints[id] = tier; save(); } },
      solvedIds() { sync(); return Object.keys(st.solved).filter(k => !!st.solved[k]); },
      hintTier(id) { sync(); return st.hints[id] || 0; },
      setNote(id, t) { sync(); st.notes[id] = String(t); save(); },
      getNote(id) { sync(); return st.notes[id] || ''; },
      exportJSON() { sync(); return JSON.stringify(st, null, 2); },
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
