// Tempra v0.3.0 — 2026-09-04 10:40
//
// Guscio dell'app: routing hash e guardia sul disclaimer.
// Finché `disclaimerAcceptedAt` non è valorizzato, l'unica rotta raggiungibile
// è l'onboarding (spec 1.3 e criterio 7.3).

import { Suspense, lazy, useEffect, useState } from 'react';
import { ROUTES, useHashRoute } from './ui/hooks/useHashRoute.js';
import { hasAcceptedDisclaimer } from './db/repo.js';
import { UI_STRINGS } from './data/strings.it.js';

import Onboarding from './ui/screens/Onboarding.jsx';
import Home from './ui/screens/Home.jsx';
import Session from './ui/screens/Session.jsx';
import SessionEnd from './ui/screens/SessionEnd.jsx';
import Progress from './ui/screens/Progress.jsx';
import Catalog from './ui/screens/Catalog.jsx';
import Settings from './ui/screens/Settings.jsx';

// Import dinamico dentro un ramo morto in produzione: così il bundle non si
// porta dietro né la pagina di debug né il catalogo esercizi che importa.
const Debug = import.meta.env.DEV ? lazy(() => import('./ui/screens/Debug.jsx')) : null;

const SCREENS = {
  [ROUTES.ONBOARDING]: Onboarding,
  [ROUTES.HOME]: Home,
  [ROUTES.SESSION]: Session,
  [ROUTES.SESSION_END]: SessionEnd,
  [ROUTES.PROGRESS]: Progress,
  [ROUTES.CATALOG]: Catalog,
  [ROUTES.SETTINGS]: Settings,
};

/** Voci della barra di navigazione, nell'ordine in cui compaiono. */
const NAV_ITEMS = [
  { route: ROUTES.HOME, label: UI_STRINGS.nav.home },
  { route: ROUTES.PROGRESS, label: UI_STRINGS.nav.progress },
  { route: ROUTES.CATALOG, label: UI_STRINGS.nav.catalog },
  { route: ROUTES.SETTINGS, label: UI_STRINGS.nav.settings },
];

export default function App() {
  const { route } = useHashRoute();
  /** null finché non sappiamo se il disclaimer è stato accettato. */
  const [accepted, setAccepted] = useState(null);

  useEffect(() => {
    let cancelled = false;
    hasAcceptedDisclaimer().then((value) => {
      if (!cancelled) setAccepted(value);
    });
    return () => {
      cancelled = true;
    };
  }, [route.name]);

  // La pagina di debug del motore esiste solo con `npm run dev`: in produzione
  // non è raggiungibile e la guardia sul disclaimer resta senza eccezioni.
  if (Debug && route.name === ROUTES.DEBUG) {
    return (
      <div className="app" data-route={ROUTES.DEBUG}>
        <main className="app__main">
          <Suspense fallback={<p className="muted">{UI_STRINGS.app.loading}</p>}>
            <Debug />
          </Suspense>
        </main>
      </div>
    );
  }

  if (accepted === null) {
    return (
      <div className="app">
        <main className="app__main">
          <p className="muted">{UI_STRINGS.app.loading}</p>
        </main>
      </div>
    );
  }

  // La guardia: senza accettazione si vede solo l'onboarding, qualunque hash.
  if (!accepted) {
    return (
      <div className="app" data-route={ROUTES.ONBOARDING}>
        <main className="app__main">
          <Onboarding onAccepted={() => setAccepted(true)} />
        </main>
      </div>
    );
  }

  const Screen = SCREENS[route.name] ?? NotFound;
  const showNav = NAV_ITEMS.some((item) => item.route === route.name);

  return (
    <div className="app" data-route={route.name}>
      <main className="app__main">
        <Screen params={route.params} />
      </main>
      {showNav && <Nav current={route.name} />}
    </div>
  );
}

function Nav({ current }) {
  return (
    <nav className="nav" aria-label={UI_STRINGS.app.name}>
      {NAV_ITEMS.map((item) => (
        <a
          key={item.route}
          className="nav__item"
          href={`#/${item.route}`}
          aria-current={item.route === current ? 'page' : undefined}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

function NotFound() {
  return (
    <div className="stack">
      <h1>{UI_STRINGS.common.notFound}</h1>
      <a href={`#/${ROUTES.HOME}`}>{UI_STRINGS.common.goHome}</a>
    </div>
  );
}
