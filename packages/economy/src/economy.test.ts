import { describe, expect, it } from 'vitest';
import { calculateAttemptCost, calculateStageCost, withPrice, type PriceSnapshot } from './index';

const snapshot: PriceSnapshot = {
  id: 'test',
  unit: 'div',
  capturedAt: '2026-10-02',
  source: 'manual',
  prices: { chaos: 0.3, whittling: 0.5, erasure: 0.25 },
};

describe('attempt cost', () => {
  it('sums quantity × unit price', () => {
    const cost = calculateAttemptCost(
      [
        { consumableId: 'chaos', quantity: 1 },
        { consumableId: 'whittling', quantity: 1 },
        { consumableId: 'erasure', quantity: 2 },
      ],
      snapshot,
    );
    expect(cost.total).toBeCloseTo(1.3, 12);
    expect(cost.complete).toBe(true);
    expect(cost.lines[2]).toEqual({ consumableId: 'erasure', quantity: 2, unitPrice: 0.25, subtotal: 0.5 });
  });

  it('reports missing prices instead of assuming zero silently', () => {
    const cost = calculateAttemptCost([{ consumableId: 'unknown', quantity: 1 }], snapshot);
    expect(cost.complete).toBe(false);
    expect(cost.missingPrices).toEqual(['unknown']);
  });

  it('updates prices immutably', () => {
    const updated = withPrice(snapshot, 'chaos', 1);
    expect(updated.prices.chaos).toBe(1);
    expect(snapshot.prices.chaos).toBe(0.3);
    expect(withPrice(snapshot, 'chaos', null).prices.chaos).toBeUndefined();
  });

  it('rejects negative quantities', () => {
    expect(() => calculateAttemptCost([{ consumableId: 'chaos', quantity: -1 }], snapshot)).toThrow(RangeError);
  });
});

describe('stage cost', () => {
  it('expected cost = cost per attempt / p', () => {
    const stage = calculateStageCost(0.04, 1.3);
    expect(stage.expectedAttempts).toBeCloseTo(25, 12);
    expect(stage.expectedCost).toBeCloseTo(1.3 / 0.04, 12);
  });

  it('prices attempt quantiles', () => {
    const stage = calculateStageCost(0.1, 2);
    expect(stage.quantiles).toEqual([
      { quantile: 0.5, attempts: 7, cost: 14 },
      { quantile: 0.75, attempts: 14, cost: 28 },
      { quantile: 0.9, attempts: 22, cost: 44 },
      { quantile: 0.95, attempts: 29, cost: 58 },
    ]);
  });

  it('a free attempt costs nothing even when success is impossible', () => {
    expect(calculateStageCost(0, 0).expectedCost).toBe(0);
    expect(calculateStageCost(0, 1).expectedCost).toBe(Number.POSITIVE_INFINITY);
  });
});
