(function (root) {
  'use strict';
  // The bakehouse (fourth story). It is closed until you have dug up the tin from the warm bed. Inside: a shop window with loaves in it,
  // a recipe on the wall (shifted by a number you have to count), an oven with a dial and a timer, and, once it is right, the bread tunnel.
  var NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  // seven loaves on three shelves: round, long and plaited
  var SHELVES = [['round', 'long', 'round'], ['plait', 'long'], ['round', 'plait']];

  function loaf(kind, x, y) {
    var g = svg('g', { class: 'loaf ' + kind, transform: 'translate(' + x + ' ' + y + ')' });
    if (kind === 'round') { g.appendChild(svg('ellipse', { cx: 0, cy: 0, rx: 17, ry: 12 })); g.appendChild(svg('path', { d: 'M-8 -4 L-3 3 M0 -6 L4 3 M8 -4 L11 3', class: 'score' })); }
    else if (kind === 'long') { g.appendChild(svg('rect', { x: -26, y: -8, width: 52, height: 16, rx: 8 })); g.appendChild(svg('path', { d: 'M-16 -5 L-12 4 M-4 -5 L0 4 M8 -5 L12 4', class: 'score' })); }
    else { g.appendChild(svg('ellipse', { cx: 0, cy: 0, rx: 22, ry: 11 })); g.appendChild(svg('path', { d: 'M-16 -3 Q-8 6 0 -3 Q8 6 16 -3', class: 'score', fill: 'none' })); }
    return g;
  }

  function create(env) {
    var el = env.el, store = env.store, Seal = env.Seal;
    function ch() { return env.channel('bakery'); }
    function opened(id) { var c = store.getNote('seal:' + id), r = c ? Seal.tryOpen(ch(), c) : null; return r && r.payload.id === id ? env.personalize(r.payload) : null; }

    function view() {
      env.visit('bakehouse'); env.head('The bakehouse', '#/', 'Start');
      var room = el('div', 'bakehouse'), msg = el('p', 'gh-msg'); msg.setAttribute('aria-live', 'polite');
      env.view.appendChild(room);
      var warm = store.getNote('seal:warm-bed');
      if (!store.isSolved('story-warm-bed') || !warm) {   // closed: nothing but a sign
        var sign = el('div', 'bh-sign'); sign.appendChild(el('strong', '', 'CLOSED')); sign.appendChild(el('span', '', 'Back before six.'));
        room.appendChild(sign); room.appendChild(el('p', 'mute', 'The shutters are down and the door is locked. A warm smell comes from somewhere.')); return;
      }
      var wallRec = Seal.tryOpen(ch(), 'bakehouse ' + warm);
      var wall = wallRec ? env.personalize(wallRec.payload) : null;
      var oven = opened('bakehouse'), tunnel = opened('tunnel');

      function say(t, cls) { msg.className = 'gh-msg ' + (cls || ''); msg.textContent = t; }
      function draw() {
        room.textContent = '';
        // the shop window: count what is in it
        var win = svg('svg', { viewBox: '0 0 200 130', class: 'bh-window', role: 'img', 'aria-label': 'The shop window: three shelves of loaves, some round, some long, some plaited.' });
        win.appendChild(svg('rect', { x: 2, y: 2, width: 196, height: 126, rx: 6, class: 'bh-frame' }));
        SHELVES.forEach(function (row, r) {
          var y = 36 + r * 38; win.appendChild(svg('rect', { x: 8, y: y + 12, width: 184, height: 5, class: 'bh-shelf' }));
          row.forEach(function (k, i) { win.appendChild(loaf(k, 36 + i * 64 + (row.length === 2 ? 30 : 0), y)); });
        });
        room.appendChild(win);
        room.appendChild(el('p', 'mute', 'The shop window, lit from inside. Everything on sale this morning is in it.'));
        // the wall
        var board = el('div', 'bh-wall'); board.appendChild(el('h3', '', 'On the wall')); (wall ? wall.lines : []).forEach(function (l) { board.appendChild(el('p', /^[A-Z ]+[.]?$/.test(l) ? 'bh-chalk' : '', l)); });
        room.appendChild(board);
        // the oven
        var ov = el('div', 'bh-oven' + (oven ? ' open' : '')), door = el('div', 'bh-door'); ov.appendChild(door);
        var temp = el('input'), mins = el('input'), tl = el('label', '', 'Heat '), ml = el('label', '', 'Minutes '), tv = el('span', 'bh-read', '220°'), go = el('button', '', 'Bake');
        temp.type = 'range'; temp.min = '180'; temp.max = '260'; temp.step = '10'; temp.value = '220'; temp.setAttribute('aria-label', 'Oven heat');
        mins.type = 'number'; mins.min = '5'; mins.max = '90'; mins.step = '5'; mins.value = '20'; mins.setAttribute('inputmode', 'numeric'); mins.setAttribute('aria-label', 'Minutes in the oven');
        go.type = 'button';
        temp.oninput = function () { tv.textContent = temp.value + '°'; };
        tl.appendChild(temp); tl.appendChild(tv); ml.appendChild(mins);
        go.onclick = function () {
          var code = 'oven ' + temp.value + ' ' + mins.value, r = Seal.tryOpen(ch(), code);
          if (!r || r.payload.id !== 'bakehouse') { say('The bread comes out wrong. Pale, or black.', 'bad'); return; }
          env.remember(r.payload, code); oven = env.personalize(r.payload); say('The oven settles, and its door swings open.', 'good'); draw();
        };
        if (oven) { var saved = (store.getNote('seal:bakehouse') || '').split(' '); temp.value = saved[1] || '230'; mins.value = saved[2] || '35'; tv.textContent = temp.value + '°'; temp.disabled = true; mins.disabled = true; go.hidden = true; }
        var controls = el('div', 'bh-controls'); controls.appendChild(tl); controls.appendChild(ml); controls.appendChild(go);
        room.appendChild(ov); room.appendChild(controls);
        if (oven) {
          var inside = el('div', 'bh-after'); oven.lines.forEach(function (l) { inside.appendChild(el('p', 'vm-line', l)); });
          var walk = el('button', 'bh-walk', tunnel ? 'The bread tunnel' : 'Follow the chalk arrows'); walk.type = 'button';
          walk.onclick = function () {
            if (tunnel) return;
            var r = Seal.tryOpen(ch(), 'tunnel'); if (!r) return;
            env.remember(r.payload, 'tunnel'); tunnel = env.personalize(r.payload); say('The tunnel goes down under the Point.', 'good'); draw();
          };
          inside.appendChild(walk); room.appendChild(inside);
        }
        if (tunnel) { var t = el('div', 'bh-tunnel'); t.appendChild(el('h3', '', tunnel.title)); tunnel.lines.forEach(function (l) { t.appendChild(el('p', 'vm-line', l)); }); room.appendChild(t); }
        room.appendChild(msg);
      }
      draw();
    }
    return { view: view };
  }
  var api = { create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Bakehouse = api;
})(typeof window !== 'undefined' ? window : globalThis);
