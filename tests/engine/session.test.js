// Tempra v0.5.0 — 2026-09-04 12:10
//
// Logica della sessione: RIR, serie di avvicinamento, riga "ultima volta",
// riepilogo. Spec 7.1 e criteri 7.3.

import { describe, expect, it } from 'vitest';
import catalog from '../../src/data/exercises.json' with { type: 'json' };
import {
  NUMERIC_RIR,
  RIR_FROM_INPUT,
  buildRows,
  defaultStartWeight,
  lastTimeFor,
  minimumLoad,
  roundToIncrement,
  sessionSummary,
  slotStatus,
  usesThreeButtonRir,
  warmupWeights,
} from '../../src/engine/session.js';

const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]));
const squat = byId.get('barbell-back-squat'); // bilanciere, incremento 5
const curl = byId.get('barbell-curl'); // bilanciere, incremento 1,25
const lateral = byId.get('dumbbell-lateral-raise'); // manubri, incremento 1,25

/** @param {object} overrides */
const slotOf = (overrides = {}) => ({
  id: 'slot-1',
  exerciseId: squat.id,
  tier: 'main',
  sets: 3,
  repMin: 6,
  repMax: 10,
  restSec: 150,
  workingWeightKg: 100,
  state: 'calibrated',
  failStreak: 0,
  ...overrides,
});

describe('RIR', () => {
  it('mappa i tre pulsanti del principiante su 3, 2, 1 (criterio 4.7)', () => {
    expect(RIR_FROM_INPUT.easy).toBe(3);
    expect(RIR_FROM_INPUT.right).toBe(2);
    expect(RIR_FROM_INPUT.limit).toBe(1);
  });

  it('dà tre pulsanti al principiante e cinque agli altri (criterio 7.3)', () => {
    expect(usesThreeButtonRir('beginner')).toBe(true);
    expect(usesThreeButtonRir('intermediate')).toBe(false);
    expect(usesThreeButtonRir('advanced')).toBe(false);
    expect(Object.keys(RIR_FROM_INPUT)).toHaveLength(3);
    expect(NUMERIC_RIR).toHaveLength(5);
  });
});

describe('roundToIncrement', () => {
  it('arrotonda all’incremento dell’esercizio', () => {
    expect(roundToIncrement(51, 2.5)).toBe(50);
    expect(roundToIncrement(51.5, 2.5)).toBe(52.5);
    expect(roundToIncrement(46.875, 1.25)).toBe(47.5);
  });

  it('non scende sotto il minimo caricabile', () => {
    expect(roundToIncrement(5, 2.5, 20)).toBe(20);
  });

  it('non produce code decimali', () => {
    expect(roundToIncrement(62.5 * 0.5, 1.25)).toBe(31.25);
  });
});

describe('minimumLoad e defaultStartWeight', () => {
  it('un bilanciere scarico pesa già 20 kg', () => {
    expect(minimumLoad(squat)).toBe(20);
    expect(minimumLoad(lateral)).toBe(0);
  });

  it('propone un punto di partenza, non una stima di massimale', () => {
    expect(defaultStartWeight(squat)).toBe(20);
    expect(defaultStartWeight(lateral)).toBe(5);
  });
});

describe('warmupWeights', () => {
  it('propone 50 % e 75 % del carico di lavoro per i main', () => {
    expect(warmupWeights(slotOf({ workingWeightKg: 100 }), squat)).toEqual([50, 75]);
  });

  it('arrotonda all’incremento dell’esercizio', () => {
    expect(warmupWeights(slotOf({ workingWeightKg: 62.5 }), curl)).toEqual([31.25, 47.5]);
  });

  it('non ne propone per secondary e accessory (spec 7.1)', () => {
    expect(warmupWeights(slotOf({ tier: 'secondary' }), squat)).toEqual([]);
    expect(warmupWeights(slotOf({ tier: 'accessory' }), squat)).toEqual([]);
  });

  it('non ne propone se il carico non è ancora calibrato', () => {
    expect(warmupWeights(slotOf({ workingWeightKg: null }), squat)).toEqual([]);
  });

  it('non propone avvicinamenti pari o superiori al carico di lavoro', () => {
    // Con un bilanciere scarico il 50 % e il 75 % coinciderebbero con il lavoro.
    expect(warmupWeights(slotOf({ workingWeightKg: 20 }), squat)).toEqual([]);
  });

  it('non ripete lo stesso peso due volte', () => {
    const weights = warmupWeights(slotOf({ workingWeightKg: 25 }), squat);
    expect(new Set(weights).size).toBe(weights.length);
  });
});

