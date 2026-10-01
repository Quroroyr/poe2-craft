/**
 * How much we trust a piece of game data. Ordered from strongest to weakest.
 * - official: stated by Grinding Gear Games (patch notes, official site);
 * - verified: extracted from game data or reproduced by a controlled test;
 * - community: published by community tools/sites (e.g. PoE2DB) but not re-verified by us;
 * - experimental: inferred, guessed, or demo data. Never present as fact.
 */
export type Confidence = 'official' | 'verified' | 'community' | 'experimental';

export const CONFIDENCE_ORDER: readonly Confidence[] = [
  'official',
  'verified',
  'community',
  'experimental',
];

/** Returns the weakest of the given confidence levels (a chain is only as strong as its weakest link). */
export function weakestConfidence(levels: Iterable<Confidence>): Confidence | null {
  let weakest: Confidence | null = null;
  for (const level of levels) {
    if (weakest === null || CONFIDENCE_ORDER.indexOf(level) > CONFIDENCE_ORDER.indexOf(weakest)) {
      weakest = level;
    }
  }
  return weakest;
}

export type DataSourceKind =
  | 'official'
  | 'game-data'
  | 'poe2db'
  | 'community-testing'
  | 'observation'
  | 'inferred'
  /** Hand-written demo data. Must never be shown as real PoE 2 numbers. */
  | 'fixture';

export type DataSourceId = string;

export interface DataSource {
  readonly id: DataSourceId;
  readonly kind: DataSourceKind;
  readonly title: string;
  readonly url?: string;
}

/** Attached to every game-data record so the UI can always answer "where does this number come from?". */
export interface Provenance {
  readonly sourceId: DataSourceId;
  readonly confidence: Confidence;
  /** ISO date (YYYY-MM-DD) of the last check against the source; absent = never verified. */
  readonly lastVerified?: string;
  readonly notes?: string;
}
