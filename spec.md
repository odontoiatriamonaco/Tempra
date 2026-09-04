<!-- Tempra — spec.md v0.2.0 — 2026-09-03 -->

# Tempra — Specifica di progetto

PWA per l'allenamento con i pesi in palestra. Genera una scheda periodizzata a partire da quattro input (obiettivo, giorni, minuti, livello), guida la sessione in tempo reale e adatta la scheda successiva in base a come sono andate le serie. Tutto gira sul dispositivo: nessun server, nessun account, nessun dato in uscita.

Questo documento è la fonte di verità per l'implementazione. Ogni sezione "Criteri di verifica" definisce cosa deve essere vero perché quella parte sia considerata fatta.

---

## 0. Istruzioni per l'agente di coding

- Lingua dell'interfaccia: **italiano**. Lingua del codice, commenti e nomi: **inglese**.
- Ogni file principale (`index.html`, `sw.js`, `src/main.jsx`, ogni modulo in `src/engine/`) porta in testa un commento `// Tempra vX.Y.Z — YYYY-MM-DD HH:MM` che **va aggiornato a ogni modifica** del file. La versione applicativa vive in un solo posto (`src/version.js`) e viene letta da lì per la UI e per il service worker.
- Lavora per fasi (sezione 11). Non passare alla fase successiva finché i test della fase corrente non sono verdi.
- Non aggiungere dipendenze oltre a quelle elencate in sezione 9 senza motivarlo in un commento nel `package.json`.
- Non introdurre alcuna chiamata di rete a runtime oltre al fetch degli asset statici dell'app stessa. Vedi sezione 1.3: è un requisito, non una preferenza.
- Quando un requisito è ambiguo, scegli l'opzione più semplice e annotala in `DECISIONS.md`.

---

## 1. Perimetro

### 1.1 Cosa fa Tempra

1. Onboarding con quattro domande → genera un mesociclo di 6 settimane (5 di carico + 1 di scarico).
2. Sessione guidata: esercizi in ordine, registrazione di peso/ripetizioni/RIR per ogni serie, timer di recupero automatico, sostituzione esercizio, modalità "poco tempo".
3. Feedback di fine sessione (tre domande a pulsanti).
4. Motore di progressione che calcola pesi e serie della sessione successiva.
5. Mappa muscolare SVG: per singolo esercizio e come mappa di calore settimanale.
6. Progressi: grafico del carico stimato (e1RM) per esercizio; peso corporeo e circonferenze facoltativi.
7. Export/import JSON completo; funzionamento offline; installabile su iOS e Android.

### 1.2 Cosa resta deliberatamente fuori (e perché)

| Escluso | Motivo |
|---|---|
| Campo patologie, farmaci, infortuni, anamnesi di qualsiasi tipo | Trasformerebbe l'app in uno strumento che valuta lo stato di salute: cambia la natura giuridica del software (MDR) e la responsabilità. La scheda non ne ha bisogno. |
| Stime di massa grassa / composizione corporea | Non misurabili con i dati disponibili; darebbero un numero pseudo-scientifico. Si mostrano solo peso e circonferenze come trend. |
| Calcolo calorico, deficit, piani alimentari | Massimo rapporto rischio/valore; potenzialmente dannoso per utenti con rapporto problematico con il cibo. Rimandato, e se mai entrerà sarà solo materiale educativo generico senza numeri personalizzati. |
| Campo età | Non serve al motore. Il disclaimer chiede la conferma di maggiore età. |
| Domanda sull'attrezzatura | Decisione di prodotto: l'app presuppone sempre una palestra completamente attrezzata. |
| Account, backend, analytics, cookie, crash reporting | Zero dati raccolti = zero titolarità di trattamento. |
| Riferimenti alla professione medica dell'autore | L'app è un progetto personale open source, non un consiglio sanitario. |
| Claim numerici sui risultati ("perdi X kg in Y settimane") | Nessuna promessa quantitativa, solo processo. |
| Animazioni degli esercizi | Rimandate a versioni successive, un esercizio alla volta. La v1 usa immagini a licenza libera + cue testuali. |

### 1.3 Requisiti non negoziabili

- **Nessun byte lascia il dispositivo.** Dopo il caricamento iniziale degli asset, l'app non effettua richieste HTTP. Verificato da test (sezione 10.6).
- **Disclaimer bloccante** alla prima apertura; la scheda non viene generata finché non è accettato. L'accettazione è registrata localmente con timestamp.
- **Linguaggio non prescrittivo** in tutta la UI: "scheda suggerita", "puoi provare", mai "devi" o "il tuo programma terapeutico".
- **Nessun titolo professionale** nell'app, nel README o nel manifest.
- **Licenza MIT** con la clausola "as is" ripetuta in italiano nel README.

### 1.4 Testo del disclaimer (v1)

> Tempra è uno strumento per organizzare l'allenamento in palestra. Non è un servizio medico né un programma personalizzato da un professionista. Le schede sono schemi generici basati su principi di allenamento comunemente accettati, non valutano il tuo stato di salute e non tengono conto di eventuali condizioni personali.
>
> Prima di iniziare qualsiasi attività fisica intensa consulta un medico, soprattutto se hai dubbi sulla tua idoneità. Allenati con la tecnica corretta, con carichi che sai gestire e interrompi in caso di dolore.
>
> Usando Tempra confermi di avere almeno 18 anni, di aver letto quanto sopra e di allenarti sotto la tua esclusiva responsabilità. Tutti i dati restano sul tuo dispositivo.
>
> [Ho letto e accetto]

