// Tempra v0.5.0 — 2026-09-04 12:10
//
// Un esercizio dentro la sessione (spec 7.1): stato, immagini, cue, mappa
// muscolare, nota personale, sostituzione, riga "ultima volta" e serie.

import { useEffect, useState } from 'react';
import { UI_STRINGS } from '../../data/strings.it.js';
import { buildRows, lastTimeFor, slotStatus } from '../../engine/session.js';
import { getExerciseNote, saveExerciseNote } from '../../db/repo.js';
import MuscleMap from './MuscleMap.jsx';
import SetRow from './SetRow.jsx';
import { formatKg } from './PlateCalculator.jsx';

const STATUS_LABEL = {
  todo: UI_STRINGS.session.statusTodo,
  doing: UI_STRINGS.session.statusDoing,
  done: UI_STRINGS.session.statusDone,
};

export default function ExerciseCard({
  slot,
  exercise,
  level,
  logs,
  sessions,
  sessionId,
  expanded,
  onToggle,
  onComplete,
  onShowPlates,
  onSubstitute,
}) {
  const status = slotStatus(slot, logs);
  const rows = buildRows(slot, exercise);
  const lastTime = lastTimeFor(slot.id, sessions, sessionId);

  const loggedFor = (row) =>
    logs.find(
      (log) =>
        log.slotId === slot.id &&
        log.setIndex === row.setIndex &&
        log.isWarmup === row.isWarmup
    ) ?? null;

  return (
    <section className="exercise card" data-status={status}>
      <button type="button" className="exercise__header" onClick={onToggle} aria-expanded={expanded}>
        <span className="exercise__name">{exercise.name}</span>
        <span className="exercise__meta muted num">
          {slot.sets}×{slot.repMin}-{slot.repMax}
        </span>
        <span className="exercise__status" data-status={status}>
          {STATUS_LABEL[status]}
        </span>
      </button>

      {expanded && (
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
              ...Object.fromEntries(exercise.secondaryMuscles.map((m) => [m, 'secondary'])),
            }}
          />

          <PersonalNote exerciseId={exercise.id} />

          <button type="button" className="button button--ghost" onClick={onSubstitute}>
            {UI_STRINGS.session.substitute}
          </button>

          <LastTime entries={lastTime} slot={slot} />

          <div className="sets">
            {rows.map((row) => (
              <SetRow
                key={row.key}
                row={row}
                slot={slot}
                exercise={exercise}
                level={level}
                logged={loggedFor(row)}
                suggestedReps={lastTime[row.setIndex]?.reps ?? null}
                onComplete={onComplete}
                onShowPlates={onShowPlates}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function LastTime({ entries, slot }) {
  if (entries.length === 0) {
    return (
      <p className="lasttime muted">
        {UI_STRINGS.session.firstTime} {slot.repMin}-{slot.repMax}{' '}
        {UI_STRINGS.session.reps.toLowerCase()}.
      </p>
    );
  }

  return (
    <p className="lasttime muted num">
      <span className="lasttime__label">{UI_STRINGS.session.lastTime}</span>{' '}
      {entries
        .map((log) => `${formatKg(log.weightKg)} × ${log.reps} @${log.rir}`)
        .join(' · ')}
    </p>
  );
}

/** Nota personale per l'esercizio: l'unico campo di testo libero dell'app (2.6). */
function PersonalNote({ exerciseId }) {
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getExerciseNote(exerciseId).then((note) => {
      if (!cancelled) setText(note?.text ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  const save = async (value) => {
    setText(value);
    await saveExerciseNote(exerciseId, value);
  };

  if (!editing) {
    return (
      <button type="button" className="note" onClick={() => setEditing(true)}>
        {text ? (
          <span className="note__text">{text}</span>
        ) : (
          <span className="muted">{UI_STRINGS.session.addNote}</span>
        )}
      </button>
    );
  }

  return (
    <div className="note note--editing">
      <label className="muted" htmlFor={`note-${exerciseId}`}>
        {UI_STRINGS.session.noteLabel}
      </label>
      <textarea
        id={`note-${exerciseId}`}
        maxLength={200}
        rows={2}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={UI_STRINGS.session.notePlaceholder}
      />
      <button
        type="button"
        className="button button--ghost"
        onClick={async () => {
          await save(text);
          setEditing(false);
        }}
      >
        {UI_STRINGS.common.save}
      </button>
    </div>
  );
}
