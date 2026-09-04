<!-- Tempra v0.1.0 — 2026-09-04 08:24 -->

# Decisioni di implementazione

Registro delle scelte prese dove la spec lasciava spazio (sezione 0: «quando un
requisito è ambiguo, scegli l'opzione più semplice e annotala qui»). Una voce
per decisione, in ordine cronologico.

---

## Fase 0 — Scaffolding

### D-001 · Dipendenze fuori dalla sezione 9

Aggiunte quattro devDependencies non elencate nella spec, motivate anche in
`package.json` sotto `_dependencyNotes` (JSON non ammette commenti):

- `eslint`, `@eslint/js`, `eslint-plugin-react`, `eslint-plugin-react-hooks`,
  `globals` — la sezione 10 prescrive `lint` in CI a ogni push.
- `fake-indexeddb` — IndexedDB non esiste in Node, serve per testare
  `src/db/schema.js` con Vitest.
- `@vitejs/plugin-react` — necessario a Vite per il JSX, implicito nella
  sezione 9.
- `@playwright/test` — è il pacchetto con cui si installa Playwright.

Nessuna dipendenza a runtime oltre a `react`, `react-dom`, `idb`.

### D-002 · Configurazione di Vitest dentro `vite.config.js`

Anziché un `vitest.config.js` separato. Un file in meno e nessun rischio che le
due configurazioni divergano.

### D-003 · Migrazioni del database come array di passi

`src/db/schema.js` tiene le migrazioni in un array ordinato per versione di
arrivo, e `migrationsFor(oldVersion, newVersion)` seleziona i passi da eseguire.
Per la versione 1 sarebbe bastato un `if`, ma così una versione futura si
aggiunge in fondo senza toccare quelle esistenti, ed è testabile senza aprire un
database vero.

### D-004 · Indice `by-program-day` sulle sessioni

Aggiunto un indice composito `['programId', 'dayIndex']` non richiesto
esplicitamente dalla spec. Lo usano la riga "ultima volta" (7.1) e le regole
sulle sessioni saltate (4.4), che ragionano sempre per giorno del programma:
senza indice servirebbe una scansione completa delle sessioni a ogni apertura.

### D-005 · Tema scuro duplicato in `[data-theme='dark']`

`tokens.css` ripete i token del tema scuro sia in
`@media (prefers-color-scheme: dark)` sia in `:root[data-theme='dark']`. La
duplicazione è voluta: `Settings.theme` (2.7) permette di forzare il tema
indipendentemente dal sistema, e la variante `@media` da sola non lo consente.
Nessuna dipendenza da preprocessori CSS.

### D-006 · Skill `frontend-design` non disponibile

La sezione 7 chiede di consultare la skill `frontend-design` prima di definire
tipografia e palette. La skill non è disponibile in questo ambiente. La palette
di `tokens.css` è stata costruita a mano su tre principi: font di sistema, un
solo accento, contrasti verificati per AA in entrambi i temi (i rapporti sono
annotati nei commenti del file). Da rivedere se la skill diventa disponibile.

### D-007 · Onboarding di Fase 0 senza accettazione

`Onboarding.jsx` in Fase 0 mostra il testo del disclaimer ma non scrive il
profilo: le quattro domande e l'accettazione sono di Fase 3. Di conseguenza la
guardia in `App.jsx` tiene l'app ferma sull'onboarding. Non è un bug ed è
verificato dal test end-to-end: è il criterio 7.3 («non è possibile arrivare
alla Home senza `disclaimerAcceptedAt` valorizzato») già in vigore.

### D-008 · `no-restricted-globals` su `fetch`

Regola ESLint che vieta `fetch` nel codice dell'app. Il requisito 1.3 («nessun
byte lascia il dispositivo») è verificato in modo definitivo dal test Playwright
di 10.6, ma quello gira solo sulle PR: la regola di lint lo intercetta subito.
Esentati test, script di import e — in prospettiva — `sw.js`, che deve
precachare gli asset dell'app.

### D-009 · `vercel.json` già in Fase 0

Il deploy è di Fase 7, ma la CSP di `vercel.json` è un requisito non negoziabile
(1.3). Metterla subito costa nulla e impedisce che una richiesta di rete entri
inosservata durante lo sviluppo. Aggiunti anche `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy` e `frame-ancestors 'none'`.

### D-010 · Playwright solo sulle PR verso `main`

La sezione 10 prescrive «Playwright + Lighthouse su PR verso main»: la CI segue
alla lettera. Sui push girano lint, Vitest e build, che sono veloci. Lighthouse
entrerà in CI in Fase 7, quando ci sarà una PWA da misurare.

### D-011 · Il repository si chiama `Tempra` con la maiuscola

Nome della cartella e del repository GitHub: `Tempra`. Il campo `name` in
`package.json` resta `tempra` minuscolo perché npm non ammette maiuscole.
