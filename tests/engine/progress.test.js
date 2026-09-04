// Tempra v0.6.0 — 2026-09-04 13:00
//
// Motore di progressione. Criteri 4.7, con sessioni sintetiche.

import { describe, expect, it } from 'vitest';
import catalog from '../../src/data/exercises.json' with { type: 'json' };
import {
  applySession,
  makeSubstitutionPermanent,
} from '../../src/engine/progress.js';
import { getWeekPlan } from '../../src/engine/week.js';
import { RIR_FROM_INPUT } from '../../src/engine/session.js';

const squat = catalog.find((e) => e.id === 'barbell-back-squat'); // incremento 5
const bench = catalog.find((e) => e.id === 'barbell-bench-press'); // incremento 2,5
const curl = catalog.find((e) => e.id === 'barbell-curl'); // incremento 1,25

/** Programma minimo: un giorno, uno o più slot. */
function programOf(slots, extra = {}) {
  return {
    id: 'p1',
    createdAt: '2026-09-01T08:00:00.000Z',
    status: 'active',
    params: { goal: 'hypertrophy', daysPerWeek: 2, minutesPerSession: 60, level: 'intermediate' },
    splitType: 'full-body',
    effectiveLevel: 'intermediate',
    volumeNote: null,
    volumeWarning: null,
    weeks: 6,
    deloadAtWeek: null,
    days: [
      { index: 0, label: 'Full body A', patterns: ['squat'], slots, estimatedSeconds: 1000 },
      { index: 1, label: 'Full body B', patterns: ['h-push'], slots: [], estimatedSeconds: 0 },
    ],
    weeklyVolume: {},
    ...extra,
  };
}

function slotOf(overrides = {}) {
  return {
    id: 'slot-1',
    exerciseId: squat.id,
    tier: 'main',
    order: 0,
    sets: 3,
    repMin: 6,
    repMax: 10,
    restSec: 150,
    workingWeightKg: 100,
    state: 'calibrated',
    failStreak: 0,
    ...overrides,
  };
}

/** Una seduta con `n` serie identiche. */
function sessionOf({
  reps,
  rir,
  weightKg = 100,
  sets = 3,
  slotId = 'slot-1',
  exerciseId = squat.id,
  weekIndex = 1,
  dayIndex = 0,
  startedAt = '2026-09-10T08:00:00.000Z',
  feedback = null,
  substitutions = {},
  reducedToMinutes = null,
  id = 's1',
} = {}) {
  return {
    id,
    programId: 'p1',
    dayIndex,
    weekIndex,
    startedAt,
    endedAt: startedAt,
    status: 'completed',
    reducedToMinutes,
    substitutions,
    feedback,
    sets: Array.from({ length: sets }, (_, index) => ({
      slotId,
      exerciseId,
      setIndex: index,
      weightKg,
      reps: Array.isArray(reps) ? reps[index] : reps,
      rir: Array.isArray(rir) ? rir[index] : rir,
      rirInput: 'numeric',
      isWarmup: false,
      completedAt: startedAt,
    })),
  };
}

const firstSlot = (result) => result.program.days[0].slots[0];

// ---- 4.1 Calibrazione ------------------------------------------------------

