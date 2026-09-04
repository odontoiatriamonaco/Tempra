// Tempra v0.3.0 — 2026-09-04 10:40

import { describe, expect, it } from 'vitest';
import { mulberry32, nextInt, seedFromString, shuffle } from '../../src/engine/prng.js';

describe('mulberry32', () => {
  it('dallo stesso seed produce la stessa sequenza', () => {
    const take = () => {
      const rng = mulberry32(1234);
      return Array.from({ length: 20 }, rng);
    };
    expect(take()).toEqual(take());
  });

  it('da seed diversi produce sequenze diverse', () => {
    const first = Array.from({ length: 20 }, mulberry32(1));
    const second = Array.from({ length: 20 }, mulberry32(2));
    expect(first).not.toEqual(second);
  });

  it('resta dentro [0, 1)', () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 2000; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('copre l’intervallo in modo ragionevolmente uniforme', () => {
    const rng = mulberry32(7);
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 10000; i += 1) buckets[Math.floor(rng() * 10)] += 1;
    for (const count of buckets) {
      expect(count).toBeGreaterThan(800);
      expect(count).toBeLessThan(1200);
    }
  });
});

describe('nextInt', () => {
  it('resta dentro [0, max)', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 1000; i += 1) {
      const value = nextInt(rng, 6);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(6);
    }
  });
});

describe('shuffle', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('non muta l’array originale', () => {
    const copy = [...items];
    shuffle(mulberry32(3), items);
    expect(items).toEqual(copy);
  });

  it('conserva tutti gli elementi', () => {
    const result = shuffle(mulberry32(3), items);
    expect([...result].sort()).toEqual([...items].sort());
  });

  it('è deterministico a parità di seed', () => {
    expect(shuffle(mulberry32(3), items)).toEqual(shuffle(mulberry32(3), items));
  });
});

describe('seedFromString', () => {
  it('è stabile e senza segno', () => {
    expect(seedFromString('tempra')).toBe(seedFromString('tempra'));
    expect(seedFromString('tempra')).toBeGreaterThanOrEqual(0);
  });

  it('distingue stringhe diverse', () => {
    expect(seedFromString('a')).not.toBe(seedFromString('b'));
  });
});
