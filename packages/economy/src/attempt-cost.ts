import type { ConsumableAmount, ConsumableId } from '@poe2-craft/craft-domain';
import type { PriceSnapshot } from './price-snapshot';

export interface AttemptCostLine {
  readonly consumableId: ConsumableId;
  readonly quantity: number;
  readonly unitPrice: number | null;
  readonly subtotal: number | null;
}

export interface AttemptCost {
  readonly unit: string;
  /** Sum of priced lines. Equals the true cost only when `complete` is true. */
  readonly total: number;
  readonly lines: readonly AttemptCostLine[];
  readonly missingPrices: readonly ConsumableId[];
  readonly complete: boolean;
}

/** Cost of one attempt: sum of quantity × unit price over the consumables it spends. */
export function calculateAttemptCost(
  consumables: readonly ConsumableAmount[],
  snapshot: PriceSnapshot,
): AttemptCost {
  const lines: AttemptCostLine[] = [];
  const missingPrices: ConsumableId[] = [];
  let total = 0;

  for (const { consumableId, quantity } of consumables) {
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new RangeError(`Quantity of ${consumableId} must be a non-negative number, got ${quantity}`);
    }
    const unitPrice = snapshot.prices[consumableId];
    if (unitPrice === undefined) {
      missingPrices.push(consumableId);
      lines.push({ consumableId, quantity, unitPrice: null, subtotal: null });
      continue;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new RangeError(`Price of ${consumableId} must be a non-negative number, got ${unitPrice}`);
    }
    const subtotal = quantity * unitPrice;
    total += subtotal;
    lines.push({ consumableId, quantity, unitPrice, subtotal });
  }

  return { unit: snapshot.unit, total, lines, missingPrices, complete: missingPrices.length === 0 };
}
