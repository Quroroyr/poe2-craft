import type { Rarity } from './item';
import type { Provenance } from './provenance';
import type { VersionRange } from './version';

/** Maximum explicit affixes per side for a rarity. Data, not code, because patches may change it. */
export interface AffixLimitRule {
  readonly rarity: Rarity;
  readonly maxPrefixes: number;
  readonly maxSuffixes: number;
  readonly versions: VersionRange;
  readonly provenance: Provenance;
}
