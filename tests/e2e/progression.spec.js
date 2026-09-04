// Tempra v0.6.0 — 2026-09-04 13:00
//
// Il giro completo: la seduta insegna qualcosa alla scheda, e la volta dopo
// si vede. Spec sezioni 4 e 5.

import { expect, test } from '@playwright/test';
import { completeOnboarding, openSession } from './helpers.js';

/**
 * Chiude tutte le righe aperte del primo esercizio con il RIR indicato.
 * `plusClicks` alza il peso prima di registrare: serve alla prima seduta,
 * perché calibrare a bilanciere scarico non lascia spazio agli avvicinamenti.
 */
async function completeAllSets(page, rir = '2', plusClicks = 0) {
  for (let guard = 0; guard < 8; guard += 1) {
    const row = page.locator('.setrow[data-done="false"]').first();
    if ((await row.count()) === 0) break;

    for (let step = 0; step < plusClicks; step += 1) {
      await row.getByRole('button', { name: 'Peso +' }).click();
    }

    const rirButton = row.getByRole('button', { name: rir, exact: true });
    if ((await rirButton.count()) > 0) await rirButton.click();
    else await row.getByRole('button', { name: 'Registra la serie' }).click();
    await expect(page.locator('.setrow[data-done="true"]')).toHaveCount(guard + 1);
  }
}

/**
 * Il peso della prima serie registrata, senza unità.
 *
 * Il seed dell'onboarding è casuale, quindi l'esercizio proposto — e con lui
 * il carico di partenza e l'incremento — cambia a ogni esecuzione: i pesi
 * vanno letti da quello che c'è a schermo, non supposti.
 */
async function readLoggedWeight(page) {
  return page.evaluate(
    () => document.querySelector('.setrow__done').textContent.match(/^[\d,]+/)[0]
  );
}

/** Dalla sessione al riepilogo, rispondendo alle tre domande. */
async function finishSession(page, difficulty = 'Giusta') {
  await page.getByRole('button', { name: 'Termina sessione' }).click();
  const confirm = page.getByRole('dialog');
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.getByRole('button', { name: 'Chiudi la seduta' }).click();
  }
  await page.getByRole('button', { name: difficulty, exact: true }).click();
  await page.getByRole('button', { name: 'Normale' }).click();
  await page.getByRole('button', { name: 'Nessuno' }).click();
  await page.getByRole('button', { name: 'Salva e chiudi' }).click();
  await expect(page.getByRole('heading', { name: 'Seduta chiusa' })).toBeVisible();
}

test('la prima seduta calibra il carico e lo dice', async ({ page }) => {
  await completeOnboarding(page);
  await openSession(page);
  await completeAllSets(page, '3');
  await finishSession(page);

  const notes = page.locator('.notes li');
  await expect(notes.first()).toContainText('carico di partenza');
});

test('la seconda seduta al massimo del range alza il peso', async ({ page }) => {
  await completeOnboarding(page);

  // Prima seduta: si alza il carico di 16 scatti e si calibra lì.
  await openSession(page);
  await completeAllSets(page, '3', 16);
  const calibrated = await readLoggedWeight(page);
  await finishSession(page);
  await expect(page.locator('.notes li').first()).toContainText(`${calibrated} kg`);
  await page.getByRole('button', { name: 'Torna alla schermata iniziale' }).click();

  // Seconda seduta sullo stesso giorno.
  await page.goto('/#/session/0');
  await page.locator('.exercise__header').first().click();

  // Ora che lo slot è calibrato compaiono le serie di avvicinamento…
  await expect(page.locator('.setrow[data-warmup="true"]')).toHaveCount(2);
  // …e la riga "ultima volta" con i dati della volta precedente.
  await expect(page.locator('.lasttime').first()).toContainText('Ultima volta');

  await completeAllSets(page, '2');
  await finishSession(page);

  // Doppia progressione, caso A: il peso della prossima volta è più alto di
  // quello calibrato. Di quanto dipende dall'incremento dell'esercizio.
  const note = await page.locator('.notes li').first().textContent();
  expect(note).toContain('prossima volta');

  const next = Number(note.match(/prossima volta ([\d,]+) kg/)[1].replace(',', '.'));
  expect(next).toBeGreaterThan(Number(calibrated.replace(',', '.')));
});

test('le note del motore compaiono anche in Home', async ({ page }) => {
  await completeOnboarding(page);
  await openSession(page);
  await completeAllSets(page, '3');
  await finishSession(page);
  await page.getByRole('button', { name: 'Torna alla schermata iniziale' }).click();

  await expect(page.locator('.app')).toHaveAttribute('data-route', 'home');
  await expect(page.getByRole('heading', { name: 'Dalla scorsa volta' })).toBeVisible();
  await expect(page.locator('.notes li')).toHaveCount(1);
});

test('"poco tempo" accorcia la seduta senza togliere i fondamentali', async ({ page }) => {
  await completeOnboarding(page, { minutes: 90 });
  await page.getByRole('button', { name: 'Inizia' }).click();
  await expect(page.locator('.app')).toHaveAttribute('data-route', 'session');

  // Gli esercizi arrivano dopo il primo render: senza attesa si conterebbe zero.
  await expect(page.locator('.exercise').first()).toBeVisible();
  const before = await page.locator('.exercise').count();
  expect(before).toBeGreaterThan(3);

  await page.getByRole('button', { name: 'Ho poco tempo' }).click();
  await page.getByRole('button', { name: '20', exact: true }).click();

  await expect(page.locator('.shorttime__active')).toContainText('20 minuti');
  const after = await page.locator('.exercise').count();
  expect(after).toBeLessThan(before);
  expect(after).toBeGreaterThan(0);
});

test('il selettore "poco tempo" sparisce a seduta iniziata', async ({ page }) => {
  await completeOnboarding(page);
  await openSession(page);
  await expect(page.getByRole('button', { name: 'Ho poco tempo' })).toBeVisible();

  await page.locator('.setrow').first().getByRole('button', { name: '2', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ho poco tempo' })).toHaveCount(0);
});
