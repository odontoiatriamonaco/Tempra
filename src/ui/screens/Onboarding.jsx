// Tempra v0.4.0 — 2026-09-04 11:30
//
// Disclaimer bloccante e quattro domande (spec 7.1).
//
// Ogni scelta fa avanzare da sola: quattro tap per le domande più uno per
// generare, cinque in tutto — il criterio 7.3 ne concede otto.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DISCLAIMER, TIER_LABELS, UI_STRINGS } from '../../data/strings.it.js';
import { GOALS, LEVELS } from '../../data/taxonomy.js';
import { generateProgram } from '../../engine/generate.js';
import { newId, now, saveProfile, saveProgram } from '../../db/repo.js';
import { ensureCatalogSeeded } from '../../db/bootstrap.js';

const DAYS = [2, 3, 4, 5, 6];
const MINUTES = [30, 45, 60, 75, 90];

const STEPS = ['disclaimer', 'goal', 'days', 'minutes', 'level', 'summary'];

/**
 * Il seed della generazione: casuale, così due persone con gli stessi
 * parametri non ricevono la stessa identica scheda.
 *
 * Si può però fissarlo con `?seed=` nell'URL. Serve ai test end-to-end, che
 * altrimenti non saprebbero quale esercizio aspettarsi, ed è utile anche per
 * riprodurre la scheda di qualcun altro a parità di risposte.
 *
 * @returns {number}
 */
function initialSeed() {
  const fromUrl = Number(new URLSearchParams(window.location.search).get('seed'));
  if (Number.isFinite(fromUrl) && fromUrl > 0) return Math.floor(fromUrl);
  return Math.floor(Math.random() * 2 ** 31);
}

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState('disclaimer');
  const [goal, setGoal] = useState(null);
  const [daysPerWeek, setDaysPerWeek] = useState(null);
  const [minutesPerSession, setMinutesPerSession] = useState(null);
  const [level, setLevel] = useState(null);
  const [seed, setSeed] = useState(initialSeed);
  const [catalog, setCatalog] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    ensureCatalogSeeded().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  const params = useMemo(
    () => ({ goal, daysPerWeek, minutesPerSession, level }),
    [goal, daysPerWeek, minutesPerSession, level]
  );

  const preview = useMemo(() => {
    if (step !== 'summary' || catalog.length === 0) return null;
    return generateProgram(params, catalog, seed);
  }, [step, catalog, params, seed]);

  const confirm = useCallback(async () => {
    if (!preview || saving) return;
    setSaving(true);
    try {
      await saveProfile({
        ...params,
        units: 'kg',
        disclaimerAcceptedAt: now(),
      });
      await saveProgram({ ...preview, id: newId(), createdAt: now() });
      await onDone();
    } finally {
      setSaving(false);
    }
  }, [preview, saving, params, onDone]);

  const stepNumber = STEPS.indexOf(step);

  return (
    <div className="onboarding stack">
      {step !== 'disclaimer' && (
        <ol className="onboarding__progress" aria-label={UI_STRINGS.onboarding.step}>
          {STEPS.slice(1).map((name, index) => (
            <li
              key={name}
              className="onboarding__dot"
              data-state={
                index + 1 < stepNumber ? 'done' : index + 1 === stepNumber ? 'current' : 'todo'
              }
            />
          ))}
        </ol>
      )}

      {step === 'disclaimer' && <Disclaimer onAccept={() => setStep('goal')} />}

      {step === 'goal' && (
        <Question
          title={UI_STRINGS.onboarding.goalQuestion}
          options={GOALS.map((value) => ({
            value,
            title: UI_STRINGS.onboarding.goals[value].title,
            detail: UI_STRINGS.onboarding.goals[value].detail,
          }))}
          selected={goal}
          onSelect={(value) => {
            setGoal(value);
            setStep('days');
          }}
        />
      )}

      {step === 'days' && (
        <Question
          title={UI_STRINGS.onboarding.daysQuestion}
          detail={UI_STRINGS.onboarding.daysDetail}
          compact
          options={DAYS.map((value) => ({ value, title: String(value) }))}
          selected={daysPerWeek}
          onSelect={(value) => {
            setDaysPerWeek(value);
            setStep('minutes');
          }}
          onBack={() => setStep('goal')}
        />
      )}

      {step === 'minutes' && (
        <Question
          title={UI_STRINGS.onboarding.minutesQuestion}
          detail={UI_STRINGS.onboarding.minutesDetail}
          compact
          options={MINUTES.map((value) => ({ value, title: String(value) }))}
          selected={minutesPerSession}
          onSelect={(value) => {
            setMinutesPerSession(value);
            setStep('level');
          }}
          onBack={() => setStep('days')}
        />
      )}

      {step === 'level' && (
        <Question
          title={UI_STRINGS.onboarding.levelQuestion}
          options={LEVELS.map((value) => ({
            value,
            title: UI_STRINGS.onboarding.levels[value].title,
            detail: UI_STRINGS.onboarding.levels[value].detail,
          }))}
          selected={level}
          onSelect={(value) => {
            setLevel(value);
            setStep('summary');
          }}
          onBack={() => setStep('minutes')}
        />
      )}

      {step === 'summary' && (
        <Summary
          program={preview}
          catalogById={new Map(catalog.map((e) => [e.id, e]))}
          saving={saving}
          onConfirm={confirm}
          onReroll={() => setSeed((value) => value + 1)}
          onBack={() => setStep('level')}
        />
      )}
    </div>
  );
}

