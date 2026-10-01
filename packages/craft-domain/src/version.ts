/**
 * PoE 2 patch identifier in "major.minor.patch" form, e.g. "0.5.0".
 * Kept as a plain string so data files stay readable; use the helpers below to compare.
 */
export type GameVersion = string;

/**
 * Lifetime of a piece of game data.
 * `removedIn` is exclusive: the entity exists in `introducedIn <= v < removedIn`.
 */
export interface VersionRange {
  readonly introducedIn: GameVersion;
  readonly removedIn?: GameVersion;
  /**
   * Versions in which values of this record changed. Informational only:
   * an actual change is expressed as a new revision with its own range (see ADR 002).
   */
  readonly changedIn?: readonly GameVersion[];
}

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

export function parseGameVersion(version: GameVersion): readonly [number, number, number] {
  const match = VERSION_PATTERN.exec(version);
  if (!match) {
    throw new Error(`Invalid game version "${version}", expected "major.minor.patch"`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareGameVersions(a: GameVersion, b: GameVersion): number {
  const pa = parseGameVersion(a);
  const pb = parseGameVersion(b);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

export function isAvailableIn(range: VersionRange, version: GameVersion): boolean {
  if (compareGameVersions(version, range.introducedIn) < 0) return false;
  if (range.removedIn !== undefined && compareGameVersions(version, range.removedIn) >= 0) {
    return false;
  }
  return true;
}

export function rangesOverlap(a: VersionRange, b: VersionRange): boolean {
  // Half-open intervals [introducedIn, removedIn) overlap when each starts before the other ends.
  const aStartsBeforeBEnds =
    b.removedIn === undefined || compareGameVersions(a.introducedIn, b.removedIn) < 0;
  const bStartsBeforeAEnds =
    a.removedIn === undefined || compareGameVersions(b.introducedIn, a.removedIn) < 0;
  return aStartsBeforeBEnds && bStartsBeforeAEnds;
}
