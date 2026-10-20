(function (root) {
  const COOLDOWN_MS = 30000, PEN = [0, 5, 10, 20, 40];
  const PLACEHOLDER = '(hint not yet written)'; // keep in sync with tools/verify.py

  function nextAvailable(o) {
    // Normalize unlockedTier: treat values below 0 or non-integer as 0
    let tier = o.unlockedTier;
    if (!Number.isInteger(tier) || tier < 0) {
      tier = 0;
    }

    if (tier >= 4) return { tier: null, waitMs: 0 };

    // Handle clock skew: treat negative elapsed time as 0
    const elapsedMs = Math.max(0, o.now - o.lastHintAt);
    const wait = tier === 0 ? 0 : Math.max(0, o.cooldownMs - elapsedMs);

    return { tier: tier + 1, waitMs: wait };
  }

  const penalty = t => PEN[Math.max(0, Math.min(4, t))];

  // How many leading hint tiers (0..4) hold real text. Honors the build's hintsReady
  // but never trusts it beyond what the hints array actually contains.
  function availableTiers(level) {
    const hints = level && Array.isArray(level.hints) ? level.hints : [];
    let n = 0;
    while (n < 4 && typeof hints[n] === 'string' && hints[n].trim() !== '' && hints[n] !== PLACEHOLDER) n++;
    if (level && Number.isInteger(level.hintsReady)) n = Math.min(n, Math.max(0, Math.min(4, level.hintsReady)));
    return n;
  }

  const api = { nextAvailable, penalty, availableTiers, COOLDOWN_MS, PLACEHOLDER };
  if (typeof module !== 'undefined') module.exports = api; else root.Hints = api;
})(typeof window !== 'undefined' ? window : globalThis);
