import {
  isSpawnable,
  resolveSpawnWeight,
  sameDomain,
  type AffixLimitRule,
  type AffixSide,
  type CraftAction,
  type CraftActionId,
  type CraftContext,
  type ItemBase,
  type ItemState,
  type ModifierDefinition,
  type ModifierGroupId,
  type ModifierId,
  type Rarity,
} from '@poe2-craft/craft-domain';
import type { CraftDb, DatasetInfo } from '@poe2-craft/craft-db';
import { collectAffixFacts, type GroupOccupant, type SlotSummary } from './affix-slots';

/**
 * The action is given by id (looked up in CraftDB) or as an object. The object form exists
 * for pools that are not a game action, e.g. "which modifiers could legally be added by hand".
 */
export type PoolInput = {
  readonly item: ItemState;
  readonly context: CraftContext;
  readonly db: CraftDb;
} & ({ readonly actionId: CraftActionId } | { readonly action: CraftAction });

/** Why a modifier cannot be the outcome of this action on this item. A modifier may have several. */
export type ExclusionReason =
  | { readonly code: 'wrong-domain' }
  | { readonly code: 'layer-not-allowed' }
  | { readonly code: 'not-spawnable-on-base'; readonly matchedTag: string | null }
  | { readonly code: 'item-level-too-low'; readonly required: number; readonly itemLevel: number }
  | {
      readonly code: 'below-action-min-modifier-level';
      readonly modifierLevel: number;
      readonly minimum: number;
    }
  | { readonly code: 'side-not-allowed-by-action'; readonly side: AffixSide }
  | { readonly code: 'no-free-affix-slot'; readonly side: AffixSide; readonly used: number; readonly max: number }
  | { readonly code: 'modifier-already-on-item'; readonly fractured: boolean }
  | { readonly code: 'group-already-on-item'; readonly groupId: ModifierGroupId; readonly occupant: GroupOccupant };

export type ExclusionCode = ExclusionReason['code'];

export interface PoolEntry {
  readonly definition: ModifierDefinition;
  readonly tier: number;
  /** Weight for this base; null when the data does not know it. */
  readonly weight: number | null;
  /** Spawn tag that decided the weight, null when none matched. */
  readonly spawnTag: string | null;
  readonly eligible: boolean;
  readonly reasons: readonly ExclusionReason[];
}

/** The pool cannot be built at all. */
export type PoolIssue =
  | { readonly code: 'action-requirements-not-met' }
  | { readonly code: 'base-not-supported' }
  | { readonly code: 'action-unknown'; readonly actionId: CraftActionId }
  | { readonly code: 'base-unknown'; readonly baseName: string | null }
  | { readonly code: 'item-level-unknown' }
  | { readonly code: 'rarity-unknown' }
  | { readonly code: 'rarity-not-allowed'; readonly rarity: Rarity; readonly allowed: readonly Rarity[] }
  | { readonly code: 'affix-limits-unknown'; readonly rarity: Rarity };

/** The pool was built, but the result carries uncertainty the user must see. */
export type PoolCaveat =
  | { readonly code: 'unknown-side-lines'; readonly count: number }
  | { readonly code: 'unresolved-lines-block-groups'; readonly texts: readonly string[] }
  | { readonly code: 'modifier-missing-in-version'; readonly modifierIds: readonly ModifierId[] }
  | { readonly code: 'unknown-weights-in-pool'; readonly modifierIds: readonly ModifierId[] }
  | { readonly code: 'fixture-dataset'; readonly datasetId: string };

export interface ReadyPool {
  readonly status: 'ready';
  readonly context: CraftContext;
  readonly dataset: DatasetInfo;
  readonly action: CraftAction;
  readonly item: ItemState;
  readonly base: ItemBase;
  readonly itemLevel: number;
  readonly rarity: Rarity;
  readonly affixLimits: AffixLimitRule;
  readonly slots: SlotSummary;
  readonly occupiedGroups: readonly GroupOccupant[];
  readonly presentModifierIds: ReadonlySet<ModifierId>;
  /** Every modifier of the game version, eligible or not, in data order. */
  readonly entries: readonly PoolEntry[];
  readonly eligible: readonly PoolEntry[];
  /** Sum of known weights of eligible modifiers. */
  readonly totalKnownWeight: number;
  readonly unknownWeightModifierIds: readonly ModifierId[];
  readonly caveats: readonly PoolCaveat[];
}

export interface BlockedPool {
  readonly status: 'blocked';
  readonly context: CraftContext;
  readonly dataset: DatasetInfo;
  readonly action: CraftAction | null;
  readonly item: ItemState;
  readonly issues: readonly PoolIssue[];
}

export type EligiblePool = ReadyPool | BlockedPool;

/**
 * Builds the set of modifiers the action could add to the item, with a reason for every
 * exclusion. Contains no modifier-specific logic: everything comes from the data.
 */
