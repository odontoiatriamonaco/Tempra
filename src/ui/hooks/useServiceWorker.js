// Tempra v1.0.0 — 2026-09-04 14:30
//
// Registrazione del service worker e prompt di aggiornamento (spec 8).
//
// Il service worker esiste solo nella build di produzione: in sviluppo
// servirebbe file in cache al posto di quelli appena modificati.

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * @returns {{ updateReady: boolean, applyUpdate: () => void }}
 */
export function useServiceWorker() {
  const [waiting, setWaiting] = useState(null);

  /**
   * Vero solo dopo che l'utente ha premuto "Ricarica". Senza questa guardia,
   * al primo avvio il service worker prende il controllo (`clients.claim()`),
   * scatta `controllerchange` e la pagina si ricarica da sola: chi è a metà
   * onboarding si ritrova sul disclaimer, con le risposte perse.
   */
  const updateRequested = useRef(false);

  useEffect(() => {
    if (import.meta.env.DEV) return undefined;
    if (!('serviceWorker' in navigator)) return undefined;

    let cancelled = false;

    const watch = (candidate) => {
      if (!candidate || cancelled) return;
      setWaiting(candidate);
    };

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        if (cancelled) return;

        // Una versione nuova è già pronta e attende che si liberi il posto.
        watch(reg.waiting);

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            // `controller` esiste solo se un service worker sta già servendo
            // la pagina: senza, questa è la prima installazione, non un
            // aggiornamento, e non c'è niente da chiedere all'utente.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              watch(installing);
            }
          });
        });
      })
      .catch(() => {
        // Senza service worker l'app funziona, solo non offline.
      });

    // La pagina si ricarica solo se l'aggiornamento l'ha chiesto l'utente, e
    // una volta sola: la seconda guardia evita il ciclo infinito.
    let reloading = false;
    const onControllerChange = () => {
      if (!updateRequested.current || reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    updateRequested.current = true;
    waiting?.postMessage('skip-waiting');
  }, [waiting]);

  return { updateReady: waiting !== null, applyUpdate };
}
