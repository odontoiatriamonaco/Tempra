// Tempra v0.1.0 — 2026-09-04 08:24
//
// CRUD sugli store di IndexedDB. I tipi sono documentati in JSDoc secondo la
// sezione 2 della spec. Nessuna logica di dominio qui: il repository legge e
// scrive, i motori in src/engine/ decidono.

import { getDB, STORES, SINGLETON_KEYS } from './schema.js';

/**
 * @typedef {'strength' | 'hypertrophy' | 'recomp'} Goal
 * @typedef {'beginner' | 'intermediate' | 'advanced'} Level
 */

/**
 * @typedef {object} Profile
 * @property {'me'} id
 * @property {Goal} goal
 * @property {2|3|4|5|6} daysPerWeek
 * @property {30|45|60|75|90} minutesPerSession
 * @property {Level} level
 * @property {'kg'} units
 * @property {string} disclaimerAcceptedAt
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {object} Settings
 * @property {'app'} id
 * @property {boolean} restTimerSound
 * @property {boolean} restTimerVibrate
 * @property {boolean} autoStartRestTimer
 * @property {'system'|'light'|'dark'} theme
 */

/** Impostazioni di partenza al primo avvio. */
export const DEFAULT_SETTINGS = Object.freeze({
  id: SINGLETON_KEYS.SETTINGS,
  restTimerSound: true,
  restTimerVibrate: true,
  autoStartRestTimer: true,
  theme: 'system',
});

/** @returns {string} data e ora correnti in ISO 8601 */
export function now() {
  return new Date().toISOString();
}

/** @returns {string} identificatore univoco */
export function newId() {
  return crypto.randomUUID();
}

// ---- profile -------------------------------------------------------------

/** @returns {Promise<Profile | undefined>} */
export async function getProfile() {
  const db = await getDB();
  return db.get(STORES.PROFILE, SINGLETON_KEYS.PROFILE);
}

/**
 * Crea o sostituisce il profilo. `createdAt` viene conservato se già esiste.
 * @param {Omit<Profile, 'id'|'createdAt'|'updatedAt'>} data
 * @returns {Promise<Profile>}
 */
export async function saveProfile(data) {
  const db = await getDB();
  const existing = await db.get(STORES.PROFILE, SINGLETON_KEYS.PROFILE);
  const profile = {
    ...data,
    id: SINGLETON_KEYS.PROFILE,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
  };
  await db.put(STORES.PROFILE, profile);
  return profile;
}

/**
 * Vero se il disclaimer è stato accettato: è la condizione che sblocca l'app
 * (spec 1.3 e 7.3).
 * @returns {Promise<boolean>}
 */
export async function hasAcceptedDisclaimer() {
  const profile = await getProfile();
  return Boolean(profile?.disclaimerAcceptedAt);
}

// ---- exercises -----------------------------------------------------------

/** @returns {Promise<object[]>} */
export async function getAllExercises() {
  const db = await getDB();
  return db.getAll(STORES.EXERCISES);
}

/**
 * @param {string} id
 * @returns {Promise<object | undefined>}
 */
export async function getExercise(id) {
  const db = await getDB();
  return db.get(STORES.EXERCISES, id);
}

/**
 * Riempie il catalogo al primo avvio. Sostituisce l'intero contenuto: il
 * catalogo appartiene all'app, non all'utente, e non viene mai esportato.
 * @param {object[]} exercises
 */
export async function seedExercises(exercises) {
  const db = await getDB();
  const tx = db.transaction(STORES.EXERCISES, 'readwrite');
  await tx.store.clear();
  await Promise.all(exercises.map((exercise) => tx.store.put(exercise)));
  await tx.done;
}

// ---- programs ------------------------------------------------------------

