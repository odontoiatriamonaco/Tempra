<!-- Tempra v0.5.0 — 2026-09-04 12:10 -->

# Decisioni di implementazione

Registro delle scelte prese dove la spec lasciava spazio (sezione 0: «quando un
requisito è ambiguo, scegli l'opzione più semplice e annotala qui»). Una voce
per decisione, in ordine cronologico.

---

## Fase 0 — Scaffolding

### D-001 · Dipendenze fuori dalla sezione 9

Aggiunte quattro devDependencies non elencate nella spec, motivate anche in
`package.json` sotto `_dependencyNotes` (JSON non ammette commenti):

- `eslint`, `@eslint/js`, `eslint-plugin-react`, `eslint-plugin-react-hooks`,
  `globals` — la sezione 10 prescrive `lint` in CI a ogni push.
- `fake-indexeddb` — IndexedDB non esiste in Node, serve per testare
  `src/db/schema.js` con Vitest.
- `@vitejs/plugin-react` — necessario a Vite per il JSX, implicito nella
  sezione 9.
- `@playwright/test` — è il pacchetto con cui si installa Playwright.

Nessuna dipendenza a runtime oltre a `react`, `react-dom`, `idb`.

### D-002 · Configurazione di Vitest dentro `vite.config.js`

Anziché un `vitest.config.js` separato. Un file in meno e nessun rischio che le
due configurazioni divergano.

### D-003 · Migrazioni del database come array di passi

`src/db/schema.js` tiene le migrazioni in un array ordinato per versione di
arrivo, e `migrationsFor(oldVersion, newVersion)` seleziona i passi da eseguire.
Per la versione 1 sarebbe bastato un `if`, ma così una versione futura si
aggiunge in fondo senza toccare quelle esistenti, ed è testabile senza aprire un
database vero.

### D-004 · Indice `by-program-day` sulle sessioni

Aggiunto un indice composito `['programId', 'dayIndex']` non richiesto
esplicitamente dalla spec. Lo usano la riga "ultima volta" (7.1) e le regole
sulle sessioni saltate (4.4), che ragionano sempre per giorno del programma:
senza indice servirebbe una scansione completa delle sessioni a ogni apertura.

### D-005 · Tema scuro duplicato in `[data-theme='dark']`

`tokens.css` ripete i token del tema scuro sia in
`@media (prefers-color-scheme: dark)` sia in `:root[data-theme='dark']`. La
duplicazione è voluta: `Settings.theme` (2.7) permette di forzare il tema
indipendentemente dal sistema, e la variante `@media` da sola non lo consente.
Nessuna dipendenza da preprocessori CSS.

### D-006 · Skill `frontend-design` non disponibile

La sezione 7 chiede di consultare la skill `frontend-design` prima di definire
tipografia e palette. La skill non è disponibile in questo ambiente. La palette
di `tokens.css` è stata costruita a mano su tre principi: font di sistema, un
solo accento, contrasti verificati per AA in entrambi i temi (i rapporti sono
annotati nei commenti del file). Da rivedere se la skill diventa disponibile.

### D-007 · Onboarding di Fase 0 senza accettazione

`Onboarding.jsx` in Fase 0 mostra il testo del disclaimer ma non scrive il
profilo: le quattro domande e l'accettazione sono di Fase 3. Di conseguenza la
guardia in `App.jsx` tiene l'app ferma sull'onboarding. Non è un bug ed è
verificato dal test end-to-end: è il criterio 7.3 («non è possibile arrivare
alla Home senza `disclaimerAcceptedAt` valorizzato») già in vigore.

### D-008 · `no-restricted-globals` su `fetch`

Regola ESLint che vieta `fetch` nel codice dell'app. Il requisito 1.3 («nessun
byte lascia il dispositivo») è verificato in modo definitivo dal test Playwright
di 10.6, ma quello gira solo sulle PR: la regola di lint lo intercetta subito.
Esentati test, script di import e — in prospettiva — `sw.js`, che deve
precachare gli asset dell'app.

### D-009 · `vercel.json` già in Fase 0

Il deploy è di Fase 7, ma la CSP di `vercel.json` è un requisito non negoziabile
(1.3). Metterla subito costa nulla e impedisce che una richiesta di rete entri
inosservata durante lo sviluppo. Aggiunti anche `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy` e `frame-ancestors 'none'`.

