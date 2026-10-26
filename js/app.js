(function () {
  'use strict';
  var LEVELS = (window.LEVELS_DATA && window.LEVELS_DATA.levels) || [];
  var byId = Object.create(null); // no prototype: ids like "constructor" must not resolve
  LEVELS.forEach(function (l) { byId[l.id] = l; });
  var storage;
  try { storage = window.localStorage; } catch (e) { storage = undefined; }
  var store = Store.create(storage);
  var GG = window.GameGrid || null; // optional: grid/filter/progress helpers; old behaviour if it failed to load
  var lastHintAt = Object.create(null); // in-memory, per level
  var view = document.getElementById('view');
  var timer = null;
  var ORIGIN_LABEL = { original: 'Original', partial: 'Partial', replacement: 'Replacement' };
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  function badge(o) { return '<span class="badge ' + esc(o) + '">' + esc(ORIGIN_LABEL[o] || o) + '</span>'; }

  function progressText(levels, isSolved) {
    var solvable = levels.filter(function (l) { return Answer.canAnswer(l); });
    var solved = solvable.filter(function (l) { return isSolved(l.id); }).length;
    var waiting = levels.length - solvable.length;
    var txt;
    if (!levels.length) txt = 'No levels loaded';
    else {
      txt = solvable.length ? 'Solved ' + solved + ' / ' + solvable.length + ' checkable' : 'No levels are checkable yet';
      if (waiting > 0) txt += ' · ' + waiting + ' awaiting ' + (waiting === 1 ? 'answer' : 'answers');
    }
    return { text: txt, pct: solvable.length ? Math.round(100 * solved / solvable.length) : 0 };
  }

  function updateProgress() {
    var p;
    try { p = GG ? GG.progressText(LEVELS, function (id) { return store.isSolved(id); }) : null; } catch (e) { p = null; }
    if (!p) p = progressText(LEVELS, function (id) { return store.isSolved(id); });
    var el = document.getElementById('progress');
    el.textContent = p.text;
    var bar = document.createElement('div'); bar.className = 'bar';
    var i = document.createElement('i'); i.style.width = p.pct + '%';
    bar.appendChild(i); el.appendChild(bar);
  }

  function notFound(msg) {
    view.innerHTML = '<h1>Not found</h1><p>' + esc(msg || 'That page does not exist.') + '</p><p><a href="#/">Back to start</a></p>';
  }

  function tile(area, n) {
    var id = area + '-' + n, l = byId[id];
    var label = (area === 'card' ? 'Card ' : area === 'door' ? 'Door ' : 'Level ') + n;
    if (!l) return '<span class="tile locked" title="Not recovered">' + label + '<small>Not recovered</small></span>';
    return '<a class="tile' + (store.isSolved(id) ? ' solved' : '') + '" href="#/level/' + esc(id) + '">' + label + '<small>' + badge(l.origin) + '</small></a>';
  }

  function gridView(title, area, count) {
    if (GG) {
      try { GG.mount({ view: view, title: title, area: area, count: count, byId: byId, store: store, esc: esc, badge: badge }); return; } catch (e) { if (window.console) console.error('GameGrid failed:', e); }
    }
    var h = '<h1>' + title + '</h1><div class="grid">';
    for (var i = 1; i <= count; i++) h += tile(area, i);
    view.innerHTML = h + '</div>';
  }

  var v2;
  try { v2 = Views2.create({ view: view, levels: LEVELS, byId: byId, store: store, esc: esc, badge: badge, notFound: notFound, gamegrid: GG }); } catch (e) { v2 = null; if (window.console) console.error('Views2 failed to load:', e); }
  if (!v2) {
    var failed = function () { view.innerHTML = '<h1>Unavailable</h1><p>This section failed to load.</p>'; };
    v2 = { hallway: failed, doorLocked: function () { return false; }, nextDoor: function () { return 0; }, lockedDoor: failed, rabbit: failed, handbook: failed, tools: failed, settingsPanel: function () {} };
  }

  var v3;
  try { v3 = Views3.create({ view: view, store: store, esc: esc, notFound: notFound, hidden: window.LEVELS_DATA && window.LEVELS_DATA.hidden, updateProgress: updateProgress }); } catch (e) { v3 = null; if (window.console) console.error('Views3 failed to load:', e); }
  if (!v3) {
    var failed3 = function () { view.innerHTML = '<h1>Unavailable</h1><p>This section failed to load.</p>'; };
    v3 = { games: failed3, game: failed3, hidden: failed3, hiddenPage: failed3, phone: failed3, radio: failed3, terminal: failed3, safe: failed3, dispose: function () {} };
  }
  function param(raw) { try { return decodeURIComponent(raw); } catch (e) { return raw; } }

  function homeView() {
    view.innerHTML = '<h1>LEVELS ARG School</h1><p>An offline, local restoration. Each level is marked ' + badge('original') + ' ' + badge('partial') + ' or ' + badge('replacement') + '.</p>' +
      '<div class="grid"><a class="tile" href="#/game-room">Game Room<small>75 cards</small></a><a class="tile" href="#/hallway">Hallway<small>' + (window.Views2 ? Views2.DOOR_COUNT + ' doors' : 'Doors') + '</small></a><a class="tile" href="#/rabbithole">Rabbit Hole</a></div>';
  }

  function profileView() {
    view.innerHTML = '<h1>Profile</h1><div class="panel"><p>Progress lives in this browser. Export it to keep a backup or move it elsewhere.</p>' +
      '<button id="exp">Export progress</button> <label class="btn" for="imp">Import progress</label><input id="imp" type="file" accept=".json,application/json" hidden>' +
      '<p id="pmsg" class="msg"></p></div>';
    v2.settingsPanel(view);
    document.getElementById('exp').onclick = function () {
      var url = URL.createObjectURL(new Blob([store.exportJSON()], { type: 'application/json' }));
      var a = document.createElement('a');
      a.href = url; a.download = 'levels-progress.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    };
    document.getElementById('imp').onchange = function (ev) {
      var f = ev.target.files && ev.target.files[0], msg = document.getElementById('pmsg');
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        var res = store.importJSON(String(r.result));
        msg.className = 'msg ' + (res.ok ? 'ok' : 'err');
        msg.textContent = res.ok ? 'Progress imported.' : 'Import failed: ' + res.error;
        updateProgress();
        ev.target.value = '';
      };
      r.onerror = function () { msg.className = 'msg err'; msg.textContent = 'Import failed: could not read file'; };
      r.readAsText(f);
    };
  }

  function levelView(id) {
    var l = byId[id];
    if (!l) return notFound('No level called "' + id + '" was recovered.');
    if (l.area === 'door' && v2.doorLocked(l.number)) return v2.lockedDoor(l.number); // locked door: friendly page, no puzzle
    var back = l.area === 'card' ? 'game-room' : l.area === 'door' ? 'hallway' : 'rabbithole';
    var h = '<p class="back"><a href="#/' + back + '">&larr; Back</a></p><div class="level-split"><section class="pane pane-puzzle" aria-label="Puzzle"><h1>' + esc(l.title) + ' ' + badge(l.origin) + '</h1>';
    if (l.origin === 'partial' && l.status_note) h += '<p class="note-partial">' + esc(l.status_note) + '</p>';
    if (Array.isArray(l.missing_assets) && l.missing_assets.length) h += '<p class="note-partial" id="missing-assets">Attachment(s) missing: ' + l.missing_assets.map(esc).join(', ') + '</p>';
    h += '<div class="panel" id="body"></div>';
    var can = Answer.canAnswer(l);
    h += '<div class="panel"><form id="af" class="row"><input type="text" id="ans" autocomplete="off" placeholder="Your answer" aria-label="Answer"><button type="submit">Check answer</button></form><p id="amsg" class="msg"></p></div></section>';
    h += '<section class="pane pane-tools" aria-label="Tools"><div id="toolbox"></div></section></div>';
    document.body.classList.add('level-page');
    view.innerHTML = h;
    sizeHeader();
    document.getElementById('body').innerHTML = l.body_html; // our own generated data only

    var amsg = document.getElementById('amsg');
    // Door levels: say which door opened (or that this was the last one built so far). Other levels keep the plain message.
    function showSolved(justNow) {
      amsg.className = 'msg ok'; amsg.textContent = '';
      if (l.area !== 'door') { amsg.textContent = 'Correct! Level solved.'; return; }
      var nextNum = v2.nextDoor(l.number); // the next built door, gaps in the numbering skipped (0 = this was the last one)
      if (nextNum) {
        amsg.appendChild(document.createTextNode(justNow ? 'The door swings open. Door ' + nextNum + ' is now unlocked. ' : 'Door ' + nextNum + ' is open. '));
        var a = document.createElement('a'); a.href = '#/level/door-' + nextNum; a.textContent = 'Go to door ' + nextNum;
        amsg.appendChild(a);
      } else {
        amsg.textContent = justNow ? 'That was the last door built so far. More doors will appear as the hallway grows.' : 'Solved. That was the last door built so far.';
      }
    }
    if (can && store.isSolved(id)) showSolved(false);
    var ans = document.getElementById('ans');
    document.getElementById('af').onsubmit = function (ev) {
      ev.preventDefault();
      if (!can) { amsg.className = 'msg'; amsg.textContent = "No answer is on file for this puzzle yet, so it can't be checked."; return; }
      if (!ans.value.trim()) { amsg.className = 'msg err'; amsg.textContent = 'Type your answer first.'; return; }
      if (Answer.checkAnswer(l, ans.value)) { store.markSolved(id); showSolved(true); updateProgress(); }
      else { amsg.className = 'msg err'; amsg.textContent = 'Not quite. Try again.'; void amsg.offsetWidth; amsg.className = 'msg err shake'; }
    };

    // Hints: built into a container, either as the last accordion panel or (toolbox failed) a standalone block.
    var ready = Hints.availableTiers(l);
    function buildHints(box) {
      box.innerHTML = '<div id="hints"></div><button id="hbtn"></button> <span id="hwait"></span>'; // static markup
      var hintsEl = box.querySelector('#hints'), hbtn = box.querySelector('#hbtn'), hwait = box.querySelector('#hwait');
      function avail() {
        return Hints.nextAvailable({ unlockedTier: store.hintTier(id), now: Date.now(), lastHintAt: lastHintAt[id] || 0, cooldownMs: Hints.COOLDOWN_MS });
      }
      function drawHints() {
        var s = '', shown = Math.min(store.hintTier(id), ready);
        for (var i = 1; i <= shown; i++) s += '<div class="hint"><strong>Hint ' + i + '</strong><br>' + esc(l.hints[i - 1] || '') + '</div>';
        hintsEl.innerHTML = s;
      }
      function tick() {
        var n = avail();
        if (n.tier === null || n.tier > ready) {
          hbtn.style.display = 'none';
          hwait.textContent = ready >= 4 ? 'All hints revealed.' : ready === 0 ? "Hints for this level haven't been written yet." : "More hints for this level haven't been written yet.";
        } else {
          hbtn.style.display = ''; hbtn.textContent = 'Reveal hint ' + n.tier; hbtn.disabled = n.waitMs > 0;
          hwait.textContent = n.waitMs > 0 ? 'Next hint in ' + Math.ceil(n.waitMs / 1000) + 's' : '';
        }
        if ((n.tier === null || n.tier > ready || n.waitMs <= 0) && timer) { clearInterval(timer); timer = null; }
      }
      hbtn.onclick = function () {
        var n = avail();
        if (n.tier === null || n.tier > ready || n.waitMs > 0) return;
        if (!window.confirm('Reveal hint ' + n.tier + '? It carries a ' + Hints.penalty(n.tier) + ' point penalty.')) return;
        store.recordHint(id, n.tier);
        lastHintAt[id] = Date.now();
        drawHints(); tick();
        if (!timer && hbtn.disabled) timer = setInterval(tick, 500);
      };
      drawHints(); tick();
    }

    // Inline toolbox (notes and hints live inside it). If it fails to load, fall back to plain notes + hints blocks.
    var tbOk = false, tbBox = document.getElementById('toolbox');
    var extraPanels = [{ id: 'hints', title: 'Hints', open: false, forceOpen: store.hintTier(id) > 0, build: buildHints }];
    try { Toolbox.mount(tbBox, { store: store, level: l, Ciphers: window.Ciphers, data: window.LEVELS_DATA, extraPanels: extraPanels }); tbOk = true; }
    catch (e) { tbBox.textContent = ''; if (window.console) console.error('Toolbox failed to load:', e); }
    if (!tbOk) {
      var np = document.createElement('div'); np.className = 'panel';
      np.innerHTML = '<h3>Notes</h3><textarea id="notes" aria-label="Notes"></textarea>';
      tbBox.appendChild(np);
      var notes = document.getElementById('notes');
      notes.value = store.getNote(id);
      notes.oninput = function () { store.setNote(id, notes.value); };
      var hp = document.createElement('div'); hp.className = 'panel';
      hp.innerHTML = '<h3>Hints</h3><div id="hints-fallback"></div>';
      tbBox.appendChild(hp);
      buildHints(hp.querySelector('#hints-fallback'));
    }
  }

  function sizeHeader() {
    var hd = document.querySelector('header');
    if (!hd || !document.body.classList.contains('level-page')) return;
    var st = document.documentElement.style, split = document.querySelector('.level-split');
    st.setProperty('--hdr', hd.offsetHeight + 'px');
    // where the panes start when the page is scrolled to the top (below the header and the Back link)
    if (split) st.setProperty('--split-top', Math.round(split.getBoundingClientRect().top + window.pageYOffset) + 'px');
  }
  window.addEventListener('resize', sizeHeader);

  function render() {
    if (timer) { clearInterval(timer); timer = null; }
    v3.dispose();
    document.body.classList.remove('level-page');
    if (!window.LEVELS_DATA) {
      view.innerHTML = '<h1>Data not built</h1><div class="panel" id="nodata" role="alert"><p>Data not built — run <code>python tools/build_data.py</code></p></div>';
      updateProgress();
      return;
    }
    var hash = (location.hash || '#/').replace(/^#/, ''), m;
    window.scrollTo(0, 0);
    if (hash === '/' || hash === '') homeView();
    else if (hash === '/game-room') gridView('Game Room', 'card', 75);
    else if (hash === '/hallway') v2.hallway();
    else if (hash === '/rabbithole') v2.rabbit();
    else if (hash === '/handbook') v2.handbook();
    else if ((m = /^\/handbook\/([^/]+)$/.exec(hash))) {
      var sid;
      try { sid = decodeURIComponent(m[1]); } catch (e) { sid = m[1]; }
      v2.handbook(sid);
    }
    else if (hash === '/tools') v2.tools();
    else if (hash === '/games') v3.games();
    else if ((m = /^\/games\/([^/]+)$/.exec(hash))) v3.game(param(m[1]));
    else if (hash === '/hidden') v3.hidden();
    else if ((m = /^\/hidden\/([^/]+)$/.exec(hash))) v3.hiddenPage(param(m[1]));
    else if (hash === '/phone') v3.phone();
    else if (hash === '/wireless') v3.radio();
    else if (hash === '/terminal') v3.terminal();
    else if (hash === '/safe') v3.safe();
    else if (hash === '/profile') profileView();
    else if ((m = /^\/level\/([^/]+)$/.exec(hash))) {
      var id;
      try { id = decodeURIComponent(m[1]); } catch (e) { id = m[1]; }
      levelView(id);
    } else notFound();
    updateProgress();
  }

  window.addEventListener('hashchange', render);
  render();
})();
