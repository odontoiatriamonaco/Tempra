// Tempra v0.3.0 — 2026-09-04 10:40
//
// Motore di generazione della scheda. Spec sezione 3.
//
// `generateProgram(params, catalog, seed)` è una funzione pura: stessi
// argomenti, stesso risultato, sempre. Non legge l'orologio, non usa
// Math.random, non tocca il database.
//
// Due vincoli tagliano dall'alto e si incontrano nel mezzo:
//   · il tempo    — la seduta deve stare nel budget di minuti dichiarato (3.4);
//   · il volume   — nessun gruppo muscolare supera il massimo del suo livello (3.3).
// Quando il tempo non basta a raggiungere nemmeno il *minimo* del livello,
// il livello viene degradato e la cosa viene detta all'utente (`volumeNote`).

import { mulberry32, shuffle } from './prng.js';
import { LARGE_MUSCLES, SMALL_MUSCLES } from '../data/taxonomy.js';

// ---- Costanti del budget tempo (spec 3.4) --------------------------------

/** Riscaldamento generale, già scorporato dal budget utile. */
export const GENERAL_WARMUP_SEC = 480;

/** Esecuzione della serie e cambio disco, oltre al recupero. */
export const SET_OVERHEAD_SEC = 40;

/** Costo di una serie di avvicinamento. */
export const WARMUP_SET_SEC = 60;

/** Serie di avvicinamento per tier. */
export const WARMUP_SETS = Object.freeze({ main: 2, secondary: 1, accessory: 0 });

/** Sotto questa frazione del budget la seduta spreca tempo disponibile. */
export const MIN_BUDGET_RATIO = 0.85;

// ---- Parametri per obiettivo (spec 3.2) ----------------------------------

export const GOAL_PLAN = Object.freeze({
  strength: {
    main: { repMin: 3, repMax: 6, restSec: 180 },
    secondary: { repMin: 6, repMax: 8, restSec: 120 },
    accessory: { repMin: 10, repMax: 15, restSec: 90 },
  },
  hypertrophy: {
    main: { repMin: 6, repMax: 10, restSec: 150 },
    secondary: { repMin: 8, repMax: 12, restSec: 105 },
    accessory: { repMin: 12, repMax: 15, restSec: 75 },
  },
  recomp: {
    main: { repMin: 6, repMax: 10, restSec: 120 },
    secondary: { repMin: 8, repMax: 12, restSec: 90 },
    accessory: { repMin: 12, repMax: 20, restSec: 60 },
  },
});

// ---- Volume settimanale per livello (spec 3.3) ---------------------------

export const VOLUME_TARGET = Object.freeze({
  beginner: { min: 8, max: 10 },
  intermediate: { min: 12, max: 16 },
  advanced: { min: 16, max: 20 },
});

/** Dal più alto al più basso: è l'ordine della degradazione onesta (3.3). */
export const LEVEL_LADDER = Object.freeze(['advanced', 'intermediate', 'beginner']);

/** Serie iniziali per slot (spec 3.5 punto 6). */
const BASE_SETS = Object.freeze({
  beginner: { main: 3, secondary: 2, accessory: 2 },
  intermediate: { main: 3, secondary: 3, accessory: 2 },
  advanced: { main: 3, secondary: 3, accessory: 2 },
});

/** Sotto queste soglie uno slot non ha più senso di esistere. */
const MIN_SETS = Object.freeze({ main: 2, secondary: 2, accessory: 1 });

/** Tetto per slot: evita che il riempimento produca sedute assurde. */
const MAX_SETS = Object.freeze({ main: 5, secondary: 5, accessory: 4 });

/**
 * Quanti pattern multiarticolari al massimo in una seduta, per livello.
 * Non è un vincolo di tempo ma di volume: tre grandi multiarticolari in un
 * giorno producono da soli più serie di quante ne preveda il range di un
 * principiante, e nessun accessorio potrebbe più rientrare. È il modo in cui
 * si applica la nota di 3.1 («beginner con 4+ giorni: stesso split, volume da
 * principiante»).
 */
const MAX_PATTERNS_BY_LEVEL = Object.freeze({
  beginner: 2,
  intermediate: 3,
  advanced: 4,
});

/**
 * Frazione del budget che i main possono occupare al massimo. Oltre questa
 * soglia la seduta diventa una sequenza di multiarticolari senza spazio per
 * gli accessori, e i gruppi che si allenano solo in isolamento restano a zero.
 */
