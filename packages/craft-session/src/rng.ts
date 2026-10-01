/** Source of uniform numbers in [0, 1). Injected everywhere randomness is needed, never global. */
export type Rng = () => number;

/** mulberry32: tiny, fast, good enough for a demo simulation, and reproducible from a seed. */
export function createSeededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Independent stream for the n-th roll of a session, so any roll can be replayed from (seed, n). */
export function rollRng(seed: number, rollIndex: number): Rng {
  return createSeededRng(Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(rollIndex + 1, 0xc2b2ae35));
}

