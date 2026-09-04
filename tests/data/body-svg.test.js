// Tempra v0.2.0 — 2026-09-04 09:12
//
// La mappa muscolare deve avere un path per ogni gruppo dell'enum, con id
// univoci (spec 6.1 e 6.4).

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MUSCLES } from '../../src/data/taxonomy.js';

const svg = readFileSync(new URL('../../src/data/body.svg', import.meta.url), 'utf8');

/**
 * Il file documenta la convenzione degli id in un commento: va tolto prima di
 * cercare gli id veri, altrimenti il segnaposto viene contato come un gruppo.
 */
const markup = svg.replace(/<!--[\s\S]*?-->/g, '');

/** Tutti gli id dichiarati nel file, nell'ordine in cui compaiono. */
const allIds = [...markup.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const muscleIds = allIds.filter((id) => id.startsWith('m-'));

describe('body.svg', () => {
  it.each(MUSCLES)('ha un path per %s', (muscle) => {
    const pattern = new RegExp(`<path[^>]*\\bid="m-${muscle}"[^>]*>`);
    expect(svg).toMatch(pattern);
  });

  it('non contiene path muscolari oltre a quelli dell\'enum', () => {
    const expected = MUSCLES.map((muscle) => `m-${muscle}`);
    expect([...muscleIds].sort()).toEqual([...expected].sort());
  });

  it('non ripete nessun id', () => {
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('marca ogni gruppo con class="muscle"', () => {
    const withClass = [...svg.matchAll(/<path[^>]*\bclass="muscle"[^>]*\bid="(m-[^"]+)"/g)];
    const withClassReversed = [
      ...svg.matchAll(/<path[^>]*\bid="(m-[^"]+)"[^>]*\bclass="muscle"/g),
    ];
    const marked = new Set(
      [...withClass, ...withClassReversed].map((match) => match[1])
    );
    expect([...marked].sort()).toEqual(MUSCLES.map((m) => `m-${m}`).sort());
  });

  it('non contiene colori scritti a mano: tutto passa dalle custom properties', () => {
    // Nessun esadecimale, nessun rgb(), nessun nome di colore CSS nei fill/stroke.
    expect(svg).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(svg).not.toMatch(/\brgba?\(/);
    expect(svg).not.toMatch(/(fill|stroke):\s*(?!var\(|none\b)[a-z]/i);
  });

  it('dichiara un viewBox e un titolo accessibile', () => {
    expect(svg).toMatch(/viewBox="0 0 \d+ \d+"/);
    expect(svg).toMatch(/<title[^>]*>[^<]+<\/title>/);
  });
});
