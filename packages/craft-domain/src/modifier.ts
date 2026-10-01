import type { AffixSide } from './item';
import type { Provenance } from './provenance';
import type { VersionRange } from './version';

export type ModifierId = string;
export type ModifierGroupId = string;

/**
 * Collision group: an item cannot hold two modifiers that share any group.
 * Tiers of the same stat normally share one group.
 */
export interface ModifierGroup {
  readonly id: ModifierGroupId;
  readonly name: string;
  readonly provenance: Provenance;
}

export interface StatRange {
  readonly min: number;
  readonly max: number;
}

/**
 * One displayed line of a modifier. `template` uses "#" for each rolled value,
 * e.g. "Adds # to # Physical Damage" with two ranges.
 */
export interface ModifierLine {
  readonly template: string;
  readonly ranges: readonly StatRange[];
}

/**
 * Spawn weight for items carrying `tag`. `weight: null` means the weight is unknown —
 * it must never be silently treated as a real number (crafting invariant 8).
 */
export interface SpawnWeight {
  readonly tag: string;
  readonly weight: number | null;
}

/**
 * One tier of one modifier. The `id` is stable across game versions; a value change
 * in a later patch is a new revision with the same id and a non-overlapping `versions` range.
 */
export interface ModifierDefinition {
  readonly id: ModifierId;
  /** Affix name shown on rare items, e.g. "of the Marksman". */
  readonly name: string;
  readonly side: AffixSide;
  /** 1 = best tier, following PoE2DB convention. */
  readonly tier: number;
  readonly groupIds: readonly ModifierGroupId[];
  /** Minimum item level for the modifier to roll. */
  readonly requiredItemLevel: number;
  /**
   * The modifier's own level in game data. Kept separate from `requiredItemLevel`
   * because crafting effects can filter by it (e.g. a minimum modifier level),
   * even where both numbers coincide in known data.
   */
  readonly modifierLevel: number;
  readonly lines: readonly ModifierLine[];
  /** Ordered list; the first tag present on the base decides the weight. */
  readonly spawnWeights: readonly SpawnWeight[];
  /** Descriptive tags shown to the user ("attack", "critical", ...). Not used for spawning. */
  readonly tags: readonly string[];
  readonly versions: VersionRange;
  readonly provenance: Provenance;
}

/** Number of decimals a range is expressed in, e.g. 3.21–4.4 → 2. Rolled values keep that precision. */
export function rangeDecimals(range: StatRange): number {
  const decimals = (n: number) => (Number.isInteger(n) ? 0 : (String(n).split('.')[1]?.length ?? 0));
  return Math.max(decimals(range.min), decimals(range.max));
}

/** Text of a modifier with concrete rolled values, one string per line (as it would appear on an item). */
export function renderModifierText(definition: ModifierDefinition, values: readonly number[]): string {
  let i = 0;
  return definition.lines
    .map((line) =>
      line.template.replace(/#/g, () => {
        const range = line.ranges[i];
        const value = values[i++];
        if (value === undefined || !range) return '#';
        return value.toFixed(rangeDecimals(range));
      }),
    )
    .join('\n');
}

export function modifierText(definition: ModifierDefinition): string {
  return definition.lines
    .map((line) => {
      let i = 0;
      return line.template.replace(/#/g, () => {
        const range = line.ranges[i++];
        if (!range) return '#';
        return range.min === range.max ? `${range.min}` : `(${range.min}–${range.max})`;
      });
    })
    .join(' / ');
}
