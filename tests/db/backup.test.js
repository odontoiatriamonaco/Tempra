// Tempra v0.7.0 — 2026-09-04 13:20
//
// Export e import del backup (spec 2.8). Un import che accetta spazzatura
// sovrascrive i dati dell'utente: la validazione è la parte che conta.

import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { BACKUP_SCHEMA_VERSION } from '../../src/version.js';
import { deleteDB } from '../../src/db/schema.js';
import {
  BackupError,
  backupFilename,
  buildBackup,
  clearUserData,
  migrate,
  restoreBackup,
  summarizeBackup,
  validateBackup,
} from '../../src/db/backup.js';
import {
  getMeasurements,
  getProfile,
  saveExerciseNote,
  saveMeasurement,
  saveProfile,
  saveProgram,
  saveSession,
  seedExercises,
} from '../../src/db/repo.js';
import catalog from '../../src/data/exercises.json' with { type: 'json' };

afterEach(async () => {
  await deleteDB();
});

const profile = {
  goal: 'hypertrophy',
  daysPerWeek: 4,
  minutesPerSession: 60,
  level: 'intermediate',
  units: 'kg',
  disclaimerAcceptedAt: '2026-09-01T08:00:00.000Z',
};

const program = {
  id: 'p1',
  createdAt: '2026-09-01T08:00:00.000Z',
  status: 'active',
  days: [],
};

const session = {
  id: 's1',
  programId: 'p1',
  dayIndex: 0,
  weekIndex: 0,
  startedAt: '2026-09-02T08:00:00.000Z',
  endedAt: null,
  status: 'completed',
  sets: [],
};

async function seedUserData() {
  await saveProfile(profile);
  await saveProgram(program);
  await saveSession(session);
  await saveMeasurement({ id: 'm1', date: '2026-09-02', bodyweightKg: 78.4 });
  await saveExerciseNote('barbell-back-squat', 'Fermi al foro 4');
}

describe('buildBackup', () => {
  it('raccoglie tutto quello che appartiene all’utente', async () => {
    await seedUserData();
    const backup = await buildBackup();

    expect(backup.version).toBe(BACKUP_SCHEMA_VERSION);
    expect(backup.profile.goal).toBe('hypertrophy');
    expect(backup.programs).toHaveLength(1);
    expect(backup.sessions).toHaveLength(1);
    expect(backup.measurements).toHaveLength(1);
    expect(backup.exerciseNotes).toHaveLength(1);
    expect(backup.settings).toBeTruthy();
  });

  it('non esporta il catalogo esercizi (spec 2.8)', async () => {
    await seedExercises(catalog);
    const backup = await buildBackup();
    expect(backup.exercises).toBeUndefined();
    expect(JSON.stringify(backup)).not.toContain('barbell-back-squat');
  });

  it('è serializzabile senza perdite', async () => {
    await seedUserData();
    const backup = await buildBackup();
    expect(JSON.parse(JSON.stringify(backup))).toEqual(backup);
  });
});

describe('backupFilename', () => {
  it('usa il formato della spec', () => {
    expect(backupFilename('2026-09-04T13:20:00.000Z')).toBe('tempra-backup-2026-09-04.json');
  });
});

describe('validateBackup', () => {
  const valid = {
    version: BACKUP_SCHEMA_VERSION,
    profile: null,
    programs: [],
    sessions: [],
    measurements: [],
    exerciseNotes: [],
    settings: null,
  };

  it('accetta un backup ben formato', () => {
    expect(validateBackup(valid).version).toBe(BACKUP_SCHEMA_VERSION);
  });

  it('tollera i campi mancanti trattandoli come liste vuote', () => {
    const result = validateBackup({ version: 1 });
    expect(result.programs).toEqual([]);
    expect(result.sessions).toEqual([]);
    expect(result.profile).toBeNull();
  });

  it.each([
    [null, 'null'],
    ['{}', 'una stringa'],
    [42, 'un numero'],
    [[], 'una lista'],
    [{ nessunaVersione: true }, 'senza versione'],
  ])('rifiuta %s (%s)', (input) => {
    expect(() => validateBackup(input)).toThrow(BackupError);
  });

  it('rifiuta uno schema più recente dell’app', () => {
    expect(() => validateBackup({ ...valid, version: BACKUP_SCHEMA_VERSION + 1 })).toThrow(
      /versione più recente/
    );
  });

  it('rifiuta un campo che dovrebbe essere una lista', () => {
    expect(() => validateBackup({ ...valid, sessions: 'no' })).toThrow(/sessions/);
  });

  it('dà messaggi in italiano, mostrabili all’utente', () => {
    try {
      validateBackup(null);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(BackupError);
      expect(error.message).toMatch(/backup di Tempra/);
    }
  });
});

describe('migrate', () => {
  it('porta il backup alla versione corrente', () => {
    expect(migrate({ version: 1 }).version).toBe(BACKUP_SCHEMA_VERSION);
  });
});

describe('summarizeBackup', () => {
  it('conta quello che si sta per sovrascrivere', () => {
    const summary = summarizeBackup({
      profile: { id: 'me' },
      programs: [1, 2],
      sessions: [1, 2, 3],
      measurements: [1],
      exerciseNotes: [],
    });
    expect(summary).toEqual({
      programs: 2,
      sessions: 3,
      measurements: 1,
      notes: 0,
      hasProfile: true,
    });
  });
});

describe('restoreBackup', () => {
  it('fa un giro completo senza perdere nulla', async () => {
    await seedUserData();
    const backup = await buildBackup();

    await clearUserData();
    expect(await getProfile()).toBeUndefined();

    await restoreBackup(backup);
    const restored = await buildBackup();

    expect(restored.profile.goal).toBe(backup.profile.goal);
    expect(restored.programs).toEqual(backup.programs);
    expect(restored.sessions).toEqual(backup.sessions);
    expect(restored.measurements).toEqual(backup.measurements);
    expect(restored.exerciseNotes[0].text).toBe('Fermi al foro 4');
  });

  it('sostituisce i dati esistenti invece di sommarsi', async () => {
    await seedUserData();
    const backup = await buildBackup();

    await saveMeasurement({ id: 'm2', date: '2026-09-03', bodyweightKg: 79 });
    expect(await getMeasurements()).toHaveLength(2);

    await restoreBackup(backup);
    expect(await getMeasurements()).toHaveLength(1);
  });

  it('non tocca il catalogo esercizi', async () => {
    await seedExercises(catalog);
    await seedUserData();
    const backup = await buildBackup();

    await restoreBackup(backup);

    const { getAllExercises } = await import('../../src/db/repo.js');
    expect(await getAllExercises()).toHaveLength(catalog.length);
  });
});

describe('clearUserData', () => {
  it('svuota i dati dell’utente lasciando il catalogo', async () => {
    await seedExercises(catalog);
    await seedUserData();

    await clearUserData();

    const { getAllExercises } = await import('../../src/db/repo.js');
    expect(await getProfile()).toBeUndefined();
    expect(await getMeasurements()).toEqual([]);
    expect(await getAllExercises()).toHaveLength(catalog.length);
  });
});
