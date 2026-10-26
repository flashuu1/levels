(function (root) {
  'use strict';
  // Hand-made controls for the story layer: a turnable knob, a radio box, a combination dial, and two full-screen scenes.
  // Pure DOM + SVG + CSS; no libraries, no network. Everything that animates stops under prefers-reduced-motion.
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function svg(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function reduced() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function wrap180(d) { while (d > 180) d -= 360; while (d < -180) d += 360; return d; }

  // ---- knob: drag round it (mouse, touch or pen) or use the arrow keys ----
  // opts: { label, bounded: {degMin, degMax}|null, ticks, onTurn(deltaDeg, rotation), onKey(sign) }
  function knob(opts) {
    var box = el('div', 'knob'), s = svg('svg', { viewBox: '0 0 100 100', class: 'knob-svg', 'aria-hidden': 'true' });
    s.appendChild(svg('circle', { cx: 50, cy: 50, r: 46, class: 'knob-rim' }));
    s.appendChild(svg('circle', { cx: 50, cy: 50, r: 38, class: 'knob-face' }));
    var spin = svg('g', { class: 'knob-spin' });
    for (var i = 0; i < 12; i++) spin.appendChild(svg('line', { x1: 50, y1: 14, x2: 50, y2: 22, class: 'knob-grip', transform: 'rotate(' + i * 30 + ' 50 50)' }));
    spin.appendChild(svg('line', { x1: 50, y1: 10, x2: 50, y2: 30, class: 'knob-mark' }));
    s.appendChild(spin); box.appendChild(s);
    box.tabIndex = 0; box.setAttribute('role', 'slider'); box.setAttribute('aria-label', opts.label || 'Knob');
    var rotation = 0, last = null, dragging = false, area = opts.area || box; // area: the element you may grab (the whole dial face, say)
    function paint() { spin.setAttribute('transform', 'rotate(' + rotation + ' 50 50)'); }
    function angleOf(ev) { var r = area.getBoundingClientRect(); return Math.atan2(ev.clientY - (r.top + r.height / 2), ev.clientX - (r.left + r.width / 2)) * 180 / Math.PI; }
    function turn(d) {
      var b = opts.bounded, next = rotation + d;
      if (b) next = Math.max(b.degMin, Math.min(b.degMax, next));
      var eff = next - rotation; rotation = next; paint();
      if (eff !== 0 || !b) opts.onTurn(eff, rotation);
    }
    area.style.touchAction = 'none';
    area.addEventListener('pointerdown', function (ev) { dragging = true; last = angleOf(ev); try { area.setPointerCapture(ev.pointerId); } catch (e) { /* ok */ } box.classList.add('turning'); try { box.focus({ preventScroll: true }); } catch (e) { /* ok */ } ev.preventDefault(); });
    area.addEventListener('pointermove', function (ev) { if (!dragging) return; var a = angleOf(ev), d = wrap180(a - last); last = a; if (d) turn(d); });
    function up() { dragging = false; box.classList.remove('turning'); }
    area.addEventListener('pointerup', up); area.addEventListener('pointercancel', up);
    box.addEventListener('keydown', function (ev) {
      var sign = ev.key === 'ArrowRight' || ev.key === 'ArrowUp' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowDown' ? -1 : 0;
      if (!sign) return; ev.preventDefault();
      if (opts.onKey) opts.onKey(sign * (ev.shiftKey ? 10 : 1)); else turn(sign * 3.6);
    });
    return { el: box, setRotation: function (r) { rotation = r; paint(); }, getRotation: function () { return rotation; }, aria: function (n, text) { box.setAttribute('aria-valuenow', String(n)); if (text) box.setAttribute('aria-valuetext', text); } };
  }

  // ---- radio: a wooden box with a scale, a needle, a speaker and a tuning knob ----
  // opts: { min, max, value, onTune(freqString) }   -> { el, setFreq, getFreq, setLocked, destroy }
  function radioBox(opts) {
    var min = opts.min, max = opts.max, span = max - min, DEG = { degMin: -150, degMax: 150 };
    var box = el('div', 'radio-box'), top = el('div', 'radio-top'), win = el('div', 'radio-window'), grille = el('div', 'radio-grille'), canvas = el('canvas', 'radio-static');
    canvas.width = 180; canvas.height = 54; canvas.setAttribute('aria-hidden', 'true');
    var scale = svg('svg', { viewBox: '0 0 300 56', class: 'radio-scale', 'aria-hidden': 'true' });
    for (var f = min; f <= max; f += 2) {
      var x = 10 + (f - min) / span * 280, big = f % 10 === 0;
      scale.appendChild(svg('line', { x1: x, y1: big ? 8 : 14, x2: x, y2: 24, class: big ? 'tick big' : 'tick' }));
      if (big) { var t = svg('text', { x: x, y: 40, class: 'tick-label', 'text-anchor': 'middle' }); t.textContent = String(f); scale.appendChild(t); }
    }
    var needle = svg('line', { x1: 10, y1: 2, x2: 10, y2: 50, class: 'needle' }); scale.appendChild(needle);
    win.appendChild(scale);
    var lamp = el('span', 'on-air', 'ON AIR'); lamp.setAttribute('aria-hidden', 'true');
    top.appendChild(win); top.appendChild(lamp);
    var lower = el('div', 'radio-lower'), kn = knob({ label: 'Tuning knob', bounded: DEG, onTurn: function (d, rot) { set((rot - DEG.degMin) / (DEG.degMax - DEG.degMin) * span + min, true); }, onKey: function (n) { set(freq + n * 0.1, false); } });
    kn.el.classList.add('radio-knob');
    grille.appendChild(canvas); lower.appendChild(grille); lower.appendChild(kn.el);
    box.appendChild(top); box.appendChild(lower);
    var freq = opts.value, locked = false, raf = 0, ctx = canvas.getContext && canvas.getContext('2d'), tick = 0, dead = false;
    function fmt(v) { return (Math.round(v * 10) / 10).toFixed(1); }
    function paint() {
      needle.setAttribute('x1', 10 + (freq - min) / span * 280); needle.setAttribute('x2', 10 + (freq - min) / span * 280);
      kn.aria(fmt(freq), fmt(freq) + ' megahertz');
    }
    function set(v, fromKnob) {
      v = Math.max(min, Math.min(max, parseFloat(v))); if (!isFinite(v)) return;
      freq = Math.round(v * 10) / 10;
      if (!fromKnob) kn.setRotation(DEG.degMin + (freq - min) / span * (DEG.degMax - DEG.degMin));
      paint(); if (opts.onTune) opts.onTune(fmt(freq));
    }
    function draw() {
      if (dead || !ctx) return;
      raf = requestAnimationFrame(draw);
      if (++tick % 4) return; // about 15 frames a second
      var w = canvas.width, h = canvas.height; ctx.fillStyle = '#0b0d10'; ctx.fillRect(0, 0, w, h);
      if (locked) { ctx.strokeStyle = '#f2b84b'; ctx.lineWidth = 2; ctx.beginPath(); for (var x = 0; x < w; x++) { var y = h / 2 + Math.sin(x / 7 + tick / 5) * (h / 4) * Math.sin(x / 40 + tick / 30); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
      else { for (var i = 0; i < 260; i++) { ctx.fillStyle = 'rgba(180,190,200,' + (Math.random() * 0.7).toFixed(2) + ')'; ctx.fillRect(Math.random() * w, Math.random() * h, 3, 2); } }
    }
    if (ctx && !reduced()) draw(); else if (ctx) { ctx.fillStyle = '#0b0d10'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    kn.setRotation(DEG.degMin + (freq - min) / span * (DEG.degMax - DEG.degMin)); paint();
    return { el: box, setFreq: function (v) { set(v, false); }, getFreq: function () { return fmt(freq); }, setLocked: function (b) { locked = !!b; box.classList.toggle('locked', locked); }, destroy: function () { dead = true; cancelAnimationFrame(raf); } };
  }

  // ---- combination dial: 100 numbers, turn it left or right; reports the number it stands at and the way it last turned ----
  function vaultDial(opts) {
    var box = el('div', 'vault-dial'), number = 0, dir = '';
    var face = el('div', 'dial-face'), s = svg('svg', { viewBox: '0 0 200 200', class: 'dial-ticks', 'aria-hidden': 'true' });
    s.appendChild(svg('circle', { cx: 100, cy: 100, r: 96, class: 'dial-outer' }));
    for (var n = 0; n < 100; n += 5) {
      var a = n * 3.6 - 90, rad = a * Math.PI / 180, big = n % 10 === 0, r1 = big ? 78 : 84;
      s.appendChild(svg('line', { x1: 100 + Math.cos(rad) * r1, y1: 100 + Math.sin(rad) * r1, x2: 100 + Math.cos(rad) * 92, y2: 100 + Math.sin(rad) * 92, class: big ? 'tick big' : 'tick' }));
      if (big) { var t = svg('text', { x: 100 + Math.cos(rad) * 66, y: 100 + Math.sin(rad) * 66 + 4, class: 'dial-num', 'text-anchor': 'middle' }); t.textContent = String(n); s.appendChild(t); }
    }
    s.appendChild(svg('path', { d: 'M100 4 L94 16 L106 16 Z', class: 'dial-pointer' }));
    var kn = knob({ label: 'Combination dial', bounded: null, area: face,
      onTurn: function (d, rot) { if (Math.abs(d) > 0.2) dir = d > 0 ? 'R' : 'L'; set(Math.round(rot / 3.6), false, true); },
      onKey: function (k) { dir = k > 0 ? 'R' : 'L'; kn.setRotation(kn.getRotation() + k * 3.6); set(Math.round(kn.getRotation() / 3.6), false, true); } });
    kn.el.classList.add('dial-knob');
    face.appendChild(s); face.appendChild(kn.el); box.appendChild(face);
    var readout = el('div', 'dial-readout', '00'); readout.setAttribute('aria-live', 'off'); box.appendChild(readout);
    function set(v, fromKnob, fromTurn) {
      number = ((v % 100) + 100) % 100; readout.textContent = (number < 10 ? '0' : '') + number; kn.aria(number);
      if (opts.onChange) opts.onChange(number, dir);
    }
    kn.aria(0);
    return { el: box, getNumber: function () { return number; }, getDir: function () { return dir; }, reset: function () { dir = ''; } };
  }

  // ---- full-screen scenes ----
  // Shown over everything for a few seconds, then removed on its own (or on "Continue"). Skipped entirely under reduced motion.
  function scene(cls, lines, done, msPerLine) {
    var ov = el('div', 'scene ' + cls), inner = el('div', 'scene-inner'), text = el('div', 'scene-text'), cont = el('button', 'scene-continue', 'Continue');
    cont.type = 'button'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Story scene');
    var stage = el('div', 'scene-stage'); ov.appendChild(stage); inner.appendChild(text); ov.appendChild(inner); ov.appendChild(cont);
    document.body.appendChild(ov);
    var timers = [], closed = false;
    function close() { if (closed) return; closed = true; timers.forEach(clearTimeout); ov.classList.add('out'); setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 700); if (done) done(); }
    cont.onclick = close;
    (lines || []).forEach(function (l, i) { timers.push(setTimeout(function () { var p = el('p', 'scene-line', l); text.appendChild(p); }, 1200 + i * msPerLine)); });
    timers.push(setTimeout(close, 1200 + (lines || []).length * msPerLine + 2600));
    return { stage: stage, close: close };
  }
  function lampScene(lines, done) {
    if (reduced()) { if (done) done(); return { stage: null, close: function () {} }; } // handled: no scene, but the follow-up has run
    var sc = scene('lamp-scene', lines, done, 1500);
    sc.stage.innerHTML = '<div class="stars"></div>' +
      '<div class="lh"><div class="beam-wrap"><div class="beam b1"></div><div class="beam b2"></div></div>' +
      '<svg class="tower" viewBox="0 0 120 260" aria-hidden="true"><path d="M44 250 L52 90 L68 90 L76 250 Z" class="tw"/><rect x="40" y="76" width="40" height="16" class="tw2"/><rect x="48" y="52" width="24" height="26" class="lampbox"/><path d="M44 52 L60 30 L76 52 Z" class="tw2"/><rect x="50" y="130" width="20" height="10" class="stripe"/><rect x="48" y="170" width="24" height="10" class="stripe"/></svg></div>' +
      '<div class="sea"><div class="wave w1"></div><div class="wave w2"></div></div><div class="boat" aria-hidden="true"></div>';
    return sc;
  }
  function petalScene(lines, done) {
    if (reduced()) { if (done) done(); return { stage: null, close: function () {} }; } // handled: no scene, but the follow-up has run
    var sc = scene('petal-scene', lines, done, 1500), h = '';
    for (var i = 0; i < 38; i++) h += '<span class="petal" style="left:' + (Math.round(Math.random() * 100)) + '%;animation-delay:' + (Math.random() * 5).toFixed(2) + 's;animation-duration:' + (5 + Math.random() * 4).toFixed(2) + 's;--drift:' + (Math.round(Math.random() * 120) - 60) + 'px"></span>';
    sc.stage.innerHTML = '<div class="petals">' + h + '</div>';
    return sc;
  }

  var api = { knob: knob, radioBox: radioBox, vaultDial: vaultDial, lampScene: lampScene, petalScene: petalScene, reduced: reduced };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Widgets = api;
})(typeof window !== 'undefined' ? window : globalThis);
