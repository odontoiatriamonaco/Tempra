// Tempra v0.6.0 — 2026-09-04 13:00
//
// Tutte le stringhe dell'interfaccia, in italiano. Nessun testo visibile
// all'utente va scritto dentro i componenti.
//
// Regola di linguaggio (spec 1.3): non prescrittivo. "scheda suggerita",
// "puoi provare"; mai "devi", mai un lessico clinico. L'unica eccezione è
// DISCLAIMER, che per legge parla di consulto sanitario: il test 10.8 controlla
// UI_STRINGS e salta DISCLAIMER.

/** Testo del disclaimer bloccante (spec 1.4). Esente dal test sul lessico. */
export const DISCLAIMER = Object.freeze({
  title: 'Prima di cominciare',
  paragraphs: Object.freeze([
    'Tempra è uno strumento per organizzare l’allenamento in palestra. Non è un servizio medico né un programma personalizzato da un professionista. Le schede sono schemi generici basati su principi di allenamento comunemente accettati, non valutano il tuo stato di salute e non tengono conto di eventuali condizioni personali.',
    'Prima di iniziare qualsiasi attività fisica intensa consulta un medico, soprattutto se hai dubbi sulla tua idoneità. Allenati con la tecnica corretta, con carichi che sai gestire e interrompi in caso di dolore.',
    'Usando Tempra confermi di avere almeno 18 anni, di aver letto quanto sopra e di allenarti sotto la tua esclusiva responsabilità. Tutti i dati restano sul tuo dispositivo.',
  ]),
  accept: 'Ho letto e accetto',
  scrollHint: 'Scorri fino in fondo per continuare',
  /** Versione di una riga, in fondo alla schermata di sessione (spec 1.4). */
  short:
    'Tempra propone schemi generici e non valuta il tuo stato di salute. Ti alleni sotto la tua responsabilità.',
});

/** Nomi dei gruppi muscolari, per la mappa e il catalogo. */
export const MUSCLE_LABELS = Object.freeze({
  chest: 'Petto',
  'front-delts': 'Deltoidi anteriori',
  'side-delts': 'Deltoidi laterali',
  'rear-delts': 'Deltoidi posteriori',
  lats: 'Dorsali',
  'upper-back': 'Alto schiena',
  'lower-back': 'Lombari',
  traps: 'Trapezi',
  biceps: 'Bicipiti',
  triceps: 'Tricipiti',
  forearms: 'Avambracci',
  quads: 'Quadricipiti',
  hamstrings: 'Femorali',
  glutes: 'Glutei',
  calves: 'Polpacci',
  abs: 'Addome',
  obliques: 'Obliqui',
});

