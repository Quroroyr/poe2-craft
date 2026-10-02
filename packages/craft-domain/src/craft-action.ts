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
export type CraftEffect = AddRandomModifierEffect;

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
