/**
 * Base catalog of the fixture dataset: a handful of real PoE 2 bases, so the base selector and
 * class-dependent modifier pools have something to work with. A full BaseDB import replaces this
 * file with generated data of the same shape (`ItemClass[]`, `ItemBase[]`).
 *
 * What is real and what is not:
 * - names: official trade data (trade2/data/items);
 * - properties, requirements, implicits, art id: item JSON of one unmodified normal item per base,
 *   observed on the official trade on 2026-10-02 (`official.trade2-listings`);
 * - spawn tags: FIXTURE — they only route the invented modifier weights;
 * - quality range and rune socket counts: general knowledge, not verified (experimental).
 */
import type {
  BaseProperty,
  BaseRequirements,
  ItemBase,
  ItemClass,
  ItemSetupRules,
  Provenance,
} from '@poe2-craft/craft-domain';
import {
  ALWAYS,
  GENERAL_KNOWLEDGE_SOURCE_ID,
  KNOWN_NAME,
  OFFICIAL_TRADE_DATA_SOURCE_ID,
  OFFICIAL_TRADE_LISTINGS_SOURCE_ID,
} from './sources';

/** Base name confirmed officially; everything else on the record (spawn tags) is still fixture. */
const OFFICIAL_BASE_NAME: Provenance = {
  sourceId: OFFICIAL_TRADE_DATA_SOURCE_ID,
  confidence: 'experimental',
  lastVerified: '2026-10-02',
  notes:
    'Base name confirmed in pathofexile.com/api/trade2/data/items; spawn tags are fixture, so the record as a whole stays experimental',
};

const OBSERVED_DETAILS: Provenance = {
  sourceId: OFFICIAL_TRADE_LISTINGS_SOURCE_ID,
  confidence: 'verified',
  lastVerified: '2026-10-02',
  notes: 'Read from the item JSON of one unmodified normal-rarity listing; not cross-checked with game files',
};

const QUALITY_UNVERIFIED: Provenance = {
  sourceId: GENERAL_KNOWLEDGE_SOURCE_ID,
  confidence: 'experimental',
  notes: 'Commonly known 0–20% quality range for weapons; not verified against game data',
};

const SOCKETS_UNVERIFIED: Provenance = {
  sourceId: GENERAL_KNOWLEDGE_SOURCE_ID,
  confidence: 'experimental',
  notes:
    'Commonly known limit (one-handed weapons 1 rune socket, two-handed 2) without corruption; not verified against game data',
};

export const itemClasses: ItemClass[] = [
  { id: 'class.spear', name: 'Spear', clipboardName: 'Spears', versions: ALWAYS, provenance: KNOWN_NAME },
  { id: 'class.bow', name: 'Bow', clipboardName: 'Bows', versions: ALWAYS, provenance: KNOWN_NAME },
  {
    id: 'class.quarterstaff',
    name: 'Quarterstaff',
    clipboardName: 'Quarterstaves',
    versions: ALWAYS,
    provenance: KNOWN_NAME,
  },
];

/** Fixture spawn tags and setup rules per class. Real ones come with the BaseDB import. */
const CLASS_PROFILE: Record<string, { tags: string[]; setup: ItemSetupRules }> = {
  'class.spear': {
    tags: ['spear', 'one_hand_weapon', 'weapon', 'default'],
    setup: {
      quality: { min: 0, max: 20, provenance: QUALITY_UNVERIFIED },
      slots: [{ kind: 'rune-socket', label: 'Rune sockets', options: [0, 1], provenance: SOCKETS_UNVERIFIED }],
    },
  },
  'class.bow': {
    tags: ['bow', 'two_hand_weapon', 'weapon', 'default'],
    setup: {
      quality: { min: 0, max: 20, provenance: QUALITY_UNVERIFIED },
      slots: [{ kind: 'rune-socket', label: 'Rune sockets', options: [0, 1, 2], provenance: SOCKETS_UNVERIFIED }],
    },
  },
  'class.quarterstaff': {
    tags: ['quarterstaff', 'two_hand_weapon', 'weapon', 'default'],
    setup: {
      quality: { min: 0, max: 20, provenance: QUALITY_UNVERIFIED },
      slots: [{ kind: 'rune-socket', label: 'Rune sockets', options: [0, 1, 2], provenance: SOCKETS_UNVERIFIED }],
    },
  },
};

