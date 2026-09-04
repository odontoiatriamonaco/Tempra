// Tempra v0.5.0 — 2026-09-04 12:10
//
// Overlay del recupero, in basso e non bloccante (spec 7.1): la lista degli
// esercizi resta usabile mentre il tempo scorre.

import { UI_STRINGS } from '../../data/strings.it.js';

/** @param {number} seconds @returns {string} m:ss */
export function formatSeconds(seconds) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/**
 * @param {object} props
 * @param {number|null} props.secondsLeft
 * @param {number|null} props.totalSeconds
 * @param {(delta: number) => void} props.onAdjust
 * @param {() => void} props.onSkip
 */
export default function RestTimer({ secondsLeft, totalSeconds, onAdjust, onSkip }) {
  if (secondsLeft === null) return null;

  const done = secondsLeft === 0;
  const progress = totalSeconds ? 1 - secondsLeft / totalSeconds : 1;

  return (
    <div className="resttimer" data-done={done ? 'true' : 'false'} role="status">
      <div
        className="resttimer__progress"
        style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress))})` }}
        aria-hidden="true"
      />
      <div className="resttimer__body">
        <span className="resttimer__value num">
          {done ? UI_STRINGS.timer.ready : formatSeconds(secondsLeft)}
        </span>
        <div className="resttimer__actions">
          <button type="button" className="resttimer__button" onClick={() => onAdjust(-15)}>
            −15
          </button>
          <button type="button" className="resttimer__button" onClick={() => onAdjust(15)}>
            +15
          </button>
          <button type="button" className="resttimer__button" onClick={onSkip}>
            {UI_STRINGS.timer.skip}
          </button>
        </div>
      </div>
    </div>
  );
}
