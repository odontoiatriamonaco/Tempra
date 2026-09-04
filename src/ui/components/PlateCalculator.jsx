// Tempra v0.5.0 — 2026-09-04 12:10
//
// Popover "per lato" (spec 7.1). Si apre toccando il peso, solo per gli
// esercizi con bilanciere.

import { platesPerSide } from '../../engine/plates.js';
import { UI_STRINGS } from '../../data/strings.it.js';

/** @param {number} kg @returns {string} numero all'italiana, senza zeri inutili */
export function formatKg(kg) {
  return String(kg).replace('.', ',');
}

/**
 * @param {object} props
 * @param {number} props.weightKg
 * @param {() => void} props.onClose
 */
export default function PlateCalculator({ weightKg, onClose }) {
  const result = platesPerSide(weightKg);

  return (
    <div className="plates" role="dialog" aria-label={UI_STRINGS.plates.title}>
      <p className="plates__total num">{formatKg(weightKg)} kg</p>
      <p className="plates__text">{describe(result)}</p>
      <button type="button" className="button button--ghost" onClick={onClose}>
        {UI_STRINGS.common.close}
      </button>
    </div>
  );
}

/**
 * @param {import('../../engine/plates.js').PlateResult} result
 * @returns {string}
 */
export function describe(result) {
  switch (result.kind) {
    case 'empty-bar':
      return UI_STRINGS.plates.emptyBar;
    case 'below-bar':
      return UI_STRINGS.plates.belowBar;
    case 'not-composable':
      return `${UI_STRINGS.plates.notComposable} ${formatKg(result.lowerKg)} ${UI_STRINGS.plates.or} ${formatKg(result.upperKg)}`;
    default:
      return `${UI_STRINGS.plates.perSide} ${result.perSide.map(formatKg).join(' + ')}`;
  }
}
