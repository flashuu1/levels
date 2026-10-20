(function (root) {
  'use strict';
  // Pure hidden-layer rules (no DOM). Node-testable.
  var A = (typeof module !== 'undefined' && module.exports) ? require('./answer.js') : root.Answer;

  function countPrefix(store, prefix) {
    var ids = store && typeof store.solvedIds === 'function' ? store.solvedIds() : null;
    if (!Array.isArray(ids)) return 0;
    return ids.filter(function (id) { return String(id).indexOf(prefix) === 0 && store.isSolved(id); }).length;
  }

  function isUnlocked(page, store) {
    if (!page || typeof page !== 'object' || !store || typeof store.isSolved !== 'function') return false;
    var u = page.unlock;
    if (u === undefined || u === null) return true;
    if (typeof u !== 'object') return false;
    if (u.solved !== undefined && u.solved !== null) {
      if (!Array.isArray(u.solved)) return false;
      for (var i = 0; i < u.solved.length; i++) if (!store.isSolved(u.solved[i])) return false;
    }
    if (u.minSolved !== undefined && u.minSolved !== null) {
      var m = u.minSolved;
      if (typeof m !== 'object' || typeof m.prefix !== 'string' || typeof m.n !== 'number' || !isFinite(m.n)) return false;
      if (countPrefix(store, m.prefix) < m.n) return false;
    }
    return true;
  }
  function visiblePages(pages, store) {
    return Array.isArray(pages) ? pages.filter(function (p) { return isUnlocked(p, store); }) : [];
  }
  function lockedCount(pages, store) {
    return Array.isArray(pages) ? pages.length - visiblePages(pages, store).length : 0;
  }
  function checkCode(line, input) {
    if (!line || typeof line.salt !== 'string' || typeof line.codeHash !== 'string' || !line.codeHash) return false;
    if (typeof input !== 'string' || !A.normalize(input)) return false;
    return A.hashAnswer(line.salt, input) === line.codeHash;
  }
  function findLine(lines, input) {
    if (!Array.isArray(lines)) return null;
    for (var i = 0; i < lines.length; i++) if (checkCode(lines[i], input)) return lines[i];
    return null;
  }

  var api = { isUnlocked: isUnlocked, visiblePages: visiblePages, lockedCount: lockedCount, checkCode: checkCode, findLine: findLine };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Hidden = api;
})(typeof window !== 'undefined' ? window : globalThis);
