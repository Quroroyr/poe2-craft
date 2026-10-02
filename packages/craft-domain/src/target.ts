import type { ItemBaseId } from './item';
import type { ItemState } from './item-state';
import type { ModifierId } from './modifier';
import type { Provenance } from './provenance';

export type CraftTargetId = string;

/**
 * What the user wants on the item. The target is satisfied by any one of `modifierIds`,
 * so "tier 2 or better" is expressed by listing those tiers — no special-case logic.
 */
export interface CraftTarget {
  readonly id: CraftTargetId;
  readonly label: string;
  readonly modifierIds: readonly ModifierId[];
  readonly provenance: Provenance;
}

export type TargetRequirementId = string;

/**
 * One thing the finished item must have: a modifier family at `modifierId`'s tier or better
 * (tier 1 = best). This, not a concrete rolled item, is what a future solver plans towards.
 * Exact tiers, value thresholds, optional mods and OR-groups are planned extensions.
 */
export interface TargetRequirement {
  readonly id: TargetRequirementId;
  /** The minimum acceptable tier, as a stable modifier id. */
  readonly modifierId: ModifierId;
  /** The requirement is met by a fractured modifier (e.g. carried over from the base). */
  readonly fractured: boolean;
  readonly origin: 'import' | 'manual';
}

/**
 * The desired result: a base plus requirements. Built by importing an example item and/or
 * by hand. Lines of an imported example that could not be recognised are kept as text so
 * the user sees them; they are not requirements.
 */
export interface TargetSpec {
  readonly baseId: ItemBaseId | null;
  readonly baseName: string | null;
  readonly itemLevel: number | null;
  readonly requirements: readonly TargetRequirement[];
  readonly unresolvedLines: readonly string[];
}

export function emptyTargetSpec(base: Pick<TargetSpec, 'baseId' | 'baseName' | 'itemLevel'>): TargetSpec {
  return { ...base, requirements: [], unresolvedLines: [] };
}

/** Imports an example item: every recognised explicit becomes a "this tier or better" requirement. */
export function targetSpecFromItem(item: ItemState): TargetSpec {
  const requirements: TargetRequirement[] = [];
  const unresolvedLines: string[] = [];
  for (const mod of item.explicits) {
    if (mod.kind === 'resolved') {
      requirements.push({
        id: `r${requirements.length + 1}`,
        modifierId: mod.modifierId,
        fractured: mod.fractured,
        origin: 'import',
      });
    } else {
      unresolvedLines.push(mod.sourceText);
    }
  }
  return { baseId: item.baseId, baseName: item.baseName, itemLevel: item.itemLevel, requirements, unresolvedLines };
}

export function addRequirement(spec: TargetSpec, modifierId: ModifierId, fractured = false): TargetSpec {
  const next = Math.max(0, ...spec.requirements.map((r) => Number(r.id.slice(1)) || 0)) + 1;
  return {
    ...spec,
    requirements: [...spec.requirements, { id: `r${next}`, modifierId, fractured, origin: 'manual' }],
  };
}

export function removeRequirement(spec: TargetSpec, id: TargetRequirementId): TargetSpec {
  return { ...spec, requirements: spec.requirements.filter((r) => r.id !== id) };
}

/** Changes the minimum acceptable tier by pointing the requirement at another tier of its family. */
export function setRequirementTier(spec: TargetSpec, id: TargetRequirementId, modifierId: ModifierId): TargetSpec {
  return {
    ...spec,
    requirements: spec.requirements.map((r) => (r.id === id ? { ...r, modifierId } : r)),
  };
}

/** Whether the requirement must be met by a fractured modifier. */
export function setRequirementFractured(spec: TargetSpec, id: TargetRequirementId, fractured: boolean): TargetSpec {
  return {
    ...spec,
    requirements: spec.requirements.map((r) => (r.id === id ? { ...r, fractured } : r)),
  };
}
