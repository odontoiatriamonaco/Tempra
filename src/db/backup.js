// Tempra v0.7.0 — 2026-09-04 13:20
//
// Export e import del backup (spec 2.8). Un solo file JSON con tutto quello
// che appartiene all'utente.
//
// Il catalogo esercizi **non** si esporta: è dell'app, non dell'utente, e
// includerlo raddoppierebbe il file per riscrivere dati che il codice ha già.

import { BACKUP_SCHEMA_VERSION, VERSION } from '../version.js';
import {
  getAllExerciseNotes,
  getMeasurements,
  getProfile,
  getSettings,
  now,
  saveExerciseNote,
  saveMeasurement,
  saveProfile,
  saveProgram,
  saveSession,
  saveSettings,
} from './repo.js';
import { getDB, STORES } from './schema.js';

/** Store che appartengono all'utente, quindi svuotabili e ripristinabili. */
const USER_STORES = [
  STORES.PROFILE,
  STORES.PROGRAMS,
  STORES.SESSIONS,
  STORES.MEASUREMENTS,
  STORES.EXERCISE_NOTES,
  STORES.SETTINGS,
];

/**
 * Raccoglie tutto in un oggetto pronto da serializzare.
 * @returns {Promise<object>}
 */
export async function buildBackup() {
  const db = await getDB();

  const [profile, programs, sessions, measurements, exerciseNotes, settings] =
    await Promise.all([
      getProfile(),
      db.getAll(STORES.PROGRAMS),
      db.getAll(STORES.SESSIONS),
      getMeasurements(),
      getAllExerciseNotes(),
      getSettings(),
    ]);

  return {
    version: BACKUP_SCHEMA_VERSION,
    appVersion: VERSION,
    exportedAt: now(),
    profile: profile ?? null,
    programs,
    sessions,
    measurements,
    exerciseNotes,
    settings,
  };
}

/**
 * Nome del file, con la data: serve a distinguerli quando se ne accumulano
 * diversi nella cartella dei download.
 * @param {string} [isoDate]
 * @returns {string}
 */
export function backupFilename(isoDate = now()) {
  return `tempra-backup-${isoDate.slice(0, 10)}.json`;
}

/**
 * Errore di un backup non valido: il messaggio è già in italiano e mostrabile.
 */
export class BackupError extends Error {}

/**
 * Verifica che il file sia un backup di Tempra e non qualunque altro JSON.
 * Meglio rifiutare un file buono che sovrascrivere i dati con spazzatura.
 *
 * @param {unknown} data
 * @returns {object} il backup, normalizzato
 */
export function validateBackup(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new BackupError('Il file non contiene un backup di Tempra.');
  }

  if (typeof data.version !== 'number') {
    throw new BackupError('Il file non dichiara la versione del backup.');
  }

  if (data.version > BACKUP_SCHEMA_VERSION) {
    throw new BackupError(
      `Il backup è stato creato con una versione più recente dell'app (schema ${data.version}). Aggiorna Tempra e riprova.`
    );
  }

  const asArray = (value, name) => {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) {
      throw new BackupError(`Il campo "${name}" del backup non è una lista.`);
    }
    return value;
  };

  return migrate({
    version: data.version,
    appVersion: data.appVersion ?? null,
    exportedAt: data.exportedAt ?? null,
    profile: data.profile ?? null,
    programs: asArray(data.programs, 'programs'),
    sessions: asArray(data.sessions, 'sessions'),
    measurements: asArray(data.measurements, 'measurements'),
    exerciseNotes: asArray(data.exerciseNotes, 'exerciseNotes'),
    settings: data.settings ?? null,
  });
}

/**
 * Porta un backup vecchio alla forma corrente (spec 2.8: «versioni precedenti
 * vengono migrate»). Oggi c'è un solo schema, quindi non fa nulla: la funzione
 * esiste perché la prossima versione abbia un posto ovvio dove aggiungersi.
 *
 * @param {object} backup
 * @returns {object}
 */
export function migrate(backup) {
  let current = backup;
  // if (current.version < 2) current = { ...current, version: 2, /* … */ };
  return { ...current, version: BACKUP_SCHEMA_VERSION };
}

/**
 * Quante cose contiene il backup: si mostra nella conferma, perché
 * "sovrascrivo tutto" è una frase che merita un numero accanto.
 *
 * @param {object} backup
 * @returns {{ programs: number, sessions: number, measurements: number, notes: number, hasProfile: boolean }}
 */
export function summarizeBackup(backup) {
  return {
    programs: backup.programs.length,
    sessions: backup.sessions.length,
    measurements: backup.measurements.length,
    notes: backup.exerciseNotes.length,
    hasProfile: Boolean(backup.profile),
  };
}

/**
 * Sostituisce **tutti** i dati dell'utente con quelli del backup. Il catalogo
 * resta dov'è. Chi chiama deve avere già chiesto conferma.
 *
 * @param {object} backup già passato da `validateBackup`
 */
export async function restoreBackup(backup) {
  await clearUserData();

  if (backup.profile) {
    await saveProfile(backup.profile);
  }
  for (const program of backup.programs) await saveProgram(program);
  for (const session of backup.sessions) await saveSession(session);
  for (const measurement of backup.measurements) await saveMeasurement(measurement);
  for (const note of backup.exerciseNotes) {
    await saveExerciseNote(note.exerciseId, note.text);
  }
  if (backup.settings) await saveSettings(backup.settings);
}

/** Svuota i dati dell'utente lasciando il catalogo. */
export async function clearUserData() {
  const db = await getDB();
  const tx = db.transaction(USER_STORES, 'readwrite');
  await Promise.all(USER_STORES.map((store) => tx.objectStore(store).clear()));
  await tx.done;
}

/**
 * Legge un file scelto dall'utente e ne restituisce il backup validato.
 * @param {File} file
 * @returns {Promise<object>}
 */
export async function readBackupFile(file) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new BackupError('Il file non è un JSON leggibile.');
  }
  return validateBackup(parsed);
}

/**
 * Scarica il backup come file. Usa un Blob locale: nessun byte esce dal
 * dispositivo, il file lo scrive il browser.
 * @returns {Promise<string>} il nome del file scritto
 */
export async function downloadBackup() {
  const backup = await buildBackup();
  const filename = backupFilename(backup.exportedAt);
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return filename;
}
