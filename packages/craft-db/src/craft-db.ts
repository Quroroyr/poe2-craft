import {
  compareGameVersions,
  isAvailableIn,
  isSpawnable,
  resolveSpawnWeight,
  sameDomain,
  modifyAction,
  type AffixLimitRule,
  type AffixSide,
  type Consumable,
  type ConsumableId,
  type CraftAction,
  type CraftActionId,
  type CraftTarget,
  type CraftTargetId,
  type DataSource,
  type DataSourceId,
  type GameVersion,
  type ItemBase,
  type ItemBaseId,
  type ItemClass,
  type ItemClassId,
  type ModifierDefinition,
  type ModifierGroup,
  type ModifierGroupId,
  type ModifierId,
  type Rarity,
  type SpecialModifierDefinition,
  type VersionRange,
} from '@poe2-craft/craft-domain';
import type { CraftDataset, DatasetInfo } from './dataset';
import { validateDataset } from './validate';

export interface ModifierFilter {
  /** Keep only modifiers that can spawn on this base (via its spawn tags). */
  readonly baseId?: ItemBaseId;
  /** Keep only modifiers with requiredItemLevel <= this value. */
  readonly maxItemLevel?: number;
  readonly side?: AffixSide;
}

/**
 * Read-only view of game data as it exists in one game version.
 * Every lookup goes through a view, so callers cannot accidentally mix patches.
 */
export interface CraftDbView {
  readonly gameVersion: GameVersion;
  readonly info: DatasetInfo;
  getSource(id: DataSourceId): DataSource | undefined;
  getItemClass(id: ItemClassId): ItemClass | undefined;
  listItemClasses(): readonly ItemClass[];
  findItemClassByClipboardName(name: string): ItemClass | undefined;
  getBase(id: ItemBaseId): ItemBase | undefined;
  listBases(): readonly ItemBase[];
  /** The base with this name; when several share it, the one not marked ambiguous (or the first). */
  findBaseByName(name: string): ItemBase | undefined;
  /** Every base with this name (several when the export has different records under one name). */
  findBasesByName(name: string): readonly ItemBase[];
  getGroup(id: ModifierGroupId): ModifierGroup | undefined;
  getModifier(id: ModifierId): ModifierDefinition | undefined;
  listModifiers(filter?: ModifierFilter): readonly ModifierDefinition[];
  /**
   * Tier of a modifier on a base: its rank inside its family among the family members that can
   * spawn on that base, by required level (1 = best). Tiers are not global — the same modifier can
   * be T1 on one class and T4 on another. Falls back to the stored tier when the base is unknown
   * or the modifier cannot spawn on it.
   */
  tierOf(modifierId: ModifierId, baseId: ItemBaseId | null | undefined): number;
  getSpecialModifier(id: ModifierId): SpecialModifierDefinition | undefined;
  listSpecialModifiers(): readonly SpecialModifierDefinition[];
  getAction(id: CraftActionId): CraftAction | undefined;
  listActions(): readonly CraftAction[];
  getTarget(id: CraftTargetId): CraftTarget | undefined;
  listTargets(): readonly CraftTarget[];
  /** The rule for this rarity and class: a class-specific rule wins over one for every class. */
  getAffixLimits(rarity: Rarity, itemClassId?: ItemClassId | null): AffixLimitRule | undefined;
  getConsumable(id: ConsumableId): Consumable | undefined;
  listConsumables(): readonly Consumable[];
}

export interface CraftDb {
  readonly info: DatasetInfo;
  /** Versions covered by the dataset, oldest first. */
  readonly supportedVersions: readonly GameVersion[];
  forVersion(version: GameVersion): CraftDbView;
}

export class UnsupportedGameVersionError extends Error {
  constructor(version: GameVersion, supported: readonly GameVersion[]) {
    super(`Game version ${version} is not covered by this CraftDB (supported: ${supported.join(', ')})`);
    this.name = 'UnsupportedGameVersionError';
  }
}

