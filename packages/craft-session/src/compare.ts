import {
  modifierText,
  type CraftTarget,
  type ExplicitModifier,
  type ItemState,
  type ModifierDefinition,
  type ResolvedModifier,
} from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';

/**
 * - matched: the same modifier (same tier) is on the current item;
 * - better-tier: the same group with a better tier (counts as matched);
 * - worse-tier: the same group, but a worse tier;
 * - missing: nothing from the group is on the current item;
 * - unknown: the target line was not recognised, so it cannot be compared.
 */
export type TargetModStatus = 'matched' | 'better-tier' | 'worse-tier' | 'missing' | 'unknown';

export interface TargetModComparison {
  readonly target: ExplicitModifier;
  readonly definition: ModifierDefinition | null;
  readonly status: TargetModStatus;
  readonly current: ResolvedModifier | null;
  readonly currentDefinition: ModifierDefinition | null;
}

export interface ItemComparison {
  readonly rows: readonly TargetModComparison[];
  /** Explicit modifiers on the current item that the target does not ask for. */
  readonly extra: readonly ExplicitModifier[];
  readonly matched: number;
  readonly total: number;
  /** null when either base is unknown. */
  readonly sameBase: boolean | null;
}

const isMatch = (status: TargetModStatus) => status === 'matched' || status === 'better-tier';

/** Compares the current item with the target example by modifier group and tier (tier 1 = best). */
export function compareToTarget(current: ItemState, target: ItemState, view: CraftDbView): ItemComparison {
  const available = current.explicits
    .filter((m): m is ResolvedModifier => m.kind === 'resolved')
    .map((mod) => ({ mod, definition: view.getModifier(mod.modifierId) ?? null }));
  const used = new Set<ResolvedModifier>();

  const rows = target.explicits.map((targetMod): TargetModComparison => {
    if (targetMod.kind === 'unresolved') {
      return { target: targetMod, definition: null, status: 'unknown', current: null, currentDefinition: null };
    }
    const definition = view.getModifier(targetMod.modifierId) ?? null;
    if (!definition) {
      return { target: targetMod, definition: null, status: 'unknown', current: null, currentDefinition: null };
    }
    const candidate =
      available.find((c) => !used.has(c.mod) && c.mod.modifierId === definition.id) ??
      available.find((c) => !used.has(c.mod) && c.definition !== null && sharesGroup(c.definition, definition));
    if (!candidate || !candidate.definition) {
      return { target: targetMod, definition, status: 'missing', current: null, currentDefinition: null };
    }
    used.add(candidate.mod);
    const status: TargetModStatus =
      candidate.definition.id === definition.id
        ? 'matched'
        : candidate.definition.tier < definition.tier
          ? 'better-tier'
          : 'worse-tier';
    return { target: targetMod, definition, status, current: candidate.mod, currentDefinition: candidate.definition };
  });

  const extra = current.explicits.filter((m) => m.kind === 'unresolved' || !used.has(m));
  return {
    rows,
    extra,
    matched: rows.filter((r) => isMatch(r.status)).length,
    total: rows.length,
    sameBase: current.baseId && target.baseId ? current.baseId === target.baseId : null,
  };
}

function sharesGroup(a: ModifierDefinition, b: ModifierDefinition): boolean {
  return a.side === b.side && a.groupIds.some((g) => b.groupIds.includes(g));
}

/**
 * Stage target built from one modifier of the target example: that tier or any better tier
 * of the same group set. Returns null when the modifier is not in this game version.
 */
export function targetFromModifier(view: CraftDbView, modifierId: string): CraftTarget | null {
  const definition = view.getModifier(modifierId);
  if (!definition) return null;
  const sameGroups = (m: ModifierDefinition) =>
    m.side === definition.side &&
    m.groupIds.length === definition.groupIds.length &&
    m.groupIds.every((g) => definition.groupIds.includes(g));
  const tiers = view.listModifiers().filter((m) => sameGroups(m) && m.tier <= definition.tier);
  return {
    id: `item-target:${definition.id}`,
    label: `${modifierText(definition)} (T${definition.tier}${definition.tier > 1 ? ' or better' : ''})`,
    modifierIds: tiers.map((m) => m.id),
    provenance: definition.provenance,
  };
}

/** Target modifiers still to obtain, in target order: missing or present in a worse tier. */
export function outstandingTargetModifiers(comparison: ItemComparison): readonly ModifierDefinition[] {
  return comparison.rows
    .filter((r) => r.status === 'missing' || r.status === 'worse-tier')
    .flatMap((r) => (r.definition ? [r.definition] : []));
}
