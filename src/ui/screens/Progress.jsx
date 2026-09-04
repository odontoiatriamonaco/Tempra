// Tempra v0.7.0 — 2026-09-04 13:20
//
// Progressi (spec 7.1): carico per esercizio, e misure facoltative.
//
// Nessun commento automatico sui valori: l'app mostra i numeri e tace. Un
// giudizio su un peso corporeo che scende o sale sarebbe esattamente il tipo
// di cosa che la sezione 1.2 tiene fuori.

import { useEffect, useMemo, useState } from 'react';
import { UI_STRINGS } from '../../data/strings.it.js';
import { e1rm } from '../../engine/e1rm.js';
import {
  deleteMeasurement,
  getMeasurements,
  newId,
  saveMeasurement,
} from '../../db/repo.js';
import { useAppState } from '../hooks/useAppState.js';
import { ChartBars, ChartLine } from '../components/Chart.jsx';

/** Campi delle misure, nell'ordine in cui compaiono (spec 2.5). */
const MEASURE_FIELDS = [
  { key: 'bodyweightKg', unit: 'kg', step: 0.1 },
  { key: 'waistCm', unit: 'cm', step: 0.5 },
  { key: 'chestCm', unit: 'cm', step: 0.5 },
  { key: 'hipsCm', unit: 'cm', step: 0.5 },
  { key: 'armCm', unit: 'cm', step: 0.5 },
  { key: 'thighCm', unit: 'cm', step: 0.5 },
];

/**
 * Per ogni sessione completata in cui l'esercizio compare: il carico di lavoro
 * più alto e il miglior e1RM.
 *
 * @param {ReadonlyArray<object>} sessions
 * @param {string} exerciseId
 * @returns {Array<{ label: string, workingKg: number, e1rmKg: number }>}
 */
export function loadHistory(sessions, exerciseId) {
  return sessions
    .filter((session) => session.status === 'completed')
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((session, index) => {
      const logs = (session.sets ?? []).filter(
        (log) => log.exerciseId === exerciseId && !log.isWarmup
      );
      if (logs.length === 0) return null;
      return {
        label: `${index + 1}`,
        date: session.startedAt.slice(0, 10),
        workingKg: Math.max(...logs.map((log) => log.weightKg)),
        e1rmKg: Math.max(...logs.map((log) => e1rm(log.weightKg, log.reps))),
      };
    })
    .filter(Boolean)
    .map((entry, index) => ({ ...entry, label: `${index + 1}` }));
}

