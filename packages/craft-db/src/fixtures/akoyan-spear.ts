/**
 * FIXTURE / DEMO DATA — NOT REAL PATH OF EXILE 2 NUMBERS.
 *
 * Hand-written for the v0.1 vertical slice. Modifier texts imitate the style of PoE 2
 * item text so the parser has something realistic to read, but every tier range,
 * item level, modifier level and spawn weight below was invented to exercise the
 * engine (prefixes vs suffixes, tiers, ilvl gates, collisions, competing suffixes,
 * version revisions, an off-class modifier). Do not quote these numbers as game data.
 *
 * Names that are believed to exist in PoE 2 (the Akoyan Spear base, currency and
 * omen names, the "+# to Level of all Projectile Skills" stat) are tagged with the
 * `unverified.general-knowledge` source and `experimental` confidence until checked
 * against PoE2DB / game data. See docs/data-sources.md.
 */
import type {
  AffixLimitRule,
  AffixSide,
  Consumable,
  CraftAction,
  CraftTarget,
  ItemBase,
  ItemClass,
  ModifierDefinition,
  ModifierGroup,
  Provenance,
  SpawnWeight,
  StatRange,
  VersionRange,
} from '@poe2-craft/craft-domain';
import type { CraftDataset } from '../dataset';

export const FIXTURE_SOURCE_ID = 'fixture.akoyan-spear-v0.1';
export const GENERAL_KNOWLEDGE_SOURCE_ID = 'unverified.general-knowledge';
export const OFFICIAL_TRADE_DATA_SOURCE_ID = 'official.trade2-data';

const FIXTURE: Provenance = {
  sourceId: FIXTURE_SOURCE_ID,
  confidence: 'experimental',
  notes: 'Invented demo value',
};

const KNOWN_NAME: Provenance = {
  sourceId: GENERAL_KNOWLEDGE_SOURCE_ID,
  confidence: 'experimental',
  notes: 'Name believed to exist in PoE 2; not yet verified against PoE2DB or game data',
};

/** Names (and art ids) confirmed against GGG's PoE 2 trade data endpoints. */
const OFFICIAL_NAME: Provenance = {
  sourceId: OFFICIAL_TRADE_DATA_SOURCE_ID,
  confidence: 'official',
  lastVerified: '2026-10-02',
  notes: 'Name and icon art taken from pathofexile.com/api/trade2/data/static; mechanics not covered by this source',
};

/** Base name confirmed officially; everything else on the record (spawn tags) is still fixture. */
const OFFICIAL_BASE_NAME: Provenance = {
  sourceId: OFFICIAL_TRADE_DATA_SOURCE_ID,
  confidence: 'experimental',
  lastVerified: '2026-10-02',
  notes:
    'Base name confirmed in pathofexile.com/api/trade2/data/items; spawn tags are fixture, so the record as a whole stays experimental',
};

const ALWAYS: VersionRange = { introducedIn: '0.4.0' };

// ---------------------------------------------------------------- classes & bases

const itemClasses: ItemClass[] = [
  { id: 'class.spear', name: 'Spear', clipboardName: 'Spears', versions: ALWAYS, provenance: KNOWN_NAME },
  { id: 'class.bow', name: 'Bow', clipboardName: 'Bows', versions: ALWAYS, provenance: KNOWN_NAME },
];

const bases: ItemBase[] = [
  {
    id: 'base.akoyan-spear',
    name: 'Akoyan Spear',
    itemClassId: 'class.spear',
    // Tags are fixture: real spawn tags must come from game data.
    tags: ['spear', 'one_hand_weapon', 'weapon', 'default'],
    versions: ALWAYS,
    provenance: OFFICIAL_BASE_NAME,
  },
  {
    id: 'base.recurve-bow',
    name: 'Recurve Bow',
    itemClassId: 'class.bow',
    tags: ['bow', 'two_hand_weapon', 'weapon', 'default'],
    versions: ALWAYS,
    provenance: OFFICIAL_BASE_NAME,
  },
];

// ---------------------------------------------------------------- groups

