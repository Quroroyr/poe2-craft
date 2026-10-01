import type { Provenance } from './provenance';
import type { VersionRange } from './version';

export type ConsumableId = string;

/**
 * Role of a consumable in crafting. Mirrors the categories of GGG's trade data
 * ("Currency", omens under "Ritual", "Essences", ...); drives the tool palette.
 */
export type ConsumableCategory = 'currency' | 'omen' | 'essence';

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
  readonly versions: VersionRange;
  readonly provenance: Provenance;
}