function Disclaimer({ onAccept }) {
  const [readToEnd, setReadToEnd] = useState(false);
  const scrollRef = useRef(null);

  const check = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    // Tolleranza di 8px: su alcuni browser scrollTop resta frazionario.
    const atEnd = element.scrollTop + element.clientHeight >= element.scrollHeight - 8;
    if (atEnd) setReadToEnd(true);
  }, []);

  // Se il testo ci sta tutto senza scorrere, non c'è niente da scorrere.
  useEffect(check, [check]);

  return (
    <section className="stack">
      <h1>{DISCLAIMER.title}</h1>
      <div className="disclaimer__scroll" ref={scrollRef} onScroll={check} tabIndex={0}>
        {DISCLAIMER.paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 24)}>{paragraph}</p>
        ))}
      </div>
      {!readToEnd && <p className="muted disclaimer__hint">{DISCLAIMER.scrollHint}</p>}
      <button
        type="button"
        className="button button--primary"
        disabled={!readToEnd}
        onClick={onAccept}
      >
        {DISCLAIMER.accept}
      </button>
    </section>
  );
}

function Question({ title, detail, options, selected, onSelect, onBack, compact = false }) {
  return (
    <section className="stack">
      <h1>{title}</h1>
      {detail && <p className="muted">{detail}</p>}
      <div className={compact ? 'choice choice--compact' : 'choice'}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="choice__option"
            aria-pressed={option.value === selected}
            onClick={() => onSelect(option.value)}
          >
            <span className="choice__title">{option.title}</span>
            {option.detail && <span className="choice__detail">{option.detail}</span>}
          </button>
        ))}
      </div>
      {onBack && (
        <button type="button" className="button button--ghost" onClick={onBack}>
          {UI_STRINGS.common.back}
        </button>
      )}
    </section>
  );
}

function Summary({ program, catalogById, saving, onConfirm, onReroll, onBack }) {
  if (!program) return <p className="muted">{UI_STRINGS.app.loading}</p>;

  return (
    <section className="stack">
      <h1>{UI_STRINGS.onboarding.summaryTitle}</h1>

      <div className="card stack">
        <Row label={UI_STRINGS.onboarding.summarySplit} value={program.splitType} />
        <Row
          label={UI_STRINGS.onboarding.summaryVolume}
          value={UI_STRINGS.onboarding.levels[program.effectiveLevel].title}
        />
        {program.volumeNote && <p className="muted">{program.volumeNote}</p>}
        {program.volumeWarning && <p className="muted">{program.volumeWarning}</p>}
      </div>

      {program.days.map((day) => (
        <div key={day.index} className="card stack">
          <h2>
            {day.label}{' '}
            <span className="muted num">
              ~{Math.round(day.estimatedSeconds / 60) + 8} {UI_STRINGS.common.minutes}
            </span>
          </h2>
          <ul className="preview">
            {day.slots.map((slot) => (
              <li key={slot.id} className="preview__row">
                <span>{catalogById.get(slot.exerciseId)?.name ?? slot.exerciseId}</span>
                <span className="muted num">
                  {slot.sets}×{slot.repMin}-{slot.repMax}
                </span>
                <span className="muted preview__tier">{TIER_LABELS[slot.tier]}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <button
        type="button"
        className="button button--primary"
        onClick={onConfirm}
        disabled={saving}
      >
        {UI_STRINGS.onboarding.generate}
      </button>
      <button type="button" className="button button--ghost" onClick={onReroll}>
        {UI_STRINGS.onboarding.regenerate}
      </button>
      <button type="button" className="button button--ghost" onClick={onBack}>
        {UI_STRINGS.common.back}
      </button>
    </section>
  );
}

function Row({ label, value }) {
  return (
    <p className="row">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </p>
  );
}