describe('4.1 calibrazione', () => {
  const uncalibrated = slotOf({ state: 'uncalibrated', workingWeightKg: null });

  it('conferma il peso quando le serie stanno nel range', () => {
    const result = applySession(
      programOf([uncalibrated]),
      sessionOf({ reps: 8, rir: 3, weightKg: 80 }),
      [],
      catalog
    );
    expect(firstSlot(result).workingWeightKg).toBe(80);
    expect(firstSlot(result).state).toBe('calibrated');
    expect(result.notes).toHaveLength(1);
  });

  it('caso limite: RIR medio esattamente 2 conferma il peso', () => {
    const result = applySession(
      programOf([uncalibrated]),
      sessionOf({ reps: 8, rir: 2, weightKg: 80 }),
      [],
      catalog
    );
    expect(firstSlot(result).workingWeightKg).toBe(80);
  });

  it('caso limite: ripetizioni esattamente al minimo confermano il peso', () => {
    const result = applySession(
      programOf([uncalibrated]),
      sessionOf({ reps: 6, rir: 2, weightKg: 80 }),
      [],
      catalog
    );
    expect(firstSlot(result).workingWeightKg).toBe(80);
  });

  it('scende del 10 % se le ripetizioni non ci sono', () => {
    const result = applySession(
      programOf([uncalibrated]),
      sessionOf({ reps: [8, 8, 4], rir: 1, weightKg: 100 }),
      [],
      catalog
    );
    expect(firstSlot(result).workingWeightKg).toBe(90);
  });

  it('scende del 10 % se il RIR medio è sotto 1', () => {
    const result = applySession(
      programOf([uncalibrated]),
      sessionOf({ reps: 8, rir: 0, weightKg: 100 }),
      [],
      catalog
    );
    expect(firstSlot(result).workingWeightKg).toBe(90);
  });

  it('sale di due incrementi se è stato troppo facile', () => {
    const result = applySession(
      programOf([uncalibrated]),
      sessionOf({ reps: 12, rir: 4, weightKg: 80 }),
      [],
      catalog
    );
    // squat: incremento 5 kg
    expect(firstSlot(result).workingWeightKg).toBe(90);
  });

  it('non stima nessun massimale: usa solo il peso davvero usato', () => {
    const result = applySession(
      programOf([uncalibrated]),
      sessionOf({ reps: 8, rir: 2, weightKg: 62.5, exerciseId: bench.id }),
      [],
      catalog
    );
    expect(firstSlot(result).workingWeightKg).toBe(62.5);
  });
});

// ---- 4.2 Doppia progressione -----------------------------------------------

describe('4.2 doppia progressione', () => {
  it('caso A: tutte le serie al massimo del range fanno salire il peso', () => {
    const result = applySession(
      programOf([slotOf()]),
      sessionOf({ reps: 10, rir: 2, weekIndex: 1 }),
      [],
      catalog
    );
    expect(firstSlot(result).workingWeightKg).toBe(105);
    expect(firstSlot(result).failStreak).toBe(0);
    expect(result.notes[0]).toContain('105');
  });

  it('caso B: dentro il range ma non in cima, peso invariato', () => {
    const result = applySession(
      programOf([slotOf()]),
      sessionOf({ reps: [8, 8, 7], rir: 2 }),
      [],
      catalog
    );
    expect(firstSlot(result).workingWeightKg).toBe(100);
    expect(firstSlot(result).failStreak).toBe(0);
    expect(result.notes[0]).toContain('ripetizione in più');
  });

  it('caso C: una serie sotto il range alza il contatore, senza toccare il peso', () => {
    const result = applySession(
      programOf([slotOf()]),
      sessionOf({ reps: [8, 7, 4], rir: 1 }),
      [],
      catalog
    );
    expect(firstSlot(result).workingWeightKg).toBe(100);
    expect(firstSlot(result).failStreak).toBe(1);
  });

  it('caso C due volte: −10 % e contatore azzerato', () => {
    const first = applySession(
      programOf([slotOf()]),
      sessionOf({ reps: [8, 7, 4], rir: 1 }),
      [],
      catalog
    );
    const second = applySession(
      first.program,
      sessionOf({ reps: [8, 7, 4], rir: 1, id: 's2' }),
      [],
      catalog
    );
    expect(firstSlot(second).workingWeightKg).toBe(90);
    expect(firstSlot(second).failStreak).toBe(0);
  });

  it('il terzo caso C dopo il reset riparte da failStreak 1', () => {
    let program = programOf([slotOf()]);
    for (const id of ['s1', 's2', 's3']) {
      program = applySession(program, sessionOf({ reps: [8, 7, 4], rir: 1, id }), [], catalog)
        .program;
    }
    expect(program.days[0].slots[0].failStreak).toBe(1);
    expect(program.days[0].slots[0].workingWeightKg).toBe(90);
  });

  it('regola di sicurezza: RIR medio a targetRIR − 2 non fa salire il peso', () => {
    // Settimana 2 (indice 1) → RIR target 2, quindi RIR medio 0.
    const result = applySession(
      programOf([slotOf()]),
      sessionOf({ reps: 10, rir: 0, weekIndex: 1 }),
      [],
      catalog
    );
    expect(firstSlot(result).workingWeightKg).toBe(100);
    expect(result.notes[0]).toContain('molto dure');
  });

  it('arrotonda il −10 % all’incremento: 62,5 con incremento 2,5 → 57,5', () => {
    let program = programOf([slotOf({ exerciseId: bench.id, workingWeightKg: 62.5 })]);
    for (const id of ['s1', 's2']) {
      program = applySession(
        program,
        sessionOf({ reps: [8, 7, 4], rir: 1, exerciseId: bench.id, id }),
        [],
        catalog
      ).program;
    }
    expect(program.days[0].slots[0].workingWeightKg).toBe(57.5);
  });

  it('non scende sotto il bilanciere scarico', () => {
    let program = programOf([slotOf({ exerciseId: curl.id, workingWeightKg: 20 })]);
    for (const id of ['s1', 's2', 's3', 's4']) {
      program = applySession(
        program,
        sessionOf({ reps: [4, 4, 4], rir: 0, exerciseId: curl.id, id }),
        [],
        catalog
      ).program;
    }
    expect(program.days[0].slots[0].workingWeightKg).toBeGreaterThanOrEqual(20);
  });

  it('in settimana di scarico non progredisce', () => {
    const result = applySession(
      programOf([slotOf()]),
      sessionOf({ reps: 10, rir: 4, weekIndex: 5 }),
      [],
      catalog
    );
    expect(firstSlot(result).workingWeightKg).toBe(100);
  });

  it('lavora solo su `rir`, comunque sia stato inserito', () => {
    const session = sessionOf({ reps: 10, rir: RIR_FROM_INPUT.easy });
    session.sets = session.sets.map((log) => ({ ...log, rirInput: 'easy' }));
    const result = applySession(programOf([slotOf()]), session, [], catalog);
    expect(firstSlot(result).workingWeightKg).toBe(105);
  });
});

