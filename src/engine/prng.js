// Tempra v0.3.0 — 2026-09-04 10:40
//
// Generatore pseudocasuale seedato (mulberry32). Serve a una cosa sola: dare
// varietà agli esercizi scelti restando **deterministico**, così che lo stesso
// seed produca sempre la stessa scheda (criterio 3.7).
//
// `Math.random()` qui sarebbe un errore: renderebbe la generazione irripetibile
// e gli snapshot test impossibili.

/**
 * @param {number} seed intero a 32 bit
 * @returns {() => number} funzione che restituisce un numero in [0, 1)
 */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Intero in [0, max).
 * @param {() => number} rng
 * @param {number} max
 * @returns {number}
 */
export function nextInt(rng, max) {
  return Math.floor(rng() * max);
}

/**
 * Copia mescolata dell'array (Fisher-Yates). Non muta l'originale.
 * @template T
 * @param {() => number} rng
 * @param {readonly T[]} items
 * @returns {T[]}
 */
export function shuffle(rng, items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = nextInt(rng, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Trasforma una stringa in un seed intero, così che un seed possa essere
 * anche leggibile (es. il nome del mesociclo).
 * @param {string} text
 * @returns {number}
 */
export function seedFromString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