Il testo va mostrato anche in Impostazioni e, in versione breve (una riga), in fondo alla schermata di sessione.

---

## 2. Modello dati

Storage: **IndexedDB** tramite la libreria `idb`. Database `tempra`, versione 1. Tutti gli id sono stringhe (`crypto.randomUUID()`). Tutte le date sono ISO 8601.

### 2.1 Store `profile` (singolo record, key `me`)

```ts
type Goal = 'strength' | 'hypertrophy' | 'recomp';
type Level = 'beginner' | 'intermediate' | 'advanced';

interface Profile {
  id: 'me';
  goal: Goal;
  daysPerWeek: 2 | 3 | 4 | 5 | 6;
  minutesPerSession: 30 | 45 | 60 | 75 | 90;
  level: Level;
  units: 'kg';                 // v1 solo kg; predisposto per 'lb'
  disclaimerAcceptedAt: string;
  createdAt: string;
  updatedAt: string;
}
```

### 2.2 Store `exercises` (catalogo, seedato al primo avvio da `src/data/exercises.json`)

```ts
type Pattern =
  | 'squat' | 'hinge' | 'lunge'
  | 'h-push' | 'v-push' | 'h-pull' | 'v-pull'
  | 'iso-quad' | 'iso-ham' | 'iso-glute' | 'iso-calf'
  | 'iso-chest' | 'iso-back' | 'iso-delt-side' | 'iso-delt-rear'
  | 'iso-biceps' | 'iso-triceps' | 'core';

type Muscle =
  | 'chest' | 'front-delts' | 'side-delts' | 'rear-delts'
  | 'lats' | 'upper-back' | 'lower-back' | 'traps'
  | 'biceps' | 'triceps' | 'forearms'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'abs' | 'obliques';

type Tier = 'main' | 'secondary' | 'accessory';

interface Exercise {
  id: string;                  // slug stabile, es. 'barbell-back-squat'
  name: string;                // italiano, es. 'Squat con bilanciere'
  pattern: Pattern;
  tier: Tier;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  equipment: string[];         // informativo, es. ['barbell','rack']
  unilateral: boolean;
  loadIncrementKg: 1.25 | 2.5 | 5;
  defaultRestSec: number;      // 90 | 120 | 180
  cues: string[];              // 3–4 indicazioni tecniche, italiano
  images: string[];            // path relativi in /public/images/exercises/
  license: { source: string; type: string; author?: string; url?: string };
  substitutes: string[];       // id di esercizi con stesso pattern, 2–3
}
```

Catalogo v1: **~60 esercizi**, palestra completa. Distribuzione minima: 2 main + 2 secondary per ognuno dei 7 pattern multiarticolari; 2 accessori per ogni pattern di isolamento; 3 esercizi core. Ogni esercizio deve avere almeno 2 sostituti validi.

### 2.3 Store `programs`

```ts
interface Program {
  id: string;
  createdAt: string;
  status: 'active' | 'completed' | 'abandoned';
  params: Pick<Profile, 'goal' | 'daysPerWeek' | 'minutesPerSession' | 'level'>;
  splitType: 'full-body' | 'upper-lower' | 'ppl' | 'ppl-ul';
  effectiveLevel: Level;       // livello di volume realmente applicato (sezione 3.3)
  volumeNote: string | null;   // spiegazione se effectiveLevel < params.level
  weeks: 6;
  days: ProgramDay[];          // length === daysPerWeek
}

interface ProgramDay {
  index: number;               // 0-based
  label: string;               // 'Full body A', 'Upper', 'Push'...
  slots: Slot[];
}

interface Slot {
  id: string;
  exerciseId: string;
  order: number;
  sets: number;                // serie di lavoro
  repMin: number;
  repMax: number;
  restSec: number;
  workingWeightKg: number | null;   // null finché non calibrato
  state: 'uncalibrated' | 'calibrated';
  failStreak: number;          // sessioni consecutive sotto repMin
}
```

Il `Program` è **mutabile**: il motore di progressione aggiorna `workingWeightKg`, `sets` e `failStreak` sugli slot. La storia resta nelle `sessions`.

### 2.4 Store `sessions`

```ts
interface Session {
  id: string;
  programId: string;
  dayIndex: number;
  weekIndex: number;           // 0–5
  startedAt: string;
  endedAt: string | null;
  status: 'in-progress' | 'completed' | 'abandoned';
  reducedToMinutes: number | null;   // se attivata "poco tempo"
  sets: SetLog[];
  feedback: SessionFeedback | null;
}

interface SetLog {
  slotId: string;
  exerciseId: string;          // può differire dallo slot se sostituito
  setIndex: number;
  weightKg: number;
  reps: number;
  rir: 0 | 1 | 2 | 3 | 4;      // ripetizioni in riserva (valore usato dal motore)
  rirInput: 'numeric' | 'easy' | 'right' | 'limit';
                               // come è stato inserito: numerico (intermediate/advanced)
                               // oppure a tre pulsanti (beginner): easy→3, right→2, limit→1
  isWarmup: boolean;
  completedAt: string;
}

interface SessionFeedback {
  difficulty: 'easy' | 'right' | 'hard';      // "Com'è andata la seduta?"
  energy: 'low' | 'normal' | 'high';           // "Energia oggi?"
  soreness: 'none' | 'some' | 'a-lot';         // "Indolenzimento dalla scorsa?"
}
```