interface BaseSpec {
  readonly id: string;
  readonly name: string;
  readonly itemClassId: string;
  readonly artAssetId: string;
  readonly properties: readonly BaseProperty[];
  readonly requirements: BaseRequirements;
  readonly implicits: readonly string[];
}

function base(spec: BaseSpec): ItemBase {
  const profile = CLASS_PROFILE[spec.itemClassId];
  if (!profile) throw new Error(`No fixture profile for ${spec.itemClassId}`);
  return {
    id: spec.id,
    name: spec.name,
    itemClassId: spec.itemClassId,
    tags: profile.tags,
    artAssetId: spec.artAssetId,
    details: {
      properties: spec.properties,
      requirements: spec.requirements,
      implicits: spec.implicits,
      provenance: OBSERVED_DETAILS,
    },
    setup: profile.setup,
    versions: ALWAYS,
    provenance: OFFICIAL_BASE_NAME,
  };
}

export const bases: ItemBase[] = [
  base({
    id: 'base.akoyan-spear',
    name: 'Akoyan Spear',
    itemClassId: 'class.spear',
    artAssetId: 'Art/2DItems/Weapons/OneHandWeapons/OneHandSpears/1HSpear10',
    properties: [
      { name: 'Physical Damage', value: '39-72' },
      { name: 'Critical Hit Chance', value: '7.00%' },
      { name: 'Attacks per Second', value: '1.60' },
    ],
    requirements: { level: 78, strength: 50, dexterity: 127, intelligence: 90 },
    implicits: [],
  }),
  base({
    id: 'base.hardwood-spear',
    name: 'Hardwood Spear',
    itemClassId: 'class.spear',
    artAssetId: 'Art/2DItems/Weapons/OneHandWeapons/OneHandSpears/1HSpear01',
    properties: [
      { name: 'Physical Damage', value: '5-9' },
      { name: 'Critical Hit Chance', value: '5.00%' },
      { name: 'Attacks per Second', value: '1.60' },
    ],
    requirements: {},
    implicits: [],
  }),
  base({
    id: 'base.hunting-spear',
    name: 'Hunting Spear',
    itemClassId: 'class.spear',
    artAssetId: 'Art/2DItems/Weapons/OneHandWeapons/OneHandSpears/1HSpear03',
    properties: [
      { name: 'Physical Damage', value: '10-17' },
      { name: 'Critical Hit Chance', value: '5.00%' },
      { name: 'Attacks per Second', value: '1.55' },
    ],
    requirements: { level: 10, strength: 9, dexterity: 17 },
    implicits: ['(15–25)% chance to Maim on Hit'],
  }),
  base({
    id: 'base.war-spear',
    name: 'War Spear',
    itemClassId: 'class.spear',
    artAssetId: 'Art/2DItems/Weapons/OneHandWeapons/OneHandSpears/1HSpear05',
    properties: [
      { name: 'Physical Damage', value: '16-27' },
      { name: 'Critical Hit Chance', value: '5.00%' },
      { name: 'Attacks per Second', value: '1.60' },
    ],
    requirements: { level: 21, strength: 14, dexterity: 31 },
    implicits: ['(25–35)% increased Projectile Speed with this Weapon'],
  }),
  base({
    id: 'base.orichalcum-spear',
    name: 'Orichalcum Spear',
    itemClassId: 'class.spear',
    artAssetId: 'Art/2DItems/Weapons/OneHandWeapons/OneHandSpears/1HSpear02',
    properties: [
      { name: 'Physical Damage', value: '46-62' },
      { name: 'Critical Hit Chance', value: '5.00%' },
      { name: 'Attacks per Second', value: '1.60' },
    ],
    requirements: { level: 67, strength: 41, dexterity: 104 },
    implicits: [],
  }),
  base({
    id: 'base.recurve-bow',
    name: 'Recurve Bow',
    itemClassId: 'class.bow',
    artAssetId: 'Art/2DItems/Weapons/TwoHandWeapons/Bows/Basetypes/Bow04',
    properties: [
      { name: 'Physical Damage', value: '15-31' },
      { name: 'Critical Hit Chance', value: '5.00%' },
      { name: 'Attacks per Second', value: '1.10' },
    ],
    requirements: { level: 16, dexterity: 31 },
    implicits: [],
  }),
  base({
    id: 'base.crude-bow',
    name: 'Crude Bow',
    itemClassId: 'class.bow',
    artAssetId: 'Art/2DItems/Weapons/TwoHandWeapons/Bows/Basetypes/Bow01',
    properties: [
      { name: 'Physical Damage', value: '6-9' },
      { name: 'Critical Hit Chance', value: '5.00%' },
      { name: 'Attacks per Second', value: '1.20' },
    ],
    requirements: {},
    implicits: [],
  }),
  base({
    id: 'base.dualstring-bow',
    name: 'Dualstring Bow',
    itemClassId: 'class.bow',
    artAssetId: 'Art/2DItems/Weapons/TwoHandWeapons/Bows/Basetypes/Bow06',
    properties: [
      { name: 'Physical Damage', value: '19-35' },
      { name: 'Critical Hit Chance', value: '5.00%' },
      { name: 'Attacks per Second', value: '1.15' },
    ],
    requirements: { level: 28, dexterity: 52 },
    implicits: ['+1% Surpassing chance to fire an additional Arrow'],
  }),
  base({
    id: 'base.gemini-bow',
    name: 'Gemini Bow',
    itemClassId: 'class.bow',
    artAssetId: 'Art/2DItems/Weapons/TwoHandWeapons/Bows/Basetypes/Bow06',
    properties: [
      { name: 'Physical Damage', value: '39-72' },
      { name: 'Critical Hit Chance', value: '5.00%' },
      { name: 'Attacks per Second', value: '1.15' },
    ],
    requirements: { level: 78, dexterity: 163 },
    implicits: ['+1% Surpassing chance to fire an additional Arrow'],
  }),
  base({
    id: 'base.obliterator-bow',
    name: 'Obliterator Bow',
    itemClassId: 'class.bow',
    artAssetId: 'Art/2DItems/Weapons/TwoHandWeapons/Bows/Basetypes/Bow09',
    properties: [
      { name: 'Physical Damage', value: '62-115' },
      { name: 'Critical Hit Chance', value: '5.00%' },
      { name: 'Attacks per Second', value: '1.10' },
    ],
    requirements: { level: 78, dexterity: 163 },
    implicits: ['50% reduced Projectile Range'],
  }),
  base({
    id: 'base.wrapped-quarterstaff',
    name: 'Wrapped Quarterstaff',
    itemClassId: 'class.quarterstaff',
    artAssetId: 'Art/2DItems/Weapons/TwoHandWeapons/WarStaves/Warstaff01',
    properties: [
      { name: 'Physical Damage', value: '7-12' },
      { name: 'Critical Hit Chance', value: '10.00%' },
      { name: 'Attacks per Second', value: '1.40' },
    ],
    requirements: {},
    implicits: [],
  }),
  base({
    id: 'base.long-quarterstaff',
    name: 'Long Quarterstaff',
    itemClassId: 'class.quarterstaff',
    artAssetId: 'Art/2DItems/Weapons/TwoHandWeapons/WarStaves/Warstaff02',
    properties: [
      { name: 'Physical Damage', value: '9-18' },
      { name: 'Critical Hit Chance', value: '10.00%' },
      { name: 'Attacks per Second', value: '1.40' },
    ],
    requirements: { dexterity: 9 },
    implicits: ['16% increased Melee Strike Range with this weapon'],
  }),
  base({
    id: 'base.striking-quarterstaff',
    name: 'Striking Quarterstaff',
    itemClassId: 'class.quarterstaff',
    artAssetId: 'Art/2DItems/Weapons/TwoHandWeapons/WarStaves/Warstaff02',
    properties: [
      { name: 'Physical Damage', value: '53-111' },
      { name: 'Critical Hit Chance', value: '10.00%' },
      { name: 'Attacks per Second', value: '1.40' },
    ],
    requirements: { level: 77, dexterity: 127, intelligence: 50 },
    implicits: ['16% increased Melee Strike Range with this weapon'],
  }),
];

