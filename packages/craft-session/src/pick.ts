import {
  addRequirement,
  createItemState,
  setRequirementTier,
  type GameVersion,
  type ItemState,
  type ModifierDefinition,
  type ModifierId,
  type TargetRequirementId,
  type TargetSpec,
} from '@poe2-craft/craft-domain';
import type { CraftDb } from '@poe2-craft/craft-db';
import { buildEligiblePool, type ExclusionReason, type PoolEntry } from '@poe2-craft/probability-engine';
import { sameFamily } from './compare';
import { MANUAL_EDIT_ACTION, addSourceModifier, replaceSourceModifier, targetAsItem } from './editing';

/**
 * PICKING a modifier in the pool while editing the source or the target. One click on a tier
 * says "this is what I have / want"; it never crafts. What the click does is decided here, from
 * the real source / target, so the page only shows it:
 * - selected: this exact modifier is already on the source / is a target requirement;
 * - add: a new modifier / requirement;
 * - replace (source): another tier of a family already on the source takes its place;
 * - retier (target): the existing requirement of that family moves to this tier.
 * Tier changes are checked against the item without the old tier, so group and slot rules hold
 * exactly as for any other edit (crafting invariants 48–50).
 */
export type PickAction =
  | { readonly kind: 'selected' }
  | { readonly kind: 'add' }
  | { readonly kind: 'replace'; readonly index: number }
  | { readonly kind: 'retier'; readonly requirementId: TargetRequirementId };

export interface PickOption {
  readonly definition: ModifierDefinition;
  readonly action: PickAction;
  /** A click applies `action`. Never true for a selected option: it is already there. */
  readonly allowed: boolean;
  /** Why the click is not allowed; empty when allowed or selected. */
  readonly reasons: readonly ExclusionReason[];
}

export type PickOptions = ReadonlyMap<ModifierId, PickOption>;

export const isPickSelected = (option: PickOption | undefined) => option?.action.kind === 'selected';

/**
 * Pick options for the source. Without `replaceIndex` a tier of a family already on the source
 * replaces it; with `replaceIndex` (the explicit "replace this modifier" mode) every pick goes to
 * that slot.
 */
export function sourcePickOptions(
  db: CraftDb,
  gameVersion: GameVersion,
  source: ItemState,
  replaceIndex?: number,
): PickOptions {
  const view = db.forVersion(gameVersion);
  const present = source.explicits.flatMap((mod, index) =>
    mod.kind === 'resolved' ? [{ mod, index, definition: view.getModifier(mod.modifierId) ?? null }] : [],
  );
  const entries = cachedEntries<number>((index) =>
    poolEntries(db, gameVersion, index === null ? source : withoutIndex(source, index)),
  );
  const base = entries(replaceIndex ?? null);
  if (!base) return new Map();

  const options = new Map<ModifierId, PickOption>();
  for (const entry of base.values()) {
    const definition = entry.definition;
    if (present.some((p) => p.mod.modifierId === definition.id)) {
      options.set(definition.id, selected(definition));
      continue;
    }
    if (replaceIndex !== undefined) {
      options.set(definition.id, option(definition, { kind: 'replace', index: replaceIndex }, entry));
      continue;
    }
    const family = present.find((p) => p.definition !== null && sameFamily(p.definition, definition));
    options.set(
      definition.id,
      family
        ? option(definition, { kind: 'replace', index: family.index }, entries(family.index)?.get(definition.id))
        : option(definition, { kind: 'add' }, entry),
    );
  }
  return options;
}

/** Pick options for the target: a tier of a family that already has a requirement retiers it. */
export function targetPickOptions(
  db: CraftDb,
  gameVersion: GameVersion,
  target: TargetSpec,
  fallback: ItemState | null,
): PickOptions {
  const view = db.forVersion(gameVersion);
  const requirements = target.requirements.map((requirement) => ({
    requirement,
    definition: view.getModifier(requirement.modifierId) ?? null,
  }));
  const entries = cachedEntries<string>((id) =>
    poolEntries(
      db,
      gameVersion,
      targetAsItem(id === null ? target : { ...target, requirements: target.requirements.filter((r) => r.id !== id) }, fallback),
    ),
  );
  const base = entries(null);
  if (!base) return new Map();

  const options = new Map<ModifierId, PickOption>();
  for (const entry of base.values()) {
    const definition = entry.definition;
    if (requirements.some((r) => r.requirement.modifierId === definition.id)) {
      options.set(definition.id, selected(definition));
      continue;
    }
    const family = requirements.find((r) => r.definition !== null && sameFamily(r.definition, definition));
    options.set(
      definition.id,
      family
        ? option(
            definition,
            { kind: 'retier', requirementId: family.requirement.id },
            entries(family.requirement.id)?.get(definition.id),
          )
        : option(definition, { kind: 'add' }, entry),
    );
  }
  return options;
}

/** Applies an allowed source pick; anything else leaves the source unchanged. */
export function applySourcePick(source: ItemState, option: PickOption | undefined): ItemState {
  if (!option?.allowed) return source;
  switch (option.action.kind) {
    case 'add':
      return addSourceModifier(source, option.definition);
    case 'replace':
      return replaceSourceModifier(source, option.action.index, option.definition);
    default:
      return source;
  }
}

/** Applies an allowed target pick; anything else leaves the target unchanged. */
export function applyTargetPick(target: TargetSpec, option: PickOption | undefined): TargetSpec {
  if (!option?.allowed) return target;
  switch (option.action.kind) {
    case 'add':
      return addRequirement(target, option.definition.id);
    case 'retier':
      return setRequirementTier(target, option.action.requirementId, option.definition.id);
    default:
      return target;
  }
}

function selected(definition: ModifierDefinition): PickOption {
  return { definition, action: { kind: 'selected' }, allowed: false, reasons: [] };
}

function option(definition: ModifierDefinition, action: PickAction, entry: PoolEntry | undefined): PickOption {
  const allowed = entry?.eligible ?? false;
  return { definition, action, allowed, reasons: allowed ? [] : (entry?.reasons ?? []) };
}

function withoutIndex(source: ItemState, index: number): ItemState {
  return createItemState({ ...source, explicits: source.explicits.filter((_, i) => i !== index) });
}

function poolEntries(db: CraftDb, gameVersion: GameVersion, item: ItemState): Map<ModifierId, PoolEntry> | null {
  const pool = buildEligiblePool({ item, context: { gameVersion }, db, action: MANUAL_EDIT_ACTION });
  return pool.status === 'ready' ? new Map(pool.entries.map((e) => [e.definition.id, e])) : null;
}

/** Each "item without X" pool is built once per call, however many tiers ask for it. */
function cachedEntries<K>(build: (key: K | null) => Map<ModifierId, PoolEntry> | null) {
  const cache = new Map<K | null, Map<ModifierId, PoolEntry> | null>();
  return (key: K | null) => {
    if (!cache.has(key)) cache.set(key, build(key));
    return cache.get(key) ?? null;
  };
}
