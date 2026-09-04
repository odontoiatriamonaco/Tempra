// Tempra v0.5.0 — 2026-09-04 12:10
//
// Una riga di serie: peso, ripetizioni, RIR, spunta (spec 7.1).
// Tutto a stepper e pulsanti — niente tastiera, si usa con le mani sudate.

import { useState } from 'react';
import { UI_STRINGS } from '../../data/strings.it.js';
import { NUMERIC_RIR, RIR_FROM_INPUT, usesThreeButtonRir } from '../../engine/session.js';
import { minimumLoad } from '../../engine/session.js';
import { usesBarbell } from '../../engine/plates.js';
import { formatKg } from './PlateCalculator.jsx';

/**
 * @param {object} props
 * @param {object} props.row
 * @param {object} props.slot
 * @param {object} props.exercise
 * @param {string} props.level
 * @param {object|null} props.logged serie già registrata, se c'è
 * @param {number|null} props.suggestedReps ripetizioni dell'ultima volta
 * @param {(entry: object) => void} props.onComplete
 * @param {(weightKg: number) => void} props.onShowPlates
 */
export default function SetRow({
  row,
  slot,
  exercise,
  level,
  logged,
  suggestedReps,
  onComplete,
  onShowPlates,
}) {
  const [weightKg, setWeightKg] = useState(logged?.weightKg ?? row.suggestedWeightKg);
  const [reps, setReps] = useState(logged?.reps ?? suggestedReps ?? slot.repMax);

  const increment = exercise.loadIncrementKg;
  const floor = minimumLoad(exercise);
  const done = Boolean(logged);
  const threeButtons = usesThreeButtonRir(level);

  const complete = (rir, rirInput) => {
    onComplete({
      slotId: slot.id,
      exerciseId: exercise.id,
      setIndex: row.setIndex,
      weightKg,
      reps,
      rir,
      rirInput,
      isWarmup: row.isWarmup,
    });
  };

  return (
    <div className="setrow" data-done={done ? 'true' : 'false'} data-warmup={row.isWarmup ? 'true' : 'false'}>
      <div className="setrow__label">
        {row.isWarmup
          ? UI_STRINGS.session.warmupShort
          : `${UI_STRINGS.session.setShort}${row.setIndex + 1}`}
      </div>

      <Stepper
        label={UI_STRINGS.session.weight}
        value={formatKg(weightKg)}
        unit="kg"
        disabled={done}
        onDecrease={() => setWeightKg((w) => Math.max(floor, roundKg(w - increment)))}
        onIncrease={() => setWeightKg((w) => roundKg(w + increment))}
        onValueClick={usesBarbell(exercise) ? () => onShowPlates(weightKg) : undefined}
      />

      <Stepper
        label={UI_STRINGS.session.reps}
        value={String(reps)}
        disabled={done}
        onDecrease={() => setReps((r) => Math.max(1, r - 1))}
        onIncrease={() => setReps((r) => r + 1)}
      />

      {done ? (
        <div className="setrow__done num" aria-label={UI_STRINGS.session.completed}>
          {formatKg(logged.weightKg)}×{logged.reps}
          {logged.isWarmup ? '' : ` @${logged.rir}`}
        </div>
      ) : row.isWarmup ? (
        // Sull'avvicinamento non si chiede il RIR: non è una serie di lavoro.
        <button
          type="button"
          className="setrow__check"
          onClick={() => complete(4, 'numeric')}
          aria-label={UI_STRINGS.session.completeSet}
        >
          ✓
        </button>
      ) : (
        <div className="rir">
          <span className="rir__label muted">{UI_STRINGS.session.rirQuestion}</span>
          <div className="rir__options">
            {threeButtons
              ? Object.entries(RIR_FROM_INPUT).map(([input, value]) => (
                  <button
                    key={input}
                    type="button"
                    className="rir__button"
                    onClick={() => complete(value, input)}
                  >
                    {UI_STRINGS.session.rirWords[input]}
                  </button>
                ))
              : NUMERIC_RIR.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="rir__button rir__button--num num"
                    onClick={() => complete(value, 'numeric')}
                  >
                    {value}
                  </button>
                ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Evita che 62.5 - 1.25 diventi 61.249999999999996. */
function roundKg(kg) {
  return Math.round(kg * 100) / 100;
}

function Stepper({ label, value, unit, disabled, onDecrease, onIncrease, onValueClick }) {
  return (
    <div className="stepper">
      <span className="stepper__label muted">{label}</span>
      <div className="stepper__controls">
        <button
          type="button"
          className="stepper__button"
          onClick={onDecrease}
          disabled={disabled}
          aria-label={`${label} −`}
        >
          −
        </button>
        {onValueClick ? (
          <button type="button" className="stepper__value num stepper__value--tappable" onClick={onValueClick}>
            {value}
            {unit ? <span className="stepper__unit">{unit}</span> : null}
          </button>
        ) : (
          <span className="stepper__value num">
            {value}
            {unit ? <span className="stepper__unit">{unit}</span> : null}
          </span>
        )}
        <button
          type="button"
          className="stepper__button"
          onClick={onIncrease}
          disabled={disabled}
          aria-label={`${label} +`}
        >
          +
        </button>
      </div>
    </div>
  );
}
