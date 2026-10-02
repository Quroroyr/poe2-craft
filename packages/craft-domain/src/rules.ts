import type { Rarity } from './item';
import type { Provenance } from './provenance';
import type { VersionRange } from './version';

/** Maximum explicit affixes per side for a rarity. Data, not code, because patches may change it. */
export interface AffixLimitRule {
  readonly rarity: Rarity;
  /**
   * Item classes the limit applies to; absent = every class. A class covered by no rule has
   * unknown limits, and crafting on it is refused instead of guessed.
   */
  readonly itemClassIds?: readonly string[];
  readonly maxPrefixes: number;
  readonly maxSuffixes: number;
  readonly versions: VersionRange;
  readonly provenance: Provenance;
}
