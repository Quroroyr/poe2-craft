/**
 * Repeat-until-success model: every attempt independently succeeds with probability p.
 * The number of attempts to the first success is geometric, so everything here is analytic
 * and deterministic — no simulation.
 */

function assertProbability(p: number): void {
  if (!Number.isFinite(p) || p < 0 || p > 1) {
    throw new RangeError(`Probability must be within [0, 1], got ${p}`);
  }
}

/** Mean number of attempts until the first success: 1 / p. Infinity when p = 0. */
export function expectedAttempts(p: number): number {
  assertProbability(p);
  return p === 0 ? Number.POSITIVE_INFINITY : 1 / p;
}

/** Chance of at least one success within n attempts: 1 - (1 - p)^n. */
export function chanceWithin(p: number, attempts: number): number {
  assertProbability(p);
  if (!Number.isInteger(attempts) || attempts < 0) {
    throw new RangeError(`Attempts must be a non-negative integer, got ${attempts}`);
  }
  if (p === 1) return attempts > 0 ? 1 : 0;
  // expm1/log1p keep precision when p is tiny (1 - p would round to 1).
  return -Math.expm1(attempts * Math.log1p(-p));
}

/**
 * Smallest n with chanceWithin(p, n) >= quantile, i.e. the quantile of the attempt count.
 * Example: quantile 0.9 → "90% of crafters are done within n attempts".
 */
export function attemptsForQuantile(p: number, quantile: number): number {
  assertProbability(p);
  if (!(quantile > 0 && quantile < 1)) {
    throw new RangeError(`Quantile must be within (0, 1), got ${quantile}`);
  }
  if (p === 0) return Number.POSITIVE_INFINITY;
  if (p === 1) return 1;
  const exact = Math.log1p(-quantile) / Math.log1p(-p);
  // Guard against 2.0000000000000004 turning into 3.
  let n = Math.max(1, Math.ceil(exact - 1e-9));
  // The epsilon above must never push n below the true quantile.
  while (chanceWithin(p, n) < quantile) n++;
  return n;
}

export const DEFAULT_ATTEMPT_COUNTS: readonly number[] = [1, 10, 25, 50, 100];
export const DEFAULT_QUANTILES: readonly number[] = [0.5, 0.75, 0.9, 0.95];
