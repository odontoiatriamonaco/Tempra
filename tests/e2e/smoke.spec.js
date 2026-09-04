// Tempra v0.1.0 — 2026-09-04 08:24
//
// Test banale di Fase 0: l'app si carica e la guardia sul disclaimer regge.
// Il flusso completo e il test di rete (10.6) arrivano nelle fasi successive.

import { expect, test } from '@playwright/test';

test('l’app si carica', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Tempra');
  await expect(page.locator('.app')).toBeVisible();
});

test('senza disclaimer accettato si resta sull’onboarding', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app')).toHaveAttribute('data-route', 'onboarding');

  // Anche forzando l'hash di un'altra schermata (criterio 7.3).
  await page.goto('/#/home');
  await expect(page.locator('.app')).toHaveAttribute('data-route', 'onboarding');
});
