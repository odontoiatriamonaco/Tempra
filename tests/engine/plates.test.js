// Tempra v0.5.0 — 2026-09-04 12:10
//
// Calcolatore dischi. I tre casi del criterio 7.3 sono i primi tre test.

import { describe, expect, it } from 'vitest';
import { BAR_KG, platesPerSide, usesBarbell } from '../../src/engine/plates.js';
import { describe as describePlates } from '../../src/ui/components/PlateCalculator.jsx';

describe('platesPerSide — i casi della spec', () => {
  it('62,5 kg → per lato 20 + 1,25', () => {
    const result = platesPerSide(62.5);
    expect(result.kind).toBe('ok');
    expect(result.perSide).toEqual([20, 1.25]);
    expect(describePlates(result)).toBe('Per lato: 20 + 1,25');
  });

  it('20 kg → bilanciere scarico', () => {
    const result = platesPerSide(20);
    expect(result.kind).toBe('empty-bar');
    expect(describePlates(result)).toBe('Bilanciere scarico.');
  });

  it('21 kg → non componibile, arrotonda a 20 o 22,5', () => {
    const result = platesPerSide(21);
    expect(result.kind).toBe('not-composable');
    expect(result.lowerKg).toBe(20);
    expect(result.upperKg).toBe(22.5);
    expect(describePlates(result)).toContain('20 o 22,5');
  });
});

describe('platesPerSide — altri carichi', () => {
  it.each([
    [22.5, [1.25]],
    [25, [2.5]],
    [30, [5]],
    [40, [10]],
    [60, [20]],
    [100, [25, 15]],
    [140, [25, 25, 10]],
    [180, [25, 25, 25, 5]],
  ])('%s kg si compone correttamente', (total, expected) => {
    const result = platesPerSide(total);
    expect(result.kind).toBe('ok');
    expect(result.perSide).toEqual(expected);
  });

  it('somma sempre al peso richiesto', () => {
    for (let total = 20; total <= 200; total += 2.5) {
      const result = platesPerSide(total);
      if (result.kind !== 'ok') continue;
      const sum = result.perSide.reduce((acc, plate) => acc + plate, 0);
      expect(BAR_KG + sum * 2, `${total} kg`).toBeCloseTo(total, 5);
    }
  });

  it('usa il numero minimo di dischi', () => {
    // 45 per lato: 25+20 (due dischi), non 25+10+10 né 15+15+15.
    expect(platesPerSide(110).perSide).toEqual([25, 20]);
  });

  it('segnala i pesi sotto il bilanciere scarico', () => {
    const result = platesPerSide(10);
    expect(result.kind).toBe('below-bar');
    expect(describePlates(result)).toContain('manubri');
  });

  it('non produce mai errori di virgola mobile', () => {
    // 31,25 kg per lato: con i float 25 + 5 + 1.25 lascerebbe un residuo di
    // 1e-15 e il disco più piccolo sparirebbe. I conti sono in centesimi di
    // chilo proprio per questo.
    const result = platesPerSide(82.5);
    expect(result.kind).toBe('ok');
    expect(result.perSide).toEqual([25, 5, 1.25]);
  });

  it('rifiuta i pesi che non si dividono in due lati uguali', () => {
    // 63,75 kg sono 21,875 per lato: non è un multiplo del disco più piccolo.
    expect(platesPerSide(63.75).kind).toBe('not-composable');
  });
});

describe('usesBarbell', () => {
  it('riconosce gli esercizi con bilanciere', () => {
    expect(usesBarbell({ equipment: ['barbell', 'rack'] })).toBe(true);
    expect(usesBarbell({ equipment: ['dumbbell'] })).toBe(false);
    expect(usesBarbell({})).toBe(false);
    expect(usesBarbell(null)).toBe(false);
  });
});