// ---- 4.3 Autoregolazione ---------------------------------------------------

describe('4.3 autoregolazione dal feedback', () => {
  const base = () => programOf([slotOf(), slotOf({ id: 'slot-2', tier: 'accessory', sets: 3 })]);

  it('dura + poca energia: una serie in meno sugli accessori la volta dopo', () => {
    const result = applySession(
      base(),
      sessionOf({ reps: 8, rir: 2, feedback: { difficulty: 'hard', energy: 'low', soreness: 'none' } }),
      [],
      catalog
    );
    expect(result.program.pendingAdjustments[0]).toEqual({ accessorySetDelta: -1 });
    expect(result.notes.some((note) => note.includes('serie in meno'))).toBe(true);
  });

  it('molto indolenzito + dura: stesso effetto', () => {
    const result = applySession(
      base(),
      sessionOf({
        reps: 8,
        rir: 2,
        feedback: { difficulty: 'hard', energy: 'normal', soreness: 'a-lot' },
      }),
      [],
      catalog
    );
    expect(result.program.pendingAdjustments[0]).toEqual({ accessorySetDelta: -1 });
  });

  it('due sedute dure di fila anticipano lo scarico', () => {
    const previous = sessionOf({
      reps: 8,
      rir: 2,
      id: 's0',
      startedAt: '2026-09-08T08:00:00.000Z',
      feedback: { difficulty: 'hard', energy: 'normal', soreness: 'none' },
    });
    const result = applySession(
      base(),
      sessionOf({
        reps: 8,
        rir: 2,
        weekIndex: 2,
        feedback: { difficulty: 'hard', energy: 'normal', soreness: 'none' },
      }),
      [previous],
      catalog
    );
    expect(result.program.deloadAtWeek).toBe(2);
  });

  it('lo scarico anticipato dà RIR 4 e metà serie (criterio 4.7)', () => {
    const previous = sessionOf({
      reps: 8,
      rir: 2,
      id: 's0',
      startedAt: '2026-09-08T08:00:00.000Z',
      feedback: { difficulty: 'hard', energy: 'normal', soreness: 'none' },
    });
    const { program } = applySession(
      base(),
      sessionOf({
        reps: 8,
        rir: 2,
        weekIndex: 2,
        feedback: { difficulty: 'hard', energy: 'normal', soreness: 'none' },
      }),
      [previous],
      catalog
    );

    const plan = getWeekPlan(program, 2);
    expect(plan.targetRIR).toBe(4);
    expect(plan.isDeload).toBe(true);
    for (const [index, slot] of plan.days[0].slots.entries()) {
      const base = program.days[0].slots[index].sets;
      expect(slot.sets).toBe(Math.max(1, Math.ceil(base / 2)));
    }
  });

  it('due sedute facili dello stesso giorno aggiungono una serie ai complementari', () => {
    const program = programOf([
      slotOf(),
      slotOf({ id: 'slot-2', tier: 'secondary', exerciseId: curl.id, sets: 3 }),
    ]);
    const easy = { difficulty: 'easy', energy: 'high', soreness: 'none' };
    const previous = sessionOf({
      reps: 8,
      rir: 3,
      id: 's0',
      startedAt: '2026-09-08T08:00:00.000Z',
      feedback: easy,
    });
    const result = applySession(
      program,
      sessionOf({ reps: 8, rir: 3, feedback: easy }),
      [previous],
      catalog
    );
    expect(result.program.days[0].slots[1].sets).toBe(4);
  });

  it('da principiante non aggiunge serie', () => {
    const program = programOf(
      [slotOf(), slotOf({ id: 'slot-2', tier: 'secondary', exerciseId: curl.id, sets: 3 })],
      { params: { goal: 'hypertrophy', daysPerWeek: 2, minutesPerSession: 60, level: 'beginner' } }
    );
    const easy = { difficulty: 'easy', energy: 'high', soreness: 'none' };
    const previous = sessionOf({ reps: 8, rir: 3, id: 's0', startedAt: '2026-09-08T08:00:00.000Z', feedback: easy });
    const result = applySession(program, sessionOf({ reps: 8, rir: 3, feedback: easy }), [previous], catalog);
    expect(result.program.days[0].slots[1].sets).toBe(3);
  });

  it('con il volume già al massimo non aggiunge nulla e lo dice', () => {
    // Un complementare con volume già oltre il massimo del livello.
    const program = programOf([
      slotOf(),
      slotOf({ id: 'slot-2', tier: 'secondary', exerciseId: curl.id, sets: 16 }),
    ]);
    const easy = { difficulty: 'easy', energy: 'high', soreness: 'none' };
    const previous = sessionOf({ reps: 8, rir: 3, id: 's0', startedAt: '2026-09-08T08:00:00.000Z', feedback: easy });
    const result = applySession(program, sessionOf({ reps: 8, rir: 3, feedback: easy }), [previous], catalog);

    expect(result.program.days[0].slots[1].sets).toBe(16);
    expect(result.notes.some((note) => note.includes('già al massimo'))).toBe(true);
  });

  it('ripetuto molte volte, il volume non supera mai il massimo', () => {
    let program = programOf([
      slotOf(),
      slotOf({ id: 'slot-2', tier: 'secondary', exerciseId: curl.id, sets: 3 }),
    ]);
    const easy = { difficulty: 'easy', energy: 'high', soreness: 'none' };
    for (let round = 0; round < 12; round += 1) {
      const previous = sessionOf({
        reps: 8,
        rir: 3,
        id: `prev-${round}`,
        startedAt: '2026-09-08T08:00:00.000Z',
        feedback: easy,
      });
      program = applySession(
        program,
        sessionOf({ reps: 8, rir: 3, id: `s-${round}`, feedback: easy }),
        [previous],
        catalog
      ).program;
    }
    // Il curl ha bicipiti primari: gruppo piccolo, massimo dimezzato a 8.
    expect(program.days[0].slots[1].sets).toBeLessThanOrEqual(8);
  });

  it('una seduta ridotta non attiva nessuna regola di feedback', () => {
    const result = applySession(
      base(),
      sessionOf({
        reps: 8,
        rir: 2,
        reducedToMinutes: 30,
        feedback: { difficulty: 'hard', energy: 'low', soreness: 'a-lot' },
      }),
      [],
      catalog
    );
    expect(result.program.pendingAdjustments).toBeUndefined();
  });

  it('feedback neutro: nessun effetto', () => {
    const result = applySession(
      base(),
      sessionOf({
        reps: 8,
        rir: 2,
        feedback: { difficulty: 'right', energy: 'normal', soreness: 'some' },
      }),
      [],
      catalog
    );
    expect(result.program.pendingAdjustments).toBeUndefined();
    expect(result.program.deloadAtWeek).toBeNull();
  });

  it('consuma l’aggiustamento una tantum alla seduta successiva', () => {
    const program = programOf([slotOf()], { pendingAdjustments: { 0: { accessorySetDelta: -1 } } });
    const result = applySession(program, sessionOf({ reps: 8, rir: 2 }), [], catalog);
    expect(result.program.pendingAdjustments[0]).toBeUndefined();
  });
});

