// Tempra v1.0.0 — 2026-09-04 14:30
//
// Genera gli screenshot del README guidando l'app con un browser vero.
// Ripetibile: le immagini non si aggiornano a mano.
//
//   npm run dev          (in un altro terminale)
//   npm run make:shots

import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from '@playwright/test';

const BASE = process.env.TEMPRA_URL ?? 'http://localhost:5173';
const OUT = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));

/** Seed fisso: gli screenshot devono mostrare sempre la stessa scheda. */
const SEED = 20260904;

async function scrollDisclaimer(page) {
  await page.locator('.disclaimer__scroll').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll'));
  });
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices['Pixel 7'],
    colorScheme: 'light',
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/?seed=${SEED}`);
  await scrollDisclaimer(page);
  await page.screenshot({ path: `${OUT}1-disclaimer.png` });

  await page.getByRole('button', { name: 'Ho letto e accetto' }).click();
  await page.getByRole('button', { name: /Massa/ }).click();
  await page.screenshot({ path: `${OUT}2-domande.png` });

  await page.getByRole('button', { name: '4', exact: true }).click();
  await page.getByRole('button', { name: '60', exact: true }).click();
  await page.getByRole('button', { name: /Intermedio/ }).click();
  await page.screenshot({ path: `${OUT}3-anteprima.png` });

  await page.getByRole('button', { name: 'Genera scheda' }).click();
  await page.waitForSelector('.app[data-route="home"]');
  await page.screenshot({ path: `${OUT}4-oggi.png` });

  await page.getByRole('button', { name: 'Inizia' }).click();
  await page.locator('.exercise__header').first().click();
  await page.waitForSelector('.setrow');
  await page.screenshot({ path: `${OUT}5-sessione.png` });

  // Una serie registrata: si vede il timer di recupero partire.
  await page.locator('.setrow').first().getByRole('button', { name: '2', exact: true }).click();
  await page.waitForSelector('.resttimer');
  await page.screenshot({ path: `${OUT}6-timer.png` });

  await browser.close();
  console.log(`Screenshot in docs/screenshots/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
