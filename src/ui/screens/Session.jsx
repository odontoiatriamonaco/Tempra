// Tempra v0.6.0 — 2026-09-04 13:00
//
// La sessione guidata (spec 7.1). Ogni serie chiusa viene scritta subito su
// IndexedDB: chiudere il browser a metà seduta non deve costare nulla (7.2).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DISCLAIMER, UI_STRINGS } from '../../data/strings.it.js';
import { getWeekPlan } from '../../engine/week.js';
import { getScheduleState } from '../../engine/schedule.js';
import { applyPendingAdjustment, slotStatus } from '../../engine/session.js';
import { reduceSession } from '../../engine/reduce.js';
import {
  getSettings,
  newId,
  now,
  saveSession,
} from '../../db/repo.js';
import { useAppState } from '../hooks/useAppState.js';
import { useRestTimer } from '../hooks/useRestTimer.js';
import { navigate, ROUTES } from '../hooks/useHashRoute.js';
import BottomSheet from '../components/BottomSheet.jsx';
import ExerciseCard from '../components/ExerciseCard.jsx';
import PlateCalculator from '../components/PlateCalculator.jsx';
import RestTimer from '../components/RestTimer.jsx';

/** Durate proposte dal selettore "poco tempo" (spec 5). */
const SHORT_MINUTES = [20, 30, 45];

