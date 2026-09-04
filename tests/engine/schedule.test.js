// Tempra v0.4.0 — 2026-09-04 11:30
//
// Avanzamento del mesociclo (spec 4.4) e mappa di calore (6.1 e 6.4).

import { describe, expect, it } from 'vitest';
import catalog from '../../src/data/exercises.json' with { type: 'json' };
import { generateProgram } from '../../src/engine/generate.js';
import {
  buildHeatmap,
  completedVolume,
  getScheduleState,
  heatLevel,
} from '../../src/engine/schedule.js';
import { MUSCLES } from '../../src/data/taxonomy.js';

const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]));
const program = generateProgram(
  { goal: 'hypertrophy', daysPerWeek: 3, minutesPerSession: 60, level: 'intermediate' },
  catalog,
  20260904
);

/** @param {number} weekIndex @param {number} dayIndex @param {object[]} sets */
const session = (weekIndex, dayIndex, sets = [], status = 'completed') => ({
  id: `s-${weekIndex}-${dayIndex}`,
  programId: program.id,
  weekIndex,
  dayIndex,
  status,
  startedAt: `2026-09-0${dayIndex + 1}T08:00:00.000Z`,
  endedAt: null,
  sets,
  feedback: null,
});

describe('getScheduleState — senza sedute', () => {
  const state = getScheduleState(program, []);

  it('parte dalla settimana 1', () => {
    expect(state.weekIndex).toBe(0);
    expect(state.isComplete).toBe(false);
  });

  it('propone il primo giorno', () => {
    expect(state.nextDayIndex).toBe(0);
    expect(state.completedDays).toBe(0);
    expect(state.totalDays).toBe(program.days.length);
  });

  it('segna tutti i giorni come da fare', () => {
    expect(state.days.every((day) => !day.done)).toBe(true);
    expect(state.days.map((day) => day.label)).toEqual(
      program.days.map((day) => day.label)
    );
  });
});

describe('getScheduleState — avanzamento per sedute completate', () => {
  it('propone il giorno successivo dopo il primo', () => {
    const state = getScheduleState(program, [session(0, 0)]);
    expect(state.weekIndex).toBe(0);
    expect(state.nextDayIndex).toBe(1);
    expect(state.days[0].done).toBe(true);
  });

  it('non salta un giorno lasciato indietro', () => {
    const state = getScheduleState(program, [session(0, 1)]);
    expect(state.nextDayIndex).toBe(0);
  });

  it('passa alla settimana 2 solo a settimana 1 completa', () => {
    const partial = program.days.slice(0, -1).map((day) => session(0, day.index));
    expect(getScheduleState(program, partial).weekIndex).toBe(0);

    const full = program.days.map((day) => session(0, day.index));
    const state = getScheduleState(program, full);
    expect(state.weekIndex).toBe(1);
    expect(state.nextDayIndex).toBe(0);
    expect(state.days.every((day) => !day.done)).toBe(true);
  });

  it('ignora le sedute non completate', () => {
    const state = getScheduleState(program, [
      session(0, 0, [], 'in-progress'),
      session(0, 1, [], 'abandoned'),
    ]);
    expect(state.nextDayIndex).toBe(0);
    expect(state.completedDays).toBe(0);
  });

  it('riconosce il mesociclo finito', () => {
    const all = [];
    for (let week = 0; week < 6; week += 1) {
      for (const day of program.days) all.push({ ...session(week, day.index), id: `${week}-${day.index}` });
    }
    const state = getScheduleState(program, all);
    expect(state.isComplete).toBe(true);
    expect(state.weekIndex).toBe(5);
    expect(state.nextDayIndex).toBeNull();
  });
});

describe('completedVolume', () => {
  const exercise = catalog.find((e) => e.id === 'barbell-bench-press');

  const log = (isWarmup) => ({
    slotId: 'x',
    exerciseId: exercise.id,
    setIndex: 0,
    weightKg: 60,
    reps: 8,
    rir: 2,
    rirInput: 'numeric',
    isWarmup,
    completedAt: '2026-09-04T08:00:00.000Z',
  });

  it('conta una serie per ogni muscolo primario', () => {
    const volume = completedVolume([session(0, 0, [log(false), log(false)])], 0, byId);
    for (const muscle of exercise.primaryMuscles) expect(volume[muscle]).toBe(2);
    for (const muscle of exercise.secondaryMuscles) expect(volume[muscle]).toBeUndefined();
  });

  it('non conta le serie di avvicinamento', () => {
    const volume = completedVolume([session(0, 0, [log(true), log(false)])], 0, byId);
    expect(volume[exercise.primaryMuscles[0]]).toBe(1);
  });

  it('conta solo la settimana richiesta', () => {
    const sessions = [session(0, 0, [log(false)]), session(1, 0, [log(false)])];
    expect(completedVolume(sessions, 1, byId)[exercise.primaryMuscles[0]]).toBe(1);
  });
});

describe('heatLevel — i quattro livelli della spec 6.1', () => {
  it('vale 0 senza serie', () => {
    expect(heatLevel(0, 12)).toBe(0);
  });

  it('vale 1 sotto la metà del target', () => {
    expect(heatLevel(1, 12)).toBe(1);
    expect(heatLevel(5, 12)).toBe(1);
  });

  it('vale 2 tra metà e target', () => {
    expect(heatLevel(6, 12)).toBe(2);
    expect(heatLevel(11, 12)).toBe(2);
  });

  it('vale 3 dal target in su', () => {
    expect(heatLevel(12, 12)).toBe(3);
    expect(heatLevel(30, 12)).toBe(3);
  });
});

describe('buildHeatmap', () => {
  it('con zero sedute mostra tutti i gruppi a 0 (criterio 6.4)', () => {
    const heatmap = buildHeatmap(program, [], 0, byId, MUSCLES);
    expect(heatmap).toHaveLength(MUSCLES.length);
    for (const entry of heatmap) {
      expect(entry.completed, entry.muscle).toBe(0);
      expect(entry.level, entry.muscle).toBe(0);
      expect(entry.min).toBeGreaterThan(0);
      expect(entry.max).toBeGreaterThanOrEqual(entry.min);
    }
  });

  it('accende i gruppi allenati', () => {
    const exercise = catalog.find((e) => e.id === 'barbell-back-squat');
    const sets = Array.from({ length: 12 }, () => ({
      exerciseId: exercise.id,
      isWarmup: false,
    }));
    const heatmap = buildHeatmap(program, [session(0, 0, sets)], 0, byId, MUSCLES);
    const quads = heatmap.find((entry) => entry.muscle === 'quads');
    expect(quads.completed).toBe(12);
    expect(quads.level).toBe(3);
    expect(heatmap.find((entry) => entry.muscle === 'biceps').level).toBe(0);
  });
});
