(function (root) {
  'use strict';
  // The Master's office (the last step of the third story). The way in is given only by the clerk's voicemail. A locked drawer takes the
  // brass key that was buried in the garden; the letter inside says what to do with the stopped desk clock; setting it right and winding it
  // is the last find, so the story reaches 100% here and the finishing scene plays in the room itself.
  var NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }

  function create(env) {
    var el = env.el, store = env.store, Seal = env.Seal, CR = root.Clockroom;
    function ch() { return env.channel('harbour'); }
    function view() {
      env.visit('harbour'); env.head("The Master's office", '#/', 'Start');
      var room = el('div', 'harbour'), msg = el('p', 'gh-msg'); msg.setAttribute('aria-live', 'polite');
      env.view.appendChild(room);
      var hasKey = store.isSolved('story-dig-2'), selected = false;
      var done = (function () { var c = store.getNote('seal:harbour-desk'), r = c ? Seal.tryOpen(ch(), c) : null; return r && r.payload.id === 'harbour-desk' ? env.personalize(r.payload) : null; })();
      var letter = (function () { if (store.getNote('harbour:drawer') !== '1') return null; var r = Seal.tryOpen(ch(), 'desk key'); return r ? env.personalize(r.payload) : null; })();

      function draw() {
        room.textContent = '';
        var win = el('div', 'hb-window'); win.setAttribute('aria-hidden', 'true'); win.appendChild(el('span', 'hb-moon'));
        var lampy = el('span', 'hb-lamp'); win.appendChild(lampy); room.appendChild(win);
        room.appendChild(el('p', 'mute', 'The back room of the harbour office. A desk under the window, a clock on it, and a drawer.'));

        // the drawer
        var desk = el('div', 'hb-desk'), drawer = el('button', 'hb-drawer' + (letter ? ' open' : '')); drawer.type = 'button';
        drawer.setAttribute('aria-label', letter ? 'The desk drawer, open' : 'The desk drawer, locked'); drawer.appendChild(el('span', 'hb-keyhole'));
        drawer.onclick = function () {
          if (letter) return;
          if (!hasKey) { say('Locked. The lock is a clockmaker\'s work, with a name stamped on its plate: PELL & DAUGHTERS.', 'bad'); return; }
          if (!selected) { say('Locked. Something in your pocket might fit.', 'bad'); return; }
          store.setNote('harbour:drawer', '1'); var r = Seal.tryOpen(ch(), 'desk key'); letter = r ? env.personalize(r.payload) : null; selected = false; say('The key turns. The drawer slides open.', 'good'); draw();
        };
        desk.appendChild(drawer); room.appendChild(desk);
        if (hasKey && !letter) {
          var key = el('button', 'hb-key' + (selected ? ' selected' : '')); key.type = 'button'; key.setAttribute('aria-label', 'Brass key stamped PELL & DAUGHTERS'); key.appendChild(el('span', 'hb-key-bow')); key.appendChild(el('span', 'hb-key-stem'));
          key.onclick = function () { selected = !selected; draw(); };
          room.appendChild(key);
        }
        if (letter) { var note = el('div', 'hb-letter'); note.appendChild(el('h2', '', letter.title)); letter.lines.forEach(function (l) { note.appendChild(el('p', '', l)); }); room.appendChild(note); }

        // the desk clock
        var clock = el('div', 'hb-clock'), face = el('div', 'clock-face hb-face' + (done ? ' wound' : '')), minutes = 130, s = svg('svg', { viewBox: '0 0 200 200', class: 'clock-svg', 'aria-hidden': 'true' });
        s.appendChild(svg('circle', { cx: 100, cy: 100, r: 94, class: 'clock-rim' })); s.appendChild(svg('circle', { cx: 100, cy: 100, r: 84, class: 'clock-dial' }));
        for (var i = 0; i < 60; i++) { var a = i * 6 * Math.PI / 180, big = i % 5 === 0, r1 = big ? 70 : 77; s.appendChild(svg('line', { x1: 100 + Math.sin(a) * r1, y1: 100 - Math.cos(a) * r1, x2: 100 + Math.sin(a) * 82, y2: 100 - Math.cos(a) * 82, class: big ? 'ctick big' : 'ctick' })); }
        for (var n = 1; n <= 12; n++) { var an = n * 30 * Math.PI / 180, t = svg('text', { x: 100 + Math.sin(an) * 58, y: 100 - Math.cos(an) * 58 + 5, 'text-anchor': 'middle', class: 'cnum' }); t.textContent = String(n); s.appendChild(t); }
        var hourH = svg('line', { x1: 100, y1: 108, x2: 100, y2: 56, class: 'hand hour' }), minH = svg('line', { x1: 100, y1: 112, x2: 100, y2: 30, class: 'hand minute' }), secH = svg('line', { x1: 100, y1: 118, x2: 100, y2: 24, class: 'hand second' });
        s.appendChild(hourH); s.appendChild(minH); s.appendChild(secH); s.appendChild(svg('circle', { cx: 100, cy: 100, r: 6, class: 'clock-boss' }));
        face.appendChild(s); face.tabIndex = 0; face.setAttribute('role', 'slider'); face.setAttribute('aria-label', "The Master's desk clock: set the time");
        var tin = el('input', 'clock-time'), wind = el('button', '', 'Wind'), row = el('div', 'row clock-row');
        tin.type = 'text'; tin.setAttribute('aria-label', 'desk clock time'); tin.setAttribute('inputmode', 'numeric'); tin.autocomplete = 'off'; tin.maxLength = 5; wind.type = 'button'; wind.setAttribute('aria-label', 'Wind the desk clock');
        var usable = !!letter && !done;
        function paint() {
          minutes = ((minutes % 720) + 720) % 720;
          hourH.setAttribute('transform', 'rotate(' + (minutes / 720 * 360) + ' 100 100)'); minH.setAttribute('transform', 'rotate(' + ((minutes % 60) * 6) + ' 100 100)');
          if (document.activeElement !== tin) tin.value = CR.fmt(minutes);
        }
        var last = null, drag = false;
        function ang(ev) { var r = face.getBoundingClientRect(); return Math.atan2(ev.clientY - (r.top + r.height / 2), ev.clientX - (r.left + r.width / 2)) * 180 / Math.PI; }
        face.style.touchAction = 'none';
        face.addEventListener('pointerdown', function (ev) { if (!usable) { if (!done) say('The clock is stopped and its winder is stiff.', 'bad'); return; } drag = true; last = ang(ev); try { face.setPointerCapture(ev.pointerId); } catch (e) { /* ok */ } ev.preventDefault(); });
        face.addEventListener('pointermove', function (ev) { if (!drag) return; var a2 = ang(ev), d = a2 - last; while (d > 180) d -= 360; while (d < -180) d += 360; last = a2; minutes += d / 6; paint(); });
        function up() { drag = false; } face.addEventListener('pointerup', up); face.addEventListener('pointercancel', up);
        face.addEventListener('keydown', function (ev) { if (!usable) return; var k = ev.key, d = k === 'ArrowRight' || k === 'ArrowUp' ? 1 : k === 'ArrowLeft' || k === 'ArrowDown' ? -1 : k === 'PageUp' ? 60 : k === 'PageDown' ? -60 : 0; if (!d) return; ev.preventDefault(); minutes += d * (ev.shiftKey && Math.abs(d) === 1 ? 5 : 1); paint(); });
        tin.addEventListener('change', function () { var m = CR.parse(tin.value); if (m === null) { tin.value = CR.fmt(minutes); return; } minutes = m; paint(); });
        tin.disabled = !usable; wind.disabled = !usable;
        wind.onclick = function () {
          var code = 'desk clock ' + CR.code4(minutes), r = Seal.tryOpen(ch(), code);
          if (!r || r.payload.id !== 'harbour-desk') { say('The clock coughs, and stops again.', 'bad'); return; }
          env.remember(r.payload, code); done = env.personalize(r.payload); say('Tick.', 'good'); draw();   // the story reaches 100% here: its finishing scene plays now
        };
        if (done) { var sp = (store.getNote('seal:harbour-desk') || '').split(' ')[2] || DESK; minutes = CR.parse(sp.slice(0, 2) + ':' + sp.slice(2)) || 290; }
        row.appendChild(tin); row.appendChild(wind); clock.appendChild(face); clock.appendChild(row); room.appendChild(clock); paint();
        if (done) { var fin = el('div', 'gh-finale hb-finale'); done.lines.forEach(function (l) { fin.appendChild(el('p', 'vm-line', l)); }); room.appendChild(fin); }
        room.appendChild(msg);
      }
      var DESK = '0450';
      function say(t, cls) { msg.className = 'gh-msg ' + (cls || ''); msg.textContent = t; }
      draw();
    }
    return { view: view };
  }
  var api = { create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Harbour = api;
})(typeof window !== 'undefined' ? window : globalThis);
