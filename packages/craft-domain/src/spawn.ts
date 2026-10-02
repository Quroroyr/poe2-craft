import type { ModifierDefinition, SpawnWeight } from './modifier';

/**
 * Resolves the spawn weight of a modifier for a base with the given tags.
 *
 * Rule (as laid out in PoE game data and shown by PoE2DB): spawn weights are an ordered
 * list of (tag, weight); the first entry whose tag the base has decides the weight.
 * Returns null when no entry matches — the modifier cannot spawn on that base.
 */
export function resolveSpawnWeight(
  definition: Pick<ModifierDefinition, 'spawnWeights'>,
  baseTags: readonly string[],
): SpawnWeight | null {
  for (const entry of definition.spawnWeights) {
    if (baseTags.includes(entry.tag)) return entry;
  }
  return null;
}

/**
 * A modifier is spawnable when the resolved rule says so: the extracted `spawns` fact when present,
 * otherwise an unknown or positive weight; weight 0 forbids it.
 */
export function isSpawnable(entry: SpawnWeight | null): boolean {
  if (entry === null) return false;
  if (entry.spawns !== undefined) return entry.spawns && (entry.weight === null || entry.weight > 0);
  return entry.weight === null || entry.weight > 0;
}

/** The modifier and the base live in the same modifier domain (either side unspecified = compatible). */
export function sameDomain(modifierDomain: string | undefined, baseDomain: string | undefined): boolean {
  return modifierDomain === undefined || baseDomain === undefined || modifierDomain === baseDomain;
}
