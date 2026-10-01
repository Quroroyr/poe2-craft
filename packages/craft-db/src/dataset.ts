import type {
  AffixLimitRule,
  Consumable,
  CraftAction,
  CraftTarget,
  DataSource,
  GameVersion,
  ItemBase,
  ItemClass,
  ModifierDefinition,
  ModifierGroup,
} from '@poe2-craft/craft-domain';

/**
 * - fixture: hand-written demo data; every UI surface must label it as such;
 * - production: data imported from verifiable sources.
 * Business logic must never branch on this value (crafting invariant 9).
 */
export type DatasetKind = 'fixture' | 'production';

export interface DatasetInfo {
  readonly id: string;
  readonly title: string;
  readonly kind: DatasetKind;
  readonly description: string;
  /** Game versions this dataset claims to describe. */
  readonly gameVersions: readonly GameVersion[];
  readonly sources: readonly DataSource[];
}

/** Raw, serialisable content of a CraftDB. Records may appear in several revisions (see ADR 002). */
export interface CraftDataset {
  readonly info: DatasetInfo;
  readonly itemClasses: readonly ItemClass[];
  readonly bases: readonly ItemBase[];
  readonly groups: readonly ModifierGroup[];
  readonly modifiers: readonly ModifierDefinition[];
  readonly actions: readonly CraftAction[];
  readonly targets: readonly CraftTarget[];
  readonly affixLimits: readonly AffixLimitRule[];
  readonly consumables: readonly Consumable[];
}
