// Tempra v0.3.0 — 2026-09-04 10:40
//
// Gli enum della sezione 2 della spec in forma eseguibile. Unica fonte per
// catalogo, motori e test: se un valore non è qui dentro, non è valido.

/** Schemi di movimento. I primi sette sono multiarticolari. */
export const MULTI_JOINT_PATTERNS = Object.freeze([
  'squat',
  'hinge',
  'lunge',
  'h-push',
  'v-push',
  'h-pull',
  'v-pull',
]);

/** Schemi di isolamento. */
export const ISOLATION_PATTERNS = Object.freeze([
  'iso-quad',
  'iso-ham',
  'iso-glute',
  'iso-calf',
  'iso-chest',
  'iso-back',
  'iso-delt-side',
  'iso-delt-rear',
  'iso-biceps',
  'iso-triceps',
]);

export const PATTERNS = Object.freeze([
  ...MULTI_JOINT_PATTERNS,
  ...ISOLATION_PATTERNS,
  'core',
]);

export const MUSCLES = Object.freeze([
  'chest',
  'front-delts',
  'side-delts',
  'rear-delts',
  'lats',
  'upper-back',
  'lower-back',
  'traps',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
  'obliques',
]);

/**
 * Gruppi grandi: sono quelli attorno a cui è costruito lo split, gli unici che
 * ricevono lavoro come main o secondary di un pattern multiarticolare. Sono
 * loro a decidere se il volume di un livello è raggiungibile (spec 3.3) e
 * quindi se `effectiveLevel` va degradato.
 */
export const LARGE_MUSCLES = Object.freeze([
  'chest',
  'lats',
  'quads',
  'hamstrings',
  'glutes',
]);

/**
 * Gruppi piccoli: target di volume settimanale dimezzato (spec 3.3).
 * La spec ne elenca tre; qui rientrano anche i gruppi che nel catalogo si
 * allenano solo come isolamento — braccia, deltoidi laterali e posteriori,
 * trapezi, lombari, addome. Chiedere loro il volume di un gruppo grande
 * significherebbe riempire la seduta di alzate laterali. Vedi DECISIONS.md.
 */
export const SMALL_MUSCLES = Object.freeze([
  'calves',
  'forearms',
  'obliques',
  'abs',
  'traps',
  'lower-back',
  'upper-back',
  'front-delts',
  'side-delts',
  'rear-delts',
  'biceps',
  'triceps',
]);

export const TIERS = Object.freeze(['main', 'secondary', 'accessory']);

export const GOALS = Object.freeze(['strength', 'hypertrophy', 'recomp']);

export const LEVELS = Object.freeze(['beginner', 'intermediate', 'advanced']);

/** Incrementi di carico ammessi, in kg. */
export const LOAD_INCREMENTS = Object.freeze([1.25, 2.5, 5]);

/** Recuperi di default ammessi, in secondi. */
export const DEFAULT_REST_SECONDS = Object.freeze([90, 120, 180]);

/**
 * Vero se il pattern coinvolge più articolazioni: è il criterio con cui
 * `generate.js` decide dove mettere main e secondary (spec 3.5).
 * @param {string} pattern
 * @returns {boolean}
 */
export function isMultiJoint(pattern) {
  return MULTI_JOINT_PATTERNS.includes(pattern);
}
