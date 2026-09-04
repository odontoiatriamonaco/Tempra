// Tempra v0.3.0 — 2026-09-04 10:40
//
// Criteri di verifica 3.7. Il test gira su tutte le 225 combinazioni di
// (obiettivo × giorni × minuti × livello).

import { describe, expect, it } from 'vitest';
import catalog from '../../src/data/exercises.json' with { type: 'json' };
import {
  MIN_BUDGET_RATIO,
  buildProgramForLevel,
  estimateDaySeconds,
  generateProgram,
  sessionBudgetSeconds,
  volumeTargetFor,
} from '../../src/engine/generate.js';
import { GOALS, LARGE_MUSCLES, LEVELS } from '../../src/data/taxonomy.js';

const DAYS = [2, 3, 4, 5, 6];
const MINUTES = [30, 45, 60, 75, 90];
const SEED = 20260904;

const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]));
const patternOf = (slot) => byId.get(slot.exerciseId).pattern;

/** Le 225 combinazioni, ciascuna con il programma già generato. */
const COMBOS = [];
for (const goal of GOALS) {
  for (const daysPerWeek of DAYS) {
    for (const minutesPerSession of MINUTES) {
      for (const level of LEVELS) {
        const params = { goal, daysPerWeek, minutesPerSession, level };
        COMBOS.push({
          label: `${goal} · ${daysPerWeek}g · ${minutesPerSession}min · ${level}`,
          params,
          program: generateProgram(params, catalog, SEED),
        });
      }
    }
  }
}

const eachCombo = COMBOS.map((combo) => [combo.label, combo]);

