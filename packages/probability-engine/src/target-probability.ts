import {
  weakestConfidence,
  type Confidence,
  type CraftTarget,
  type ModifierId,
} from '@poe2-craft/craft-domain';
import type { EligiblePool, PoolCaveat, PoolEntry, PoolIssue, ReadyPool } from './eligible-pool';
import {
  DEFAULT_ATTEMPT_COUNTS,
  DEFAULT_QUANTILES,
  attemptsForQuantile,
  chanceWithin,
  expectedAttempts,
} from './geometric';

export interface ProbabilityOptions {
  readonly attemptCounts?: readonly number[];
  readonly quantiles?: readonly number[];
}

export interface OutcomeShare {
  readonly modifierId: ModifierId;
  readonly weight: number;
  /** weight / totalWeight: chance that this exact modifier is the one added. */
  readonly probability: number;
  readonly isTarget: boolean;
}

export interface CumulativeChance {
  readonly attempts: number;
  readonly probability: number;
}

export interface AttemptQuantile {
  readonly quantile: number;
  readonly attempts: number;
}

/**
 * - exact: every eligible weight is known;
 * - upper-bound: some eligible weights are unknown, so the real total is larger and the
 *   real chance is lower than shown.
 */
export type ProbabilityBound = 'exact' | 'upper-bound';

export interface ProbabilityOk {
  readonly status: 'ok';
  readonly targetWeight: number;
  readonly totalWeight: number;
  readonly probability: number;
  readonly expectedAttempts: number;
  readonly bound: ProbabilityBound;
  readonly cumulative: readonly CumulativeChance[];
  readonly quantiles: readonly AttemptQuantile[];
  readonly outcomes: readonly OutcomeShare[];
  readonly targetEntries: readonly PoolEntry[];
  readonly caveats: readonly PoolCaveat[];
  /** Weakest confidence among the data the number depends on. */
  readonly confidence: Confidence;
}

export type ProbabilityResult =
  | ProbabilityOk
  | { readonly status: 'blocked'; readonly issues: readonly PoolIssue[] }
  | { readonly status: 'already-satisfied'; readonly modifierIds: readonly ModifierId[] }
  | {
      readonly status: 'target-unavailable';
      readonly targetEntries: readonly PoolEntry[];
      /** Target modifiers that do not exist in the selected game version. */
      readonly missingModifierIds: readonly ModifierId[];
    }
  | {
      readonly status: 'indeterminate';
      readonly reason: 'target-weight-unknown' | 'compound-action';
      readonly modifierIds: readonly ModifierId[];
    };

/**
 * Chance that one application of the pool's action adds one of the target modifiers:
 * P = targetWeight / totalWeight over the eligible pool.
 */
export function calculateTargetProbability(
  pool: EligiblePool,
  target: CraftTarget,
  options: ProbabilityOptions = {},
): ProbabilityResult {
  if (pool.status === 'blocked') return { status: 'blocked', issues: pool.issues };
  if (pool.action.effect.kind === 'operations' && (pool.action.effect.operations.filter((op) => op.kind === 'add-random-mod').length !== 1 || pool.action.effect.operations.some((op) => op.kind !== 'set-rarity' && (op.kind !== 'add-random-mod' || op.count !== 1)))) {
    return { status: 'indeterminate', reason: 'compound-action', modifierIds: [] };
  }

  const wanted = new Set(target.modifierIds);
  const satisfied = [...pool.presentModifierIds].filter((id) => wanted.has(id));
  if (satisfied.length > 0) return { status: 'already-satisfied', modifierIds: satisfied };

  const targetEntries = pool.entries.filter((e) => wanted.has(e.definition.id));
  const known = new Set(targetEntries.map((e) => e.definition.id));
  const missingModifierIds = target.modifierIds.filter((id) => !known.has(id));
  const eligibleTargets = targetEntries.filter((e) => e.eligible);

  if (eligibleTargets.length === 0) {
    return { status: 'target-unavailable', targetEntries, missingModifierIds };
  }
  const unknownTargetWeights = eligibleTargets.filter((e) => e.weight === null);
  if (unknownTargetWeights.length > 0) {
    return {
      status: 'indeterminate',
      reason: 'target-weight-unknown',
      modifierIds: unknownTargetWeights.map((e) => e.definition.id),
    };
  }

  const targetWeight = eligibleTargets.reduce((sum, e) => sum + (e.weight ?? 0), 0);
  const totalWeight = pool.totalKnownWeight;
  const probability = targetWeight / totalWeight;

  return {
    status: 'ok',
    targetWeight,
    totalWeight,
    probability,
    expectedAttempts: expectedAttempts(probability),
    bound: pool.unknownWeightModifierIds.length > 0 ? 'upper-bound' : 'exact',
    cumulative: (options.attemptCounts ?? DEFAULT_ATTEMPT_COUNTS).map((attempts) => ({
      attempts,
      probability: chanceWithin(probability, attempts),
    })),
    quantiles: (options.quantiles ?? DEFAULT_QUANTILES).map((quantile) => ({
      quantile,
      attempts: attemptsForQuantile(probability, quantile),
    })),
    outcomes: outcomeShares(pool, wanted),
    targetEntries,
    caveats: pool.caveats,
    confidence: dataConfidence(pool, eligibleTargets),
  };
}

function outcomeShares(pool: ReadyPool, wanted: ReadonlySet<ModifierId>): OutcomeShare[] {
  return pool.eligible
    .filter((e) => e.weight !== null)
    .map((e) => ({
      modifierId: e.definition.id,
      weight: e.weight ?? 0,
      probability: (e.weight ?? 0) / pool.totalKnownWeight,
      isTarget: wanted.has(e.definition.id),
    }));
}

function dataConfidence(pool: ReadyPool, targets: readonly PoolEntry[]): Confidence {
  const levels: Confidence[] = [
    pool.action.provenance.confidence,
    pool.base.provenance.confidence,
    pool.affixLimits.provenance.confidence,
    ...pool.eligible.map((e) => e.definition.provenance.confidence),
    ...targets.map((e) => e.definition.provenance.confidence),
  ];
  return weakestConfidence(levels) ?? 'experimental';
}