const MAIN_BUDGET_SHARE = 0.6;

// ---- Split (spec 3.1) -----------------------------------------------------

const ISO_UPPER = [
  'iso-chest',
  'iso-back',
  'iso-delt-side',
  'iso-delt-rear',
  'iso-biceps',
  'iso-triceps',
];
const ISO_LOWER = ['iso-quad', 'iso-ham', 'iso-glute', 'iso-calf', 'core'];
const ISO_PUSH = ['iso-chest', 'iso-delt-side', 'iso-triceps'];
const ISO_PULL = ['iso-back', 'iso-delt-rear', 'iso-biceps'];
const ISO_FULL = [...ISO_LOWER, ...ISO_UPPER];

/**
 * Per ogni giorno: i pattern multiarticolari in ordine di priorità (quelli che
 * non entrano nel budget vengono lasciati fuori, non compressi) e i pattern di
 * isolamento da cui pescare gli accessori.
 */
const SPLITS = Object.freeze({
  // Nei full body l'ordine dei pattern è pensato per la troncatura: quando il
  // budget lascia passare solo i primi due, la settimana deve contenere
  // comunque una spinta, una trazione e le gambe.
  2: {
    type: 'full-body',
    days: [
      { label: 'Full body A', patterns: ['squat', 'h-pull', 'h-push', 'hinge'], isolation: ISO_FULL },
      { label: 'Full body B', patterns: ['hinge', 'v-push', 'v-pull', 'lunge'], isolation: ISO_FULL },
    ],
  },
  3: {
    type: 'full-body',
    days: [
      { label: 'Full body A', patterns: ['squat', 'h-push', 'h-pull'], isolation: ISO_FULL },
      { label: 'Full body B', patterns: ['hinge', 'v-pull', 'v-push'], isolation: ISO_FULL },
      { label: 'Full body C', patterns: ['lunge', 'h-pull', 'h-push'], isolation: ISO_FULL },
    ],
  },
  4: {
    type: 'upper-lower',
    days: [
      { label: 'Upper A', patterns: ['h-push', 'h-pull', 'v-push', 'v-pull'], isolation: ISO_UPPER },
      { label: 'Lower A', patterns: ['squat', 'hinge', 'lunge'], isolation: ISO_LOWER },
      { label: 'Upper B', patterns: ['v-push', 'v-pull', 'h-push', 'h-pull'], isolation: ISO_UPPER },
      { label: 'Lower B', patterns: ['hinge', 'squat', 'lunge'], isolation: ISO_LOWER },
    ],
  },
  5: {
    type: 'ppl-ul',
    days: [
      { label: 'Push', patterns: ['h-push', 'v-push'], isolation: ISO_PUSH },
      { label: 'Pull', patterns: ['h-pull', 'v-pull'], isolation: ISO_PULL },
      { label: 'Legs', patterns: ['squat', 'hinge', 'lunge'], isolation: ISO_LOWER },
      { label: 'Upper', patterns: ['v-push', 'v-pull', 'h-push', 'h-pull'], isolation: ISO_UPPER },
      { label: 'Lower', patterns: ['hinge', 'squat', 'lunge'], isolation: ISO_LOWER },
    ],
  },
  6: {
    type: 'ppl',
    days: [
      { label: 'Push A', patterns: ['h-push', 'v-push'], isolation: ISO_PUSH },
      { label: 'Pull A', patterns: ['h-pull', 'v-pull'], isolation: ISO_PULL },
      { label: 'Legs A', patterns: ['squat', 'lunge'], isolation: ISO_LOWER },
      { label: 'Push B', patterns: ['v-push', 'h-push'], isolation: ISO_PUSH },
      { label: 'Pull B', patterns: ['v-pull', 'h-pull'], isolation: ISO_PULL },
      { label: 'Legs B', patterns: ['hinge', 'lunge'], isolation: ISO_LOWER },
    ],
  },
});

// ---- Stima dei tempi ------------------------------------------------------

/**
 * Secondi stimati per uno slot: serie di lavoro più serie di avvicinamento.
 * @param {{ tier: string, sets: number, restSec: number }} slot
 * @returns {number}
 */
export function estimateSlotSeconds(slot) {
  const work = slot.sets * (slot.restSec + SET_OVERHEAD_SEC);
  return work + WARMUP_SETS[slot.tier] * WARMUP_SET_SEC;
}

