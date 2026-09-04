// Tempra v0.4.0 — 2026-09-04 11:30
//
// Test 10.8: il lessico dell'interfaccia. La spec 1.3 vuole un linguaggio non
// prescrittivo e nessun termine clinico fuori dal disclaimer.

import { describe, expect, it } from 'vitest';
import {
  DISCLAIMER,
  MUSCLE_LABELS,
  TIER_LABELS,
  UI_STRINGS,
} from '../../src/data/strings.it.js';

/**
 * Appiattisce un oggetto di stringhe annidate in coppie percorso → testo.
 * @param {object} node
 * @param {string} [path]
 * @returns {Array<[string, string]>}
 */
function flatten(node, path = '') {
  if (typeof node === 'string') return [[path, node]];
  if (Array.isArray(node)) {
    return node.flatMap((value, index) => flatten(value, `${path}[${index}]`));
  }
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) =>
      flatten(value, path ? `${path}.${key}` : key)
    );
  }
  return [];
}

const uiStrings = [
  ...flatten(UI_STRINGS, 'UI_STRINGS'),
  ...flatten(MUSCLE_LABELS, 'MUSCLE_LABELS'),
  ...flatten(TIER_LABELS, 'TIER_LABELS'),
];

describe('stringhe dell’interfaccia', () => {
  it('ce ne sono, e nessuna è vuota', () => {
    expect(uiStrings.length).toBeGreaterThan(50);
    for (const [path, text] of uiStrings) {
      expect(text.trim(), path).not.toBe('');
    }
  });

  it('non usa il modo prescrittivo', () => {
    const prescriptive = /\b(devi|dovete|dovresti|obbligatorio|obbligatoria)\b/i;
    for (const [path, text] of uiStrings) {
      expect(text, `${path}: ${text}`).not.toMatch(prescriptive);
    }
  });

  it('non usa un lessico clinico fuori dal disclaimer', () => {
    const clinical =
      /\b(medic\w*|terapi\w*|terapeutic\w*|patologi\w*|diagnos\w*|anamnesi|riabilitazion\w*|prescrizion\w*|cura|cure)\b/i;
    for (const [path, text] of uiStrings) {
      expect(text, `${path}: ${text}`).not.toMatch(clinical);
    }
  });

  it('non nomina titoli o professioni sanitarie (spec 1.2)', () => {
    const titles = /\b(dott\w*|dr\.?|odontoiatr\w*|fisioterapist\w*|nutrizionist\w*)\b/i;
    for (const [path, text] of uiStrings) {
      expect(text, `${path}: ${text}`).not.toMatch(titles);
    }
  });

  it('non promette risultati numerici (spec 1.2)', () => {
    // "perdi X kg in Y settimane" e simili: nessun numero accostato a un
    // risultato promesso.
    const claims = /\b(perdi|perderai|guadagni|guadagnerai|bruci|brucerai)\b/i;
    for (const [path, text] of uiStrings) {
      expect(text, `${path}: ${text}`).not.toMatch(claims);
    }
  });
});

describe('disclaimer', () => {
  it('contiene i tre paragrafi della spec 1.4', () => {
    expect(DISCLAIMER.paragraphs).toHaveLength(3);
    expect(DISCLAIMER.paragraphs[0]).toContain('non è un servizio medico'.toLowerCase().slice(3));
    expect(DISCLAIMER.paragraphs[1]).toContain('consulta un medico');
    expect(DISCLAIMER.paragraphs[2]).toContain('18 anni');
  });

  it('ha il pulsante di accettazione previsto', () => {
    expect(DISCLAIMER.accept).toBe('Ho letto e accetto');
  });

  it('ha una versione breve per la schermata di sessione', () => {
    expect(DISCLAIMER.short.length).toBeGreaterThan(40);
    expect(DISCLAIMER.short.length).toBeLessThan(200);
  });
});

describe('etichette dei muscoli', () => {
  it('coprono tutti i gruppi dell’enum', async () => {
    const { MUSCLES } = await import('../../src/data/taxonomy.js');
    for (const muscle of MUSCLES) {
      expect(MUSCLE_LABELS[muscle], muscle).toBeTruthy();
    }
    expect(Object.keys(MUSCLE_LABELS).sort()).toEqual([...MUSCLES].sort());
  });
});