// ---- 4.4 Sedute saltate ----------------------------------------------------

describe('4.4 sedute saltate', () => {
  const previousOn = (date) =>
    sessionOf({ reps: 8, rir: 2, id: 's0', startedAt: `${date}T08:00:00.000Z` });

  it('9 giorni: progressione normale', () => {
    const result = applySession(
      programOf([slotOf()]),
      sessionOf({ reps: 10, rir: 2, startedAt: '2026-09-10T08:00:00.000Z' }),
      [previousOn('2026-09-01')],
      catalog
    );
    expect(firstSlot(result).workingWeightKg).toBe(105);
  });

  it('11 giorni: nessuna progressione', () => {
    const result = applySession(
      programOf([slotOf()]),
      sessionOf({ reps: 10, rir: 2, startedAt: '2026-09-12T08:00:00.000Z' }),
      [previousOn('2026-09-01')],
      catalog
    );
    expect(result.program.days[0].slots[0].workingWeightKg).toBe(100);
    expect(result.notes[0]).toContain('11 giorni');
  });

  it('22 giorni: tutti i carichi scendono del 10 %', () => {
    const program = programOf([slotOf(), slotOf({ id: 'slot-2', workingWeightKg: 60 })]);
    const result = applySession(
      program,
      sessionOf({ reps: 10, rir: 2, startedAt: '2026-09-23T08:00:00.000Z' }),
      [previousOn('2026-09-01')],
      catalog
    );
    expect(result.program.days[0].slots[0].workingWeightKg).toBe(90);
    expect(result.program.days[0].slots[1].workingWeightKg).toBe(55);
    expect(result.program.days[0].slots[0].failStreak).toBe(0);
    expect(result.notes).toHaveLength(1);
  });
});