/**
 * @param {ReadonlyArray<object>} slots
 * @returns {number}
 */
export function estimateDaySeconds(slots) {
  return slots.reduce((total, slot) => total + estimateSlotSeconds(slot), 0);
}

/**
 * Budget utile della seduta: i minuti dichiarati meno il riscaldamento
 * generale (spec 3.4).
 * @param {number} minutesPerSession
 * @returns {number}
 */
export function sessionBudgetSeconds(minutesPerSession) {
  return minutesPerSession * 60 - GENERAL_WARMUP_SEC;
}

// ---- Volume ---------------------------------------------------------------

/**
 * Target settimanale per un gruppo: dimezzato per i gruppi piccoli (3.3).
 * @param {string} muscle
 * @param {'beginner'|'intermediate'|'advanced'} level
 * @returns {{ min: number, max: number }}
 */
export function volumeTargetFor(muscle, level) {
  const target = VOLUME_TARGET[level];
  if (!SMALL_MUSCLES.includes(muscle)) return target;
  return { min: Math.round(target.min / 2), max: Math.round(target.max / 2) };
}

/**
 * Serie settimanali per gruppo muscolare primario.
 * @param {ReadonlyArray<object>} days
 * @param {Map<string, object>} byId
 * @returns {Record<string, number>}
 */
export function weeklyVolume(days, byId) {
  /** @type {Record<string, number>} */
  const volume = {};
  for (const day of days) {
    for (const slot of day.slots) {
      const exercise = byId.get(slot.exerciseId);
      for (const muscle of exercise.primaryMuscles) {
        volume[muscle] = (volume[muscle] ?? 0) + slot.sets;
      }
    }
  }
  return volume;
}

// ---- Costruzione ----------------------------------------------------------

/**
 * @param {object} exercise
 * @param {'main'|'secondary'|'accessory'} tier
 * @param {object} plan parametri dell'obiettivo per quel tier
 * @param {number} sets
 * @param {number} dayIndex
 * @returns {object} slot
 */
function makeSlot(exercise, tier, plan, sets, dayIndex) {
  return {
    // Id derivato, non casuale: `generateProgram` deve restare deterministica
    // (criterio 3.7). Un esercizio non si ripete mai nello stesso giorno,
    // quindi la coppia giorno + esercizio è già univoca.
    id: `${dayIndex}-${exercise.id}`,
    exerciseId: exercise.id,
    tier,
    order: 0,
    sets,
    repMin: plan.repMin,
    repMax: plan.repMax,
    restSec: plan.restSec,
    workingWeightKg: null,
    state: 'uncalibrated',
    failStreak: 0,
  };
}

/**
 * Quante serie in più questo gruppo può ancora ricevere prima del massimo.
 * @param {object} exercise
 * @param {Record<string, number>} volume
 * @param {string} level
 * @returns {number}
 */
function headroom(exercise, volume, level) {
  let smallest = Infinity;
  for (const muscle of exercise.primaryMuscles) {
    const target = volumeTargetFor(muscle, level);
    smallest = Math.min(smallest, target.max - (volume[muscle] ?? 0));
  }
  return smallest;
}

/**
 * Quanto questo esercizio colma il deficit settimanale: è il criterio con cui
 * si scelgono gli accessori (spec 3.5 punto 4).
 * @param {object} exercise
 * @param {Record<string, number>} volume
 * @param {string} level
 * @returns {number}
 */
function deficitScore(exercise, volume, level) {
  let score = 0;
  for (const muscle of exercise.primaryMuscles) {
    const target = volumeTargetFor(muscle, level);
    score += Math.max(0, target.min - (volume[muscle] ?? 0));
  }
  return score;
}

/**
 * Costruisce un programma per un livello di volume dato. Non decide se il
 * livello sia sostenibile: quello lo stabilisce `generateProgram`.
 * Esportata perché i test sulla degradazione hanno bisogno di vedere il
 * tentativo a ciascun livello, non solo quello vincente.
 */
