import type { PriceSnapshot } from '../price-snapshot';

/**
 * MOCK PRICES — placeholders so the economy panel has something to multiply.
 * Not market data; users are expected to overwrite them.
 */
export const MOCK_PRICE_SNAPSHOT: PriceSnapshot = {
  id: 'mock.v0.1',
  unit: 'div',
  capturedAt: '2026-10-02',
  source: 'mock',
  prices: {
    'currency.exalted-orb': 0.01,
    'currency.perfect-exalted-orb': 0.5,
    'currency.perfect-chaos-orb': 0.3,
    // The unit itself: 1 div = 1 div, the only non-mock number here.
    'currency.divine-orb': 1,
    'omen.dextral-exaltation': 0.2,
    'omen.sinistral-exaltation': 0.2,
    'omen.whittling': 0.5,
    'omen.dextral-erasure': 0.3,
  },
};