// ---- 4.5 Sostituzioni ------------------------------------------------------

describe('4.5 sostituzione esercizio', () => {
  const substitute = squat.substitutes[0];

  it('la seduta con un sostituto non tocca lo slot', () => {
    const result = applySession(
      programOf([slotOf()]),
      sessionOf({
        reps: 4,
        rir: 0,
        exerciseId: substitute,
        substitutions: { 'slot-1': substitute },
      }),
      [],
      catalog
    );
    expect(result.program.days[0].slots[0].workingWeightKg).toBe(100);
    expect(result.program.days[0].slots[0].failStreak).toBe(0);
  });

  it('alla terza volta consecutiva propone di renderlo definitivo', () => {
    const history = ['s0', 's-1'].map((id, index) =>
      sessionOf({
        reps: 8,
        rir: 2,
        id,
        startedAt: `2026-09-0${index + 1}T08:00:00.000Z`,
        substitutions: { 'slot-1': substitute },
      })
    );
    const result = applySession(
      programOf([slotOf()]),
      sessionOf({ reps: 8, rir: 2, substitutions: { 'slot-1': substitute } }),
      history,
      catalog
    );
    expect(result.program.substitutionProposals['slot-1']).toBe(substitute);
    expect(result.notes.some((note) => note.includes('tre volte'))).toBe(true);
  });

  it('non propone nulla alla seconda volta', () => {
    const history = [
      sessionOf({
        reps: 8,
        rir: 2,
        id: 's0',
        startedAt: '2026-09-05T08:00:00.000Z',
        substitutions: { 'slot-1': substitute },
      }),
    ];
    const result = applySession(
      programOf([slotOf()]),
      sessionOf({ reps: 8, rir: 2, substitutions: { 'slot-1': substitute } }),
      history,
      catalog
    );
    expect(result.program.substitutionProposals).toBeUndefined();
  });

  it('accettare la proposta cambia lo slot e lo rimette da calibrare', () => {
    const program = programOf([slotOf()]);
    const next = makeSubstitutionPermanent(program, 'slot-1', substitute);
    expect(next.days[0].slots[0].exerciseId).toBe(substitute);
    expect(next.days[0].slots[0].state).toBe('uncalibrated');
    expect(next.days[0].slots[0].workingWeightKg).toBeNull();
    expect(program.days[0].slots[0].exerciseId).toBe(squat.id);
  });
});

