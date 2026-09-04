// Tempra v0.6.0 — 2026-09-04 13:00
//
// La schermata che si apre in palestra (spec 7.1): la prossima seduta, il
// punto del mesociclo, la mappa di calore della settimana, le ultime note del
// motore.

import { useMemo, useState } from 'react';
import { MUSCLE_LABELS, UI_STRINGS } from '../../data/strings.it.js';
import { LARGE_MUSCLES, MUSCLES } from '../../data/taxonomy.js';
import { buildHeatmap, getScheduleState } from '../../engine/schedule.js';
import { getWeekPlan, WEEKS_PER_MESOCYCLE } from '../../engine/week.js';
import { useAppState } from '../hooks/useAppState.js';
import { navigate, ROUTES } from '../hooks/useHashRoute.js';
import BottomSheet from '../components/BottomSheet.jsx';
import MuscleMap from '../components/MuscleMap.jsx';

export default function Home() {
  const { loading, program, sessions, byId } = useAppState();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chosenDay, setChosenDay] = useState(null);

  const schedule = useMemo(
    () => (program ? getScheduleState(program, sessions) : null),
    [program, sessions]
  );

  const heatmap = useMemo(() => {
    if (!program || !schedule) return [];
    return buildHeatmap(program, sessions, schedule.weekIndex, byId, MUSCLES);
  }, [program, sessions, schedule, byId]);

  if (loading) return <p className="muted">{UI_STRINGS.app.loading}</p>;
  if (!program || !schedule) return null;

  const plan = getWeekPlan(program, schedule.weekIndex);
  const activeDayIndex = chosenDay ?? schedule.nextDayIndex;
  const day =
    activeDayIndex === null ? null : plan.days.find((d) => d.index === activeDayIndex);
  const dayStatus = schedule.days.find((d) => d.index === activeDayIndex);

  return (
    <div className="stack">
      <h1>{UI_STRINGS.home.greeting}</h1>

      <WeekStrip
        weekIndex={schedule.weekIndex}
        targetRIR={plan.targetRIR}
        isDeload={plan.isDeload}
        completedDays={schedule.completedDays}
        totalDays={schedule.totalDays}
      />

      {day ? (
        <NextSession
          day={day}
          byId={byId}
          alreadyDone={Boolean(dayStatus?.done)}
          onChangeDay={() => setSheetOpen(true)}
        />
      ) : (
        <div className="card">
          <p>{UI_STRINGS.home.allDone}</p>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => setSheetOpen(true)}
          >
            {UI_STRINGS.home.changeDay}
          </button>
        </div>
      )}

      <EngineNotes sessions={sessions} />

      <Heatmap entries={heatmap} />

      <BottomSheet
        open={sheetOpen}
        title={UI_STRINGS.home.chooseDay}
        onClose={() => setSheetOpen(false)}
      >
        <ul className="daylist">
          {schedule.days.map((entry) => (
            <li key={entry.index}>
              <button
                type="button"
                className="daylist__item"
                aria-pressed={entry.index === activeDayIndex}
                onClick={() => {
                  setChosenDay(entry.index);
                  setSheetOpen(false);
                }}
              >
                <span>{entry.label}</span>
                <span className={entry.done ? 'daylist__done' : 'muted'}>
                  {entry.done ? UI_STRINGS.home.done : UI_STRINGS.home.todo}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </div>
  );
}

function WeekStrip({ weekIndex, targetRIR, isDeload, completedDays, totalDays }) {
  return (
    <div className="card stack">
      <p className="row">
        <span>
          {UI_STRINGS.home.weekLabel} <strong>{weekIndex + 1}</strong>{' '}
          {UI_STRINGS.home.weekOf} {WEEKS_PER_MESOCYCLE}
        </span>
        <span className="muted num">
          {UI_STRINGS.home.targetRir} {targetRIR}
        </span>
      </p>
      <ol className="weekdots" aria-label={UI_STRINGS.home.weekLabel}>
        {Array.from({ length: WEEKS_PER_MESOCYCLE }, (_, index) => (
          <li
            key={index}
            className="weekdots__dot"
            data-state={
              index < weekIndex ? 'done' : index === weekIndex ? 'current' : 'todo'
            }
          />
        ))}
      </ol>
      {isDeload && <p className="muted">{UI_STRINGS.home.deloadWeek}</p>}
      <p className="muted">
        <span className="num">
          {completedDays} {UI_STRINGS.home.weekOf} {totalDays}
        </span>{' '}
        {UI_STRINGS.home.sessionsDone}
      </p>
    </div>
  );
}

function NextSession({ day, byId, alreadyDone, onChangeDay }) {
  const mains = day.slots.filter((slot) => slot.tier !== 'accessory');

  return (
    <div className="card stack">
      <h2>{UI_STRINGS.home.nextSession}</h2>
      <p className="row">
        <strong>{day.label}</strong>
        <span className="muted num">
          ~{Math.round(day.estimatedSeconds / 60) + 8} {UI_STRINGS.common.minutes}
        </span>
      </p>

      <ul className="preview">
        {mains.map((slot) => (
          <li key={slot.id} className="preview__row">
            <span>{byId.get(slot.exerciseId)?.name ?? slot.exerciseId}</span>
            <span className="muted num">
              {slot.sets}×{slot.repMin}-{slot.repMax}
            </span>
          </li>
        ))}
      </ul>

      {alreadyDone && <p className="warning">{UI_STRINGS.home.alreadyDoneWarning}</p>}

      <button
        type="button"
        className="button button--primary"
        onClick={() => navigate(ROUTES.SESSION, String(day.index))}
      >
        {UI_STRINGS.home.start}
      </button>
      <button type="button" className="button button--ghost" onClick={onChangeDay}>
        {UI_STRINGS.home.changeDay}
      </button>
    </div>
  );
}

/** Le ultime note del motore, al massimo tre (spec 7.1). */
function EngineNotes({ sessions }) {
  const notes = useMemo(() => {
    const last = [...sessions]
      .filter((session) => session.status === 'completed')
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    return (last?.engineNotes ?? []).slice(0, 3);
  }, [sessions]);

  if (notes.length === 0) return null;

  return (
    <div className="card stack">
      <h2>{UI_STRINGS.home.notesTitle}</h2>
      <ul className="notes">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

function Heatmap({ entries }) {
  const heat = useMemo(
    () => Object.fromEntries(entries.map((entry) => [entry.muscle, entry.level])),
    [entries]
  );

  const titles = useMemo(
    () =>
      Object.fromEntries(
        entries.map((entry) => [
          entry.muscle,
          `${MUSCLE_LABELS[entry.muscle]}: ${entry.completed} ${UI_STRINGS.home.heatmapOf} ${entry.min}–${entry.max} ${UI_STRINGS.common.sets}`,
        ])
      ),
    [entries]
  );

  const total = entries.reduce((sum, entry) => sum + entry.completed, 0);

  return (
    <div className="card stack">
      <h2>{UI_STRINGS.home.heatmapTitle}</h2>
      <MuscleMap heat={heat} titles={titles} />
      {total === 0 ? (
        <p className="muted">{UI_STRINGS.home.heatmapEmpty}</p>
      ) : (
        <ul className="heatlegend">
          {entries
            .filter((entry) => LARGE_MUSCLES.includes(entry.muscle))
            .map((entry) => (
              <li key={entry.muscle} className="row">
                <span>{MUSCLE_LABELS[entry.muscle]}</span>
                <span className="muted num">
                  {entry.completed} {UI_STRINGS.home.heatmapOf} {entry.min}–{entry.max}
                </span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
