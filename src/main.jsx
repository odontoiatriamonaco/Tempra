// Tempra v0.1.0 — 2026-09-04 08:24

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { getSettings } from './db/repo.js';
import './styles/base.css';

/**
 * Applica il tema salvato prima del primo render, così non si vede il lampo
 * del tema sbagliato. 'system' non scrive nulla: decide prefers-color-scheme.
 * @returns {Promise<void>}
 */
function applyStoredTheme() {
  return getSettings()
    .then(({ theme }) => {
      if (theme === 'light' || theme === 'dark') {
        document.documentElement.dataset.theme = theme;
      }
    })
    .catch(() => {
      // Se IndexedDB non è disponibile l'app resta usabile con il tema di
      // sistema: una preferenza mancante non è un motivo per non partire.
    });
}

function render() {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

// Niente top-level await: il target di build include browser che non lo
// supportano, e il render non deve dipendere dalla riuscita della lettura.
applyStoredTheme().then(render);
