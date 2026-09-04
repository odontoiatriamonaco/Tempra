// Tempra v0.6.0 — 2026-09-04 13:00
//
// Modalità "poco tempo" (spec sezione 5). Funzione pura: il giorno del
// programma non viene mai toccato, si restituisce una copia ridotta.
//
// L'ordine dei tagli non è negoziabile ed è quello della spec: prima
// spariscono gli accessori, poi si accorciano e spariscono i complementari,
// e solo alla fine si tocca il lavoro principale — che comunque non viene
// mai rimosso.

import {
  GENERAL_WARMUP_SEC,
  SET_OVERHEAD_SEC,
  WARMUP_SETS,
  WARMUP_SET_SEC,
} from './generate.js';

/** Serie minime a cui si può scendere prima di rimuovere lo slot. */
const REDUCED_SETS = 2;

/** Recupero a cui si comprimono i main come ultima risorsa (spec 5, passo 5). */
const REDUCED_MAIN_REST_SEC = 120;

/**
 * @param {{ tier: string, sets: number, restSec: number }} slot
 * @returns {number}
 */
function slotSeconds(slot) {
  return (
    slot.sets * (slot.restSec + SET_OVERHEAD_SEC) +
    WARMUP_SETS[slot.tier] * WARMUP_SET_SEC
  );
}

/**
 * @param {ReadonlyArray<object>} slots
 * @returns {number}
 */
function totalSeconds(slots) {
  return slots.reduce((sum, slot) => sum + slotSeconds(slot), 0);
}

/**
 * Budget di lavoro per una seduta di `minutes` minuti: gli otto minuti di
 * riscaldamento generale sono già scorporati, come in 3.4.
 * @param {number} minutes
 * @returns {number}
 */
export function targetBudgetSeconds(minutes) {
  return minutes * 60 - GENERAL_WARMUP_SEC;
}

/**
 * Riduce il giorno per rientrare in `targetMinutes`.
 *
 * @param {object} dayPlan giorno del programma (o della settimana)
 * @param {number} targetMinutes 20, 30 o 45
 * @returns {object} copia ridotta, con `reducedToMinutes`, `estimatedSeconds`
 *   e `overTarget` (vero se nemmeno l'ultimo taglio basta)
 */
export function reduceSession(dayPlan, targetMinutes) {
  const budget = targetBudgetSeconds(targetMinutes);
  let slots = dayPlan.slots.map((slot) => ({ ...slot }));

  const over = () => totalSeconds(slots) > budget;
  const lastIndexOfTier = (tier) => {
    for (let i = slots.length - 1; i >= 0; i -= 1) {
      if (slots[i].tier === tier) return i;
    }
    return -1;
  };

  // 1. Via gli accessori, dall'ultimo al primo.
  while (over()) {
    const index = lastIndexOfTier('accessory');
    if (index === -1) break;
    slots.splice(index, 1);
  }

  // 2. Complementari a due serie.
  if (over()) {
    slots = slots.map((slot) =>
      slot.tier === 'secondary'
        ? { ...slot, sets: Math.min(slot.sets, REDUCED_SETS) }
        : slot
    );
  }

  // 3. Via i complementari, dall'ultimo al primo.
  while (over()) {
    const index = lastIndexOfTier('secondary');
    if (index === -1) break;
    slots.splice(index, 1);
  }

  // 4. Fondamentali a due serie.
  if (over()) {
    slots = slots.map((slot) =>
      slot.tier === 'main' ? { ...slot, sets: Math.min(slot.sets, REDUCED_SETS) } : slot
    );
  }

  // 5. Recupero dei fondamentali a 120 s. I main non si rimuovono mai: se
  // ancora non basta, la seduta si propone lo stesso con un avviso.
  if (over()) {
    slots = slots.map((slot) =>
      slot.tier === 'main'
        ? { ...slot, restSec: Math.min(slot.restSec, REDUCED_MAIN_REST_SEC) }
        : slot
    );
  }

  const estimatedSeconds = totalSeconds(slots);

  return {
    ...dayPlan,
    slots: slots.map((slot, index) => ({ ...slot, order: index })),
    reducedToMinutes: targetMinutes,
    estimatedSeconds,
    overTarget: estimatedSeconds > budget,
    /** Minuti realmente stimati, riscaldamento generale compreso. */
    estimatedMinutes: Math.round((estimatedSeconds + GENERAL_WARMUP_SEC) / 60),
  };
}
