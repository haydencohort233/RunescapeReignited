// Randomness utilities — two flavors, pick based on what you need:
//
// - Deterministic (hashStringToSeed, seededPick, SeededRandom): same seed
//   always produces the same result, on any device, without storing or
//   syncing anything. Use this whenever the result needs to be
//   reproducible — content selection tied to a date (job rotation today),
//   and later probably loot tables or encounter generation if you want
//   "what would have dropped" to be checkable/replayable.
//
// - One-off (randomInt, randomChance, randomPick): plain Math.random(),
//   for pure in-the-moment randomness that doesn't need to be reproduced —
//   "did this attack crit right now."

/** mulberry32 — small, fast, good-enough-for-content-selection PRNG.
 *  Not cryptographic, doesn't need to be. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turns a string into a numeric seed — so e.g. a board's id can feed the
 *  PRNG alongside a numeric day without different boards colliding on the
 *  same sequence. */
export function hashStringToSeed(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (Math.imul(31, hash) + s.charCodeAt(i)) | 0;
  }
  return hash;
}

/** Shared partial-Fisher-Yates core — picks `count` indices out of
 *  `poolLength` using the given generator. Used by both the standalone
 *  seededPick() and SeededRandom.pickN() so there's one implementation. */
function pickIndices(poolLength: number, count: number, rand: () => number): number[] {
  const n = Math.min(count, poolLength);
  const indices = Array.from({ length: poolLength }, (_, i) => i);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rand() * (indices.length - i));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, n);
}

/** Deterministically picks `count` items from `pool`, seeded by `seed`.
 *  Same seed -> same picks, every time. If count >= the pool size, returns
 *  the whole pool. */
export function seededPick<T>(pool: T[], count: number, seed: number): T[] {
  if (count >= pool.length) return [...pool];
  const rand = mulberry32(seed);
  return pickIndices(pool.length, count, rand).map((i) => pool[i]);
}

/**
 * A reusable seeded random stream — same seed always produces the same
 * sequence of results across ALL its methods, in call order. Reach for
 * this over the one-off functions below whenever the result should be
 * reproducible.
 */
export class SeededRandom {
  private rand: () => number;

  constructor(seed: number) {
    this.rand = mulberry32(seed);
  }

  /** Uniform float in [0, 1). */
  next(): number {
    return this.rand();
  }

  /** Uniform integer, inclusive of both min and max — e.g. nextInt(1, 6) for a die roll. */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.rand() * (max - min + 1));
  }

  /** Uniform float in [min, max). */
  nextFloat(min: number, max: number): number {
    return min + this.rand() * (max - min);
  }

  /** True with the given probability (0-1) — e.g. chance(0.1) for a 10% crit. */
  chance(probability: number): boolean {
    return this.rand() < probability;
  }

  pick<T>(items: T[]): T {
    return items[Math.floor(this.rand() * items.length)];
  }

  pickN<T>(items: T[], count: number): T[] {
    return pickIndices(items.length, count, this.rand).map((i) => items[i]);
  }

  /** A FULL shuffle (every element repositioned), not just a partial pick. */
  shuffle<T>(items: T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /** Weighted random pick — e.g. a loot table (common 70, rare 25, legendary 5). */
  weightedPick<T>(entries: { item: T; weight: number }[]): T {
    const total = entries.reduce((sum, e) => sum + e.weight, 0);
    let roll = this.rand() * total;
    for (const entry of entries) {
      roll -= entry.weight;
      if (roll <= 0) return entry.item;
    }
    return entries[entries.length - 1].item; // floating-point rounding fallback
  }
}

// ── One-off convenience functions — Math.random()-backed ──────────────────

export function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function randomChance(probability: number): boolean {
  return Math.random() < probability;
}

export function randomPick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** One-off weighted pick — e.g. a loot roll. Not reproducible (Math.random-backed);
 *  use SeededRandom.weightedPick instead if a roll needs to be replayable. */
export function weightedRandomPick<T>(entries: { item: T; weight: number }[]): T {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry.item;
  }
  return entries[entries.length - 1].item;
}