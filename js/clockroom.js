(function (root) {
  'use strict';
  // The Clockmaker's workshop (the third story's puzzle): four stopped clocks, each named for something that happened on the night
  // of the lamp. Set the hands to the minute it happened and wind it; the records that say when are in the first story.
  var CLOCKS = [
    { key: 'lamp', title: 'The lamp goes dark' },
    { key: 'bar', title: 'The steamer crosses the bar' },
    { key: 'landing', title: 'She comes ashore' },
    { key: 'inquiry', title: 'The inquiry closes' },
  ];
  var NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  // minutes since 12:00 on a 12-hour dial -> "h:mm" and "hhmm"
  function fmt(m) { var h = Math.floor(m / 60) % 12 || 12; return h + ':' + pad(Math.floor(m) % 60); }
  function code4(m) { var h = Math.floor(m / 60) % 12; return pad(h) + pad(Math.floor(m) % 60); }
  function parse(text) { var m = /^\s*(\d{1,2})\s*[:.]?\s*(\d{2})\s*$/.exec(String(text)); if (!m) return null; var h = parseInt(m[1], 10), mi = parseInt(m[2], 10); if (h > 24 || mi > 59) return null; return (h % 12) * 60 + mi; }

  function create(env) {
    var el = env.el, store = env.store, Seal = env.Seal;
    function ch() { return env.channel('clock'); }
    function stored(id) { var c = store.getNote('seal:' + id); if (!c) return null; var r = Seal.tryOpen(ch(), c); return r && r.payload.id === id ? r : null; }

    function view() {
      env.visit('clockroom'); env.head('The workshop', '#/', 'Start');
      var shop = el('div', 'clockshop'), grid = el('div', 'clock-grid'), msg = el('p', 'gh-msg'), cardBox = el('div', 'clock-card');
      msg.setAttribute('aria-live', 'polite');
      shop.appendChild(el('div', 'shop-beam')); shop.appendChild(grid); shop.appendChild(msg); shop.appendChild(cardBox); env.view.appendChild(shop);
      var wound = {}, dials = {};

      function checkCase() {
        if (!CLOCKS.every(function (c) { return wound[c.key]; })) return;
        var code = CLOCKS.map(function (c) { return store.getNote('seal:clock-' + c.key); }).join(' '), r = Seal.tryOpen(ch(), code);
        if (!r || r.payload.id !== 'case-card') return;
        var first = !store.isSolved('story-case-card');
        env.remember(r.payload, code); store.markSolved('story-clockwork'); env.applyTestament(store);
        cardBox.textContent = ''; cardBox.appendChild(el('h2', '', r.payload.title));
        r.payload.lines.forEach(function (l) { cardBox.appendChild(el('p', 'vm-line', l)); });
        if (first) msg.textContent = 'Four clocks, ticking in time.';
      }

      CLOCKS.forEach(function (c) {
        var card = el('div', 'clock-card-face'), face = el('div', 'clock-face'), minutes = 0, wind = el('button', '', 'Wind'), tin = el('input', 'clock-time');
        card.appendChild(el('h3', 'clock-title', c.title));
        var s = svg('svg', { viewBox: '0 0 200 200', class: 'clock-svg', 'aria-hidden': 'true' });
        s.appendChild(svg('circle', { cx: 100, cy: 100, r: 94, class: 'clock-rim' })); s.appendChild(svg('circle', { cx: 100, cy: 100, r: 84, class: 'clock-dial' }));
        for (var i = 0; i < 60; i++) { var a = i * 6 * Math.PI / 180, big = i % 5 === 0, r1 = big ? 70 : 77; s.appendChild(svg('line', { x1: 100 + Math.sin(a) * r1, y1: 100 - Math.cos(a) * r1, x2: 100 + Math.sin(a) * 82, y2: 100 - Math.cos(a) * 82, class: big ? 'ctick big' : 'ctick' })); }
        for (var n = 1; n <= 12; n++) { var an = n * 30 * Math.PI / 180, t = svg('text', { x: 100 + Math.sin(an) * 58, y: 100 - Math.cos(an) * 58 + 5, 'text-anchor': 'middle', class: 'cnum' }); t.textContent = String(n); s.appendChild(t); }
        var hourH = svg('line', { x1: 100, y1: 108, x2: 100, y2: 56, class: 'hand hour' }), minH = svg('line', { x1: 100, y1: 112, x2: 100, y2: 30, class: 'hand minute' }), secH = svg('line', { x1: 100, y1: 118, x2: 100, y2: 24, class: 'hand second' });
        s.appendChild(hourH); s.appendChild(minH); s.appendChild(secH); s.appendChild(svg('circle', { cx: 100, cy: 100, r: 6, class: 'clock-boss' }));
        face.appendChild(s); face.tabIndex = 0; face.setAttribute('role', 'slider'); face.setAttribute('aria-label', c.title + ': set the time');
        tin.type = 'text'; tin.setAttribute('aria-label', c.key + ' clock time'); tin.setAttribute('inputmode', 'numeric'); tin.autocomplete = 'off'; tin.maxLength = 5;
        function paint() {
          minutes = ((minutes % 720) + 720) % 720;
          hourH.setAttribute('transform', 'rotate(' + (minutes / 720 * 360) + ' 100 100)'); minH.setAttribute('transform', 'rotate(' + ((minutes % 60) * 6) + ' 100 100)');
          if (document.activeElement !== tin) tin.value = fmt(minutes);
          face.setAttribute('aria-valuetext', fmt(minutes));
        }
        var last = null, drag = false;
        function ang(ev) { var r = face.getBoundingClientRect(); return Math.atan2(ev.clientY - (r.top + r.height / 2), ev.clientX - (r.left + r.width / 2)) * 180 / Math.PI; }
        face.style.touchAction = 'none';
        face.addEventListener('pointerdown', function (ev) { if (wound[c.key]) return; drag = true; last = ang(ev); try { face.setPointerCapture(ev.pointerId); } catch (e) { /* ok */ } face.focus({ preventScroll: true }); ev.preventDefault(); });
        face.addEventListener('pointermove', function (ev) { if (!drag) return; var a = ang(ev), d = a - last; while (d > 180) d -= 360; while (d < -180) d += 360; last = a; minutes += d / 6; paint(); });
        function up() { drag = false; } face.addEventListener('pointerup', up); face.addEventListener('pointercancel', up);
        face.addEventListener('keydown', function (ev) {
          if (wound[c.key]) return; var k = ev.key, d = k === 'ArrowRight' || k === 'ArrowUp' ? 1 : k === 'ArrowLeft' || k === 'ArrowDown' ? -1 : k === 'PageUp' ? 60 : k === 'PageDown' ? -60 : 0;
          if (!d) return; ev.preventDefault(); minutes += d * (ev.shiftKey && Math.abs(d) === 1 ? 5 : 1); paint();
        });
        tin.addEventListener('change', function () { var m = parse(tin.value); if (m === null) { tin.value = fmt(minutes); return; } minutes = m; paint(); });
        wind.type = 'button'; wind.setAttribute('aria-label', 'Wind the ' + c.key + ' clock');
        var note = el('div', 'clock-note');
        function show(payload) {
          card.classList.add('wound'); face.classList.add('wound'); face.setAttribute('aria-disabled', 'true'); wind.hidden = true; tin.disabled = true; wound[c.key] = true;
          note.textContent = ''; payload.lines.forEach(function (l) { note.appendChild(el('p', 'vm-line', l)); });
        }
        wind.onclick = function () {
          var code = c.key + ' ' + code4(minutes), r = Seal.tryOpen(ch(), code);
          if (!r || r.payload.id !== 'clock-' + c.key) { msg.className = 'gh-msg bad'; msg.textContent = 'It will not catch. That is not the hour.'; card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); return; }
          env.remember(r.payload, code); msg.className = 'gh-msg good'; msg.textContent = 'Tick.'; show(r.payload); checkCase();
        };
        var row = el('div', 'row clock-row'); row.appendChild(tin); row.appendChild(wind);
        card.appendChild(face); card.appendChild(row); card.appendChild(note); grid.appendChild(card);
        var done = stored('clock-' + c.key);
        if (done) { var parts = store.getNote('seal:clock-' + c.key).split(' '); minutes = parse(parts[1].slice(0, 2) + ':' + parts[1].slice(2)) || 0; paint(); show(env.personalize(done.payload)); } else paint();
        dials[c.key] = { paint: paint };
      });
      checkCase();
    }
    return { view: view };
  }
  var api = { create: create, CLOCKS: CLOCKS, fmt: fmt, code4: code4, parse: parse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Clockroom = api;
})(typeof window !== 'undefined' ? window : globalThis);
