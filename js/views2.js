(function (root) {
  'use strict';
  // Hallway, rabbit hole, handbook, workbench and settings. Loaded before app.js, which passes in shared helpers.
  var SETTINGS_KEY = 'levels.v1.settings';
  var DOORS_TOTAL = 70; // hallway slots
  var memSettings = { unlockAll: false };
  var writeFailed = false; // once a save fails, the in-memory value stays authoritative

  function loadSettings() {
    if (writeFailed) return memSettings;
    try {
      var raw = root.localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === 'object') memSettings = { unlockAll: o.unlockAll === true };
      }
    } catch (e) { /* keep in-memory value */ }
    return memSettings;
  }
  function setUnlockAll(on) {
    memSettings = { unlockAll: !!on };
    try { root.localStorage.setItem(SETTINGS_KEY, JSON.stringify(memSettings)); } catch (e) { writeFailed = true; /* memory only */ }
  }
  function unlockAll() { return loadSettings().unlockAll === true; }

  function create(ctx) {
    var view = ctx.view, esc = ctx.esc, store = ctx.store, byId = ctx.byId, badge = ctx.badge;

    var DOOR_COUNT = DOORS_TOTAL;

    // A door that blocks the chain: built AND checkable. Gaps in the numbering, and built doors with no recorded answer (they could
    // never be solved, e.g. a restored original without its answer), are passable.
    function blocking(p) { var l = byId['door-' + p]; return !!l && Array.isArray(l.answers) && l.answers.length > 0; }
    // The nearest blocking door before n, or 0 when there is none.
    function prevDoor(n) { var p = n - 1; while (p >= 1 && !blocking(p)) p--; return p; }
    // The nearest built door after n (gaps skipped), or 0 when n is the last one built.
    function nextDoor(n) { var q = n + 1; while (q <= DOOR_COUNT && !byId['door-' + q]) q++; return q <= DOOR_COUNT ? q : 0; }
    // missing | locked | open. A door opens when the nearest built door before it is solved (or the Unlock all setting is on); the first built door is always open.
    function doorState(n, all) {
      if (!byId['door-' + n]) return 'missing';
      var p = prevDoor(n);
      if (p < 1 || all || store.isSolved('door-' + p)) return 'open';
      return 'locked';
    }
    function doorLocked(n) { return doorState(n, unlockAll()) === 'locked'; }

    function openTile(n, id, label, isNext) {
      var gg = ctx.gamegrid, h;
      if (gg) {
        try { h = gg.tileHtml({ id: id, n: n, area: 'door', level: byId[id], title: byId[id].title, status: gg.statusOf(byId[id], store), next: !!isNext }, esc, badge); } catch (e) { h = null; }
      }
      if (!h) h = '<a class="tile' + (isNext ? ' next' : '') + (store.isSolved(id) ? ' solved' : '') + '" href="#/level/' + esc(id) + '">' + label +
        (isNext ? '<span class="nextmark">Next door</span>' : '') + '<small>' + badge(byId[id].origin) + '</small></a>';
      return h;
    }

    function hallwayView() {
      var all = unlockAll(), built = 0, opened = 0, next = 0, n, st;
      for (n = 1; n <= DOOR_COUNT; n++) {
        st = doorState(n, all);
        if (st === 'missing') continue;
        built++;
        if (store.isSolved('door-' + n)) opened++;
        else if (st === 'open' && !next) next = n;
      }
      var h = '<h1>Hallway</h1><p class="hall-intro">Solve each door to unlock the next. Doors beyond the last one built are puzzles from the original hallway that never made it into any archive.</p>' +
        '<p class="hall-progress" id="hall-progress">Doors opened: ' + opened + ' of ' + built + ' built</p><div class="grid">';
      for (n = 1; n <= DOOR_COUNT; n++) {
        st = doorState(n, all);
        var id = 'door-' + n, label = 'Door ' + n;
        if (st === 'missing') h += '<span class="tile locked" title="Not recovered">' + label + '<small>Not recovered</small></span>';
        else if (st === 'locked') h += '<span class="tile locked" title="Solve the previous door first">' + label + '<small>Locked</small></span>';
        else h += openTile(n, id, label, n === next);
      }
      view.innerHTML = h + '</div>';
    }

    function lockedDoorView(n) {
      var p = prevDoor(n);
      view.innerHTML = '<p class="back"><a href="#/hallway">&larr; Back</a></p><h1>Door ' + esc(n) + ' is locked</h1>' +
        '<div class="panel" id="door-locked"><p>This door is still locked. Solve door ' + esc(p) + ' first.</p>' +
        '<p><a href="#/level/door-' + esc(p) + '">Go to door ' + esc(p) + '</a> &middot; <a href="#/hallway">Back to the Hallway</a></p></div>';
    }

    function rabbitView() {
      var list = ctx.levels.filter(function (l) { return l.area === 'rabbithole'; }).sort(function (a, b) { return a.number - b.number; });
      var h = '<h1>Rabbit Hole</h1>';
      if (!list.length) { view.innerHTML = h + '<p>No levels recovered here yet.</p>'; return; }
      h += '<ul class="plain">';
      list.forEach(function (l) {
        h += '<li><a href="#/level/' + esc(l.id) + '">' + esc(l.title) + '</a> ' + badge(l.origin) + (store.isSolved(l.id) ? ' <span class="tick" title="Solved">&#10003;</span>' : '') + '</li>';
      });
      view.innerHTML = h + '</ul>';
    }

    function handbookView(sectionId) {
      var secs = (root.LEVELS_DATA && root.LEVELS_DATA.handbook) || [];
      if (sectionId && !secs.some(function (s) { return s.id === sectionId; })) return ctx.notFound('No handbook section called "' + sectionId + '".');
      var h = '<h1>Handbook</h1><p>Techniques that help with the puzzles.</p><ul class="plain">';
      secs.forEach(function (s) { h += '<li><a href="#/handbook/' + esc(encodeURIComponent(s.id)) + '">' + esc(s.title) + '</a></li>'; });
      h += '</ul>';
      secs.forEach(function (s) {
        // body_html is our own tracked data only
        h += '<details class="panel" id="hb-' + esc(s.id) + '"' + (s.id === sectionId ? ' open' : '') + '><summary><strong>' + esc(s.title) + '</strong></summary>' + s.body_html + '</details>';
      });
      view.innerHTML = h;
      if (sectionId) {
        var el = document.getElementById('hb-' + sectionId);
        if (el && el.scrollIntoView) el.scrollIntoView();
      }
    }

    function toolsView() {
      var T = root.Toolbox;
      if (!root.Ciphers || !T || typeof T.cipherPanel !== 'function' || typeof T.runCipher !== 'function') { view.innerHTML = '<h1>Cipher workbench</h1><p>This section failed to load.</p>'; return; }
      view.innerHTML = '<h1>Cipher workbench</h1><div class="panel" id="cwb"></div>';
      T.cipherPanel(document.getElementById('cwb'), root.Ciphers); // same component as the inline toolbox
    }

    function settingsPanel(parent) {
      var p = document.createElement('div');
      p.className = 'panel';
      var label = document.createElement('label'), cb = document.createElement('input');
      cb.type = 'checkbox'; cb.id = 'unlockall'; cb.checked = unlockAll();
      cb.onchange = function () { setUnlockAll(cb.checked); };
      label.appendChild(cb);
      label.appendChild(document.createTextNode(' Unlock all hallway doors'));
      p.appendChild(label);
      parent.appendChild(p);
    }

    return { hallway: hallwayView, doorLocked: doorLocked, prevDoor: prevDoor, nextDoor: nextDoor, lockedDoor: lockedDoorView, rabbit: rabbitView, handbook: handbookView, tools: toolsView, settingsPanel: settingsPanel };
  }

  root.Views2 = { DOOR_COUNT: DOORS_TOTAL, create: create, unlockAll: unlockAll, setUnlockAll: setUnlockAll };
})(typeof window !== 'undefined' ? window : this);
