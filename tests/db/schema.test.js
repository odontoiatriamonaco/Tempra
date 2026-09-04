// Tempra v0.1.0 — 2026-09-04 08:24

import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DB_NAME,
  DB_VERSION,
  STORES,
  closeDB,
  deleteDB,
  getDB,
  migrationsFor,
} from '../../src/db/schema.js';

afterEach(async () => {
  await deleteDB();
});

describe('migrationsFor', () => {
  it('esegue tutte le migrazioni su un database nuovo', () => {
    const steps = migrationsFor(0, DB_VERSION);
    expect(steps.map((s) => s.version)).toEqual([1]);
  });

  it('non esegue nulla se il database è già aggiornato', () => {
    expect(migrationsFor(DB_VERSION, DB_VERSION)).toEqual([]);
  });

  it('restituisce i passi in ordine crescente di versione', () => {
    const versions = migrationsFor(0, DB_VERSION).map((s) => s.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
  });
});

describe('getDB', () => {
  it('apre il database con nome e versione dichiarati', async () => {
    const db = await getDB();
    expect(db.name).toBe(DB_NAME);
    expect(db.version).toBe(DB_VERSION);
  });

  it('crea tutti gli store della sezione 2 della spec', async () => {
    const db = await getDB();
    const names = [...db.objectStoreNames].sort();
    expect(names).toEqual([...Object.values(STORES)].sort());
  });

  it('indicizza le sessioni per programma e giorno', async () => {
    const db = await getDB();
    const tx = db.transaction(STORES.SESSIONS);
    expect([...tx.store.indexNames].sort()).toEqual([
      'by-program',
      'by-program-day',
      'by-started',
      'by-status',
    ]);
    await tx.done;
  });

  it('riusa la stessa connessione tra due chiamate', async () => {
    const [first, second] = await Promise.all([getDB(), getDB()]);
    expect(first).toBe(second);
    await closeDB();
  });
});
