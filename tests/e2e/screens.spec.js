// Tempra v0.7.0 — 2026-09-04 13:20
//
// Progressi, catalogo e impostazioni (spec 7.1).

import { expect, test } from '@playwright/test';
import { completeOnboarding, openSession } from './helpers.js';

/** Chiude tutte le serie del primo esercizio e salva il feedback. */
async function doOneSession(page) {
  await openSession(page);
  for (let guard = 0; guard < 8; guard += 1) {
    const row = page.locator('.setrow[data-done="false"]').first();
    if ((await row.count()) === 0) break;
    const rir = row.getByRole('button', { name: '2', exact: true });
    if ((await rir.count()) > 0) await rir.click();
    else await row.getByRole('button', { name: 'Registra la serie' }).click();
    await expect(page.locator('.setrow[data-done="true"]')).toHaveCount(guard + 1);
  }
  await page.getByRole('button', { name: 'Termina sessione' }).click();
  const confirm = page.getByRole('dialog');
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.getByRole('button', { name: 'Chiudi la seduta' }).click();
  }
  await page.getByRole('button', { name: 'Giusta', exact: true }).click();
  await page.getByRole('button', { name: 'Normale' }).click();
  await page.getByRole('button', { name: 'Nessuno' }).click();
  await page.getByRole('button', { name: 'Salva e chiudi' }).click();
  await page.getByRole('button', { name: 'Torna alla schermata iniziale' }).click();
}

test('i progressi chiedono almeno due sedute prima di disegnare', async ({ page }) => {
  await completeOnboarding(page);
  await page.goto('/#/progress');
  await expect(page.getByText('Servono almeno due sedute')).toBeVisible();
  await expect(page.locator('.chart')).toHaveCount(0);
});

test('con due sedute compaiono i due grafici e la tabella dei valori', async ({ page }) => {
  await completeOnboarding(page);
  await doOneSession(page);
  await page.goto('/#/session/0');
  await page.locator('.exercise__header').first().click();
  await doOneSessionSetsOnly(page);

  await page.goto('/#/progress');
  await expect(page.locator('#exercise-picker')).toBeVisible();

  // Due grafici con un asse ciascuno, mai uno con due scale.
  await expect(page.locator('.chart')).toHaveCount(2);
  await expect(page.locator('.chart__bar')).toHaveCount(2);
  await expect(page.locator('.chart__dot')).toHaveCount(2);

  // Ogni grafico ha la sua tabella: in palestra il numero conta più della curva.
  await expect(page.locator('.chart__table')).toHaveCount(2);
  await expect(page.locator('.delta__value')).toBeVisible();
});

/** Variante che chiude solo le serie, per la seconda seduta. */
async function doOneSessionSetsOnly(page) {
  for (let guard = 0; guard < 8; guard += 1) {
    const row = page.locator('.setrow[data-done="false"]').first();
    if ((await row.count()) === 0) break;
    const rir = row.getByRole('button', { name: '2', exact: true });
    if ((await rir.count()) > 0) await rir.click();
    else await row.getByRole('button', { name: 'Registra la serie' }).click();
    await expect(page.locator('.setrow[data-done="true"]')).toHaveCount(guard + 1);
  }
  await page.getByRole('button', { name: 'Termina sessione' }).click();
  const confirm = page.getByRole('dialog');
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.getByRole('button', { name: 'Chiudi la seduta' }).click();
  }
  await page.getByRole('button', { name: 'Giusta', exact: true }).click();
  await page.getByRole('button', { name: 'Normale' }).click();
  await page.getByRole('button', { name: 'Nessuno' }).click();
  await page.getByRole('button', { name: 'Salva e chiudi' }).click();
}

test('le misure si aggiungono e si cancellano, senza commenti sui valori', async ({ page }) => {
  await completeOnboarding(page);
  await page.goto('/#/progress');

  await page.getByRole('button', { name: 'Aggiungi una misurazione' }).click();
  await page.getByLabel(/^Peso \(kg\)$/).fill('78.4');
  await page.getByRole('button', { name: 'Salva' }).click();

  await expect(page.locator('.measures')).toContainText('78.4');

  await page.getByRole('button', { name: 'Elimina questa misurazione' }).click();
  await expect(page.locator('.measures')).toHaveCount(0);
});

test('il catalogo filtra toccando la mappa e per schema di movimento', async ({ page }) => {
  await completeOnboarding(page);
  await page.goto('/#/catalog');

  await expect(page.getByText('64 esercizi')).toBeVisible();
  await expect(page.locator('.exercise')).toHaveCount(64);

  // Tocco l'addome sulla figura. Si usa questo gruppo perché è un'ellisse
  // unica e centrata: i gruppi pari (petto, quadricipiti…) hanno un vuoto
  // proprio al centro del loro riquadro, dove un click non tocca nulla.
  await page.locator('.muscle[id$="-m-abs"]').first().click();
  await expect(page.getByRole('button', { name: /Togli il filtro: Addome/ })).toBeVisible();
  const afterMuscle = await page.locator('.exercise').count();
  expect(afterMuscle).toBeLessThan(64);

  await page.getByRole('button', { name: 'core', exact: true }).click();
  const afterPattern = await page.locator('.exercise').count();
  expect(afterPattern).toBeLessThanOrEqual(afterMuscle);
  expect(afterPattern).toBeGreaterThan(0);

  await page.getByRole('button', { name: /Togli il filtro/ }).click();
  await expect(page.getByRole('button', { name: /Togli il filtro/ })).toHaveCount(0);
});

test('la scheda esercizio del catalogo mostra la licenza delle immagini', async ({ page }) => {
  await completeOnboarding(page);
  await page.goto('/#/catalog');
  await page.locator('.exercise__header').first().click();
  await expect(page.locator('.exercise__body .cues li').first()).toBeVisible();
  await expect(page.locator('.exercise__body').getByText(/Immagini:/)).toBeVisible();
});

test('le impostazioni applicano il tema e mostrano la versione', async ({ page }) => {
  await completeOnboarding(page);
  await page.goto('/#/settings');

  await page.getByRole('button', { name: 'Scuro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.getByRole('button', { name: 'Come il sistema' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');

  await expect(page.getByText('Versione')).toBeVisible();
});

test('"Ricomincia da zero" chiede due conferme (spec 7.2)', async ({ page }) => {
  await completeOnboarding(page);
  await page.goto('/#/settings');

  await page.getByRole('button', { name: 'Ricomincia da zero' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toContainText('Non c’è modo di tornare indietro');

  // Prima conferma: non cancella ancora.
  await expect(sheet.getByRole('button', { name: 'Cancella definitivamente' })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Ho capito, voglio cancellare' }).click();
  await expect(sheet.getByRole('button', { name: 'Cancella definitivamente' })).toBeVisible();

  // Uscire senza cancellare lascia i dati dove sono.
  await page.keyboard.press('Escape');
  await page.goto('/#/home');
  await expect(page.locator('.app')).toHaveAttribute('data-route', 'home');
});

test('il disclaimer completo è consultabile dalle impostazioni (spec 1.4)', async ({ page }) => {
  await completeOnboarding(page);
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: 'Prima di cominciare' })).toBeVisible();
  await expect(page.getByText('consulta un medico')).toBeVisible();
  await expect(page.getByText('Accettato il')).toBeVisible();
});
