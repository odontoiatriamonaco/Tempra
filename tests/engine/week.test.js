// Tempra v0.3.0 — 2026-09-04 10:40
//
// Periodizzazione del mesociclo, tabella 3.6.

import { describe, expect, it } from 'vitest';
import catalog from '../../src/data/exercises.json' with { type: 'json' };
import { generateProgram } from '../../src/engine/generate.js';
import { WEEKS_PER_MESOCYCLE, getWeekPlan, setsForWeek } from '../../src/engine/week.js';

const params = {
  goal: 'hypertrophy',
  daysPerWeek: 4,
  minutesPerSession: 60,
  level: 'intermediate',
};
const program = generateProgram(params, catalog, 20260904);

/** La tabella 3.6, riscritta a mano per non ricopiare l'implementazione. */
const TABLE = [
  { week: 0, rir: 3, bonus: { main: 0, secondary: 0, accessory: 0 }, deload: false },
  { week: 1, rir: 2, bonus: { main: 0, secondary: 0, accessory: 0 }, deload: false },
  { week: 2, rir: 2, bonus: { main: 0, secondary: 1, accessory: 0 }, deload: false },
  { week: 3, rir: 1, bonus: { main: 0, secondary: 1, accessory: 0 }, deload: false },
  { week: 4, rir: 1, bonus: { main: 1, secondary: 1, accessory: 1 }, deload: false },
  { week: 5, rir: 4, bonus: null, deload: true },
];

describe('getWeekPlan', () => {
  it('il mesociclo dura 6 settimane', () => {
    expect(WEEKS_PER_MESOCYCLE).toBe(6);
  });

  it.each(TABLE)('la settimana $week ha RIR target $rir', ({ week, rir }) => {
    expect(getWeekPlan(program, week).targetRIR).toBe(rir);
  });

  it.each(TABLE)('la settimana $week applica le serie previste', ({ week, bonus, deload }) => {
    const plan = getWeekPlan(program, week);
    expect(plan.isDeload).toBe(deload);

    for (const [dayIndex, day] of plan.days.entries()) {
      for (const [slotIndex, slot] of day.slots.entries()) {
        const base = program.days[dayIndex].slots[slotIndex].sets;
        const expected = deload
          ? Math.max(1, Math.ceil(base / 2))
          : base + bonus[slot.tier];
        expect(slot.sets, `${day.label} · ${slot.exerciseId}`).toBe(expected);
        expect(slot.baseSets).toBe(base);
      }
    }
  });

  it('lo scarico dimezza per eccesso e non scende sotto una serie', () => {
    const deload = TABLE[5];
    expect(setsForWeek(1, 'main', { deload: true, setBonus: {} })).toBe(1);
    expect(setsForWeek(2, 'main', { deload: true, setBonus: {} })).toBe(1);
    expect(setsForWeek(3, 'main', { deload: true, setBonus: {} })).toBe(2);
    expect(setsForWeek(5, 'main', { deload: true, setBonus: {} })).toBe(3);
    expect(deload.deload).toBe(true);
  });

  it('la settimana di scarico ha meno serie totali della settimana di picco', () => {
    const total = (week) =>
      getWeekPlan(program, week).days.reduce(
        (sum, day) => sum + day.slots.reduce((s, slot) => s + slot.sets, 0),
        0
      );
    expect(total(5)).toBeLessThan(total(4));
    expect(total(4)).toBeGreaterThan(total(0));
  });

  it('non muta il programma', () => {
    const before = JSON.stringify(program);
    for (let week = 0; week < WEEKS_PER_MESOCYCLE; week += 1) getWeekPlan(program, week);
    expect(JSON.stringify(program)).toBe(before);
  });

  it('rifiuta una settimana fuori dal mesociclo', () => {
    expect(() => getWeekPlan(program, 6)).toThrow(RangeError);
    expect(() => getWeekPlan(program, -1)).toThrow(RangeError);
  });
});
