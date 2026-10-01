import { describe, expect, it } from 'vitest';
import { attemptsForQuantile, chanceWithin, expectedAttempts } from './geometric';

describe('geometric distribution', () => {
  it('expected attempts = 1 / p', () => {
    expect(expectedAttempts(0.25)).toBe(4);
    expect(expectedAttempts(1)).toBe(1);
    expect(expectedAttempts(0)).toBe(Number.POSITIVE_INFINITY);
  });

  it('chance within N attempts = 1 - (1 - p)^N', () => {
    expect(chanceWithin(0.1, 1)).toBeCloseTo(0.1, 12);
    expect(chanceWithin(0.1, 10)).toBeCloseTo(1 - 0.9 ** 10, 12);
    expect(chanceWithin(0.1, 0)).toBe(0);
    expect(chanceWithin(1, 3)).toBe(1);
  });

  it('stays precise for tiny probabilities', () => {
    expect(chanceWithin(1e-12, 1)).toBeCloseTo(1e-12, 20);
  });

  it('computes attempt quantiles analytically', () => {
    expect(attemptsForQuantile(0.1, 0.5)).toBe(7);
    expect(attemptsForQuantile(0.1, 0.75)).toBe(14);
    expect(attemptsForQuantile(0.1, 0.9)).toBe(22);
    expect(attemptsForQuantile(0.1, 0.95)).toBe(29);
  });

  it('does not round an exact quantile up by floating-point noise', () => {
    // ln(0.25) / ln(0.5) is exactly 2: 75% of crafters finish within 2 attempts at p = 0.5.
    expect(attemptsForQuantile(0.5, 0.75)).toBe(2);
    expect(attemptsForQuantile(0.5, 0.5)).toBe(1);
  });

  it('quantile is the smallest N reaching the requested chance', () => {
    for (const p of [0.003, 0.05, 0.37]) {
      for (const q of [0.5, 0.9, 0.95]) {
        const n = attemptsForQuantile(p, q);
        expect(chanceWithin(p, n)).toBeGreaterThanOrEqual(q);
        expect(chanceWithin(p, n - 1)).toBeLessThan(q);
      }
    }
  });

  it('handles certain and impossible outcomes', () => {
    expect(attemptsForQuantile(1, 0.95)).toBe(1);
    expect(attemptsForQuantile(0, 0.5)).toBe(Number.POSITIVE_INFINITY);
  });

  it('rejects invalid input', () => {
    expect(() => expectedAttempts(1.5)).toThrow(RangeError);
    expect(() => chanceWithin(0.5, 1.5)).toThrow(RangeError);
    expect(() => attemptsForQuantile(0.5, 1)).toThrow(RangeError);
  });
});
