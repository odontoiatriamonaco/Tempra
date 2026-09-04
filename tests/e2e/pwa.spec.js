// Tempra v1.0.0 — 2026-09-04 14:30
//
// Criteri 8.1. I due che contano davvero:
//   · nessuna richiesta esce dall'origine dell'app (test 10.6, requisito 1.3);
//   · con la rete spenta l'app continua a funzionare.

import { expect, test } from '@playwright/test';
import { completeOnboarding, openSession } from './helpers.js';

/**
 * Aspetta che il service worker abbia finito il precache **e** abbia preso il
 * controllo della pagina. `ready` da solo non basta: si risolve all'inizio
 * dell'attivazione, prima di `clients.claim()`.
 */
async function waitForServiceWorker(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, {
          once: true,
        });
      });
    }
    return true;
  });
}

test('nessun byte lascia il dispositivo (test 10.6)', async ({ page, baseURL }) => {
  /** @type {string[]} */
  const foreign = [];
  // L'origine va presa dalla configurazione: prima di navigare `page.url()`
  // vale 'about:blank', la cui origine è la stringa "null", e ogni richiesta
  // legittima risulterebbe estranea.
  const origin = new URL(baseURL).origin;

  page.on('request', (request) => {
    const url = new URL(request.url());
    // data: e blob: restano nel documento; tutto il resto deve essere l'origine.
    if (['data:', 'blob:'].includes(url.protocol)) return;
    if (url.origin !== origin) foreign.push(request.url());
  });

  // Un flusso completo: onboarding, seduta con una serie, feedback, progressi,
  // catalogo, impostazioni.
  await completeOnboarding(page);
  await openSession(page);
  await page.locator('.setrow').first().getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('button', { name: 'Termina sessione' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Chiudi la seduta' }).click();
  await page.getByRole('button', { name: 'Giusta', exact: true }).click();
  await page.getByRole('button', { name: 'Normale' }).click();
  await page.getByRole('button', { name: 'Nessuno' }).click();
  await page.getByRole('button', { name: 'Salva e chiudi' }).click();
  await page.getByRole('button', { name: 'Torna alla schermata iniziale' }).click();

  await page.goto('/#/progress');
  await page.goto('/#/catalog');
  await page.locator('.exercise__header').first().click();
  await page.goto('/#/settings');
  await expect(page.getByText('Versione')).toBeVisible();

  expect(foreign, `richieste fuori dall'origine:\n${foreign.join('\n')}`).toEqual([]);
});

test('il service worker si registra e prende il controllo', async ({ page }) => {
  await page.goto('/');
  const registered = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return null;
    const reg = await navigator.serviceWorker.ready;
    return { scope: reg.scope, hasActive: Boolean(reg.active) };
  });

  expect(registered).not.toBeNull();
  expect(registered.hasActive).toBe(true);
  expect(registered.scope).toMatch(/\/$/);
});

test('il manifest è servito e installabile', async ({ page }) => {
  await page.goto('/');
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) return null;
    const response = await fetch(link.href);
    return response.json();
  });

  expect(manifest.name).toBe('Tempra');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
});

test('con la rete spenta l’app continua a funzionare (criterio 8.1)', async ({
  page,
  context,
}) => {
  await completeOnboarding(page);

  await waitForServiceWorker(page);

  await context.setOffline(true);

  await page.reload();
  await expect(page.locator('.app')).toHaveAttribute('data-route', 'home');
  await expect(page.getByRole('heading', { name: 'La prossima seduta' })).toBeVisible();

  // Anche le altre schermate, e i dati salvati in IndexedDB.
  await page.goto('/#/catalog');
  await expect(page.locator('.exercise').first()).toBeVisible();

  await page.goto('/#/settings');
  await expect(page.getByText('Versione')).toBeVisible();

  await context.setOffline(false);
});

test('offline si può fare una seduta intera', async ({ page, context }) => {
  await completeOnboarding(page);
  await waitForServiceWorker(page);

  await context.setOffline(true);
  await page.reload();

  await openSession(page);
  await page.locator('.setrow').first().getByRole('button', { name: '2', exact: true }).click();
  await expect(page.locator('.setrow[data-done="true"]')).toHaveCount(1);

  await page.reload();
  await page.locator('.exercise__header').first().click();
  await expect(page.locator('.setrow__done').first()).toBeVisible();

  await context.setOffline(false);
});

test('le immagini degli esercizi sono in cache', async ({ page, context }) => {
  await completeOnboarding(page);
  await waitForServiceWorker(page);

  await context.setOffline(true);
  await openSession(page);

  const loaded = await page.evaluate(() => {
    const images = [...document.querySelectorAll('.exercise__images img')];
    return images.map((image) => image.complete && image.naturalWidth > 0);
  });

  expect(loaded.length).toBeGreaterThan(0);
  expect(loaded.every(Boolean), 'un’immagine non è arrivata dalla cache').toBe(true);

  await context.setOffline(false);
});
