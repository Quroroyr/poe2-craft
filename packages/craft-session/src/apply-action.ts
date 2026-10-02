import {
  AFFIX_SIDES,
  createItemState,
  withExplicitFractured,
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
  | { readonly code: 'operation-not-applicable' }
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
export interface OperationsOutcome {
  readonly status: 'applied';
  readonly before: ItemState;
  readonly item: ItemState;
  readonly changes: readonly { readonly kind: string; readonly modifierId?: string; readonly index?: number }[];
}

export interface RejectedOutcome {
  readonly status: 'rejected';
  readonly item: ItemState;
  readonly rejection: ApplyRejection;
}

export type ApplyOutcome = AppliedOutcome | OperationsOutcome | RejectedOutcome;

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
    case 'operations': return applyOperations(input, pool);
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
  if (pool.action.effect.kind === 'operations') {
    const operations = pool.action.effect.operations;
    if (operations.length === 0) return { code: 'operation-not-applicable' };
    if (pool.item.explicits.some((m) => m.kind === 'resolved' && !pool.entries.some((e) => e.definition.id === m.modifierId))) return { code: 'operation-not-applicable' };
    // Preflight every primitive before consuming any RNG or changing the item (Chaos is atomic).
    for (const op of operations) {
      if (op.kind === 'remove-random-mod' || op.kind === 'fracture-random-mod') {
        const candidates = pool.item.explicits.filter((m) => !m.fractured && m.kind === 'resolved' && (!('allowedSides' in op) || !op.allowedSides || pool.entries.some((e) => e.definition.id === m.modifierId && op.allowedSides!.includes(e.definition.side))));
        if (pool.item.explicits.some((m) => m.kind === 'unresolved') || candidates.length < (op.kind === 'remove-random-mod' ? op.count : 1)) return { code: 'operation-not-applicable' };
      }
      if (op.kind === 'reroll-values' && (pool.item.explicits.some((m) => m.kind === 'unresolved') || !pool.item.explicits.some((m) => !m.fractured && m.kind === 'resolved' && pool.entries.find((e) => e.definition.id === m.modifierId)?.definition.lines.some((l) => l.ranges.length)))) return { code: 'operation-not-applicable' };
      if (op.kind === 'add-random-mod') {
        const removes = operations.some((o) => o.kind === 'remove-random-mod');
        const candidates = removes ? pool.entries.filter((e) => !e.reasons.some((r) => !['no-free-affix-slot', 'group-already-on-item', 'modifier-already-on-item'].includes(r.code))) : pool.eligible;
        const unknown = candidates.filter((e) => e.weight === null).map((e) => e.definition.id);
        if (unknown.length) return { code: 'unknown-weights', modifierIds: unknown };
        if (!removes && op.allowedSides.reduce((sum, side) => sum + pool.slots[side].free, 0) < op.count) return { code: 'no-free-slot', sides: op.allowedSides };
        if (!candidates.length) return { code: 'no-eligible-modifiers' };
      }
    }
    return null;
  }
  const effect = pool.action.effect;
  const sides = AFFIX_SIDES.filter((side) => effect.allowedSides.includes(side));
  if (sides.length > 0 && sides.every((side) => pool.slots[side].free <= 0)) {
    return { code: 'no-free-slot', sides };
  }
  if (pool.unknownWeightModifierIds.length > 0) {
    return { code: 'unknown-weights', modifierIds: pool.unknownWeightModifierIds };
  }
  if (pool.eligible.length === 0 || pool.totalKnownWeight <= 0) return { code: 'no-eligible-modifiers' };
  return null;
}

function applyOperations(input: ApplyInput, initial: import('@poe2-craft/probability-engine').ReadyPool): ApplyOutcome {
  if (initial.action.effect.kind !== 'operations') throw new Error('Operations effect required');
  const view = input.db.forVersion(input.context.gameVersion);
  let current = input.item;
  const changes: { kind: string; modifierId?: string; index?: number }[] = [];
  const reject = (rejection: ApplyRejection): RejectedOutcome => ({ status: 'rejected', item: input.item, rejection });
  for (const op of initial.action.effect.operations) {
    switch (op.kind) {
      case 'set-rarity':
        current = createItemState({ ...current, rarity: op.rarity, explicits: op.clearModifiers ? current.explicits.filter((m) => m.fractured) : current.explicits });
        changes.push({ kind: op.kind }); break;
      case 'add-random-mod':
        for (let n = 0; n < op.count; n++) {
          const action = { ...initial.action, requirements: { rarities: current.rarity ? [current.rarity] : [] }, effect: { kind: 'add-random-modifier' as const, allowedSides: op.allowedSides, minModifierLevel: op.minModifierLevel, layer: op.layer } };
          const pool = buildEligiblePool({ ...input, item: current, action });
          const rejection = checkApplicable(pool);
          if (rejection || pool.status === 'blocked') return reject(rejection ?? { code: 'operation-not-applicable' });
          const definition = pickWeighted(pool.eligible, input.rng()).definition;
          const values = rollValues(definition, input.rng);
          current = withExplicitModifier(current, { kind: 'resolved', modifierId: definition.id, values, fractured: false, sourceText: renderModifierText(definition, values) });
          changes.push({ kind: op.kind, modifierId: definition.id });
        }
        break;
      case 'remove-random-mod':
      case 'fracture-random-mod': {
        for (let n = 0; n < (op.kind === 'remove-random-mod' ? op.count : 1); n++) {
          let candidates = current.explicits.flatMap((m, index) => {
            const def = m.kind === 'resolved' ? view.getModifier(m.modifierId) : undefined;
            return !m.fractured && def && (op.kind === 'fracture-random-mod' || !op.allowedSides || op.allowedSides.includes(def.side)) ? [{ index, definition: def }] : [];
          });
          if (op.kind === 'remove-random-mod' && op.lowestLevel) {
            const min = Math.min(...candidates.map((c) => c.definition.modifierLevel));
            candidates = candidates.filter((c) => c.definition.modifierLevel === min);
          }
          const picked = candidates[Math.floor(input.rng() * candidates.length)];
          if (!picked) return reject({ code: 'operation-not-applicable' });
          current = op.kind === 'remove-random-mod' ? createItemState({ ...current, explicits: current.explicits.filter((_, i) => i !== picked.index) }) : withExplicitFractured(current, picked.index, true);
          changes.push({ kind: op.kind, modifierId: picked.definition.id, index: picked.index });
        }
        break;
      }
      case 'reroll-values':
        current = createItemState({ ...current, explicits: current.explicits.map((m) => {
          const def = m.kind === 'resolved' && !m.fractured ? view.getModifier(m.modifierId) : undefined;
          if (!def) return m;
          const values = rollValues(def, input.rng);
          return { ...m, values, sourceText: renderModifierText(def, values) };
        }) });
        changes.push({ kind: op.kind }); break;
      case 'corrupt': current = createItemState({ ...current, corrupted: true }); changes.push({ kind: op.kind }); break;
    }
  }
  return { status: 'applied', before: input.item, item: current, changes };
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
