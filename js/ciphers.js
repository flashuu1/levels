(function (root) {
  'use strict';
  function str(s) { return s == null ? '' : String(s); }

  function shiftLetter(ch, k) {
    var c = ch.charCodeAt(0), base = c >= 65 && c <= 90 ? 65 : c >= 97 && c <= 122 ? 97 : 0;
    if (!base) return ch;
    return String.fromCharCode(base + (((c - base + k) % 26) + 26) % 26);
  }
  // Returns an integer 0..25, or null for non-numeric / non-finite / absurdly large shifts.
  function normShift(shift) {
    if (typeof shift === 'string') { if (!shift.trim()) return null; shift = Number(shift); }
    if (typeof shift !== 'number' || !isFinite(shift)) return null;
    var n = Math.trunc(shift);
    if (Math.abs(n) > 9007199254740991) return null;
    return ((n % 26) + 26) % 26;
  }
  function caesar(text, shift) {
    var k = normShift(shift);
    if (k === null) return null;
    return str(text).replace(/[A-Za-z]/g, function (ch) { return shiftLetter(ch, k); });
  }
  function rot13(text) { return caesar(text, 13); }
  function atbash(text) {
    return str(text).replace(/[A-Za-z]/g, function (ch) {
      var base = ch <= 'Z' ? 65 : 97;
      return String.fromCharCode(base + 25 - (ch.charCodeAt(0) - base));
    });
  }
  function vigenere(text, key, decrypt) {
    if (typeof text !== 'string' || typeof key !== 'string') return null;
    var k = key.replace(/[^A-Za-z]/g, '').toLowerCase();
    var t = text;
    if (!t) return '';
    if (!k) return null;
    var i = 0;
    return t.replace(/[A-Za-z]/g, function (ch) {
      var s = k.charCodeAt(i++ % k.length) - 97;
      return shiftLetter(ch, decrypt ? -s : s);
    });
  }

  // bytes (array of 0-255) -> string, or null if not valid UTF-8
  function bytesToText(bytes) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
    } catch (e) { return null; }
  }

  function base64Decode(s) {
    try {
      var t = str(s).replace(/\s+/g, '');
      if (!t) return '';
      var pad = /=*$/.exec(t)[0].length;
      if (pad > 2) return null;
      // Accept URL-safe alphabet: '-' and '_' map to '+' and '/'.
      t = t.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
      if (!/^[A-Za-z0-9+\/]+$/.test(t) || t.length % 4 === 1) return null;
      var A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', out = [], buf = 0, bits = 0;
      for (var i = 0; i < t.length; i++) {
        buf = (buf << 6) | A.indexOf(t[i]); bits += 6;
        if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 255); buf &= (1 << bits) - 1; }
      }
      return bytesToText(out);
    } catch (e) { return null; }
  }

  function base32Decode(s) {
    try {
      var t = str(s).replace(/\s+/g, '').replace(/=+$/, '').toUpperCase();
      if (!t) return '';
      if (!/^[A-Z2-7]+$/.test(t)) return null;
      if ([1, 3, 6].indexOf(t.length % 8) !== -1) return null;
      var A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', out = [], buf = 0, bits = 0;
      for (var i = 0; i < t.length; i++) {
        buf = (buf << 5) | A.indexOf(t[i]); bits += 5;
        if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 255); buf &= (1 << bits) - 1; }
      }
      return bytesToText(out);
    } catch (e) { return null; }
  }

  function hexDecode(s) {
    try {
      var t = str(s).replace(/\s+/g, '').replace(/^0x/i, '');
      if (!t) return '';
      if (!/^[0-9a-fA-F]+$/.test(t) || t.length % 2) return null;
      var out = [];
      for (var i = 0; i < t.length; i += 2) out.push(parseInt(t.substr(i, 2), 16));
      return bytesToText(out);
    } catch (e) { return null; }
  }

  function binaryDecode(s) {
    try {
      var t = str(s).replace(/\s+/g, '');
      if (!t) return '';
      if (!/^[01]+$/.test(t) || t.length % 8) return null;
      var out = [];
      for (var i = 0; i < t.length; i += 8) out.push(parseInt(t.substr(i, 8), 2));
      return bytesToText(out);
    } catch (e) { return null; }
  }

  var MORSE_SRC = {
    '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E', '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I',
    '.---': 'J', '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O', '.--.': 'P', '--.-': 'Q', '.-.': 'R',
    '...': 'S', '-': 'T', '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y', '--..': 'Z',
    '-----': '0', '.----': '1', '..---': '2', '...--': '3', '....-': '4', '.....': '5', '-....': '6', '--...': '7',
    '---..': '8', '----.': '9'
  };
  var MORSE = Object.create(null); // no prototype, so 'constructor' etc. are unknown symbols
  Object.keys(MORSE_SRC).forEach(function (k) { MORSE[k] = MORSE_SRC[k]; });
  function morseDecode(s) {
    try {
      var t = str(s).trim();
      if (!t) return '';
      var words = t.split(/\s*\/\s*|\s{3,}/), out = [];
      for (var w = 0; w < words.length; w++) {
        var letters = words[w].split(/\s+/).filter(Boolean), word = '';
        for (var i = 0; i < letters.length; i++) {
          var c = MORSE[letters[i]];
          if (!c) return null;
          word += c;
        }
        out.push(word);
      }
      return out.join(' ');
    } catch (e) { return null; }
  }

  // ---- Hallway toolkit: transposition, square and keyed ciphers. All pure; invalid input returns null, never throws. ----
  var UC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  // Letters of s as an uppercase string (non-letters removed), or null when s is not a string.
  function lettersOf(s) { return typeof s === 'string' ? s.replace(/[^A-Za-z]/g, '').toUpperCase() : null; }
  // Integer from a number or numeric string (no fractions, no NaN/Infinity), else null.
  function toInt(v) {
    if (typeof v === 'string') { if (!/^\s*[+-]?\d+\s*$/.test(v)) return null; v = Number(v); }
    return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && Math.abs(v) <= 9007199254740991 ? v : null;
  }
  // Mixed alphabet: keyword letters (deduplicated) followed by the remaining letters; joinIJ drops J (I/J merged, 25 letters).
  function mixedAlphabet(keyword, joinIJ) {
    var seen = Object.create(null), out = [], src = (keyword || '') + UC;
    for (var i = 0; i < src.length; i++) {
      var ch = src.charAt(i);
      if (joinIJ && ch === 'J') ch = 'I';
      if (!seen[ch]) { seen[ch] = 1; out.push(ch); }
    }
    return out.join('');
  }
  // Applies f (uppercase letter -> uppercase letter) to every letter, keeping case and non-letters.
  function mapLetters(text, f) {
    return text.replace(/[A-Za-z]/g, function (ch) {
      var up = ch.toUpperCase(), r = f(up);
      return ch === up ? r : r.toLowerCase();
    });
  }

  // Rail fence: writes the characters AS GIVEN (spaces and punctuation included, nothing stripped) in a zig-zag over 2..10 rails and reads row by row.
  function railFence(text, rails, decrypt) {
    var n = toInt(rails);
    if (typeof text !== 'string' || n === null || n < 2 || n > 10) return null;
    var chars = Array.from(text), len = chars.length, period = 2 * (n - 1), railOf = new Array(len), order = [], i, r;
    for (i = 0; i < len; i++) { var m = i % period; railOf[i] = m < n ? m : period - m; }
    for (r = 0; r < n; r++) for (i = 0; i < len; i++) if (railOf[i] === r) order.push(i);
    var out = new Array(len);
    for (i = 0; i < len; i++) { if (decrypt) out[order[i]] = chars[i]; else out[i] = chars[order[i]]; }
    return out.join('');
  }

  // Playfair: 5x5 square (I/J merged, keyword first); letters only, uppercase output. Double letters get an X between them (Q between two X), odd length is padded with X (Q after a final X); decrypt returns the padded plaintext unchanged.
  function playfair(text, keyword, decrypt) {
    var t = lettersOf(text), k = lettersOf(keyword);
    if (t === null || !k) return null;
    var sq = mixedAlphabet(k, true), pos = Object.create(null), i;
    for (i = 0; i < 25; i++) pos[sq.charAt(i)] = i;
    t = t.replace(/J/g, 'I');
    var pairs = [];
    if (decrypt) {
      if (t.length % 2) return null;
      for (i = 0; i < t.length; i += 2) pairs.push([t.charAt(i), t.charAt(i + 1)]);
    } else {
      for (i = 0; i < t.length;) {
        var a = t.charAt(i), b = i + 1 < t.length ? t.charAt(i + 1) : '', fill = a === 'X' ? 'Q' : 'X';
        if (!b || a === b) { pairs.push([a, fill]); i++; }
        else { pairs.push([a, b]); i += 2; }
      }
    }
    var d = decrypt ? 4 : 1, out = [];
    pairs.forEach(function (p) {
      var x = pos[p[0]], y = pos[p[1]], rx = Math.floor(x / 5), cx = x % 5, ry = Math.floor(y / 5), cy = y % 5, r1, c1, r2, c2;
      if (rx === ry) { r1 = rx; r2 = ry; c1 = (cx + d) % 5; c2 = (cy + d) % 5; }
      else if (cx === cy) { c1 = cx; c2 = cy; r1 = (rx + d) % 5; r2 = (ry + d) % 5; }
      else { r1 = rx; c1 = cy; r2 = ry; c2 = cx; }
      out.push(sq.charAt(r1 * 5 + c1) + sq.charAt(r2 * 5 + c2));
    });
    return out.join('');
  }

  // Multiplicative inverse of a modulo 26, or null when a is not coprime with 26.
  function modInv26(a) { for (var x = 1; x < 26; x++) if ((a * x) % 26 === 1) return x; return null; }
  // Affine: E(x) = a*x + b mod 26 (a must be coprime with 26, else null); case and non-letters preserved.
  function affine(text, a, b, decrypt) {
    var A = toInt(a), B = toInt(b);
    if (typeof text !== 'string' || A === null || B === null) return null;
    A = ((A % 26) + 26) % 26; B = ((B % 26) + 26) % 26;
    var inv = modInv26(A);
    if (inv === null) return null;
    return mapLetters(text, function (u) {
      var x = u.charCodeAt(0) - 65;
      return UC.charAt(decrypt ? (((inv * (x - B)) % 26) + 26) % 26 : (A * x + B) % 26);
    });
  }

  // Polybius square (5x5, I/J merged, optional keyword for a mixed alphabet): encrypt gives "row col" digit pairs (1-5) separated by spaces; decrypt reads digit pairs, ignoring every non-digit.
  function polybius(text, keyword, decrypt) {
    var k = lettersOf(keyword);
    if (typeof text !== 'string' || k === null) return null;
    var sq = mixedAlphabet(k, true), i;
    if (!decrypt) {
      var out = [], t = lettersOf(text).replace(/J/g, 'I');
      for (i = 0; i < t.length; i++) { var p = sq.indexOf(t.charAt(i)); out.push((Math.floor(p / 5) + 1) + '' + (p % 5 + 1)); }
      return out.join(' ');
    }
    var d = text.replace(/[^0-9]/g, '');
    if (d.length % 2 || /[^1-5]/.test(d)) return null;
    var res = [];
    for (i = 0; i < d.length; i += 2) res.push(sq.charAt((Number(d.charAt(i)) - 1) * 5 + Number(d.charAt(i + 1)) - 1));
    return res.join('');
  }

  // Bacon (26-letter variant, every letter has its own code): encrypt gives 5-symbol A/B groups separated by spaces; decrypt takes A/B or 0/1 with any separators, length must be a multiple of 5.
  function bacon(text, decrypt) {
    var i;
    if (typeof text !== 'string') return null;
    if (!decrypt) {
      var t = lettersOf(text), out = [];
      for (i = 0; i < t.length; i++) out.push(('0000' + (t.charCodeAt(i) - 65).toString(2)).slice(-5).replace(/0/g, 'A').replace(/1/g, 'B'));
      return out.join(' ');
    }
    var s = text.replace(/[\s,.;:_\/|\-]/g, '').toUpperCase();
    if (/[^AB01]/.test(s) || s.length % 5) return null;
    var res = [];
    for (i = 0; i < s.length; i += 5) {
      var v = parseInt(s.substr(i, 5).replace(/A/g, '0').replace(/B/g, '1'), 2);
      if (v > 25) return null;
      res.push(UC.charAt(v));
    }
    return res.join('');
  }

  // Columnar transposition: letters only (uppercase); columns are read in alphabetical order of the keyword letters, ties left to right; encrypt pads with X, decrypt needs a multiple of the keyword length.
  function columnar(text, keyword, decrypt) {
    var t = lettersOf(text), k = lettersOf(keyword);
    if (t === null || !k) return null;
    var w = k.length, cols = [], i, c;
    for (i = 0; i < w; i++) cols.push(i);
    cols.sort(function (p, q) { return k.charCodeAt(p) - k.charCodeAt(q) || p - q; });
    if (decrypt) { if (t.length % w) return null; }
    else if (t.length % w) t += new Array(w - (t.length % w) + 1).join('X');
    var h = t.length / w, out = new Array(t.length), n = 0;
    for (c = 0; c < w; c++) for (i = 0; i < h; i++) {
      if (decrypt) out[i * w + cols[c]] = t.charAt(n++); else out[n++] = t.charAt(i * w + cols[c]);
    }
    return out.join('');
  }

  // Hex string (whitespace and a leading 0x allowed) -> byte array, or null if malformed (or empty unless allowEmpty).
  function hexBytes(s, allowEmpty) {
    if (typeof s !== 'string') return null;
    var t = s.replace(/\s+/g, '').replace(/^0x/i, '');
    if (!t) return allowEmpty ? [] : null;
    if (t.length % 2 || /[^0-9a-fA-F]/.test(t)) return null;
    var out = [];
    for (var i = 0; i < t.length; i += 2) out.push(parseInt(t.substr(i, 2), 16));
    return out;
  }
  // XOR with a repeating hex key. mode 'text->hex': UTF-8 bytes -> lowercase spaced hex; 'hex->text': hex bytes -> UTF-8 text (null if not valid UTF-8).
  function xorHex(text, keyHex, mode) {
    try {
      var key = hexBytes(keyHex, false);
      if (!key || typeof text !== 'string') return null;
      var bytes, i;
      if (mode === 'text->hex') bytes = Array.from(new TextEncoder().encode(text));
      else if (mode === 'hex->text') bytes = hexBytes(text, true);
      else return null;
      if (!bytes) return null;
      var out = new Array(bytes.length);
      for (i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ key[i % key.length];
      if (mode === 'hex->text') return bytesToText(out);
      return out.map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join(' ');
    } catch (e) { return null; }
  }

  // Monoalphabetic substitution: cipher alphabet = keyword (deduplicated) then the unused letters in order; case and non-letters preserved.
  function keywordSubstitution(text, keyword, decrypt) {
    var k = lettersOf(keyword);
    if (typeof text !== 'string' || !k) return null;
    var alpha = mixedAlphabet(k, false);
    return mapLetters(text, function (u) {
      return decrypt ? UC.charAt(alpha.indexOf(u)) : alpha.charAt(u.charCodeAt(0) - 65);
    });
  }

  // Beaufort: C = (K - P) mod 26 with a repeating key; self-reciprocal, so the same call encrypts and decrypts (the decrypt flag is ignored). Non-letters pass through and do not use up key letters.
  function beaufort(text, key, decrypt) {
    var k = lettersOf(key);
    if (typeof text !== 'string' || !k) return null;
    var i = 0;
    return mapLetters(text, function (u) {
      return UC.charAt((((k.charCodeAt(i++ % k.length) - u.charCodeAt(0)) % 26) + 26) % 26);
    });
  }
  // Autokey Vigenere: the key is followed by the plaintext letters themselves (on decrypt, by the letters recovered so far).
  function autokeyVigenere(text, key, decrypt) {
    var k = lettersOf(key);
    if (typeof text !== 'string' || !k) return null;
    var stream = k.split(''), i = 0;
    return mapLetters(text, function (u) {
      var s = stream[i++].charCodeAt(0) - 65, x = u.charCodeAt(0) - 65, r;
      if (decrypt) { r = (((x - s) % 26) + 26) % 26; stream.push(UC.charAt(r)); }
      else { r = (x + s) % 26; stream.push(u); }
      return UC.charAt(r);
    });
  }

  // Converts whitespace/comma separated integers between bases 2..36 (BigInt, lowercase output); null on bad digits, bad bases or input over 20000 characters.
  function baseConvert(text, fromBase, toBase) {
    try {
      var f = toInt(fromBase), g = toInt(toBase);
      if (typeof text !== 'string' || f === null || g === null || f < 2 || f > 36 || g < 2 || g > 36 || text.length > 20000) return null;
      var toks = text.split(/[\s,]+/).filter(Boolean), out = [], big = BigInt(f);
      for (var i = 0; i < toks.length; i++) {
        var tk = toks[i].toLowerCase(), v = BigInt(0);
        for (var j = 0; j < tk.length; j++) {
          var dgt = parseInt(tk.charAt(j), 36);
          if (isNaN(dgt) || dgt >= f) return null;
          v = v * big + BigInt(dgt);
        }
        out.push(v.toString(g));
      }
      return out.join(' ');
    } catch (e) { return null; }
  }

  var api = {
    caesar: caesar, atbash: atbash, vigenere: vigenere, rot13: rot13,
    base64Decode: base64Decode, base32Decode: base32Decode, hexDecode: hexDecode,
    binaryDecode: binaryDecode, morseDecode: morseDecode,
    railFence: railFence, playfair: playfair, affine: affine, polybius: polybius, bacon: bacon, columnar: columnar,
    xorHex: xorHex, keywordSubstitution: keywordSubstitution, baseConvert: baseConvert, beaufort: beaufort, autokeyVigenere: autokeyVigenere
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Ciphers = api;
})(typeof window !== 'undefined' ? window : this);
