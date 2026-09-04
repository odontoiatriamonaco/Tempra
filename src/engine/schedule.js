// Tempra v0.4.0 — 2026-09-04 11:30
//
// Dove siamo nel mesociclo. Spec 4.4: «il calendario non avanza per data ma
// per sessioni completate: la settimana 2 inizia quando tutti i giorni della
// settimana 1 sono completati».
//
// Modulo non previsto dall'albero della sezione 9, ma la Home ha bisogno di
// sapere tre cose che nessun altro modulo calcola: quale settimana è in corso,
// quale giorno proporre, e quante serie sono già state fatte per gruppo
// muscolare. Funzioni pure, nessun accesso al database.

import { WEEKS_PER_MESOCYCLE } from './week.js';
import { volumeTargetFor } from './generate.js';

/**
 * Sedute portate a termine, indicizzate per settimana.
 * @param {ReadonlyArray<object>} sessions
 * @returns {Map<number, Set<number>>} settimana → indici dei giorni completati
 */
function completedByWeek(sessions) {
  const map = new Map();
  for (const session of sessions) {
    if (session.status !== 'completed') continue;
    if (!map.has(session.weekIndex)) map.set(session.weekIndex, new Set());
    map.get(session.weekIndex).add(session.dayIndex);
  }
  return map;
}

/**
 * Stato del programma: settimana corrente, stato di ogni giorno, prossimo
 * giorno da fare.
 *
 * @param {object} program
 * @param {ReadonlyArray<object>} sessions
 * @returns {{
 *   weekIndex: number,
 *   isComplete: boolean,
 *   days: Array<{ index: number, label: string, done: boolean }>,
 *   nextDayIndex: number | null,
 *   completedDays: number,
 *   totalDays: number,
 * }}
 */
export function getScheduleState(program, sessions = []) {
  const totalDays = program.days.length;
  const byWeek = completedByWeek(sessions);

  // La prima settimana non ancora chiusa. Se sono chiuse tutte, il mesociclo
  // è finito e l'app proporrà di generarne uno nuovo.
  let weekIndex = WEEKS_PER_MESOCYCLE;
  for (let week = 0; week < WEEKS_PER_MESOCYCLE; week += 1) {
    if ((byWeek.get(week)?.size ?? 0) < totalDays) {
      weekIndex = week;
      break;
    }
  }

  const isComplete = weekIndex === WEEKS_PER_MESOCYCLE;

  // A mesociclo chiuso si resta sull'ultima settimana, con tutti i giorni
  // fatti: non c'è un giorno successivo da proporre, c'è un nuovo mesociclo
  // da generare (spec 3.6).
  const shownWeek = isComplete ? WEEKS_PER_MESOCYCLE - 1 : weekIndex;
  const doneThisWeek = byWeek.get(shownWeek) ?? new Set();

  const days = program.days.map((day) => ({
    index: day.index,
    label: day.label,
    done: doneThisWeek.has(day.index),
  }));

  const next = days.find((day) => !day.done);

  return {
    weekIndex: shownWeek,
    isComplete,
    days,
    nextDayIndex: next ? next.index : null,
    completedDays: doneThisWeek.size,
    totalDays,
  };
}

/**
 * Serie di lavoro completate nella settimana, per gruppo muscolare primario.
 * Le serie di avvicinamento non contano: non sono lavoro.
 *
 * @param {ReadonlyArray<object>} sessions
 * @param {number} weekIndex
 * @param {Map<string, object>} byId catalogo indicizzato per id
 * @returns {Record<string, number>}
 */
export function completedVolume(sessions, weekIndex, byId) {
  /** @type {Record<string, number>} */
  const volume = {};
  for (const session of sessions) {
    if (session.weekIndex !== weekIndex) continue;
    for (const log of session.sets ?? []) {
      if (log.isWarmup) continue;
      const exercise = byId.get(log.exerciseId);
      if (!exercise) continue;
      for (const muscle of exercise.primaryMuscles) {
        volume[muscle] = (volume[muscle] ?? 0) + 1;
      }
    }
  }
  return volume;
}

/**
 * I quattro livelli della mappa di calore (spec 6.1): 0 %, 1–49 %, 50–99 %,
 * ≥ 100 % rispetto al minimo del range del livello.
 *
 * @param {number} completed serie fatte
 * @param {number} target minimo del range per quel gruppo
 * @returns {0|1|2|3}
 */
export function heatLevel(completed, target) {
  if (completed <= 0 || target <= 0) return 0;
  const ratio = completed / target;
  if (ratio >= 1) return 3;
  if (ratio >= 0.5) return 2;
  return 1;
}

/**
 * Mappa di calore pronta per la UI: per ogni gruppo, serie fatte, target e
 * livello di intensità.
 *
 * @param {object} program
 * @param {ReadonlyArray<object>} sessions
 * @param {number} weekIndex
 * @param {Map<string, object>} byId
 * @param {ReadonlyArray<string>} muscles
 * @returns {Array<{ muscle: string, completed: number, min: number, max: number, level: 0|1|2|3 }>}
 */
export function buildHeatmap(program, sessions, weekIndex, byId, muscles) {
  const volume = completedVolume(sessions, weekIndex, byId);
  return muscles.map((muscle) => {
    const target = volumeTargetFor(muscle, program.effectiveLevel);
    const completed = volume[muscle] ?? 0;
    return {
      muscle,
      completed,
      min: target.min,
      max: target.max,
      level: heatLevel(completed, target.min),
    };
  });
}
