(function (root) {
  'use strict';
  // The ticket archive (third story): six repair tickets, each dated by what had just happened. They must be filed in the order they
  // were written. The list is sealed under Orrin's own login, so it only opens for someone who has been into his account.
  function create(env) {
    var el = env.el, store = env.store, Seal = env.Seal;
    function ch() { return env.channel('clock'); }
    function view() {
      env.visit('tickets'); env.head('The ticket archive', '#/', 'Start');
      var box = el('div', 'tickets'), msg = el('p', 'gh-msg'); msg.setAttribute('aria-live', 'polite');
      env.view.appendChild(box);
      var key = store.getNote('seal:acct-orrin'), list = key ? Seal.tryOpen(ch(), 'tickets ' + key) : null;
      if (!list || list.payload.id !== 'tickets-list') {
        box.appendChild(el('p', 'mute', 'A steel cabinet, locked. A plate on the front reads: PELL & DAUGHTERS. By appointment, and only for the account holder.'));
        return;
      }
      var order = list.payload.tickets.map(function (t) { return t.id; }), by = {};
      list.payload.tickets.forEach(function (t) { by[t.id] = t.text; });
      var area = el('ol', 'ticket-list'), file = el('button', '', 'File them in this order'), result = el('div', 'ticket-result');
      file.type = 'button';
      function draw() {
        area.textContent = '';
        order.forEach(function (id, i) {
          var li = el('li', 'ticket'), badge = el('span', 'ticket-id', id), txt = el('p', 'ticket-text', by[id]), ctl = el('span', 'ticket-ctl');
          var up = el('button', 'chip', '▲'), down = el('button', 'chip', '▼');
          up.type = down.type = 'button'; up.setAttribute('aria-label', 'Move ticket ' + id + ' earlier'); down.setAttribute('aria-label', 'Move ticket ' + id + ' later');
          up.disabled = i === 0 || !!done; down.disabled = i === order.length - 1 || !!done;
          up.onclick = function () { var x = order[i - 1]; order[i - 1] = order[i]; order[i] = x; draw(); };
          down.onclick = function () { var x = order[i + 1]; order[i + 1] = order[i]; order[i] = x; draw(); };
          ctl.appendChild(up); ctl.appendChild(down);
          li.appendChild(badge); li.appendChild(txt); li.appendChild(ctl); area.appendChild(li);
        });
        file.hidden = !!done;
      }
      var done = null, saved = store.getNote('seal:tickets'), prev = saved ? Seal.tryOpen(ch(), saved) : null;
      if (prev && prev.payload.id === 'tickets') { done = env.personalize(prev.payload); order = saved.replace('tickets ', '').toUpperCase().split(''); }
      function show() { result.textContent = ''; if (done) { result.appendChild(el('h2', '', done.title)); done.lines.forEach(function (l) { result.appendChild(el('p', 'vm-line', l)); }); } }
      file.onclick = function () {
        var code = 'tickets ' + order.join('').toLowerCase(), r = Seal.tryOpen(ch(), code);
        if (!r || r.payload.id !== 'tickets') { msg.className = 'gh-msg bad'; msg.textContent = 'The drawer sticks. They are not in the order they were written.'; return; }
        env.remember(r.payload, code); done = env.personalize(r.payload); msg.className = 'gh-msg good'; msg.textContent = 'The drawer slides home.'; draw(); show();
      };
      box.appendChild(el('p', 'mute', 'Six outstanding tickets, shuffled by an apprentice. Earliest first.'));
      box.appendChild(area); box.appendChild(file); box.appendChild(msg); box.appendChild(result); draw(); show();
    }
    return { view: view };
  }
  var api = { create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Tickets = api;
})(typeof window !== 'undefined' ? window : globalThis);
