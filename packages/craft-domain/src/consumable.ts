import type { Provenance } from './provenance';
import type { VersionRange } from './version';

export type ConsumableId = string;

/**
 * Role of a consumable in crafting. Mirrors the categories of GGG's trade data
 * ("Currency", omens under "Ritual", "Essences", catalysts under "Breach", "Runes"); drives the
 * tool palette only.
 */
export type ConsumableCategory =
  | 'currency'
  | 'omen'
  | 'essence'
  | 'catalyst'
  | 'rune'
  | 'soul-core'
  | 'liquid-emotion'
  | 'abyssal-bone';

/**
 * How far a consumable is understood by the planner. Existing is not the same as implemented:
 * - catalogued:  known item (name, icon, category), mechanic not described;
 * - researched:  mechanic described from sources, not implemented;
 * - modelled:    an action implements it (with the confidence of its rules);
 * - verified:    the model was checked against observed in-game results;
 * - unsupported: deliberately not handled (e.g. not a crafting material for equipment).
 * Only modelled / verified consumables can be applied.
 */
export type CraftSupportStatus = 'catalogued' | 'researched' | 'modelled' | 'verified' | 'unsupported';

/**
 * Which consumables an omen changes ("your next Exalted Orb…"). Data with its own provenance:
 * it lets the tool palette tell an incompatible pair (omen of Exalted Orbs + Divine Orb) from a
 * compatible pair nobody has modelled yet. It is not a crafting effect.
 */
export interface OmenScope {
  readonly consumableIds: readonly ConsumableId[];
  readonly provenance: Provenance;
}

/** Anything spent by a craft attempt: currency, omens, essences. Only identity here — prices live in economy. */
export interface Consumable {
  readonly id: ConsumableId;
  readonly name: string;
  readonly category: ConsumableCategory;
  /**
   * Game art identifier, e.g. "Art/2DItems/Currency/CurrencyAddModToRare".
   * Data, not a URL: each frontend decides where its copy of the icon lives.
   */
  readonly art?: string;
  /** Omens only: the consumables this omen modifies. Absent = unknown, not "none". */
  readonly modifies?: OmenScope;
  /** Absent = derived (modelled when an action spends it, otherwise catalogued). */
  readonly craftStatus?: CraftSupportStatus;
  /** Notes on the researched mechanic (what it does, source), when there are any. */
  readonly mechanicNotes?: string;
  /** Official trade group the record was taken from. */
  readonly tradeGroup?: string;
  readonly versions: VersionRange;
  readonly provenance: Provenance;
}