### D-010 · Playwright solo sulle PR verso `main`

La sezione 10 prescrive «Playwright + Lighthouse su PR verso main»: la CI segue
alla lettera. Sui push girano lint, Vitest e build, che sono veloci. Lighthouse
entrerà in CI in Fase 7, quando ci sarà una PWA da misurare.

### D-011 · Il repository si chiama `Tempra` con la maiuscola

Nome della cartella e del repository GitHub: `Tempra`. Il campo `name` in
`package.json` resta `tempra` minuscolo perché npm non ammette maiuscole.

---

## Fase 1 — Catalogo e asset

### D-012 · 64 esercizi, non 60

La spec chiede «~60 esercizi» con almeno 2 accessori per ogni pattern di
isolamento. Ma la spec chiede anche che ogni esercizio abbia **almeno 2
sostituti dello stesso pattern**: con soli 2 accessori per pattern ognuno dei
due potrebbe averne al massimo 1. Servono quindi 3 esercizi per ogni pattern di
isolamento. Totale: 30 multiarticolari (7 pattern × 4, più leg press e dip) +
30 di isolamento (10 pattern × 3) + 4 core = 64.

### D-013 · `src/data/taxonomy.js`, nuovo file

Gli enum della sezione 2 (pattern, muscoli, tier, obiettivi, livelli) messi in
un modulo eseguibile, non previsto dall'albero della sezione 9. Catalogo,
motori e test devono concordare su quali valori esistono: duplicare le liste in
tre posti è il modo più rapido per farle divergere. Contiene anche
`SMALL_MUSCLES` e `isMultiJoint()`, che servono a `generate.js` in Fase 2.

### D-014 · Tutti i pattern di isolamento e core hanno tier `accessory`

Anche esercizi pesanti come l'hip thrust con bilanciere. Il `tier` non è un
giudizio sull'importanza dell'esercizio: è il parametro con cui la sezione 3.2
sceglie range di ripetizioni e recupero, e la 3.5 decide dove collocarlo nel
giorno. Solo i pattern multiarticolari ricevono `main` e `secondary`. Un test
lo verifica.

### D-015 · Un muscolo non può essere primario e secondario insieme

Vincolo non scritto nella spec, aggiunto come test. Il motore conta il volume
settimanale sui soli muscoli primari (3.3): se un muscolo comparisse in
entrambe le liste dello stesso esercizio, il conteggio lo vedrebbe due volte.

### D-016 · Le ellissi della mappa muscolare

`body.svg` costruisce ogni gruppo con uno o due sottotracciati ellittici dentro
un solo `<path>`. I muscoli pari sono un elemento solo con due sottotracciati:
gli id nel DOM devono essere univoci, e un `id` ripetuto per il lato destro e
sinistro non sarebbe valido. La specchiatura usa `<use>` con
`translate(2·CX,0) scale(-1,1)`.

### D-017 · `sharp` come devDependency

Serve a ridimensionare a 600 px e convertire in WebP (spec 6.2). Gira solo in
`scripts/import-exercises.mjs`, lanciato a mano, mai a runtime: non entra nel
bundle e non tocca il requisito 1.3.

### D-018 · Quattro esercizi restano senza immagini

`bulgarian-split-squat`, `chest-supported-t-bar-row`, `assisted-pull-up-machine`
e `machine-lateral-raise` non hanno in Free Exercise DB una corrispondenza
fedele: esistono voci simili, ma mostrano un movimento diverso da quello che
l'utente sta per eseguire. La spec 6.2 prevede esattamente questo caso
(«si pubblica con i soli cue testuali»). Meglio nessuna immagine di
un'immagine sbagliata.

### D-019 · Il campo `license` descrive gli asset, non i cue

Finché un esercizio non ha immagini, `license` vale
`{ source: 'Tempra', type: 'MIT' }`: i cue sono testo originale di questo
repository. Quando lo script di import allega le immagini, riscrive `license`
con Free Exercise DB / Unlicense. Un test verifica la coerenza nelle due
direzioni: se ci sono immagini, la licenza deve citare una fonte esterna con
URL.

### D-020 · Il test sul lessico dei cue