/** @returns {Promise<object | undefined>} il programma attivo, se esiste */
export async function getActiveProgram() {
  const db = await getDB();
  const programs = await db.getAllFromIndex(
    STORES.PROGRAMS,
    'by-status',
    'active'
  );
  // Se per qualche ragione ce ne fosse più di uno, vince il più recente.
  return programs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/**
 * @param {string} id
 * @returns {Promise<object | undefined>}
 */
export async function getProgram(id) {
  const db = await getDB();
  return db.get(STORES.PROGRAMS, id);
}

/**
 * @param {object} program
 * @returns {Promise<object>}
 */
export async function saveProgram(program) {
  const db = await getDB();
  await db.put(STORES.PROGRAMS, program);
  return program;
}

// ---- sessions ------------------------------------------------------------

/**
 * @param {string} programId
 * @returns {Promise<object[]>} ordinate dalla più vecchia alla più recente
 */
export async function getSessionsForProgram(programId) {
  const db = await getDB();
  const sessions = await db.getAllFromIndex(
    STORES.SESSIONS,
    'by-program',
    programId
  );
  return sessions.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/**
 * Sessioni di uno specifico giorno del programma: è la base della riga
 * "ultima volta" (7.1) e delle regole sulle sessioni saltate (4.4).
 * @param {string} programId
 * @param {number} dayIndex
 * @returns {Promise<object[]>} ordinate dalla più vecchia alla più recente
 */
export async function getSessionsForDay(programId, dayIndex) {
  const db = await getDB();
  const sessions = await db.getAllFromIndex(STORES.SESSIONS, 'by-program-day', [
    programId,
    dayIndex,
  ]);
  return sessions.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/** @returns {Promise<object | undefined>} la sessione lasciata a metà, se c'è */
export async function getInProgressSession() {
  const db = await getDB();
  const sessions = await db.getAllFromIndex(
    STORES.SESSIONS,
    'by-status',
    'in-progress'
  );
  return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
}

/**
 * Salva la sessione. Va chiamata a ogni serie: la sessione in corso deve
 * sopravvivere alla chiusura del browser (spec 7.2).
 * @param {object} session
 * @returns {Promise<object>}
 */
export async function saveSession(session) {
  const db = await getDB();
  await db.put(STORES.SESSIONS, session);
  return session;
}

// ---- measurements --------------------------------------------------------

/** @returns {Promise<object[]>} ordinate per data crescente */
export async function getMeasurements() {
  const db = await getDB();
  const measurements = await db.getAllFromIndex(
    STORES.MEASUREMENTS,
    'by-date'
  );
  return measurements;
}

/**
 * @param {object} measurement
 * @returns {Promise<object>}
 */
export async function saveMeasurement(measurement) {
  const db = await getDB();
  const record = { ...measurement, id: measurement.id ?? newId() };
  await db.put(STORES.MEASUREMENTS, record);
  return record;
}

/** @param {string} id */
export async function deleteMeasurement(id) {
  const db = await getDB();
  await db.delete(STORES.MEASUREMENTS, id);
}

// ---- exerciseNotes -------------------------------------------------------

/**
 * @param {string} exerciseId
 * @returns {Promise<object | undefined>}
 */
export async function getExerciseNote(exerciseId) {
  const db = await getDB();
  return db.get(STORES.EXERCISE_NOTES, exerciseId);
}

/**
 * Nota personale per un esercizio: max 200 caratteri (spec 2.6). Con testo
 * vuoto la nota viene cancellata.
 * @param {string} exerciseId
 * @param {string} text
 * @returns {Promise<object | null>}
 */
export async function saveExerciseNote(exerciseId, text) {
  const db = await getDB();
  const trimmed = text.trim().slice(0, 200);
  if (!trimmed) {
    await db.delete(STORES.EXERCISE_NOTES, exerciseId);
    return null;
  }
  const note = { exerciseId, text: trimmed, updatedAt: now() };
  await db.put(STORES.EXERCISE_NOTES, note);
  return note;
}

/** @returns {Promise<object[]>} */
export async function getAllExerciseNotes() {
  const db = await getDB();
  return db.getAll(STORES.EXERCISE_NOTES);
}

// ---- settings ------------------------------------------------------------

/** @returns {Promise<Settings>} le impostazioni salvate, o quelle di default */
export async function getSettings() {
  const db = await getDB();
  const settings = await db.get(STORES.SETTINGS, SINGLETON_KEYS.SETTINGS);
  return settings ?? { ...DEFAULT_SETTINGS };
}

/**
 * @param {Partial<Settings>} patch
 * @returns {Promise<Settings>}
 */
export async function saveSettings(patch) {
  const db = await getDB();
  const current = await getSettings();
  const settings = { ...current, ...patch, id: SINGLETON_KEYS.SETTINGS };
  await db.put(STORES.SETTINGS, settings);
  return settings;
}
