// Tempra v0.1.0 — 2026-09-04 08:24
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
  }),

  onboarding: Object.freeze({
    goalQuestion: 'Che obiettivo hai in mente?',
    daysQuestion: 'Quanti giorni a settimana puoi allenarti?',
    minutesQuestion: 'Quanto dura una seduta?',
    levelQuestion: 'Da quanto ti alleni con i pesi?',
    summaryTitle: 'La scheda suggerita',
    generate: 'Genera scheda',
  }),

  home: Object.freeze({
    nextSession: 'La prossima seduta',
    start: 'Inizia',
    changeDay: 'Cambia giorno',
    weekLabel: 'Settimana',
    estimatedDuration: 'Durata stimata',
  }),

  session: Object.freeze({
    shortOnTime: 'Ho poco tempo',
    endSession: 'Termina sessione',
    substitute: 'Sostituisci',
    firstTimeHint:
      'Prima volta: scegli un peso che sai gestire per il numero di ripetizioni indicato.',
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

  /** Segnaposto usati in Fase 0 finché le schermate non esistono davvero. */
  placeholder: Object.freeze({
    comingSoon: 'Questa schermata arriva in una fase successiva.',
  }),
});
