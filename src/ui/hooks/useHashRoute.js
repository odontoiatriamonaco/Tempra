// Tempra v0.1.0 — 2026-09-04 08:24
//
// Routing basato sull'hash, senza router esterni (spec sezione 9).
// Formato: #/nome-schermata/eventuale-parametro

import { useCallback, useEffect, useState } from 'react';

/** Schermate dell'app. */
export const ROUTES = Object.freeze({
  ONBOARDING: 'onboarding',
  HOME: 'home',
  SESSION: 'session',
  SESSION_END: 'session-end',
  PROGRESS: 'progress',
  CATALOG: 'catalog',
  SETTINGS: 'settings',
  DEBUG: 'debug',
});

const KNOWN_ROUTES = new Set(Object.values(ROUTES));

/**
 * Traduce un hash in rotta e parametri.
 * @param {string} hash es. '#/session/abc'
 * @returns {{ name: string, params: string[], unknown: boolean }}
 */
export function parseHash(hash) {
  const path = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (!path) return { name: ROUTES.HOME, params: [], unknown: false };

  const [name, ...params] = path.split('/');
  if (!KNOWN_ROUTES.has(name)) return { name, params, unknown: true };
  return { name, params, unknown: false };
}

/** Cambia rotta. Fuori dal hook così è usabile anche da codice non React. */
export function navigate(name, ...params) {
  const path = [name, ...params].filter(Boolean).join('/');
  window.location.hash = `#/${path}`;
}

/**
 * Rotta corrente, aggiornata a ogni `hashchange`.
 * @returns {{ route: ReturnType<typeof parseHash>, navigate: typeof navigate }}
 */
export function useHashRoute() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return { route, navigate: useCallback(navigate, []) };
}
