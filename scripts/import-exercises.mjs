// Tempra v0.2.0 — 2026-09-04 09:12
//
// Importa le immagini degli esercizi da Free Exercise DB (yuhonas/free-exercise-db,
// Unlicense / pubblico dominio), le ridimensiona a 600 px, le converte in WebP e
// aggiorna `images` e `license` in src/data/exercises.json.
//
//   npm run import:exercises            scarica e riscrive il catalogo
//   npm run import:exercises -- --check verifica la mappa senza scaricare nulla
//
// È uno script da eseguire a mano, non fa parte dell'app: l'unica rete che
// Tempra tocca è questa, in fase di sviluppo (spec 1.3 e 6.2).
//
// Regola non negoziabile (spec 6.2): nessuna immagine da altre app, siti
// commerciali o ricerca immagini. Se un esercizio non ha una corrispondenza
// a licenza libera resta senza immagini e si pubblica con i soli cue testuali.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const INDEX_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const IMAGE_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

const LICENSE = Object.freeze({
  source: 'Free Exercise DB (yuhonas/free-exercise-db)',
  type: 'Unlicense (pubblico dominio)',
  url: 'https://github.com/yuhonas/free-exercise-db',
});

const MAX_EDGE_PX = 600;
const WEBP_QUALITY = 80;

const catalogPath = fileURLToPath(new URL('../src/data/exercises.json', import.meta.url));
const imagesRoot = fileURLToPath(new URL('../public/images/exercises/', import.meta.url));

/**
 * Corrispondenza tra gli id di Tempra e quelli di Free Exercise DB.
 * Gli esercizi assenti da questa mappa non hanno una corrispondenza fedele
 * nella sorgente: restano volutamente senza immagini invece di mostrare un
 * movimento diverso da quello che l'utente sta per fare.
 */
const SOURCE_MAP = Object.freeze({
  'barbell-back-squat': 'Barbell_Squat',
  'barbell-front-squat': 'Front_Barbell_Squat',
  'goblet-squat': 'Goblet_Squat',
  'hack-squat-machine': 'Hack_Squat',
  'leg-press': 'Leg_Press',

  'barbell-deadlift': 'Barbell_Deadlift',
  'barbell-romanian-deadlift': 'Romanian_Deadlift',
  'trap-bar-deadlift': 'Trap_Bar_Deadlift',
  'barbell-good-morning': 'Good_Morning',

  'barbell-walking-lunge': 'Barbell_Walking_Lunge',
  'dumbbell-reverse-lunge': 'Dumbbell_Rear_Lunge',
  'dumbbell-step-up': 'Dumbbell_Step_Ups',

  'barbell-bench-press': 'Barbell_Bench_Press_-_Medium_Grip',
  'dumbbell-bench-press': 'Dumbbell_Bench_Press',
  'incline-barbell-bench-press': 'Barbell_Incline_Bench_Press_-_Medium_Grip',
  'machine-chest-press': 'Machine_Bench_Press',
  'parallel-bar-dip': 'Dips_-_Chest_Version',

  'barbell-overhead-press': 'Standing_Military_Press',
  'dumbbell-shoulder-press': 'Dumbbell_Shoulder_Press',
  'seated-machine-shoulder-press': 'Machine_Shoulder_Military_Press',
  'arnold-press': 'Arnold_Dumbbell_Press',

  'barbell-bent-over-row': 'Bent_Over_Barbell_Row',
  'one-arm-dumbbell-row': 'One-Arm_Dumbbell_Row',
  'seated-cable-row': 'Seated_Cable_Rows',

  'pull-up': 'Pullups',
  'chin-up': 'Chin-Up',
  'lat-pulldown': 'Wide-Grip_Lat_Pulldown',

  'leg-extension': 'Leg_Extensions',
  'single-leg-extension': 'Single-Leg_Leg_Extension',
  'sissy-squat': 'Weighted_Sissy_Squat',

  'lying-leg-curl': 'Lying_Leg_Curls',
  'seated-leg-curl': 'Seated_Leg_Curl',
  'nordic-hamstring-curl': 'Natural_Glute_Ham_Raise',

  'barbell-hip-thrust': 'Barbell_Hip_Thrust',
  'glute-bridge': 'Barbell_Glute_Bridge',
  'cable-glute-kickback': 'One-Legged_Cable_Kickback',

  'standing-calf-raise': 'Standing_Calf_Raises',
  'seated-calf-raise': 'Seated_Calf_Raise',
  'leg-press-calf-raise': 'Calf_Press_On_The_Leg_Press_Machine',

  'dumbbell-fly': 'Dumbbell_Flyes',
  'cable-crossover': 'Cable_Crossover',
  'pec-deck': 'Butterfly',

  'straight-arm-pulldown': 'Straight-Arm_Pulldown',
  'dumbbell-pullover': 'Straight-Arm_Dumbbell_Pullover',
  'barbell-shrug': 'Barbell_Shrug',

  'dumbbell-lateral-raise': 'Side_Lateral_Raise',
  'cable-lateral-raise': 'Cable_Seated_Lateral_Raise',

  'reverse-pec-deck': 'Reverse_Machine_Flyes',
  'dumbbell-rear-delt-fly': 'Lying_Rear_Delt_Raise',
  'cable-face-pull': 'Face_Pull',

  'barbell-curl': 'Barbell_Curl',
  'incline-dumbbell-curl': 'Incline_Dumbbell_Curl',
  'hammer-curl': 'Hammer_Curls',

  'cable-triceps-pushdown': 'Triceps_Pushdown',
  'overhead-cable-triceps-extension': 'Cable_Rope_Overhead_Triceps_Extension',
  'lying-triceps-extension': 'Lying_Triceps_Press',

  plank: 'Plank',
  'cable-crunch': 'Cable_Crunch',
  'hanging-leg-raise': 'Hanging_Leg_Raise',
  'pallof-press': 'Pallof_Press',
});

