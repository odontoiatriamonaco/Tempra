// Tempra v0.1.0 — 2026-09-04 08:24
//
// Apertura del database IndexedDB, definizione degli store e migrazioni.
// Spec sezione 2. Database `tempra`, versione 1.
//
// Le migrazioni sono un array indicizzato per versione di arrivo: per salire a
// una versione N si eseguono in ordine tutti i passi da oldVersion+1 a N. Ogni
// passo riceve (db, transaction) come da API di `idb`, così una versione futura
// si aggiunge in fondo senza toccare quelle esistenti.

import { openDB } from 'idb';

export const DB_NAME = 'tempra';
export const DB_VERSION = 1;

/** Nomi degli store. Usare sempre queste costanti, mai stringhe letterali. */
export const STORES = Object.freeze({
  PROFILE: 'profile',
  EXERCISES: 'exercises',
  PROGRAMS: 'programs',
  SESSIONS: 'sessions',
  MEASUREMENTS: 'measurements',
  EXERCISE_NOTES: 'exerciseNotes',
  SETTINGS: 'settings',
});

/** Chiavi dei record singleton. */
export const SINGLETON_KEYS = Object.freeze({
  PROFILE: 'me',
  SETTINGS: 'app',
});

/**
 * Migrazioni, in ordine. `version` è la versione del database che il passo
 * porta a compimento.
 * @type {ReadonlyArray<{ version: number, up: (db: IDBPDatabase, tx: IDBPTransaction) => void }>}
 */
const MIGRATIONS = [
  {
    version: 1,
    up(db) {
      // profile — record singolo, key 'me'
      db.createObjectStore(STORES.PROFILE, { keyPath: 'id' });

      // exercises — catalogo, seedato al primo avvio da src/data/exercises.json
      const exercises = db.createObjectStore(STORES.EXERCISES, {
        keyPath: 'id',
      });
      exercises.createIndex('by-pattern', 'pattern');
      exercises.createIndex('by-tier', 'tier');
      exercises.createIndex('by-primary-muscle', 'primaryMuscles', {
        multiEntry: true,
      });

      // programs
      const programs = db.createObjectStore(STORES.PROGRAMS, { keyPath: 'id' });
      programs.createIndex('by-status', 'status');
      programs.createIndex('by-created', 'createdAt');

      // sessions
      const sessions = db.createObjectStore(STORES.SESSIONS, { keyPath: 'id' });
      sessions.createIndex('by-program', 'programId');
      sessions.createIndex('by-status', 'status');
      sessions.createIndex('by-started', 'startedAt');
      // Chiave composita: serve alla riga "ultima volta" e a 4.4 (sessioni
      // saltate), che ragionano sempre per giorno del programma.
      sessions.createIndex('by-program-day', ['programId', 'dayIndex']);

      // measurements
      const measurements = db.createObjectStore(STORES.MEASUREMENTS, {
        keyPath: 'id',
      });
      measurements.createIndex('by-date', 'date');

      // exerciseNotes — key: exerciseId
      db.createObjectStore(STORES.EXERCISE_NOTES, { keyPath: 'exerciseId' });

      // settings — record singolo, key 'app'
      db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
    },
  },
];

/**
 * Applica in ordine tutte le migrazioni necessarie. Esportata per poterla
 * testare senza aprire un database vero.
 * @param {number} oldVersion
 * @param {number} newVersion
 * @returns {ReadonlyArray<{ version: number, up: Function }>} i passi da eseguire
 */
export function migrationsFor(oldVersion, newVersion) {
  return MIGRATIONS.filter(
    (m) => m.version > oldVersion && m.version <= newVersion
  );
}

/** @type {Promise<import('idb').IDBPDatabase> | null} */
let dbPromise = null;

/**
 * Apre (una sola volta) il database e restituisce la connessione.
 * @returns {Promise<import('idb').IDBPDatabase>}
 */
export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, tx) {
        for (const migration of migrationsFor(oldVersion, newVersion)) {
          migration.up(db, tx);
        }
      },
      blocked() {
        // Un'altra scheda tiene aperta una versione vecchia del database.
        console.warn(
          'Tempra: aggiornamento del database in attesa, chiudi le altre schede.'
        );
      },
      blocking() {
        // Questa scheda blocca un aggiornamento avviato altrove: si sfila.
        closeDB();
      },
    });
  }
  return dbPromise;
}

/** Chiude la connessione. Usata da `blocking` e dai test. */
export async function closeDB() {
  if (!dbPromise) return;
  const db = await dbPromise;
  db.close();
  dbPromise = null;
}

/** Cancella l'intero database. Usata da "Ricomincia da zero" (spec 7.1). */
export async function deleteDB() {
  await closeDB();
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}
