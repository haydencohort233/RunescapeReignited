// Pure combat resolution — no GameState, no engine dependency. Simplified
// versions of OSRS's real accuracy/max-hit formulas (skipping prayer bonus
// and attack-style bonuses, which don't exist in this game yet — easy to
// fold in later without changing the shape).
//
// Deliberately STYLE-AGNOSTIC: "accuracy" and "power" instead of hardcoding
// "attack"/"strength" — melee, Ranged, and Magic all resolve through the
// exact same functions later, just fed a different skill pair. Only melee
// is actually wired to skills/equipment right now; this is the framework
// for the other two to plug into without rewriting the math.

export interface AccuracySide {
  /** The relevant skill level for this side — Attack (attacking) or
   *  Defence (defending), and later Ranged/Magic for those styles. */
  level: number;
  /** Equipment + modifier-derived bonus for that stat. */
  bonus: number;
}

export interface PowerSide {
  /** The relevant skill level for max hit — Strength for melee, and later
   *  Ranged/Magic for those styles. */
  level: number;
  bonus: number;
}

function accuracyRoll(side: AccuracySide): number {
  const effectiveLevel = side.level + 8;
  return effectiveLevel * (side.bonus + 64);
}

/** Probability (0-1) that an attack with these accuracy rolls lands. */
export function calculateHitChance(attacker: AccuracySide, defender: AccuracySide): number {
  const attackRoll = accuracyRoll(attacker);
  const defenceRoll = accuracyRoll(defender);
  if (attackRoll > defenceRoll) {
    return 1 - (defenceRoll + 2) / (2 * (attackRoll + 1));
  }
  return attackRoll / (2 * (defenceRoll + 1));
}

/** The ceiling of the damage roll on a successful hit — actual damage is
 *  uniform-random between 0 and this, inclusive. */
export function calculateMaxHit(power: PowerSide): number {
  const effectiveLevel = power.level + 8;
  return Math.floor(0.5 + (effectiveLevel * (power.bonus + 64)) / 640);
}

export interface AttackOutcome {
  hit: boolean;
  damage: number;
}

/** Resolves one attack: accuracy roll (accuracy vs defence), then (if it
 *  lands) a damage roll (from power). Accuracy and power are separate
 *  parameters, not merged — Attack level/bonus and Strength level/bonus
 *  are NOT interchangeable even though both happen to be {level, bonus}
 *  shapes, so keeping them as distinct arguments avoids collapsing them
 *  into one ambiguous value. `rand` defaults to Math.random but accepts
 *  any () => number generator — pass a SeededRandom-bound function for a
 *  reproducible/testable result. */
export function resolveAttack(
  accuracy: AccuracySide,
  power: PowerSide,
  defence: AccuracySide,
  rand: () => number = Math.random
): AttackOutcome {
  const hitChance = calculateHitChance(accuracy, defence);
  const hit = rand() < hitChance;
  if (!hit) return { hit: false, damage: 0 };

  const maxHit = calculateMaxHit(power);
  const damage = maxHit <= 0 ? 0 : Math.floor(rand() * (maxHit + 1));
  return { hit: true, damage };
}