### 2.5 Store `measurements` (facoltativo, inserito dall'utente)

```ts
interface Measurement {
  id: string;
  date: string;                // YYYY-MM-DD
  bodyweightKg?: number;
  waistCm?: number;
  chestCm?: number;
  hipsCm?: number;
  armCm?: number;
  thighCm?: number;
}
```

Nessun altro campo. Nessun calcolo derivato oltre al trend.

### 2.6 Store `exerciseNotes` (key: `exerciseId`)

```ts
interface ExerciseNote {
  exerciseId: string;
  text: string;                // max 200 caratteri, testo libero
  updatedAt: string;
}
```

Regolazioni pratiche dell'utente per quell'esercizio: altezza del sedile, posizione dei fermi, impugnatura, macchina preferita. È l'unico campo di testo libero dell'app (eccezione a 7.2). Visibile e modificabile dalla scheda esercizio in sessione.

### 2.7 Store `settings`

```ts
interface Settings {
  id: 'app';
  restTimerSound: boolean;
  restTimerVibrate: boolean;
  autoStartRestTimer: boolean;
  theme: 'system' | 'light' | 'dark';
}
```

### 2.8 Export/import

Un unico file `tempra-backup-YYYY-MM-DD.json` con `{ version, exportedAt, profile, programs, sessions, measurements, exerciseNotes, settings }`. Il catalogo esercizi **non** viene esportato (è nell'app). L'import sostituisce tutto previa conferma e valida lo schema; versioni precedenti vengono migrate.

---

## 3. Motore di generazione (`src/engine/generate.js`)

Funzione pura: `generateProgram(params, catalog, seed) → Program`. Deterministica dato il seed (usare un PRNG seedato, es. mulberry32).

### 3.1 Split in base ai giorni

| Giorni | Split | Giorni del programma |
|---|---|---|
| 2 | full-body | FB-A, FB-B |
| 3 | full-body | FB-A, FB-B, FB-C |
| 4 | upper-lower | Upper-A, Lower-A, Upper-B, Lower-B |
| 5 | ppl-ul | Push, Pull, Legs, Upper, Lower |
| 6 | ppl | Push-A, Pull-A, Legs-A, Push-B, Pull-B, Legs-B |

Livello `beginner` con 4+ giorni: usare comunque lo split indicato ma con volume da principiante (3.3).

### 3.2 Range di ripetizioni e recuperi per obiettivo

| Obiettivo | main | secondary | accessory | rest main | rest secondary | rest accessory |
|---|---|---|---|---|---|---|
| strength | 3–6 | 6–8 | 10–15 | 180 s | 120 s | 90 s |
| hypertrophy | 6–10 | 8–12 | 12–15 | 150 s | 105 s | 75 s |
| recomp | 6–10 | 8–12 | 12–20 | 120 s | 90 s | 60 s |

### 3.3 Volume settimanale target (serie di lavoro per gruppo muscolare primario)

| Livello | min | max |
|---|---|---|
| beginner | 8 | 10 |
| intermediate | 12 | 16 |
| advanced | 16 | 20 |

Il gruppo si considera "coperto" se il totale delle serie in cui è primario, sommato sulla settimana, è dentro il range. I gruppi piccoli (calves, forearms, obliques) hanno target dimezzato.

**Degradazione onesta del volume.** Il target di livello è un obiettivo, non un vincolo. Se il budget tempo settimanale (`daysPerWeek × budget utile`, sezione 3.4) non permette di raggiungere il minimo del range per i gruppi grandi, il motore scala il target al livello inferiore (advanced → intermediate → beginner) finché il programma è realizzabile, e registra in `program.volumeNote` un messaggio mostrato nel riepilogo di generazione, es. *"Con 2 giorni da 30 minuti il volume settimanale sarà da intermedio, non da avanzato. Aggiungi un giorno o allunga le sedute per salire."* Il test di 3.7 sul volume usa il target **effettivo** (`program.effectiveLevel`), non quello dichiarato.

### 3.4 Budget tempo di sessione

```
riscaldamento generale       = 8 min fissi
tempo per serie              = restSec + 40 s (esecuzione + cambio disco)
serie di avvicinamento       = 2 per ogni main lift, 1 per ogni secondary, 0 accessory
                               (contano come 60 s ciascuna)
budget utile                 = minutesPerSession*60 − 480
```

La sessione è valida se la somma dei tempi stimati è ≤ budget e ≥ 85 % del budget (non sprecare tempo disponibile).

### 3.5 Algoritmo di riempimento (per ogni giorno)

1. Determina i pattern del giorno in base allo split (es. Push = h-push, v-push, iso-chest, iso-delt-side, iso-triceps).
2. Inserisci **1 esercizio main** per ogni pattern multiarticolare del giorno. Alterna gli esercizi main tra giorni A/B con lo stesso pattern (es. squat il giorno A, front squat il giorno B) usando il seed.
3. Inserisci **1 secondary** per pattern multiarticolare, se il budget lo consente.
4. Aggiungi **accessory** per i gruppi che restano sotto il target settimanale, in ordine di deficit decrescente, finché il budget non è esaurito.
5. Se il budget è ancora sopra il 100 %, rimuovi accessori dall'ultimo inserito; se sotto l'85 %, aggiungi una serie ai secondary; se ancora sotto, aggiungi una serie ai main.
6. Serie iniziali per slot: main 3, secondary 3, accessory 2 (beginner: main 3, secondary 2, accessory 2).
7. Ordine nel giorno: main → secondary → accessory; dentro la stessa tier, prima gli esercizi con più muscoli coinvolti.

### 3.6 Periodizzazione del mesociclo (6 settimane)

| Settimana | RIR target | Serie | Note |
|---|---|---|---|
| 1 | 3 | base | Calibrazione dei carichi |
| 2 | 2 | base | |
| 3 | 2 | base +1 su secondary | |
| 4 | 1 | base +1 su secondary | |
| 5 | 1 | base +1 su tutti | Settimana di picco |
| 6 | 4 | 50 % (arrotondato per eccesso, min 1) | Scarico. Stesso peso, metà volume |

A fine settimana 6 l'app propone il nuovo mesociclo: stessi parametri, seed diverso (esercizi main ruotati), pesi di partenza = ultimi pesi calibrati.

### 3.7 Criteri di verifica

- [ ] `generateProgram` con lo stesso seed produce output identico (snapshot test).
- [ ] Per ogni combinazione di (goal × days × minutes × level) — 3×5×5×3 = 225 casi — il programma è valido: numero giorni corretto, ogni pattern multiarticolare del giorno presente come main, tempo stimato tra 85 % e 100 % del budget.
- [ ] Per ogni combinazione, il volume settimanale di ogni gruppo muscolare grande è dentro il range di `effectiveLevel`, tolleranza ±2 serie.
- [ ] `effectiveLevel` ≤ `params.level`; quando è inferiore, `volumeNote` è valorizzata; quando è uguale, è `null`. Caso esplicito: (advanced, 2 giorni, 30 min) → effectiveLevel = beginner.
- [ ] Nessun esercizio compare due volte nello stesso giorno.
- [ ] Con `daysPerWeek ≥ 4`, gli esercizi main di due giorni con stesso pattern sono diversi.
- [ ] Con 30 minuti e `strength`, il giorno contiene almeno 2 main lift (non degenera in solo accessori).
- [ ] Le settimane rispettano la tabella 3.6 (test parametrico su `getWeekPlan(program, weekIndex)`).

---

## 4. Motore di progressione (`src/engine/progress.js`)

Funzione pura: `applySession(program, session, history) → { program, notes[] }`. Viene invocata a fine sessione. `notes` è una lista di stringhe in italiano che spiegano ogni modifica (mostrate all'utente: la trasparenza è una funzione, non un log).

### 4.1 Calibrazione (slot `uncalibrated`)

Alla prima sessione di un esercizio, la UI chiede un peso di partenza e lo registra come qualsiasi altra serie. A fine sessione:

```
se tutte le serie hanno reps ≥ repMin e RIR medio ≥ 2  → workingWeightKg = peso usato; state = calibrated
se reps < repMin o RIR medio < 1                      → workingWeightKg = peso usato × 0.9 (arrotondato all'incremento); state = calibrated
se reps > repMax e RIR medio ≥ 3                       → workingWeightKg = peso usato + 2 incrementi; state = calibrated
```

Nessuna stima da 1RM: la calibrazione avviene solo sul campo.

### 4.2 Doppia progressione (slot `calibrated`, settimane 1–5)

Sia `sets` le serie di lavoro loggate per lo slot (escluse warmup), `targetRIR` quello della settimana.

```
A. tutte le serie hanno reps ≥ repMax e RIR ≥ targetRIR
   → peso += loadIncrementKg;  failStreak = 0
   → nota: "Hai chiuso tutte le serie a {repMax} con {rir} RIR: prossima volta {peso+inc} kg"

B. tutte le serie hanno reps ≥ repMin (ma non tutte a repMax)
   → peso invariato; failStreak = 0
   → nota: "Peso invariato, punta a una ripetizione in più per serie"

C. almeno una serie ha reps < repMin
   → peso invariato; failStreak += 1
   → se failStreak ≥ 2: peso = peso × 0.9 arrotondato all'incremento; failStreak = 0
     nota: "Due sedute sotto il range: scendiamo a {peso} kg per ripartire"
```

Regola di sicurezza sul RIR: se la media del RIR dichiarato è ≤ targetRIR − 2 (molto più dura del previsto) anche nel caso A, **non** aumentare il peso.

### 4.3 Autoregolazione da feedback di sessione

Applicata dopo 4.2, agisce sulla sessione successiva **dello stesso giorno del programma**:

| Condizione | Effetto |
|---|---|
| `difficulty = hard` **e** `energy = low` | −1 serie su ogni accessory della prossima sessione di quel giorno (una tantum, non modifica il programma) |
| `difficulty = hard` per 2 sessioni consecutive (qualsiasi giorno) | Anticipa lo scarico: la settimana corrente diventa settimana 6, poi si riparte da settimana 1 con i pesi attuali |
| `soreness = a-lot` **e** `difficulty = hard` | Idem come riga 1 |
| `difficulty = easy` per 2 sessioni consecutive dello stesso giorno **e** livello ≠ beginner | +1 serie sui secondary di quel giorno per il resto del mesociclo, **solo se** il volume settimanale dei gruppi coinvolti resta ≤ massimo del range di `effectiveLevel`; altrimenti nessun effetto e nota "volume già al massimo per il tuo livello" |
| Tutto il resto | Nessun effetto |

### 4.4 Sessioni saltate

- Se tra due sessioni dello stesso giorno del programma passano **> 10 giorni**: nessuna progressione applicata, la sessione viene ripetuta con gli stessi pesi.
- Se passano **> 21 giorni**: pesi × 0.9 su tutti gli slot, `failStreak = 0`, nota all'utente.
- Il calendario non avanza per data ma per sessioni completate: la settimana 2 inizia quando tutti i giorni della settimana 1 sono completati.

### 4.5 Sostituzione esercizio

Se in sessione l'utente sostituisce un esercizio, la serie viene loggata con l'`exerciseId` del sostituto. Il motore di progressione **ignora** quella sessione per quello slot (né progressione né fail). Se lo stesso sostituto viene usato 3 volte consecutive, l'app propone di renderlo definitivo (aggiorna `slot.exerciseId`, `state = uncalibrated`).

### 4.6 Carico stimato per i grafici

Solo per visualizzazione, mai per prescrizione: `e1RM = weight × (1 + reps/30)` (Epley), calcolato sulla serie migliore della sessione per esercizio.

### 4.7 Criteri di verifica

Test table-driven su `applySession` con sessioni sintetiche. Casi obbligatori:

- [ ] Calibrazione: i tre rami di 4.1, ciascuno con un caso limite (RIR medio esattamente 2, reps esattamente repMin).
- [ ] Doppia progressione: casi A, B, C; caso C ripetuto due volte produce −10 %; il terzo caso C dopo il reset riparte da `failStreak = 1`.
- [ ] Regola di sicurezza RIR: caso A con RIR medio = targetRIR − 2 non aumenta il peso.
- [ ] Arrotondamento: −10 % di 62,5 kg con incremento 2,5 → 57,5 (non 56,25).
- [ ] Autoregolazione: ognuna delle 5 righe della tabella 4.3, più un caso in cui le condizioni non scattano.
- [ ] Tetto al volume: due sessioni `easy` con volume già al massimo del range → nessuna serie aggiunta, nota presente. Ripetendo il ciclo N volte il volume non supera mai il massimo.
- [ ] Mapping RIR beginner: `rirInput = easy/right/limit` → `rir = 3/2/1`; il motore lavora solo su `rir`.
- [ ] Scarico anticipato: dopo 2 `hard` consecutivi, `getWeekPlan` restituisce RIR 4 e 50 % serie.
- [ ] Sessioni saltate: 9 giorni → progressione normale; 11 → nessuna; 22 → −10 %.
- [ ] Sostituzione: la sessione con sostituto non modifica lo slot; alla terza consecutiva appare la proposta.
- [ ] Ogni modifica a `program` genera esattamente una `note` leggibile; nessuna modifica → `notes = []`.
- [ ] `applySession` non muta gli oggetti in ingresso (test di immutabilità).

---

## 5. Modalità "poco tempo" (`src/engine/reduce.js`)

Funzione pura: `reduceSession(dayPlan, targetMinutes) → dayPlan'`. Attivabile all'inizio della sessione con un selettore (20 / 30 / 45 min).

Ordine di taglio, applicato finché il tempo stimato > target:

1. Rimuovi gli accessory, dall'ultimo al primo.
2. Porta i secondary a 2 serie.
3. Rimuovi i secondary, dall'ultimo al primo.
4. Porta i main a 2 serie.
5. Riduci il recupero dei main a 120 s.

I main lift non vengono mai rimossi. Se anche dopo il passo 5 non si rientra nel target, la sessione viene proposta comunque con un avviso "circa {n} min".

Le serie loggate in sessione ridotta **contano** per la progressione (sono comunque serie vere), ma il feedback di sessione ridotta non attiva le regole di 4.3.

### 5.1 Criteri di verifica

- [ ] Da 60 a 30 min: nessun main rimosso, tempo stimato ≤ 30 min.
- [ ] Da 90 a 20 min: restano solo i main a 2 serie, avviso presente se il tempo eccede.
- [ ] La funzione è idempotente: `reduce(reduce(x, t), t) == reduce(x, t)`.
- [ ] Il piano originale in `programs` non viene modificato.

---

## 6. Mappa muscolare e asset

### 6.1 SVG anatomico

File `src/data/body.svg`: figura stilizzata fronte e retro, ogni gruppo muscolare della lista `Muscle` è un `<path>` con `id="m-{muscle}"` e classe `muscle`. Stile via CSS custom properties, nessun colore hardcoded.

Due usi:

- **Scheda esercizio**: primari in `--muscle-primary`, secondari in `--muscle-secondary`.
- **Home, mappa di calore settimanale**: intensità proporzionale alle serie completate nella settimana corrente rispetto al target di livello (0 %, 1–49 %, 50–99 %, ≥100 % → quattro livelli di opacità). Tooltip al tap: "Quadricipiti: 9 di 12–16 serie".

### 6.2 Immagini degli esercizi

Sorgente primaria: **Free Exercise DB** (yuhonas/free-exercise-db, pubblico dominio), due fotogrammi per esercizio (posizione iniziale e finale). Le immagini vengono copiate in `public/images/exercises/{exerciseId}/0.jpg` e `1.jpg`, ridimensionate a max 600 px, convertite in WebP.

Regole:

- Ogni esercizio nel catalogo riporta in `license` sorgente, tipo e URL. Un test verifica che nessun esercizio abbia `license` vuoto.
- **Nessuna immagine o GIF da altre app, siti commerciali o ricerca immagini.** Se un esercizio non ha un'immagine a licenza libera, si pubblica con i soli cue testuali.
- Se si attinge a wger, la licenza va verificata esercizio per esercizio e riportata; non importare in blocco.

### 6.3 Cue tecnici

3–4 frasi brevi per esercizio, scritte ex novo in italiano, imperative e concrete ("Scapole addotte e depresse prima di staccare il bilanciere"). Niente cue che assomiglino a indicazioni cliniche o riabilitative.

### 6.4 Criteri di verifica

- [ ] Ogni `Muscle` dell'enum ha un path corrispondente nell'SVG (test che parsa l'SVG).
- [ ] Ogni esercizio del catalogo ha `license` valorizzato, ≥3 cue, ≥2 sostituti esistenti e dello stesso pattern.
- [ ] Ogni path immagine dichiarato esiste nel repo (test in CI).
- [ ] La mappa di calore con zero sessioni mostra tutti i gruppi a 0 %.

---

## 7. UI e flusso

Mobile-first, una colonna, target 360–430 px di larghezza. Font di sistema. Tema chiaro/scuro via `prefers-color-scheme`. Nessuna libreria UI: CSS custom con variabili in `src/styles/tokens.css`. Consultare la skill `frontend-design` prima di definire tipografia e palette.

### 7.1 Schermate

**Onboarding** (solo prima apertura o dopo reset)
1. Disclaimer bloccante (testo 1.4, pulsante attivo solo dopo scroll a fine testo).
2. Obiettivo — tre card: Forza / Massa / Ricomposizione, con una riga di descrizione ciascuna.
3. Giorni a settimana — 2 3 4 5 6.
4. Minuti per sessione — 30 45 60 75 90.
5. Livello — Principiante (< 1 anno di allenamento continuativo) / Intermedio (1–3 anni) / Avanzato (> 3 anni).
6. Riepilogo + "Genera scheda" → mostra lo split e i giorni con anteprima esercizi.

**Home**
- Sessione proposta: il prossimo giorno del programma non ancora completato nella settimana corrente, con esercizi principali, durata stimata, pulsante "Inizia".
- Link "Cambia giorno": bottom sheet con tutti i giorni del programma e il loro stato nella settimana (fatto / da fare). L'utente può scegliere qualsiasi giorno non ancora completato; un giorno già fatto è selezionabile solo con avviso ("già completato questa settimana, verrà registrato come sessione extra e non conterà per la progressione").
- Settimana corrente: 6 pallini (settimane) con quella corrente evidenziata, RIR target della settimana.
- Mappa di calore muscolare della settimana.
- Ultime note del motore (max 3).

**Sessione**
- Selettore "poco tempo" in alto (chiuso di default).
- Lista esercizi con stato (da fare / in corso / fatto). Tap per espandere.
- Esercizio espanso: immagini 0/1, cue, mappa muscolare piccola, nota personale (2.6, tap per modificare), pulsante "Sostituisci" (bottom sheet con 2–3 alternative), righe delle serie.
- **Riga "ultima volta"** sopra le serie: per ogni serie della sessione precedente dello stesso slot, `peso × reps @ RIR` in grigio (es. *80 × 8 @2 · 80 × 8 @2 · 80 × 7 @1*). Alla prima sessione: "Prima volta: scegli un peso che sai gestire per {repMin}-{repMax} ripetizioni".
- Riga serie: peso (stepper con incremento dell'esercizio, precompilato con `workingWeightKg`), ripetizioni (stepper, precompilato con le reps dell'ultima volta), RIR, spunta.
  - RIR per intermediate/advanced: 5 pulsanti 0–4.
  - RIR per beginner: 3 pulsanti *Facile / Giusta / Al limite* (mappati a 3/2/1). Un tooltip alla prima serie in assoluto spiega cosa significa in una riga.
- **Calcolatore dischi**: tap sul peso apre un popover "per lato: 20 + 10 + 2,5" calcolato su bilanciere da 20 kg e dischi 25/20/15/10/5/2,5/1,25. Solo per esercizi con `equipment` contenente `barbell`.
- Alla spunta parte il timer di recupero (overlay in basso, non bloccante, con −15 s / +15 s / salta). Vibrazione e suono opzionali.
- Serie di avvicinamento proposte automaticamente per i main (50 % e 75 % del carico di lavoro) e marcate `isWarmup`.
- "Termina sessione" sempre visibile; se restano serie non fatte chiede conferma.
- Riga di disclaimer breve in fondo.

**Fine sessione**
- Tre domande a pulsanti (2.4), obbligatorie.
- Poi: riepilogo (serie fatte, tonnellaggio, durata) + le `notes` del motore per la prossima volta, ognuna con l'esercizio a cui si riferisce.

**Progressi**
- Selettore esercizio → grafico e1RM per sessione (linea) + peso di lavoro (barre). Solo esercizi con ≥2 sessioni.
- Sezione "Misure" (facoltativa): inserimento data + campi 2.5; grafico peso corporeo; tabella circonferenze. Nessun commento automatico sui valori.

**Catalogo**
- Lista esercizi filtrabile per gruppo muscolare (tap sulla mappa) e per pattern. Scheda esercizio come in sessione.

**Impostazioni**
- Timer: suono, vibrazione, avvio automatico.
- Tema.
- Esporta backup / Importa backup.
- Rigenera scheda (nuovo mesociclo, con conferma; chiede se mantenere i pesi).
- Ricomincia da zero (cancella tutto, doppia conferma).
- Disclaimer completo, licenza, versione app, licenze degli asset.

### 7.2 Regole di interazione

- Nessun campo di testo libero tranne la nota per esercizio (2.6). Tutto il resto a pulsanti e stepper.
- Nessun elemento di gamification (streak, badge, punteggi): spingono ad allenarsi quando il feedback direbbe di recuperare, in contraddizione con l'autoregolazione. Decisione di prodotto, non rimandata a v2.
- Ogni azione distruttiva ha conferma esplicita.
- La sessione in corso sopravvive alla chiusura del browser (stato salvato a ogni serie).
- Il timer di recupero continua a scorrere in background (usa `Date.now()`, non `setInterval` cumulativo) e notifica a fine tempo se l'app è aperta.

### 7.3 Criteri di verifica

- [ ] Onboarding completo in ≤ 8 tap dopo il disclaimer.
- [ ] Non è possibile arrivare alla Home senza `disclaimerAcceptedAt` valorizzato (test di routing).
- [ ] Chiudere e riaprire l'app durante una sessione ripristina le serie loggate.
- [ ] La riga "ultima volta" mostra i dati della sessione precedente dello stesso slot, non dell'ultima sessione in assoluto; con sostituzione mostra i dati del sostituto solo se già usato.
- [ ] Calcolatore dischi: 62,5 kg → "per lato: 20 + 1,25"; 20 kg → "bilanciere scarico"; pesi non componibili (es. 21 kg) → "non componibile, arrotonda a 20 o 22,5".
- [ ] Beginner vede tre pulsanti RIR, gli altri livelli ne vedono cinque (test su entrambi i profili).
- [ ] "Cambia giorno" non permette di iniziare un giorno già completato senza l'avviso.
- [ ] Il timer segna il tempo corretto dopo 60 s con tab in background (test manuale documentato).
- [ ] Nessuna stringa UI contiene "devi", "terapia", "medico" al di fuori del disclaimer (test grep sulle stringhe).
- [ ] Contrasto AA su tutti i testi in entrambi i temi.

---

## 8. PWA

- `manifest.webmanifest`: nome "Tempra", `display: standalone`, `theme_color` e `background_color` dai token, icone 192/512 **RGB opache** (iOS scarta le RGBA sulla home screen) + `apple-touch-icon` 180.
- `sw.js`: precache di tutti gli asset dell'app e delle immagini esercizi al primo avvio (strategia cache-first, versione cache legata a `src/version.js`); aggiornamento con prompt "Nuova versione disponibile — Ricarica".
- Meta tag iOS: `apple-mobile-web-app-capable`, `status-bar-style`, viewport con `viewport-fit=cover`.
- Nessun `fetch` a domini esterni. CSP in `vercel.json`: `default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'`.

### 8.1 Criteri di verifica

- [ ] Lighthouse PWA: installabile, offline funzionante.
- [ ] Con rete disattivata dopo il primo caricamento: onboarding, sessione, progressi funzionano.
- [ ] Le icone 192/512 non hanno canale alpha (test che legge l'header PNG).
- [ ] Un test Playwright intercetta tutte le richieste di rete durante un flusso completo e verifica che siano tutte verso l'origin dell'app.

---

## 9. Stack e struttura del repository

- **Vite + React 18** (JSX, senza TypeScript nel v1; tipi documentati in JSDoc come in sezione 2).
- **idb** per IndexedDB.
- **Vitest** per i test dei motori; **Playwright** per il flusso end-to-end e il test di rete.
- Nessun'altra dipendenza runtime. Nessun framework CSS, nessuna libreria di grafici: i grafici sono SVG generati a mano (linea + barre, due componenti).
- Deploy: **Vercel**, static build. Repo GitHub pubblico, licenza MIT.

```
tempra/
├── index.html
├── sw.js
├── vercel.json
├── package.json
├── vite.config.js
├── README.md
├── LICENSE
├── DECISIONS.md              # scelte fatte in implementazione
├── public/
│   ├── manifest.webmanifest
│   ├── icons/                # 192, 512, apple-touch-180 (RGB opachi)
│   └── images/exercises/{id}/0.webp, 1.webp
├── scripts/
│   └── import-exercises.mjs  # importa da free-exercise-db, ridimensiona, scrive license
├── src/
│   ├── main.jsx
│   ├── version.js            # export const VERSION = '0.1.0'
│   ├── App.jsx               # routing (hash-based, nessun router esterno)
│   ├── db/
│   │   ├── schema.js         # apertura idb, store, migrazioni
│   │   ├── repo.js           # funzioni CRUD tipizzate in JSDoc
│   │   └── backup.js         # export/import
│   ├── engine/
│   │   ├── generate.js
│   │   ├── progress.js
│   │   ├── reduce.js
│   │   ├── week.js           # getWeekPlan
│   │   ├── e1rm.js
│   │   └── prng.js
│   ├── data/
│   │   ├── exercises.json
│   │   ├── body.svg
│   │   └── strings.it.js     # tutte le stringhe UI
│   ├── ui/
│   │   ├── screens/          # Onboarding, Home, Session, SessionEnd, Progress, Catalog, Settings
│   │   ├── components/       # MuscleMap, RestTimer, SetRow, ExerciseCard, Chart*, BottomSheet
│   │   └── hooks/
│   └── styles/
│       ├── tokens.css
│       └── base.css
└── tests/
    ├── engine/               # generate, progress, reduce, week (vitest)
    ├── data/                 # catalogo, svg, licenze, immagini
    └── e2e/                  # playwright: flusso completo + rete
```

---

## 10. Piano di test complessivo

| # | Area | Strumento | Riferimento |
|---|---|---|---|
| 10.1 | Motore di generazione | Vitest, 225 combinazioni + snapshot | 3.7 |
| 10.2 | Motore di progressione | Vitest, table-driven | 4.7 |
| 10.3 | Riduzione sessione | Vitest | 5.1 |
| 10.4 | Integrità catalogo e asset | Vitest su JSON/SVG/filesystem | 6.4 |
| 10.5 | UI e routing | Playwright | 7.3 |
| 10.6 | Rete e privacy | Playwright, intercettazione richieste | 8.1 |
| 10.7 | PWA | Lighthouse in CI + test icone | 8.1 |
| 10.8 | Stringhe | Test grep su `strings.it.js` | 7.3 |
| 10.9 | Usabilità in palestra | Test manuale, 1 settimana reale con build di Fase 4 | 11 |

CI (GitHub Actions): lint + vitest a ogni push; Playwright + Lighthouse su PR verso `main`. Il deploy Vercel parte solo da `main` verde.

**Test 10.9 — usabilità reale.** Dopo la Fase 4 l'autore usa la build in palestra per una settimana intera di programma, con il telefono nelle condizioni vere (mani sudate, sul pavimento, tra una serie e l'altra). Si annotano in `FIELD-NOTES.md`: ogni tap che sembra di troppo, ogni volta che il timer non è dove serve, ogni dato che si vorrebbe vedere e non c'è. Le note diventano issue da chiudere prima della Fase 5. Nessun test automatico sostituisce questo passaggio.

**Definition of done della v1.0.0**: tutti i criteri di verifica delle sezioni 3–8 spuntati, test 10.9 eseguito con issue chiuse, README con screenshot e disclaimer, `DECISIONS.md` aggiornato, tag git `v1.0.0`.

---

## 11. Fasi di implementazione

Ogni fase termina con test verdi e un commit taggato `v0.x.0`.

**Fase 0 — Scaffolding** (`v0.1.0`)
Vite + React, struttura cartelle, `version.js`, `tokens.css`, routing hash, schema idb con migrazioni, Vitest e Playwright configurati con un test banale ciascuno, CI.

**Fase 1 — Catalogo e asset** (`v0.2.0`)
`scripts/import-exercises.mjs`, selezione dei ~60 esercizi, cue in italiano, sostituti, `body.svg`, test 6.4.

**Fase 2 — Motore di generazione** (`v0.3.0`)
`prng.js`, `generate.js`, `week.js`, test 3.7 completi. Nessuna UI oltre a una pagina di debug che stampa il programma.

**Fase 3 — Onboarding e Home** (`v0.4.0`)
Disclaimer, quattro domande, generazione, Home con prossima sessione e mappa di calore (ancora vuota).

**Fase 4 — Sessione** (`v0.5.0`)
Schermata sessione completa: serie, RIR (numerico e a tre pulsanti), riga "ultima volta", calcolatore dischi, note per esercizio, timer, sostituzione, cambio giorno, persistenza in corso, fine sessione con feedback. Ancora senza progressione.

**Fase 4b — Test in palestra** (nessun tag)
Una settimana di uso reale (test 10.9). Le issue emerse si chiudono prima di proseguire.

**Fase 5 — Progressione e riduzione** (`v0.6.0`)
`progress.js`, `reduce.js`, note del motore in UI, test 4.7 e 5.1.

**Fase 6 — Progressi, catalogo, impostazioni** (`v0.7.0`)
Grafici e1RM, misure facoltative, catalogo, export/import, reset.

**Fase 7 — PWA e rilascio** (`v1.0.0`)
Service worker, manifest, icone, CSP, test 8.1, Lighthouse, README, deploy Vercel.

---

## 12. Fuori perimetro v1, possibili v2

In ordine di valore stimato:

1. Animazioni SVG proprie degli esercizi, un esercizio alla volta.
2. Log vocale delle serie ("80 per 8") via Web Speech API — solo on-device, verificare il supporto iOS.
3. Unità libbre.
4. Mesocicli con obiettivo diverso in sequenza (es. 6 settimane forza → 6 ipertrofia).
5. Materiale educativo generico sull'alimentazione, senza numeri personalizzati, se e solo se il perimetro di 1.2 resta invariato.

---

## 13. Glossario

- **RIR** — Reps In Reserve: quante ripetizioni l'utente ritiene di avere ancora a fine serie. 0 = cedimento.
- **Doppia progressione** — si aumentano prima le ripetizioni dentro un range, poi il peso quando si raggiunge il limite alto.
- **Scarico (deload)** — settimana a volume ridotto per recuperare.
- **e1RM** — massimale stimato, usato solo per i grafici.
- **Main / secondary / accessory** — gerarchia degli esercizi: multiarticolari pesanti, multiarticolari di supporto, isolamento.
