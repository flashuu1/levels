(function (root) {
  'use strict';
  // Mini-games, hidden pages and the simulated phone line. Loaded before app.js, which passes in shared helpers.
  // Local only: nothing here contacts any network or real phone number.
  var GAMES = [
    { id: 'memory', title: 'Memory', blurb: 'Flip cards and match all eight pairs.' },
    { id: 'scramble', title: 'Word Scramble', blurb: 'Unscramble three words in a row.' },
    { id: 'sudoku', title: 'Sudoku', blurb: 'Fill the grid so no row, column or box repeats a digit.' }
  ];
  var GLYPHS = ['★', '♦', '♣', '♠', '♥', '●', '▲', '■'];
  var VOICEMAIL_DELAY = 1400;

  function create(ctx) {
    var view = ctx.view, esc = ctx.esc, store = ctx.store, G = root.Games, H = root.Hidden;
    var data = ctx.hidden || { pages: [], phone: { lines: [] } };
    var pages = Array.isArray(data.pages) ? data.pages : [];
    var lines = data.phone && Array.isArray(data.phone.lines) ? data.phone.lines : [];
    var timers = [];
    var S = root.Story && root.Seal ? root.Story.create({ view: view, store: store, notFound: ctx.notFound, hidden: data, updateProgress: ctx.updateProgress }) : null; // sealed story layer (optional)

    function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
    function dispose() { timers.forEach(clearTimeout); timers = []; if (S) S.dispose(); }
    function el(tag, cls, text) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }
    function seed() { return (Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0; }
    function won(id, msgEl, text) {
      store.markSolved('game-' + id);
      msgEl.className = 'msg ok'; msgEl.textContent = text;
      if (ctx.updateProgress) ctx.updateProgress();
    }
    function head(title, backHref, backText) {
      view.textContent = '';
      var p = el('p'), a = el('a', '', '← ' + backText);
      a.href = backHref; p.appendChild(a);
      view.appendChild(p);
      view.appendChild(el('h1', '', title));
    }

    function gamesIndex() {
      view.innerHTML = '<h1>Games</h1><p>Small diversions. Winning one marks it with a tick.</p><div class="grid"></div>';
      var grid = view.querySelector('.grid');
      GAMES.forEach(function (g) {
        var a = el('a', 'tile' + (store.isSolved('game-' + g.id) ? ' solved' : ''));
        a.href = '#/games/' + g.id;
        a.appendChild(document.createTextNode(g.title));
        a.appendChild(el('small', '', g.blurb));
        if (store.isSolved('game-' + g.id)) { var t = el('span', 'tick', ' ✓'); a.insertBefore(t, a.childNodes[1]); }
        grid.appendChild(a);
      });
    }

    function memoryGame() {
      head('Memory', '#/games', 'Games');
      var board = G.memoryBoard(8, seed()), matched = [], open = [], busy = false, moves = 0;
      var info = el('p', 'msg', 'Moves: 0'), grid = el('div', 'mem-grid'), btns = [];
      var panel = el('div', 'panel');
      panel.appendChild(info);
      if (store.isSolved('game-memory')) panel.appendChild(el('p', 'msg ok', 'You have already won this one. Play again if you like.'));
      panel.appendChild(grid);
      view.appendChild(panel);
      function paint(i) {
        var shown = matched.indexOf(i) !== -1 || open.indexOf(i) !== -1;
        btns[i].textContent = shown ? GLYPHS[board[i] % GLYPHS.length] : '?';
        btns[i].className = 'mem-card' + (matched.indexOf(i) !== -1 ? ' matched' : shown ? ' open' : '');
      }
      board.forEach(function (_, i) {
        var b = el('button', 'mem-card', '?');
        b.type = 'button'; b.setAttribute('aria-label', 'Card ' + (i + 1)); b.setAttribute('data-card-id', String(board[i]));
        b.onclick = function () {
          if (busy || open.indexOf(i) !== -1 || matched.indexOf(i) !== -1) return;
          open.push(i); paint(i);
          if (open.length < 2) return;
          moves++; info.textContent = 'Moves: ' + moves;
          var a = open[0], c = open[1];
          if (G.memoryMatch(board, a, c)) {
            matched.push(a, c); open = []; paint(a); paint(c);
            if (G.memoryWon(board, matched)) { info.className = 'msg'; won('memory', info, 'All pairs found in ' + moves + ' moves. Well done!'); }
          } else {
            busy = true;
            later(function () { open = []; busy = false; paint(a); paint(c); }, 700);
          }
        };
        btns.push(b); grid.appendChild(b);
      });
    }

    function scrambleGame() {
      head('Word Scramble', '#/games', 'Games');
      var need = 3, streak = 0, word = '', panel = el('div', 'panel');
      var shownEl = el('p', 'scramble-word'), form = el('form', 'row'), inp = el('input'), go = el('button', '', 'Check'), skip = el('button', '', 'Skip');
      var msg = el('p', 'msg'), status = el('p', '');
      inp.type = 'text'; inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'Your guess');
      go.type = 'submit'; skip.type = 'button';
      form.appendChild(inp); form.appendChild(go); form.appendChild(skip);
      [status, shownEl, form, msg].forEach(function (n) { panel.appendChild(n); });
      view.appendChild(panel);
      function next() {
        word = G.WORDS[Math.floor(Math.random() * G.WORDS.length)];
        shownEl.textContent = G.scramble(word, seed());
        status.textContent = 'Streak: ' + streak + ' / ' + need;
        inp.value = ''; inp.focus();
      }
      form.onsubmit = function (ev) {
        ev.preventDefault();
        if (inp.value.trim().toLowerCase() === word) {
          streak++;
          if (streak >= need) { won('scramble', msg, 'Three in a row. Solved!'); status.textContent = 'Streak: ' + streak + ' / ' + need; streak = 0; later(next, 1200); return; }
          msg.className = 'msg ok'; msg.textContent = 'Correct!';
          next();
        } else { streak = 0; msg.className = 'msg err'; msg.textContent = 'Not quite; the streak resets.'; status.textContent = 'Streak: 0 / ' + need; inp.select(); }
      };
      skip.onclick = function () { streak = 0; msg.className = 'msg'; msg.textContent = 'Skipped; the streak resets.'; next(); };
      next();
    }

    function sudokuGame() {
      head('Sudoku', '#/games', 'Games');
      var panel = el('div', 'panel'), pick = el('select'), table = el('div', 'sudoku'), msg = el('p', 'msg');
      pick.setAttribute('aria-label', 'Puzzle');
      G.SUDOKU.forEach(function (p, i) { var o = el('option', '', p.name); o.value = String(i); pick.appendChild(o); });
      var check = el('button', '', 'Check'); check.type = 'button';
      var cells = [];
      function load(idx) {
        var p = G.SUDOKU[idx]; table.textContent = ''; cells = []; msg.className = 'msg'; msg.textContent = '';
        for (var r = 0; r < 9; r++) {
          cells.push([]);
          for (var c = 0; c < 9; c++) {
            var inp = el('input', 'sd-cell' + (c % 3 === 2 && c < 8 ? ' rb' : '') + (r % 3 === 2 && r < 8 ? ' bb' : ''));
            inp.type = 'text'; inp.maxLength = 1; inp.inputMode = 'numeric'; inp.setAttribute('aria-label', 'Row ' + (r + 1) + ' column ' + (c + 1));
            if (p.puzzle[r][c]) { inp.value = String(p.puzzle[r][c]); inp.readOnly = true; inp.className += ' given'; }
            else inp.oninput = function () { this.value = this.value.replace(/[^1-9]/g, ''); this.classList.remove('bad'); };
            cells[r].push(inp); table.appendChild(inp);
          }
        }
      }
      pick.onchange = function () { load(Number(pick.value)); };
      check.onclick = function () {
        var grid = cells.map(function (row) { return row.map(function (i) { return i.value ? Number(i.value) : 0; }); });
        var res = G.sudokuValid(grid);
        cells.forEach(function (row) { row.forEach(function (i) { i.classList.remove('bad'); }); });
        res.conflicts.forEach(function (rc) { cells[rc[0]][rc[1]].classList.add('bad'); });
        if (res.complete && res.valid) won('sudoku', msg, 'Solved! Every row, column and box is correct.');
        else if (!res.valid) { msg.className = 'msg err'; msg.textContent = res.conflicts.length + ' cells conflict (highlighted).'; }
        else { msg.className = 'msg'; msg.textContent = 'No conflicts so far, but the grid is not full yet.'; }
      };
      var bar = el('div', 'row'); bar.appendChild(pick); bar.appendChild(check);
      panel.appendChild(bar); panel.appendChild(table); panel.appendChild(msg);
      view.appendChild(panel);
      load(0);
    }

    function gameRoute(name) {
      if (name === 'memory') return memoryGame();
      if (name === 'scramble') return scrambleGame();
      if (name === 'sudoku') return sudokuGame();
      ctx.notFound('No game called "' + name + '".');
    }

    function hiddenIndex() {
      head('Hidden', '#/', 'Start');
      var vis = H.visiblePages(pages, store); // each story is a hub page; no locked-page count: undiscovered stories leave no trace
      var ul = el('ul', 'plain'), stories = 0, Story_SLOTS = root.Story && root.Story.STORY_SLOTS || 4;
      vis.forEach(function (p) {
        var li = el('li'), a = el('a', '', String(p.title || p.id));
        a.href = '#/hidden/' + encodeURIComponent(p.id); li.appendChild(a);
        var arc = S ? S.arcOfPage(p.id) : '';
        if (arc) { stories++; var pr = S.progress(arc); li.appendChild(el('span', 'index-pct', ' ' + pr.pct + '%')); }
        ul.appendChild(li);
      });
      // stories you have not reached yet show as ??? (there are always more than the ones you have found)
      for (var k = stories; S && k < Story_SLOTS; k++) { var q = el('li', 'found-unknown'); q.appendChild(el('span', 'found-q', '???')); ul.appendChild(q); }
      view.appendChild(ul);
      // the rooms you have found stay one click away; each opens in a new tab so you can keep your place
      var rs = S && S.rooms ? S.rooms() : [];
      if (rs.length) {
        view.appendChild(el('h2', '', 'Rooms you have found'));
        var rl = el('ul', 'plain room-list');
        rs.forEach(function (r) { var li = el('li'), a2 = el('a', '', r.title + ' \u2197'); a2.href = r.href; a2.target = '_blank'; a2.rel = 'noopener'; li.appendChild(a2); rl.appendChild(li); });
        view.appendChild(rl);
      }
      if (!rs.length) { var p = el('p'), a = el('a', '', 'Try the phone line'); a.href = '#/phone'; p.appendChild(a); view.appendChild(p); }
    }

    function hiddenPage(id) {
      if (S && /^story-/.test(id)) return S.recordView(id);
      var page = null;
      pages.forEach(function (p) { if (p && p.id === id) page = p; });
      // Locked and unknown pages look identical so locked titles never leak.
      if (!page || !H.isUnlocked(page, store)) return ctx.notFound('No hidden page called "' + id + '" is open to you.');
      head(String(page.title || page.id), '#/hidden', 'Hidden');
      var body = el('div', 'panel');
      body.innerHTML = String(page.body_html || ''); // our own tracked data only
      view.appendChild(body);
      var extra = S ? S.hub(S.arcOfPage(id)) : null; // everything found for this story
      if (extra) view.appendChild(extra);
    }

    var KEYLETTERS = { 2: 'ABC', 3: 'DEF', 4: 'GHI', 5: 'JKL', 6: 'MNO', 7: 'PQRS', 8: 'TUV', 9: 'WXYZ' };
    function phoneView() {
      if (S && S.visit) S.visit('phone');
      head('Phone Line', '#/hidden', 'Hidden');
      var intro = data.phone && data.phone.intro ? String(data.phone.intro) : 'ENTER CODE.';
      var panel = el('div', 'panel phone deskphone'), body = el('div', 'phone-body'), screen = el('div', 'phone-screen', intro), tr = el('div', 'phone-transcript');
      var handset = el('div', 'phone-handset'); handset.setAttribute('aria-hidden', 'true');
      var form = el('form', 'row phone-form'), inp = el('input'), dial = el('button', '', 'Dial'), clear = el('button', '', 'Clear');
      inp.type = 'text'; inp.autocomplete = 'off'; inp.maxLength = 24; inp.setAttribute('aria-label', 'Code'); inp.placeholder = 'Digits or letters';
      dial.type = 'submit'; clear.type = 'button';
      form.appendChild(inp); form.appendChild(dial); form.appendChild(clear);
      var pad = el('div', 'keypad');
      '123456789*0#'.split('').forEach(function (k) {
        var b = el('button', 'key', k); b.type = 'button';
        if (KEYLETTERS[k]) b.appendChild(el('small', 'key-letters', KEYLETTERS[k]));
        b.setAttribute('aria-label', 'Key ' + k);
        b.onclick = function () { if (inp.value.length < 24) inp.value += k; inp.focus(); };
        pad.appendChild(b);
      });
      var skip = el('button', '', 'Skip to end'); skip.type = 'button'; skip.hidden = true;
      body.appendChild(handset); body.appendChild(screen); body.appendChild(form); body.appendChild(pad);
      panel.appendChild(body);
      var log = el('div', 'call-log'); // everyone you have reached so far
      function drawLog() {
        var calls = [];
        lines.forEach(function (l) { if (store.isSolved('phone-' + l.id)) calls.push({ name: String(l.name || l.id), number: store.getNote('dial:' + l.id), at: store.solvedAt ? store.solvedAt('phone-' + l.id) : 0 }); });
        if (S && S.found) S.found().forEach(function (r) { if (r.kind === 'phone') calls.push({ name: String(r.name || r.title), number: store.getNote('seal:' + r.id), at: r.at || 0 }); });
        calls.sort(function (a, b) { return b.at - a.at; }); // the latest call first
        log.textContent = '';
        if (!calls.length) return;
        log.appendChild(el('h3', 'call-log-title', 'Calls you have made'));
        var ul = el('ul', 'plain');
        calls.forEach(function (c) {
          var li = el('li');
          if (c.number) {
            var b = el('button', 'call-redial'); b.type = 'button'; b.setAttribute('aria-label', 'Call ' + c.name + ' again, ' + c.number);
            b.appendChild(el('span', 'call-name', '\u260e ' + c.name)); b.appendChild(el('span', 'call-number', c.number));
            b.onclick = function () { inp.value = c.number; dial.click(); }; // the number goes in by itself and it calls again
            li.appendChild(b);
          } else { li.appendChild(el('span', 'call-name', '\u260e ' + c.name)); li.appendChild(el('span', 'call-number mute', 'dial it once more and its number is kept here')); }
          ul.appendChild(li);
        });
        log.appendChild(ul);
      }
      drawLog();
      [skip, tr, log].forEach(function (n) { panel.appendChild(n); });
      view.appendChild(panel);
      clear.onclick = function () { inp.value = ''; inp.focus(); };

      var playing = null; // {rest:[...], line}
      function hangUp() { handset.classList.remove('off-hook'); screen.classList.remove('ringing'); }
      function finish(line) {
        playing = null; skip.hidden = true; hangUp();
        screen.textContent = 'Message ended.';
      }
      function step() {
        if (!playing) return;
        if (!playing.rest.length) return finish(playing.line);
        tr.appendChild(el('p', 'vm-line', String(playing.rest.shift())));
        later(step, VOICEMAIL_DELAY);
      }
      skip.onclick = function () {
        if (!playing) return;
        dispose();
        while (playing.rest.length) tr.appendChild(el('p', 'vm-line', String(playing.rest.shift())));
        finish(playing.line);
      };
      form.onsubmit = function (ev) {
        ev.preventDefault();
        dispose(); playing = null; skip.hidden = true; tr.textContent = ''; hangUp();
        var code = inp.value.replace(/[\s\-]+/g, '');
        var line = code ? H.findLine(lines, code) : null, viaOld = !!line;
        if (!line && code && S) { var sealed = S.tryPhone(code); if (sealed) { line = sealed.payload; S.remember(sealed.payload, sealed.code); } }
        inp.value = '';
        if (!line || !Array.isArray(line.voicemail)) { screen.textContent = 'Dialling\u2026'; later(function () { screen.textContent = 'The number you have dialled is not in service.'; }, 500); return; }
        screen.textContent = 'Ringing\u2026'; screen.classList.add('ringing');
        later(function () {
          screen.classList.remove('ringing'); handset.classList.add('off-hook');
          screen.textContent = 'Connected: ' + String(line.name || line.id);
          store.markSolved('phone-' + line.id); // solved when it connects, not when playback finishes
          if (viaOld) store.setNote('dial:' + line.id, code); // the number that worked, so the call log can dial it again
          if (ctx.updateProgress) ctx.updateProgress();
          drawLog();
          playing = { rest: line.voicemail.slice(), line: line }; skip.hidden = false;
          later(step, 600);
        }, 900);
      };
    }

    return { games: gamesIndex, game: gameRoute, hidden: hiddenIndex, hiddenPage: hiddenPage, phone: phoneView, clockroom: function () { return S ? S.clockroom() : ctx.notFound('Nothing here.'); }, garden: function () { return S ? S.garden() : ctx.notFound('Nothing here.'); }, tickets: function () { return S ? S.tickets() : ctx.notFound('Nothing here.'); }, harbour: function () { return S ? S.harbour() : ctx.notFound('Nothing here.'); }, greenhouse: function () { return S ? S.greenhouse() : ctx.notFound('Nothing here.'); }, radio: function () { return S ? S.radio() : ctx.notFound('Nothing here.'); }, terminal: function () { return S ? S.terminal() : ctx.notFound('Nothing here.'); }, safe: function () { return S ? S.safe() : ctx.notFound('Nothing here.'); }, dispose: dispose };
  }

  root.Views3 = { create: create };
})(typeof window !== 'undefined' ? window : this);
