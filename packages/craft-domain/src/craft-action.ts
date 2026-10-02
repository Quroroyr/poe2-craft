import type { ConsumableId } from './consumable';
import type { AffixSide, Rarity } from './item';
import type { Provenance } from './provenance';
import type { GameVersion, VersionRange } from './version';
import type { ModifierLayer } from './modifier';

export type CraftActionId = string;

/**
 * What an action does to the item. A discriminated union so new mechanics
 * (remove, reroll, omen modifiers, essences, ...) are added as new kinds
 * without changing existing ones. v0.1 implements only `add-random-modifier`.
 */
export type CraftEffect = AddRandomModifierEffect | OperationsEffect;

export type CraftOperation =
  | { readonly kind: 'set-rarity'; readonly rarity: Rarity; readonly clearModifiers?: boolean }
  | { readonly kind: 'add-random-mod'; readonly count: number; readonly allowedSides: readonly AffixSide[]; readonly minModifierLevel?: number; readonly layer?: ModifierLayer }
  | { readonly kind: 'remove-random-mod'; readonly count: number; readonly allowedSides?: readonly AffixSide[]; readonly lowestLevel?: boolean }
  | { readonly kind: 'reroll-values' }
  | { readonly kind: 'fracture-random-mod' }
  | { readonly kind: 'corrupt' };

export interface OperationsEffect {
  readonly kind: 'operations';
  readonly operations: readonly CraftOperation[];
}

export type ActionModifier =
  | { readonly kind: 'restrict-side'; readonly operation: 'add' | 'remove'; readonly side: AffixSide }
  | { readonly kind: 'extra-mod'; readonly count: number }
  | { readonly kind: 'remove-lowest-level' };

/** Composes researched omen rules; never synthesises a currency mechanic. */
export function modifyAction(action: CraftAction, omenId: string, modifiers: readonly ActionModifier[]): CraftAction | null {
  if (action.effect.kind !== 'operations') return null;
  let operations = [...action.effect.operations];
  for (const modifier of modifiers) {
    let changed = false;
    operations = operations.map((op): CraftOperation => {
      if (modifier.kind === 'restrict-side' && ((modifier.operation === 'add' && op.kind === 'add-random-mod') || (modifier.operation === 'remove' && op.kind === 'remove-random-mod'))) { changed = true; return { ...op, allowedSides: [modifier.side] }; }
      if (modifier.kind === 'extra-mod' && op.kind === 'add-random-mod') { changed = true; return { ...op, count: op.count + modifier.count }; }
      if (modifier.kind === 'remove-lowest-level' && op.kind === 'remove-random-mod') { changed = true; return { ...op, lowestLevel: true }; }
      return op;
    });
    if (!changed) return null;
  }
  return { ...action, id: `${action.id}+${omenId}`, effect: { kind: 'operations', operations }, defaultCost: [...action.defaultCost, { consumableId: omenId, quantity: 1 }] };
}

export interface AddRandomModifierEffect {
  readonly kind: 'add-random-modifier';
  /** Sides the new modifier may land on. */
  readonly allowedSides: readonly AffixSide[];
  /** Only modifiers with modifierLevel >= this value can be added. */
  readonly minModifierLevel?: number;
  readonly layer?: ModifierLayer;
}

export interface CraftActionRequirements {
  readonly rarities: readonly Rarity[];
  readonly minModifiers?: number;
  readonly maxModifiers?: number;
  readonly uncorrupted?: boolean;
  readonly unfractured?: boolean;
}

export interface ConsumableAmount {
  readonly consumableId: ConsumableId;
  readonly quantity: number;
}

export interface CraftAction {
  readonly id: CraftActionId;
  readonly name: string;
  readonly description: string;
  readonly requirements: CraftActionRequirements;
  readonly effect: CraftEffect;
  /** Consumables spent by one attempt. A starting point for the economy; users can edit it. */
  readonly defaultCost: readonly ConsumableAmount[];
  readonly versions: VersionRange;
  readonly provenance: Provenance;
}

/** Environment the calculation runs in. Game rules always depend on the version. */
export interface CraftContext {
  readonly gameVersion: GameVersion;
}