I cue non devono somigliare a indicazioni cliniche (spec 6.3). Il test cerca
`terapia`, `riabilitazione`, `patologia`, `diagnosi`, `lesione`, `infortunio`,
`dolore`, `medico` dentro `exercises.json`. È lo stesso principio del test 10.8
sulle stringhe UI, applicato al catalogo.

---

## Fase 2 — Motore di generazione

### D-021 · Id deterministici al posto di `crypto.randomUUID()`

La sezione 2 dice che tutti gli id sono UUID; il criterio 3.7 dice che
`generateProgram` con lo stesso seed produce output identico. Le due cose non
possono stare insieme. Vince il determinismo, che è testabile: lo slot id è
`{indiceGiorno}-{idEsercizio}` (univoco, perché un esercizio non si ripete mai
nello stesso giorno) e il programma è `program-{seed}`. `id` e `createdAt` si
possono comunque passare dall'esterno con il quarto argomento: sarà il
repository, non il motore, a leggere l'orologio.

### D-022 · Tre campi in più nel modello

- `Slot.tier` — `week.js` deve applicare «+1 serie sui secondary» senza avere
  in mano il catalogo, e `reduce.js` in Fase 5 avrà lo stesso bisogno.
- `ProgramDay.patterns` — i pattern che il giorno si è impegnato a coprire.
  Senza, il criterio «ogni pattern multiarticolare del giorno è presente come
  main» diventa una tautologia, perché i pattern si dedurrebbero dagli slot.
- `ProgramDay.estimatedSeconds` — la durata stimata, che la Home deve mostrare.

### D-023 · Quali sono i «gruppi grandi»

Il criterio 3.7 chiede che il volume di ogni gruppo grande stia nel range del
livello. Presi alla lettera «grandi = tutti tranne polpacci, avambracci e
obliqui», diversi gruppi sono irraggiungibili: i trapezi hanno un solo esercizio
primario in catalogo (le scrollate), i deltoidi laterali solo le alzate. Per
arrivare a 16 serie settimanali di deltoidi laterali da avanzato la seduta
diventerebbe una fila di alzate laterali.

I gruppi grandi sono quindi i cinque attorno a cui è costruito lo split e che
ricevono lavoro come main o secondary: **petto, dorsali, quadricipiti,
femorali, glutei**. Tutti gli altri hanno il target dimezzato previsto da 3.3.

`upper-back` è il caso che ha deciso la questione: è primario solo negli
esercizi `h-pull`, che compaiono al massimo due volte a settimana, e nessun
esercizio di isolamento lo ha come primario. Prima di spostarlo, era l'unico
gruppo che impediva a un avanzato con 6 giorni da 90 minuti di restare
avanzato. I dorsali fanno già da rappresentante del volume di schiena.

### D-024 · Tetto di pattern multiarticolari per livello

Massimo 2 per un principiante, 3 per un intermedio, 4 per un avanzato. Non è un
vincolo di tempo ma di volume: tre grandi multiarticolari in un giorno
producono da soli più serie di quante ne preveda il range di un principiante, e
non resterebbe spazio per nessun accessorio. Senza questo tetto, un principiante
su 4 giorni upper/lower riceveva 28 serie settimanali di glutei — volume da
avanzato abbondante. È il modo in cui si applica la nota di 3.1: «beginner con
4+ giorni: stesso split, volume da principiante».

### D-025 · I main non possono occupare più del 60 % della seduta

Con quattro pattern in un giorno da 60 minuti, i main esaurivano il budget e i
gruppi che si allenano solo in isolamento restavano a zero serie. Il limite ha
però un pavimento di due pattern, altrimenti a 30 minuti in forza sarebbe
l'unico vincolo attivo e il giorno degenererebbe in un solo main, violando il
criterio esplicito di 3.7.

### D-026 · Il tetto di volume vince sulla regola dell'85 %

La sezione 3.4 dice di non sprecare il tempo disponibile (seduta ≥ 85 % del
budget); la 3.3 dice di non superare il volume del livello. Con 5 giorni da 90
minuti da principiante le due regole si contraddicono. Vince il volume: la
seduta finisce prima. Dare a un principiante venti serie di petto perché aveva
tempo sarebbe un errore di programmazione, non un uso efficiente dell'orario.

