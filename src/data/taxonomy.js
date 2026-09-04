// Tempra v0.2.0 — 2026-09-04 09:12
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
 * Gruppi piccoli: hanno target di volume settimanale dimezzato (spec 3.3).
 */
export const SMALL_MUSCLES = Object.freeze(['calves', 'forearms', 'obliques']);

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