const group = (id: string, name: string): ModifierGroup => ({ id, name, provenance: FIXTURE });

const groups: ModifierGroup[] = [
  group('group.local-physical-percent', 'Increased Physical Damage (local)'),
  group('group.local-flat-physical', 'Adds Physical Damage (local)'),
  group('group.local-flat-fire', 'Adds Fire Damage (local)'),
  group('group.local-flat-cold', 'Adds Cold Damage (local)'),
  group('group.local-flat-lightning', 'Adds Lightning Damage (local)'),
  group('group.local-physical-accuracy-hybrid', 'Physical Damage and Accuracy (local hybrid)'),
  group('group.local-accuracy', 'Accuracy Rating (local)'),
  group('group.local-critical-chance', 'Critical Hit Chance (local)'),
  group('group.local-critical-damage', 'Critical Damage Bonus (local)'),
  group('group.local-attack-speed', 'Attack Speed (local)'),
  group('group.projectile-skill-levels', 'Level of all Projectile Skills'),
  group('group.melee-skill-levels', 'Level of all Melee Skills'),
  group('group.dexterity', 'Dexterity'),
  group('group.strength', 'Strength'),
  group('group.life-leech', 'Physical Damage Leeched as Life'),
  group('group.arrow-speed', 'Arrow Speed'),
  group('group.stun-duration', 'Stun Duration'),
  group('group.fixture-future-stat', 'Fixture future stat'),
];

// ---------------------------------------------------------------- modifiers

interface TierSpec {
  readonly tier: number;
  readonly name: string;
  readonly ilvl: number;
  /** One entry per line; each entry lists the ranges of that line's "#" placeholders. */
  readonly ranges: readonly (readonly StatRange[])[];
  readonly weights: readonly SpawnWeight[];
  readonly versions?: VersionRange;
}

interface FamilySpec {
  readonly key: string;
  readonly side: AffixSide;
  readonly groupIds: readonly string[];
  readonly templates: readonly string[];
  readonly tags: readonly string[];
  readonly tiers: readonly TierSpec[];
}

const r = (min: number, max: number = min): StatRange => ({ min, max });
/** Spear-only weight; everything else that falls through to `default` gets 0. */
const spear = (weight: number): SpawnWeight[] => [
  { tag: 'spear', weight },
  { tag: 'default', weight: 0 },
];
const spearAndBow = (weight: number): SpawnWeight[] => [
  { tag: 'spear', weight },
  { tag: 'bow', weight },
  { tag: 'default', weight: 0 },
];
const anyWeapon = (weight: number): SpawnWeight[] => [
  { tag: 'weapon', weight },
  { tag: 'default', weight: 0 },
];
const bowOnly = (weight: number): SpawnWeight[] => [
  { tag: 'bow', weight },
  { tag: 'default', weight: 0 },
];

function family(spec: FamilySpec): ModifierDefinition[] {
  return spec.tiers.map((t) => ({
    id: `mod.${spec.key}.t${t.tier}`,
    name: t.name,
    side: spec.side,
    tier: t.tier,
    groupIds: spec.groupIds,
    requiredItemLevel: t.ilvl,
    // Fixture simplification: modifier level equals required item level.
    modifierLevel: t.ilvl,
    lines: spec.templates.map((template, i) => ({ template, ranges: t.ranges[i] ?? [] })),
    spawnWeights: t.weights,
    tags: spec.tags,
    versions: t.versions ?? ALWAYS,
    provenance: FIXTURE,
  }));
}

