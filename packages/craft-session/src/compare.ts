import {
  modifierText,
  type CraftTarget,
  type ExplicitModifier,
  type ItemState,
  type ModifierDefinition,
  type ResolvedModifier,
  type TargetRequirement,
  type TargetSpec,
} from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';

/**
 * - matched: the family is on the current item at exactly the required tier;
 * - better-tier: a better tier than required (also satisfies the requirement);
 * - worse-tier: the family is there, but below the minimum acceptable tier;
 * - missing: nothing from the family is on the current item;
 * - unknown: the requirement points to a modifier this game version does not have.
 */
export type TargetModStatus = 'matched' | 'better-tier' | 'worse-tier' | 'missing' | 'unknown';

export interface RequirementComparison {
  readonly requirement: TargetRequirement;
  readonly definition: ModifierDefinition | null;
  readonly status: TargetModStatus;
  readonly current: ResolvedModifier | null;
  readonly currentDefinition: ModifierDefinition | null;
}

export interface ItemComparison {
  readonly rows: readonly RequirementComparison[];
  /** Explicit modifiers on the current item that no requirement asks for. */
  readonly extra: readonly ExplicitModifier[];
  readonly matched: number;
  readonly total: number;
  /** null when either base is unknown. */
  readonly sameBase: boolean | null;
}

export const satisfiesRequirement = (status: TargetModStatus) => status === 'matched' || status === 'better-tier';

/** Two definitions belong to one family: same side and the same set of modifier groups. */
export function sameFamily(a: ModifierDefinition, b: ModifierDefinition): boolean {
  return (
    a.side === b.side &&
    a.groupIds.length === b.groupIds.length &&
    a.groupIds.every((g) => b.groupIds.includes(g))
  );
}

/** All tiers of a definition's family in this version, best (tier 1) first. */
export function familyTiers(view: CraftDbView, definition: ModifierDefinition): ModifierDefinition[] {
  return view
    .listModifiers()
    .filter((m) => sameFamily(m, definition))
    .sort((a, b) => a.tier - b.tier);
}

/** Compares the current item with the target requirements by family and tier (tier 1 = best). */
export function compareToTarget(current: ItemState, target: TargetSpec, view: CraftDbView): ItemComparison {
  const available = current.explicits
    .filter((m): m is ResolvedModifier => m.kind === 'resolved')
    .map((mod) => ({ mod, definition: view.getModifier(mod.modifierId) ?? null }));
  const used = new Set<ResolvedModifier>();

  const rows = target.requirements.map((requirement): RequirementComparison => {
    const definition = view.getModifier(requirement.modifierId) ?? null;
    if (!definition) {
      return { requirement, definition: null, status: 'unknown', current: null, currentDefinition: null };
    }
    const candidate = available.find(
      (c) => !used.has(c.mod) && c.definition !== null && sameFamily(c.definition, definition),
    );
    if (!candidate || !candidate.definition) {
      return { requirement, definition, status: 'missing', current: null, currentDefinition: null };
    }
    used.add(candidate.mod);
    const tier = candidate.definition.tier;
    const status: TargetModStatus =
      tier === definition.tier ? 'matched' : tier < definition.tier ? 'better-tier' : 'worse-tier';
    return { requirement, definition, status, current: candidate.mod, currentDefinition: candidate.definition };
  });

  const extra = current.explicits.filter((m) => m.kind === 'unresolved' || !used.has(m));
  return {
    rows,
    extra,
    matched: rows.filter((r) => satisfiesRequirement(r.status)).length,
    total: rows.length,
    sameBase: current.baseId && target.baseId ? current.baseId === target.baseId : null,
  };
}

/**
 * Stage target built from one modifier: that tier or any better tier of the same family.
 * Returns null when the modifier is not in this game version.
 */
export function targetFromModifier(view: CraftDbView, modifierId: string): CraftTarget | null {
  const definition = view.getModifier(modifierId);
  if (!definition) return null;
  const tiers = familyTiers(view, definition).filter((m) => m.tier <= definition.tier);
  return {
    id: `item-target:${definition.id}`,
    label: `${modifierText(definition)} (T${definition.tier}${definition.tier > 1 ? ' or better' : ''})`,
    modifierIds: tiers.map((m) => m.id),
    provenance: definition.provenance,
  };
}

/** Requirements still to obtain, in target order: missing or present in a worse tier. */
export function outstandingTargetModifiers(comparison: ItemComparison): readonly ModifierDefinition[] {
  return comparison.rows
    .filter((r) => r.status === 'missing' || r.status === 'worse-tier')
    .flatMap((r) => (r.definition ? [r.definition] : []));
}
