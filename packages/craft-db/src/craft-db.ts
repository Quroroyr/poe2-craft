import {
  compareGameVersions,
  isAvailableIn,
  isSpawnable,
  resolveSpawnWeight,
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
  findBaseByName(name: string): ItemBase | undefined;
  getGroup(id: ModifierGroupId): ModifierGroup | undefined;
  getModifier(id: ModifierId): ModifierDefinition | undefined;
  listModifiers(filter?: ModifierFilter): readonly ModifierDefinition[];
  getAction(id: CraftActionId): CraftAction | undefined;
  listActions(): readonly CraftAction[];
  getTarget(id: CraftTargetId): CraftTarget | undefined;
  listTargets(): readonly CraftTarget[];
  getAffixLimits(rarity: Rarity): AffixLimitRule | undefined;
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
  const groupById = byId(groups);
  const actionById = byId(actions);
  const targetById = byId(targets);
  const consumableById = byId(consumables);
  const sourceById = byId(dataset.info.sources);

  const normalise = (s: string) => s.trim().toLowerCase();

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
    findBaseByName: (name) => bases.find((b) => normalise(b.name) === normalise(name)),
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
        if (base && !isSpawnable(resolveSpawnWeight(m, base.tags))) return false;
        return true;
      });
    },
    getAction: (id) => actionById.get(id),
    listActions: () => actions,
    getTarget: (id) => targetById.get(id),
    listTargets: () => targets,
    getAffixLimits: (rarity) => affixLimits.find((r) => r.rarity === rarity),
    getConsumable: (id) => consumableById.get(id),
    listConsumables: () => consumables,
  };
}
