// Tempra v0.5.0 — 2026-09-04 12:10
//
// Logica pura della sessione: come si compone l'elenco delle serie, come si
// legge la volta precedente, come si riassume la seduta. Niente React, niente
// database: solo funzioni testabili.

import { usesBarbell, BAR_KG } from './plates.js';

/**
 * Mappatura dei tre pulsanti del principiante (spec 2.4): il motore lavora
 * solo su `rir`, mai su come è stato inserito.
 */
export const RIR_FROM_INPUT = Object.freeze({ easy: 3, right: 2, limit: 1 });

/** Le opzioni RIR numeriche, per intermedi e avanzati. */
export const NUMERIC_RIR = Object.freeze([0, 1, 2, 3, 4]);

/**
 * Il principiante vede tre pulsanti invece di cinque (spec 7.1 e criterio 7.3).
 * @param {string} level
 * @returns {boolean}
 */
export function usesThreeButtonRir(level) {
  return level === 'beginner';
}

/** Frazioni del carico di lavoro per le serie di avvicinamento (spec 7.1). */
export const WARMUP_FRACTIONS = Object.freeze([0.5, 0.75]);

/**
 * Arrotonda all'incremento disponibile per quell'esercizio, senza scendere
 * sotto il minimo caricabile.
 * @param {number} kg
 * @param {number} increment
 * @param {number} minimum
 * @returns {number}
 */
export function roundToIncrement(kg, increment, minimum = 0) {
  const steps = Math.round((kg * 100) / (increment * 100));
  return Math.max(minimum, (steps * increment * 100) / 100);
}

/**
 * Il carico minimo che ha senso proporre: un bilanciere scarico pesa già 20 kg.
 * @param {object} exercise
 * @returns {number}
 */
export function minimumLoad(exercise) {
  return usesBarbell(exercise) ? BAR_KG : 0;
}

/**
 * Peso di partenza quando lo slot non è ancora calibrato. Non è una stima di
 * massimale (spec 4.1 la esclude): è solo un punto da cui il campo parte, che
 * l'utente cambia con lo stepper.
 * @param {object} exercise
 * @returns {number}
 */
export function defaultStartWeight(exercise) {
  if (usesBarbell(exercise)) return BAR_KG;
  return exercise?.loadIncrementKg === 1.25 ? 5 : 10;
}

/**
 * Serie di avvicinamento proposte per uno slot. Solo per i main, come da 7.1,
 * e solo se c'è un carico di lavoro da cui calcolarle.
 * @param {object} slot
 * @param {object} exercise
 * @returns {number[]} pesi, dal più leggero
 */
export function warmupWeights(slot, exercise) {
  if (slot.tier !== 'main') return [];
  const working = slot.workingWeightKg;
  if (!working) return [];

  const minimum = minimumLoad(exercise);
  const weights = WARMUP_FRACTIONS.map((fraction) =>
    roundToIncrement(working * fraction, exercise.loadIncrementKg, minimum)
  );

  // Se l'arrotondamento le fa coincidere fra loro o con il carico di lavoro,
  // non è un avvicinamento: è una serie in più.
  return weights.filter(
    (weight, index) => weight < working && weights.indexOf(weight) === index
  );
}

/**
 * Le righe da mostrare per uno slot: prima l'avvicinamento, poi il lavoro.
 * @param {object} slot
 * @param {object} exercise
 * @returns {Array<{ key: string, setIndex: number, isWarmup: boolean, suggestedWeightKg: number }>}
 */
export function buildRows(slot, exercise) {
  const warmups = warmupWeights(slot, exercise).map((weight, index) => ({
    key: `${slot.id}-w${index}`,
    setIndex: index,
    isWarmup: true,
    suggestedWeightKg: weight,
  }));

  const working = slot.workingWeightKg ?? defaultStartWeight(exercise);
  const work = Array.from({ length: slot.sets }, (_, index) => ({
    key: `${slot.id}-s${index}`,
    setIndex: index,
    isWarmup: false,
    suggestedWeightKg: working,
  }));

  return [...warmups, ...work];
}

/**
 * Le serie di lavoro dello stesso slot nella seduta precedente: è la riga
 * "ultima volta" (spec 7.1). Cerca la seduta **completata** più recente che
 * contenga quello slot, non semplicemente l'ultima seduta in assoluto.
 *
 * @param {string} slotId
 * @param {ReadonlyArray<object>} sessions
 * @param {string} [excludeSessionId] la seduta in corso
 * @returns {Array<object>} i SetLog di lavoro, nell'ordine in cui furono fatti
 */
export function lastTimeFor(slotId, sessions, excludeSessionId = null) {
  const candidates = sessions
    .filter(
      (session) =>
        session.id !== excludeSessionId &&
        session.status === 'completed' &&
        (session.sets ?? []).some((log) => log.slotId === slotId && !log.isWarmup)
    )
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));

  const previous = candidates[0];
  if (!previous) return [];
  return previous.sets.filter((log) => log.slotId === slotId && !log.isWarmup);
}

/**
 * Riepilogo di fine sessione (spec 7.1): serie di lavoro, tonnellaggio, durata.
 * @param {object} session
 * @returns {{ workSets: number, warmupSets: number, tonnageKg: number, durationMin: number|null }}
 */
export function sessionSummary(session) {
  const logs = session.sets ?? [];
  const work = logs.filter((log) => !log.isWarmup);

  const tonnageKg = work.reduce((sum, log) => sum + log.weightKg * log.reps, 0);

  let durationMin = null;
  if (session.startedAt && session.endedAt) {
    const ms = Date.parse(session.endedAt) - Date.parse(session.startedAt);
    durationMin = Math.max(0, Math.round(ms / 60000));
  }

  return {
    workSets: work.length,
    warmupSets: logs.length - work.length,
    tonnageKg: Math.round(tonnageKg),
    durationMin,
  };
}

/**
 * Stato di uno slot nella seduta: quante serie di lavoro sono state chiuse.
 * @param {object} slot
 * @param {ReadonlyArray<object>} logs
 * @returns {'todo'|'doing'|'done'}
 */
export function slotStatus(slot, logs) {
  const done = logs.filter((log) => log.slotId === slot.id && !log.isWarmup).length;
  if (done === 0) return 'todo';
  return done >= slot.sets ? 'done' : 'doing';
}
