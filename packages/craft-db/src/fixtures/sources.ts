/** Data sources and shared provenance records of the fixture dataset. */
import type { DataSource, Provenance, VersionRange } from '@poe2-craft/craft-domain';

export const FIXTURE_SOURCE_ID = 'fixture.akoyan-spear-v0.1';
export const GENERAL_KNOWLEDGE_SOURCE_ID = 'unverified.general-knowledge';
export const OFFICIAL_TRADE_DATA_SOURCE_ID = 'official.trade2-data';
export const OFFICIAL_TRADE_LISTINGS_SOURCE_ID = 'official.trade2-listings';

export const ALWAYS: VersionRange = { introducedIn: '0.4.0' };

export const FIXTURE: Provenance = {
  sourceId: FIXTURE_SOURCE_ID,
  confidence: 'experimental',
  notes: 'Invented demo value',
};

export const KNOWN_NAME: Provenance = {
  sourceId: GENERAL_KNOWLEDGE_SOURCE_ID,
  confidence: 'experimental',
  notes: 'Name believed to exist in PoE 2; not yet verified against PoE2DB or game data',
};

export const FIXTURE_SOURCES: readonly DataSource[] = [
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
  {
    id: OFFICIAL_TRADE_LISTINGS_SOURCE_ID,
    kind: 'observation',
    title:
      'Item JSON of unmodified normal-rarity items (no quality, no sockets) listed on the official PoE 2 trade — base properties, requirements, implicits, item art',
    url: 'https://www.pathofexile.com/trade2/search/poe2/Standard',
  },
];
