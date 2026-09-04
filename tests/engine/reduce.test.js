// Tempra v0.6.0 — 2026-09-04 13:00
//
// Modalità "poco tempo". Criteri 5.1.

import { describe, expect, it } from 'vitest';
import catalog from '../../src/data/exercises.json' with { type: 'json' };
import { generateProgram, GENERAL_WARMUP_SEC } from '../../src/engine/generate.js';
import { reduceSession, targetBudgetSeconds } from '../../src/engine/reduce.js';

const programOf = (minutes, level = 'intermediate') =>
  generateProgram(
    { goal: 'hypertrophy', daysPerWeek: 4, minutesPerSession: minutes, level },
    catalog,
    20260904
  );

const tiers = (day, tier) => day.slots.filter((slot) => slot.tier === tier);

describe('reduceSession — da 60 a 30 minuti', () => {
  const day = programOf(60).days[0];
  const reduced = reduceSession(day, 30);

  it('non rimuove nessun fondamentale', () => {
    expect(tiers(reduced, 'main').map((s) => s.exerciseId)).toEqual(
      tiers(day, 'main').map((s) => s.exerciseId)
    );
  });

  it('rientra nei 30 minuti, riscaldamento compreso', () => {
    expect(reduced.estimatedSeconds + GENERAL_WARMUP_SEC).toBeLessThanOrEqual(30 * 60);
    expect(reduced.overTarget).toBe(false);
    expect(reduced.estimatedMinutes).toBeLessThanOrEqual(30);
  });

  it('registra a quanti minuti è stata ridotta', () => {
    expect(reduced.reducedToMinutes).toBe(30);
  });

  it('taglia gli accessori prima dei complementari', () => {
    expect(tiers(reduced, 'accessory').length).toBeLessThan(tiers(day, 'accessory').length);
  });
});

describe('reduceSession — da 90 a 20 minuti', () => {
  const day = programOf(90).days[0];
  const reduced = reduceSession(day, 20);

  it('lascia solo i fondamentali', () => {
    expect(tiers(reduced, 'accessory')).toHaveLength(0);
    expect(tiers(reduced, 'secondary')).toHaveLength(0);
    expect(tiers(reduced, 'main').length).toBeGreaterThan(0);
  });

  it('porta i fondamentali a due serie', () => {
    for (const slot of tiers(reduced, 'main')) expect(slot.sets).toBeLessThanOrEqual(2);
  });

  it('comprime il recupero dei fondamentali a 120 s', () => {
    for (const slot of tiers(reduced, 'main')) expect(slot.restSec).toBeLessThanOrEqual(120);
  });

  it('avvisa se nemmeno così ci si rientra', () => {
    const budget = targetBudgetSeconds(20);
    if (reduced.estimatedSeconds > budget) {
      expect(reduced.overTarget).toBe(true);
      expect(reduced.estimatedMinutes).toBeGreaterThan(20);
    } else {
      expect(reduced.overTarget).toBe(false);
    }
  });
});

describe('reduceSession — proprietà', () => {
  it.each([
    [60, 45],
    [60, 30],
    [75, 30],
    [90, 20],
    [90, 45],
  ])('da %s a %s minuti è idempotente', (from, to) => {
    const day = programOf(from).days[0];
    const once = reduceSession(day, to);
    const twice = reduceSession(once, to);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });

  it('non modifica il piano originale', () => {
    const program = programOf(90);
    const before = JSON.stringify(program);
    for (const day of program.days) {
      reduceSession(day, 20);
      reduceSession(day, 30);
      reduceSession(day, 45);
    }
    expect(JSON.stringify(program)).toBe(before);
  });

  it('non rimuove mai un fondamentale, a nessun target', () => {
    for (const minutes of [20, 30, 45]) {
      for (const day of programOf(90).days) {
        const reduced = reduceSession(day, minutes);
        expect(tiers(reduced, 'main').length, `${day.label} → ${minutes}min`).toBe(
          tiers(day, 'main').length
        );
      }
    }
  });

  it('non allunga mai la seduta', () => {
    for (const day of programOf(60).days) {
      const reduced = reduceSession(day, 45);
      expect(reduced.estimatedSeconds).toBeLessThanOrEqual(day.estimatedSeconds);
    }
  });

  it('rinumera gli slot rimasti senza buchi', () => {
    const reduced = reduceSession(programOf(90).days[0], 30);
    expect(reduced.slots.map((slot) => slot.order)).toEqual(
      reduced.slots.map((_, index) => index)
    );
  });
});
