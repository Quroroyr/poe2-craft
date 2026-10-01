import type { ConsumableId } from '@poe2-craft/craft-domain';

/**
 * Where prices came from. v0.1 has only user input and built-in mock values;
 * live sources (poe.ninja, PoE2Scout) will be additional kinds.
 */
export type PriceSource = 'manual' | 'mock';

/**
 * Prices of consumables at one moment, all in one `unit` (e.g. "div").
 * No currency conversion in v0.1: mixing units would need exchange-rate data with its own provenance.
 */
export interface PriceSnapshot {
  readonly id: string;
  readonly unit: string;
  readonly capturedAt: string;
  readonly source: PriceSource;
  readonly prices: Readonly<Record<ConsumableId, number>>;
}

export function withPrice(snapshot: PriceSnapshot, consumableId: ConsumableId, price: number | null): PriceSnapshot {
  const prices = { ...snapshot.prices };
  if (price === null) delete prices[consumableId];
  else prices[consumableId] = price;
  return { ...snapshot, source: 'manual', prices };
}
