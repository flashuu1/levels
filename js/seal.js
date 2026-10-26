(function (root) {
  'use strict';
  // Sealed story records: a record is encrypted under a code the player has to find (a frequency, a password, a combination).
  // Wrong codes open nothing, so the shipped data holds no readable story. Stream cipher built on the SHA-256 in answer.js;
  // tools/seal.py is the byte-identical writer. This is obfuscation against casual reading, not real cryptography.
  var A = (typeof module !== 'undefined' && module.exports) ? require('./answer.js') : root.Answer;

  // Everything except letters, digits and the dot is ignored, so "Ember-Tern salt, HARBOUR" == "ember tern salt harbour".
  function canon(code) { return String(code == null ? '' : code).toLowerCase().replace(/[^a-z0-9.]/g, ''); }
  function utf8(str) { return Array.from(unescape(encodeURIComponent(str)), function (c) { return c.charCodeAt(0); }); }
  function fromUtf8(bytes) { try { return decodeURIComponent(escape(String.fromCharCode.apply(null, bytes))); } catch (e) { return null; } }
  function hex2(n) { return (n < 16 ? '0' : '') + n.toString(16); }
  function keystream(salt, c, len) {
    var out = [];
    for (var i = 0; out.length < len; i++) {
      var h = A.sha256Hex(salt + ':' + c + ':' + i);
      for (var j = 0; j < 64 && out.length < len; j += 2) out.push(parseInt(h.substr(j, 2), 16));
    }
    return out;
  }
  function tagOf(entry, c, text) { return A.sha256Hex(entry.salt + ':tag:' + c + ':' + text).slice(0, 16); }

  // entry = { salt, tag, ct } -> payload object, or null
  function open(entry, code) {
    if (!entry || typeof entry.salt !== 'string' || typeof entry.ct !== 'string' || typeof entry.tag !== 'string') return null;
    var c = canon(code); if (!c) return null;
    var n = entry.ct.length / 2; if (n !== Math.floor(n) || /[^0-9a-f]/.test(entry.ct)) return null;
    var ks = keystream(entry.salt, c, n), bytes = [];
    for (var i = 0; i < n; i++) bytes.push(parseInt(entry.ct.substr(i * 2, 2), 16) ^ ks[i]);
    var text = fromUtf8(bytes);
    if (text === null || tagOf(entry, c, text) !== entry.tag) return null;
    try { return JSON.parse(text); } catch (e) { return null; }
  }
  // Writer (used by tests; the build tool is tools/seal.py).
  function seal(payload, code, salt) {
    var c = canon(code), text = JSON.stringify(payload), b = utf8(text), ks = keystream(salt, c, b.length), ct = '';
    for (var i = 0; i < b.length; i++) ct += hex2(b[i] ^ ks[i]);
    var entry = { salt: salt, ct: ct }; entry.tag = tagOf(entry, c, text);
    return entry;
  }
  // First entry that opens with the code -> { entry, payload }, or null
  function tryOpen(entries, code) {
    if (!Array.isArray(entries)) return null;
    for (var i = 0; i < entries.length; i++) { var p = open(entries[i], code); if (p) return { entry: entries[i], payload: p }; }
    return null;
  }
  var api = { canon: canon, open: open, seal: seal, tryOpen: tryOpen };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Seal = api;
})(typeof window !== 'undefined' ? window : globalThis);