export function buildProgramForLevel(params, catalog, seed, level) {
  const rng = mulberry32(seed);
  const split = SPLITS[params.daysPerWeek];
  const plan = GOAL_PLAN[params.goal];
  const base = BASE_SETS[level];
  const budget = sessionBudgetSeconds(params.minutesPerSession);
  const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]));

  // Rotazione degli esercizi per pattern e tier: mescolata una volta sola con
  // il seed, poi consumata in ordine. È così che due giorni con lo stesso
  // pattern ricevono main diversi (criterio 3.7).
  /** @type {Record<string, Record<string, object[]>>} */
  const rotation = {};
  for (const exercise of catalog) {
    rotation[exercise.pattern] ??= { main: [], secondary: [], accessory: [] };
    rotation[exercise.pattern][exercise.tier].push(exercise);
  }
  for (const pattern of Object.keys(rotation)) {
    for (const tier of ['main', 'secondary', 'accessory']) {
      rotation[pattern][tier] = shuffle(rng, rotation[pattern][tier]);
    }
  }

  /**
   * Posizione raggiunta nella rotazione di ogni coppia pattern+tier. È così
   * che due giorni con lo stesso pattern ricevono esercizi diversi.
   */
  const used = {};

  /**
   * Prende il prossimo esercizio della rotazione che superi il filtro. I
   * candidati scartati **non** consumano la rotazione: altrimenti un esercizio
   * respinto dal tetto di volume farebbe perdere il turno a tutto il giorno.
   *
   * @param {string} pattern
   * @param {'main'|'secondary'|'accessory'} tier
   * @param {(exercise: object) => boolean} isUsable
   * @returns {object|null}
   */
  const takeNext = (pattern, tier, isUsable = () => true) => {
    const pool = rotation[pattern]?.[tier] ?? [];
    const key = `${pattern}:${tier}`;
    const start = used[key] ?? 0;
    for (let step = 0; step < pool.length; step += 1) {
      const candidate = pool[(start + step) % pool.length];
      if (isUsable(candidate)) {
        used[key] = start + step + 1;
        return candidate;
      }
    }
    return null;
  };

  /** @type {Record<string, number>} */
  const volume = {};
  const addVolume = (exercise, sets) => {
    for (const muscle of exercise.primaryMuscles) {
      volume[muscle] = (volume[muscle] ?? 0) + sets;
    }
  };

  const costOf = (tier, sets, restSec) =>
    sets * (restSec + SET_OVERHEAD_SEC) + WARMUP_SETS[tier] * WARMUP_SET_SEC;

  // ---- Passata 1: la struttura del giorno (main e secondary).
  // Main e secondary definiscono lo split e non sono soggetti al tetto di
  // volume: sono loro a stabilirlo. Il tetto governa solo gli accessori e la
  // crescita delle serie, nelle passate successive.

  const days = split.days.map((dayDef, dayIndex) => {
    const slots = [];
    const taken = new Set();
    let seconds = 0;

    // Quanti pattern ci stanno. Tre vincoli che si incontrano:
    //  · quanti main entrano al minimo delle serie — meglio due esercizi da
    //    due serie che uno solo da tre (criterio 3.7 sui 30 minuti in forza);
    //  · la quota di budget che i main possono occupare, per lasciare spazio
    //    agli accessori;
    //  · il tetto per livello, che è un vincolo di volume, non di tempo.
    // La quota di budget non può però scendere sotto due pattern: a 30 minuti
    // sarebbe l'unico vincolo attivo e degenererebbe in un solo main.
    const fitAtMinSets = Math.floor(budget / costOf('main', MIN_SETS.main, plan.main.restSec));
    const budgetShare = Math.floor(
      (budget * MAIN_BUDGET_SHARE) / costOf('main', base.main, plan.main.restSec)
    );
    const maxPatterns = Math.max(
      1,
      Math.min(fitAtMinSets, Math.max(2, budgetShare), MAX_PATTERNS_BY_LEVEL[level])
    );
    const patterns = dayDef.patterns.slice(0, maxPatterns);

    for (const pattern of patterns) {
      const exercise = takeNext(pattern, 'main', (e) => !taken.has(e.id));
      if (!exercise) continue;
      taken.add(exercise.id);
      const slot = makeSlot(exercise, 'main', plan.main, base.main, dayIndex);
      slots.push(slot);
      seconds += estimateSlotSeconds(slot);
    }

    // Riduci le serie dei main, dall'ultimo al primo, finché la seduta rientra.
    for (let i = slots.length - 1; i >= 0 && seconds > budget; i -= 1) {
      while (slots[i].sets > MIN_SETS.main && seconds > budget) {
        slots[i].sets -= 1;
        seconds -= slots[i].restSec + SET_OVERHEAD_SEC;
      }
    }

    return {
      index: dayIndex,
      label: dayDef.label,
      patterns,
      pendingSecondary: [...patterns],
      slots,
      taken,
      seconds,
      accessoryPool: dayDef.isolation.flatMap(
        (pattern) => rotation[pattern]?.accessory ?? []
      ),
    };
  });

  for (const day of days) {
    for (const slot of day.slots) addVolume(byId.get(slot.exerciseId), slot.sets);
  }

  // ---- Passata 1b: un secondary per pattern, a rotazione tra i giorni.
  // A differenza dei main, i secondary rispettano il tetto di volume: sono il
  // primo posto in cui si può togliere lavoro senza smontare lo split.
  const addSecondary = (day) => {
    const cost = costOf('secondary', base.secondary, plan.secondary.restSec);
    while (day.pendingSecondary.length > 0) {
      const pattern = day.pendingSecondary.shift();
      if (day.seconds + cost > budget) continue;
      const exercise = takeNext(
        pattern,
        'secondary',
        (e) => !day.taken.has(e.id) && headroom(e, volume, level) >= base.secondary
      );
      if (!exercise) continue;
      day.taken.add(exercise.id);
      day.slots.push(
        makeSlot(exercise, 'secondary', plan.secondary, base.secondary, day.index)
      );
      day.seconds += cost;
      addVolume(exercise, base.secondary);
      return true;
    }
    return false;
  };

  for (let progressed = true; progressed; ) {
    progressed = false;
    for (const day of days) {
      if (addSecondary(day)) progressed = true;
    }
  }

  // ---- Passata 2: accessori per i gruppi in deficit, a rotazione tra i
  // giorni. Costruire un giorno per volta fino a saturazione affamerebbe gli
  // ultimi: il tetto di volume è settimanale, non giornaliero.

  const addAccessory = (day, sets) => {
    let best = null;
    let bestScore = 0;
    for (const exercise of day.accessoryPool) {
      if (day.taken.has(exercise.id)) continue;
      if (headroom(exercise, volume, level) < sets) continue;
      const score = deficitScore(exercise, volume, level);
      if (score > bestScore) {
        best = exercise;
        bestScore = score;
      }
    }
    if (!best) return false;
    const cost = costOf('accessory', sets, plan.accessory.restSec);
    if (day.seconds + cost > budget) return false;
    day.taken.add(best.id);
    day.slots.push(makeSlot(best, 'accessory', plan.accessory, sets, day.index));
    day.seconds += cost;
    addVolume(best, sets);
    return true;
  };

  const growSlot = (day, tier) => {
    for (const slot of day.slots) {
      if (slot.tier !== tier || slot.sets >= MAX_SETS[tier]) continue;
      const exercise = byId.get(slot.exerciseId);
      if (headroom(exercise, volume, level) < 1) continue;
      const cost = slot.restSec + SET_OVERHEAD_SEC;
      if (day.seconds + cost > budget) continue;
      slot.sets += 1;
      day.seconds += cost;
      addVolume(exercise, 1);
      return true;
    }
    return false;
  };

  for (let progressed = true; progressed; ) {
    progressed = false;
    for (const day of days) {
      if (addAccessory(day, base.accessory)) progressed = true;
    }
  }

  // ---- Passata 3: riempimento fino all'85 % del budget, sempre a rotazione.
  // Non si sfora mai né il budget né il massimo di volume del livello: se il
  // tetto arriva prima dell'85 %, la seduta finisce più corta ed è giusto così.

  const fillTarget = budget * MIN_BUDGET_RATIO;
  for (let progressed = true; progressed; ) {
    progressed = false;
    for (const day of days) {
      if (day.seconds >= fillTarget) continue;
      const moved =
        growSlot(day, 'secondary') ||
        growSlot(day, 'main') ||
        growSlot(day, 'accessory') ||
        addAccessory(day, MIN_SETS.accessory);
      if (moved) progressed = true;
    }
  }

  // ---- Ordine: main, secondary, accessory; dentro il tier, prima gli
  // esercizi che coinvolgono più muscoli (spec 3.5 punto 7).
  const tierRank = { main: 0, secondary: 1, accessory: 2 };
  const involved = (slot) => {
    const exercise = byId.get(slot.exerciseId);
    return exercise.primaryMuscles.length + exercise.secondaryMuscles.length;
  };

  const finalDays = days.map((day) => {
    const slots = [...day.slots].sort((a, b) => {
      if (tierRank[a.tier] !== tierRank[b.tier]) return tierRank[a.tier] - tierRank[b.tier];
      const diff = involved(b) - involved(a);
      return diff !== 0 ? diff : a.exerciseId.localeCompare(b.exerciseId);
    });
    slots.forEach((slot, index) => {
      slot.order = index;
    });
    return {
      index: day.index,
      label: day.label,
      patterns: day.patterns,
      slots,
      estimatedSeconds: day.seconds,
    };
  });

  return { splitType: split.type, days: finalDays, volume: weeklyVolume(finalDays, byId) };
}

