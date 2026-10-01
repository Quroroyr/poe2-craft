import {
  DEFAULT_QUANTILES,
  attemptsForQuantile,
  expectedAttempts,
} from '@poe2-craft/probability-engine';

export interface CostQuantile {
  readonly quantile: number;
  readonly attempts: number;
  readonly cost: number;
}

export interface StageCost {
  readonly costPerAttempt: number;
  readonly expectedAttempts: number;
  /** costPerAttempt / p — the long-run average, not what a single crafter will pay. */
  readonly expectedCost: number;
  /** "q of crafters finish within `attempts`, spending at most `cost`". */
  readonly quantiles: readonly CostQuantile[];
}

/**
 * Cost of a repeat-until-success stage where each attempt costs the same and succeeds
 * independently with `successProbability`.
 */
export function calculateStageCost(
  successProbability: number,
  costPerAttempt: number,
  quantiles: readonly number[] = DEFAULT_QUANTILES,
): StageCost {
  if (!Number.isFinite(costPerAttempt) || costPerAttempt < 0) {
    throw new RangeError(`Cost per attempt must be a non-negative number, got ${costPerAttempt}`);
  }
  const attempts = expectedAttempts(successProbability);
  return {
    costPerAttempt,
    expectedAttempts: attempts,
    expectedCost: costOf(attempts, costPerAttempt),
    quantiles: quantiles.map((quantile) => {
      const n = attemptsForQuantile(successProbability, quantile);
      return { quantile, attempts: n, cost: costOf(n, costPerAttempt) };
    }),
  };
}

// Infinity × 0 is NaN; a free attempt costs nothing however many are needed.
function costOf(attempts: number, costPerAttempt: number): number {
  return costPerAttempt === 0 ? 0 : attempts * costPerAttempt;
}
