// Tempra v0.2.0 — 2026-09-04 09:12
//
// Integrità del catalogo esercizi. Spec 2.2 (forma e distribuzione) e 6.4
// (licenze, cue, sostituti, immagini).

import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import catalog from '../../src/data/exercises.json' with { type: 'json' };
import {
  DEFAULT_REST_SECONDS,
  ISOLATION_PATTERNS,
  LOAD_INCREMENTS,
  MULTI_JOINT_PATTERNS,
  MUSCLES,
  PATTERNS,
  TIERS,
} from '../../src/data/taxonomy.js';

const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]));

/** @param {string} pattern */
const withPattern = (pattern) => catalog.filter((e) => e.pattern === pattern);

describe('catalogo — dimensione e unicità', () => {
  it('contiene circa 60 esercizi', () => {
    expect(catalog.length).toBeGreaterThanOrEqual(58);
  });

  it('non ha id duplicati', () => {
    expect(byId.size).toBe(catalog.length);
  });

  it('usa slug stabili in kebab-case', () => {
    for (const exercise of catalog) {
      expect(exercise.id, exercise.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('non ha nomi duplicati', () => {
    const names = catalog.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('catalogo — forma di ogni record', () => {
  it.each(catalog.map((e) => [e.id, e]))('%s è conforme allo schema', (_id, exercise) => {
    expect(typeof exercise.name).toBe('string');
    expect(exercise.name.length).toBeGreaterThan(0);

    expect(PATTERNS).toContain(exercise.pattern);
    expect(TIERS).toContain(exercise.tier);

    expect(Array.isArray(exercise.primaryMuscles)).toBe(true);
    expect(exercise.primaryMuscles.length).toBeGreaterThan(0);
    for (const muscle of exercise.primaryMuscles) expect(MUSCLES).toContain(muscle);
    for (const muscle of exercise.secondaryMuscles) expect(MUSCLES).toContain(muscle);

    // Un muscolo non può essere primario e secondario nello stesso esercizio:
    // il motore conta il volume sui soli primari e li sommerebbe due volte.
    const overlap = exercise.primaryMuscles.filter((m) =>
      exercise.secondaryMuscles.includes(m)
    );
    expect(overlap).toEqual([]);

    expect(Array.isArray(exercise.equipment)).toBe(true);
    expect(exercise.equipment.length).toBeGreaterThan(0);
    expect(typeof exercise.unilateral).toBe('boolean');

    expect(LOAD_INCREMENTS).toContain(exercise.loadIncrementKg);
    expect(DEFAULT_REST_SECONDS).toContain(exercise.defaultRestSec);
  });

  it('assegna a ogni tier il recupero di default coerente', () => {
    const expected = { main: 180, secondary: 120, accessory: 90 };
    for (const exercise of catalog) {
      expect(exercise.defaultRestSec, exercise.id).toBe(expected[exercise.tier]);
    }
  });
});

describe('catalogo — distribuzione richiesta dalla spec 2.2', () => {
  it.each(MULTI_JOINT_PATTERNS)(
    'il pattern %s ha almeno 2 main e 2 secondary',
    (pattern) => {
      const group = withPattern(pattern);
      expect(group.filter((e) => e.tier === 'main').length).toBeGreaterThanOrEqual(2);
      expect(group.filter((e) => e.tier === 'secondary').length).toBeGreaterThanOrEqual(2);
    }
  );

  it.each(ISOLATION_PATTERNS)('il pattern %s ha almeno 2 accessori', (pattern) => {
    const group = withPattern(pattern).filter((e) => e.tier === 'accessory');
    expect(group.length).toBeGreaterThanOrEqual(2);
  });

  it('ha almeno 3 esercizi core', () => {
    expect(withPattern('core').length).toBeGreaterThanOrEqual(3);
  });

  it('copre ogni gruppo muscolare come primario in almeno un esercizio', () => {
    const covered = new Set(catalog.flatMap((e) => e.primaryMuscles));
    expect([...MUSCLES].filter((m) => !covered.has(m))).toEqual([]);
  });

  it('assegna solo tier accessory ai pattern di isolamento e core', () => {
    for (const exercise of catalog) {
      if (MULTI_JOINT_PATTERNS.includes(exercise.pattern)) continue;
      expect(exercise.tier, exercise.id).toBe('accessory');
    }
  });
});

describe('catalogo — cue tecnici (spec 6.3)', () => {
  it.each(catalog.map((e) => [e.id, e]))('%s ha almeno 3 cue', (_id, exercise) => {
    expect(exercise.cues.length).toBeGreaterThanOrEqual(3);
    expect(exercise.cues.length).toBeLessThanOrEqual(4);
    for (const cue of exercise.cues) {
      expect(cue.length).toBeGreaterThan(15);
      expect(cue.length).toBeLessThanOrEqual(140);
    }
  });

  it('non usa un lessico clinico o riabilitativo', () => {
    const forbidden = /\b(terapia|terapeutic\w*|riabilitazion\w*|patologi\w*|diagnosi|lesion\w*|infortuni\w*|dolore|medic\w*)\b/i;
    for (const exercise of catalog) {
      for (const cue of exercise.cues) {
        expect(cue, `${exercise.id}: ${cue}`).not.toMatch(forbidden);
      }
    }
  });
});

describe('catalogo — sostituti (spec 6.4)', () => {
  it.each(catalog.map((e) => [e.id, e]))(
    '%s ha almeno 2 sostituti esistenti e dello stesso pattern',
    (_id, exercise) => {
      expect(exercise.substitutes.length).toBeGreaterThanOrEqual(2);
      for (const substituteId of exercise.substitutes) {
        const substitute = byId.get(substituteId);
        expect(substitute, `${exercise.id} → ${substituteId} non esiste`).toBeDefined();
        expect(substitute.pattern, `${exercise.id} → ${substituteId}`).toBe(
          exercise.pattern
        );
      }
    }
  );

  it('non elenca mai un esercizio come sostituto di se stesso', () => {
    for (const exercise of catalog) {
      expect(exercise.substitutes, exercise.id).not.toContain(exercise.id);
    }
  });

  it('non ripete lo stesso sostituto due volte', () => {
    for (const exercise of catalog) {
      expect(new Set(exercise.substitutes).size, exercise.id).toBe(
        exercise.substitutes.length
      );
    }
  });
});

describe('catalogo — licenze e immagini (spec 6.2 e 6.4)', () => {
  it.each(catalog.map((e) => [e.id, e]))('%s dichiara una licenza', (_id, exercise) => {
    expect(exercise.license).toBeTruthy();
    expect(exercise.license.source?.length).toBeGreaterThan(0);
    expect(exercise.license.type?.length).toBeGreaterThan(0);
  });

  it('dichiara solo immagini che esistono davvero nel repo', () => {
    for (const exercise of catalog) {
      for (const image of exercise.images) {
        const path = fileURLToPath(new URL(`../../public${image}`, import.meta.url));
        expect(existsSync(path), `${exercise.id}: manca ${image}`).toBe(true);
      }
    }
  });

  it('quando ci sono immagini, la licenza cita la fonte esterna', () => {
    for (const exercise of catalog) {
      if (exercise.images.length === 0) continue;
      expect(exercise.license.url, exercise.id).toMatch(/^https?:\/\//);
      expect(exercise.license.source, exercise.id).not.toBe('Tempra');
    }
  });
});
