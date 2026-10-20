(function (root) {
  'use strict';
  // Pure mini-game logic (no DOM). Node-testable.
  function mulberry32(seed) {
    var a = (Number(seed) || 0) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function memoryBoard(pairs, seed) {
    if (typeof pairs !== 'number' || !isFinite(pairs) || pairs < 1) return [];
    pairs = Math.min(Math.floor(pairs), 50);
    var b = [];
    for (var i = 0; i < pairs; i++) b.push(i, i);
    return shuffle(b, mulberry32(seed));
  }
  function memoryMatch(board, a, b) {
    if (!Array.isArray(board) || a === b) return false;
    if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
    if (a < 0 || b < 0 || a >= board.length || b >= board.length) return false;
    return board[a] === board[b];
  }
  function memoryWon(board, matched) {
    if (!Array.isArray(board) || !board.length || !Array.isArray(matched)) return false;
    var seen = {};
    matched.forEach(function (i) { if (Number.isInteger(i) && i >= 0 && i < board.length) seen[i] = true; });
    return Object.keys(seen).length === board.length;
  }

  var WORDS = ['lantern', 'compass', 'harbor', 'thimble', 'quarry', 'saffron', 'meadow', 'cobalt', 'whistle', 'orchard',
    'parchment', 'ladder', 'tinderbox', 'blanket', 'trellis', 'monsoon', 'pendulum', 'chimney', 'driftwood', 'kettle'];

  function scramble(word, seed) {
    if (typeof word !== 'string' || word.length < 2) return typeof word === 'string' ? word : '';
    var letters = word.split(''), distinct = {};
    letters.forEach(function (c) { distinct[c] = true; });
    if (Object.keys(distinct).length < 2) return word;
    var rnd = mulberry32(seed), out = word, tries = 0;
    while (out === word && tries++ < 50) out = shuffle(letters.slice(), rnd).join('');
    if (out === word) out = letters.slice(1).concat(letters[0]).join(''); // rotation
    if (out === word) {
      var s = letters.slice(), i = 1;
      while (i < s.length && s[i] === s[0]) i++;
      var t = s[0]; s[0] = s[i]; s[i] = t; out = s.join('');
    }
    return out;
  }

  function badShape(g) {
    if (!Array.isArray(g) || g.length !== 9) return true;
    for (var r = 0; r < 9; r++) {
      if (!Array.isArray(g[r]) || g[r].length !== 9) return true;
      for (var c = 0; c < 9; c++) { var v = g[r][c]; if (!Number.isInteger(v) || v < 0 || v > 9) return true; }
    }
    return false;
  }
  function sudokuValid(g) {
    if (badShape(g)) return { complete: false, valid: false, conflicts: [] };
    var bad = {}, full = true, r, c, r2, c2;
    for (r = 0; r < 9; r++) for (c = 0; c < 9; c++) {
      var v = g[r][c];
      if (!v) { full = false; continue; }
      for (r2 = 0; r2 < 9; r2++) for (c2 = 0; c2 < 9; c2++) {
        if ((r2 === r && c2 === c) || g[r2][c2] !== v) continue;
        if (r2 === r || c2 === c || (Math.floor(r2 / 3) === Math.floor(r / 3) && Math.floor(c2 / 3) === Math.floor(c / 3))) bad[r * 9 + c] = true;
      }
    }
    var conflicts = Object.keys(bad).map(Number).sort(function (a, b) { return a - b; }).map(function (k) { return [Math.floor(k / 9), k % 9]; });
    return { complete: full && !conflicts.length, valid: !conflicts.length, conflicts: conflicts };
  }

  var SUDOKU = [{"name":"Dawn","puzzle":[[1,6,0,9,4,0,5,0,0],[0,5,0,0,1,6,0,9,0],[4,0,9,0,0,0,6,7,0],[0,0,5,6,0,4,0,0,9],[7,4,0,0,0,8,1,5,0],[9,0,2,5,3,0,4,6,0],[6,9,4,0,2,3,0,0,0],[2,0,0,1,5,7,0,0,0],[0,7,1,0,6,9,0,8,2]],"solution":[[1,6,7,9,4,2,5,3,8],[8,5,3,7,1,6,2,9,4],[4,2,9,3,8,5,6,7,1],[3,1,5,6,7,4,8,2,9],[7,4,6,2,9,8,1,5,3],[9,8,2,5,3,1,4,6,7],[6,9,4,8,2,3,7,1,5],[2,3,8,1,5,7,9,4,6],[5,7,1,4,6,9,3,8,2]]},{"name":"Noon","puzzle":[[0,0,5,0,2,6,1,3,0],[0,8,3,5,0,0,0,0,2],[0,0,9,0,8,0,0,0,4],[5,0,0,0,0,0,3,8,0],[3,7,0,0,6,0,0,2,0],[9,1,2,0,0,0,5,4,0],[0,0,0,1,0,0,8,7,5],[2,0,0,0,0,0,0,6,9],[8,5,7,6,9,0,0,1,0]],"solution":[[7,4,5,9,2,6,1,3,8],[1,8,3,5,4,7,6,9,2],[6,2,9,3,8,1,7,5,4],[5,6,4,2,1,9,3,8,7],[3,7,8,4,6,5,9,2,1],[9,1,2,8,7,3,5,4,6],[4,9,6,1,3,2,8,7,5],[2,3,1,7,5,8,4,6,9],[8,5,7,6,9,4,2,1,3]]},{"name":"Dusk","puzzle":[[5,9,0,2,6,0,0,0,8],[0,8,0,0,4,9,0,0,0],[0,1,0,0,3,0,0,0,0],[6,7,0,0,0,5,1,0,0],[0,0,0,0,0,2,0,0,7],[0,2,1,0,0,0,0,3,5],[0,6,7,0,0,0,0,0,0],[0,3,5,0,2,0,7,1,6],[9,4,0,1,0,0,5,0,3]],"solution":[[5,9,4,2,6,1,3,7,8],[7,8,3,5,4,9,6,2,1],[2,1,6,7,3,8,4,5,9],[6,7,8,3,9,5,1,4,2],[3,5,9,4,1,2,8,6,7],[4,2,1,6,8,7,9,3,5],[1,6,7,8,5,3,2,9,4],[8,3,5,9,2,4,7,1,6],[9,4,2,1,7,6,5,8,3]]}];

  var api = { mulberry32: mulberry32, memoryBoard: memoryBoard, memoryMatch: memoryMatch, memoryWon: memoryWon,
    WORDS: WORDS, scramble: scramble, sudokuValid: sudokuValid, SUDOKU: SUDOKU };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Games = api;
})(typeof window !== 'undefined' ? window : globalThis);