// ---- Contratto generale ----------------------------------------------------

describe('applySession — contratto', () => {
  it('una seduta senza serie non produce note né modifiche', () => {
    const program = programOf([slotOf()]);
    const result = applySession(program, sessionOf({ reps: 8, rir: 2, sets: 0 }), [], catalog);
    expect(result.notes).toEqual([]);
    expect(result.program).toBe(program);
  });

  it('solo serie di avvicinamento: nessuna modifica', () => {
    const program = programOf([slotOf()]);
    const session = sessionOf({ reps: 5, rir: 4 });
    session.sets = session.sets.map((log) => ({ ...log, isWarmup: true }));
    expect(applySession(program, session, [], catalog).notes).toEqual([]);
  });

  it('ogni slot modificato produce esattamente una nota', () => {
    const program = programOf([
      slotOf(),
      slotOf({ id: 'slot-2', exerciseId: bench.id, workingWeightKg: 60 }),
    ]);
    const session = sessionOf({ reps: 10, rir: 2 });
    session.sets = [
      ...session.sets,
      ...sessionOf({ reps: 10, rir: 2, slotId: 'slot-2', exerciseId: bench.id }).sets,
    ];
    const result = applySession(program, session, [], catalog);
    expect(result.notes).toHaveLength(2);
    for (const note of result.notes) expect(note.length).toBeGreaterThan(20);
  });

  it('non muta gli oggetti in ingresso', () => {
    const program = programOf([slotOf()]);
    const session = sessionOf({ reps: 10, rir: 2, feedback: { difficulty: 'hard', energy: 'low', soreness: 'none' } });
    const history = [sessionOf({ reps: 8, rir: 2, id: 's0', startedAt: '2026-09-08T08:00:00.000Z' })];

    const before = {
      program: JSON.stringify(program),
      session: JSON.stringify(session),
      history: JSON.stringify(history),
    };
    applySession(program, session, history, catalog);

    expect(JSON.stringify(program)).toBe(before.program);
    expect(JSON.stringify(session)).toBe(before.session);
    expect(JSON.stringify(history)).toBe(before.history);
  });

  it('le note sono stringhe leggibili in italiano', () => {
    const result = applySession(
      programOf([slotOf()]),
      sessionOf({ reps: 10, rir: 2 }),
      [],
      catalog
    );
    for (const note of result.notes) {
      expect(typeof note).toBe('string');
      expect(note).toContain(squat.name);
      expect(note).not.toMatch(/\bdevi\b/i);
    }
  });
});