const prefixes: ModifierDefinition[] = [
  ...family({
    key: 'local-physical-percent',
    side: 'prefix',
    groupIds: ['group.local-physical-percent'],
    templates: ['#% increased Physical Damage'],
    tags: ['damage', 'physical', 'attack'],
    tiers: [
      { tier: 4, name: 'Heavy', ilvl: 1, ranges: [[r(40, 49)]], weights: spear(1000) },
      { tier: 3, name: 'Serrated', ilvl: 16, ranges: [[r(50, 64)]], weights: spear(1000) },
      { tier: 2, name: 'Wicked', ilvl: 46, ranges: [[r(65, 84)]], weights: spear(800) },
      { tier: 1, name: 'Bloodthirsty', ilvl: 75, ranges: [[r(85, 109)]], weights: spear(400) },
    ],
  }),
  ...family({
    key: 'local-flat-physical',
    side: 'prefix',
    groupIds: ['group.local-flat-physical'],
    templates: ['Adds # to # Physical Damage'],
    tags: ['damage', 'physical', 'attack'],
    tiers: [
      { tier: 4, name: 'Glinting', ilvl: 1, ranges: [[r(2, 3), r(5, 6)]], weights: spear(1000) },
      { tier: 3, name: 'Burnished', ilvl: 18, ranges: [[r(6, 8), r(11, 13)]], weights: spear(1000) },
      { tier: 2, name: 'Polished', ilvl: 46, ranges: [[r(11, 15), r(19, 23)]], weights: spear(800) },
      { tier: 1, name: 'Honed', ilvl: 72, ranges: [[r(16, 21), r(28, 33)]], weights: spear(400) },
    ],
  }),
  ...family({
    key: 'local-flat-fire',
    side: 'prefix',
    groupIds: ['group.local-flat-fire'],
    templates: ['Adds # to # Fire Damage'],
    tags: ['damage', 'elemental', 'fire', 'attack'],
    tiers: [
      { tier: 3, name: 'Heated', ilvl: 1, ranges: [[r(3, 5), r(7, 9)]], weights: spear(800) },
      { tier: 2, name: 'Smouldering', ilvl: 36, ranges: [[r(12, 17), r(22, 27)]], weights: spear(800) },
      { tier: 1, name: 'Flaming', ilvl: 70, ranges: [[r(25, 33), r(40, 50)]], weights: spear(400) },
    ],
  }),
  ...family({
    key: 'local-flat-cold',
    side: 'prefix',
    groupIds: ['group.local-flat-cold'],
    templates: ['Adds # to # Cold Damage'],
    tags: ['damage', 'elemental', 'cold', 'attack'],
    tiers: [
      { tier: 3, name: 'Frosted', ilvl: 1, ranges: [[r(2, 4), r(6, 8)]], weights: spear(800) },
      { tier: 2, name: 'Chilled', ilvl: 36, ranges: [[r(10, 14), r(19, 24)]], weights: spear(800) },
      { tier: 1, name: 'Icy', ilvl: 70, ranges: [[r(22, 29), r(35, 44)]], weights: spear(400) },
    ],
  }),
  ...family({
    key: 'local-flat-lightning',
    side: 'prefix',
    groupIds: ['group.local-flat-lightning'],
    templates: ['Adds # to # Lightning Damage'],
    tags: ['damage', 'elemental', 'lightning', 'attack'],
    tiers: [
      { tier: 3, name: 'Humming', ilvl: 1, ranges: [[r(1, 2), r(10, 14)]], weights: spear(800) },
      { tier: 2, name: 'Buzzing', ilvl: 36, ranges: [[r(1, 3), r(30, 40)]], weights: spear(800) },
      { tier: 1, name: 'Snapping', ilvl: 70, ranges: [[r(2, 5), r(60, 75)]], weights: spear(400) },
    ],
  }),
  ...family({
    key: 'local-physical-accuracy-hybrid',
    side: 'prefix',
    groupIds: ['group.local-physical-accuracy-hybrid'],
    templates: ['#% increased Physical Damage', '+# to Accuracy Rating'],
    tags: ['damage', 'physical', 'attack'],
    tiers: [
      { tier: 2, name: "Squire's", ilvl: 1, ranges: [[r(15, 24)], [r(16, 40)]], weights: spear(600) },
      { tier: 1, name: "Champion's", ilvl: 60, ranges: [[r(25, 34)], [r(81, 120)]], weights: spear(300) },
    ],
  }),
  ...family({
    key: 'local-accuracy',
    side: 'prefix',
    groupIds: ['group.local-accuracy'],
    templates: ['+# to Accuracy Rating'],
    tags: ['attack'],
    tiers: [
      { tier: 3, name: 'Precise', ilvl: 1, ranges: [[r(11, 50)]], weights: anyWeapon(1000) },
      { tier: 2, name: 'Reliable', ilvl: 30, ranges: [[r(51, 150)]], weights: anyWeapon(1000) },
      { tier: 1, name: 'Focused', ilvl: 60, ranges: [[r(151, 300)]], weights: anyWeapon(600) },
    ],
  }),
];

