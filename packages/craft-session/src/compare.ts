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
 * - not-fractured: the requirement asks for a fractured modifier, the family is there but not fractured;
 * - unknown: the requirement points to a modifier this game version does not have.
 */
export type TargetModStatus = 'matched' | 'better-tier' | 'worse-tier' | 'missing' | 'not-fractured' | 'unknown';

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
    (a.layer ?? 'explicit') === (b.layer ?? 'explicit') &&
    (a.family !== undefined && b.family !== undefined ? a.family === b.family : (
    a.groupIds.length === b.groupIds.length &&
    a.groupIds.every((g) => b.groupIds.includes(g))
    ))
  );
}

/** All tiers of a definition's family in this version, best (tier 1) first. */
export function familyTiers(view: CraftDbView, definition: ModifierDefinition, baseId?: string | null): ModifierDefinition[] {
  return view
    .listModifiers(baseId ? { baseId } : {})
    .filter((m) => sameFamily(m, definition))
    .sort((a, b) => b.requiredItemLevel - a.requiredItemLevel);
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
    const family = available.filter(
      (c) => !used.has(c.mod) && c.definition !== null && sameFamily(c.definition, definition),
    );
    // A fractured requirement is only met by a fractured modifier; a plain one by either kind.
    const candidate = requirement.fractured ? family.find((c) => c.mod.fractured) : family[0];
    if (!candidate || !candidate.definition) {
      const unfractured = requirement.fractured ? family[0] : undefined;
      if (unfractured?.definition) {
        return {
          requirement,
          definition,
          status: 'not-fractured',
          current: unfractured.mod,
          currentDefinition: unfractured.definition,
        };
      }
      return { requirement, definition, status: 'missing', current: null, currentDefinition: null };
    }
    used.add(candidate.mod);
    const tier = view.tierOf(candidate.definition.id, current.baseId);
    const requiredTier = view.tierOf(definition.id, target.baseId);
    const status: TargetModStatus =
      tier === requiredTier ? 'matched' : tier < requiredTier ? 'better-tier' : 'worse-tier';
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
export function targetFromModifier(view: CraftDbView, modifierId: string, baseId?: string | null): CraftTarget | null {
  const definition = view.getModifier(modifierId);
  if (!definition) return null;
  const rank = view.tierOf(definition.id, baseId);
  const tiers = familyTiers(view, definition, baseId).filter((m) => view.tierOf(m.id, baseId) <= rank);
  return {
    id: `item-target:${definition.id}`,
    label: `${modifierText(definition)} (T${rank}${rank > 1 ? ' or better' : ''})`,
    modifierIds: tiers.map((m) => m.id),
    provenance: definition.provenance,
  };
}

/**
 * Requirements still to obtain by adding modifiers, in target order: missing or present in a worse
 * tier. Fractured requirements are left out: no implemented action produces a fractured modifier,
 * so a chance to "add" one would be invented.
 */
export function outstandingTargetModifiers(comparison: ItemComparison): readonly ModifierDefinition[] {
  return comparison.rows
    .filter((r) => !r.requirement.fractured && (r.status === 'missing' || r.status === 'worse-tier'))
    .flatMap((r) => (r.definition ? [r.definition] : []));
}

/**
 * - match: the target is for the source's base;
 * - mismatch: another base — not reachable by crafting the source, nothing is planned towards it;
 * - unknown: either base is not known.
 */
export type TargetBaseCheck = 'match' | 'mismatch' | 'unknown';

export function targetBaseCheck(source: ItemState | null, target: TargetSpec | null): TargetBaseCheck {
  if (!source?.baseId || !target?.baseId) return 'unknown';
  return source.baseId === target.baseId ? 'match' : 'mismatch';
}
