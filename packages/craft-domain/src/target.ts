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
