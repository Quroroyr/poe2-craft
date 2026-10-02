import type { ConsumableId } from '@poe2-craft/craft-domain';

/**
 * Where prices came from. Live acquisition and caching stay outside this pure package.
 */
export type PriceSource = 'manual' | 'mock' | 'poe.ninja';

/**
 * Prices of consumables at one moment, all in one `unit` (e.g. "div").
 * No currency conversion in v0.1: mixing units would need exchange-rate data with its own provenance.
 */
export interface PriceSnapshot {
  readonly id: string;
  readonly unit: string;
  readonly capturedAt: string;
  readonly source: PriceSource;
  readonly league?: string;
  readonly prices: Readonly<Record<ConsumableId, number>>;
}

export function withPrice(snapshot: PriceSnapshot, consumableId: ConsumableId, price: number | null): PriceSnapshot {
  const prices = { ...snapshot.prices };
  if (price === null) delete prices[consumableId];
  else prices[consumableId] = price;
  return { ...snapshot, source: 'manual', prices };
}
