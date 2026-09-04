// Tempra v0.5.0 — 2026-09-04 12:10
//
// La sessione guidata. Criteri 7.3: persistenza a metà seduta, calcolatore
// dischi, RIR a tre o cinque pulsanti secondo il livello.

import { expect, test } from '@playwright/test';
import { completeOnboarding, openSession } from './helpers.js';

test('registra una serie e fa partire il recupero', async ({ page }) => {
  await completeOnboarding(page);
  await openSession(page);

  const firstRow = page.locator('.setrow').first();
  await expect(firstRow).toHaveAttribute('data-done', 'false');

  await firstRow.getByRole('button', { name: '2', exact: true }).click();

  await expect(firstRow).toHaveAttribute('data-done', 'true');
  await expect(page.locator('.resttimer')).toBeVisible();
  await expect(page.locator('.exercise__status').first()).toHaveText('In corso');
});

test('la seduta a metà sopravvive alla chiusura dell’app (criterio 7.3)', async ({ page }) => {
  await completeOnboarding(page);
  await openSession(page);

  await page.locator('.setrow').first().getByRole('button', { name: '2', exact: true }).click();
  const logged = await page.locator('.setrow__done').first().textContent();

  await page.reload();
  await expect(page.locator('.app')).toHaveAttribute('data-route', 'session');
  await page.locator('.exercise__header').first().click();

  await expect(page.locator('.setrow__done').first()).toHaveText(logged);
  await expect(page.locator('.exercise__status').first()).toHaveText('In corso');
});

test('il calcolatore dischi si apre solo sul bilanciere e legge il peso a schermo', async ({
  page,
}) => {
  await completeOnboarding(page);
  await openSession(page);

  // Il seed dell'onboarding è casuale, quindi non si può dare per scontato
  // *quale* esercizio venga proposto: si cerca il primo con il bilanciere,
  // che è l'unico a cui il calcolatore si applica.
  const cards = page.locator('.exercise');
  let barbellRow = null;

  for (let index = 0; index < (await cards.count()); index += 1) {
    const card = cards.nth(index);
    if (index > 0) await card.locator('.exercise__header').click();
    const tappable = card.locator('.stepper__value--tappable').first();
    if ((await tappable.count()) > 0) {
      barbellRow = card.locator('.setrow').first();
      break;
    }
    await card.locator('.exercise__header').click();
  }

  expect(barbellRow, 'nessun esercizio con bilanciere nella seduta').not.toBeNull();

  // Uno slot non calibrato parte dal bilanciere scarico: caso deterministico
  // e uno dei tre esempi della spec. Gli altri due sono nei test unitari.
  const weight = barbellRow.locator('.stepper__value').first();
  await expect(weight).toHaveText('20kg');

  await barbellRow.locator('.stepper__value--tappable').click();
  await expect(page.locator('.plates__total')).toHaveText('20 kg');
  await expect(page.locator('.plates__text')).toHaveText('Bilanciere scarico.');
});

test('l’intermedio vede cinque pulsanti RIR', async ({ page }) => {
  await completeOnboarding(page, { level: 'intermediate' });
  await openSession(page);
  const row = page.locator('.setrow').first();
  await expect(row.locator('.rir__button')).toHaveCount(5);
  await expect(row.getByRole('button', { name: '0', exact: true })).toBeVisible();
});

test('il principiante vede tre pulsanti a parole', async ({ page }) => {
  await completeOnboarding(page, { level: 'beginner' });
  await openSession(page);
  const row = page.locator('.setrow').first();
  await expect(row.locator('.rir__button')).toHaveCount(3);
  await expect(row.getByRole('button', { name: 'Facile' })).toBeVisible();
  await expect(row.getByRole('button', { name: 'Giusta' })).toBeVisible();
  await expect(row.getByRole('button', { name: 'Al limite' })).toBeVisible();
});

test('la scheda esercizio mostra immagini, cue e muscoli coinvolti', async ({ page }) => {
  await completeOnboarding(page);
  await openSession(page);

  await expect(page.locator('.exercise__images img')).toHaveCount(2);
  await expect(page.locator('.cues li').first()).toBeVisible();
  await expect(page.locator('.exercise__body .muscle[data-role="primary"]').first()).toBeAttached();
  await expect(page.locator('.lasttime')).toContainText('Prima volta');
});

test('chiudere con serie mancanti chiede conferma, poi porta al feedback', async ({ page }) => {
  await completeOnboarding(page);
  await openSession(page);
  await page.locator('.setrow').first().getByRole('button', { name: '2', exact: true }).click();

  await page.getByRole('button', { name: 'Termina sessione' }).click();
  const confirm = page.getByRole('dialog');
  await expect(confirm).toContainText('esercizi non completati');
  await confirm.getByRole('button', { name: 'Chiudi la seduta' }).click();

  await expect(page.locator('.app')).toHaveAttribute('data-route', 'session-end');

  // Le tre domande sono obbligatorie.
  const save = page.getByRole('button', { name: 'Salva e chiudi' });
  await expect(save).toBeDisabled();
  await page.getByRole('button', { name: 'Giusta' }).click();
  await page.getByRole('button', { name: 'Normale' }).click();
  await expect(save).toBeDisabled();
  await page.getByRole('button', { name: 'Nessuno' }).click();
  await expect(save).toBeEnabled();

  await save.click();
  await expect(page.getByRole('heading', { name: 'Seduta chiusa' })).toBeVisible();
  await expect(page.getByText('Tonnellaggio')).toBeVisible();
});

test('la seduta chiusa accende la mappa e avanza il conteggio', async ({ page }) => {
  await completeOnboarding(page);
  await openSession(page);
  await page.locator('.setrow').first().getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('button', { name: 'Termina sessione' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Chiudi la seduta' }).click();
  await page.getByRole('button', { name: 'Giusta' }).click();
  await page.getByRole('button', { name: 'Normale' }).click();
  await page.getByRole('button', { name: 'Nessuno' }).click();
  await page.getByRole('button', { name: 'Salva e chiudi' }).click();
  await page.getByRole('button', { name: 'Torna alla schermata iniziale' }).click();

  await expect(page.locator('.app')).toHaveAttribute('data-route', 'home');
  await expect(page.getByText('1 di 4 sedute completate')).toBeVisible();

  const lit = await page.evaluate(
    () => [...document.querySelectorAll('.muscle')].filter((p) => p.dataset.heat !== '0').length
  );
  expect(lit).toBeGreaterThan(0);
});

test('la sostituzione propone alternative dello stesso pattern', async ({ page }) => {
  await completeOnboarding(page);
  await openSession(page);

  await page.getByRole('button', { name: 'Sostituisci' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.locator('.daylist__item')).toHaveCount(3);

  const replacement = await sheet.locator('.daylist__item').first().textContent();
  await sheet.locator('.daylist__item').first().click();
  await expect(page.locator('.exercise__name').first()).toHaveText(replacement.trim());
});
