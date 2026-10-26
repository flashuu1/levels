(function (root) {
  'use strict';
  // The sealed story layer: a radio, an office terminal and a vault, plus the records you have recovered. Nothing here is listed
  // anywhere until found: records are ciphertext (see seal.js) and open only with the code the player discovers. Local only.
  var Seal = (typeof module !== 'undefined' && module.exports) ? require('./seal.js') : root.Seal;
  var LINE_DELAY = 1300;
  var KIND_ORDER = ['radio', 'terminal', 'file', 'phone', 'finale'];
  var KIND_TITLE = { radio: 'Transmissions', terminal: 'Office', file: 'Office files', phone: 'Voicemails', finale: 'The vault' };

  // ---- pure helpers (Node-testable) ----
  function allEntries(story) {
    var out = [];
    ['wireless', 'terminal', 'phone', 'safe', 'epilogue'].forEach(function (k) { if (story && Array.isArray(story[k])) story[k].forEach(function (e) { out.push(e); }); });
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

  var api = { allEntries: allEntries, formatFreq: formatFreq, phoneCandidates: phoneCandidates, tryPhone: tryPhone, safeCode: safeCode, parseCommand: parseCommand, KIND_ORDER: KIND_ORDER, KIND_TITLE: KIND_TITLE };

  // ---- views (browser only) ----
  api.create = function (ctx) {
    var view = ctx.view, store = ctx.store, story = (ctx.hidden && ctx.hidden.story) || {};
    var timers = [];
    function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
    function dispose() { timers.forEach(clearTimeout); timers = []; }
    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
    function head(title, backHref, backText) {
      view.textContent = '';
      var p = el('p'), a = el('a', '', '← ' + backText); a.href = backHref; p.appendChild(a); view.appendChild(p);
      view.appendChild(el('h1', '', title));
    }
    function remember(payload, code) {
      store.markSolved('story-' + payload.id);
      store.setNote('seal:' + payload.id, code); // so the record can be reopened from the Hidden page
      if (ctx.updateProgress) ctx.updateProgress();
    }
    function found() {
      var entries = allEntries(story), out = [];
      store.solvedIds().forEach(function (k) {
        if (k.indexOf('story-') !== 0) return;
        var code = store.getNote('seal:' + k.slice(6)); if (!code) return;
        var r = Seal.tryOpen(entries, code); if (r) out.push(r.payload);
      });
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
      var freqBox = el('div', 'dial-freq', '88.0'), row = el('div', 'row dial-row');
      var slider = el('input'); slider.type = 'range'; slider.min = '50'; slider.max = '110'; slider.step = '0.1'; slider.value = '88'; slider.setAttribute('aria-label', 'Frequency slider');
      var num = el('input'); num.type = 'number'; num.min = '50'; num.max = '110'; num.step = '0.1'; num.value = '88.0'; num.setAttribute('inputmode', 'decimal'); num.setAttribute('aria-label', 'Frequency');
      var down = el('button', '', '− 0.1'), up = el('button', '', '+ 0.1'), go = el('button', '', 'Listen'), skip = el('button', '', 'Skip to end');
      down.type = up.type = go.type = skip.type = 'button'; skip.hidden = true;
      function setF(v) { var n = Math.min(110, Math.max(50, parseFloat(v))); if (!isFinite(n)) return; var s = formatFreq(n); slider.value = s; num.value = s; freqBox.textContent = s; }
      slider.oninput = function () { setF(slider.value); };
      num.onchange = function () { setF(num.value); };
      down.onclick = function () { setF(parseFloat(num.value) - 0.1); };
      up.onclick = function () { setF(parseFloat(num.value) + 0.1); };
      var playing = null;
      function staticLine() { var s = '', c = '#%&*+=/\\|~^'; for (var i = 0; i < 34; i++) s += c.charAt(Math.floor(Math.random() * c.length)); return s; }
      go.onclick = function () {
        dispose(); playing = null; skip.hidden = true; tr.textContent = '';
        var f = formatFreq(num.value), r = Seal.tryOpen(channel(story, 'wireless'), f);
        if (!r) { screen.textContent = f + ' MHz: ' + staticLine(); return; }
        screen.textContent = f + ' MHz: signal. Recording saved to Hidden.';
        remember(r.payload, f);
        skip.hidden = false;
        playing = play(r.payload.lines, tr, function () { skip.hidden = true; });
      };
      skip.onclick = function () { if (playing) playing.skip(); skip.hidden = true; };
      [down, up, go].forEach(function (b) { row.appendChild(b); });
      var saved = found().filter(function (r) { return r.kind === 'radio' && r.freq; }).sort(function (a, b) { return parseFloat(a.freq) - parseFloat(b.freq); });
      var chips = el('div', 'chips radio-found');
      saved.forEach(function (r) { var b = el('button', 'chip', r.freq); b.type = 'button'; b.title = 'Tune to ' + r.freq; b.onclick = function () { setF(r.freq); go.onclick(); }; chips.appendChild(b); });
      [screen, freqBox, slider, num, row].forEach(function (n) { panel.appendChild(n); });
      if (saved.length) { panel.appendChild(el('p', 'mute', 'Stations you have found:')); panel.appendChild(chips); }
      [skip, tr].forEach(function (n) { panel.appendChild(n); });
      view.appendChild(panel);
      view.appendChild(el('p', 'mute', 'A wireless set with one dial. Most of the band is static.'));
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
    function safeView() {
      head('The vault', '#/', 'Start');
      var panel = el('div', 'panel safe'), dials = el('div', 'safe-dials'), msg = el('p', 'msg'), entry = el('div', 'safe-entry');
      var inputs = [0, 1, 2].map(function (i) {
        var d = el('input', 'safe-dial'); d.type = 'number'; d.min = '0'; d.max = '99'; d.value = '00'; d.setAttribute('inputmode', 'numeric'); d.setAttribute('aria-label', 'Dial ' + (i + 1));
        d.onchange = function () { var n = Math.min(99, Math.max(0, parseInt(d.value, 10) || 0)); d.value = (n < 10 ? '0' : '') + n; };
        dials.appendChild(d); return d;
      });
      var go = el('button', '', 'Try the vault'); go.type = 'button';
      function reveal(payload, instant) {
        entry.textContent = '';
        var lamp = el('button', 'lamp-btn', 'Light the lamp'); lamp.type = 'button';
        var box = el('div', 'safe-text'), end = el('div', 'safe-end');
        entry.appendChild(box); entry.appendChild(lamp); entry.appendChild(end);
        payload.lines.forEach(function (l) { box.appendChild(el('p', 'vm-line', l)); });
        lamp.onclick = function () {
          lamp.disabled = true; document.body.classList.add('lamp-lit'); store.markSolved('story-finale');
          if (ctx.updateProgress) ctx.updateProgress();
          var after = (payload.finale || []).length * LINE_DELAY;
          (payload.finale || []).forEach(function (l, i) { later(function () { end.appendChild(el('p', 'vm-line lamp-line', l)); }, i * LINE_DELAY); });
          later(function () { showRoll(end, false); }, after);
        };
        if (store.isSolved('story-finale')) { lamp.disabled = true; document.body.classList.add('lamp-lit'); (payload.finale || []).forEach(function (l) { end.appendChild(el('p', 'vm-line lamp-line', l)); }); showRoll(end, true); }
      }
      // the hidden true ending: only for a player who found the ledger and all three household lines
      function showRoll(end, instant) {
        var ep = epilogue(); if (!ep) return;
        remember(ep.payload, ep.code);
        var box = el('div', 'roll'), lines = ep.payload.lines.slice();
        end.appendChild(box);
        function add(l) { box.appendChild(el('p', 'vm-line lamp-line', l)); }
        function tail() {
          var row = el('form', 'row roll-sign'), name = el('input'), go = el('button', '', ep.payload.sign || 'Sign');
          name.type = 'text'; name.maxLength = 40; name.setAttribute('aria-label', 'Your name'); name.setAttribute('autocomplete', 'off'); name.placeholder = 'Your name';
          go.type = 'submit'; row.appendChild(name); row.appendChild(go);
          var done = el('p', 'vm-line lamp-line');
          function signed(n) { row.hidden = true; done.textContent = n + '. ' + (ep.payload.signed || '') + ' ' + (ep.payload.end || ''); }
          row.onsubmit = function (ev) { ev.preventDefault(); var n = name.value.replace(/\s+/g, ' ').trim(); if (!n) return; store.setNote('roll-name', n); signed(n); };
          box.appendChild(row); box.appendChild(done);
          var prev = store.getNote('roll-name'); if (prev) signed(prev);
        }
        if (instant) { lines.forEach(add); tail(); return; }
        (function step() { if (!lines.length) return tail(); add(lines.shift()); later(step, LINE_DELAY); })();
      }
      go.onclick = function () {
        var code = safeCode(inputs.map(function (i) { return i.value; })), r = Seal.tryOpen(channel(story, 'safe'), code);
        if (!r) { msg.className = 'msg err'; msg.textContent = 'The dials turn and stop. Nothing gives.'; return; }
        msg.className = 'msg ok'; msg.textContent = 'Click. The vault opens.';
        dials.hidden = true; go.hidden = true;
        remember(r.payload, code); reveal(r.payload);
      };
      [dials, go, msg, entry].forEach(function (n) { panel.appendChild(n); });
      view.appendChild(panel);
      var saved = store.getNote('seal:last-entry'), r0 = saved ? Seal.tryOpen(channel(story, 'safe'), saved) : null;
      if (r0) { dials.hidden = true; go.hidden = true; msg.className = 'msg ok'; msg.textContent = 'The vault stands open.'; reveal(r0.payload); }
    }

    // ---- recovered records ----
    function recordList() {
      var recs = found(), box = el('div');
      if (!recs.length) return null;
      KIND_ORDER.forEach(function (kind) {
        var of = recs.filter(function (r) { return r.kind === kind; });
        if (!of.length) return;
        box.appendChild(el('h2', '', KIND_TITLE[kind] || kind));
        var ul = el('ul', 'plain');
        of.forEach(function (r) { var li = el('li'), a = el('a', '', String(r.title)); a.href = '#/hidden/story-' + encodeURIComponent(r.id); li.appendChild(a); ul.appendChild(li); });
        box.appendChild(ul);
      });
      return box;
    }
    function recordView(sid) { // sid = 'story-<id>'
      var rec = null; found().forEach(function (r) { if ('story-' + r.id === sid) rec = r; });
      if (!rec) return ctx.notFound('No hidden page called "' + sid + '" is open to you.');
      head(String(rec.title), '#/hidden', 'Hidden');
      var body = el('div', 'panel');
      var lines = rec.lines || rec.voicemail || [];
      if (rec.kind === 'terminal') lines = (rec.motd || []).concat([''], (rec.files || []).map(function (f) { return f.name + (f.sealed ? '   [sealed]' : ''); }));
      lines.forEach(function (l) { body.appendChild(el('p', 'vm-line', String(l))); });
      if (rec.kind === 'terminal') { var a = el('a', '', 'Open the terminal'); a.href = '#/terminal'; body.appendChild(a); }
      view.appendChild(body);
    }

    return { radio: radioView, terminal: terminalView, safe: safeView, recordList: recordList, recordView: recordView, tryPhone: function (code) { return tryPhone(story, code); }, remember: remember, dispose: dispose };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Story = api;
})(typeof window !== 'undefined' ? window : globalThis);
