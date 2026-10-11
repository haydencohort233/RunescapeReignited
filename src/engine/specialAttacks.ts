// Weapon special attacks. Mechanics live here; a weapon opts in with
// ItemDefinition.specialAttack. Specs are triggered by hand: the player
// arms one, and the next swing uses it.

export interface SpecialAttackDefinition {
  id: string;
  name: string;
  /** Energy used, out of 100. */
  cost: number;
  description: string;
  /** Separate hits in one swing (Dragon Dagger: 2). Default 1. */
  hits?: number;
  /** Multiplies the attack roll. */
  accuracyMultiplier?: number;
  /** Multiplies the max hit. */
  damageMultiplier?: number;
  /** A chance on a landed hit to start bleeding the target. */
  bleed?: {
    chance: number;
    /** Share of the target's max HP per bleed hit (rounded up, at least 1). */
    fractionOfMaxHp: number;
    hits: number;
    intervalMs: number;
  };
}

export const SPECIAL_ATTACKS: SpecialAttackDefinition[] = [
  {
    // OSRS's Dragon Dagger special: two quick hits with boosted accuracy and damage.
    id: "puncture",
    name: "Puncture",
    cost: 25,
    hits: 2,
    accuracyMultiplier: 1.15,
    damageMultiplier: 1.15,
    description: "Two quick hits, each with +15% accuracy and damage.",
  },
  {
    // OSRS's Sever disables prayers, which this game doesn't have yet. Ours
    // keeps the name and the accuracy boost, and can make the target bleed.
    id: "sever",
    name: "Sever",
    cost: 55,
    accuracyMultiplier: 1.25,
    bleed: { chance: 0.25, fractionOfMaxHp: 0.05, hits: 4, intervalMs: 3000 },
    description: "+25% accuracy. A hit has a 25% chance to make the target bleed for 5% of its max HP every 3s, 4 times.",
  },
];

const SPECS_BY_ID = new Map(SPECIAL_ATTACKS.map((s) => [s.id, s]));

export function getSpecialAttack(id: string | undefined): SpecialAttackDefinition | undefined {
  return id ? SPECS_BY_ID.get(id) : undefined;
}
