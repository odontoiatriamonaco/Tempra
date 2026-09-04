// Tempra v0.1.0 — 2026-09-04 08:24
//
// Il test banale di Fase 0 per la cartella dei motori. Verifica l'unica cosa
// che esiste già: la versione è in un solo posto e ne deriva il nome della
// cache del service worker (spec sezione 0 e sezione 8).

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CACHE_NAME, VERSION } from '../../src/version.js';

describe('version', () => {
  it('espone una versione in formato semver', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('lega il nome della cache alla versione', () => {
    expect(CACHE_NAME).toBe(`tempra-v${VERSION}`);
  });

  it('coincide con la versione dichiarata in package.json', () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
    );
    expect(pkg.version).toBe(VERSION);
  });
});
