(function (root) {
  'use strict';
  // The sealed story layer: a radio, an office terminal and a vault, plus the records you have recovered. Nothing here is listed
  // anywhere until found: records are ciphertext (see seal.js) and open only with the code the player discovers. Local only.
  var Seal = (typeof module !== 'undefined' && module.exports) ? require('./seal.js') : root.Seal;
  var LINE_DELAY = 1300;
  var ARC_HUB = { keeper: 'keepers-log', gardener: 'gardeners-verse' }; // the plain hidden page that is each story's hub
  var KIND_ORDER = ['radio', 'terminal', 'file', 'phone', 'finale'];
  var KIND_TITLE = { radio: 'Transmissions', terminal: 'Office', file: 'Office files', phone: 'Voicemails', finale: 'The vault' };

  // ---- pure helpers (Node-testable) ----
  function allEntries(story) {
    var out = [];
    ['wireless', 'terminal', 'phone', 'safe', 'epilogue', 'greenhouse'].forEach(function (k) { if (story && Array.isArray(story[k])) story[k].forEach(function (e) { out.push(e); }); });
    return out;
  }
  function channel(story, name) { return story && Array.isArray(story[name]) ? story[name] : []; }
  function formatFreq(v) { var n = Math.round(parseFloat(v) * 10) / 10; return isFinite(n) ? n.toFixed(1) : ''; }
  // Phone codes: "0199" and "555-0199" are the same line.
  function phoneCandidates(code) {
    var c = String(code == null ? '' : code).replace(/[\s\-]+/g, '');
    var out = [c]; if (/^555\d{4}$/.test(c)) out.push(c.slice(3));
    return out;
  }
  function tryPhone(story, code) {
    var cands = phoneCandidates(code);
    for (var i = 0; i < cands.length; i++) { var r = Seal.tryOpen(channel(story, 'phone'), cands[i]); if (r) return { payload: r.payload, code: cands[i] }; }
    return null;
  }
// The second story knows whether you signed the roll: the Gardener counts your name among the trees.
  function personalize(payload, name) {
    if (!payload || payload.arc !== 'gardener') return payload;
    var swap = function (s) {
      s = String(s);
      s = s.replace('Seventy-three of them in the walled garden, and I have tended every one.', name
        ? 'Seventy-three of them in the walled garden, and a seventy-fourth by the gate since you signed the roll: ' + name + '. I have tended every one.'
        : 'Seventy-three of them in the walled garden, and a bare patch by the gate in case anyone ever signs the roll. I have tended every one.');
      if (name) s = s.replace('seventy-three trees let go of their petals at once.', 'seventy-four trees let go of their petals at once, the youngest by the gate.');
      return s;
    };
    var out = JSON.parse(JSON.stringify(payload));
    ['lines', 'voicemail', 'finale'].forEach(function (k) { if (Array.isArray(out[k])) out[k] = out[k].map(swap); });
    return out;
  }
  function safeCode(dials) { return dials.map(function (d) { var n = parseInt(d, 10); return isNaN(n) ? '' : (n < 10 ? '0' : '') + n; }).join(''); }
  // Terminal commands -> { type, ... } (no side effects)
  function parseCommand(line) {
    var parts = String(line || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { type: 'empty' };
    var cmd = parts[0].toLowerCase(), rest = parts.slice(1);
    if (cmd === 'help' || cmd === '?') return { type: 'help' };
    if (cmd === 'ls' || cmd === 'dir') return { type: 'ls' };
    if (cmd === 'clear' || cmd === 'cls') return { type: 'clear' };
    if (cmd === 'logout' || cmd === 'exit') return { type: 'logout' };
    if (cmd === 'login') return { type: 'login', user: rest[0] || '' };
    if (cmd === 'cat' || cmd === 'type' || cmd === 'read') return { type: 'cat', file: (rest[0] || '').toLowerCase() };
    if (cmd === 'open') return { type: 'open', file: (rest[0] || '').toLowerCase(), pass: rest.slice(1).join(' ') };
    return { type: 'unknown', cmd: cmd };
  }

  // The whole site wears what you have done: a lit lamp and a blooming orchard. Called on every page view and when either happens.
  function applyTestament(store) {
    if (typeof document === 'undefined' || !document.body) return;
    document.body.classList.toggle('lamp-lit', !!store.isSolved('story-finale'));
    document.body.classList.toggle('orchard-bloom', !!store.isSolved('story-bloom'));
  }
  var api = { personalize: personalize, applyTestament: applyTestament, ARC_HUB: ARC_HUB, allEntries: allEntries, formatFreq: formatFreq, phoneCandidates: phoneCandidates, tryPhone: tryPhone, safeCode: safeCode, parseCommand: parseCommand, KIND_ORDER: KIND_ORDER, KIND_TITLE: KIND_TITLE };

  // ---- views (browser only) ----
  api.create = function (ctx) {
    var view = ctx.view, store = ctx.store, story = (ctx.hidden && ctx.hidden.story) || {};
    var timers = [], cleanups = [];
    function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
    function dispose() { timers.forEach(clearTimeout); timers = []; }
    function disposeAll() { dispose(); (cleanups || []).forEach(function (f) { try { f(); } catch (e) { /* ok */ } }); cleanups = []; }
    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
    function head(title, backHref, backText) {
      view.textContent = '';
      var p = el('p'), a = el('a', '', '← ' + backText); a.href = backHref; p.appendChild(a); view.appendChild(p);
      view.appendChild(el('h1', '', title));
    }
    function remember(payload, code) {
      if (!store.isSolved('story-' + payload.id)) store.markSolved('story-' + payload.id); // the first find keeps its time: it is the order you found things in
      store.setNote('seal:' + payload.id, code); // so the record can be reopened from the Hidden page
      if (ctx.updateProgress) ctx.updateProgress();
    }
    function found() {
      var entries = allEntries(story), out = [];
      store.solvedIds().forEach(function (k) {
        if (k.indexOf('story-') !== 0) return;
        var code = store.getNote('seal:' + k.slice(6)); if (!code) return;
        var r = Seal.tryOpen(entries, code); if (r) { var pl = personalize(r.payload, store.getNote('roll-name')); pl.at = store.solvedAt ? store.solvedAt(k) : 0; out.push(pl); }
      });
      out.sort(function (a, b) { return a.at - b.at; });
      return out;
    }
    // The secret epilogue opens only under the codes of the ledger and the three household lines, as this player really found them.
    function epilogue() {
      var parts = ['ledger', 'line-clockmaker', 'line-cook', 'line-baker'].map(function (id) { return store.getNote('seal:' + id); });
      if (parts.some(function (p) { return !p; })) return null;
      var key = parts.join(' '), r = Seal.tryOpen(channel(story, 'epilogue'), key);
      return r ? { payload: r.payload, code: key } : null;
    }
    // type a transcript line by line; returns {skip}
    function play(lines, into, done) {
      var rest = lines.slice(), live = true;
      function step() {
        if (!live) return;
        if (!rest.length) { live = false; if (done) done(); return; }
        into.appendChild(el('p', 'vm-line', String(rest.shift())));
        later(step, LINE_DELAY);
      }
      step();
      return { skip: function () { live = false; dispose(); rest.forEach(function (l) { into.appendChild(el('p', 'vm-line', String(l))); }); rest = []; if (done) done(); } };
    }

    // ---- radio ----
    function radioView() {
      head('The wireless', '#/', 'Start');
      var panel = el('div', 'panel radio'), screen = el('div', 'phone-screen radio-screen', 'Static.'), tr = el('div', 'phone-transcript');
      var W = root.Widgets, box = null, idle = null;
      var num = el('input', 'radio-readout'); num.type = 'number'; num.min = '50'; num.max = '110'; num.step = '0.1'; num.value = '88.0'; num.setAttribute('inputmode', 'decimal'); num.setAttribute('aria-label', 'Frequency');
      var down = el('button', 'chip', '\u25c0 0.1'), up = el('button', 'chip', '0.1 \u25b6'), go = el('button', '', 'Listen'), skip = el('button', '', 'Skip to end');
      down.type = up.type = go.type = skip.type = 'button'; skip.hidden = true;
      var playing = null;
      function staticLine() { var s = '', c = '#%&*+=/\\|~^'; for (var i = 0; i < 34; i++) s += c.charAt(Math.floor(Math.random() * c.length)); return s; }
      function listen() {
        dispose(); if (idle) clearTimeout(idle); playing = null; skip.hidden = true; tr.textContent = '';
        var f = formatFreq(num.value), r = Seal.tryOpen(channel(story, 'wireless'), f);
        if (box) box.setLocked(!!r);
        if (!r) { screen.textContent = f + ' MHz: ' + staticLine(); return; }
        screen.textContent = f + ' MHz: signal. Recording saved to Hidden.';
        remember(r.payload, f);
        skip.hidden = false;
        playing = play(r.payload.lines, tr, function () { skip.hidden = true; });
      }
      function setF(v) { var n = Math.min(110, Math.max(50, parseFloat(v))); if (!isFinite(n)) return; num.value = formatFreq(n); if (box) box.setFreq(n); }
      if (W) {
        box = W.radioBox({ min: 50, max: 110, value: 88, onTune: function (f) {
          num.value = f; if (box) box.setLocked(false); screen.textContent = f + ' MHz';
          if (idle) clearTimeout(idle); idle = setTimeout(listen, 450); // a radio locks on when you stop turning
        } });
        cleanups.push(box.destroy); panel.appendChild(box.el);
      }
      num.onchange = function () { setF(num.value); };
      down.onclick = function () { setF(parseFloat(num.value) - 0.1); };
      up.onclick = function () { setF(parseFloat(num.value) + 0.1); };
      go.onclick = listen;
      skip.onclick = function () { if (playing) playing.skip(); skip.hidden = true; };
      var row = el('div', 'row dial-row'); [down, num, up, go].forEach(function (b) { row.appendChild(b); });
      var saved = found().filter(function (r) { return r.kind === 'radio' && r.freq; }).sort(function (a, b) { return parseFloat(a.freq) - parseFloat(b.freq); });
      var chips = el('div', 'chips radio-found');
      saved.forEach(function (r) { var b = el('button', 'chip', r.freq); b.type = 'button'; b.title = 'Tune to ' + r.freq; b.onclick = function () { setF(r.freq); listen(); }; chips.appendChild(b); });
      [screen, row].forEach(function (n) { panel.appendChild(n); });
      if (saved.length) { panel.appendChild(el('p', 'mute', 'Stations you have found:')); panel.appendChild(chips); }
      [skip, tr].forEach(function (n) { panel.appendChild(n); });
      view.appendChild(panel);
      view.appendChild(el('p', 'mute', 'Turn the knob, or drag it round. Most of the band is static.'));
    }

    // ---- terminal ----
    function terminalView() {
      head('Terminal', '#/', 'Start');
      var panel = el('div', 'panel term'), out = el('pre', 'term-out'), form = el('form', 'row term-form');
      var prompt = el('span', 'term-prompt', '>'), inp = el('input');
      inp.type = 'text'; inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'Command'); inp.setAttribute('autocapitalize', 'none'); inp.setAttribute('autocorrect', 'off'); inp.spellcheck = false;
      var go = el('button', '', 'Enter'); go.type = 'submit';
      var quick = el('div', 'chips term-quick');
      var session = null, pendingUser = null;
      function print(lines) { (Array.isArray(lines) ? lines : [lines]).forEach(function (l) { out.appendChild(document.createTextNode(l + '\n')); }); out.scrollTop = out.scrollHeight; }
      function setPrompt() { prompt.textContent = pendingUser !== null ? 'password:' : (session ? 'odile@undercroft>' : '>'); inp.type = pendingUser !== null ? 'password' : 'text'; }
      function start(payload, restored) {
        session = payload; pendingUser = null; setPrompt();
        print(['', restored ? 'Session restored.' : 'Login accepted.'].concat(payload.motd || []));
      }
      function runLine(line) {
        if (pendingUser !== null) { // answering the password prompt
          var user = pendingUser; pendingUser = null;
          var code = user + ' ' + line, r = Seal.tryOpen(channel(story, 'terminal'), code);
          if (r && r.payload.kind === 'terminal') { remember(r.payload, code); start(r.payload, false); } else { print('Login incorrect.'); setPrompt(); }
          return;
        }
        var c = parseCommand(line);
        print((session ? 'odile@undercroft> ' : '> ') + (c.type === 'login' ? line : line));
        if (c.type === 'empty') return;
        if (c.type === 'help') return print(['help | login <user> | ls | cat <file> | open <file> <passphrase> | clear | logout']);
        if (c.type === 'clear') { out.textContent = ''; return; }
        if (c.type === 'login') { if (!c.user) return print('usage: login <user>'); pendingUser = c.user; setPrompt(); return; }
        if (c.type === 'logout') { session = null; setPrompt(); return print('Logged out.'); }
        if (c.type === 'unknown') return print('command not found: ' + c.cmd + '  (try help)');
        if (!session) return print('Not logged in. Try: login <user>');
        var files = session.files || [];
        function fileNamed(n) { for (var i = 0; i < files.length; i++) if (files[i].name === n) return files[i]; return null; }
        if (c.type === 'ls') return print(files.map(function (f) { return f.name + (f.sealed ? '   [sealed]' : ''); }));
        var f = fileNamed(c.file);
        if (c.type === 'cat') {
          if (!f) return print('No such file: ' + c.file);
          if (f.sealed) {
            var again = store.getNote('seal:ledger'), reopen = again ? Seal.tryOpen(channel(story, 'terminal'), again) : null;
            if (reopen && reopen.payload.kind === 'file') return print(reopen.payload.lines);
            return print('sealed. Use: open ' + f.name + ' <passphrase>');
          }
          return print(f.lines || []);
        }
        if (c.type === 'open') {
          if (!f) return print('No such file: ' + c.file);
          if (!f.sealed) return print(f.lines || []);
          var o = c.pass ? Seal.tryOpen(channel(story, 'terminal'), c.pass) : null;
          if (o && o.payload.kind === 'file') { remember(o.payload, c.pass); return print(o.payload.lines); }
          return print('Wrong passphrase.');
        }
      }
      form.onsubmit = function (ev) { ev.preventDefault(); var v = inp.value; inp.value = ''; runLine(v); inp.focus(); };
      [['help', 'help'], ['ls', 'ls'], ['clear', 'clear']].forEach(function (q) {
        var b = el('button', 'chip', q[0]); b.type = 'button'; b.onclick = function () { runLine(q[1]); inp.focus(); }; quick.appendChild(b);
      });
      form.appendChild(prompt); form.appendChild(inp); form.appendChild(go);
      [out, quick, form].forEach(function (n) { panel.appendChild(n); });
      view.appendChild(panel);
      print(['MARSH HOUSE / UNDERCROFT OFFICE', 'Terminal ready. Type help.']);
      // restore a previous session
      var saved = store.getNote('seal:office'), r0 = saved ? Seal.tryOpen(channel(story, 'terminal'), saved) : null;
      if (r0 && r0.payload.kind === 'terminal') start(r0.payload, true); else setPrompt();
    }

    // ---- vault ----
    var DIAL_TURNS = ['L', 'R', 'L']; // the combination is turned left, then right, then left
    function safeView() {
      head('The vault', '#/', 'Start');
      var panel = el('div', 'panel safe'), msg = el('p', 'msg'), entry = el('div', 'safe-entry'), W = root.Widgets;
      var steps = [], status = el('div', 'dial-steps'), lamps = [0, 1, 2].map(function () { var l = el('span', 'step-lamp'); status.appendChild(l); return l; });
      var inputs = [0, 1, 2].map(function (i) {
        var d = el('input', 'safe-dial'); d.type = 'number'; d.min = '0'; d.max = '99'; d.value = '00'; d.setAttribute('inputmode', 'numeric'); d.setAttribute('aria-label', 'Dial ' + (i + 1));
        d.onchange = function () { var n = Math.min(99, Math.max(0, parseInt(d.value, 10) || 0)); d.value = (n < 10 ? '0' : '') + n; };
        return d;
      });
      var go = el('button', '', 'Try the vault'); go.type = 'button';
      var door = el('div', 'vault-door'), guide = el('p', 'mute dial-guide'), dial = W ? W.vaultDial({ onSettle: settle }) : null;
      var again = el('button', 'chip', 'Start over'); again.type = 'button';
      if (dial) { door.appendChild(dial.el); door.appendChild(status); door.appendChild(again); cleanups.push(dial.destroy); }
      var keypad = el('details', 'safe-numbers'), sum = el('summary', '', 'Type the numbers instead'), dials = el('div', 'safe-dials');
      keypad.appendChild(sum); inputs.forEach(function (i) { dials.appendChild(i); }); keypad.appendChild(dials); keypad.appendChild(go); keypad.open = !dial;
      function paintSteps() { lamps.forEach(function (l, i) { l.classList.toggle('on', i < steps.length); }); }
      function reveal(payload) {
        entry.textContent = '';
        var lamp = el('button', 'lamp-btn', 'Light the lamp'); lamp.type = 'button';
        var box = el('div', 'safe-text'), end = el('div', 'safe-end');
        entry.appendChild(box); entry.appendChild(lamp); entry.appendChild(end);
        payload.lines.forEach(function (l) { box.appendChild(el('p', 'vm-line', l)); });
        lamp.onclick = function () {
          lamp.disabled = true; store.markSolved('story-finale');
          var fin = payload.finale || [];
          fin.forEach(function (l) { end.appendChild(el('p', 'vm-line lamp-line', l)); });
          var show = W ? W.lampScene(fin, function () { applyTestament(store); showRoll(end, false); }) : null;
          if (!show) { applyTestament(store); showRoll(end, false); }
        };
        if (store.isSolved('story-finale')) { lamp.disabled = true; applyTestament(store); (payload.finale || []).forEach(function (l) { end.appendChild(el('p', 'vm-line lamp-line', l)); }); showRoll(end, true); }
      }
      // the hidden true ending: only for a player who found the ledger and all three household lines
      function showRoll(end, instant) {
        var ep = epilogue(); if (!ep) return;
        remember(ep.payload, ep.code);
        var box = el('div', 'roll'), lines = ep.payload.lines.slice();
        end.appendChild(box);
        function add(l) { box.appendChild(el('p', 'vm-line lamp-line', l)); }
        function tail() {
          var row = el('form', 'row roll-sign'), name = el('input'), sgo = el('button', '', ep.payload.sign || 'Sign');
          name.type = 'text'; name.maxLength = 40; name.setAttribute('aria-label', 'Your name'); name.setAttribute('autocomplete', 'off'); name.placeholder = 'Your name';
          sgo.type = 'submit'; row.appendChild(name); row.appendChild(sgo);
          var done = el('p', 'vm-line lamp-line');
          function signed(n) { row.hidden = true; done.textContent = n + '. ' + (ep.payload.signed || '') + ' ' + (ep.payload.end || ''); }
          row.onsubmit = function (ev) { ev.preventDefault(); var n = name.value.replace(/\s+/g, ' ').trim(); if (!n) return; store.setNote('roll-name', n); signed(n); };
          box.appendChild(row); box.appendChild(done);
          var prev = store.getNote('roll-name'); if (prev) signed(prev);
        }
        if (instant) { lines.forEach(add); tail(); return; }
        (function step() { if (!lines.length) return tail(); add(lines.shift()); later(step, LINE_DELAY); })();
      }
      function attempt(code) {
        var r = Seal.tryOpen(channel(story, 'safe'), code);
        if (!r) { msg.className = 'msg err'; msg.textContent = 'The dials turn and stop. Nothing gives.'; return false; }
        msg.className = 'msg ok'; msg.textContent = 'Click. The vault opens.';
        door.classList.add('open'); keypad.hidden = true; go.hidden = true; guide.hidden = true; later(function () { door.hidden = true; }, 1400);
        remember(r.payload, code); reveal(r.payload);
        return true;
      }
      go.onclick = function () { attempt(safeCode(inputs.map(function (i) { return i.value; }))); };
      var WAY = { L: 'left (anticlockwise)', R: 'right (clockwise)' };
      // The dial calls this when you stop on a number for a moment. Returns true if it clicked in.
      function settle(n, d) {
        if (steps.length >= 3) return false;
        var want = DIAL_TURNS[steps.length];
        if (d !== want) { msg.className = 'msg'; msg.textContent = 'No click. Come at this number turning ' + WAY[want] + ': go a little past it and back.'; return false; }
        steps.push(n); paintSteps(); dial.reset(); msg.className = 'msg'; msg.textContent = '';
        if (steps.length < 3) { guide.textContent = 'Click. Now turn ' + WAY[DIAL_TURNS[steps.length]] + ' to the next number, and stop on it.'; return true; }
        var code = safeCode(steps); steps = []; setTimeout(function () { paintSteps(); if (!attempt(code)) guide.textContent = 'Turn ' + WAY.L + ' to the first number, ' + WAY.R + ' to the second, ' + WAY.L + ' to the third.'; }, 450);
        return true;
      }
      again.onclick = function () { steps = []; paintSteps(); dial.reset(); msg.textContent = ''; guide.textContent = 'Start again: turn ' + WAY.L + ' to the first number and stop on it.'; };
      if (dial) guide.textContent = 'Spin the dial. Turn ' + WAY.L + ' to the first number and stop on it: it clicks in by itself. Then ' + WAY.R + ', then ' + WAY.L + '.';
      [door, guide, msg, keypad, entry].forEach(function (n) { panel.appendChild(n); });
      view.appendChild(panel);
      var saved = store.getNote('seal:last-entry'), r0 = saved ? Seal.tryOpen(channel(story, 'safe'), saved) : null;
      if (r0) { door.hidden = true; keypad.hidden = true; guide.hidden = true; msg.className = 'msg ok'; msg.textContent = 'The vault stands open.'; reveal(r0.payload); }
    }

    // ---- recovered records ----
    var KIND_TAG = { radio: 'wireless', terminal: 'office', file: 'file', phone: 'call', finale: 'vault' };
    function when(ts) { try { var d = new Date(ts); return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
    // completion of one story: records found + its testament (the lamp, the bloom) out of everything that exists
    var TESTAMENT = { keeper: 'story-finale', gardener: 'story-bloom' };
    function progress(arc) {
      var meta = story.meta && story.meta.arcs && story.meta.arcs[arc], total = meta ? meta.records : 0;
      var have = found().filter(function (r) { return (r.arc || 'keeper') === arc; }).length, units = total + 1, got = have + (store.isSolved(TESTAMENT[arc]) ? 1 : 0);
      return { found: have, total: total, units: units, got: got, pct: units ? Math.round(100 * got / units) : 0 };
    }
    function recordList(arc) {
      var recs = found().filter(function (r) { return (r.arc || 'keeper') === arc; }), box = el('div'), pr = progress(arc);
      if (!recs.length && !pr.got) return null;
      box.appendChild(el('h2', '', 'What you have found'));
      var ol = el('ol', 'found-list');
      recs.forEach(function (r, i) {
        var li = el('li'), a = el('a', '', String(r.title)); a.href = '#/hidden/story-' + encodeURIComponent(r.id);
        li.appendChild(el('span', 'found-no', String(i + 1))); li.appendChild(a);
        li.appendChild(el('span', 'found-tag', KIND_TAG[r.kind] || r.kind)); if (r.at) li.appendChild(el('span', 'found-when', when(r.at)));
        ol.appendChild(li);
      });
      var missing = pr.units - pr.got, shown = Math.min(missing, 4);
      for (var k = 0; k < shown; k++) { var q = el('li', 'found-unknown'); q.appendChild(el('span', 'found-no', String(recs.length + k + 1))); q.appendChild(el('span', 'found-q', '???')); ol.appendChild(q); }
      box.appendChild(ol);
      if (missing > shown) box.appendChild(el('p', 'mute', 'and ' + (missing - shown) + ' more ???'));
      return box;
    }
    function recordView(sid) { // sid = 'story-<id>'
      var rec = null; found().forEach(function (r) { if ('story-' + r.id === sid) rec = r; });
      if (!rec) return ctx.notFound('No hidden page called "' + sid + '" is open to you.');
      var hub = ARC_HUB[rec.arc || 'keeper'] || '';
      head(String(rec.title), hub ? '#/hidden/' + hub : '#/hidden', hub ? 'Back' : 'Hidden');
      var body = el('div', 'panel');
      var lines = rec.lines || rec.voicemail || [];
      if (rec.kind === 'terminal') lines = (rec.motd || []).concat([''], (rec.files || []).map(function (f) { return f.name + (f.sealed ? '   [sealed]' : ''); }));
      lines.forEach(function (l) { body.appendChild(el('p', 'vm-line', String(l))); });
      if (rec.kind === 'terminal') { var a = el('a', '', 'Open the terminal'); a.href = '#/terminal'; body.appendChild(a); }
      view.appendChild(body);
    }

    // the extra block of a hub page: everything found for that story, and its testament
    function hub(arc) {
      if (!ARC_HUB[arc]) return null;
      var box = el('div', 'hub'), list = recordList(arc), pr = progress(arc);
      if (list || pr.got) {
        var bar = el('div', 'pbar'), fill = el('i'); fill.style.width = pr.pct + '%'; bar.appendChild(fill); bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuenow', String(pr.pct)); bar.setAttribute('aria-label', 'Completion');
        var cap = el('p', 'pbar-cap', pr.pct + '% complete' + (pr.pct >= 100 ? ' ✓' : ''));
        box.appendChild(cap); box.appendChild(bar);
      }
      if (list) box.appendChild(list);
      if (arc === 'keeper' && store.isSolved('story-finale')) box.appendChild(el('p', 'testament lamp-note', 'The lamp is lit.' + (store.getNote('roll-name') ? ' Seventy-fourth name on the roll: ' + store.getNote('roll-name') + '.' : '')));
      if (arc === 'gardener' && store.isSolved('story-bloom')) box.appendChild(el('p', 'testament bloom-note', 'The orchard is in bloom.'));
      return box.childNodes.length ? box : null;
    }

    // ---- greenhouse (the second story's puzzle) ----
    var TRADES = ['cook', 'baker', 'tailor', 'clockmaker', 'keeper', 'gardener'], PLOTS = [7, 12, 19, 41];
    function greenhouseView() {
      head('The glasshouse', '#/', 'Start');
      var panel = el('div', 'panel greenhouse'), plots = el('div', 'plots'), msg = el('p', 'msg'), entry = el('div', 'orchard-entry');
      var selects = PLOTS.map(function (n) {
        var box = el('label', 'plot'), s = el('select'); box.appendChild(el('span', 'plot-no', 'Plot ' + n));
        s.setAttribute('aria-label', 'Plot ' + n);
        var first = el('option', '', 'empty'); first.value = ''; s.appendChild(first);
        TRADES.forEach(function (tr) { var o = el('option', '', tr); o.value = tr; s.appendChild(o); });
        box.appendChild(s); plots.appendChild(box); return s;
      });
      var go = el('button', '', 'Plant'); go.type = 'button';
      function reveal(payload) {
        entry.textContent = '';
        var water = el('button', 'lamp-btn', payload.water || 'Water'), box = el('div', 'safe-text'), end = el('div', 'safe-end');
        entry.appendChild(box); entry.appendChild(water); entry.appendChild(end);
        payload.lines.forEach(function (l) { box.appendChild(el('p', 'vm-line', l)); });
        function done() { water.disabled = true; applyTestament(store); }
        water.onclick = function () {
          store.markSolved('story-bloom');
          var fin = payload.finale || [], W = root.Widgets;
          fin.forEach(function (l) { end.appendChild(el('p', 'vm-line bloom-line', l)); });
          var show = W ? W.petalScene(fin, done) : null;
          if (!show) done();
        };
        if (store.isSolved('story-bloom')) { done(); (payload.finale || []).forEach(function (l) { end.appendChild(el('p', 'vm-line bloom-line', l)); }); }
      }
      go.onclick = function () {
        var code = PLOTS.map(function (n, i) { return n + ' ' + selects[i].value; }).join(' '), r = Seal.tryOpen(channel(story, 'greenhouse'), code);
        if (!r) { msg.className = 'msg err'; msg.textContent = 'The saplings droop. Something is not planted where it belongs.'; return; }
        msg.className = 'msg ok'; msg.textContent = 'The trees lift their branches.';
        plots.hidden = true; go.hidden = true;
        remember(r.payload, code); reveal(personalize(r.payload, store.getNote('roll-name')));
      };
      [plots, go, msg, entry].forEach(function (n) { panel.appendChild(n); });
      view.appendChild(panel);
      var saved = store.getNote('seal:orchard'), r0 = saved ? Seal.tryOpen(channel(story, 'greenhouse'), saved) : null;
      if (r0) { plots.hidden = true; go.hidden = true; msg.className = 'msg ok'; msg.textContent = 'The orchard is planted.'; reveal(personalize(r0.payload, store.getNote('roll-name'))); }
    }

    return { found: found, progress: progress, greenhouse: greenhouseView, hub: hub, radio: radioView, terminal: terminalView, safe: safeView, recordList: recordList, recordView: recordView, tryPhone: function (code) { var r = tryPhone(story, code); if (r) r.payload = personalize(r.payload, store.getNote('roll-name')); return r; }, remember: remember, dispose: disposeAll };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Story = api;
})(typeof window !== 'undefined' ? window : globalThis);
