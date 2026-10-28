(function (root) {
  'use strict';
  // The sealed story layer: a radio, an office terminal and a vault, plus the records you have recovered. Nothing here is listed
  // anywhere until found: records are ciphertext (see seal.js) and open only with the code the player discovers. Local only.
  var Seal = (typeof module !== 'undefined' && module.exports) ? require('./seal.js') : root.Seal;
  var LINE_DELAY = 1300;
  var ARC_HUB = { keeper: 'keepers-log', gardener: 'gardeners-verse', clockmaker: 'clockmakers-bench' }; // the plain hidden page that is each story's hub
  var KIND_ORDER = ['radio', 'terminal', 'file', 'phone', 'finale'];
  var KIND_TITLE = { radio: 'Transmissions', terminal: 'Office', file: 'Office files', phone: 'Voicemails', finale: 'The vault' };

  // ---- pure helpers (Node-testable) ----
  function allEntries(story) {
    var out = [];
    ['wireless', 'terminal', 'phone', 'safe', 'epilogue', 'greenhouse', 'clock', 'garden'].forEach(function (k) { if (story && Array.isArray(story[k])) story[k].forEach(function (e) { out.push(e); }); });
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
// Text that knows what you have done. Any string in a record may contain [[what|text if you have|text if you have not]], where
  // "what" is a record id (line-cook, ledger, ...), or one of: signed, lamp, bloom, clockwork. Evaluated when the record is shown.
  function has(store, what) {
    if (what === 'signed') return !!store.getNote('roll-name');
    if (what === 'lamp') return !!store.isSolved('story-finale');
    if (what === 'bloom') return !!store.isSolved('story-bloom');
    if (what === 'clockwork') return !!store.isSolved('story-clockwork');
    return !!(store.isSolved('story-' + what) || store.isSolved(what));
  }
  function expand(s, store) { return String(s).replace(/\[\[([A-Za-z0-9_:.-]+)\|([^|\]]*)\|([^\]]*)\]\]/g, function (m, what, yes, no) { return has(store, what) ? yes : no; }); }
  function personalize(payload, store) {
    if (!payload || typeof payload !== 'object') return payload;
    var name = store && store.getNote ? store.getNote('roll-name') : '';
    var swap = function (v) {
      if (typeof v === 'string') {
        v = expand(v, store);
        if (payload.arc === 'gardener') {
          v = v.replace('Seventy-three of them in the walled garden, and I have tended every one.', name
            ? 'Seventy-three of them in the walled garden, and a seventy-fourth by the gate since you signed the roll: ' + name + '. I have tended every one.'
            : 'Seventy-three of them in the walled garden, and a bare patch by the gate in case anyone ever signs the roll. I have tended every one.');
          if (name) v = v.replace('seventy-three trees let go of their petals at once.', 'seventy-four trees let go of their petals at once, the youngest by the gate.');
        }
        return v;
      }
      if (Array.isArray(v)) return v.map(swap);
      if (v && typeof v === 'object') { var o = {}; for (var k in v) o[k] = swap(v[k]); return o; }
      return v;
    };
    return swap(payload);
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
    if (cmd === 'su') return { type: 'su', user: rest[0] || '' };
    if (cmd === 'who') return { type: 'who' };
    if (cmd === 'last') return { type: 'last' };
    if (cmd === 'mail') return { type: 'mail', n: rest[0] ? parseInt(rest[0], 10) || 0 : 0 };
    if (cmd === 'cat' || cmd === 'type' || cmd === 'read') return { type: 'cat', file: (rest[0] || '').toLowerCase() };
    if (cmd === 'open') return { type: 'open', file: (rest[0] || '').toLowerCase(), pass: rest.slice(1).join(' ') };
    return { type: 'unknown', cmd: cmd };
  }

  // The whole site wears what you have done: a lit lamp and a blooming orchard. Called on every page view and when either happens.
  var clockTimer = null, current = null;
  // A story's effects (the lamp's glow, the petals, the ticking clock) show only while that story is complete. If a find is added
  // later the percentage drops below 100 and they switch off until you catch up.
  function complete(arc, flagFallback, store) { return current ? current.progress(arc).pct >= 100 : !!(store && store.isSolved(flagFallback)); }
  function applyTestament(store) {
    if (typeof document === 'undefined' || !document.body) return;
    var bloom = complete('gardener', 'story-bloom', store), clock = complete('clockmaker', 'story-clockwork', store);
    document.body.classList.toggle('lamp-lit', complete('keeper', 'story-finale', store));
    document.body.classList.toggle('orchard-bloom', bloom);
    document.body.classList.toggle('clockwork', clock);
    var field = document.getElementById('petal-field');
    if (bloom && !field) {
      field = document.createElement('div'); field.id = 'petal-field'; field.className = 'petal-field'; field.setAttribute('aria-hidden', 'true');
      for (var i = 0; i < 12; i++) { var p = document.createElement('span'); p.className = 'drift'; p.style.left = (4 + i * 8 + (i % 3) * 2) + '%'; p.style.animationDelay = (i * 1.7) + 's'; p.style.animationDuration = (16 + (i % 5) * 3) + 's'; field.appendChild(p); }
      document.body.appendChild(field);
    } else if (!bloom && field) field.remove();
    var hc = document.getElementById('testament-clock');
    if (clock && !hc) {
      var host = document.querySelector('header .brand'); if (host) {
        hc = document.createElement('span'); hc.id = 'testament-clock'; hc.className = 'testament-clock'; hc.setAttribute('aria-hidden', 'true');
        hc.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" class="tc-face"/><line id="tc-h" x1="12" y1="12" x2="12" y2="7" class="tc-hand"/><line id="tc-m" x1="12" y1="12" x2="12" y2="4" class="tc-hand"/><line id="tc-s" x1="12" y1="13" x2="12" y2="3.5" class="tc-sec"/></svg>';
        host.appendChild(hc); // inside the title so it stays on its line, even on a phone
        var tick = function () { var d = new Date(), s = d.getSeconds(), m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60; var set = function (id, a) { var n = document.getElementById(id); if (n) n.setAttribute('transform', 'rotate(' + a + ' 12 12)'); }; set('tc-h', h * 30); set('tc-m', m * 6); set('tc-s', s * 6); };
        tick(); clearInterval(clockTimer); clockTimer = setInterval(tick, 1000);
      }
    } else if (!clock && hc) { hc.remove(); clearInterval(clockTimer); }
  }
  // which story a hub page belongs to ('' for other pages)
  function arcOfPage(pageId) { for (var a in ARC_HUB) if (ARC_HUB[a] === pageId) return a; return ''; }
  function isComplete(arc) { return current ? current.progress(arc).pct >= 100 : false; }
  var api = { complete: isComplete, expand: expand, arcOfPage: arcOfPage, STORY_SLOTS: 8, personalize: personalize, applyTestament: applyTestament, ARC_HUB: ARC_HUB, allEntries: allEntries, formatFreq: formatFreq, phoneCandidates: phoneCandidates, tryPhone: tryPhone, safeCode: safeCode, parseCommand: parseCommand, KIND_ORDER: KIND_ORDER, KIND_TITLE: KIND_TITLE };

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
    var bySalt = null;
    function saltIndex() { if (!bySalt) { bySalt = {}; allEntries(story).forEach(function (e) { bySalt[e.salt] = e; }); } return bySalt; }
    function remember(payload, code) {
      if (!store.isSolved('story-' + payload.id)) store.markSolved('story-' + payload.id); // the first find keeps its time: it is the order you found things in
      store.setNote('seal:' + payload.id, code); // so the record can be reopened from the Hidden page
      var hit = Seal.tryOpen(allEntries(story), code); if (hit) store.setNote('salt:' + payload.id, hit.entry.salt); // and reopened with one decryption
      foundCache = null;
      if (ctx.updateProgress) ctx.updateProgress();
      applyTestament(store);
    }
    var foundCache = null;
    function openFound(k) {
      var id = k.slice(6), code = store.getNote('seal:' + id); if (!code) return null;
      var salt = store.getNote('salt:' + id), e = salt ? saltIndex()[salt] : null, p = e ? Seal.open(e, code) : null;
      if (p) return p;
      var r = Seal.tryOpen(allEntries(story), code); return r ? r.payload : null;
    }
    function found() {
      var raw = [];
      store.solvedIds().forEach(function (k) {
        if (k.indexOf('story-') !== 0) return;
        var p = openFound(k); if (p) { p.at = store.solvedAt ? store.solvedAt(k) : 0; raw.push(p); }
      });
      raw.sort(function (a, b) { return a.at - b.at; });
      return raw.map(function (p) { var q = personalize(p, store); q.at = p.at; return q; });
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
      visit('wireless'); head('The wireless', '#/', 'Start');
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

    function terminalView() { if (!root.Terminal) return ctx.notFound('Nothing here.'); root.Terminal.create(env()).view(); }

    // ---- vault ----
    var DIAL_TURNS = ['L', 'R', 'L']; // the combination is turned left, then right, then left
    function safeView() {
      visit('safe'); head('The vault', '#/', 'Start');
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

    // ---- rooms you have found: always one click away from the Hidden page ----
    var ROOMS = [
      { id: 'wireless', title: 'The wireless', href: '#/wireless' }, { id: 'phone', title: 'The phone line', href: '#/phone' }, { id: 'terminal', title: 'The terminal', href: '#/terminal' },
      { id: 'safe', title: 'The vault', href: '#/safe' }, { id: 'greenhouse', title: 'The glasshouse', href: '#/greenhouse' }, { id: 'garden', title: 'The walled garden', href: '#/garden' },
      { id: 'clockroom', title: 'The workshop', href: '#/clockroom' }, { id: 'tickets', title: 'The ticket archive', href: '#/tickets' },
    ];
    function visit(id) { if (!store.isSolved('room-' + id)) store.markSolved('room-' + id); }
    function rooms() {
      var seen = {}; found().forEach(function (r) { if (r.room) seen[r.room] = true; });
      return ROOMS.filter(function (r) { return seen[r.id] || store.isSolved('room-' + r.id); });
    }
    // ---- recovered records ----
    var KIND_TAG = { radio: 'wireless', terminal: 'office', file: 'file', phone: 'call', finale: 'vault' };
    function when(ts) { try { var d = new Date(ts); return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
    // completion of one story: records found + its testament (the lamp, the bloom) out of everything that exists
    var TESTAMENT = { keeper: 'story-finale', gardener: 'story-bloom', clockmaker: 'story-clockwork' };
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
      if (arc === 'clockmaker' && store.isSolved('story-clockwork')) box.appendChild(el('p', 'testament clock-note', 'The clocks are running.'));
      if (progress(arc).pct >= 100) box.appendChild(el('p', 'testament complete-note', '★ Complete. Everything in this story is found.'));
      return box.childNodes.length ? box : null;
    }

    // ---- the second and third stories' puzzles live in greenhouse.js and clockroom.js ----
    function env() {
      return { view: view, visit: visit, store: store, Seal: Seal, Widgets: root.Widgets, el: el, head: head, later: later, remember: remember, found: found, applyTestament: applyTestament,
        channel: function (n) { return channel(story, n); }, personalize: function (p) { return personalize(p, store); }, parseCommand: parseCommand, visit: visit };
    }
    function greenhouseView() { if (!root.Greenhouse) return ctx.notFound('Nothing here.'); root.Greenhouse.create(env()).view(); }
    function gardenView() { if (!root.Garden) return ctx.notFound('Nothing here.'); root.Garden.create(env()).view(); }
    function clockroomView() { if (!root.Clockroom) return ctx.notFound('Nothing here.'); root.Clockroom.create(env()).view(); }

    current = { progress: progress };
    return { rooms: rooms, visit: visit, arcOfPage: arcOfPage, found: found, progress: progress, greenhouse: greenhouseView, clockroom: clockroomView, garden: gardenView, hub: hub, radio: radioView, terminal: terminalView, safe: safeView, recordList: recordList, recordView: recordView, tryPhone: function (code) { var r = tryPhone(story, code); if (r) r.payload = personalize(r.payload, store); return r; }, remember: remember, dispose: disposeAll };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Story = api;
})(typeof window !== 'undefined' ? window : globalThis);