/** Tutto il resto dell'interfaccia. */
export const UI_STRINGS = Object.freeze({
  app: Object.freeze({
    name: 'Tempra',
    tagline: 'Il tuo allenamento, sul tuo telefono e basta.',
    version: 'Versione',
    loading: 'Un attimo…',
  }),

  nav: Object.freeze({
    home: 'Oggi',
    progress: 'Progressi',
    catalog: 'Esercizi',
    settings: 'Impostazioni',
  }),

  common: Object.freeze({
    confirm: 'Conferma',
    cancel: 'Annulla',
    back: 'Indietro',
    next: 'Avanti',
    close: 'Chiudi',
    save: 'Salva',
    edit: 'Modifica',
    notFound: 'Non abbiamo trovato questa pagina.',
    goHome: 'Torna alla schermata iniziale',
    minutes: 'min',
    sets: 'serie',
  }),

  onboarding: Object.freeze({
    step: 'Passo',
    goalQuestion: 'Che obiettivo hai in mente?',
    goals: Object.freeze({
      strength: {
        title: 'Forza',
        detail: 'Carichi alti e poche ripetizioni, recuperi lunghi.',
      },
      hypertrophy: {
        title: 'Massa',
        detail: 'Ripetizioni medie e più serie, per far crescere i muscoli.',
      },
      recomp: {
        title: 'Ricomposizione',
        detail: 'Più lavoro in meno tempo, recuperi brevi.',
      },
    }),

    daysQuestion: 'Quanti giorni a settimana puoi allenarti?',
    daysDetail: 'Conta solo i giorni in cui sai di poterci andare davvero.',

    minutesQuestion: 'Quanto dura una seduta?',
    minutesDetail: 'Tempo in palestra, riscaldamento compreso.',

    levelQuestion: 'Da quanto ti alleni con i pesi?',
    levels: Object.freeze({
      beginner: { title: 'Principiante', detail: 'Meno di un anno continuativo' },
      intermediate: { title: 'Intermedio', detail: 'Da uno a tre anni' },
      advanced: { title: 'Avanzato', detail: 'Più di tre anni' },
    }),

    summaryTitle: 'La scheda suggerita',
    summarySplit: 'Struttura',
    summaryVolume: 'Volume settimanale',
    generate: 'Genera scheda',
    regenerate: 'Prova un’altra combinazione',
    exercisesPreview: 'esercizi',
  }),

  home: Object.freeze({
    greeting: 'Oggi',
    nextSession: 'La prossima seduta',
    start: 'Inizia',
    changeDay: 'Cambia giorno',
    chooseDay: 'Scegli il giorno',
    done: 'Fatto',
    todo: 'Da fare',
    sessionsDone: 'sedute completate',
    weekLabel: 'Settimana',
    weekOf: 'di',
    deloadWeek: 'Settimana di scarico',
    targetRir: 'RIR target',
    estimatedDuration: 'Durata stimata',
    heatmapTitle: 'Come stai coprendo i muscoli',
    heatmapEmpty: 'Nessuna serie registrata questa settimana.',
    heatmapOf: 'di',
    notesTitle: 'Dalla scorsa volta',
    alreadyDoneWarning:
      'Questo giorno è già completato questa settimana. Verrà registrato come seduta extra e non conterà per la progressione.',
    allDone: 'Hai completato tutti i giorni di questa settimana. Puoi ripeterne uno come seduta extra.',
  }),

  session: Object.freeze({
    shortOnTime: 'Ho poco tempo',
    shortOnTimeQuestion: 'Quanti minuti hai oggi?',
    reducedTo: 'Seduta ridotta a {n} minuti.',
    reducedOver: 'con i fondamentali non si scende sotto questa durata',
    endSession: 'Termina sessione',
    confirmEndTitle: 'Chiudere qui?',
    confirmEndBody:
      'Restano {n} esercizi non completati. Puoi chiudere lo stesso: conta quello che hai fatto.',
    confirmEnd: 'Chiudi la seduta',

    substitute: 'Sostituisci',
    substituteTitle: 'Con quale esercizio?',

    statusTodo: 'Da fare',
    statusDoing: 'In corso',
    statusDone: 'Fatto',

    weight: 'Peso',
    reps: 'Ripetizioni',
    setShort: 'Serie ',
    warmupShort: 'Avvic.',
    completeSet: 'Registra la serie',
    completed: 'Serie registrata',

    rirQuestion: 'Quante ne avevi ancora?',
    rirWords: Object.freeze({
      easy: 'Facile',
      right: 'Giusta',
      limit: 'Al limite',
    }),

    lastTime: 'Ultima volta:',
    firstTime: 'Prima volta: scegli un peso che sai gestire per',

    imageStart: 'posizione iniziale',
    imageEnd: 'posizione finale',

    addNote: 'Aggiungi una nota per questo esercizio',
    noteLabel: 'Nota personale (altezza sedile, fermi, impugnatura…)',
    notePlaceholder: 'Sedile al foro 4, fermi larghi',
  }),

  timer: Object.freeze({
    ready: 'Vai',
    skip: 'Salta',
  }),

  plates: Object.freeze({
    title: 'Come caricare il bilanciere',
    perSide: 'Per lato:',
    emptyBar: 'Bilanciere scarico.',
    belowBar: 'Meno di un bilanciere scarico: usa i manubri.',
    notComposable: 'Non componibile con i dischi in palestra: arrotonda a',
    or: 'o',
  }),

  feedback: Object.freeze({
    title: 'Com’è andata?',
    difficulty: 'Com’è andata la seduta?',
    difficultyLabels: Object.freeze({
      easy: 'Facile',
      right: 'Giusta',
      hard: 'Dura',
    }),
    energy: 'Energia oggi?',
    energyLabels: Object.freeze({
      low: 'Poca',
      normal: 'Normale',
      high: 'Tanta',
    }),
    soreness: 'Indolenzimento dalla scorsa?',
    sorenessLabels: Object.freeze({
      none: 'Nessuno',
      some: 'Un po’',
      'a-lot': 'Parecchio',
    }),
    confirm: 'Salva e chiudi',
    summaryTitle: 'Seduta chiusa',
    workSets: 'Serie di lavoro',
    tonnage: 'Tonnellaggio',
    duration: 'Durata',
    notesTitle: 'Per la prossima volta',
    noNotes: 'Niente da cambiare per la prossima volta.',
  }),

  settings: Object.freeze({
    theme: 'Tema',
    themeSystem: 'Come il sistema',
    themeLight: 'Chiaro',
    themeDark: 'Scuro',
    exportBackup: 'Esporta backup',
    importBackup: 'Importa backup',
    resetAll: 'Ricomincia da zero',
    license: 'Licenza',
  }),

  /** Segnaposto usati finché le schermate non esistono davvero. */
  placeholder: Object.freeze({
    comingSoon: 'Questa schermata arriva in una fase successiva.',
  }),
});

/** Etichette dei tier, per l'anteprima della scheda. */
export const TIER_LABELS = Object.freeze({
  main: 'Fondamentale',
  secondary: 'Complementare',
  accessory: 'Accessorio',
});