Il test lo verifica in forma condizionale: un giorno può stare sotto l'85 % solo
se almeno un gruppo grande ha raggiunto il massimo del suo range. Sulle 225
combinazioni non c'è **nessun** giorno sotto l'85 % senza quella giustificazione.

### D-027 · `volumeWarning`, distinto da `volumeNote`

Con 2 giorni da 30 minuti nemmeno il livello principiante raggiunge il minimo:
la scala dei livelli non ha un gradino più basso. Il criterio 3.7 impone che
`volumeNote` sia `null` quando il livello non è stato degradato, e un
principiante in quel caso non viene degradato. Il campo separato `volumeWarning`
dice comunque all'utente che il volume resterà sotto il minimo consigliato,
senza rompere il contratto testato.

### D-028 · I main non hanno tetto di volume, i secondary sì

I main definiscono lo split: toglierli significa smontare il programma. Sono
loro a stabilire il volume di partenza. Il tetto agisce sui secondary, sugli
accessori e sulla crescita delle serie — nell'ordine in cui è sensato togliere
lavoro.

### D-029 · Riempimento a rotazione fra i giorni, non giorno per giorno

Costruire ogni giorno fino a saturazione affamava gli ultimi: il tetto di volume
è settimanale, e i primi tre giorni lo consumavano tutto. Con 6 giorni, Push B e
Pull B finivano con due soli esercizi al 28 % del budget. Accessori e serie
extra si distribuiscono ora a rotazione su tutti i giorni.

Stessa logica nella rotazione degli esercizi: un candidato respinto dal tetto di
volume **non** consuma il turno. Prima lo consumava, e bastava una pescata
sfortunata perché un giorno perdesse tutti i suoi secondary.

### D-032 · Un solo accessorio per pattern di isolamento al giorno

Il riempimento sceglieva gli accessori per deficit e finiva per mettere nella
stessa seduta alzate laterali con manubri, ai cavi **e** alla macchina: nove
serie dello stesso gesto in tre righe diverse. Non è varietà, è un artefatto
dell'algoritmo. Ora ogni pattern di isolamento entra una volta sola per giorno e
il riempimento aggiunge serie all'esercizio già presente invece di varianti.

Effetto collaterale positivo: con le serie concentrate su meno esercizi, il
volume raggiunge i target più facilmente, e le configurazioni che restano
avanzate sono passate da 10 a 12 su 75.

### D-031 · Una serie di tolleranza nel decidere la degradazione

`meetsMinimumVolume` accetta uno scarto di una serie rispetto al minimo del
range. Senza, con 5 giorni da 60 minuti il livello scendeva a principiante
perché quadricipiti e femorali si fermavano a 11 serie contro un minimo di 12:
un solo set di differenza che capovolgeva il giudizio sull'utente.

Con la tolleranza restano intermedie le configurazioni comuni — 5×60, 4×75,
5×75, 6×60 — mentre 4×60 e 3×60 degradano ancora, e a ragione: lì i giorni
sono già pieni al 97 % e il petto si ferma a 8 serie contro 12. La degradazione
continua a dire il vero, senza punire per un arrotondamento.

### D-030 · La pagina di debug non esiste in produzione

È dietro `import.meta.env.DEV` **e** dietro un import dinamico. Il primo la
rende irraggiungibile, il secondo la toglie davvero dal bundle: con l'import
statico la build passava da 153 a 204 kB, perché si portava dietro il catalogo
esercizi. Così la guardia sul disclaimer resta senza eccezioni in produzione.

---

## Fase 3 — Onboarding e Home

### D-033 · Ogni scelta dell'onboarding avanza da sola

Nessun pulsante "Avanti" dopo le domande: si tocca la risposta e si passa alla
successiva. Quattro tap per le domande più uno per generare, cinque in tutto,
contro gli otto concessi dal criterio 7.3. Il pulsante "Indietro" resta, perché
senza non si potrebbe correggere una risposta.

### D-034 · `src/engine/schedule.js`, nuovo modulo

La Home deve sapere tre cose che nessun modulo esistente calcola: in quale
settimana siamo, quale giorno proporre, e quante serie sono già state fatte per
gruppo muscolare. La regola è quella di 4.4 — il calendario avanza per sedute
completate, non per date — ed è logica pura, quindi sta in `engine/` e non in un
componente. `week.js` resta la periodizzazione, `schedule.js` è l'avanzamento.

