// Tempra v0.4.0 — 2026-09-04 11:30
//
// Preparazione del database al primo avvio: il catalogo esercizi vive nel
// codice (spec 2.8) e viene copiato in IndexedDB la prima volta, così tutto il
// resto dell'app legge da un'unica fonte.

import catalog from '../data/exercises.json';
import { getAllExercises, seedExercises } from './repo.js';

/**
 * Copia il catalogo in IndexedDB se non c'è, o se è di una versione diversa.
 * Il confronto è sul numero di esercizi: il catalogo non cambia mai in
 * risposta all'utente, solo con un aggiornamento dell'app.
 *
 * @returns {Promise<object[]>} il catalogo, pronto all'uso
 */
export async function ensureCatalogSeeded() {
  const existing = await getAllExercises();
  if (existing.length === catalog.length) return existing;
  await seedExercises(catalog);
  return getAllExercises();
}

/** Il catalogo come arriva dal codice, senza passare dal database. */
export { catalog };