export class InvalidDatasetError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid CraftDB dataset:\n- ${problems.join('\n- ')}`);
    this.name = 'InvalidDatasetError';
  }
}

export function createCraftDb(dataset: CraftDataset): CraftDb {
  const problems = validateDataset(dataset);
  if (problems.length > 0) throw new InvalidDatasetError(problems);

  const supportedVersions = [...dataset.info.gameVersions].sort(compareGameVersions);
  const views = new Map<GameVersion, CraftDbView>();

  return {
    info: dataset.info,
    supportedVersions,
    forVersion(version) {
      if (!supportedVersions.includes(version)) {
        throw new UnsupportedGameVersionError(version, supportedVersions);
      }
      let view = views.get(version);
      if (!view) {
        view = createView(dataset, version);
        views.set(version, view);
      }
      return view;
    },
  };
}

function createView(dataset: CraftDataset, version: GameVersion): CraftDbView {
  const live = <T extends { versions: VersionRange }>(records: readonly T[]): T[] =>
    records.filter((r) => isAvailableIn(r.versions, version));

  const itemClasses = live(dataset.itemClasses);
  const bases = live(dataset.bases);
  const modifiers = live(dataset.modifiers);
  const specialModifiers = live(dataset.specialModifiers ?? []);
  const actions = live(dataset.actions);
  const consumables = live(dataset.consumables);
  const affixLimits = live(dataset.affixLimits);
  // Groups and targets are not versioned on their own: they only matter through the live
  // modifiers that reference them.
  const groups = dataset.groups;
  const targets = dataset.targets;

  const byId = <T extends { id: string }>(records: readonly T[]) =>
    new Map(records.map((r) => [r.id, r] as const));

  const classById = byId(itemClasses);
  const baseById = byId(bases);
  const modifierById = byId(modifiers);
  const specialById = byId(specialModifiers);
  const groupById = byId(groups);
  const actionById = byId(actions);
  const targetById = byId(targets);
  const consumableById = byId(consumables);
  const sourceById = byId(dataset.info.sources);

  const normalise = (s: string) => s.trim().toLowerCase();
  const basesByName = new Map<string, ItemBase[]>();
  for (const b of bases) basesByName.set(normalise(b.name), [...(basesByName.get(normalise(b.name)) ?? []), b]);

  // Family key: data family when present, else side + groups (hand-written data).
  const familyKey = (m: ModifierDefinition) =>
    `${m.layer ?? 'explicit'}|${m.side}|${m.family ?? [...m.groupIds].sort().join('+')}`;
  const byFamily = new Map<string, ModifierDefinition[]>();
  for (const m of modifiers) byFamily.set(familyKey(m), [...(byFamily.get(familyKey(m)) ?? []), m]);
  const tierCache = new Map<string, Map<ModifierId, number>>();
  const tiersFor = (base: ItemBase) => {
    let tiers = tierCache.get(base.id);
    if (tiers) return tiers;
    tiers = new Map();
    for (const family of byFamily.values()) {
      const levels = [
        ...new Set(
          family
            .filter((m) => sameDomain(m.domain, base.domain) && isSpawnable(resolveSpawnWeight(m, base.tags)))
            .map((m) => m.requiredItemLevel),
        ),
      ].sort((a, b) => b - a);
      for (const m of family) {
        const at = levels.indexOf(m.requiredItemLevel);
        if (at >= 0 && isSpawnable(resolveSpawnWeight(m, base.tags))) tiers.set(m.id, at + 1);
      }
    }
    tierCache.set(base.id, tiers);
    return tiers;
  };

  return {
    gameVersion: version,
    info: dataset.info,
    getSource: (id) => sourceById.get(id),
    getItemClass: (id) => classById.get(id),
    listItemClasses: () => itemClasses,
    findItemClassByClipboardName: (name) =>
      itemClasses.find((c) => normalise(c.clipboardName) === normalise(name)),
    getBase: (id) => baseById.get(id),
    listBases: () => bases,
    findBaseByName: (name) => {
      const found = basesByName.get(normalise(name)) ?? [];
      return found.find((b) => !b.ambiguousName) ?? found[0];
    },
    findBasesByName: (name) => basesByName.get(normalise(name)) ?? [],
    getGroup: (id) => groupById.get(id),
    getModifier: (id) => modifierById.get(id),
    listModifiers(filter = {}) {
      const base = filter.baseId === undefined ? undefined : baseById.get(filter.baseId);
      if (filter.baseId !== undefined && !base) return [];
      return modifiers.filter((m) => {
        if (filter.side !== undefined && m.side !== filter.side) return false;
        if (filter.maxItemLevel !== undefined && m.requiredItemLevel > filter.maxItemLevel) {
          return false;
        }
        if (base && (!sameDomain(m.domain, base.domain) || !isSpawnable(resolveSpawnWeight(m, base.tags)))) return false;
        return true;
      });
    },
    tierOf(modifierId, baseId) {
      const definition = modifierById.get(modifierId);
      const base = baseId ? baseById.get(baseId) : undefined;
      if (!definition) return 0;
      return (base ? tiersFor(base).get(modifierId) : undefined) ?? definition.tier;
    },
    getSpecialModifier: (id) => specialById.get(id),
    listSpecialModifiers: () => specialModifiers,
    getAction: (id) => {
      const [primaryId, ...omenIds] = id.split('+');
      let action = actionById.get(primaryId!);
      for (const omenId of omenIds) {
        const omen = consumableById.get(omenId);
        if (!action || !omen?.actionModifiers || !omen.modifies?.consumableIds.some((c) => action!.defaultCost.some((cost) => cost.consumableId === c))) return undefined;
        action = modifyAction(action, omenId, omen.actionModifiers) ?? undefined;
      }
      return action;
    },
    listActions: () => actions,
    getTarget: (id) => targetById.get(id),
    listTargets: () => targets,
    getAffixLimits: (rarity, itemClassId) =>
      affixLimits.find((r) => r.rarity === rarity && itemClassId && r.itemClassIds?.includes(itemClassId)) ??
      affixLimits.find((r) => r.rarity === rarity && r.itemClassIds === undefined),
    getConsumable: (id) => consumableById.get(id),
    listConsumables: () => consumables,
  };
}
