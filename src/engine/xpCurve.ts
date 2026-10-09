// RuneScape's actual XP curve (the exponential formula behind its familiar
// level pacing). Swap this out freely if you want a different feel — it's
// isolated here specifically so tuning it later doesn't touch engine logic.

export const MAX_LEVEL = 99;

/** Total XP required to REACH `level` (i.e. xpForLevel(1) === 0). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  let points = 0;
  for (let l = 1; l < level; l++) {
    points += Math.floor(l + 300 * Math.pow(2, l / 7));
  }
  return Math.floor(points / 4);
}

/** Precomputed thresholds for levels 1..MAX_LEVEL — avoids recomputing the
 *  sum from scratch on every XP check. */
const LEVEL_THRESHOLDS: number[] = Array.from({ length: MAX_LEVEL }, (_, i) =>
  xpForLevel(i + 1)
);

/** Current level for a given total XP, capped at MAX_LEVEL. */
export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

/** XP still needed to reach the next level. Returns 0 at MAX_LEVEL. */
export function xpToNextLevel(xp: number): number {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return 0;
  return xpForLevel(level + 1) - xp;
}

export interface LevelProgress {
  level: number;
  xp: number;
  /** How far into the current level, in XP. */
  xpIntoLevel: number;
  /** Total XP the current level spans (0 at MAX_LEVEL — nothing left to fill). */
  xpForThisLevel: number;
  /** 0–1 progress toward the next level. 1 (full) at MAX_LEVEL. */
  percent: number;
}

/** Everything a progress-bar component needs, computed once. */
export function getLevelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) {
    return { level, xp, xpIntoLevel: 0, xpForThisLevel: 0, percent: 1 };
  }
  const levelFloor = xpForLevel(level);
  const levelCeil = xpForLevel(level + 1);
  const xpForThisLevel = levelCeil - levelFloor;
  const xpIntoLevel = xp - levelFloor;
  return {
    level,
    xp,
    xpIntoLevel,
    xpForThisLevel,
    percent: xpForThisLevel === 0 ? 1 : xpIntoLevel / xpForThisLevel,
  };
}

/** OSRS's real combat level formula. No Prayer skill exists yet (term
 *  omitted, equivalent to 0) — Ranged/Magic terms are included even though
 *  those skills aren't trainable via combat yet, so nothing needs to
 *  change here once they are. */
export function calculateCombatLevel(skills: {
  attack: number;
  strength: number;
  defence: number;
  hitpoints: number;
  ranged: number;
  magic: number;
}): number {
  const base = 0.25 * (skills.defence + skills.hitpoints);
  const melee = 0.325 * (skills.attack + skills.strength);
  const ranged = 0.325 * Math.floor(skills.ranged * 1.5);
  const magic = 0.325 * Math.floor(skills.magic * 1.5);
  return Math.floor(base + Math.max(melee, ranged, magic));
}