export default function Session({ params }) {
  const requestedDay = Number.parseInt(params?.[0] ?? '', 10);
  const { loading, program, profile, sessions, byId } = useAppState();

  const [session, setSession] = useState(null);
  const [expandedSlotId, setExpandedSlotId] = useState(null);
  const [plateWeight, setPlateWeight] = useState(null);
  const [substituteFor, setSubstituteFor] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [settings, setSettings] = useState({
    restTimerSound: true,
    restTimerVibrate: true,
    autoStartRestTimer: true,
  });

  const timer = useRestTimer({
    sound: settings.restTimerSound,
    vibrate: settings.restTimerVibrate,
  });

  useEffect(() => {
    getSettings().then(setSettings).catch(() => {});
  }, []);

  const schedule = useMemo(
    () => (program ? getScheduleState(program, sessions) : null),
    [program, sessions]
  );

  const dayIndex = Number.isInteger(requestedDay)
    ? requestedDay
    : (schedule?.nextDayIndex ?? 0);

  // Riprende la seduta lasciata a metà per questo giorno, o ne apre una nuova.
  useEffect(() => {
    if (!program || !schedule || session) return;
    const existing = sessions.find(
      (candidate) =>
        candidate.status === 'in-progress' &&
        candidate.dayIndex === dayIndex &&
        candidate.weekIndex === schedule.weekIndex
    );
    if (existing) {
      setSession(existing);
      return;
    }
    setSession({
      id: newId(),
      programId: program.id,
      dayIndex,
      weekIndex: schedule.weekIndex,
      startedAt: now(),
      endedAt: null,
      status: 'in-progress',
      reducedToMinutes: null,
      substitutions: {},
      sets: [],
      feedback: null,
    });
  }, [program, schedule, sessions, session, dayIndex]);

  const persist = useCallback(async (next) => {
    setSession(next);
    await saveSession(next);
  }, []);

  const completeSet = useCallback(
    async (entry) => {
      const log = { ...entry, completedAt: now() };
      await persist({ ...session, sets: [...session.sets, log] });

      if (settings.autoStartRestTimer && !entry.isWarmup) {
        // Il recupero è quello dello slot: si rilegge dal programma invece di
        // dipendere da variabili calcolate più in basso nel render.
        const slot = getWeekPlan(program, session.weekIndex)
          .days.find((day) => day.index === session.dayIndex)
          ?.slots.find((candidate) => candidate.id === entry.slotId);
        timer.start(slot?.restSec ?? 90);
      }
    },
    [program, session, persist, settings.autoStartRestTimer, timer]
  );

  const substitute = useCallback(
    async (slotId, exerciseId) => {
      await persist({
        ...session,
        substitutions: { ...session.substitutions, [slotId]: exerciseId },
      });
      setSubstituteFor(null);
    },
    [session, persist]
  );

  const endSession = useCallback(async () => {
    await persist({ ...session, endedAt: now() });
    navigate(ROUTES.SESSION_END, session.id);
  }, [session, persist]);

  if (loading || !program || !session || !schedule) {
    return <p className="muted">{UI_STRINGS.app.loading}</p>;
  }

  const plan = getWeekPlan(program, session.weekIndex);
  const planned = plan.days.find((candidate) => candidate.index === session.dayIndex);
  if (!planned) return <p className="muted">{UI_STRINGS.common.notFound}</p>;

  // Prima l'aggiustamento una tantum lasciato dal feedback della volta scorsa
  // (4.3), poi l'eventuale riduzione richiesta oggi (sezione 5).
  const adjusted = applyPendingAdjustment(
    planned,
    program.pendingAdjustments?.[session.dayIndex]
  );
  const day = session.reducedToMinutes
    ? reduceSession(adjusted, session.reducedToMinutes)
    : adjusted;

  const daySlots = day.slots;
  const level = profile?.level ?? 'intermediate';

  /** L'esercizio effettivo dello slot: il sostituto se c'è, altrimenti quello previsto. */
  const exerciseFor = (slot) =>
    byId.get(session.substitutions?.[slot.id] ?? slot.exerciseId);

  const remaining = daySlots.filter((slot) => slotStatus(slot, session.sets) !== 'done');
  const substituteSlot = daySlots.find((slot) => slot.id === substituteFor);

  return (
    <div className="stack session">
      <header className="row">
        <h1>{day.label}</h1>
        <span className="muted num">
          {UI_STRINGS.home.weekLabel} {session.weekIndex + 1} · RIR {plan.targetRIR}
        </span>
      </header>

      <ShortOnTime
        current={session.reducedToMinutes}
        estimatedMinutes={Math.round(day.estimatedSeconds / 60) + 8}
        overTarget={day.overTarget}
        disabled={session.sets.length > 0}
        onChoose={(minutes) => persist({ ...session, reducedToMinutes: minutes })}
      />

      {daySlots.map((slot) => {
        const exercise = exerciseFor(slot);
        if (!exercise) return null;
        return (
          <ExerciseCard
            key={slot.id}
            slot={slot}
            exercise={exercise}
            level={level}
            logs={session.sets}
            sessions={sessions}
            sessionId={session.id}
            expanded={expandedSlotId === slot.id}
            onToggle={() =>
              setExpandedSlotId((current) => (current === slot.id ? null : slot.id))
            }
            onComplete={completeSet}
            onShowPlates={setPlateWeight}
            onSubstitute={() => setSubstituteFor(slot.id)}
          />
        );
      })}

      <button
        type="button"
        className="button button--primary"
        onClick={() => (remaining.length > 0 ? setConfirmEnd(true) : endSession())}
      >
        {UI_STRINGS.session.endSession}
      </button>

      <p className="disclaimer-short">{DISCLAIMER.short}</p>

      <RestTimer
        secondsLeft={timer.secondsLeft}
        totalSeconds={timer.totalSeconds}
        onAdjust={timer.adjust}
        onSkip={timer.skip}
      />

      {plateWeight !== null && (
        <BottomSheet
          open
          title={UI_STRINGS.plates.title}
          onClose={() => setPlateWeight(null)}
        >
          <PlateCalculator weightKg={plateWeight} onClose={() => setPlateWeight(null)} />
        </BottomSheet>
      )}

      <BottomSheet
        open={Boolean(substituteSlot)}
        title={UI_STRINGS.session.substituteTitle}
        onClose={() => setSubstituteFor(null)}
      >
        <ul className="daylist">
          {(byId.get(substituteSlot?.exerciseId)?.substitutes ?? []).map((id) => {
            const option = byId.get(id);
            if (!option) return null;
            return (
              <li key={id}>
                <button
                  type="button"
                  className="daylist__item"
                  onClick={() => substitute(substituteSlot.id, id)}
                >
                  <span>{option.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>

      <BottomSheet
        open={confirmEnd}
        title={UI_STRINGS.session.confirmEndTitle}
        onClose={() => setConfirmEnd(false)}
      >
        <p>
          {UI_STRINGS.session.confirmEndBody.replace('{n}', String(remaining.length))}
        </p>
        <button type="button" className="button button--primary" onClick={endSession}>
          {UI_STRINGS.session.confirmEnd}
        </button>
      </BottomSheet>
    </div>
  );
}

/**
 * Selettore "poco tempo" (spec 5). Chiuso di default, e non più modificabile
 * una volta iniziata la seduta: togliere esercizi già fatti non avrebbe senso.
 */
function ShortOnTime({ current, estimatedMinutes, overTarget, disabled, onChoose }) {
  const [open, setOpen] = useState(false);

  if (current) {
    return (
      <p className="shorttime__active">
        {UI_STRINGS.session.reducedTo.replace('{n}', String(current))}{' '}
        <span className="num">≈ {estimatedMinutes} {UI_STRINGS.common.minutes}</span>
        {overTarget && ` — ${UI_STRINGS.session.reducedOver}`}
      </p>
    );
  }

  if (disabled) return null;

  if (!open) {
    return (
      <button type="button" className="button button--ghost" onClick={() => setOpen(true)}>
        {UI_STRINGS.session.shortOnTime}
      </button>
    );
  }

  return (
    <div className="stack">
      <p className="muted">{UI_STRINGS.session.shortOnTimeQuestion}</p>
      <div className="choice choice--compact">
        {SHORT_MINUTES.map((minutes) => (
          <button
            key={minutes}
            type="button"
            className="choice__option"
            onClick={() => onChoose(minutes)}
          >
            <span className="choice__title">{minutes}</span>
          </button>
        ))}
      </div>
      <button type="button" className="button button--ghost" onClick={() => setOpen(false)}>
        {UI_STRINGS.common.cancel}
      </button>
    </div>
  );
}