/**
 * Scarica una risorsa e la restituisce come Buffer.
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
async function download(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} — ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Ridimensiona a MAX_EDGE_PX sul lato lungo e converte in WebP.
 * @param {Buffer} input
 * @returns {Promise<Buffer>}
 */
function toWebp(input) {
  return sharp(input)
    .resize({ width: MAX_EDGE_PX, height: MAX_EDGE_PX, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

async function main() {
  const checkOnly = process.argv.includes('--check');

  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  console.log(`Catalogo Tempra: ${catalog.length} esercizi.`);

  console.log(`Scarico l'indice di Free Exercise DB…`);
  const sourceCatalog = JSON.parse((await download(INDEX_URL)).toString('utf8'));
  const sourceById = new Map(sourceCatalog.map((entry) => [entry.id, entry]));
  console.log(`Sorgente: ${sourceCatalog.length} esercizi.\n`);

  const missing = [];
  const unmapped = [];
  const imported = [];
  const failed = [];

  for (const exercise of catalog) {
    const sourceId = SOURCE_MAP[exercise.id];

    if (!sourceId) {
      unmapped.push(exercise.id);
      exercise.images = [];
      continue;
    }

    const source = sourceById.get(sourceId);
    if (!source) {
      missing.push(`${exercise.id} → ${sourceId}`);
      exercise.images = [];
      continue;
    }

    // Servono i due fotogrammi previsti dalla spec: posizione iniziale e finale.
    const frames = source.images.slice(0, 2);
    if (frames.length < 2) {
      missing.push(`${exercise.id} → ${sourceId} (solo ${frames.length} immagini)`);
      exercise.images = [];
      continue;
    }

    if (checkOnly) {
      imported.push(exercise.id);
      continue;
    }

    try {
      const targetDir = `${imagesRoot}${exercise.id}`;
      await mkdir(targetDir, { recursive: true });

      const written = [];
      for (const [index, frame] of frames.entries()) {
        const original = await download(IMAGE_BASE + frame);
        await writeFile(`${targetDir}/${index}.webp`, await toWebp(original));
        written.push(`/images/exercises/${exercise.id}/${index}.webp`);
      }

      exercise.images = written;
      exercise.license = { ...LICENSE };
      imported.push(exercise.id);
      process.stdout.write('.');
    } catch (error) {
      failed.push(`${exercise.id}: ${error.message}`);
      exercise.images = [];
      process.stdout.write('x');
    }
  }

  if (!checkOnly) {
    await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
    console.log('\n');
  }

  console.log(`Importati con immagini: ${imported.length}`);
  console.log(`Senza corrispondenza in mappa (solo cue): ${unmapped.length}`);
  for (const id of unmapped) console.log(`  · ${id}`);

  if (missing.length) {
    console.log(`\nMappati ma non trovati nella sorgente: ${missing.length}`);
    for (const line of missing) console.log(`  ! ${line}`);
  }
  if (failed.length) {
    console.log(`\nErrori di download: ${failed.length}`);
    for (const line of failed) console.log(`  x ${line}`);
  }

  // Una mappa che punta a id inesistenti è un errore da correggere, non un
  // avviso da ignorare: la build non deve passare in quello stato.
  if (missing.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
