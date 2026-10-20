(function (root) {
  'use strict';
  // Inline puzzle toolbox: an accordion of native <details> panels, plus the cipher workbench component that
  // the #/tools page shares. Adds mount() and cipherPanel() to window.Toolbox (pure helpers live in toolbox.js).
  // All user text goes through textContent / .value; innerHTML is used only for our own static markup and
  // the tracked handbook body_html.
  var T = root.Toolbox = root.Toolbox || {};
  var doc = root.document;
  var openState = Object.create(null); // panel id -> open?, kept for the page session only

  function el(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function attrs(e, o) { for (var k in o) e.setAttribute(k, o[k]); return e; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function labelled(id, text, control) {
    var l = attrs(el('label', null, text), { 'for': id });
    control.id = id;
    return [l, control];
  }
  function textarea(id, label, readonly) {
    var t = attrs(el('textarea'), { spellcheck: 'false', 'aria-label': label });
    t.id = id;
    if (readonly) t.readOnly = true;
    return t;
  }
  function needHelpers() {
    if (typeof T.letterFrequency !== 'function' || typeof T.runCipher !== 'function') throw new Error('Toolbox helpers (toolbox.js) are not loaded');
  }

  // ---- shared cipher workbench (used by #/tools and by the inline panel) ----
  var GROUPS = ['Substitution', 'Transposition', 'Encodings & bases', 'Existing'];
  // A list row shows at most CLIP characters of its result (a huge input would otherwise put 312 full copies into the page).
  var CLIP = 200;
  function clip(s) { s = String(s); return s.length > CLIP ? s.slice(0, CLIP) + '…' : s; }
  var AFFINE_A = [1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25];
  function cipherPanel(container, Ciphers) {
    needHelpers();
    container.textContent = '';
    if (!Ciphers) { container.appendChild(el('p', null, 'This section failed to load.')); return; }
    var opts = GROUPS.map(function (g) {
      return '<optgroup label="' + esc(g) + '">' + T.cipherOps.filter(function (o) { return T.cipherMeta[o[0]].group === g; })
        .map(function (o) { return '<option value="' + o[0] + '">' + esc(o[1]) + '</option>'; }).join('') + '</optgroup>';
    }).join('');
    container.innerHTML = // static markup only
      '<label for="cin">Input</label><textarea id="cin" spellcheck="false"></textarea>' +
      '<p class="row"><select id="cop" aria-label="Operation">' + opts + '</select>' +
      '<label id="cdecw" hidden><input type="checkbox" id="cdec" checked> <span id="cdectxt">Decrypt</span></label></p>' +
      '<p id="chelp" class="mute"></p>' +
      '<p class="row">' +
      '<label id="cshiftw">Shift <input type="number" id="cshift" value="3" step="1"></label>' +
      '<label id="ckeyw" hidden>Key <input type="text" id="ckey" autocomplete="off" spellcheck="false"></label>' +
      '<label id="crailsw" hidden>Rails <input type="number" id="crails" value="3" min="2" max="10" step="1"></label>' +
      '<label id="caw" hidden>a <input type="number" id="ca" value="5" step="1"></label>' +
      '<label id="cbw" hidden>b <input type="number" id="cb" value="8" step="1"></label>' +
      '<label id="ckeyhexw" hidden>Key (hex) <input type="text" id="ckeyhex" autocomplete="off" spellcheck="false" placeholder="e.g. 0a"></label>' +
      '<label id="cfromw" hidden>From base <input type="number" id="cfrom" value="10" min="2" max="36" step="1"></label>' +
      '<label id="ctow" hidden>To base <input type="number" id="cto" value="16" min="2" max="36" step="1"></label></p>' +
      '<p id="cerr" class="msg err" role="status" hidden>Invalid input</p>' +
      '<label for="cout">Output</label><textarea id="cout" readonly></textarea>' +
      '<p id="cstatus" class="sr-only" role="status" aria-live="polite"></p>' +
      '<p class="row"><button type="button" id="call">Try all Caesar shifts</button>' +
      '<button type="button" id="caffall" hidden>Try all valid (a, b)</button></p><div id="call-out"></div>';
    var $ = function (i) { return container.querySelector('#' + i); };
    var WRAP = { s: ['cshiftw'], k: ['ckeyw'], r: ['crailsw'], a: ['caw'], b: ['cbw'], h: ['ckeyhexw'], f: ['cfromw'], t: ['ctow'] };
    $('cop').value = 'caesar';
    function update() {
      var op = $('cop').value, meta = T.cipherMeta[op] || { fields: '', reversible: false, help: '' };
      for (var f in WRAP) $(WRAP[f][0]).hidden = meta.fields.indexOf(f) < 0;
      $('cdecw').hidden = !meta.reversible;
      $('cdectxt').textContent = op === 'xor' ? 'Decrypt (hex to text)' : 'Decrypt';
      $('caffall').hidden = op !== 'affine';
      $('chelp').textContent = meta.help;
      var out = T.runCipher(Ciphers, op, $('cin').value, $('cshift').value, $('ckey').value, $('cdec').checked,
        { rails: $('crails').value, a: $('ca').value, b: $('cb').value, keyHex: $('ckeyhex').value, from: $('cfrom').value, to: $('cto').value });
      $('cerr').hidden = out !== null;
      var val = out === null ? '' : out;
      if ($('cout').value !== val) { $('cout').value = val; announce(); }
    }
    // Screen readers do not reliably announce changes to a textarea's value, so a visually hidden status line says so (debounced while typing).
    var announceTimer = null;
    function announce() {
      if (announceTimer) root.clearTimeout(announceTimer);
      announceTimer = root.setTimeout(function () {
        announceTimer = null;
        var st = $('cstatus');
        if (!st) return;
        st.textContent = '';
        st.textContent = $('cout').value ? 'Output updated' : 'Output cleared';
      }, 400);
    }
    ['cin', 'cop', 'cshift', 'ckey', 'cdec', 'crails', 'ca', 'cb', 'ckeyhex', 'cfrom', 'cto'].forEach(function (i) {
      $(i).addEventListener('input', update);
      $(i).addEventListener('change', update);
    });
    function listAll(rows) { // plain text rows in a scrollable list
      var box = $('call-out'), ul = el('ul', 'plain scroll-list');
      box.textContent = '';
      rows.forEach(function (r) { ul.appendChild(el('li', null, r)); });
      ul.tabIndex = 0;
      ul.setAttribute('aria-label', 'Results');
      box.appendChild(ul);
    }
    $('call').onclick = function () {
      var box = $('call-out'), text = $('cin').value;
      box.textContent = '';
      var ul = el('ul', 'plain');
      for (var s = 1; s <= 25; s++) {
        var li = el('li'), b = el('strong', null, 'Shift ' + s + ': ');
        li.appendChild(b);
        li.appendChild(doc.createTextNode(Ciphers.caesar(text, s)));
        ul.appendChild(li);
      }
      box.appendChild(ul);
    };
    $('caffall').onclick = function () { // 12 valid a values x 26 b values = 312 rows, decrypting with each pair
      var rows = [], dec = $('cdec').checked, head = $('cin').value.slice(0, CLIP + 1); // affine is letter by letter, so the head is enough
      AFFINE_A.forEach(function (a) {
        for (var b = 0; b < 26; b++) rows.push('a=' + a + ' b=' + b + ': ' + clip(Ciphers.affine(head, a, b, dec)));
      });
      listAll(rows);
    };
    update();
  }

  // ---- Letters & text ----
  function lettersPanel(body) {
    var inp = textarea('lt-in', 'Text to analyse');
    var lab = attrs(el('label', null, 'Text'), { 'for': 'lt-in' });
    var freq = el('div', 'freq'); freq.id = 'lt-freq';
    var rows = {};
    var results = el('div', 'results');
    [['reverse', 'Reversed'], ['rwords', 'Words reversed'], ['sorted', 'Letters sorted'], ['stats', 'Stats']].forEach(function (r) {
      var row = el('div', 'res'), v = el('code', 'rv');
      row.appendChild(el('span', 'rl', r[1] + ': '));
      v.setAttribute('data-out', r[0]);
      row.appendChild(v); results.appendChild(row); rows[r[0]] = v;
    });
    body.appendChild(lab); body.appendChild(inp);
    body.appendChild(el('h4', null, 'Letter frequency'));
    body.appendChild(freq); body.appendChild(results);

    function update() {
      var v = inp.value, f = T.letterFrequency(v);
      freq.textContent = '';
      if (!f.length) freq.appendChild(el('p', 'mute', 'Type or paste some text to count its letters.'));
      var max = f.length ? f[0].count : 1;
      f.forEach(function (x) {
        var row = attrs(el('div', 'freq-row'), { 'data-letter': x.ch });
        var bar = el('span', 'fbar'), i = el('i');
        i.style.width = Math.max(2, Math.round(100 * x.count / max)) + '%';
        bar.appendChild(i);
        row.appendChild(el('span', 'fl', x.ch)); row.appendChild(bar);
        row.appendChild(el('span', 'fc', String(x.count))); row.appendChild(el('span', 'fp', x.pct + '%'));
        freq.appendChild(row);
      });
      var st = T.textStats(v);
      rows.reverse.textContent = T.reverseText(v);
      rows.rwords.textContent = T.reverseWords(v);
      rows.sorted.textContent = T.sortLetters(v);
      rows.stats.textContent = st.chars + ' characters, ' + st.letters + ' letters, ' + st.digits + ' digits, ' + st.words + ' words, ' + st.lines + ' lines';
    }
    inp.addEventListener('input', update);
    update();

    body.appendChild(el('h4', null, 'Anagram helper'));
    var a1 = attrs(el('input'), { type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: 'Available letters' });
    var a2 = attrs(el('input'), { type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: 'Word to test' });
    var res = attrs(el('p', 'msg'), { role: 'status' }); res.id = 'ana-res';
    var l1 = labelled('ana-letters', 'Letters you have', a1), l2 = labelled('ana-word', 'Word to form', a2);
    var r = el('div', 'row');
    r.appendChild(l1[0]); r.appendChild(l1[1]); r.appendChild(l2[0]); r.appendChild(l2[1]);
    body.appendChild(r); body.appendChild(res);
    function ana() {
      if (!/[A-Za-z]/.test(a2.value)) { res.className = 'msg'; res.textContent = ''; return; }
      var ok = T.canForm(a1.value, a2.value);
      res.className = 'msg ' + (ok ? 'ok' : 'err');
      res.textContent = ok ? 'Yes: it can be formed' : 'No: it cannot be formed';
    }
    a1.addEventListener('input', ana); a2.addEventListener('input', ana);
  }

  // ---- Alphabets & converters ----
  var BASES = [['2', 'Binary'], ['8', 'Octal'], ['10', 'Decimal'], ['16', 'Hex']];
  var CONVERTERS = [
    { id: 'a1z26-enc', title: 'Text to A1Z26', run: function (v) { return T.a1z26Encode(v); } },
    { id: 'a1z26-dec', title: 'A1Z26 to text', run: function (v) { return T.a1z26Decode(v); } },
    { id: 'nato-enc', title: 'Text to NATO', run: function (v) { return T.natoEncode(v); } },
    { id: 'nato-dec', title: 'NATO to text', run: function (v) { return T.natoDecode(v); } },
    { id: 'codes-enc', title: 'Text to codes', base: true, run: function (v, b) { return T.textToCodes(v, b); } },
    { id: 'codes-dec', title: 'Codes to text', base: true, run: function (v, b) { return T.codesToText(v, b); } }
  ];

  function converter(parent, spec) {
    var w = attrs(el('div', 'conv'), { 'data-conv': spec.id });
    w.appendChild(el('h4', null, spec.title));
    var inp = attrs(el('textarea', 'conv-in'), { rows: '2', spellcheck: 'false', 'aria-label': spec.title + ' input' });
    var out = attrs(el('textarea', 'conv-out'), { rows: '2', readonly: '', 'aria-label': spec.title + ' output' });
    out.readOnly = true;
    var err = el('p', 'msg err conv-err', 'Invalid input'); err.hidden = true;
    var sel = null;
    if (spec.base) {
      sel = attrs(el('select', 'conv-base'), { 'aria-label': spec.title + ' number base' });
      BASES.forEach(function (b) { var o = el('option', null, b[1]); o.value = b[0]; sel.appendChild(o); });
      sel.value = '16';
      w.appendChild(sel);
    }
    w.appendChild(inp); w.appendChild(err); w.appendChild(out);
    function update() {
      var r = spec.run(inp.value, sel ? Number(sel.value) : undefined);
      err.hidden = r !== null;
      out.value = r === null ? '' : r;
    }
    inp.addEventListener('input', update);
    if (sel) sel.addEventListener('change', update);
    update();
    parent.appendChild(w);
  }

  function tableDetails(title, headers, rows) {
    var d = el('details', 'tb-sub'), s = el('summary', null, title);
    d.appendChild(s);
    var wrap = el('div', 'tbl-wrap'), tbl = el('table'), thead = el('thead'), hr = el('tr');
    headers.forEach(function (h) { hr.appendChild(el('th', null, h)); });
    thead.appendChild(hr); tbl.appendChild(thead);
    var tb = el('tbody');
    rows.forEach(function (r) {
      var tr = el('tr');
      r.forEach(function (c) { tr.appendChild(el('td', null, c)); });
      tb.appendChild(tr);
    });
    tbl.appendChild(tb); wrap.appendChild(tbl); d.appendChild(wrap);
    return d;
  }

  function convertersPanel(body) {
    CONVERTERS.forEach(function (c) { converter(body, c); });
    body.appendChild(tableDetails('ASCII table (32-126)', ['Dec', 'Hex', 'Oct', 'Bin', 'Char'],
      T.asciiTable().map(function (r) { return [String(r.dec), r.hex, r.oct, r.bin, r.ch === ' ' ? '(space)' : r.ch]; })));
    body.appendChild(tableDetails('Morse table (A-Z, 0-9)', ['Char', 'Code'],
      T.morseTable().map(function (r) { return [r.ch, r.code]; })));
  }

  // ---- Notes ----
  function notesPanel(body, ctx) {
    var id = ctx.level && ctx.level.id;
    var ta = attrs(el('textarea'), { 'aria-label': 'Notes' });
    ta.id = 'notes';
    ta.value = ctx.store.getNote(id);
    ta.oninput = function () { ctx.store.setNote(id, ta.value); };
    body.appendChild(ta);
  }

  // ---- Technique tips (handbook sections, expanded inline) ----
  function tipsPanel(body, ctx) {
    var secs = ctx.data && Array.isArray(ctx.data.handbook) ? ctx.data.handbook.filter(function (s) { return s && typeof s.title === 'string'; }) : [];
    if (!secs.length) { body.appendChild(el('p', 'mute', 'No tips available.')); return; }
    var ul = el('ul', 'plain tips');
    secs.forEach(function (s, i) {
      var li = el('li'), btn = attrs(el('button', 'tip-btn', s.title), { type: 'button', 'aria-expanded': 'false' });
      var sec = attrs(el('div', 'tip-body'), { role: 'region' });
      sec.hidden = true;
      var bid = 'tip-' + i; sec.id = bid; btn.setAttribute('aria-controls', bid);
      btn.onclick = function () {
        var open = sec.hidden;
        if (open && !sec.firstChild) sec.innerHTML = typeof s.body_html === 'string' ? s.body_html : ''; // own tracked data
        sec.hidden = !open;
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      };
      li.appendChild(btn); li.appendChild(sec); ul.appendChild(li);
    });
    body.appendChild(ul);
  }

  var PANELS = [
    { id: 'cipher', title: 'Cipher workbench', build: function (b, ctx) { cipherPanel(b, ctx.Ciphers); } },
    { id: 'letters', title: 'Letters & text', build: lettersPanel },
    { id: 'converters', title: 'Alphabets & converters', build: convertersPanel },
    { id: 'notes', title: 'Notes', open: true, build: notesPanel },
    { id: 'tips', title: 'Technique tips', build: tipsPanel }
  ];

  function mount(container, ctx) {
    needHelpers();
    if (!ctx || !ctx.store) throw new Error('Toolbox.mount needs ctx.store');
    container.textContent = '';
    var wrap = el('div', 'toolbox');
    wrap.appendChild(el('h2', 'tb-title', 'Toolbox'));
    // Callers (the level page) may append panels of their own, e.g. {id, title, open, forceOpen, build(container)}.
    var extra = Array.isArray(ctx.extraPanels) ? ctx.extraPanels.filter(function (p) { return p && typeof p.id === 'string' && typeof p.build === 'function'; }) : [];
    PANELS.concat(extra).forEach(function (p) {
      var d = attrs(el('details', 'tb-panel'), { 'data-panel': p.id });
      d.appendChild(el('summary', null, p.title));
      var body = el('div', 'tb-body');
      try { p.build(body, ctx); } catch (e) {
        body.textContent = '';
        body.appendChild(el('p', 'msg err', 'This tool failed to load.'));
        if (root.console) root.console.error('Toolbox panel ' + p.id + ' failed:', e);
      }
      d.appendChild(body);
      d.open = p.forceOpen ? true : p.id in openState ? openState[p.id] : !!p.open;
      d.addEventListener('toggle', function () { openState[p.id] = d.open; });
      wrap.appendChild(d);
    });
    container.appendChild(wrap);
  }

  T.cipherPanel = cipherPanel;
  T.clipRow = clip;
  T.mount = mount;
})(typeof window !== 'undefined' ? window : this);