/**
 * Serie di scarto tollerate nel decidere se un livello è sostenibile. Una
 * serie in meno su un gruppo non cambia il livello di allenamento di nessuno:
 * senza questa tolleranza, chi si allena cinque giorni si sentirebbe dire che
 * ha un volume da principiante per un solo set di differenza.
 */
const MINIMUM_VOLUME_TOLERANCE = 1;

/**
 * Il livello è sostenibile se ogni gruppo grande arriva almeno al minimo del
 * suo range, a meno della tolleranza. Se non ci arriva, non è colpa del
 * programma: è il tempo che non basta, e il livello va degradato (spec 3.3).
 */
function meetsMinimumVolume(volume, level) {
  return LARGE_MUSCLES.every(
    (muscle) =>
      (volume[muscle] ?? 0) >=
      volumeTargetFor(muscle, level).min - MINIMUM_VOLUME_TOLERANCE
  );
}

const LEVEL_LABEL = Object.freeze({
  beginner: 'da principiante',
  intermediate: 'da intermedio',
  advanced: 'da avanzato',
});

/**
 * @param {object} params
 * @param {string} effectiveLevel
 * @returns {string}
 */
function volumeNoteFor(params, effectiveLevel) {
  return (
    `Con ${params.daysPerWeek} giorni da ${params.minutesPerSession} minuti il volume ` +
    `settimanale sarà ${LEVEL_LABEL[effectiveLevel]}, non ${LEVEL_LABEL[params.level]}. ` +
    `Aggiungi un giorno o allunga le sedute per salire.`
  );
}

