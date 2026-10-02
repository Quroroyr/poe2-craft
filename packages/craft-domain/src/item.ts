import type { Provenance } from './provenance';
import type { VersionRange } from './version';

export type ItemClassId = string;
export type ItemBaseId = string;

export type Rarity = 'normal' | 'magic' | 'rare' | 'unique';
export type AffixSide = 'prefix' | 'suffix';

export const AFFIX_SIDES: readonly AffixSide[] = ['prefix', 'suffix'];

export interface ItemClass {
  readonly id: ItemClassId;
  readonly name: string;
  /** Value of the "Item Class:" line in the game's Ctrl+C text, e.g. "Spears". */
  readonly clipboardName: string;
  /** Group of classes as the trade data groups them ("weapon", "armour", "accessory", ...). */
  readonly category?: string;
  readonly versions: VersionRange;
  readonly provenance: Provenance;
}

/**
 * Identifier of a piece of game art, e.g. "Art/2DItems/Weapons/OneHandWeapons/OneHandSpears/1HSpear10".
 * Data, not a URL: each frontend resolves it to its own copy of the image (same id space as
 * `Consumable.art`). The domain never depends on where or whether the image exists.
 */
export type ArtAssetId = string;

/**
 * Kind of augment slot an item can have, e.g. "rune-socket". A string defined by data, so new
 * slot kinds need no code change. Which kinds and counts a base allows is base data (`ItemSetupRules`).
 */
export type SlotKindId = string;

/** A displayed base property as the game writes it, e.g. "Physical Damage" → "39-72". */
export interface BaseProperty {
  readonly name: string;
  readonly value: string;
}

/** Requirements to equip the base; a field is absent when the base has no such requirement. */
export interface BaseRequirements {
  readonly level?: number;
  readonly strength?: number;
  readonly dexterity?: number;
  readonly intelligence?: number;
}

/**
 * What the base looks like before any modifier: properties, requirements, implicit lines.
 * Display data only — no engine reads it. It has its own provenance because it usually comes
 * from a different source than the spawn tags of the base.
 */
export interface ItemBaseDetails {
  readonly properties: readonly BaseProperty[];
  readonly requirements: BaseRequirements;
  /** Implicit lines with their value ranges, e.g. "(25–35)% increased Projectile Speed with this Weapon". */
  readonly implicits: readonly string[];
  readonly provenance: Provenance;
}

export interface QualityRule {
  readonly min: number;
  readonly max: number;
  readonly provenance: Provenance;
}

export interface SlotRule {
  readonly kind: SlotKindId;
  /** Display name of the slot kind, e.g. "Rune sockets". */
  readonly label: string;
  /** Allowed counts for a manually built item, ascending; the first one is the default. */
  readonly options: readonly number[];
  readonly provenance: Provenance;
}

/**
 * Which item-setup properties a base supports and in what range. A property without a rule is
 * not offered at all: nothing is assumed to be universal across item classes.
 */
export interface ItemSetupRules {
  readonly quality?: QualityRule;
  readonly slots?: readonly SlotRule[];
}

/**
 * Definition of a base type (Akoyan Spear). Stable, versioned game data; an item only refers to
 * it by `id` (`ItemState.baseId`) and never copies it.
 */
export interface ItemBase {
  readonly id: ItemBaseId;
  readonly name: string;
  readonly itemClassId: ItemClassId;
  /** Spawn tags. Modifier spawn weights are resolved against these (see spawn.ts). */
  readonly tags: readonly string[];
  readonly artAssetId?: ArtAssetId;
  readonly details?: ItemBaseDetails;
  readonly setup?: ItemSetupRules;
  readonly versions: VersionRange;
  readonly provenance: Provenance;
}
