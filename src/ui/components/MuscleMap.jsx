// Tempra v0.4.0 — 2026-09-04 11:30
//
// La figura di src/data/body.svg, con i gruppi muscolari evidenziabili.
// Due usi (spec 6.1):
//   · `highlights` — scheda esercizio: primari e secondari;
//   · `heat`       — Home: mappa di calore settimanale a quattro livelli.
//
// L'SVG viene iniettato inline (non come <img>) perché i colori arrivano dalle
// custom properties del tema, e un'immagine non le eredita.

import { useEffect, useId, useMemo, useRef } from 'react';
import rawSvg from '../../data/body.svg?raw';
import { MUSCLE_LABELS } from '../../data/strings.it.js';

/**
 * Rende univoci gli id dell'SVG. Sulla stessa pagina possono comparire più
 * mappe (in Fase 4 una per esercizio) e due `id="m-chest"` nel documento
 * romperebbero sia i riferimenti `<use href>` sia l'accessibilità.
 * @param {string} svg
 * @param {string} prefix
 * @returns {string}
 */
function namespaceIds(svg, prefix) {
  return svg
    .replace(/\bid="([^"]+)"/g, (_, id) => `id="${prefix}-${id}"`)
    .replace(/\bhref="#([^"]+)"/g, (_, id) => `href="#${prefix}-${id}"`)
    .replace(/\baria-labelledby="([^"]+)"/g, (_, id) => `aria-labelledby="${prefix}-${id}"`);
}

/**
 * @param {object} props
 * @param {Record<string, 'primary'|'secondary'>} [props.highlights]
 * @param {Record<string, 0|1|2|3>} [props.heat]
 * @param {Record<string, string>} [props.titles] testo del tooltip per gruppo
 * @param {(muscle: string) => void} [props.onSelect]
 * @param {string} [props.className]
 */
export default function MuscleMap({
  highlights,
  heat,
  titles,
  onSelect,
  className = '',
}) {
  const uid = useId().replace(/:/g, '');
  const containerRef = useRef(null);
  const markup = useMemo(() => namespaceIds(rawSvg, uid), [uid]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return undefined;

    const paths = root.querySelectorAll('.muscle');
    /** @type {Array<() => void>} */
    const cleanups = [];

    for (const path of paths) {
      const muscle = path.id.replace(`${uid}-m-`, '');

      if (heat) path.dataset.heat = String(heat[muscle] ?? 0);
      else delete path.dataset.heat;

      if (highlights?.[muscle]) path.dataset.role = highlights[muscle];
      else delete path.dataset.role;

      // Il titolo è il tooltip nativo dell'SVG: funziona anche al tap lungo.
      const label = MUSCLE_LABELS[muscle] ?? muscle;
      const text = titles?.[muscle] ?? label;
      let title = path.querySelector('title');
      if (!title) {
        title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        path.appendChild(title);
      }
      title.textContent = text;

      if (onSelect) {
        const handler = () => onSelect(muscle);
        path.addEventListener('click', handler);
        path.style.cursor = 'pointer';
        cleanups.push(() => path.removeEventListener('click', handler));
      }
    }

    return () => cleanups.forEach((off) => off());
  }, [heat, highlights, titles, onSelect, uid, markup]);

  return (
    <div
      ref={containerRef}
      className={`muscle-map ${className}`.trim()}
      // Contenuto nostro, letto dal repository a build time: nessun input
      // esterno passa di qui.
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
