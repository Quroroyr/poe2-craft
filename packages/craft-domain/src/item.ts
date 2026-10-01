import type { Provenance } from './provenance';
import type { VersionRange } from './version';

export type ItemClassId = string;
export type ItemBaseId = string;

export type Rarity = 'normal' | 'magic' | 'rare' | 'unique';
export type AffixSide = 'prefix' | 'suffix';

export const AFFIX_SIDES: readonly AffixSide[] = ['prefix', 'suffix'];

export interface ItemClass {
  readonly id: ItemClassId;
  readonly name: string;
  /** Value of the "Item Class:" line in the game's Ctrl+C text, e.g. "Spears". */
  readonly clipboardName: string;
  readonly versions: VersionRange;
  readonly provenance: Provenance;
}

export interface ItemBase {
  readonly id: ItemBaseId;
  readonly name: string;
  readonly itemClassId: ItemClassId;
  /** Spawn tags. Modifier spawn weights are resolved against these (see spawn.ts). */
  readonly tags: readonly string[];
  readonly versions: VersionRange;
  readonly provenance: Provenance;
}
