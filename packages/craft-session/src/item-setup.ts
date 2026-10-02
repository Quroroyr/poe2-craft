import {
  createItemState,
  withExplicitFractured,
  type GameVersion,
  type ItemBase,
  type ItemBaseId,
  type ItemClass,
  type ItemState,
  type ModifierDefinition,
  type QualityRule,
  type Rarity,
  type SlotKindId,
  type SlotRule,
} from '@poe2-craft/craft-domain';
import type { CraftDb, CraftDbView } from '@poe2-craft/craft-db';
import { buildEligiblePool, type ExclusionReason } from '@poe2-craft/probability-engine';
import { familyTiers } from './compare';
import { MANUAL_EDIT_ACTION } from './editing';

/**
 * INITIAL ITEM SETUP: describing the item the user already has before crafting — base, item level,
 * quality, slots, starting modifiers and which of them are fractured. None of these functions is a
 * crafting action: they never touch `current`, never record a step and never cost anything
 * (crafting invariants 35–38). Every function returns a new ItemState; invalid input leaves the
 * item unchanged instead of inventing a value.
 */

/** Item level bounds accepted by the setup form. Application input bounds, not game data. */
export const ITEM_LEVEL_BOUNDS = { min: 1, max: 100 } as const;

/**
 * An empty rare item of `base`. Quality starts at the bottom of the base's quality rule and every
 * slot kind at its first allowed count; properties the base has no rule for stay unknown.
 * The base definition itself is not copied: the item refers to it by id.
 */
export function blankItem(base: ItemBase, itemLevel: number, itemClass?: ItemClass): ItemState {
  return createItemState({
    baseId: base.id,
    baseName: base.name,
    itemClassName: itemClass?.clipboardName ?? null,
    rarity: 'rare',
    itemLevel: clampItemLevel(itemLevel),
    quality: base.setup?.quality?.min ?? null,
    slots: (base.setup?.slots ?? []).map((rule) => ({ kind: rule.kind, count: rule.options[0] ?? 0 })),
    explicits: [],
    otherLines: [],
    corrupted: false,
  });
}

/** The start of a manually built source: a blank item of the chosen base. null for an unknown base. */
export function createItemFromBase(view: CraftDbView, baseId: ItemBaseId, itemLevel: number): ItemState | null {
  const base = view.getBase(baseId);
  if (!base) return null;
  return blankItem(base, itemLevel, view.getItemClass(base.itemClassId));
}

export interface ItemSetupFields {
  readonly base: ItemBase;
  readonly itemLevel: typeof ITEM_LEVEL_BOUNDS;
  /** null: the base has no quality rule, so quality is not offered. */
  readonly quality: QualityRule | null;
  /** Only slot kinds the base has a rule for. */
  readonly slots: readonly SlotRule[];
}

/** Which setup properties the item's base supports. null when the base is not in this game version. */
export function itemSetupFields(view: CraftDbView, item: ItemState): ItemSetupFields | null {
  const base = item.baseId === null ? undefined : view.getBase(item.baseId);
  if (!base) return null;
  return {
    base,
    itemLevel: ITEM_LEVEL_BOUNDS,
    quality: base.setup?.quality ?? null,
    slots: base.setup?.slots ?? [],
  };
}

/**
 * Rarities a manually built item can have: those with an affix-limit rule in this game version
 * (unique items are found, not built). Data decides, so a patch can change the list.
 */
export function setupRarities(view: CraftDbView, baseId?: string | null): readonly Rarity[] {
  const base = baseId ? view.getBase(baseId) : undefined;
  return (['normal', 'magic', 'rare'] as const).filter((r) => view.getAffixLimits(r, base?.itemClassId) !== undefined);
}

/** Sets the rarity. Modifiers the new rarity has no room for are kept and flagged by `sourceModifierIssues`. */
export function setRarity(view: CraftDbView, item: ItemState, rarity: Rarity): ItemState {
  if (!setupRarities(view, item.baseId).includes(rarity) || item.rarity === rarity) return item;
  return createItemState({ ...item, rarity });
}

export function setItemLevel(item: ItemState, itemLevel: number): ItemState {
  if (!Number.isFinite(itemLevel)) return item;
  const next = clampItemLevel(itemLevel);
  return next === item.itemLevel ? item : createItemState({ ...item, itemLevel: next });
}

