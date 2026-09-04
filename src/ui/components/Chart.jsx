// Tempra v0.7.0 — 2026-09-04 13:20
//
// I due grafici della spec (sezione 9: SVG scritti a mano, nessuna libreria).
//
// Sono due componenti separati e non un unico grafico con due scale: il carico
// di lavoro e l'e1RM si misurano entrambi in chilogrammi, ma vogliono assi
// diversi — le barre devono partire da zero, altrimenti un aumento di 2,5 kg
// sembra un raddoppio, mentre la linea dell'e1RM va letta ravvicinata o non si
// vede muovere. Due grafici con un asse ciascuno, mai un grafico con due assi.

import { useId } from 'react';

// Rapporto largo e basso: su un telefono in verticale un grafico quadrato
// mangia mezzo schermo per due barre.
const WIDTH = 320;
const HEIGHT = 104;
const PAD = { top: 12, right: 8, bottom: 12, left: 30 };

const plot = {
  x: PAD.left,
  y: PAD.top,
  width: WIDTH - PAD.left - PAD.right,
  height: HEIGHT - PAD.top - PAD.bottom,
};

/** @param {number} kg */
const fmt = (kg) => String(Math.round(kg * 10) / 10).replace('.', ',');

/**
 * Cornice comune: griglia orizzontale discreta, etichette dell'asse, titolo.
 */
function Frame({ title, ticks, children, describedBy }) {
  return (
    <figure className="chart">
      <figcaption className="chart__title">{title}</figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-describedby={describedBy}
        preserveAspectRatio="xMidYMid meet"
      >
        {ticks.map((tick) => (
          <g key={tick.value}>
            <line
              className="chart__grid"
              x1={plot.x}
              x2={plot.x + plot.width}
              y1={tick.y}
              y2={tick.y}
            />
            <text className="chart__tick" x={plot.x - 6} y={tick.y + 3} textAnchor="end">
              {fmt(tick.value)}
            </text>
          </g>
        ))}
        {children}
      </svg>
    </figure>
  );
}

/**
 * Tre tacche: minimo, mezzo, massimo del dominio.
 * @param {number} min @param {number} max
 */
function makeTicks(min, max) {
  const span = max - min || 1;
  return [0, 0.5, 1].map((fraction) => ({
    value: min + span * fraction,
    y: plot.y + plot.height - fraction * plot.height,
  }));
}

/**
 * Barre, ancorate allo zero. Il carico di lavoro è una grandezza da
 * confrontare, e una barra tagliata mente sulle proporzioni.
 *
 * @param {object} props
 * @param {Array<{ label: string, value: number, title?: string }>} props.points
 * @param {string} props.title
 * @param {string} props.unit
 */
export function ChartBars({ points, title, unit }) {
  const tableId = useId();
  if (points.length === 0) return null;

  const max = Math.max(...points.map((point) => point.value));
  const top = max * 1.1 || 1;
  const band = plot.width / points.length;
  const barWidth = Math.min(24, band - 2); // 2px di aria fra le barre

  return (
    <>
      <Frame title={title} ticks={makeTicks(0, top)} describedBy={tableId}>
        {points.map((point, index) => {
          const height = (point.value / top) * plot.height;
          return (
            <rect
              key={point.label}
              className="chart__bar"
              x={plot.x + index * band + (band - barWidth) / 2}
              y={plot.y + plot.height - height}
              width={barWidth}
              height={Math.max(1, height)}
              rx="4"
            >
              <title>{point.title ?? `${point.label}: ${fmt(point.value)} ${unit}`}</title>
            </rect>
          );
        })}
        <line
          className="chart__axis"
          x1={plot.x}
          x2={plot.x + plot.width}
          y1={plot.y + plot.height}
          y2={plot.y + plot.height}
        />
      </Frame>
      <DataTable id={tableId} points={points} unit={unit} label={title} />
    </>
  );
}

/**
 * Linea, con dominio ravvicinato ai dati. Serve a leggere l'andamento, non a
 * confrontare grandezze: l'asse parte dal minimo, ed è etichettato.
 *
 * @param {object} props
 * @param {Array<{ label: string, value: number, title?: string }>} props.points
 * @param {string} props.title
 * @param {string} props.unit
 */
export function ChartLine({ points, title, unit }) {
  const tableId = useId();
  if (points.length === 0) return null;

  const values = points.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const margin = (rawMax - rawMin) * 0.15 || Math.max(1, rawMax * 0.05);
  const min = Math.max(0, rawMin - margin);
  const max = rawMax + margin;

  const xOf = (index) =>
    points.length === 1
      ? plot.x + plot.width / 2
      : plot.x + (index / (points.length - 1)) * plot.width;
  const yOf = (value) =>
    plot.y + plot.height - ((value - min) / (max - min || 1)) * plot.height;

  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xOf(index)} ${yOf(point.value)}`)
    .join(' ');

  const lastIndex = points.length - 1;

  return (
    <>
      <Frame title={title} ticks={makeTicks(min, max)} describedBy={tableId}>
        <path className="chart__line" d={path} fill="none" />
        {points.map((point, index) => (
          <circle
            key={point.label}
            className="chart__dot"
            cx={xOf(index)}
            cy={yOf(point.value)}
            r="4"
          >
            <title>{point.title ?? `${point.label}: ${fmt(point.value)} ${unit}`}</title>
          </circle>
        ))}
        {/* Solo il primo e l'ultimo valore sono etichettati: un numero su ogni
            punto renderebbe illeggibile il grafico su 430 px. */}
        {[0, lastIndex]
          .filter((index, position, all) => all.indexOf(index) === position)
          .map((index) => (
            <text
              key={`label-${index}`}
              className="chart__value"
              x={xOf(index)}
              y={yOf(points[index].value) - 9}
              textAnchor={index === 0 ? 'start' : 'end'}
            >
              {fmt(points[index].value)}
            </text>
          ))}
      </Frame>
      <DataTable id={tableId} points={points} unit={unit} label={title} />
    </>
  );
}

/**
 * La stessa serie in tabella. Non è un ripiego per l'accessibilità: in
 * palestra il numero esatto serve più della forma della curva.
 */
function DataTable({ id, points, unit, label }) {
  return (
    <details className="chart__table" id={id}>
      <summary className="muted">{label} — valori</summary>
      <table>
        <tbody>
          {points.map((point) => (
            <tr key={point.label}>
              <td>{point.label}</td>
              <td className="num">
                {fmt(point.value)} {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
