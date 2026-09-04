// Tempra v0.6.0 — 2026-09-04 13:00
//
// Carico stimato per i grafici (spec 4.6). Non prescrive niente.

import { describe, expect, it } from 'vitest';
import { bestSetOfSession, e1rm, e1rmHistory } from '../../src/engine/e1rm.js';

const log = (weightKg, reps, isWarmup = false, exerciseId = 'squat') => ({
  exerciseId,
  weightKg,
  reps,
  isWarmup,
});

describe('e1rm', () => {
  it('applica la formula di Epley', () => {
    expect(e1rm(100, 1)).toBeCloseTo(103.3, 1);
    expect(e1rm(100, 10)).toBeCloseTo(133.3, 1);
    expect(e1rm(60, 5)).toBeCloseTo(70, 1);
  });

  it('cresce con il peso e con le ripetizioni', () => {
    expect(e1rm(110, 5)).toBeGreaterThan(e1rm(100, 5));
    expect(e1rm(100, 8)).toBeGreaterThan(e1rm(100, 5));
  });

  it('vale zero su valori non sensati', () => {
    expect(e1rm(0, 5)).toBe(0);
    expect(e1rm(100, 0)).toBe(0);
    expect(e1rm(-10, 5)).toBe(0);
  });
});

describe('bestSetOfSession', () => {
  it('prende la serie con e1RM più alto', () => {
    const session = { sets: [log(100, 5), log(90, 10), log(110, 3)] };
    const best = bestSetOfSession(session, 'squat');
    // 90×10 → 120; 100×5 → 116,7; 110×3 → 121
    expect(best.weightKg).toBe(110);
    expect(best.reps).toBe(3);
  });

  it('ignora le serie di avvicinamento', () => {
    const session = { sets: [log(200, 10, true), log(100, 5)] };
    expect(bestSetOfSession(session, 'squat').weightKg).toBe(100);
  });

  it('ignora gli altri esercizi', () => {
    const session = { sets: [log(200, 10, false, 'bench'), log(100, 5)] };
    expect(bestSetOfSession(session, 'squat').weightKg).toBe(100);
  });

  it('restituisce null se l’esercizio non compare', () => {
    expect(bestSetOfSession({ sets: [] }, 'squat')).toBeNull();
  });
});

describe('e1rmHistory', () => {
  const sessionOf = (id, startedAt, sets, status = 'completed') => ({
    id,
    startedAt,
    status,
    sets,
  });

  it('restituisce una voce per sessione, dalla più vecchia', () => {
    const history = e1rmHistory(
      [
        sessionOf('b', '2026-09-10T08:00:00.000Z', [log(105, 5)]),
        sessionOf('a', '2026-09-03T08:00:00.000Z', [log(100, 5)]),
      ],
      'squat'
    );
    expect(history).toHaveLength(2);
    expect(history[0].weightKg).toBe(100);
    expect(history[1].weightKg).toBe(105);
    expect(history[1].e1rm).toBeGreaterThan(history[0].e1rm);
  });

  it('salta le sessioni senza quell’esercizio e quelle non completate', () => {
    const history = e1rmHistory(
      [
        sessionOf('a', '2026-09-03T08:00:00.000Z', [log(100, 5)]),
        sessionOf('b', '2026-09-05T08:00:00.000Z', [log(100, 5, false, 'bench')]),
        sessionOf('c', '2026-09-07T08:00:00.000Z', [log(120, 5)], 'in-progress'),
      ],
      'squat'
    );
    expect(history).toHaveLength(1);
  });
});
