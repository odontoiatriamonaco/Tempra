// Tempra v0.1.0 — 2026-09-04 08:24

import { describe, expect, it } from 'vitest';
import { ROUTES, parseHash } from '../../src/ui/hooks/useHashRoute.js';

describe('parseHash', () => {
  it('manda alla home un hash vuoto', () => {
    for (const hash of ['', '#', '#/']) {
      expect(parseHash(hash)).toEqual({
        name: ROUTES.HOME,
        params: [],
        unknown: false,
      });
    }
  });

  it('riconosce una rotta senza parametri', () => {
    expect(parseHash('#/settings')).toEqual({
      name: ROUTES.SETTINGS,
      params: [],
      unknown: false,
    });
  });

  it('estrae i parametri dopo il nome della rotta', () => {
    expect(parseHash('#/session/abc-123')).toEqual({
      name: ROUTES.SESSION,
      params: ['abc-123'],
      unknown: false,
    });
  });

  it('ignora la barra finale', () => {
    expect(parseHash('#/catalog/')).toEqual({
      name: ROUTES.CATALOG,
      params: [],
      unknown: false,
    });
  });

  it('segnala una rotta sconosciuta invece di inventarne una', () => {
    expect(parseHash('#/qualcosa')).toMatchObject({ unknown: true });
  });
});
