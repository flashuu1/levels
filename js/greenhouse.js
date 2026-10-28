(function (root) {
  'use strict';
  // The glasshouse (the second story's puzzle). Everything that matters is sealed: the drawer opens with a word, the row of trees
  // with the right arrangement, the shed with a word the trees spell, and the bloom with planting and watering the seed.
  // Packets can be dragged onto pots, or tapped then tapped onto a pot (phones, keyboards).
  var TREES = ['apple', 'pear', 'plum', 'quince'], PLOTS = [7, 12, 19, 41];
  var FRUIT = { apple: '#d9453b', pear: '#c9d65c', plum: '#7a3f8f', quince: '#ebc83c' };

  function treeSvg(kind, tag, wilt) {
    tag = String(tag || '').replace(/[^A-Za-z]/g, '').slice(0, 2); // a single letter from our own sealed data; never markup
    var NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 80 110'); s.setAttribute('class', 'tree-svg' + (wilt ? ' wilt' : '')); s.setAttribute('aria-hidden', 'true');
    var fruit = '', pos = [[28, 40], [50, 36], [38, 56], [58, 54], [24, 60]];
    pos.forEach(function (p) { fruit += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="5" fill="' + FRUIT[kind] + '" stroke="rgba(0,0,0,.25)"/>'; });
    s.innerHTML = '<g class="tree-body"><rect x="36" y="58" width="8" height="40" rx="3" fill="#6b4a2b"/><ellipse cx="40" cy="42" rx="30" ry="28" fill="#3f8a4a"/><ellipse cx="32" cy="36" rx="14" ry="11" fill="#58a862" opacity=".7"/>' + fruit + '</g>' +
      (tag ? '<g class="tree-tag" data-tag="1"><line x1="52" y1="62" x2="56" y2="74" stroke="#6b4a2b"/><rect x="48" y="74" width="16" height="18" rx="2" fill="#f1e4bd" stroke="#8a6d3b"/><text x="56" y="87" text-anchor="middle" font-size="12" font-weight="700" fill="#3b2a14" font-family="Georgia,serif">' + tag + '</text></g>' : '');
    return s;
  }
  function packetSvg(kind) {
    var NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 50 64'); s.setAttribute('class', 'packet-svg'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<rect x="4" y="4" width="42" height="56" rx="3" fill="#efe2bb" stroke="#8a6d3b" stroke-width="2"/><circle cx="25" cy="26" r="11" fill="' + FRUIT[kind] + '" stroke="rgba(0,0,0,.3)"/><rect x="10" y="44" width="30" height="3" fill="#8a6d3b" opacity=".6"/><rect x="14" y="50" width="22" height="3" fill="#8a6d3b" opacity=".4"/>';
    return s;
  }

  function create(env) {
    var el = env.el, store = env.store, Seal = env.Seal, W = env.Widgets;
    function opens(id, code) { var r = Seal.tryOpen(env.channel('greenhouse'), code); return r && r.payload.id === id ? r : null; }
    function stored(id) { var c = store.getNote('seal:' + id); return c ? opens(id, c) : null; }

    function view() {
      env.head('The glasshouse', '#/', 'Start');
      var st = { notebook: null, orchard: null, shed: null, grove: null, arrangement: {}, seedPlanted: !!store.getNote('gh:seed'), selected: null, msg: '', wilting: false };
      function load() {
        var n = stored('notebook'), o = stored('orchard'), sh = stored('shed'), g = stored('grove');
        st.notebook = n && env.personalize(n.payload); st.orchard = o && env.personalize(o.payload); st.shed = sh && env.personalize(sh.payload); st.grove = g && env.personalize(g.payload);
        if (o) { var parts = store.getNote('seal:orchard').split(' '); st.arrangement = {}; for (var i = 0; i + 1 < parts.length; i += 2) st.arrangement[parts[i]] = parts[i + 1]; }
      }
      load();
      var scene = el('div', 'gh-scene'), live = el('p', 'gh-msg'); live.setAttribute('aria-live', 'polite');
      view_append(scene);
      function view_append(n) { env.view.appendChild(n); }

      var suppressClick = false, ghost = null;
      function say(t, cls) { st.msg = t; live.className = 'gh-msg ' + (cls || ''); live.textContent = t; }

      // ---- drag and tap: an item (packet, seed, can) onto a target (pot, patch) ----
      function wire(node, item) {
        var down = null;
        node.addEventListener('pointerdown', function (ev) { if (ev.button) return; down = { x: ev.clientX, y: ev.clientY, moved: false }; });
        node.addEventListener('pointermove', function (ev) {
          if (!down) return;
          if (!down.moved && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 8) {
            down.moved = true; try { node.setPointerCapture(ev.pointerId); } catch (e) { /* ok */ }
            ghost = node.cloneNode(true); ghost.classList.add('drag-clone'); document.body.appendChild(ghost);
          }
          if (down.moved && ghost) { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; }
        });
        function end(ev) {
          if (!down) return;
          var moved = down.moved; down = null;
          if (ghost) { ghost.remove(); ghost = null; }
          if (!moved) return;
          suppressClick = true; setTimeout(function () { suppressClick = false; }, 60);
          var under = document.elementFromPoint(ev.clientX, ev.clientY), tgt = under && under.closest && under.closest('[data-drop]');
          if (tgt) drop(item, tgt.getAttribute('data-drop'));
        }
        node.addEventListener('pointerup', end); node.addEventListener('pointercancel', end);
        node.addEventListener('click', function () { if (suppressClick) return; st.selected = st.selected === item ? null : item; paintSelection(); });
      }
      function paintSelection() { Array.prototype.forEach.call(scene.querySelectorAll('[data-item]'), function (n) { n.classList.toggle('selected', n.getAttribute('data-item') === st.selected); }); scene.classList.toggle('carrying', !!st.selected); }
      function tapTarget(target) { if (st.selected) { var it = st.selected; st.selected = null; drop(it, target); } else if (/^plot:/.test(target)) { // tap a planted pot with nothing selected: pick the packet back up
          var n = target.slice(5); if (st.arrangement[n] && !st.orchard) { delete st.arrangement[n]; draw(); } } }

      function drop(item, target) {
        if (/^packet:/.test(item) && /^plot:/.test(target) && !st.orchard) {
          var tree = item.slice(7), plot = target.slice(5);
          Object.keys(st.arrangement).forEach(function (k) { if (st.arrangement[k] === tree) delete st.arrangement[k]; });
          st.arrangement[plot] = tree; draw();
          if (PLOTS.every(function (n) { return st.arrangement[n]; })) tryRow();
        } else if (item === 'seed' && target === 'patch') {
          if (!st.seedPlanted) { st.seedPlanted = true; store.setNote('gh:seed', '1'); say('The seed goes into the dark soil.'); draw(); }
        } else if (item === 'can' && target === 'patch') {
          if (!st.seedPlanted) { say('Dry, empty soil.'); return; }
          water();
        } else if (item === 'can' && /^plot:/.test(target)) { say('The trees are well watered already.'); }
        else { say('That does not go there.'); }
        paintSelection();
      }
      function tryRow() {
        var code = PLOTS.map(function (n) { return n + ' ' + st.arrangement[n]; }).join(' '), r = opens('orchard', code);
        if (!r) {
          st.wilting = true; draw(); say('The saplings wilt.', 'bad');
          env.later(function () { st.wilting = false; st.arrangement = {}; draw(); say(''); }, 1500);
          return;
        }
        env.remember(r.payload, code); load(); say('The trees lift their branches.', 'good'); draw();
      }
      function water() {
        var r = opens('grove', 'gate water');
        if (!r) return;
        env.remember(r.payload, 'gate water'); store.markSolved('story-bloom'); load();
        var fin = (st.grove && st.grove.finale) || [];
        var show = W ? W.petalScene(fin, function () { env.applyTestament(store); draw(); }) : null;
        if (!show) { env.applyTestament(store); draw(); } else { draw(); }
      }

      // ---- drawing the scene from the state ----
      function draw() {
        scene.textContent = '';
        var roof = el('div', 'gh-roof'); roof.setAttribute('aria-hidden', 'true'); scene.appendChild(roof);
        // drawer
        var top = el('div', 'gh-top');
        if (!st.notebook) {
          var drawer = el('form', 'gh-drawer'), plate = el('div', 'gh-plate'), inp = el('input'), go = el('button', '', 'Open');
          plate.setAttribute('aria-hidden', 'true'); for (var i = 0; i < 6; i++) plate.appendChild(el('span', 'slot'));
          inp.type = 'text'; inp.maxLength = 12; inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'Drawer word'); inp.setAttribute('autocapitalize', 'none'); inp.setAttribute('autocorrect', 'off'); inp.spellcheck = false; inp.placeholder = 'six letters';
          go.type = 'submit';
          drawer.appendChild(el('div', 'gh-keyhole')); drawer.appendChild(plate); drawer.appendChild(inp); drawer.appendChild(go);
          drawer.onsubmit = function (ev) {
            ev.preventDefault(); var r = opens('notebook', inp.value);
            if (!r) { say('The drawer will not slide.', 'bad'); drawer.classList.remove('shake'); void drawer.offsetWidth; drawer.classList.add('shake'); return; }
            env.remember(r.payload, inp.value); load(); say('The drawer slides open.', 'good'); draw();
          };
          top.appendChild(drawer);
        } else {
          var nb = el('div', 'gh-notebook'); nb.appendChild(el('h2', '', st.notebook.title));
          st.notebook.lines.forEach(function (l) { nb.appendChild(el('p', '', l)); });
          top.appendChild(nb);
        }
        scene.appendChild(top);

        // the row of pots
        var row = el('div', 'gh-row');
        PLOTS.forEach(function (n) {
          var tree = st.arrangement[n], pot = el('div', 'pot' + (st.orchard ? ' planted' : '')), zone = el('button', 'pot-zone');
          zone.type = 'button'; zone.setAttribute('data-drop', 'plot:' + n); zone.setAttribute('aria-label', 'Plot ' + n + (tree ? ', ' + tree : ', empty'));
          zone.onclick = function () { tapTarget('plot:' + n); };
          if (tree) { var holder = el('div', 'pot-tree' + (st.orchard ? ' grown' : ' sprout')); holder.appendChild(treeSvg(tree, st.orchard && st.orchard.tags ? st.orchard.tags[n] : '', st.wilting)); zone.appendChild(holder); }
          zone.appendChild(el('div', 'pot-clay'));
          var plate = el('div', 'pot-plate', String(n)); pot.appendChild(zone); pot.appendChild(plate); row.appendChild(pot);
        });
        scene.appendChild(row);

        // the bench: seed packets
        var bench = el('div', 'gh-bench');
        if (st.notebook && !st.orchard) {
          TREES.filter(function (t) { return Object.keys(st.arrangement).every(function (k) { return st.arrangement[k] !== t; }); }).forEach(function (t) {
            var pk = el('button', 'packet'); pk.type = 'button'; pk.setAttribute('data-item', 'packet:' + t); pk.setAttribute('aria-label', 'Seed packet: ' + t);
            pk.appendChild(packetSvg(t)); pk.appendChild(el('span', 'packet-name', t)); wire(pk, 'packet:' + t); bench.appendChild(pk);
          });
        }
        scene.appendChild(bench);

        // the shed: a hasp, once the trees have grown
        if (st.orchard) {
          var shed = el('div', 'gh-shed' + (st.shed ? ' open' : '')); shed.appendChild(el('div', 'shed-roof')); var door = el('div', 'shed-door'); shed.appendChild(door);
          if (!st.shed) {
            var lock = el('form', 'shed-lock'), li = el('input'), lb = el('button', '', 'Open');
            li.type = 'text'; li.maxLength = 12; li.autocomplete = 'off'; li.setAttribute('aria-label', 'Shed lock word'); li.setAttribute('autocapitalize', 'none'); li.setAttribute('autocorrect', 'off'); li.spellcheck = false; li.placeholder = '• • • •'; lb.type = 'submit';
            lock.appendChild(el('div', 'hasp')); lock.appendChild(li); lock.appendChild(lb);
            lock.onsubmit = function (ev) {
              ev.preventDefault(); var r = opens('shed', li.value);
              if (!r) { say('The hasp does not move.', 'bad'); lock.classList.remove('shake'); void lock.offsetWidth; lock.classList.add('shake'); return; }
              env.remember(r.payload, li.value); load(); say('The hasp falls open.', 'good'); draw();
            };
            shed.appendChild(lock);
          } else {
            var inside = el('div', 'shed-inside');
            var seed = el('button', 'item item-seed' + (st.seedPlanted ? ' used' : '')); seed.type = 'button'; seed.setAttribute('data-item', 'seed'); seed.setAttribute('aria-label', 'A small brown seed'); seed.appendChild(el('span', 'seed-dot'));
            var can = el('button', 'item item-can'); can.type = 'button'; can.setAttribute('data-item', 'can'); can.setAttribute('aria-label', 'Watering can'); can.appendChild(el('span', 'can-body')); can.appendChild(el('span', 'can-spout'));
            if (!st.seedPlanted) { wire(seed, 'seed'); inside.appendChild(seed); }
            if (!st.grove) { wire(can, 'can'); inside.appendChild(can); }
            shed.appendChild(inside);
          }
          scene.appendChild(shed);
          // the bare patch by the gate
          if (st.shed) {
            var yard = el('div', 'gh-yard'), patch = el('button', 'gate-patch' + (st.seedPlanted ? ' seeded' : '') + (st.grove ? ' grown' : '')); patch.type = 'button';
            patch.setAttribute('data-drop', 'patch'); patch.setAttribute('aria-label', st.grove ? 'A new tree by the gate' : st.seedPlanted ? 'The planted patch by the gate' : 'A bare patch by the gate');
            patch.onclick = function () { tapTarget('patch'); };
            if (st.grove) { var nt = el('div', 'pot-tree grown'); nt.appendChild(treeSvg('apple', '', false)); patch.appendChild(nt); }
            patch.appendChild(el('div', 'patch-soil')); yard.appendChild(el('div', 'gate-post')); yard.appendChild(patch); yard.appendChild(el('div', 'gate-post'));
            scene.appendChild(yard);
          }
        }
        if (st.grove) { var done = el('div', 'gh-finale'); (st.grove.lines || []).forEach(function (l) { done.appendChild(el('p', 'vm-line bloom-line', l)); }); (st.grove.finale || []).forEach(function (l) { done.appendChild(el('p', 'vm-line bloom-line', l)); }); scene.appendChild(done); }
        scene.appendChild(live);
        if (st.shed && !st.grove) { var small = el('p', 'mute'); small.textContent = ''; }
        paintSelection();
      }
      draw();
    }
    return { view: view };
  }
  var api = { create: create, TREES: TREES, PLOTS: PLOTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Greenhouse = api;
})(typeof window !== 'undefined' ? window : globalThis);
