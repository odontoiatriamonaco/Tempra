// Tempra v0.5.0 — 2026-09-04 12:10
//
// Calcolatore dischi (spec 7.1): dato un peso totale, quali dischi mettere per
// lato su un bilanciere olimpico.
//
// Tutti i conti in centesimi di chilo, con interi: 62,5 kg diventa 6250. Con i
// float, 0.1 + 0.2 non fa 0.3 e un disco da 1,25 sparirebbe per arrotondamento.

/** Bilanciere olimpico standard. */
export const BAR_KG = 20;

/** Dischi disponibili in palestra, dal più pesante. */
export const PLATES_KG = Object.freeze([25, 20, 15, 10, 5, 2.5, 1.25]);

const toCents = (kg) => Math.round(kg * 100);
const toKg = (cents) => cents / 100;

/**
 * @typedef {object} PlateResult
 * @property {'below-bar'|'empty-bar'|'ok'|'not-composable'} kind
 * @property {number[]} perSide dischi da caricare su un lato, dal più pesante
 * @property {number} totalKg il peso richiesto
 * @property {number|null} lowerKg peso componibile subito sotto (solo se non componibile)
 * @property {number|null} upperKg peso componibile subito sopra (solo se non componibile)
 */

/**
 * @param {number} totalKg peso totale desiderato, bilanciere compreso
 * @param {number} [barKg]
 * @param {ReadonlyArray<number>} [plates]
 * @returns {PlateResult}
 */
export function platesPerSide(totalKg, barKg = BAR_KG, plates = PLATES_KG) {
  const total = toCents(totalKg);
  const bar = toCents(barKg);
  const base = { perSide: [], totalKg, lowerKg: null, upperKg: null };

  if (total < bar) return { ...base, kind: 'below-bar' };
  if (total === bar) return { ...base, kind: 'empty-bar' };

  const sorted = [...plates].sort((a, b) => b - a);
  const smallest = toCents(sorted[sorted.length - 1]);

  // Il peso si divide fra i due lati: il carico per lato deve essere un
  // multiplo del disco più piccolo, altrimenti il bilanciere è asimmetrico.
  const perSideCents = (total - bar) / 2;
  if (!Number.isInteger(perSideCents) || perSideCents % smallest !== 0) {
    const step = smallest * 2; // un disco per lato cambia il totale del doppio
    const steps = (total - bar) / step;
    return {
      ...base,
      kind: 'not-composable',
      lowerKg: toKg(bar + Math.floor(steps) * step),
      upperKg: toKg(bar + Math.ceil(steps) * step),
    };
  }

  // Greedy: con questo set di dischi (multipli l'uno dell'altro fino a 1,25)
  // prendere sempre il più pesante che ci sta dà anche il numero minimo di dischi.
  let remaining = perSideCents;
  const perSide = [];
  for (const plate of sorted) {
    const cents = toCents(plate);
    while (remaining >= cents) {
      perSide.push(plate);
      remaining -= cents;
    }
  }

  if (remaining !== 0) {
    const step = smallest * 2;
    const steps = (total - bar) / step;
    return {
      ...base,
      kind: 'not-composable',
      lowerKg: toKg(bar + Math.floor(steps) * step),
      upperKg: toKg(bar + Math.ceil(steps) * step),
    };
  }

  return { ...base, kind: 'ok', perSide };
}

/**
 * Vero se l'esercizio si carica con un bilanciere, e quindi ha senso mostrargli
 * il calcolatore (spec 7.1).
 * @param {{ equipment?: ReadonlyArray<string> }} exercise
 * @returns {boolean}
 */
export function usesBarbell(exercise) {
  return Boolean(exercise?.equipment?.includes('barbell'));
}