/**
 * Genera il mesociclo di 6 settimane.
 *
 * @param {{ goal: string, daysPerWeek: number, minutesPerSession: number, level: string }} params
 * @param {ReadonlyArray<object>} catalog
 * @param {number} seed
 * @param {{ id?: string, createdAt?: string }} [meta] id e data di creazione;
 *   hanno un default derivato dal seed perché la funzione resta pura.
 * @returns {object} Program
 */
export function generateProgram(params, catalog, seed, meta = {}) {
  const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]));

  // Parti dal livello dichiarato e scendi finché il volume minimo è raggiungibile.
  const ladder = LEVEL_LADDER.slice(LEVEL_LADDER.indexOf(params.level));
  let effectiveLevel = ladder[ladder.length - 1];
  let built = null;
  let reachesMinimum = false;

  for (const level of ladder) {
    const candidate = buildProgramForLevel(params, catalog, seed, level);
    built = candidate;
    effectiveLevel = level;
    if (meetsMinimumVolume(candidate.volume, level)) {
      reachesMinimum = true;
      break;
    }
  }

  const days = built.days.map((day) => ({
    index: day.index,
    label: day.label,
    patterns: day.patterns,
    slots: day.slots,
    estimatedSeconds: day.estimatedSeconds,
  }));

  return {
    id: meta.id ?? `program-${seed}`,
    createdAt: meta.createdAt ?? null,
    status: 'active',
    params: {
      goal: params.goal,
      daysPerWeek: params.daysPerWeek,
      minutesPerSession: params.minutesPerSession,
      level: params.level,
    },
    splitType: built.splitType,
    effectiveLevel,
    volumeNote:
      effectiveLevel === params.level ? null : volumeNoteFor(params, effectiveLevel),
    // Quando nemmeno il livello più basso raggiunge il minimo, `volumeNote`
    // resta null per contratto (criterio 3.7: è null quando il livello non è
    // stato degradato) ma l'utente ha comunque diritto di saperlo.
    volumeWarning: reachesMinimum
      ? null
      : `Con ${params.daysPerWeek} giorni da ${params.minutesPerSession} minuti il volume ` +
        `settimanale resta sotto il minimo consigliato anche per un principiante. ` +
        `È comunque un allenamento: aggiungi un giorno o allunga le sedute per salire.`,
    weeks: 6,
    days,
    weeklyVolume: weeklyVolume(days, byId),
  };
}
