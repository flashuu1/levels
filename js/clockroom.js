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
        var cp = env.personalize(r.payload); cardBox.textContent = ''; cardBox.appendChild(el('h2', '', cp.title));
        cp.lines.forEach(function (l) { cardBox.appendChild(el('p', 'vm-line', l)); });
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

      // ---- the mechanisms behind the clocks: a pendulum to set, then a gear train to work out ----
      var mech = el('div', 'mechs'); shop.appendChild(mech);
      function finding(id) { return store.isSolved('story-' + id); }
      function noteBox(record) { var d = el('div', 'clock-note mech-note'); env.personalize(record).lines.forEach(function (l) { d.appendChild(el('p', 'vm-line', l)); }); return d; }
      function openRecord(id, code) { var r = Seal.tryOpen(ch(), code); return r && r.payload.id === id ? r : null; }

      function pendulumPanel() {
        var panel = el('div', 'mech pendulum-panel'), done = finding('pendulum');
        panel.appendChild(el('h3', 'clock-title', 'The pendulum'));
        panel.appendChild(el('p', 'mute', 'Slide the rod to change its length. The reading under it shows how long one full swing takes at that length. Press Set when it beats as the card says it must.'));
        var s = svg('svg', { viewBox: '0 0 200 190', class: 'pend-svg', 'aria-hidden': 'true' });
        s.appendChild(svg('rect', { x: 70, y: 2, width: 60, height: 8, rx: 3, class: 'pend-bracket' }));
        var arm = svg('g', { class: 'pend-arm' }), rod = svg('line', { x1: 100, y1: 8, x2: 100, y2: 100, class: 'pend-rod' }), bob = svg('circle', { cx: 100, cy: 100, r: 11, class: 'pend-bob' });
        arm.appendChild(rod); arm.appendChild(bob); s.appendChild(arm); panel.appendChild(s);
        var slider = el('input'), read = el('div', 'pend-read'), set = el('button', '', 'Set the pendulum'), pmsg = el('p', 'gh-msg');
        slider.type = 'range'; slider.min = '20'; slider.max = '200'; slider.step = '1'; slider.value = '60'; slider.setAttribute('aria-label', 'Pendulum length in centimetres');
        set.type = 'button'; pmsg.setAttribute('aria-live', 'polite');
        function paint() {
          var L = +slider.value, T = 2 * Math.PI * Math.sqrt(L / 100 / 9.8), y = 24 + L * 0.8;
          rod.setAttribute('y2', y); bob.setAttribute('cy', y); arm.style.animationDuration = T.toFixed(3) + 's'; read.textContent = L + ' cm: one full swing takes ' + T.toFixed(2) + ' s';
        }
        slider.oninput = paint; paint();
        set.onclick = function () {
          var L = +slider.value, code = 'pendulum ' + L, r = openRecord('pendulum', code);
          if (!r) { pmsg.className = 'gh-msg bad'; pmsg.textContent = 'It swings, but it does not beat true.'; return; }
          env.remember(r.payload, code); pmsg.className = 'gh-msg good'; pmsg.textContent = 'The case lets go of a drawer.'; slider.disabled = true; set.hidden = true; panel.appendChild(noteBox(r.payload)); draw();
        };
        panel.appendChild(slider); panel.appendChild(read); panel.appendChild(set); panel.appendChild(pmsg);
        if (done) { var d = openRecord('pendulum', store.getNote('seal:pendulum')); if (d) { slider.value = String(parseInt(store.getNote('seal:pendulum').split(' ')[1], 10) || 99); paint(); slider.disabled = true; set.hidden = true; panel.appendChild(noteBox(d.payload)); } }
        return panel;
      }

      function gearPath(cx, cy, r, teeth) {
        var d = '', step = 2 * Math.PI / teeth;
        for (var i = 0; i < teeth; i++) {
          var a = i * step, pts = [[r - 3, a - step * 0.28], [r + 3, a - step * 0.16], [r + 3, a + step * 0.16], [r - 3, a + step * 0.28]];
          pts.forEach(function (p, k) { d += (i === 0 && k === 0 ? 'M' : 'L') + (cx + Math.cos(p[1]) * p[0]).toFixed(2) + ' ' + (cy + Math.sin(p[1]) * p[0]).toFixed(2) + ' '; });
        }
        return d + 'Z';
      }
      function gearsPanel() {
        var panel = el('div', 'mech gears-panel'), done = finding('gears'), G = { crank: 10, wheel: 40, pinion: 12, minute: 60 };
        panel.appendChild(el('h3', 'clock-title', 'The gear train'));
        panel.appendChild(el('p', 'gear-task', 'The task: how many turns of the crank make the minute wheel turn exactly once? Work it out from the teeth, or measure it by turning the crank.'));
        panel.appendChild(el('p', 'mute', 'The small crank gear (top left) drives the large wheel. A pinion fixed to the shaft of the large wheel drives the minute wheel (the big one on the right). The number on each gear is its teeth. Drag round the crank to try it, and watch the two counters under the picture.'));
        var s = svg('svg', { viewBox: '0 0 250 200', class: 'gear-svg', 'aria-label': 'A gear train: a ' + G.crank + '-tooth crank gear drives a ' + G.wheel + '-tooth wheel; on the same shaft a ' + G.pinion + '-tooth pinion drives the ' + G.minute + '-tooth minute wheel.' });
        var K = 1.1, A = [80, 112], B = [80 + G.pinion * K + G.minute * K, 112], C = [80 - (G.wheel * K + G.crank * K) * 0.7071, 112 - (G.wheel * K + G.crank * K) * 0.7071];
        function gear(cx, cy, teeth, cls) { var g = svg('g', { class: 'gear ' + cls }); g.appendChild(svg('path', { d: gearPath(cx, cy, teeth * K, teeth) })); g.appendChild(svg('circle', { cx: cx, cy: cy, r: 3, class: 'gear-hub' })); return g; }
        var gB = gear(B[0], B[1], G.minute, 'g-minute'), gA = gear(A[0], A[1], G.wheel, 'g-wheel'), gP = gear(A[0], A[1], G.pinion, 'g-pinion'), gC = gear(C[0], C[1], G.crank, 'g-crank');
        [gB, gA, gP, gC].forEach(function (g) { s.appendChild(g); });
        function label(x, y, txt) { var tt = svg('text', { x: x, y: y, 'text-anchor': 'middle', class: 'gear-label' }); tt.textContent = txt; s.appendChild(tt); }
        label(A[0], A[1] - 18, String(G.wheel)); label(A[0], A[1] + 24, String(G.pinion)); label(B[0], B[1] + 4, String(G.minute)); label(C[0], C[1] - 18, String(G.crank));
        var handle = svg('circle', { cx: C[0] + 8, cy: C[1], r: 4, class: 'crank-handle' }); gC.appendChild(handle);
        panel.appendChild(s);
        var theta = 0, last = null, drag = false, turns = el('div', 'gear-read');
        function paint() {
          gC.setAttribute('transform', 'rotate(' + theta + ' ' + C[0] + ' ' + C[1] + ')');
          var wheel = -theta * G.crank / G.wheel, minute = theta * (G.crank / G.wheel) * (G.pinion / G.minute);
          gA.setAttribute('transform', 'rotate(' + wheel + ' ' + A[0] + ' ' + A[1] + ')'); gP.setAttribute('transform', 'rotate(' + wheel + ' ' + A[0] + ' ' + A[1] + ')');
          gB.setAttribute('transform', 'rotate(' + minute + ' ' + B[0] + ' ' + B[1] + ')');
          turns.textContent = 'crank turns: ' + (Math.abs(theta) / 360).toFixed(2) + '   minute wheel turns: ' + (Math.abs(minute) / 360).toFixed(2);
        }
        function ang(ev) { var r = s.getBoundingClientRect(), k = r.width / 250; return Math.atan2(ev.clientY - (r.top + C[1] * k), ev.clientX - (r.left + C[0] * k)) * 180 / Math.PI; }
        gC.style.cursor = 'grab'; gC.style.touchAction = 'none';
        gC.addEventListener('pointerdown', function (ev) { drag = true; last = ang(ev); try { gC.setPointerCapture(ev.pointerId); } catch (e) { /* ok */ } ev.preventDefault(); });
        gC.addEventListener('pointermove', function (ev) { if (!drag) return; var a = ang(ev), d = a - last; while (d > 180) d -= 360; while (d < -180) d += 360; last = a; theta += d; paint(); });
        function up() { drag = false; } gC.addEventListener('pointerup', up); gC.addEventListener('pointercancel', up);
        panel.appendChild(turns); paint();
        panel.appendChild(el('p', 'gear-ask', 'Crank turns for one turn of the minute wheel:'));
        var row = el('div', 'row clock-row'), inp = el('input', 'gear-answer'), go = el('button', '', 'Set the train'), gmsg = el('p', 'gh-msg');
        inp.type = 'text'; inp.setAttribute('inputmode', 'numeric'); inp.setAttribute('aria-label', 'Crank turns for one turn of the minute wheel'); inp.placeholder = 'crank turns'; inp.maxLength = 4; go.type = 'button'; gmsg.setAttribute('aria-live', 'polite');
        go.onclick = function () {
          var n = parseInt(inp.value, 10), code = 'gears ' + n, r = isNaN(n) ? null : openRecord('gears', code);
          if (!r) { gmsg.className = 'gh-msg bad'; gmsg.textContent = 'The train binds. That is not the ratio.'; return; }
          env.remember(r.payload, code); gmsg.className = 'gh-msg good'; gmsg.textContent = 'The minute wheel runs free.'; inp.disabled = true; go.hidden = true; panel.appendChild(noteBox(r.payload));
        };
        row.appendChild(inp); row.appendChild(go); panel.appendChild(row); panel.appendChild(gmsg);
        if (done) { var d = openRecord('gears', store.getNote('seal:gears')); if (d) { inp.value = String(parseInt(store.getNote('seal:gears').split(' ')[1], 10)); inp.disabled = true; go.hidden = true; panel.appendChild(noteBox(d.payload)); } }
        return panel;
      }
      function hatchPanel() {
        var panel = el('div', 'mech hatch-panel'), done = finding('hatch'), bk = env.channel('bakery');
        panel.appendChild(el('h3', 'clock-title', 'A warm hatch'));
        panel.appendChild(el('p', 'mute', 'Behind the pendulum case, in the brickwork, a small iron hatch you have not noticed before. The metal is warm to the touch.'));
        function show(r) { panel.appendChild(noteBox(r.payload)); }
        var open = el('button', '', 'Open the hatch'); open.type = 'button';
        open.onclick = function () { var r = Seal.tryOpen(bk, 'hatch open'); if (!r) return; env.remember(r.payload, 'hatch open'); open.hidden = true; show(r); draw(); };
        if (done) { var c = store.getNote('seal:hatch'), d = c ? Seal.tryOpen(bk, c) : null; if (d) { open.hidden = true; show(d); } }
        panel.appendChild(open);
        return panel;
      }
      function draw() {
        mech.textContent = '';
        if (finding('case-card')) mech.appendChild(pendulumPanel());
        if (finding('pendulum')) mech.appendChild(gearsPanel());
        if (finding('six-oclock')) mech.appendChild(hatchPanel());   // new, and unannounced: it appears once the bread bulletin has been heard
      }
      var origCheck = checkCase;
      checkCase = function () { origCheck(); draw(); };
      draw();
    }
    return { view: view };
  }
  var api = { create: create, CLOCKS: CLOCKS, fmt: fmt, code4: code4, parse: parse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Clockroom = api;
})(typeof window !== 'undefined' ? window : globalThis);
