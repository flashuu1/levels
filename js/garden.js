(function (root) {
  'use strict';
  // The walled garden plan (second story): twelve columns, six beds to each. Tap a bed to dig. Where something is buried, a sealed
  // record opens; everywhere else it is just soil. Nothing on the map says where to dig: the register and the names do.
  var COLS = 'ABCDEFGHIJKL'.split(''), ROWS = [1, 2, 3, 4, 5, 6];
  function create(env) {
    var el = env.el, store = env.store, Seal = env.Seal;
    function ch() { return env.channel('garden'); }
    function dugCells() { var s = store.getNote('garden:turned'); return s ? s.split(',') : []; }
    function view() {
      env.visit('garden'); env.head('The walled garden', '#/', 'Start');
      var box = el('div', 'garden'), grid = el('div', 'garden-grid'), msg = el('p', 'gh-msg'), finds = el('div', 'garden-finds');
      msg.setAttribute('aria-live', 'polite');
      box.appendChild(el('p', 'mute', 'The old plan of the walled garden. Columns A to L, beds 1 to 6.'));
      grid.appendChild(el('span', 'g-corner'));
      COLS.forEach(function (c) { grid.appendChild(el('span', 'g-head', c)); });
      var cells = {};
      ROWS.forEach(function (r) {
        grid.appendChild(el('span', 'g-head side', String(r)));
        COLS.forEach(function (c) {
          var id = c + r, b = el('button', 'g-cell'); b.type = 'button'; b.setAttribute('aria-label', 'Bed ' + id); b.appendChild(el('span', 'g-tree', '❀')); b.appendChild(el('span', 'g-id', id));
          b.onclick = function () { dig(id); }; cells[id] = b; grid.appendChild(b);
        });
      });
      function turned(id) { cells[id].classList.add('turned'); var d = dugCells(); if (d.indexOf(id) === -1) { d.push(id); store.setNote('garden:turned', d.join(',')); } }
      function drawFinds() {
        finds.textContent = '';
        env.found().filter(function (r) { return (/^dig-/.test(r.id) || r.id === 'warm-bed'); }).forEach(function (r) {
          var card = el('div', 'garden-find'); card.appendChild(el('h3', '', r.title)); r.lines.forEach(function (l) { card.appendChild(el('p', 'vm-line', l)); }); finds.appendChild(card);
        });
      }
      function dig(id) {
        var code = 'dig ' + id.toLowerCase(), r = Seal.tryOpen(ch(), code);
        turned(id);
        if (!r) { msg.className = 'gh-msg'; msg.textContent = 'Bed ' + id + ': just soil.'; return; }
        env.remember(r.payload, code); msg.className = 'gh-msg good'; msg.textContent = 'Bed ' + id + ': something hard under the spade.'; cells[id].classList.add('found'); drawFinds();
      }
      dugCells().forEach(function (id) { if (cells[id]) cells[id].classList.add('turned'); });
      env.found().filter(function (r) { return (/^dig-/.test(r.id) || r.id === 'warm-bed'); }).forEach(function (r) { var code = store.getNote('seal:' + r.id) || '', id = code.replace('dig ', '').toUpperCase(); if (cells[id]) cells[id].classList.add('found'); });
      // new and unannounced: after Dov's voicemail, one bed on the plan is warm to the touch
      var dl = env.found().filter(function (r) { return r.id === 'dov-line' && r.warm; })[0];
      if (dl && cells[String(dl.warm).toUpperCase()]) { cells[String(dl.warm).toUpperCase()].classList.add('warm'); cells[String(dl.warm).toUpperCase()].setAttribute('title', 'warm'); }
      box.appendChild(grid); box.appendChild(msg); box.appendChild(finds); env.view.appendChild(box); drawFinds();
    }
    return { view: view };
  }
  var api = { create: create, COLS: COLS, ROWS: ROWS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Garden = api;
})(typeof window !== 'undefined' ? window : globalThis);
