// Tempra v0.3.0 — 2026-09-04 10:40
//
// Periodizzazione del mesociclo. Spec 3.6.
//
// Il `Program` contiene le serie "base": una settimana è una vista su quel
// programma, non una copia modificata. `getWeekPlan` non muta niente.

/**
 * Le sei settimane del mesociclo. `setBonus` è additivo per tier; `deload`
 * dimezza tutto (arrotondando per eccesso, minimo 1).
 */
export const WEEK_PLANS = Object.freeze([
  { targetRIR: 3, setBonus: {}, deload: false, note: 'Calibrazione dei carichi' },
  { targetRIR: 2, setBonus: {}, deload: false, note: null },
  { targetRIR: 2, setBonus: { secondary: 1 }, deload: false, note: null },
  { targetRIR: 1, setBonus: { secondary: 1 }, deload: false, note: null },
  { targetRIR: 1, setBonus: { main: 1, secondary: 1, accessory: 1 }, deload: false, note: 'Settimana di picco' },
  { targetRIR: 4, setBonus: {}, deload: true, note: 'Scarico: stesso peso, metà volume' },
]);

export const WEEKS_PER_MESOCYCLE = WEEK_PLANS.length;

/**
 * Serie di uno slot nella settimana indicata.
 * @param {number} baseSets
 * @param {string} tier
 * @param {(typeof WEEK_PLANS)[number]} plan
 * @returns {number}
 */
export function setsForWeek(baseSets, tier, plan) {
  if (plan.deload) return Math.max(1, Math.ceil(baseSets / 2));
  return baseSets + (plan.setBonus[tier] ?? 0);
}

/**
 * La settimana `weekIndex` del programma: stessi esercizi, serie e RIR target
 * della tabella 3.6.
 *
 * @param {object} program
 * @param {number} weekIndex 0–5
 * @returns {{ weekIndex: number, targetRIR: number, isDeload: boolean, note: string|null, days: object[] }}
 */
export function getWeekPlan(program, weekIndex) {
  const plan = WEEK_PLANS[weekIndex];
  if (!plan) {
    throw new RangeError(
      `Settimana ${weekIndex} fuori dal mesociclo (0–${WEEKS_PER_MESOCYCLE - 1}).`
    );
  }

  return {
    weekIndex,
    targetRIR: plan.targetRIR,
    isDeload: plan.deload,
    note: plan.note,
    days: program.days.map((day) => ({
      ...day,
      slots: day.slots.map((slot) => ({
        ...slot,
        sets: setsForWeek(slot.sets, slot.tier, plan),
        baseSets: slot.sets,
      })),
    })),
  };
}
