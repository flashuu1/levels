(function (root) {
  'use strict';
  // Game Room grid, filter chips, search and progress summary. Pure helpers are unit-tested in Node;
  // mount() is the DOM glue (browser only). Loaded before views2.js/app.js, which degrade gracefully without it.
  var FILTERS = [['all', 'All'], ['unsolved', 'Unsolved'], ['solved', 'Solved'], ['missing', 'Missing']];
  var AREA_LABEL = { card: 'Card', door: 'Door' };

  function hasAnswers(l) { return !!l && Array.isArray(l.answers) && l.answers.length > 0; }

  // missing | solved | partial | replacement | open
  function statusOf(level, store) {
    if (!level) return 'missing';
    if (hasAnswers(level) && store.isSolved(level.id)) return 'solved';
    if (level.origin === 'partial' && !hasAnswers(level)) return 'partial';
    if (level.origin === 'replacement') return 'replacement';
    return 'open';
  }

  function buildTiles(area, count, byId, store) {
    var out = [];
    for (var n = 1; n <= count; n++) {
      var id = area + '-' + n, l = byId[id] || null;
      out.push({ id: id, n: n, area: area, level: l, title: l ? String(l.title || '') : '', status: statusOf(l, store) });
    }
    return out;
  }

  function matchesFilter(status, filter) {
    if (filter === 'unsolved') return status !== 'solved' && status !== 'missing';
    if (filter === 'solved' || filter === 'missing') return status === filter;
    return true;
  }

  // A purely numeric query ("12", "#12", "card 12") matches the card/door number exactly; anything else is a
  // case-insensitive substring match on the title (missing tiles have no title).
  function filterTiles(tiles, filter, query) {
    var q = String(query == null ? '' : query).trim().toLowerCase();
    var nm = /^(?:#|card\b)\s*#?\s*(\d+)$/.exec(q) || /^(\d+)$/.exec(q), num = nm ? Number(nm[1]) : null;
    return tiles.filter(function (t) {
      if (!matchesFilter(t.status, filter)) return false;
      if (!q) return true;
      if (num !== null) return t.n === num;
      return t.status !== 'missing' && String(t.title).toLowerCase().indexOf(q) !== -1;
    });
  }

  function counts(tiles) {
    var c = { all: tiles.length, unsolved: 0, solved: 0, missing: 0 };
    tiles.forEach(function (t) { FILTERS.forEach(function (f) { if (f[0] !== 'all' && matchesFilter(t.status, f[0])) c[f[0]]++; }); });
    return c;
  }

    // levels -> {text, pct}; pct is the solved percentage of checkable levels (0 when none are checkable).
  function progressText(levels, isSolved) {
    if (!levels.length) return { text: 'No levels loaded', pct: 0 };
    var withA = levels.filter(hasAnswers), waiting = levels.length - withA.length;
    var solved = withA.filter(function (l) { return isSolved(l.id); }).length;
    var parts = [withA.length ? 'Solved ' + solved + ' / ' + withA.length + ' checkable' : 'No levels are checkable yet'];
    if (waiting > 0) parts.push(waiting + ' awaiting ' + (waiting === 1 ? 'answer' : 'answers'));
    return { text: parts.join(' · '), pct: withA.length ? Math.round(100 * solved / withA.length) : 0 };
  }

  var MARKS = {
    solved: ['mark ok', '✓', 'Solved (verified)'],
    partial: ['mark part', '◐', 'Restored, no answer yet']
  };

  // Shared tile markup for Game Room and Hallway (open/present levels and missing ones).
  function tileHtml(t, esc, badge) {
    var label = (AREA_LABEL[t.area] || 'Level') + ' ' + t.n;
    if (!t.level) return '<span class="tile locked st-missing" title="Not recovered"><span class="tnum">' + esc(label) + '</span><small>Not recovered</small></span>';
    var m = MARKS[t.status], mark = m ? '<span class="' + m[0] + '" role="img" title="' + esc(m[2]) + '" aria-label="' + esc(m[2]) + '">' + m[1] + '</span> ' : '';
    var cls = 'tile' + (t.next ? ' next' : '') + ' st-' + t.status + (t.status === 'solved' ? ' solved' : '');
    return '<a class="' + cls + '" href="#/level/' + esc(t.id) + '"><span class="tnum">' + esc(label) + '</span>' +
      (t.title ? '<span class="ttitle" title="' + esc(t.title) + '">' + esc(t.title) + '</span>' : '') +
      (t.next ? '<span class="nextmark">Next door</span>' : '') + '<small>' + mark + badge(t.level.origin) + '</small></a>';
  }

  // DOM glue: heading, filter chips, search box and the tile grid for the Game Room.
  function mount(ctx) {
    var view = ctx.view, esc = ctx.esc, doc = root.document;
    var tiles = buildTiles(ctx.area, ctx.count, ctx.byId, ctx.store), cnt = counts(tiles);
    var filter = 'all', query = '';
    view.innerHTML = '<h1></h1>';
    view.firstChild.textContent = ctx.title;
    var bar = doc.createElement('div'); bar.className = 'filters';
    var chips = doc.createElement('div'); chips.className = 'chips'; chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', 'Filter cards');
    var btns = {};
    FILTERS.forEach(function (f) {
      var b = doc.createElement('button'); b.type = 'button'; b.className = 'chip'; b.setAttribute('data-filter', f[0]);
      b.textContent = f[1] + ' (' + cnt[f[0]] + ')';
      b.onclick = function () { filter = f[0]; draw(); };
      btns[f[0]] = b; chips.appendChild(b);
    });
    var lab = doc.createElement('label'); lab.className = 'search'; lab.setAttribute('for', 'gsearch'); lab.appendChild(doc.createTextNode('Search cards '));
    var inp = doc.createElement('input'); inp.type = 'text'; inp.id = 'gsearch'; inp.autocomplete = 'off'; inp.placeholder = 'Number or title';
    inp.oninput = function () { query = inp.value; draw(); };
    lab.appendChild(inp);
    bar.appendChild(chips); bar.appendChild(lab);
    var grid = doc.createElement('div'); grid.className = 'grid';
    var empty = doc.createElement('p'); empty.className = 'msg'; empty.id = 'gempty'; empty.setAttribute('role', 'status'); empty.hidden = true; empty.textContent = 'No cards match.';
    view.appendChild(bar); view.appendChild(grid); view.appendChild(empty);
    function draw() {
      FILTERS.forEach(function (f) { btns[f[0]].setAttribute('aria-pressed', f[0] === filter ? 'true' : 'false'); });
      var shown = filterTiles(tiles, filter, query);
      grid.innerHTML = shown.map(function (t) { return tileHtml(t, esc, ctx.badge); }).join('');
      empty.hidden = shown.length > 0;
    }
    draw();
  }

  var api = { statusOf: statusOf, buildTiles: buildTiles, filterTiles: filterTiles, counts: counts, progressText: progressText, tileHtml: tileHtml, mount: mount, FILTERS: FILTERS };
  if (typeof module !== 'undefined') module.exports = api; else root.GameGrid = api;
})(typeof window !== 'undefined' ? window : globalThis);
