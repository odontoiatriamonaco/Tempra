// Tempra v1.0.0 — 2026-09-04 14:30
//
// Genera le icone della PWA da un disegno vettoriale.
//
// Le PNG escono **senza canale alpha** (spec 8): iOS scarta le icone RGBA
// quando le si aggiunge alla schermata Home, e al loro posto mostra uno
// screenshot della pagina. Lo sfondo è quindi pieno fino al bordo, non
// trasparente, ed è anche quello che serve alle icone adattive di Android.
//
//   npm run make:icons

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OUT_DIR = fileURLToPath(new URL('../public/icons/', import.meta.url));

/** Lo stesso accento di tokens.css, in chiaro: l'icona non ha un tema. */
const BACKGROUND = '#8a4b1f';
const FOREGROUND = '#ffffff';

/**
 * Un bilanciere visto di fronte: una barra e due dischi per lato. Regge la
 * riduzione a 32 px meglio di qualunque lettera.
 */
const MARK = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BACKGROUND}"/>
  <g fill="${FOREGROUND}">
    <rect x="98"  y="238" width="316" height="36" rx="18"/>
    <rect x="128" y="186" width="44"  height="140" rx="16"/>
    <rect x="340" y="186" width="44"  height="140" rx="16"/>
    <rect x="74"  y="212" width="34"  height="88"  rx="14"/>
    <rect x="404" y="212" width="34"  height="88"  rx="14"/>
  </g>
</svg>`;

const SIZES = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 32, name: 'favicon-32.png' },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(`${OUT_DIR}icon.svg`, MARK.trim(), 'utf8');

  for (const { size, name } of SIZES) {
    await sharp(Buffer.from(MARK))
      .resize(size, size)
      // `flatten` fonde l'eventuale trasparenza sullo sfondo, `removeAlpha`
      // elimina proprio il canale: senza il secondo, la PNG resta RGBA.
      .flatten({ background: BACKGROUND })
      .removeAlpha()
      .png({ compressionLevel: 9, palette: false })
      .toFile(`${OUT_DIR}${name}`);
    console.log(`  ${name} — ${size}×${size}`);
  }

  console.log('Icone generate senza canale alpha.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