export function buildEligiblePool(input: PoolInput): EligiblePool {
  const { context, db } = input;
  const originalItem = input.item;
  let item = originalItem;
  const view = db.forVersion(context.gameVersion);
  const action = 'action' in input ? input.action : (view.getAction(input.actionId) ?? null);
  const base = item.baseId === null ? undefined : view.getBase(item.baseId);

  const issues: PoolIssue[] = [];
  if (!action) issues.push({ code: 'action-unknown', actionId: 'actionId' in input ? input.actionId : '' });
  if (!base) issues.push({ code: 'base-unknown', baseName: item.baseName });
  if (action && ((action.requirements.uncorrupted && item.corrupted) || (action.requirements.unfractured && item.explicits.some((m) => m.fractured)) || (action.requirements.minModifiers !== undefined && item.explicits.length < action.requirements.minModifiers) || (action.requirements.maxModifiers !== undefined && item.explicits.length > action.requirements.maxModifiers))) issues.push({ code: 'action-requirements-not-met' });
  if (action && item.rarity !== null && !action.requirements.rarities.includes(item.rarity)) issues.push({ code: 'rarity-not-allowed', rarity: item.rarity, allowed: action.requirements.rarities });
  if (action?.effect.kind === 'operations') {
    for (const op of action.effect.operations) {
      if (op.kind === 'set-rarity') item = { ...item, rarity: op.rarity, explicits: op.clearModifiers ? item.explicits.filter((m) => m.fractured) : item.explicits };
      else break;
    }
  }
  if (item.itemLevel === null) issues.push({ code: 'item-level-unknown' });
  if (item.rarity === null) issues.push({ code: 'rarity-unknown' });
  if (base?.dataStatus === 'unsupported') issues.push({ code: 'base-not-supported' });
  const limits = item.rarity === null ? undefined : view.getAffixLimits(item.rarity, base?.itemClassId);
  if (item.rarity !== null && !limits) {
    issues.push({ code: 'affix-limits-unknown', rarity: item.rarity });
  }

  if (issues.length > 0 || !action || !base || !limits || item.itemLevel === null || item.rarity === null) {
    return { status: 'blocked', context, dataset: view.info, action, item, issues };
  }

  const facts = collectAffixFacts(item, view, limits);
  const itemLevel = item.itemLevel;
  const effect = action.effect.kind === 'add-random-modifier' ? action.effect :
    action.effect.operations.find((op) => op.kind === 'add-random-mod') ?? { allowedSides: [] as AffixSide[], minModifierLevel: undefined, layer: undefined };
  const occupantsByGroup = new Map<ModifierGroupId, GroupOccupant>();
  for (const occupant of facts.occupiedGroups) {
    if (!occupantsByGroup.has(occupant.groupId)) occupantsByGroup.set(occupant.groupId, occupant);
  }

  const entries: PoolEntry[] = view.listModifiers().map((definition) => {
    const reasons: ExclusionReason[] = [];
    const spawn = resolveSpawnWeight(definition, base.tags);
    if (!sameDomain(definition.domain, base.domain)) reasons.push({ code: 'wrong-domain' });
    if ((definition.layer ?? 'explicit') !== (effect.layer ?? 'explicit')) reasons.push({ code: 'layer-not-allowed' });

    if (!isSpawnable(spawn)) {
      reasons.push({ code: 'not-spawnable-on-base', matchedTag: spawn?.tag ?? null });
    }
    if (definition.requiredItemLevel > itemLevel) {
      reasons.push({ code: 'item-level-too-low', required: definition.requiredItemLevel, itemLevel });
    }
    if (effect.minModifierLevel !== undefined && definition.modifierLevel < effect.minModifierLevel) {
      reasons.push({
        code: 'below-action-min-modifier-level',
        modifierLevel: definition.modifierLevel,
        minimum: effect.minModifierLevel,
      });
    }
    if (!effect.allowedSides.includes(definition.side)) {
      reasons.push({ code: 'side-not-allowed-by-action', side: definition.side });
    }
    const sideSlots = facts.slots[definition.side];
    if (sideSlots.free <= 0) {
      reasons.push({ code: 'no-free-affix-slot', side: definition.side, used: sideSlots.used, max: sideSlots.max });
    }
    if (facts.presentModifierIds.has(definition.id)) {
      const present = item.explicits.find((m) => m.kind === 'resolved' && m.modifierId === definition.id);
      reasons.push({ code: 'modifier-already-on-item', fractured: present?.fractured ?? false });
    }
    for (const groupId of definition.groupIds) {
      const occupant = occupantsByGroup.get(groupId);
      if (occupant) reasons.push({ code: 'group-already-on-item', groupId, occupant });
    }

    return {
      definition,
      tier: view.tierOf(definition.id, base.id),
      weight: spawn?.weight ?? null,
      spawnTag: spawn?.tag ?? null,
      eligible: reasons.length === 0,
      reasons,
    };
  });

  const eligible = entries.filter((e) => e.eligible);
  const unknownWeightModifierIds = eligible.filter((e) => e.weight === null).map((e) => e.definition.id);
  const totalKnownWeight = eligible.reduce((sum, e) => sum + (e.weight ?? 0), 0);

  const caveats: PoolCaveat[] = [];
  if (view.info.kind === 'fixture') caveats.push({ code: 'fixture-dataset', datasetId: view.info.id });
  if (facts.slots.unknownSide > 0) caveats.push({ code: 'unknown-side-lines', count: facts.slots.unknownSide });
  const inferredTexts = [...new Set(facts.occupiedGroups.filter((o) => o.inferred).map((o) => o.sourceText))];
  if (inferredTexts.length > 0) caveats.push({ code: 'unresolved-lines-block-groups', texts: inferredTexts });
  if (facts.missingModifierIds.length > 0) {
    caveats.push({ code: 'modifier-missing-in-version', modifierIds: facts.missingModifierIds });
  }
  if (unknownWeightModifierIds.length > 0) {
    caveats.push({ code: 'unknown-weights-in-pool', modifierIds: unknownWeightModifierIds });
  }

  return {
    status: 'ready',
    context,
    dataset: view.info,
    action,
    item: originalItem,
    base,
    itemLevel,
    rarity: item.rarity,
    affixLimits: limits,
    slots: facts.slots,
    occupiedGroups: facts.occupiedGroups,
    presentModifierIds: facts.presentModifierIds,
    entries,
    eligible,
    totalKnownWeight,
    unknownWeightModifierIds,
    caveats,
  };
}
