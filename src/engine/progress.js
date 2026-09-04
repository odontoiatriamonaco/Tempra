// Tempra v0.6.0 — 2026-09-04 13:00
//
// Motore di progressione (spec sezione 4). Funzione pura, invocata a fine
// sessione: `applySession(program, session, history) → { program, notes }`.
//
// Le note non sono un log: sono una funzione dell'app. L'utente ha diritto di
// sapere perché la prossima volta troverà 2,5 kg in più, e ogni modifica al
// programma ne produce esattamente una.

import { WEEK_PLANS, WEEKS_PER_MESOCYCLE } from './week.js';
import { volumeTargetFor, weeklyVolume } from './generate.js';
import { minimumLoad, roundToIncrement } from './session.js';

/** Oltre questi giorni fra due sedute dello stesso giorno, niente progressione. */
export const STALE_DAYS = 10;

/** Oltre questi giorni si scende del 10 % e si riparte (spec 4.4). */
export const VERY_STALE_DAYS = 21;

/** Quanto si scende quando il carico è troppo alto. */
export const DELOAD_FACTOR = 0.9;

/** Sedute consecutive "dura" che anticipano lo scarico (spec 4.3). */
export const HARD_SESSIONS_FOR_DELOAD = 2;

/** Sedute consecutive "facile" che aggiungono una serie (spec 4.3). */
export const EASY_SESSIONS_FOR_EXTRA_SET = 2;

/** Volte consecutive con lo stesso sostituto prima di proporlo (spec 4.5). */
export const SUBSTITUTIONS_BEFORE_PROPOSAL = 3;

const clone = (value) => JSON.parse(JSON.stringify(value));

const mean = (values) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * @param {object} exercise
 * @param {number} weightKg
 * @param {number} factor
 * @returns {number}
 */
function scaleWeight(exercise, weightKg, factor) {
  return roundToIncrement(
    weightKg * factor,
    exercise?.loadIncrementKg ?? 2.5,
    minimumLoad(exercise)
  );
}

/** @param {string} isoA @param {string} isoB @returns {number} giorni interi */
function daysBetween(isoA, isoB) {
  return Math.floor(Math.abs(Date.parse(isoB) - Date.parse(isoA)) / 86400000);
}

/**
 * Sedute completate dello stesso giorno del programma, dalla più recente.
 * @param {object} session
 * @param {ReadonlyArray<object>} history
 * @returns {object[]}
 */