const suffixes: ModifierDefinition[] = [
  ...family({
    key: 'local-critical-chance',
    side: 'suffix',
    groupIds: ['group.local-critical-chance'],
    templates: ['+#% to Critical Hit Chance'],
    tags: ['attack', 'critical'],
    tiers: [
      { tier: 4, name: 'of Needling', ilvl: 1, ranges: [[r(1.01, 1.5)]], weights: spearAndBow(1000) },
      { tier: 3, name: 'of Stinging', ilvl: 20, ranges: [[r(1.51, 2.1)]], weights: spearAndBow(1000) },
      { tier: 2, name: 'of Piercing', ilvl: 44, ranges: [[r(2.11, 3.2)]], weights: spearAndBow(800) },
      { tier: 1, name: 'of Puncturing', ilvl: 73, ranges: [[r(3.21, 4.4)]], weights: spearAndBow(400) },
    ],
  }),
  ...family({
    key: 'local-critical-damage',
    side: 'suffix',
    groupIds: ['group.local-critical-damage'],
    templates: ['+#% to Critical Damage Bonus'],
    tags: ['attack', 'critical', 'damage'],
    tiers: [
      { tier: 3, name: 'of Ire', ilvl: 1, ranges: [[r(10, 14)]], weights: spearAndBow(1000) },
      { tier: 2, name: 'of Anger', ilvl: 30, ranges: [[r(15, 24)]], weights: spearAndBow(800) },
      { tier: 1, name: 'of Rage', ilvl: 59, ranges: [[r(25, 34)]], weights: spearAndBow(400) },
    ],
  }),
  // A two-group hybrid: collides with BOTH critical chance and critical damage.
  ...family({
    key: 'local-critical-hybrid',
    side: 'suffix',
    groupIds: ['group.local-critical-chance', 'group.local-critical-damage'],
    templates: ['+#% to Critical Hit Chance', '+#% to Critical Damage Bonus'],
    tags: ['attack', 'critical'],
    tiers: [
      { tier: 1, name: 'of the Executioner', ilvl: 50, ranges: [[r(0.8, 1.2)], [r(8, 12)]], weights: spear(300) },
    ],
  }),
  ...family({
    key: 'local-attack-speed',
    side: 'suffix',
    groupIds: ['group.local-attack-speed'],
    templates: ['#% increased Attack Speed'],
    tags: ['attack', 'speed'],
    tiers: [
      { tier: 3, name: 'of Skill', ilvl: 1, ranges: [[r(5, 7)]], weights: spearAndBow(1000) },
      { tier: 2, name: 'of Ease', ilvl: 22, ranges: [[r(8, 10)]], weights: spearAndBow(800) },
      // Two revisions of the same stable id: the weight changed between fixture versions.
      {
        tier: 1,
        name: 'of Mastery',
        ilvl: 60,
        ranges: [[r(11, 13)]],
        weights: spearAndBow(600),
        versions: { introducedIn: '0.4.0', removedIn: '0.5.0' },
      },
      {
        tier: 1,
        name: 'of Mastery',
        ilvl: 60,
        ranges: [[r(11, 13)]],
        weights: spearAndBow(400),
        versions: { introducedIn: '0.5.0', changedIn: ['0.5.0'] },
      },
    ],
  }),
  ...family({
    key: 'projectile-skill-levels',
    side: 'suffix',
    groupIds: ['group.projectile-skill-levels'],
    templates: ['+# to Level of all Projectile Skills'],
    tags: ['gem'],
    tiers: [
      { tier: 4, name: 'of the Slinger', ilvl: 2, ranges: [[r(1)]], weights: spearAndBow(500) },
      { tier: 3, name: 'of the Hurler', ilvl: 25, ranges: [[r(2)]], weights: spearAndBow(400) },
      { tier: 2, name: 'of the Lancer', ilvl: 55, ranges: [[r(3)]], weights: spearAndBow(250) },
      { tier: 1, name: 'of the Impaler', ilvl: 81, ranges: [[r(4)]], weights: spearAndBow(100) },
    ],
  }),
  ...family({
    key: 'melee-skill-levels',
    side: 'suffix',
    groupIds: ['group.melee-skill-levels'],
    templates: ['+# to Level of all Melee Skills'],
    tags: ['gem'],
    tiers: [
      { tier: 4, name: 'of Combat', ilvl: 2, ranges: [[r(1)]], weights: spear(500) },
      { tier: 3, name: 'of Dueling', ilvl: 25, ranges: [[r(2)]], weights: spear(400) },
      { tier: 2, name: 'of Battle', ilvl: 55, ranges: [[r(3)]], weights: spear(250) },
      { tier: 1, name: 'of War', ilvl: 81, ranges: [[r(4)]], weights: spear(100) },
    ],
  }),
  ...family({
    key: 'dexterity',
    side: 'suffix',
    groupIds: ['group.dexterity'],
    templates: ['+# to Dexterity'],
    tags: ['attribute'],
    tiers: [
      { tier: 4, name: 'of the Mongoose', ilvl: 1, ranges: [[r(5, 8)]], weights: anyWeapon(1000) },
      { tier: 3, name: 'of the Lynx', ilvl: 11, ranges: [[r(9, 14)]], weights: anyWeapon(1000) },
      { tier: 2, name: 'of the Fox', ilvl: 33, ranges: [[r(15, 20)]], weights: anyWeapon(1000) },
      { tier: 1, name: 'of the Falcon', ilvl: 60, ranges: [[r(21, 27)]], weights: anyWeapon(1000) },
    ],
  }),
  ...family({
    key: 'strength',
    side: 'suffix',
    groupIds: ['group.strength'],
    templates: ['+# to Strength'],
    tags: ['attribute'],
    tiers: [
      { tier: 4, name: 'of the Brute', ilvl: 1, ranges: [[r(5, 8)]], weights: anyWeapon(1000) },
      { tier: 3, name: 'of the Wrestler', ilvl: 11, ranges: [[r(9, 14)]], weights: anyWeapon(1000) },
      { tier: 2, name: 'of the Bear', ilvl: 33, ranges: [[r(15, 20)]], weights: anyWeapon(1000) },
      { tier: 1, name: 'of the Lion', ilvl: 60, ranges: [[r(21, 27)]], weights: anyWeapon(1000) },
    ],
  }),
  ...family({
    key: 'life-leech',
    side: 'suffix',
    groupIds: ['group.life-leech'],
    templates: ['Leeches #% of Physical Damage as Life'],
    tags: ['life', 'physical', 'attack'],
    tiers: [
      { tier: 2, name: 'of the Parasite', ilvl: 21, ranges: [[r(5, 6.9)]], weights: spear(600) },
      { tier: 1, name: 'of the Vampire', ilvl: 68, ranges: [[r(7, 7.9)]], weights: spear(300) },
    ],
  }),
  // Off-class modifier: must never appear in a spear pool.
  ...family({
    key: 'arrow-speed',
    side: 'suffix',
    groupIds: ['group.arrow-speed'],
    templates: ['#% increased Arrow Speed'],
    tags: ['speed'],
    tiers: [{ tier: 1, name: 'of Flight', ilvl: 1, ranges: [[r(10, 25)]], weights: bowOnly(1000) }],
  }),
  // Removed in 0.5.0: only visible to the 0.4.0 view.
  ...family({
    key: 'stun-duration',
    side: 'suffix',
    groupIds: ['group.stun-duration'],
    templates: ['#% increased Stun Duration on Enemies'],
    tags: ['attack'],
    tiers: [
      {
        tier: 1,
        name: 'of Slamming',
        ilvl: 1,
        ranges: [[r(11, 20)]],
        weights: spear(1000),
        versions: { introducedIn: '0.4.0', removedIn: '0.5.0' },
      },
    ],
  }),
  // Introduced in a version the dataset does not cover yet: invisible in every view.
  ...family({
    key: 'fixture-future-stat',
    side: 'suffix',
    groupIds: ['group.fixture-future-stat'],
    templates: ['#% increased Fixture Future Stat'],
    tags: [],
    tiers: [
      { tier: 1, name: 'of Tomorrow', ilvl: 1, ranges: [[r(1, 10)]], weights: spear(1000), versions: { introducedIn: '0.6.0' } },
    ],
  }),
];