describe('buildRows', () => {
  it('mette prima l’avvicinamento, poi le serie di lavoro', () => {
    const rows = buildRows(slotOf(), squat);
    expect(rows).toHaveLength(5); // 2 avvicinamenti + 3 di lavoro
    expect(rows.slice(0, 2).every((row) => row.isWarmup)).toBe(true);
    expect(rows.slice(2).every((row) => !row.isWarmup)).toBe(true);
  });

  it('propone il carico di lavoro su ogni serie di lavoro', () => {
    const rows = buildRows(slotOf({ workingWeightKg: 80 }), squat);
    for (const row of rows.filter((r) => !r.isWarmup)) {
      expect(row.suggestedWeightKg).toBe(80);
    }
  });

  it('su uno slot non calibrato parte dal peso di default', () => {
    const rows = buildRows(slotOf({ workingWeightKg: null }), squat);
    expect(rows).toHaveLength(3);
    expect(rows[0].suggestedWeightKg).toBe(20);
  });

  it('dà una chiave univoca a ogni riga', () => {
    const keys = buildRows(slotOf(), squat).map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('lastTimeFor', () => {
  const log = (slotId, reps, isWarmup = false) => ({
    slotId,
    exerciseId: squat.id,
    setIndex: 0,
    weightKg: 80,
    reps,
    rir: 2,
    rirInput: 'numeric',
    isWarmup,
    completedAt: '2026-09-01T08:00:00.000Z',
  });

  const sessionOf = (id, startedAt, sets, status = 'completed') => ({
    id,
    programId: 'p',
    dayIndex: 0,
    weekIndex: 0,
    startedAt,
    endedAt: null,
    status,
    sets,
  });

  it('senza precedenti non restituisce nulla', () => {
    expect(lastTimeFor('slot-1', [])).toEqual([]);
  });

  it('prende la seduta precedente **dello stesso slot**, non l’ultima in assoluto', () => {
    const sessions = [
      sessionOf('a', '2026-09-01T08:00:00.000Z', [log('slot-1', 8)]),
      sessionOf('b', '2026-09-03T08:00:00.000Z', [log('slot-2', 12)]),
    ];
    const result = lastTimeFor('slot-1', sessions);
    expect(result).toHaveLength(1);
    expect(result[0].reps).toBe(8);
  });

  it('preferisce la più recente fra quelle che contengono lo slot', () => {
    const sessions = [
      sessionOf('a', '2026-09-01T08:00:00.000Z', [log('slot-1', 8)]),
      sessionOf('b', '2026-09-05T08:00:00.000Z', [log('slot-1', 10)]),
    ];
    expect(lastTimeFor('slot-1', sessions)[0].reps).toBe(10);
  });

  it('ignora la seduta in corso', () => {
    const sessions = [
      sessionOf('a', '2026-09-01T08:00:00.000Z', [log('slot-1', 8)]),
      sessionOf('corrente', '2026-09-05T08:00:00.000Z', [log('slot-1', 99)]),
    ];
    expect(lastTimeFor('slot-1', sessions, 'corrente')[0].reps).toBe(8);
  });

  it('ignora le sedute non completate', () => {
    const sessions = [
      sessionOf('a', '2026-09-01T08:00:00.000Z', [log('slot-1', 8)]),
      sessionOf('b', '2026-09-05T08:00:00.000Z', [log('slot-1', 99)], 'abandoned'),
    ];
    expect(lastTimeFor('slot-1', sessions)[0].reps).toBe(8);
  });

  it('esclude le serie di avvicinamento', () => {
    const sessions = [
      sessionOf('a', '2026-09-01T08:00:00.000Z', [log('slot-1', 5, true), log('slot-1', 8)]),
    ];
    const result = lastTimeFor('slot-1', sessions);
    expect(result).toHaveLength(1);
    expect(result[0].reps).toBe(8);
  });
});

describe('sessionSummary', () => {
  const log = (weightKg, reps, isWarmup = false) => ({
    slotId: 'slot-1',
    exerciseId: squat.id,
    setIndex: 0,
    weightKg,
    reps,
    rir: 2,
    rirInput: 'numeric',
    isWarmup,
    completedAt: '2026-09-04T08:00:00.000Z',
  });

  it('conta le serie di lavoro e il tonnellaggio', () => {
    const summary = sessionSummary({
      startedAt: '2026-09-04T08:00:00.000Z',
      endedAt: '2026-09-04T09:05:00.000Z',
      sets: [log(60, 5, true), log(100, 8), log(100, 7)],
    });
    expect(summary.workSets).toBe(2);
    expect(summary.warmupSets).toBe(1);
    expect(summary.tonnageKg).toBe(1500); // 100×8 + 100×7
    expect(summary.durationMin).toBe(65);
  });

  it('non calcola la durata di una seduta non chiusa', () => {
    const summary = sessionSummary({
      startedAt: '2026-09-04T08:00:00.000Z',
      endedAt: null,
      sets: [],
    });
    expect(summary.durationMin).toBeNull();
    expect(summary.tonnageKg).toBe(0);
  });

  it('esclude l’avvicinamento dal tonnellaggio', () => {
    const summary = sessionSummary({ startedAt: null, endedAt: null, sets: [log(60, 10, true)] });
    expect(summary.tonnageKg).toBe(0);
  });
});

describe('slotStatus', () => {
  const slot = slotOf({ sets: 3 });
  const log = (isWarmup = false) => ({ slotId: slot.id, isWarmup });

  it('è da fare senza serie di lavoro', () => {
    expect(slotStatus(slot, [])).toBe('todo');
    expect(slotStatus(slot, [log(true), log(true)])).toBe('todo');
  });

  it('è in corso a metà', () => {
    expect(slotStatus(slot, [log(), log()])).toBe('doing');
  });

  it('è fatto quando le serie previste sono chiuse', () => {
    expect(slotStatus(slot, [log(), log(), log()])).toBe('done');
    expect(slotStatus(slot, [log(), log(), log(), log()])).toBe('done');
  });
});
