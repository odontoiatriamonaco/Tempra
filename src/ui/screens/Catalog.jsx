// Tempra v0.7.0 — 2026-09-04 13:20
//
// Catalogo esercizi (spec 7.1): lista filtrabile per gruppo muscolare —
// toccando la mappa — e per schema di movimento.

import { useMemo, useState } from 'react';
import { MUSCLE_LABELS, TIER_LABELS, UI_STRINGS } from '../../data/strings.it.js';
import { ISOLATION_PATTERNS, MULTI_JOINT_PATTERNS } from '../../data/taxonomy.js';
import { useAppState } from '../hooks/useAppState.js';
import MuscleMap from '../components/MuscleMap.jsx';

const PATTERN_GROUPS = [
  { key: 'multi', patterns: MULTI_JOINT_PATTERNS },
  { key: 'iso', patterns: [...ISOLATION_PATTERNS, 'core'] },
];

export default function Catalog() {
  const { loading, catalog } = useAppState();
  const [muscle, setMuscle] = useState(null);
  const [pattern, setPattern] = useState(null);
  const [openId, setOpenId] = useState(null);

  const filtered = useMemo(() => {
    return catalog
      .filter((exercise) => {
        if (muscle && !exercise.primaryMuscles.includes(muscle)) return false;
        if (pattern && exercise.pattern !== pattern) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, muscle, pattern]);

  // I gruppi che il filtro sta selezionando: la mappa li accende.
  const highlights = useMemo(
    () => (muscle ? { [muscle]: 'primary' } : {}),
    [muscle]
  );

  if (loading) return <p className="muted">{UI_STRINGS.app.loading}</p>;

  return (
    <div className="stack">
      <h1>{UI_STRINGS.nav.catalog}</h1>

      <div className="card stack">
        <p className="muted">{UI_STRINGS.catalog.tapMap}</p>
        <MuscleMap highlights={highlights} onSelect={(value) => setMuscle(value === muscle ? null : value)} />
        {muscle && (
          <button type="button" className="button button--ghost" onClick={() => setMuscle(null)}>
            {UI_STRINGS.catalog.clearMuscle.replace('{n}', MUSCLE_LABELS[muscle])}
          </button>
        )}
      </div>

      <div className="card stack">
        <p className="muted">{UI_STRINGS.catalog.byPattern}</p>
        {PATTERN_GROUPS.map((group) => (
          <div key={group.key} className="chips">
            {group.patterns.map((value) => (
              <button
                key={value}
                type="button"
                className="chip"
                aria-pressed={pattern === value}
                onClick={() => setPattern(pattern === value ? null : value)}
              >
                {value}
              </button>
            ))}
          </div>
        ))}
      </div>

      <p className="muted num">
        {filtered.length} {UI_STRINGS.catalog.results}
      </p>

      {filtered.map((exercise) => (
        <section key={exercise.id} className="exercise card">
          <button
            type="button"
            className="exercise__header"
            aria-expanded={openId === exercise.id}
            onClick={() => setOpenId(openId === exercise.id ? null : exercise.id)}
          >
            <span className="exercise__name">{exercise.name}</span>
            <span className="exercise__meta muted">{TIER_LABELS[exercise.tier]}</span>
            <span className="exercise__status">{exercise.pattern}</span>
          </button>

          {openId === exercise.id && (
            <div className="exercise__body stack">
              {exercise.images.length > 0 && (
                <div className="exercise__images">
                  {exercise.images.map((src, index) => (
                    <img
                      key={src}
                      src={src}
                      alt={`${exercise.name} — ${index === 0 ? UI_STRINGS.session.imageStart : UI_STRINGS.session.imageEnd}`}
                      loading="lazy"
                      width="600"
                      height="400"
                    />
                  ))}
                </div>
              )}

              <ul className="cues">
                {exercise.cues.map((cue) => (
                  <li key={cue}>{cue}</li>
                ))}
              </ul>

              <MuscleMap
                className="muscle-map--small"
                highlights={{
                  ...Object.fromEntries(exercise.primaryMuscles.map((m) => [m, 'primary'])),
                  ...Object.fromEntries(
                    exercise.secondaryMuscles.map((m) => [m, 'secondary'])
                  ),
                }}
              />

              <p className="muted">
                {exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')}
              </p>

              <p className="muted chart__note">
                {UI_STRINGS.catalog.license}: {exercise.license.source} —{' '}
                {exercise.license.type}
              </p>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
