import type { AffixSide } from './item';
import type { Confidence, Provenance } from './provenance';
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
 * How a weight value is known. Client data of PoE 2 carries no weights (only whether a modifier
 * can spawn), so measured community values must say how they were measured.
 */
export type WeightMethod =
  | 'game-extracted'
  | 'official'
  | 'recombinator-observation'
  | 'trade-observation'
  | 'community-estimate'
  | 'fixture'
  | 'unknown';

export interface WeightEvidence {
  readonly sourceId: string;
  readonly method: WeightMethod;
  readonly capturedAt?: string;
  readonly patch?: string;
  readonly confidence: Confidence;
  readonly sampleSize?: number;
  readonly normalized?: boolean;
  /**
   * What the value was published for, e.g. "spawn tag str_armour · PoE2DB Body_Armours_str" — a
   * weight is measured for a group of bases, not for one base.
   */
  readonly context?: string;
  /** The value exactly as the source wrote it, before any parsing. */
  readonly rawValue?: string;
  readonly notes?: string;
}

/**
 * Spawn rule for items carrying `tag`. `weight: null` means the weight is unknown — it must never
 * be silently treated as a real number (crafting invariant 8). `spawns` is the extracted fact
 * "can appear on bases with this tag" (PoE 2 client data has only this); absent = derived from the
 * weight (0 forbids, unknown or positive allows). A known weight carries its `evidence`.
 */
export interface SpawnWeight {
  readonly tag: string;
  readonly weight: number | null;
  readonly spawns?: boolean;
  readonly evidence?: WeightEvidence;
}

export type WeightTableId = string;

export interface WeightTableEntry {
  readonly modifierId: ModifierId;
  readonly weight: number;
  /** The value exactly as the source wrote it. */
  readonly rawValue?: string;
}

/**
 * Spawn weights published for a group of bases — e.g. PoE2DB's "Body Armours (STR)" page.
 * A base that names a table (`ItemBase.weightTableId`) takes its weights from that table only:
 * a modifier missing from it, or listed as `unmeasured`, has an unknown weight on that base, even
 * when another table measured it. Weights are kept per modifier id, so each tier has its own value.
 */
export interface WeightTable {
  readonly id: WeightTableId;
  readonly title: string;
  readonly itemClassId: string;
  /** Tags a base of the class carries to belong to this group (empty = the whole class). */
  readonly requiredTags: readonly string[];
  readonly entries: readonly WeightTableEntry[];
  /** Listed by the source without a measurement: weight unknown, never 0 or a guess. */
  readonly unmeasured: readonly ModifierId[];
  /** Shared by every entry: source, method, capture date, patch, group. */
  readonly evidence: WeightEvidence;
  readonly versions: VersionRange;
}

/** The weight a modifier has on one base, with where it came from. `weight: null` = unknown. */
export interface ResolvedWeight {
  readonly weight: number | null;
  readonly evidence?: WeightEvidence;
  /** Table the weight was looked up in, when the base has one. */
  readonly tableId?: WeightTableId;
}

/**
 * Layer of a slot modifier: ordinary explicit, or desecrated (revealed through Abyss crafting).
 * Both occupy prefix / suffix slots; only explicit ones roll from ordinary currency.
 */
export type ModifierLayer = 'explicit' | 'desecrated';

/** Modifiers outside the prefix / suffix slots. Fractured is not a layer: it is a state of a modifier on an item. */
export type SpecialModifierLayer = 'implicit' | 'corruption';

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
  /** Stable family id from game data (the modifier "type"); absent = family by side + groups. */
  readonly family?: string;
  /** Absent = explicit. */
  readonly layer?: ModifierLayer;
  /** Modifier domain ("item", "flask", "misc"); absent = any. Must match the base domain. */
  readonly domain?: string;
  readonly statIds?: readonly string[];
  readonly versions: VersionRange;
  readonly provenance: Provenance;
}

/**
 * Implicit modifiers of bases and corruption enchantments: game data shown and parsed, but not part
 * of the prefix / suffix pool and not rolled by ordinary currency.
 */
export interface SpecialModifierDefinition {
  readonly id: ModifierId;
  readonly name: string;
  readonly layer: SpecialModifierLayer;
  readonly family?: string;
  readonly domain?: string;
  readonly groupIds: readonly ModifierGroupId[];
  readonly requiredItemLevel: number;
  readonly lines: readonly ModifierLine[];
  readonly statIds?: readonly string[];
  readonly spawnWeights: readonly SpawnWeight[];
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
    .map((line) => {
      let rangeIndex = 0;
      return line.template.replace(/#/g, () => {
        const range = line.ranges[rangeIndex++];
        const value = values[i++];
        if (value === undefined || !range) return '#';
        return value.toFixed(rangeDecimals(range));
      });
    })
    .join('\n');
}

export function modifierText(definition: Pick<ModifierDefinition, 'lines'>): string {
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
