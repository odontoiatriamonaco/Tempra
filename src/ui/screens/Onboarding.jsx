// Tempra v0.1.0 — 2026-09-04 08:24
//
// Fase 0: solo il testo del disclaimer, senza le quattro domande e senza
// scrittura del profilo. L'accettazione vera arriva in Fase 3 — finché non c'è,
// la guardia in App.jsx tiene l'app ferma qui, ed è il comportamento corretto.

import { DISCLAIMER, UI_STRINGS } from '../../data/strings.it.js';

export default function Onboarding() {
  return (
    <div className="stack">
      <h1>{DISCLAIMER.title}</h1>
      {DISCLAIMER.paragraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 24)}>{paragraph}</p>
      ))}
      <p className="muted">{UI_STRINGS.placeholder.comingSoon}</p>
    </div>
  );
}