export default function Progress() {
  const { loading, sessions, byId } = useAppState();
  const [exerciseId, setExerciseId] = useState(null);

  // Solo gli esercizi con almeno due sedute: con una sola non c'è andamento
  // da mostrare, e un grafico a un punto è una bugia grafica (spec 7.1).
  const trackable = useMemo(() => {
    const counts = new Map();
    for (const session of sessions) {
      if (session.status !== 'completed') continue;
      const seen = new Set(
        (session.sets ?? []).filter((log) => !log.isWarmup).map((log) => log.exerciseId)
      );
      for (const id of seen) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count >= 2)
      .map(([id]) => byId.get(id))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions, byId]);

  const selected = exerciseId ?? trackable[0]?.id ?? null;
  const history = useMemo(
    () => (selected ? loadHistory(sessions, selected) : []),
    [sessions, selected]
  );

  if (loading) return <p className="muted">{UI_STRINGS.app.loading}</p>;

  return (
    <div className="stack">
      <h1>{UI_STRINGS.nav.progress}</h1>

      {trackable.length === 0 ? (
        <p className="muted">{UI_STRINGS.progress.notEnough}</p>
      ) : (
        <div className="card stack">
          <label className="muted" htmlFor="exercise-picker">
            {UI_STRINGS.progress.pickExercise}
          </label>
          <select
            id="exercise-picker"
            className="select"
            value={selected ?? ''}
            onChange={(event) => setExerciseId(event.target.value)}
          >
            {trackable.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>

          <Delta history={history} />

          <ChartBars
            title={UI_STRINGS.progress.workingLoad}
            unit="kg"
            points={history.map((entry) => ({
              label: entry.label,
              value: entry.workingKg,
              title: `${entry.date}: ${entry.workingKg} kg`,
            }))}
          />

          <ChartLine
            title={UI_STRINGS.progress.estimatedMax}
            unit="kg"
            points={history.map((entry) => ({
              label: entry.label,
              value: entry.e1rmKg,
              title: `${entry.date}: ${entry.e1rmKg} kg`,
            }))}
          />

          <p className="muted chart__note">{UI_STRINGS.progress.e1rmNote}</p>
        </div>
      )}

      <Measurements />
    </div>
  );
}

/** Il numero che il grafico a barre, partendo da zero, non riesce a mostrare. */
function Delta({ history }) {
  if (history.length < 2) return null;
  const first = history[0].workingKg;
  const last = history[history.length - 1].workingKg;
  const delta = Math.round((last - first) * 10) / 10;
  const sign = delta > 0 ? '+' : '';

  return (
    <p className="delta">
      <span className="delta__value num">
        {sign}
        {String(delta).replace('.', ',')}
      </span>
      <span className="delta__unit">kg</span>
      <span className="delta__label muted">
        {UI_STRINGS.progress.sinceStart} ({history.length} {UI_STRINGS.progress.sessions})
      </span>
    </p>
  );
}

/** Misure facoltative (spec 2.5). Nessun calcolo derivato oltre al trend. */
function Measurements() {
  const [measurements, setMeasurements] = useState([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ date: new Date().toISOString().slice(0, 10) });

  const reload = () => getMeasurements().then(setMeasurements);
  useEffect(() => {
    reload();
  }, []);

  const save = async () => {
    const record = { id: newId(), date: draft.date };
    for (const field of MEASURE_FIELDS) {
      const value = Number.parseFloat(draft[field.key]);
      if (Number.isFinite(value) && value > 0) record[field.key] = value;
    }
    if (Object.keys(record).length <= 2) return; // solo la data: niente da salvare
    await saveMeasurement(record);
    setDraft({ date: new Date().toISOString().slice(0, 10) });
    setOpen(false);
    await reload();
  };

  const weights = measurements
    .filter((entry) => Number.isFinite(entry.bodyweightKg))
    .map((entry) => ({
      label: entry.date.slice(5),
      value: entry.bodyweightKg,
      title: `${entry.date}: ${entry.bodyweightKg} kg`,
    }));

  return (
    <div className="card stack">
      <h2>{UI_STRINGS.progress.measurements}</h2>
      <p className="muted">{UI_STRINGS.progress.measurementsHint}</p>

      {weights.length >= 2 && (
        <ChartLine title={UI_STRINGS.progress.bodyweight} unit="kg" points={weights} />
      )}

      {measurements.length > 0 && (
        <table className="measures">
          <thead>
            <tr>
              <th>{UI_STRINGS.progress.date}</th>
              {MEASURE_FIELDS.map((field) => (
                <th key={field.key}>{UI_STRINGS.progress.fields[field.key]}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {[...measurements].reverse().map((entry) => (
              <tr key={entry.id}>
                <td>{entry.date}</td>
                {MEASURE_FIELDS.map((field) => (
                  <td key={field.key} className="num">
                    {entry[field.key] ?? '—'}
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="measures__delete"
                    aria-label={UI_STRINGS.progress.deleteMeasure}
                    onClick={async () => {
                      await deleteMeasurement(entry.id);
                      await reload();
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {open ? (
        <div className="stack">
          <label className="muted" htmlFor="measure-date">
            {UI_STRINGS.progress.date}
          </label>
          <input
            id="measure-date"
            className="input"
            type="date"
            value={draft.date}
            onChange={(event) => setDraft({ ...draft, date: event.target.value })}
          />
          {MEASURE_FIELDS.map((field) => (
            <label key={field.key} className="measures__field">
              <span className="muted">
                {UI_STRINGS.progress.fields[field.key]} ({field.unit})
              </span>
              <input
                className="input num"
                type="number"
                inputMode="decimal"
                step={field.step}
                min="0"
                value={draft[field.key] ?? ''}
                onChange={(event) =>
                  setDraft({ ...draft, [field.key]: event.target.value })
                }
              />
            </label>
          ))}
          <button type="button" className="button button--primary" onClick={save}>
            {UI_STRINGS.common.save}
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => setOpen(false)}
          >
            {UI_STRINGS.common.cancel}
          </button>
        </div>
      ) : (
        <button type="button" className="button button--ghost" onClick={() => setOpen(true)}>
          {UI_STRINGS.progress.addMeasure}
        </button>
      )}
    </div>
  );
}
