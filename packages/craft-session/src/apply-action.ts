import {
  AFFIX_SIDES,
  rangeDecimals,
  renderModifierText,
  withExplicitModifier,
  type CraftActionId,
  type CraftContext,
  type ItemState,
  type ModifierDefinition,
  type ModifierId,
  type ResolvedModifier,
  type AffixSide,
} from '@poe2-craft/craft-domain';
import type { CraftDb } from '@poe2-craft/craft-db';
import {
  buildEligiblePool,
  type EligiblePool,
  type PoolEntry,
  type PoolIssue,
} from '@poe2-craft/probability-engine';
import type { Rng } from './rng';

export interface ApplyInput {
  readonly item: ItemState;
  readonly context: CraftContext;
  readonly db: CraftDb;
  readonly actionId: CraftActionId;
  readonly rng: Rng;
}

/** Why an action was not applied. The item is returned untouched in every case. */
export type ApplyRejection =
  | { readonly code: 'pool-blocked'; readonly issues: readonly PoolIssue[] }
  /** Every side the action may add to is full. */
  | { readonly code: 'no-free-slot'; readonly sides: readonly AffixSide[] }
  | { readonly code: 'no-eligible-modifiers' }
  /** Sampling with an unknown weight would invent a number (crafting invariant 8). */
  | { readonly code: 'unknown-weights'; readonly modifierIds: readonly ModifierId[] };

export interface AppliedOutcome {
  readonly status: 'applied';
  readonly before: ItemState;
  readonly item: ItemState;
  readonly added: ResolvedModifier;
  readonly definition: ModifierDefinition;
  /** Chance that this particular modifier was the one added. */
  readonly share: number;
  readonly totalWeight: number;
}

export interface RejectedOutcome {
  readonly status: 'rejected';
  readonly item: ItemState;
  readonly rejection: ApplyRejection;
}

export type ApplyOutcome = AppliedOutcome | RejectedOutcome;

/**
 * DEMO SIMULATION of one craft attempt: current item + action → new item.
 * Uses the same eligible pool as the probability engine and picks one modifier by weight,
 * then rolls its values uniformly within the tier ranges. This is the simplified v0.1
 * action model, not a verified reproduction of PoE 2 currency behaviour.
 */
export function applyAction(input: ApplyInput): ApplyOutcome {
  const { item, rng } = input;
  const pool = buildEligiblePool(input);
  const rejection = checkApplicable(pool);
  if (rejection || pool.status === 'blocked') {
    return { status: 'rejected', item, rejection: rejection ?? { code: 'no-eligible-modifiers' } };
  }

  // The switch keeps future effect kinds from silently reusing this sampling model.
  switch (pool.action.effect.kind) {
    case 'add-random-modifier': {
      const picked = pickWeighted(pool.eligible, rng());
      const definition = picked.definition;
      const values = rollValues(definition, rng);
      const added: ResolvedModifier = {
        kind: 'resolved',
        modifierId: definition.id,
        values,
        fractured: false,
        sourceText: renderModifierText(definition, values),
      };
      return {
        status: 'applied',
        before: item,
        item: withExplicitModifier(item, added),
        added,
        definition,
        share: (picked.weight ?? 0) / pool.totalKnownWeight,
        totalWeight: pool.totalKnownWeight,
      };
    }
  }
}

/**
 * Why the pool's action cannot be applied, or null when it can. Shared by applyAction and by
 * the UI preview ("hover the item"), so the preview never disagrees with the real click.
 */
export function checkApplicable(pool: EligiblePool): ApplyRejection | null {
  if (pool.status === 'blocked') return { code: 'pool-blocked', issues: pool.issues };
  const sides = AFFIX_SIDES.filter((side) => pool.action.effect.allowedSides.includes(side));
  if (sides.length > 0 && sides.every((side) => pool.slots[side].free <= 0)) {
    return { code: 'no-free-slot', sides };
  }
  if (pool.unknownWeightModifierIds.length > 0) {
    return { code: 'unknown-weights', modifierIds: pool.unknownWeightModifierIds };
  }
  if (pool.eligible.length === 0 || pool.totalKnownWeight <= 0) return { code: 'no-eligible-modifiers' };
  return null;
}

/** Weighted choice: walks the cumulative weights with r ∈ [0, 1). Entries must have known weights. */
export function pickWeighted(entries: readonly PoolEntry[], r: number): PoolEntry {
  const total = entries.reduce((sum, e) => sum + (e.weight ?? 0), 0);
  let threshold = r * total;
  for (const entry of entries) {
    threshold -= entry.weight ?? 0;
    if (threshold < 0) return entry;
  }
  // Only reachable through floating-point rounding when r is extremely close to 1.
  const last = entries[entries.length - 1];
  if (!last) throw new Error('pickWeighted needs at least one entry');
  return last;
}

/** Uniform roll inside each tier range, kept to the precision the range is written in. */
export function rollValues(definition: ModifierDefinition, rng: Rng): number[] {
  return definition.lines.flatMap((line) =>
    line.ranges.map((range) => {
      if (range.min === range.max) return range.min;
      const factor = 10 ** rangeDecimals(range);
      const steps = Math.round((range.max - range.min) * factor);
      const value = range.min + Math.floor(rng() * (steps + 1)) / factor;
      return Math.min(range.max, Number(value.toFixed(rangeDecimals(range))));
    }),
  );
}