// ---------------------------------------------------------------- rules, consumables, actions, targets

const affixLimits: AffixLimitRule[] = [
  { rarity: 'normal', maxPrefixes: 0, maxSuffixes: 0, versions: ALWAYS, provenance: KNOWN_NAME },
  { rarity: 'magic', maxPrefixes: 1, maxSuffixes: 1, versions: ALWAYS, provenance: KNOWN_NAME },
  { rarity: 'rare', maxPrefixes: 3, maxSuffixes: 3, versions: ALWAYS, provenance: KNOWN_NAME },
];

const consumable = (id: string, name: string, art: string): Consumable => ({
  id,
  name,
  art,
  versions: ALWAYS,
  provenance: OFFICIAL_NAME,
});

const consumables: Consumable[] = [
  // The trade data gives every tier of Exalted Orb the same art.
  consumable('currency.exalted-orb', 'Exalted Orb', 'Art/2DItems/Currency/CurrencyAddModToRare'),
  consumable('currency.perfect-exalted-orb', 'Perfect Exalted Orb', 'Art/2DItems/Currency/CurrencyAddModToRare'),
  consumable('currency.perfect-chaos-orb', 'Perfect Chaos Orb', 'Art/2DItems/Currency/CurrencyRerollRare'),
  consumable('currency.divine-orb', 'Divine Orb', 'Art/2DItems/Currency/CurrencyModValues'),
  consumable('omen.dextral-exaltation', 'Omen of Dextral Exaltation', 'Art/2DItems/Currency/Omens/VoodooOmens3Yellow'),
  consumable('omen.sinistral-exaltation', 'Omen of Sinistral Exaltation', 'Art/2DItems/Currency/Omens/VoodooOmens2Yellow'),
  consumable('omen.whittling', 'Omen of Whittling', 'Art/2DItems/Currency/Omens/VoodooOmens1Dark'),
  consumable('omen.dextral-erasure', 'Omen of Dextral Erasure', 'Art/2DItems/Currency/Omens/VoodooOmens3Dark'),
];