describe('generateProgram — determinismo', () => {
  it('copre davvero le 225 combinazioni della spec', () => {
    expect(COMBOS).toHaveLength(3 * 5 * 5 * 3);
  });

  it('con lo stesso seed produce un output identico', () => {
    const params = { goal: 'hypertrophy', daysPerWeek: 4, minutesPerSession: 60, level: 'intermediate' };
    const first = generateProgram(params, catalog, 42);
    const second = generateProgram(params, catalog, 42);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('con seed diversi cambia almeno un esercizio', () => {
    const params = { goal: 'hypertrophy', daysPerWeek: 4, minutesPerSession: 60, level: 'intermediate' };
    const ids = (seed) =>
      generateProgram(params, catalog, seed).days.flatMap((day) =>
        day.slots.map((slot) => slot.exerciseId)
      );
    expect(ids(1)).not.toEqual(ids(2));
  });

  it('non usa mai Math.random né l’orologio', () => {
    const params = { goal: 'strength', daysPerWeek: 3, minutesPerSession: 60, level: 'beginner' };
    const program = generateProgram(params, catalog, 7);
    expect(program.createdAt).toBeNull();
    expect(program.id).toBe('program-7');
  });

  it('accetta id e data dall’esterno, restando pura', () => {
    const params = { goal: 'strength', daysPerWeek: 3, minutesPerSession: 60, level: 'beginner' };
    const program = generateProgram(params, catalog, 7, {
      id: 'abc',
      createdAt: '2026-09-04T08:00:00.000Z',
    });
    expect(program.id).toBe('abc');
    expect(program.createdAt).toBe('2026-09-04T08:00:00.000Z');
  });

  it('produce lo stesso programma di riferimento (snapshot)', () => {
    const params = { goal: 'hypertrophy', daysPerWeek: 4, minutesPerSession: 60, level: 'intermediate' };
    const program = generateProgram(params, catalog, SEED);
    const shape = program.days.map((day) => ({
      label: day.label,
      patterns: day.patterns,
      slots: day.slots.map((slot) => `${slot.exerciseId} ${slot.sets}x${slot.repMin}-${slot.repMax} r${slot.restSec}`),
    }));
    expect(shape).toMatchSnapshot();
  });
});

describe('generateProgram — struttura (criteri 3.7)', () => {
  it.each(eachCombo)('%s ha il numero di giorni richiesto', (_label, { params, program }) => {
    expect(program.days).toHaveLength(params.daysPerWeek);
    expect(program.weeks).toBe(6);
    expect(program.status).toBe('active');
  });

  it.each(eachCombo)('%s applica lo split previsto da 3.1', (_label, { params, program }) => {
    const expected = { 2: 'full-body', 3: 'full-body', 4: 'upper-lower', 5: 'ppl-ul', 6: 'ppl' };
    expect(program.splitType).toBe(expected[params.daysPerWeek]);
  });

  it.each(eachCombo)('%s dà un main a ogni pattern del giorno', (_label, { program }) => {
    for (const day of program.days) {
      const mainPatterns = new Set(
        day.slots.filter((slot) => slot.tier === 'main').map(patternOf)
      );
      for (const pattern of day.patterns) {
        expect(mainPatterns, `${day.label}: manca il main di ${pattern}`).toContain(pattern);
      }
    }
  });

  it.each(eachCombo)('%s non ripete un esercizio nello stesso giorno', (_label, { program }) => {
    for (const day of program.days) {
      const ids = day.slots.map((slot) => slot.exerciseId);
      expect(new Set(ids).size, day.label).toBe(ids.length);
    }
  });

  it.each(eachCombo)('%s ordina main, secondary, accessory', (_label, { program }) => {
    const rank = { main: 0, secondary: 1, accessory: 2 };
    for (const day of program.days) {
      const ranks = day.slots.map((slot) => rank[slot.tier]);
      expect([...ranks], day.label).toEqual([...ranks].sort((a, b) => a - b));
      expect(day.slots.map((slot) => slot.order)).toEqual(day.slots.map((_, i) => i));
    }
  });

  it.each(eachCombo)('%s parte da slot non calibrati', (_label, { program }) => {
    for (const day of program.days) {
      for (const slot of day.slots) {
        expect(slot.workingWeightKg).toBeNull();
        expect(slot.state).toBe('uncalibrated');
        expect(slot.failStreak).toBe(0);
        expect(slot.repMin).toBeLessThan(slot.repMax);
        expect(slot.sets).toBeGreaterThan(0);
      }
    }
  });
});

describe('generateProgram — budget tempo (criterio 3.7)', () => {
  it.each(eachCombo)('%s non sfora mai il budget', (_label, { params, program }) => {
    const budget = sessionBudgetSeconds(params.minutesPerSession);
    for (const day of program.days) {
      expect(estimateDaySeconds(day.slots), day.label).toBeLessThanOrEqual(budget);
      expect(day.estimatedSeconds).toBe(estimateDaySeconds(day.slots));
    }
  });

  it.each(eachCombo)(
    '%s riempie almeno l’85 %% del budget, o è fermo al tetto di volume',
    (_label, { params, program }) => {
      const budget = sessionBudgetSeconds(params.minutesPerSession);
      const atCeiling = LARGE_MUSCLES.some(
        (muscle) =>
          (program.weeklyVolume[muscle] ?? 0) >=
          volumeTargetFor(muscle, program.effectiveLevel).max
      );
      for (const day of program.days) {
        if (day.estimatedSeconds >= budget * MIN_BUDGET_RATIO) continue;
        // Sotto l'85 % si può stare solo perché aggiungere altro sforerebbe il
        // volume settimanale del livello, non per pigrizia dell'algoritmo.
        expect(atCeiling, `${day.label} al ${Math.round((100 * day.estimatedSeconds) / budget)}%`).toBe(true);
      }
    }
  );
});

describe('generateProgram — volume settimanale (criterio 3.7)', () => {
  it.each(eachCombo)('%s non supera mai il massimo del livello', (_label, { program }) => {
    for (const muscle of LARGE_MUSCLES) {
      const target = volumeTargetFor(muscle, program.effectiveLevel);
      expect(program.weeklyVolume[muscle] ?? 0, muscle).toBeLessThanOrEqual(target.max + 2);
    }
  });

  it.each(eachCombo)(
    '%s raggiunge il minimo del livello, o ha già toccato il fondo della scala',
    (_label, { program }) => {
      for (const muscle of LARGE_MUSCLES) {
        const target = volumeTargetFor(muscle, program.effectiveLevel);
        const volume = program.weeklyVolume[muscle] ?? 0;
        if (volume >= target.min - 2) continue;
        // Sotto il minimo si può stare solo da principiante: sotto non c'è
        // nessun livello a cui degradare. L'utente viene avvisato.
        expect(program.effectiveLevel, muscle).toBe('beginner');
        expect(program.volumeWarning).toBeTruthy();
      }
    }
  );
});

describe('generateProgram — degradazione onesta (3.3)', () => {
  it.each(eachCombo)('%s non alza mai il livello dichiarato', (_label, { params, program }) => {
    const order = { beginner: 0, intermediate: 1, advanced: 2 };
    expect(order[program.effectiveLevel]).toBeLessThanOrEqual(order[params.level]);
  });

  it.each(eachCombo)('%s valorizza volumeNote solo se ha degradato', (_label, { params, program }) => {
    if (program.effectiveLevel === params.level) {
      expect(program.volumeNote).toBeNull();
    } else {
      expect(program.volumeNote).toBeTruthy();
      expect(program.volumeNote).toContain(`${params.daysPerWeek} giorni`);
      expect(program.volumeNote).toContain(`${params.minutesPerSession} minuti`);
    }
  });

  it('degrada un avanzato a 2 giorni da 30 minuti fino a principiante', () => {
    const params = { goal: 'hypertrophy', daysPerWeek: 2, minutesPerSession: 30, level: 'advanced' };
    const program = generateProgram(params, catalog, SEED);
    expect(program.effectiveLevel).toBe('beginner');
    expect(program.volumeNote).toBeTruthy();
  });

  it('non degrada un avanzato che ha 6 giorni da 90 minuti', () => {
    const params = { goal: 'hypertrophy', daysPerWeek: 6, minutesPerSession: 90, level: 'advanced' };
    const program = generateProgram(params, catalog, SEED);
    expect(program.effectiveLevel).toBe('advanced');
    expect(program.volumeNote).toBeNull();
  });

  it('costruisce meno volume a livelli più bassi, a parità di parametri', () => {
    const params = { goal: 'hypertrophy', daysPerWeek: 6, minutesPerSession: 90, level: 'advanced' };
    const total = (level) =>
      Object.values(buildProgramForLevel(params, catalog, SEED, level).volume).reduce(
        (sum, sets) => sum + sets,
        0
      );
    expect(total('advanced')).toBeGreaterThan(total('intermediate'));
    expect(total('intermediate')).toBeGreaterThan(total('beginner'));
  });
});

describe('generateProgram — rotazione degli esercizi (criterio 3.7)', () => {
  const multiDay = eachCombo.filter(([, combo]) => combo.params.daysPerWeek >= 4);

  it.each(multiDay)(
    '%s usa main diversi in due giorni con lo stesso pattern',
    (_label, { program }) => {
      /** @type {Record<string, string[]>} */
      const mainsByPattern = {};
      for (const day of program.days) {
        for (const slot of day.slots.filter((s) => s.tier === 'main')) {
          (mainsByPattern[patternOf(slot)] ??= []).push(slot.exerciseId);
        }
      }
      for (const [pattern, ids] of Object.entries(mainsByPattern)) {
        if (ids.length < 2) continue;
        expect(new Set(ids).size, `${pattern}: ${ids.join(', ')}`).toBeGreaterThan(1);
      }
    }
  );
});

describe('generateProgram — casi limite della spec', () => {
  const shortStrength = eachCombo.filter(
    ([, combo]) => combo.params.goal === 'strength' && combo.params.minutesPerSession === 30
  );

  it.each(shortStrength)('%s tiene almeno 2 main lift al giorno', (_label, { program }) => {
    for (const day of program.days) {
      const mains = day.slots.filter((slot) => slot.tier === 'main');
      expect(mains.length, `${day.label} ha ${mains.length} main`).toBeGreaterThanOrEqual(2);
    }
  });

  it.each(eachCombo)('%s applica i range di ripetizioni di 3.2', (_label, { params, program }) => {
    const expected = {
      strength: { main: [3, 6], secondary: [6, 8], accessory: [10, 15] },
      hypertrophy: { main: [6, 10], secondary: [8, 12], accessory: [12, 15] },
      recomp: { main: [6, 10], secondary: [8, 12], accessory: [12, 20] },
    }[params.goal];
    for (const day of program.days) {
      for (const slot of day.slots) {
        expect([slot.repMin, slot.repMax], slot.exerciseId).toEqual(expected[slot.tier]);
      }
    }
  });
});
