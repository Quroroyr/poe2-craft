import type { ModifierDefinition, SpawnWeight } from './modifier';

/**
 * Resolves the spawn weight of a modifier for a base with the given tags.
 *
 * Rule (as laid out in PoE game data and shown by PoE2DB): spawn weights are an ordered
 * list of (tag, weight); the first entry whose tag the base has decides the weight.
 * Returns null when no entry matches — the modifier cannot spawn on that base.
 */
export function resolveSpawnWeight(
  definition: ModifierDefinition,
  baseTags: readonly string[],
): SpawnWeight | null {
  for (const entry of definition.spawnWeights) {
    if (baseTags.includes(entry.tag)) return entry;
  }
  return null;
}

/** A modifier is spawnable when its resolved weight is unknown or positive; weight 0 forbids it. */
export function isSpawnable(entry: SpawnWeight | null): boolean {
  return entry !== null && (entry.weight === null || entry.weight > 0);
}