const MODELLED_ACTION: Provenance = {
  sourceId: FIXTURE_SOURCE_ID,
  confidence: 'experimental',
  notes:
    'Simplified model used by the v0.1 engine: add one explicit modifier, chosen by spawn weight ' +
    'among eligible modifiers. The real behaviour of the named currency/omen is not encoded or verified.',
};

const actions: CraftAction[] = [
  {
    id: 'action.add-random-modifier',
    name: 'Add random modifier (Exalted Orb model)',
    description: 'Adds one random prefix or suffix, weighted by spawn weight.',
    requirements: { rarities: ['rare'] },
    effect: { kind: 'add-random-modifier', allowedSides: ['prefix', 'suffix'] },
    defaultCost: [{ consumableId: 'currency.exalted-orb', quantity: 1 }],
    versions: ALWAYS,
    provenance: MODELLED_ACTION,
  },
  {
    id: 'action.add-random-suffix',
    name: 'Add random suffix (side-restricted add)',
    description:
      'Adds one random suffix. Models any side restriction (e.g. an Omen); the Omen itself is not simulated.',
    requirements: { rarities: ['rare'] },
    effect: { kind: 'add-random-modifier', allowedSides: ['suffix'] },
    defaultCost: [
      { consumableId: 'currency.exalted-orb', quantity: 1 },
      { consumableId: 'omen.dextral-exaltation', quantity: 1 },
    ],
    versions: ALWAYS,
    provenance: MODELLED_ACTION,
  },
  {
    id: 'action.add-random-prefix',
    name: 'Add random prefix (side-restricted add)',
    description:
      'Adds one random prefix. Models any side restriction (e.g. an Omen); the Omen itself is not simulated.',
    requirements: { rarities: ['rare'] },
    effect: { kind: 'add-random-modifier', allowedSides: ['prefix'] },
    defaultCost: [
      { consumableId: 'currency.exalted-orb', quantity: 1 },
      { consumableId: 'omen.sinistral-exaltation', quantity: 1 },
    ],
    versions: ALWAYS,
    provenance: MODELLED_ACTION,
  },
  {
    id: 'action.add-random-modifier-min-level-50',
    name: 'Add random modifier, modifier level ≥ 50 (Perfect Exalted Orb model)',
    description:
      'Adds one random modifier whose modifier level is at least 50. The threshold is fixture data, not a verified value.',
    requirements: { rarities: ['rare'] },
    effect: { kind: 'add-random-modifier', allowedSides: ['prefix', 'suffix'], minModifierLevel: 50 },
    defaultCost: [{ consumableId: 'currency.perfect-exalted-orb', quantity: 1 }],
    versions: ALWAYS,
    provenance: MODELLED_ACTION,
  },
];

