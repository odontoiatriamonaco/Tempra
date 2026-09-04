// Tempra v0.1.0 — 2026-09-04 08:24
//
// Segnaposto di Fase 0. La schermata vera arriva nelle fasi successive.

import { UI_STRINGS } from '../../data/strings.it.js';

export default function Catalog() {
  return (
    <div className="stack">
      <h1>Catalog</h1>
      <p className="muted">{UI_STRINGS.placeholder.comingSoon}</p>
    </div>
  );
}
