// Tempra v0.4.0 — 2026-09-04 11:30
//
// Unica fonte della versione applicativa (spec sezione 0).
// La leggono: la UI (Impostazioni), il service worker (nome della cache),
// e il file di backup JSON.

export const VERSION = '0.4.0';

/** Nome della cache del service worker, legato alla versione. */
export const CACHE_NAME = `tempra-v${VERSION}`;

/** Versione dello schema del file di backup (indipendente da VERSION). */
export const BACKUP_SCHEMA_VERSION = 1;
