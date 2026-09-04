// Tempra v1.0.0 — 2026-09-04 14:30
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { CACHE_NAME } from './src/version.js';

const root = fileURLToPath(new URL('.', import.meta.url));

/** Tutti i file dentro `dir`, come percorsi relativi con la barra iniziale. */
function walk(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue; // .gitkeep e simili non sono asset
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push(`/${relative(base, full).split('\\').join('/')}`);
  }
  return out;
}

/**
 * Emette `sw.js` a partire dal modello alla radice, sostituendo il nome della
 * cache e la lista degli asset da precaricare.
 *
 * La lista si costruisce alla build perché è l'unico momento in cui si
 * conoscono i nomi con l'hash: scriverli a mano nel service worker
 * significherebbe servire per sempre la versione vecchia dopo un aggiornamento.
 */
function serviceWorkerPlugin() {
  return {
    name: 'tempra-service-worker',
    apply: 'build',
    // Dopo il plugin di Vite che emette index.html: con l'ordine predefinito
    // `generateBundle` gira prima, e la shell resterebbe fuori dal precache.
    enforce: 'post',
    generateBundle(_options, bundle) {
      const fromBundle = Object.keys(bundle)
        .filter((name) => !name.endsWith('.map'))
        .map((name) => `/${name}`);

      const fromPublic = walk(join(root, 'public'));

      const precache = [
        ...new Set(['/', '/index.html', ...fromBundle, ...fromPublic]),
      ].sort();

      const template = readFileSync(join(root, 'sw.js'), 'utf8');
      const source = template
        .replace('__CACHE_NAME__', CACHE_NAME)
        .replace('__PRECACHE__', JSON.stringify(precache, null, 2));

      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorkerPlugin()],
  server: { port: 5173 },
  build: { outDir: 'dist', sourcemap: 'hidden' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js', 'tests/**/*.test.jsx'],
    exclude: ['tests/e2e/**'],
  },
});
