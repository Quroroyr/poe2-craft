/**
 * Hand-modelled rules for the production dataset — everything that is NOT an extracted fact.
 * Facts (classes, bases, modifiers, consumables) come from the generated `poe2-data.json`
 * (scripts/data/normalize.ts) and are never edited by hand.
 *
 * Every rule names its source and confidence. Nothing here is a fixture value.
 */
import type { AffixLimitRule, DataSource, Provenance, QualityRule } from '@poe2-craft/craft-domain';

export const REPOE_SOURCE_ID = 'repoe-poe2';
export const TRADE_SOURCE_ID = 'official-trade2';
export const RULES_SOURCE_ID = 'poe2-rules-community';
export const WEIGHTS_SOURCE_ID = 'poe2db-weightings';

export const PRODUCTION_SOURCES: readonly DataSource[] = [
  {
    id: REPOE_SOURCE_ID,
    kind: 'game-data',
    title: 'RePoE PoE 2 export of the game client (repoe-fork/poe2)',
    url: 'https://github.com/repoe-fork/poe2',
  },
  {
    id: TRADE_SOURCE_ID,
    kind: 'official',
    title: 'Official PoE 2 trade reference data (trade2/data)',
    url: 'https://www.pathofexile.com/api/trade2/data/static',
  },
  {
    id: RULES_SOURCE_ID,
    kind: 'community-testing',
    title: 'PoE 2 crafting rules as documented by GGG item texts, patch notes and the community wiki',
    url: 'https://www.poe2wiki.net/wiki/Modifier',
  },
  {
    id: WEIGHTS_SOURCE_ID,
    kind: 'poe2db',
    title: 'PoE2DB modifier weightings (Krakenbul, Prohibited Library; recombinator data) — community, not from the game client',
    url: 'https://poe2db.tw/us/weightings',
  },
];

const COMMUNITY: Provenance = {
  sourceId: RULES_SOURCE_ID,
  confidence: 'community',
  lastVerified: '2026-10-02',
};

/**
 * Item class categories whose affix limits are known: magic 1 prefix + 1 suffix, rare 3 + 3.
 * Jewels, flasks and charms are left out on purpose — their limits differ and are not modelled,
 * so crafting on them is refused ("affix limits unknown") instead of using these numbers.
 */
export const AFFIX_RULE_CATEGORIES: readonly string[] = ['weapon', 'armour', 'accessory'];

export function affixLimitRules(classIds: readonly string[], gameVersion: string): AffixLimitRule[] {
  const versions = { introducedIn: gameVersion };
  return [
    { rarity: 'normal', itemClassIds: classIds, maxPrefixes: 0, maxSuffixes: 0, versions, provenance: COMMUNITY },
    { rarity: 'magic', itemClassIds: classIds, maxPrefixes: 1, maxSuffixes: 1, versions, provenance: COMMUNITY },
    { rarity: 'rare', itemClassIds: classIds, maxPrefixes: 3, maxSuffixes: 3, versions, provenance: COMMUNITY },
  ];
}

/** Item quality 0–20 % on weapons and armour (recorded only; no engine reads quality yet, invariant 37). */
export const QUALITY_RULE: QualityRule = { min: 0, max: 20, provenance: COMMUNITY };
export const QUALITY_CATEGORIES: readonly string[] = ['weapon', 'armour'];
