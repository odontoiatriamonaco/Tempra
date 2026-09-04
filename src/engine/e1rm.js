// Tempra v0.6.0 — 2026-09-04 13:00
//
// Carico massimale stimato con la formula di Epley (spec 4.6).
//
// Serve **solo** a disegnare i grafici dei progressi. Non prescrive niente: il
// motore di progressione lavora sul campo, su ripetizioni e RIR realmente
// registrati, e non guarda mai questo numero.

/**
 * @param {number} weightKg
 * @param {number} reps
 * @returns {number} massimale stimato, arrotondato a 0,1 kg
 */
export function e1rm(weightKg, reps) {
  if (weightKg <= 0 || reps <= 0) return 0;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

/**
 * La serie migliore della sessione per un esercizio, misurata in e1RM
 * (spec 4.6). Le serie di avvicinamento non partecipano.
 *
 * @param {object} session
 * @param {string} exerciseId
 * @returns {{ weightKg: number, reps: number, e1rm: number } | null}
 */
export function bestSetOfSession(session, exerciseId) {
  let best = null;
  for (const log of session.sets ?? []) {
    if (log.isWarmup || log.exerciseId !== exerciseId) continue;
    const value = e1rm(log.weightKg, log.reps);
    if (!best || value > best.e1rm) {
      best = { weightKg: log.weightKg, reps: log.reps, e1rm: value };
    }
  }
  return best;
}

/**
 * Serie storica dell'e1RM di un esercizio, una voce per sessione in cui è
 * comparso, dalla più vecchia.
 *
 * @param {ReadonlyArray<object>} sessions
 * @param {string} exerciseId
 * @returns {Array<{ date: string, e1rm: number, weightKg: number, reps: number }>}
 */
export function e1rmHistory(sessions, exerciseId) {
  return sessions
    .filter((session) => session.status === 'completed')
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((session) => {
      const best = bestSetOfSession(session, exerciseId);
      return best ? { date: session.startedAt, ...best } : null;
    })
    .filter(Boolean);
}
