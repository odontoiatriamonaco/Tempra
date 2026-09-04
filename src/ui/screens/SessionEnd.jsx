// Tempra v0.6.0 — 2026-09-04 13:00
//
// Fine sessione (spec 7.1): tre domande a pulsanti, obbligatorie, poi il
// riepilogo e le note del motore.
//
// È qui che si applica la progressione (sezione 4): il salvataggio del
// feedback è l'unico momento in cui esistono insieme le serie registrate e il
// giudizio dell'utente sulla seduta.

import { useEffect, useMemo, useState } from 'react';
import { UI_STRINGS } from '../../data/strings.it.js';
import { sessionSummary } from '../../engine/session.js';
import { applySession } from '../../engine/progress.js';
import {
  getSessionsForProgram,
  now,
  saveProgram,
  saveSession,
} from '../../db/repo.js';
import { useAppState } from '../hooks/useAppState.js';
import { navigate, ROUTES } from '../hooks/useHashRoute.js';

const QUESTIONS = [
  {
    key: 'difficulty',
    question: UI_STRINGS.feedback.difficulty,
    options: ['easy', 'right', 'hard'],
    labels: UI_STRINGS.feedback.difficultyLabels,
  },
  {
    key: 'energy',
    question: UI_STRINGS.feedback.energy,
    options: ['low', 'normal', 'high'],
    labels: UI_STRINGS.feedback.energyLabels,
  },
  {
    key: 'soreness',
    question: UI_STRINGS.feedback.soreness,
    options: ['none', 'some', 'a-lot'],
    labels: UI_STRINGS.feedback.sorenessLabels,
  },
];

export default function SessionEnd({ params }) {
  const sessionId = params?.[0];
  const { loading, program, catalog, reload } = useAppState();
  const [session, setSession] = useState(null);
  const [history, setHistory] = useState([]);
  const [answers, setAnswers] = useState({});
  const [saved, setSaved] = useState(false);
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    if (!program || !sessionId) return;
    getSessionsForProgram(program.id).then((all) => {
      const found = all.find((candidate) => candidate.id === sessionId);
      setSession(found ?? null);
      setHistory(all.filter((candidate) => candidate.id !== sessionId));
      if (found?.feedback) {
        setAnswers(found.feedback);
        setNotes(found.engineNotes ?? []);
        setSaved(true);
      }
    });
  }, [program, sessionId]);

  const summary = useMemo(() => (session ? sessionSummary(session) : null), [session]);
  const complete = QUESTIONS.every((question) => answers[question.key]);

  if (loading || !session) return <p className="muted">{UI_STRINGS.app.loading}</p>;

  const save = async () => {
    const finished = {
      ...session,
      feedback: answers,
      endedAt: session.endedAt ?? now(),
      status: 'completed',
    };

    // La progressione si applica qui, con la seduta appena chiusa: è l'unico
    // momento in cui esistono sia il feedback sia le serie (spec 4).
    const result = applySession(program, finished, history, catalog);
    finished.engineNotes = result.notes;

    await saveSession(finished);
    if (result.notes.length > 0) await saveProgram(result.program);

    setSession(finished);
    setNotes(result.notes);
    setSaved(true);
    await reload();
  };

  if (!saved) {
    return (
      <div className="stack">
        <h1>{UI_STRINGS.feedback.title}</h1>
        {QUESTIONS.map((question) => (
          <div key={question.key} className="card stack">
            <h2>{question.question}</h2>
            <div className="choice choice--compact">
              {question.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="choice__option"
                  aria-pressed={answers[question.key] === option}
                  onClick={() =>
                    setAnswers((current) => ({ ...current, [question.key]: option }))
                  }
                >
                  <span className="choice__title">{question.labels[option]}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <button
          type="button"
          className="button button--primary"
          disabled={!complete}
          onClick={save}
        >
          {UI_STRINGS.feedback.confirm}
        </button>
      </div>
    );
  }

  return (
    <div className="stack">
      <h1>{UI_STRINGS.feedback.summaryTitle}</h1>
      <div className="card stack">
        <p className="row">
          <span className="muted">{UI_STRINGS.feedback.workSets}</span>
          <strong className="num">{summary.workSets}</strong>
        </p>
        <p className="row">
          <span className="muted">{UI_STRINGS.feedback.tonnage}</span>
          <strong className="num">{summary.tonnageKg} kg</strong>
        </p>
        {summary.durationMin !== null && (
          <p className="row">
            <span className="muted">{UI_STRINGS.feedback.duration}</span>
            <strong className="num">
              {summary.durationMin} {UI_STRINGS.common.minutes}
            </strong>
          </p>
        )}
      </div>

      {notes.length > 0 ? (
        <div className="card stack">
          <h2>{UI_STRINGS.feedback.notesTitle}</h2>
          <ul className="notes">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted">{UI_STRINGS.feedback.noNotes}</p>
      )}

      <button
        type="button"
        className="button button--primary"
        onClick={() => navigate(ROUTES.HOME)}
      >
        {UI_STRINGS.common.goHome}
      </button>
    </div>
  );
}
