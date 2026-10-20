(function (root) {
  'use strict';
  // Pure text/alphabet helpers for the inline puzzle toolbox. Every function is total: it never throws,
  // and invalid input yields null (converters) or an empty/false result (analysers). Node-tested.
  function str(s) {
    if (s == null) return '';
    try { return String(s); } catch (e) { return ''; }
  }
  function isLetterCode(c) { return (c >= 65 && c <= 90) || (c >= 97 && c <= 122); }

  // [{ch, count, pct}] for A-Z letters (case-insensitive, no accent folding): count desc, then letter asc.
  function letterFrequency(text) {
    var t = str(text), counts = new Array(26), total = 0, i, c;
    for (i = 0; i < 26; i++) counts[i] = 0;
    for (i = 0; i < t.length; i++) {
      c = t.charCodeAt(i);
      if (c >= 97) c -= 32;
      if (c >= 65 && c <= 90) { counts[c - 65]++; total++; }
    }
    var out = [];
    for (i = 0; i < 26; i++) if (counts[i]) out.push({ ch: String.fromCharCode(97 + i), count: counts[i], pct: Math.round(1000 * counts[i] / total) / 10 });
    out.sort(function (a, b) { return b.count - a.count || (a.ch < b.ch ? -1 : a.ch > b.ch ? 1 : 0); });
    return out;
  }

  function reverseText(text) { return Array.from(str(text)).reverse().join(''); }
  // Reverses the ORDER of the words (whitespace separated); each word is kept as is.
  function reverseWords(text) {
    var w = str(text).split(/\s+/).filter(Boolean);
    return w.reverse().join(' ');
  }
  function sortLetters(text) {
    var t = str(text), counts = new Array(26), i, c, out = [];
    for (i = 0; i < 26; i++) counts[i] = 0;
    for (i = 0; i < t.length; i++) {
      c = t.charCodeAt(i);
      if (c >= 97) c -= 32;
      if (c >= 65 && c <= 90) counts[c - 65]++;
    }
    for (i = 0; i < 26; i++) if (counts[i]) out.push(new Array(counts[i] + 1).join(String.fromCharCode(97 + i)));
    return out.join('');
  }
  function textStats(text) {
    var t = str(text), letters = 0, digits = 0, i, c;
    for (i = 0; i < t.length; i++) {
      c = t.charCodeAt(i);
      if (isLetterCode(c)) letters++; else if (c >= 48 && c <= 57) digits++;
    }
    var words = t.split(/\s+/).filter(Boolean).length;
    return { chars: Array.from(t).length, letters: letters, digits: digits, words: words, lines: t === '' ? 0 : t.split(/\r\n|\r|\n/).length };
  }

  // ---- A1Z26 ----
  function a1z26Encode(text) {
    var words = str(text).split(/\s+/), out = [];
    for (var w = 0; w < words.length; w++) {
      var nums = [], s = words[w];
      for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i);
        if (c >= 97) c -= 32;
        if (c >= 65 && c <= 90) nums.push(c - 64);
      }
      if (nums.length) out.push(nums.join('-'));
    }
    return out.join(' / ');
  }
  function a1z26Decode(s) {
    var t = str(s).trim();
    if (!t) return '';
    var words = t.split(/\s*\/\s*|\s{2,}/), out = [];
    for (var w = 0; w < words.length; w++) {
      var toks = words[w].split(/[\s,;\-]+/).filter(Boolean), word = '';
      for (var i = 0; i < toks.length; i++) {
        if (!/^\d{1,2}$/.test(toks[i])) return null;
        var n = parseInt(toks[i], 10);
        if (n < 1 || n > 26) return null;
        word += String.fromCharCode(64 + n);
      }
      if (word) out.push(word);
    }
    return out.join(' ');
  }

  // ---- NATO ----
  var NATO_WORDS = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliett', 'Kilo', 'Lima', 'Mike',
    'November', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'X-ray', 'Yankee', 'Zulu'];
  var NATO_DECODE = Object.create(null); // no prototype: "constructor" / "__proto__" are unknown words
  NATO_WORDS.forEach(function (w, i) { NATO_DECODE[w.toLowerCase()] = String.fromCharCode(65 + i); });
  NATO_DECODE.alpha = 'A'; NATO_DECODE.juliet = 'J'; NATO_DECODE.whisky = 'W'; NATO_DECODE.xray = 'X';

  function natoEncode(text) {
    var words = str(text).split(/\s+/), out = [];
    for (var w = 0; w < words.length; w++) {
      var s = words[w], parts = [];
      for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i);
        if (c >= 97) c -= 32;
        if (c >= 65 && c <= 90) parts.push(NATO_WORDS[c - 65]);
      }
      if (parts.length) out.push(parts.join(' '));
    }
    return out.join(' / ');
  }
  function natoDecode(s) {
    var t = str(s).trim();
    if (!t) return '';
    var words = t.split(/\s*\/\s*/), out = [];
    for (var w = 0; w < words.length; w++) {
      var toks = words[w].split(/[\s,]+/).filter(Boolean), word = '';
      for (var i = 0; i < toks.length; i++) {
        var ch = NATO_DECODE[toks[i].toLowerCase()];
        if (typeof ch !== 'string') return null;
        word += ch;
      }
      if (word) out.push(word);
    }
    return out.join(' ');
  }

  // ---- text <-> numeric codes (UTF-16 code units below 256 only) ----
  var BASE_RE = { 2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^[0-9]+$/, 16: /^(?:0x)?[0-9a-f]+$/i };
  var BASE_PAD = { 2: 8, 8: 3, 10: 0, 16: 2 };
  function validBase(b) { return b === 2 || b === 8 || b === 10 || b === 16; }
  function pad(s, n) { return s.length >= n ? s : new Array(n - s.length + 1).join('0') + s; }

  function textToCodes(text, base) {
    base = Number(base);
    if (!validBase(base)) return null;
    var t = str(text), out = new Array(t.length);
    for (var i = 0; i < t.length; i++) {
      var c = t.charCodeAt(i);
      if (c > 255) return null;
      out[i] = pad(c.toString(base).toUpperCase(), BASE_PAD[base]);
    }
    return out.join(' ');
  }
  function codesToText(s, base) {
    base = Number(base);
    if (!validBase(base)) return null;
    var toks = str(s).split(/[\s,]+/).filter(Boolean), codes = [];
    for (var i = 0; i < toks.length; i++) {
      var tok = toks[i];
      if (!BASE_RE[base].test(tok)) return null;
      if (base === 2 && tok.length > 8) { // an unbroken run of bytes, e.g. 0110100001101001
        if (tok.length % 8) return null;
        for (var j = 0; j < tok.length; j += 8) codes.push(parseInt(tok.substr(j, 8), 2));
        continue;
      }
      if (tok.length > 12) return null;
      var n = parseInt(tok.replace(/^0x/i, ''), base);
      if (!(n >= 0 && n < 256)) return null;
      codes.push(n);
    }
    var out = new Array(codes.length);
    for (var k = 0; k < codes.length; k++) out[k] = String.fromCharCode(codes[k]);
    return out.join('');
  }

  function asciiTable() {
    var rows = [];
    for (var d = 32; d <= 126; d++) rows.push({ dec: d, hex: pad(d.toString(16).toUpperCase(), 2), oct: pad(d.toString(8), 3), bin: pad(d.toString(2), 8), ch: String.fromCharCode(d) });
    return rows;
  }

  // Same table as js/ciphers.js (a test asserts they agree); kept separate so ciphers.js stays untouched.
  var MORSE_BY_CHAR = {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
    N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.'
  };
  function morseTable() {
    return Object.keys(MORSE_BY_CHAR).sort(function (a, b) {
      var la = a > '9', lb = b > '9';
      return la === lb ? (a < b ? -1 : a > b ? 1 : 0) : (la ? -1 : 1);
    }).map(function (ch) { return { ch: ch, code: MORSE_BY_CHAR[ch] }; });
  }

  // ---- anagram helper ----
  function letterMultiset(text) {
    var t = str(text), m = Object.create(null);
    for (var i = 0; i < t.length; i++) {
      var c = t.charCodeAt(i);
      if (c >= 97) c -= 32;
      if (c >= 65 && c <= 90) { var k = String.fromCharCode(c + 32); m[k] = (m[k] || 0) + 1; }
    }
    return m;
  }
  // Can `word` be spelled from the letters in lettersText (each letter used at most as often as it appears)?
  // Non-letters are ignored on both sides; a word with no letters is false.
  function canForm(lettersText, word) {
    var have = letterMultiset(lettersText), need = letterMultiset(word), any = false;
    for (var k in need) {
      any = true;
      if (!(have[k] >= need[k])) return false;
    }
    return any;
  }

  // ---- cipher workbench operations (shared by the #/tools page and the inline panel) ----
  // [id, label, group, fields, reversible, help]. fields: s=shift k=keyword/key r=rails a,b=affine h=hex key f,t=bases.
  var OPS = [
    ['caesar', 'Caesar shift', 'Existing', 's', 0, 'Caesar: every letter moves the same number of places along the alphabet.'],
    ['rot13', 'ROT13', 'Existing', '', 0, 'ROT13: a Caesar shift of 13, so applying it twice gives the original text.'],
    ['atbash', 'Atbash', 'Existing', '', 0, 'Atbash: the alphabet is mirrored, so A becomes Z and B becomes Y.'],
    ['vigenere', 'Vigenere', 'Existing', 'k', 1, 'Vigenere: a repeating keyword gives each letter its own Caesar shift.'],
    ['base64', 'Base64 decode', 'Existing', '', 0, 'Base64 decode: turns text such as SGVsbG8= back into readable text.'],
    ['base32', 'Base32 decode', 'Existing', '', 0, 'Base32 decode: like Base64 but only capital letters and the digits 2 to 7.'],
    ['hex', 'Hex decode', 'Existing', '', 0, 'Hex decode: pairs of hex digits are bytes of text.'],
    ['binary', 'Binary decode', 'Existing', '', 0, 'Binary decode: groups of eight 0s and 1s are bytes of text.'],
    ['morse', 'Morse decode', 'Existing', '', 0, 'Morse decode: dots and dashes, letters separated by spaces and words by a slash.'],
    ['beaufort', 'Beaufort', 'Substitution', 'k', 0, 'Beaufort: like Vigenere but each letter is subtracted from the key; the same step encrypts and decrypts.'],
    ['autokey', 'Autokey Vigenere', 'Substitution', 'k', 1, 'Autokey: the key is used once, then the message itself becomes the key.'],
    ['affine', 'Affine', 'Substitution', 'ab', 1, 'Affine: each letter x becomes a*x+b (mod 26); a must share no factor with 26.'],
    ['keysub', 'Keyword substitution', 'Substitution', 'k', 1, 'Keyword substitution: the keyword starts a scrambled alphabet, the unused letters follow in order.'],
    ['playfair', 'Playfair', 'Substitution', 'k', 1, 'Playfair: letters are swapped in pairs using a 5x5 keyword square (I and J share a cell).'],
    ['railfence', 'Rail fence', 'Transposition', 'r', 1, 'Rail fence: letters are written in a zig-zag over N rails and read off row by row.'],
    ['columnar', 'Columnar transposition', 'Transposition', 'k', 1, 'Columnar: text is written in rows under the keyword, then columns are read in alphabetical order of its letters.'],
    ['polybius', 'Polybius square', 'Encodings & bases', 'k', 1, 'Polybius: each letter becomes its row and column number in a 5x5 square; the keyword is optional.'],
    ['bacon', 'Bacon cipher', 'Encodings & bases', '', 1, 'Bacon: each letter is five A/B symbols (A=0, B=1 in binary); decrypt accepts A/B or 0/1.'],
    ['xor', 'XOR with hex key', 'Encodings & bases', 'h', 1, 'XOR: every byte is combined with a repeating hex key. Encrypt gives hex; decrypt reads hex and gives text.'],
    ['baseconv', 'Number base convert', 'Encodings & bases', 'ft', 0, 'Base convert: whole numbers (separated by spaces or commas) from one base to another, 2 to 36.']
  ];
  var CIPHER_OPS = OPS.map(function (o) { return [o[0], o[1]]; });
  var CIPHER_META = Object.create(null);
  OPS.forEach(function (o) { CIPHER_META[o[0]] = { group: o[2], fields: o[3], reversible: !!o[4], help: o[5] }; });
  // extra (optional): {rails, a, b, keyHex, from, to}. decrypt is the Decrypt tick box (for xor: hex to text).
  function runCipher(C, op, text, shift, key, decrypt, extra) {
    var x = extra || {};
    try {
      switch (op) {
        case 'caesar': return C.caesar(text, shift);
        case 'rot13': return C.rot13(text);
        case 'atbash': return C.atbash(text);
        case 'vigenere': return C.vigenere(text, key, decrypt);
        case 'base64': return C.base64Decode(text);
        case 'base32': return C.base32Decode(text);
        case 'hex': return C.hexDecode(text);
        case 'binary': return C.binaryDecode(text);
        case 'morse': return C.morseDecode(text);
        case 'beaufort': return C.beaufort(text, key, decrypt);
        case 'autokey': return C.autokeyVigenere(text, key, decrypt);
        case 'affine': return C.affine(text, x.a, x.b, decrypt);
        case 'keysub': return C.keywordSubstitution(text, key, decrypt);
        case 'playfair': return C.playfair(text, key, decrypt);
        case 'railfence': return C.railFence(text, x.rails, decrypt);
        case 'columnar': return C.columnar(text, key, decrypt);
        case 'polybius': return C.polybius(text, key, decrypt);
        case 'bacon': return C.bacon(text, decrypt);
        case 'xor': return C.xorHex(text, x.keyHex, decrypt ? 'hex->text' : 'text->hex');
        case 'baseconv': return C.baseConvert(text, x.from, x.to);
      }
    } catch (e) { /* fall through */ }
    return null;
  }

  var api = {
    letterFrequency: letterFrequency, reverseText: reverseText, reverseWords: reverseWords, sortLetters: sortLetters, textStats: textStats,
    a1z26Encode: a1z26Encode, a1z26Decode: a1z26Decode, natoEncode: natoEncode, natoDecode: natoDecode,
    textToCodes: textToCodes, codesToText: codesToText, asciiTable: asciiTable, morseTable: morseTable,
    letterMultiset: letterMultiset, canForm: canForm, cipherOps: CIPHER_OPS, cipherMeta: CIPHER_META, runCipher: runCipher
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.Toolbox = root.Toolbox || {}; for (var k in api) root.Toolbox[k] = api[k]; } // toolbox_ui.js adds mount/cipherPanel
})(typeof window !== 'undefined' ? window : this);