function previousSameDay(session, history) {
  return history
    .filter(
      (candidate) =>
        candidate.id !== session.id &&
        candidate.status === 'completed' &&
        candidate.dayIndex === session.dayIndex
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/**
 * Sedute completate in ordine cronologico inverso, la più recente per prima.
 * @param {object} session
 * @param {ReadonlyArray<object>} history
 * @returns {object[]}
 */
function completedBefore(session, history) {
  return history
    .filter(
      (candidate) =>
        candidate.id !== session.id &&
        candidate.status === 'completed' &&
        candidate.startedAt <= session.startedAt
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

// ---- 4.1 Calibrazione -----------------------------------------------------

/**
 * @param {object} slot mutato in loco (è già una copia)
 * @param {object} exercise
 * @param {ReadonlyArray<object>} logs serie di lavoro
 * @returns {string} nota
 */
function calibrate(slot, exercise, logs) {
  const used = Math.max(...logs.map((log) => log.weightKg));
  const avgRir = mean(logs.map((log) => log.rir));
  const increment = exercise?.loadIncrementKg ?? 2.5;
  const name = exercise?.name ?? slot.exerciseId;

  slot.state = 'calibrated';

  // L'ordine conta: i tre rami di 4.1 si sovrappongono, e "troppo facile"
  // va riconosciuto prima di "va bene".
  if (logs.every((log) => log.reps > slot.repMax) && avgRir >= 3) {
    slot.workingWeightKg = roundToIncrement(
      used + 2 * increment,
      increment,
      minimumLoad(exercise)
    );
    return `${name}: il peso di partenza era leggero, si parte da ${format(slot.workingWeightKg)} kg.`;
  }

  if (logs.some((log) => log.reps < slot.repMin) || avgRir < 1) {
    slot.workingWeightKg = scaleWeight(exercise, used, DELOAD_FACTOR);
    return `${name}: il peso di partenza era alto, si parte da ${format(slot.workingWeightKg)} kg.`;
  }

  slot.workingWeightKg = used;
  return `${name}: carico di partenza fissato a ${format(used)} kg.`;
}

// ---- 4.2 Doppia progressione ----------------------------------------------

/**
 * @param {object} slot mutato in loco (è già una copia)
 * @param {object} exercise
 * @param {ReadonlyArray<object>} logs
 * @param {number} targetRIR
 * @returns {string} nota
 */
function doubleProgression(slot, exercise, logs, targetRIR) {
  const increment = exercise?.loadIncrementKg ?? 2.5;
  const name = exercise?.name ?? slot.exerciseId;
  const avgRir = mean(logs.map((log) => log.rir));

  // Il caso A di 4.2 si attiva sulle ripetizioni; il RIR fa da freno.
  //
  // La spec scrive «tutte le serie hanno reps ≥ repMax **e RIR ≥ targetRIR**»
  // e poi definisce una regola di sicurezza per «il caso A con RIR medio
  // ≤ targetRIR − 2». Le due cose non possono coesistere: se ogni serie ha
  // RIR ≥ targetRIR, la media non può essere due punti sotto. Presa alla
  // lettera, la regola di sicurezza sarebbe irraggiungibile. Il criterio 4.7
  // però la richiede esplicitamente, quindi la condizione sul RIR vive lì.
  const allAtTop = logs.every((log) => log.reps >= slot.repMax);
  const allInRange = logs.every((log) => log.reps >= slot.repMin);

  if (allAtTop) {
    // Se è andata molto più dura del previsto, le ripetizioni da sole non
    // bastano a giustificare un aumento.
    if (avgRir <= targetRIR - 2) {
      slot.failStreak = 0;
      return `${name}: ripetizioni tutte chiuse ma serie molto dure, il peso resta ${format(slot.workingWeightKg)} kg.`;
    }
    slot.workingWeightKg = roundToIncrement(
      slot.workingWeightKg + increment,
      increment,
      minimumLoad(exercise)
    );
    slot.failStreak = 0;
    return `${name}: hai chiuso tutte le serie a ${slot.repMax} con ${Math.round(avgRir)} RIR, prossima volta ${format(slot.workingWeightKg)} kg.`;
  }

  if (allInRange) {
    slot.failStreak = 0;
    return `${name}: peso invariato a ${format(slot.workingWeightKg)} kg, punta a una ripetizione in più per serie.`;
  }

  // Caso C: almeno una serie sotto il minimo del range.
  slot.failStreak += 1;
  if (slot.failStreak >= 2) {
    slot.workingWeightKg = scaleWeight(exercise, slot.workingWeightKg, DELOAD_FACTOR);
    slot.failStreak = 0;
    return `${name}: due sedute sotto il range, scendiamo a ${format(slot.workingWeightKg)} kg per ripartire.`;
  }
  return `${name}: qualche serie sotto il range, il peso resta ${format(slot.workingWeightKg)} kg.`;
}

/** @param {number} kg */
function format(kg) {
  return String(kg).replace('.', ',');
}

// ---- 4.3 Autoregolazione da feedback --------------------------------------

/**
 * @param {object} next programma già aggiornato da 4.2
 * @param {object} session
 * @param {ReadonlyArray<object>} history
 * @param {Map<string, object>} byId
 * @param {string} level
 * @returns {string[]} note
 */
function autoregulate(next, session, history, byId, level) {
  const notes = [];
  const feedback = session.feedback;
  if (!feedback) return notes;

  // Le sedute ridotte non attivano queste regole (spec 5): una seduta breve è
  // dura per costruzione, e sarebbe un segnale falso.
  if (session.reducedToMinutes !== null && session.reducedToMinutes !== undefined) {
    return notes;
  }

  const hardAndDrained =
    feedback.difficulty === 'hard' &&
    (feedback.energy === 'low' || feedback.soreness === 'a-lot');

  if (hardAndDrained) {
    next.pendingAdjustments = {
      ...(next.pendingAdjustments ?? {}),
      [session.dayIndex]: { accessorySetDelta: -1 },
    };
    notes.push(
      'Seduta dura con poca energia: la prossima volta questo giorno avrà una serie in meno sugli accessori.'
    );
  }

  // Due sedute "dura" di fila, su qualsiasi giorno: si anticipa lo scarico.
  const previous = completedBefore(session, history);
  const lastHard = [feedback, ...previous.map((s) => s.feedback)].slice(
    0,
    HARD_SESSIONS_FOR_DELOAD
  );
  if (
    lastHard.length === HARD_SESSIONS_FOR_DELOAD &&
    lastHard.every((entry) => entry?.difficulty === 'hard') &&
    next.deloadAtWeek === null
  ) {
    next.deloadAtWeek = session.weekIndex;
    notes.push(
      `Due sedute dure di fila: la settimana ${session.weekIndex + 1} diventa di scarico, poi si riparte con i pesi di adesso.`
    );
  }

  // Due sedute "facile" di fila **sullo stesso giorno**, e non da principiante.
  const sameDay = previousSameDay(session, history);
  const lastEasy = [feedback, ...sameDay.map((s) => s.feedback)].slice(
    0,
    EASY_SESSIONS_FOR_EXTRA_SET
  );
  const easyStreak =
    lastEasy.length === EASY_SESSIONS_FOR_EXTRA_SET &&
    lastEasy.every((entry) => entry?.difficulty === 'easy');

  if (easyStreak && level !== 'beginner') {
    const day = next.days.find((candidate) => candidate.index === session.dayIndex);
    const secondaries = day?.slots.filter((slot) => slot.tier === 'secondary') ?? [];

    if (secondaries.length > 0) {
      // Il tetto di volume del livello vale anche qui: una seduta facile non
      // autorizza a superarlo (spec 4.3, ultima riga).
      const volume = weeklyVolume(next.days, byId);
      const wouldExceed = secondaries.some((slot) => {
        const exercise = byId.get(slot.exerciseId);
        return (exercise?.primaryMuscles ?? []).some((muscle) => {
          const target = volumeTargetFor(muscle, next.effectiveLevel);
          return (volume[muscle] ?? 0) + 1 > target.max;
        });
      });

      if (wouldExceed) {
        notes.push('Due sedute facili, ma il volume è già al massimo per il tuo livello.');
      } else {
        for (const slot of secondaries) slot.sets += 1;
        notes.push(
          'Due sedute facili di fila: una serie in più sui complementari di questo giorno, per il resto del mesociclo.'
        );
      }
    }
  }

  return notes;
}

// ---- 4.5 Sostituzioni ------------------------------------------------------

/**
 * @param {object} next
 * @param {object} session
 * @param {ReadonlyArray<object>} history
 * @param {Map<string, object>} byId
 * @returns {string[]} note
 */
function proposeSubstitutions(next, session, history, byId) {
  const notes = [];
  const current = session.substitutions ?? {};
  const sameDay = previousSameDay(session, history).slice(
    0,
    SUBSTITUTIONS_BEFORE_PROPOSAL - 1
  );

  for (const [slotId, exerciseId] of Object.entries(current)) {
    const streak =
      1 +
      sameDay.filter((entry) => entry.substitutions?.[slotId] === exerciseId).length;
    if (streak < SUBSTITUTIONS_BEFORE_PROPOSAL) continue;

    next.substitutionProposals = {
      ...(next.substitutionProposals ?? {}),
      [slotId]: exerciseId,
    };
    const name = byId.get(exerciseId)?.name ?? exerciseId;
    notes.push(
      `Hai usato ${name} tre volte di fila: vuoi renderlo l'esercizio di questo slot?`
    );
  }

  return notes;
}

/**
 * Rende definitiva una sostituzione proposta (spec 4.5): lo slot cambia
 * esercizio e torna da calibrare, perché il carico non è trasferibile.
 *
 * @param {object} program
 * @param {string} slotId
 * @param {string} exerciseId
 * @returns {object} nuovo programma
 */
export function makeSubstitutionPermanent(program, slotId, exerciseId) {
  const next = clone(program);
  for (const day of next.days) {
    for (const slot of day.slots) {
      if (slot.id !== slotId) continue;
      slot.exerciseId = exerciseId;
      slot.state = 'uncalibrated';
      slot.workingWeightKg = null;
      slot.failStreak = 0;
    }
  }
  if (next.substitutionProposals) delete next.substitutionProposals[slotId];
  return next;
}

// ---- Ingresso principale ---------------------------------------------------

/**
 * Applica alla scheda quanto imparato da una seduta.
 *
 * @param {object} program
 * @param {object} session la seduta appena chiusa
 * @param {ReadonlyArray<object>} history tutte le sedute del programma
 * @param {ReadonlyArray<object>} catalog serve per incrementi, nomi e volumi
 * @returns {{ program: object, notes: string[] }}
 */
export function applySession(program, session, history = [], catalog = []) {
  const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]));
  const next = clone(program);
  next.deloadAtWeek = next.deloadAtWeek ?? null;

  const notes = [];
  const day = next.days.find((candidate) => candidate.index === session.dayIndex);
  const workLogs = (session.sets ?? []).filter((log) => !log.isWarmup);

  if (!day || workLogs.length === 0) return { program, notes: [] };

  // L'aggiustamento una tantum del feedback precedente è stato consumato da
  // questa seduta: si toglie prima che `autoregulate` possa metterne uno nuovo.
  if (next.pendingAdjustments?.[session.dayIndex]) {
    next.pendingAdjustments = { ...next.pendingAdjustments };
    delete next.pendingAdjustments[session.dayIndex];
  }

  // ---- 4.4 Sedute saltate: prima di ogni altra cosa.
  const previous = previousSameDay(session, history)[0];
  if (previous) {
    const gap = daysBetween(previous.startedAt, session.startedAt);

    if (gap > VERY_STALE_DAYS) {
      for (const programDay of next.days) {
        for (const slot of programDay.slots) {
          if (slot.workingWeightKg === null) continue;
          slot.workingWeightKg = scaleWeight(
            byId.get(slot.exerciseId),
            slot.workingWeightKg,
            DELOAD_FACTOR
          );
          slot.failStreak = 0;
        }
      }
      return {
        program: next,
        notes: [
          `Sono passate più di tre settimane: tutti i carichi scendono del 10 % per ripartire in sicurezza.`,
        ],
      };
    }

    if (gap > STALE_DAYS) {
      return {
        program,
        notes: [
          `Sono passati ${gap} giorni dall'ultima volta su questo giorno: si ripete con gli stessi pesi, senza aumentare.`,
        ],
      };
    }
  }

  // ---- 4.1 e 4.2, slot per slot.
  const targetRIR = WEEK_PLANS[session.weekIndex]?.targetRIR ?? 2;
  const isDeloadWeek =
    session.weekIndex === WEEKS_PER_MESOCYCLE - 1 ||
    session.weekIndex === program.deloadAtWeek;

  for (const slot of day.slots) {
    const logs = workLogs.filter((log) => log.slotId === slot.id);
    if (logs.length === 0) continue;

    // 4.5: una seduta con un sostituto non insegna niente su questo slot.
    if (session.substitutions?.[slot.id]) continue;

    const exercise = byId.get(slot.exerciseId);

    if (slot.state === 'uncalibrated') {
      notes.push(calibrate(slot, exercise, logs));
      continue;
    }

    // In settimana di scarico si conferma il carico, non si progredisce.
    if (isDeloadWeek) continue;

    notes.push(doubleProgression(slot, exercise, logs, targetRIR));
  }

  notes.push(...proposeSubstitutions(next, session, history, byId));
  notes.push(
    ...autoregulate(next, session, history, byId, program.params?.level ?? 'intermediate')
  );

  return { program: notes.length === 0 ? program : next, notes };
}