const targets: CraftTarget[] = [
  {
    id: 'target.projectile-levels-4',
    label: '+4 to Level of all Projectile Skills',
    modifierIds: ['mod.projectile-skill-levels.t1'],
    provenance: FIXTURE,
  },
  {
    id: 'target.projectile-levels-3-plus',
    label: '+3 or more to Level of all Projectile Skills',
    modifierIds: ['mod.projectile-skill-levels.t2', 'mod.projectile-skill-levels.t1'],
    provenance: FIXTURE,
  },
  {
    id: 'target.melee-levels-4',
    label: '+4 to Level of all Melee Skills',
    modifierIds: ['mod.melee-skill-levels.t1'],
    provenance: FIXTURE,
  },
  {
    id: 'target.critical-damage-t1',
    label: '+(25–34)% to Critical Damage Bonus (T1)',
    modifierIds: ['mod.local-critical-damage.t1'],
    provenance: FIXTURE,
  },
  {
    id: 'target.physical-percent-t1',
    label: '(85–109)% increased Physical Damage (T1)',
    modifierIds: ['mod.local-physical-percent.t1'],
    provenance: FIXTURE,
  },
];

export const akoyanSpearFixture: CraftDataset = {
  info: {
    id: 'fixture.akoyan-spear',
    title: 'Akoyan Spear — demo dataset v0.1',
    kind: 'fixture',
    description:
      'Hand-written demo data for the v0.1 vertical slice. Tiers, item levels and weights are invented.',
    gameVersions: ['0.4.0', '0.5.0'],
    sources: [
      {
        id: FIXTURE_SOURCE_ID,
        kind: 'fixture',
        title: 'Hand-written demo data (NOT real PoE 2 numbers)',
      },
      {
        id: GENERAL_KNOWLEDGE_SOURCE_ID,
        kind: 'inferred',
        title: 'General PoE 2 knowledge, pending verification against PoE2DB / game data',
        url: 'https://poe2db.tw/',
      },
      {
        id: OFFICIAL_TRADE_DATA_SOURCE_ID,
        kind: 'official',
        title: 'PoE 2 trade data endpoints by GGG (static, items, stats) — names, base names, icon art',
        url: 'https://www.pathofexile.com/api/trade2/data/static',
      },
    ],
  },
  itemClasses,
  bases,
  groups,
  modifiers: [...prefixes, ...suffixes],
  actions,
  targets,
  affixLimits,
  consumables,
};
