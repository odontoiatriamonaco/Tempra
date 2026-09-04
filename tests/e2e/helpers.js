// Tempra v0.5.0 — 2026-09-04 12:10
//
// Passaggi condivisi fra i test end-to-end.

import { expect } from '@playwright/test';

const GOAL_LABEL = { strength: /Forza/, hypertrophy: /Massa/, recomp: /Ricomposizione/ };
const LEVEL_LABEL = {
  beginner: /Principiante/,
  intermediate: /Intermedio/,
  advanced: /Avanzato/,
};

/** Porta il testo del disclaimer fino in fondo: è ciò che sblocca il pulsante. */
export async function scrollDisclaimerToEnd(page) {
  await page.locator('.disclaimer__scroll').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll'));
  });
}

/**
 * Dall'app vuota alla Home, con un programma generato.
 * @param {import('@playwright/test').Page} page
 * @param {{ goal?: string, days?: number, minutes?: number, level?: string }} [choices]
 */
export async function completeOnboarding(page, choices = {}) {
  const {
    goal = 'hypertrophy',
    days = 4,
    minutes = 60,
    level = 'intermediate',
  } = choices;

  await page.goto('/');
  await scrollDisclaimerToEnd(page);
  await page.getByRole('button', { name: 'Ho letto e accetto' }).click();
  await page.getByRole('button', { name: GOAL_LABEL[goal] }).click();
  await page.getByRole('button', { name: String(days), exact: true }).click();
  await page.getByRole('button', { name: String(minutes), exact: true }).click();
  await page.getByRole('button', { name: LEVEL_LABEL[level] }).click();
  await page.getByRole('button', { name: 'Genera scheda' }).click();
  await expect(page.locator('.app')).toHaveAttribute('data-route', 'home');
}

/**
 * Apre la sessione proposta ed espande il primo esercizio.
 * @param {import('@playwright/test').Page} page
 */
export async function openSession(page) {
  await page.getByRole('button', { name: 'Inizia' }).click();
  await expect(page.locator('.app')).toHaveAttribute('data-route', 'session');
  await page.locator('.exercise__header').first().click();
  await expect(page.locator('.setrow').first()).toBeVisible();
}