### D-035 · Gli id dell'SVG sono resi univoci per istanza

`MuscleMap` riscrive gli id di `body.svg` con un prefisso preso da `useId()`.
In Fase 4 la stessa pagina conterrà una mappa per esercizio, e diciassette
`id="m-chest"` nello stesso documento romperebbero sia i riferimenti `<use>`
sia l'accessibilità. Un test end-to-end verifica che il conteggio degli id
duplicati sia zero.

### D-036 · L'SVG è iniettato inline, non caricato come immagine

`body.svg` arriva con `?raw` e finisce in `dangerouslySetInnerHTML`. Un `<img>`
non eredita le custom properties del tema, quindi la mappa resterebbe grigia in
entrambi i temi e la colorazione per gruppo sarebbe impossibile. Il contenuto è
un file del repository, non un input esterno: non c'è superficie di iniezione.

### D-037 · A mesociclo chiuso non c'è un giorno successivo

`getScheduleState` restava sull'ultima settimana ma segnava tutti i giorni come
da fare, e riproponeva il giorno 1 all'infinito. A mesociclo finito i giorni
sono tutti fatti e `nextDayIndex` è `null`: quello che serve non è un'altra
seduta, è il nuovo mesociclo di 3.6. Trovato da un test, non a occhio.

---


---

## Fase 4 — Sessione guidata

### D-038 · Conti dei dischi in centesimi di chilo, con interi

`plates.js` non fa aritmetica con i float. Con 31,25 kg per lato, `25 + 5 + 1,25`
lascia un residuo di 1e-15 e il disco più piccolo sparisce: il calcolatore
direbbe "non componibile" su un peso perfettamente caricabile. Tutto passa per
interi in centesimi di chilo. Un test lo verifica su ogni peso da 20 a 200 kg.

### D-039 · Serie di avvicinamento solo per i main

La spec 7.1 dice «serie di avvicinamento proposte automaticamente per i main»,
mentre il budget tempo di 3.4 ne conta una anche per ogni secondary. Vince 7.1,
che è la regola sull'interfaccia: la stima dei tempi resta quindi leggermente
conservativa, cioè le sedute finiscono un minuto prima del previsto. Meglio
così che il contrario.

Gli avvicinamenti spariscono se l'arrotondamento li fa coincidere con il carico
di lavoro: a bilanciere quasi scarico, il 50 % e il 75 % di 20 kg sono ancora
20 kg, e non sarebbero un avvicinamento ma due serie in più.

### D-040 · Il timer non chiede il RIR sull'avvicinamento

Le serie di avvicinamento vengono registrate con `isWarmup: true` e RIR 4, senza
chiederlo: non sono serie di lavoro, non contano per il volume né per la
progressione. Chiedere «quante ne avevi ancora» dopo una serie al 50 % sarebbe
una domanda senza risposta utile.

### D-041 · `session.substitutions`, campo in più

La sostituzione di un esercizio deve sopravvivere alla chiusura del browser, e
prima che sia registrata una sola serie non c'è nessun `SetLog` da cui
dedurla. Il campo è una mappa `slotId → exerciseId` dentro la `Session`. La
regola 4.5 (il motore ignora la sessione per quello slot) si applicherà in
Fase 5 leggendo questo campo.

### D-042 · La seduta diventa `completed` solo dopo il feedback

"Termina sessione" scrive `endedAt` ma lascia lo stato `in-progress`; è il
salvataggio delle tre risposte a chiudere la seduta. Le domande sono
obbligatorie (7.1) e il feedback governa l'autoregolazione di 4.3: una seduta
completata senza feedback lascerebbe il motore senza input. Chi abbandona alla
schermata delle domande ritrova la seduta aperta e può riprenderla.

### D-043 · Nessuna nota del motore in fondo alla sessione

La spec 7.1 prevede, dopo il riepilogo, «le `notes` del motore per la prossima
volta». Le note nascono da `applySession`, che è Fase 5: al momento non
esistono. Al loro posto c'è una riga che dice cosa arriverà. Lo stesso vale per
il blocco "ultime note del motore" sulla Home.
