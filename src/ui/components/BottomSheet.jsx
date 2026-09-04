// Tempra v0.4.0 — 2026-09-04 11:30
//
// Foglio che sale dal basso: "Cambia giorno" (7.1) e, in Fase 4, la
// sostituzione esercizio. Si chiude con Esc, con il tocco fuori e con il
// pulsante; il focus resta dentro finché è aperto.

import { useEffect, useRef } from 'react';
import { UI_STRINGS } from '../../data/strings.it.js';

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {string} props.title
 * @param {() => void} props.onClose
 * @param {import('react').ReactNode} props.children
 */
export default function BottomSheet({ open, title, onClose, children }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    // Il primo elemento attivabile riceve il focus: senza, chi naviga da
    // tastiera resta sul pulsante che ha aperto il foglio.
    panelRef.current?.querySelector('button, [href], input')?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="sheet__backdrop"
        aria-label={UI_STRINGS.common.close}
        onClick={onClose}
      />
      <div className="sheet__panel" ref={panelRef}>
        <div className="sheet__grip" aria-hidden="true" />
        <h2 className="sheet__title">{title}</h2>
        {children}
        <button type="button" className="button button--ghost" onClick={onClose}>
          {UI_STRINGS.common.close}
        </button>
      </div>
    </div>
  );
}
