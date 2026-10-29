(function (root) {
  'use strict';
  // The office terminal, now with more than one account. Every account is a sealed record opened by "<user> <password>"; its files,
  // mail and login log are records of their own, each sealed under the command that reads it, so reading them files them
  // under what you have found. Accounts you have already been into can be switched to with su, without the password.
  function create(env) {
    var el = env.el, store = env.store, Seal = env.Seal;
    function ch() { return env.channel('terminal'); }
    function accounts() { return env.found().filter(function (r) { return r.kind === 'terminal' && r.user; }); }
    function account(user) { var a = accounts(); for (var i = 0; i < a.length; i++) if (a[i].user === user) return a[i]; return null; }

    // Once all four stories are complete the line to the Undercroft office is dead: static, NO CARRIER, and a fragment of carrier that is
    // really a place to go next (a Caesar shift of three, for the Tools page).
    function deadScreen() {
      var panel = el('div', 'panel term-dead'), cv = el('canvas', 'dead-static'); cv.width = 240; cv.height = 90; cv.setAttribute('aria-hidden', 'true');
      var ctx2 = cv.getContext && cv.getContext('2d'), raf = 0, gone = false;
      function frame() { if (gone || !ctx2) return; raf = requestAnimationFrame(frame); ctx2.fillStyle = '#05070a'; ctx2.fillRect(0, 0, 240, 90); for (var i = 0; i < 420; i++) { ctx2.fillStyle = 'rgba(160,185,170,' + (Math.random() * 0.8).toFixed(2) + ')'; ctx2.fillRect(Math.random() * 240, Math.random() * 90, 3, 2); } }
      if (ctx2 && !(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches)) frame();
      env.cleanup(function () { gone = true; cancelAnimationFrame(raf); });
      panel.appendChild(cv);
      panel.appendChild(el('p', 'dead-line', 'NO CARRIER'));
      panel.appendChild(el('p', 'mute', 'The line to the Undercroft office went down with the last of the bread. The screen shows only weather.'));
      panel.appendChild(el('p', 'dead-frag', 'carrier fragment, repeating: VZLWFKERDUG'));
      env.view.appendChild(panel);
    }
    function view() {
      env.visit('terminal');
      env.head('Terminal', '#/', 'Start');
      if (env.deadTerminal()) return deadScreen();
      var panel = el('div', 'panel term'), out = el('pre', 'term-out'), form = el('form', 'row term-form');
      if (store.isSolved('story-acct-dov')) out.classList.add('glitching'); // the machine has started to fail
      var prompt = el('span', 'term-prompt', '>'), inp = el('input');
      inp.type = 'text'; inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'Command'); inp.setAttribute('autocapitalize', 'none'); inp.setAttribute('autocorrect', 'off'); inp.spellcheck = false;
      var go = el('button', '', 'Enter'); go.type = 'submit';
      var quick = el('div', 'chips term-quick');
      var session = null, pendingUser = null;
      function print(lines) { (Array.isArray(lines) ? lines : [lines]).forEach(function (l) { out.appendChild(document.createTextNode(l + '\n')); }); out.scrollTop = out.scrollHeight; }
      function who() { return session ? session.user + '@undercroft> ' : '> '; }
      function setPrompt() { prompt.textContent = pendingUser !== null ? 'password:' : (session ? session.user + '@undercroft>' : '>'); inp.type = pendingUser !== null ? 'password' : 'text'; }
      function start(payload, how) {
        session = payload; pendingUser = null; store.setNote('term:cur', payload.id); setPrompt();
        if (store.isSolved('story-acct-dov')) out.classList.add('glitching'); // from the moment Dov's account has been opened, the machine is failing
        print(['', how === 'restored' ? 'Session restored.' : how === 'su' ? 'Switched to ' + payload.user + '.' : 'Login accepted.'].concat(payload.motd || []));
      }
      function virtual(code, remembered) { // a record sealed under a command: read it, file it
        var r = Seal.tryOpen(ch(), code); if (!r) return null;
        if (remembered !== false) env.remember(r.payload, code);
        return env.personalize(r.payload);
      }
      function sealedId(f) { return f.sealed === true ? 'ledger' : f.sealed; }
      function openedFile(f) { var id = sealedId(f), c = id ? store.getNote('seal:' + id) : '', r = c ? Seal.tryOpen(ch(), c) : null; return !!(r && r.payload.id === id); }
      function fileNamed(n) { var fs = (session && session.files) || []; for (var i = 0; i < fs.length; i++) if (fs[i].name === n) return fs[i]; return null; }
      function runLine(line) {
        if (pendingUser !== null) { // answering the password prompt
          var user = pendingUser; pendingUser = null;
          var code = user + ' ' + line, r = Seal.tryOpen(ch(), code);
          if (r && r.payload.kind === 'terminal' && r.payload.user === user) { env.remember(r.payload, code); start(env.personalize(r.payload), 'login'); } else { print('Login incorrect.'); setPrompt(); }
          return;
        }
        var c = env.parseCommand(line);
        print(who() + line);
        if (c.type === 'empty') return;
        if (c.type === 'help') return print(['help | login <user> | su <user> | who | ls | cat <file> | open <file> <passphrase> | mail [n] | last | clear | logout']);
        if (c.type === 'clear') { out.textContent = ''; return; }
        if (c.type === 'login') { if (!c.user) return print('usage: login <user>'); pendingUser = c.user; setPrompt(); return; }
        if (c.type === 'su') {
          if (!c.user) return print('usage: su <user>');
          var known = account(c.user);
          if (known) return start(env.personalize(known), 'su');
          pendingUser = c.user; setPrompt(); return;
        }
        if (c.type === 'who') { var us = accounts().map(function (a) { return a.user; }); return print('accounts: ' + us.join('  ') + (us.length ? '  ' : '') + '???'); }
        if (c.type === 'logout') { session = null; store.setNote('term:cur', 'none'); setPrompt(); return print('Logged out.'); }
        if (c.type === 'unknown') return print('command not found: ' + c.cmd + '  (try help)');
        if (!session) return print('Not logged in. Try: login <user>');
        if (c.type === 'bake') {
          if (session.user !== 'dov') return print('Nothing in here is an oven.');
          var br = c.phrase ? virtual('bake ' + c.phrase) : null; return print(br ? br.lines : 'The oven is cold.');
        }
        if (c.type === 'ls') {
          var rows = (session.files || []).map(function (f) { return f.name + (f.sealed ? (openedFile(f) ? '   [open]' : '   [sealed]') : ''); });
          if (session.mail && session.mail.length) rows.push('mail   [' + session.mail.length + ' message' + (session.mail.length === 1 ? '' : 's') + ']');
          return print(rows);
        }
        if (c.type === 'last') {
          if (!session.last) return print('No login record.');
          var lr = virtual('last ' + session.user); return print(lr ? lr.lines : 'No login record.');
        }
        if (c.type === 'mail') {
          var box = session.mail || [];
          if (!box.length) return print('No mail.');
          if (!c.n) return print(['' + box.length + ' message' + (box.length === 1 ? '' : 's') + ':'].concat(box.map(function (m) { return '  ' + m.n + '  ' + m.subject + (store.isSolved('story-mail-' + session.user + '-' + m.n) ? '' : '  [new]'); })));
          var mr = virtual('mail ' + session.user + ' ' + c.n); return print(mr ? mr.lines : 'No such message: ' + c.n);
        }
        var f = fileNamed(c.file);
        if (c.type === 'cat') {
          if (!f) return print('No such file: ' + c.file);
          if (f.sealed) {
            var id = sealedId(f), again = store.getNote('seal:' + id), reopen = again ? Seal.tryOpen(ch(), again) : null;
            if (reopen && reopen.payload.id === id) return print(env.personalize(reopen.payload).lines);   // opened once: it stays open
            return print('sealed' + (f.note ? ', ' + f.note : '') + '. Use: open ' + f.name + ' <passphrase>');
          }
          var fr = virtual('file ' + f.name); return print(fr ? fr.lines : (f.lines || []));
        }
        if (c.type === 'open') {
          if (!f) return print('No such file: ' + c.file);
          if (!f.sealed) return runLine('cat ' + f.name);
          if (openedFile(f)) { var oc = Seal.tryOpen(ch(), store.getNote('seal:' + sealedId(f))); return print(env.personalize(oc.payload).lines); }   // no passphrase needed twice
          var want = sealedId(f), o = c.pass ? Seal.tryOpen(ch(), c.pass) : null;
          if (o && o.payload.kind === 'file' && o.payload.id === want) { env.remember(o.payload, c.pass); return print(env.personalize(o.payload).lines); }
          return print('Wrong passphrase.');
        }
      }
      form.onsubmit = function (ev) { ev.preventDefault(); var v = inp.value; inp.value = ''; runLine(v); inp.focus(); };
      [['help', 'help'], ['ls', 'ls'], ['who', 'who'], ['mail', 'mail'], ['clear', 'clear']].forEach(function (q) {
        var b = el('button', 'chip', q[0]); b.type = 'button'; b.onclick = function () { runLine(q[1]); inp.focus(); }; quick.appendChild(b);
      });
      form.appendChild(prompt); form.appendChild(inp); form.appendChild(go);
      [out, quick, form].forEach(function (n) { panel.appendChild(n); });
      env.view.appendChild(panel);
      print(['MARSH HOUSE / UNDERCROFT OFFICE', 'Terminal ready. Type help.']);
      // restore the last account you were in
      var cur = store.getNote('term:cur') || (store.getNote('seal:office') ? 'office' : ''); if (cur === 'none') cur = ''; var saved = cur ? store.getNote('seal:' + cur) : '', r0 = saved ? Seal.tryOpen(ch(), saved) : null;
      if (r0 && r0.payload.kind === 'terminal') start(env.personalize(r0.payload), 'restored'); else setPrompt();
    }
    return { view: view };
  }
  var api = { create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Terminal = api;
})(typeof window !== 'undefined' ? window : globalThis);
