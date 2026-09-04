// Tempra v1.0.0 — 2026-09-04 14:30
//
// Service worker. Spec sezione 8.
//
// Questo file è un modello: il nome della cache e la lista degli asset da
// precaricare vengono sostituiti alla build dal plugin in vite.config.js, che
// conosce i nomi definitivi degli asset (con l'hash) e la versione dell'app.
// Per lo stesso motivo i due segnaposto qui sotto non vanno nominati nei
// commenti: la sostituzione è testuale e colpirebbe anche quelli.
//
// Strategia: **cache-first su tutto**, e solo sull'origine dell'app. Non c'è
// un caso in cui Tempra debba chiedere qualcosa alla rete: il requisito 1.3
// dice che dopo il caricamento iniziale non esce nessun byte, e questo file è
// l'ultimo posto in cui quella promessa potrebbe rompersi.

const CACHE_NAME = '__CACHE_NAME__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Una immagine mancante non deve far fallire tutta l'installazione:
      // si mette in cache quello che c'è, il resto arriverà alla prima visita.
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Niente esce dall'origine dell'app. Si risponde con un errore invece di
  // lasciar passare la richiesta: il requisito 1.3 dice che dopo il
  // caricamento iniziale non esce nessun byte, e lasciando cadere l'evento il
  // browser farebbe comunque la sua richiesta di rete.
  if (url.origin !== self.location.origin) {
    event.respondWith(Response.error());
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // `ignoreVary` non è un dettaglio: il server di anteprima risponde con
      // `Vary: Origin`, e i tag che Vite genera con l'attributo `crossorigin`
      // mandano l'header `Origin` mentre il precache non lo manda. Con il
      // comportamento predefinito, JS e CSS risultavano assenti dalla cache e
      // offline la pagina si apriva vuota. Le chiavi del precache sono URL
      // nudi, e così vanno confrontate.
      const options = { ignoreVary: true };

      // Router a hash: ogni navigazione chiede sempre lo stesso documento.
      // Si risolve subito, senza passare dalla rete.
      if (request.mode === 'navigate') {
        const shell =
          (await cache.match(request, { ...options, ignoreSearch: true })) ??
          (await cache.match('/index.html', options)) ??
          (await cache.match('/', options));
        if (shell) return shell;
      }

      const cached = await cache.match(request, options);
      if (cached) return cached;

      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') {
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        return Response.error();
      }
    })()
  );
});

// La pagina chiede l'aggiornamento immediato dopo che l'utente ha accettato
// il prompt "Nuova versione disponibile".
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
