// Tempra v0.4.0 — 2026-09-04 11:30
//
// Criteri 7.3: la guardia sul disclaimer, l'onboarding in ≤ 8 tap, e la
// persistenza del programma generato.

import { expect, test } from '@playwright/test';

/** Porta il testo del disclaimer fino in fondo, che è ciò che sblocca il pulsante. */
async function scrollDisclaimerToEnd(page) {
  await page.locator('.disclaimer__scroll').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll'));
  });
}

test('il disclaimer non si può accettare senza averlo scorso', async ({ page }) => {
  await page.goto('/');
  const accept = page.getByRole('button', { name: 'Ho letto e accetto' });
  await expect(accept).toBeDisabled();
  await expect(page.getByText('Scorri fino in fondo per continuare')).toBeVisible();

  await scrollDisclaimerToEnd(page);
  await expect(accept).toBeEnabled();
});

test('nessuna rotta è raggiungibile prima dell’accettazione', async ({ page }) => {
  for (const hash of ['#/home', '#/progress', '#/catalog', '#/settings', '#/session/0']) {
    await page.goto(`/${hash}`);
    await expect(page.locator('.app')).toHaveAttribute('data-route', 'onboarding');
  }
});

test('onboarding completo in 5 tap dopo il disclaimer', async ({ page }) => {
  await page.goto('/');
  await scrollDisclaimerToEnd(page);

  // Tap 0: accettazione. I cinque successivi sono quelli contati dal criterio.
  await page.getByRole('button', { name: 'Ho letto e accetto' }).click();

  const taps = [
    () => page.getByRole('button', { name: /Massa/ }).click(),
    () => page.getByRole('button', { name: '4', exact: true }).click(),
    () => page.getByRole('button', { name: '60', exact: true }).click(),
    () => page.getByRole('button', { name: /Intermedio/ }).click(),
    () => page.getByRole('button', { name: 'Genera scheda' }).click(),
  ];
  expect(taps.length).toBeLessThanOrEqual(8);

  for (const tap of taps) await tap();

  await expect(page.locator('.app')).toHaveAttribute('data-route', 'home');
  await expect(page.getByRole('heading', { name: 'La prossima seduta' })).toBeVisible();
});

test('il riepilogo mostra la scheda prima di salvarla', async ({ page }) => {
  await page.goto('/');
  await scrollDisclaimerToEnd(page);
  await page.getByRole('button', { name: 'Ho letto e accetto' }).click();
  await page.getByRole('button', { name: /Forza/ }).click();
  await page.getByRole('button', { name: '3', exact: true }).click();
  await page.getByRole('button', { name: '45', exact: true }).click();
  await page.getByRole('button', { name: /Principiante/ }).click();

  await expect(page.getByRole('heading', { name: 'La scheda suggerita' })).toBeVisible();
  // Tre giorni di programma, ciascuno con almeno un esercizio.
  await expect(page.locator('.preview')).toHaveCount(3);
  await expect(page.locator('.preview__row').first()).toBeVisible();

  // Finché non si conferma, la Home resta irraggiungibile.
  await page.goto('/#/home');
  await expect(page.locator('.app')).toHaveAttribute('data-route', 'onboarding');
});

test('il programma sopravvive alla chiusura dell’app', async ({ page }) => {
  await page.goto('/');
  await scrollDisclaimerToEnd(page);
  await page.getByRole('button', { name: 'Ho letto e accetto' }).click();
  await page.getByRole('button', { name: /Massa/ }).click();
  await page.getByRole('button', { name: '4', exact: true }).click();
  await page.getByRole('button', { name: '60', exact: true }).click();
  await page.getByRole('button', { name: /Intermedio/ }).click();
  await page.getByRole('button', { name: 'Genera scheda' }).click();
  await expect(page.locator('.app')).toHaveAttribute('data-route', 'home');

  await page.reload();
  await expect(page.locator('.app')).toHaveAttribute('data-route', 'home');
  await expect(page.getByRole('heading', { name: 'La prossima seduta' })).toBeVisible();
  await expect(page.locator('.weekdots__dot')).toHaveCount(6);
});

test('la mappa muscolare parte spenta e senza id duplicati', async ({ page }) => {
  await page.goto('/');
  await scrollDisclaimerToEnd(page);
  await page.getByRole('button', { name: 'Ho letto e accetto' }).click();
  await page.getByRole('button', { name: /Massa/ }).click();
  await page.getByRole('button', { name: '4', exact: true }).click();
  await page.getByRole('button', { name: '60', exact: true }).click();
  await page.getByRole('button', { name: /Intermedio/ }).click();
  await page.getByRole('button', { name: 'Genera scheda' }).click();

  // La mappa è iniettata dopo il primo render: senza attesa si leggerebbe
  // un DOM ancora vuoto.
  await expect(page.locator('.muscle-map svg')).toBeVisible();

  const report = await page.evaluate(() => {
    const muscles = [...document.querySelectorAll('.muscle')];
    const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
    return {
      count: muscles.length,
      allZero: muscles.every((path) => path.dataset.heat === '0'),
      duplicateIds: ids.length - new Set(ids).size,
    };
  });

  expect(report.count).toBe(17);
  expect(report.allZero).toBe(true);
  expect(report.duplicateIds).toBe(0);
});

test('"Cambia giorno" elenca tutti i giorni con il loro stato', async ({ page }) => {
  await page.goto('/');
  await scrollDisclaimerToEnd(page);
  await page.getByRole('button', { name: 'Ho letto e accetto' }).click();
  await page.getByRole('button', { name: /Massa/ }).click();
  await page.getByRole('button', { name: '4', exact: true }).click();
  await page.getByRole('button', { name: '60', exact: true }).click();
  await page.getByRole('button', { name: /Intermedio/ }).click();
  await page.getByRole('button', { name: 'Genera scheda' }).click();

  await page.getByRole('button', { name: 'Cambia giorno' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('.daylist__item')).toHaveCount(4);
  await expect(sheet.getByText('Da fare').first()).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
});
