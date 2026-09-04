// Tempra v0.3.0 — 2026-09-04 10:40
//
// Pagina di debug della Fase 2: stampa il programma generato per i parametri
// scelti. Non fa parte dell'app — è raggiungibile solo con `npm run dev`
// (vedi App.jsx), così la guardia sul disclaimer resta assoluta in produzione.

import { useMemo, useState } from 'react';
import catalog from '../../data/exercises.json';
import {
  generateProgram,
  sessionBudgetSeconds,
  volumeTargetFor,
} from '../../engine/generate.js';
import { getWeekPlan, WEEKS_PER_MESOCYCLE } from '../../engine/week.js';
import { GOALS, LARGE_MUSCLES, LEVELS } from '../../data/taxonomy.js';

const DAYS = [2, 3, 4, 5, 6];
const MINUTES = [30, 45, 60, 75, 90];

const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]));

export default function Debug() {
  const [goal, setGoal] = useState('hypertrophy');
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [minutesPerSession, setMinutesPerSession] = useState(60);
  const [level, setLevel] = useState('intermediate');
  const [seed, setSeed] = useState(20260904);
  const [week, setWeek] = useState(0);

  const program = useMemo(
    () =>
      generateProgram({ goal, daysPerWeek, minutesPerSession, level }, catalog, seed),
    [goal, daysPerWeek, minutesPerSession, level, seed]
  );

  const plan = getWeekPlan(program, week);
  const budget = sessionBudgetSeconds(minutesPerSession);

  return (
    <div className="stack">
      <h1>Debug del motore</h1>

      <div className="card stack">
        <Choice label="Obiettivo" value={goal} options={GOALS} onChange={setGoal} />
        <Choice label="Giorni" value={daysPerWeek} options={DAYS} onChange={setDaysPerWeek} />
        <Choice label="Minuti" value={minutesPerSession} options={MINUTES} onChange={setMinutesPerSession} />
        <Choice label="Livello" value={level} options={LEVELS} onChange={setLevel} />
        <Choice
          label="Settimana"
          value={week}
          options={Array.from({ length: WEEKS_PER_MESOCYCLE }, (_, i) => i)}
          onChange={setWeek}
          format={(w) => w + 1}
        />
        <button className="debug__seed" onClick={() => setSeed((s) => s + 1)}>
          Seed {seed} · cambia
        </button>
      </div>

      <div className="card stack">
        <p>
          Split <strong>{program.splitType}</strong> · volume applicato{' '}
          <strong>{program.effectiveLevel}</strong> · RIR target settimana{' '}
          <strong>{plan.targetRIR}</strong>
          {plan.isDeload ? ' · scarico' : ''}
        </p>
        {program.volumeNote && <p className="muted">{program.volumeNote}</p>}
        {program.volumeWarning && <p className="muted">{program.volumeWarning}</p>}
      </div>

      {plan.days.map((day) => (
        <div key={day.index} className="card stack">
          <h2>
            {day.label}{' '}
            <span className="muted num">
              ~{Math.round(day.estimatedSeconds / 60) + 8} min ·{' '}
              {Math.round((100 * day.estimatedSeconds) / budget)} % del budget
            </span>
          </h2>
          <p className="muted">{day.patterns.join(' · ')}</p>
          <table className="debug__table">
            <tbody>
              {day.slots.map((slot) => (
                <tr key={slot.id}>
                  <td>{byId.get(slot.exerciseId)?.name ?? slot.exerciseId}</td>
                  <td className="muted">{slot.tier}</td>
                  <td className="num">
                    {slot.sets}×{slot.repMin}-{slot.repMax}
                  </td>
                  <td className="num muted">{slot.restSec}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div className="card stack">
        <h2>Volume settimanale (gruppi grandi)</h2>
        <table className="debug__table">
          <tbody>
            {LARGE_MUSCLES.map((muscle) => {
              const target = volumeTargetFor(muscle, program.effectiveLevel);
              const value = program.weeklyVolume[muscle] ?? 0;
              const inRange = value >= target.min && value <= target.max;
              return (
                <tr key={muscle}>
                  <td>{muscle}</td>
                  <td className="num">{value}</td>
                  <td className="num muted">
                    {target.min}–{target.max} {inRange ? '✓' : '·'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Choice({ label, value, options, onChange, format = (v) => v }) {
  return (
    <div className="debug__row">
      <span className="muted">{label}</span>
      <div className="debug__options">
        {options.map((option) => (
          <button
            key={option}
            className="debug__option"
            aria-pressed={option === value}
            onClick={() => onChange(option)}
          >
            {format(option)}
          </button>
        ))}
      </div>
    </div>
  );
}