/** Sets quality within the base's rule. Without a rule the item is returned unchanged. */
export function setQuality(view: CraftDbView, item: ItemState, quality: number): ItemState {
  const rule = itemSetupFields(view, item)?.quality;
  if (!rule || !Number.isFinite(quality)) return item;
  const next = Math.min(rule.max, Math.max(rule.min, Math.round(quality)));
  return next === item.quality ? item : createItemState({ ...item, quality: next });
}

/** Sets the count of one slot kind. Only counts listed by the base's rule are accepted. */
export function setSlotCount(view: CraftDbView, item: ItemState, kind: SlotKindId, count: number): ItemState {
  const rule = itemSetupFields(view, item)?.slots.find((s) => s.kind === kind);
  if (!rule || !rule.options.includes(count)) return item;
  if (slotCount(item, kind) === count) return item;
  const others = item.slots.filter((s) => s.kind !== kind);
  return createItemState({ ...item, slots: [...others, { kind, count }] });
}

export function slotCount(item: ItemState, kind: SlotKindId): number | null {
  return item.slots.find((s) => s.kind === kind)?.count ?? null;
}

/**
 * Marks (or unmarks) an existing explicit as fractured: "my starting item already has this
 * fractured modifier". Item setup, NOT the Fracturing Orb — that will be a separate CraftAction
 * with its own rules and cost (crafting invariant 36).
 */
export function setSourceModifierFractured(source: ItemState, index: number, fractured: boolean): ItemState {
  return withExplicitFractured(source, index, fractured);
}

/**
 * Why each starting modifier could not legally be on the source as it is now configured, e.g.
 * after lowering the item level or picking another base. Uses the same manual-edit pool as the
 * modifier explorer, evaluated as if that modifier were removed. Keys are explicit indexes;
 * modifiers without problems are absent.
 */
export function sourceModifierIssues(
  db: CraftDb,
  gameVersion: GameVersion,
  source: ItemState,
): ReadonlyMap<number, readonly ExclusionReason[]> {
  const issues = new Map<number, readonly ExclusionReason[]>();
  source.explicits.forEach((mod, index) => {
    if (mod.kind !== 'resolved') return;
    const entry = entryWithout(db, gameVersion, source, index, mod.modifierId);
    if (entry && !entry.eligible) issues.set(index, entry.reasons);
  });
  return issues;
}

export interface TierOption {
  readonly definition: ModifierDefinition;
  readonly tier: number;
  readonly allowed: boolean;
  /** Empty when allowed. */
  readonly reasons: readonly ExclusionReason[];
}

/**
 * Tiers the source modifier at `index` can be switched to, best first, each with the reasons it
 * is not allowed. The same rules as the explorer's replace mode, so both paths always agree.
 */
export function sourceTierOptions(
  db: CraftDb,
  gameVersion: GameVersion,
  source: ItemState,
  index: number,
): readonly TierOption[] {
  const mod = source.explicits[index];
  if (!mod || mod.kind !== 'resolved') return [];
  const view = db.forVersion(gameVersion);
  const definition = view.getModifier(mod.modifierId);
  if (!definition) return [];
  const pool = poolWithout(db, gameVersion, source, index);
  return familyTiers(view, definition, source.baseId).map((tier) => {
    const entry = pool?.status === 'ready' ? pool.entries.find((e) => e.definition.id === tier.id) : undefined;
    const reasons = entry?.reasons ?? [];
    return { definition: tier, tier: view.tierOf(tier.id, source.baseId), allowed: entry !== undefined && entry.eligible, reasons };
  });
}

function poolWithout(db: CraftDb, gameVersion: GameVersion, source: ItemState, index: number) {
  const item = createItemState({ ...source, explicits: source.explicits.filter((_, i) => i !== index) });
  return buildEligiblePool({ item, context: { gameVersion }, db, action: MANUAL_EDIT_ACTION });
}

function entryWithout(db: CraftDb, gameVersion: GameVersion, source: ItemState, index: number, modifierId: string) {
  const pool = poolWithout(db, gameVersion, source, index);
  return pool.status === 'ready' ? pool.entries.find((e) => e.definition.id === modifierId) : undefined;
}

function clampItemLevel(itemLevel: number): number {
  return Math.min(ITEM_LEVEL_BOUNDS.max, Math.max(ITEM_LEVEL_BOUNDS.min, Math.round(itemLevel)));
}
