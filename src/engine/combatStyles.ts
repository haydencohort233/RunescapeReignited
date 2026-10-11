import type { AttackStyle } from "./types";

/**
 * OSRS combat styles. Each style adds invisible levels to the skills it
 * favors (+3 for a focused style, +1 each for Controlled) and decides which
 * skills a kill's combat XP goes to. Rapid trades the bonus for one game
 * tick (600ms) off the attack interval.
 */
export interface CombatStyleDefinition {
  id: string;
  name: string;
  attackStyle: AttackStyle;
  /** Invisible level bonuses, by skill id ("attack", "ranged", "defence"...). */
  levelBonus: Partial<Record<string, number>>;
  /** Milliseconds taken off the weapon's attack interval. */
  speedBonusMs?: number;
  /** Skills that share the kill's combat XP (Hitpoints always gets its own share). */
  xpSkills: string[];
  description: string;
}

export const COMBAT_STYLES: CombatStyleDefinition[] = [
  {
    id: "accurate",
    name: "Accurate",
    attackStyle: "melee",
    levelBonus: { attack: 3 },
    xpSkills: ["attack"],
    description: "+3 Attack. Trains Attack.",
  },
  {
    id: "aggressive",
    name: "Aggressive",
    attackStyle: "melee",
    levelBonus: { strength: 3 },
    xpSkills: ["strength"],
    description: "+3 Strength. Trains Strength.",
  },
  {
    id: "defensive",
    name: "Defensive",
    attackStyle: "melee",
    levelBonus: { defence: 3 },
    xpSkills: ["defence"],
    description: "+3 Defence. Trains Defence.",
  },
  {
    id: "controlled",
    name: "Controlled",
    attackStyle: "melee",
    levelBonus: { attack: 1, strength: 1, defence: 1 },
    xpSkills: ["attack", "strength", "defence"],
    description: "+1 Attack, Strength and Defence. Trains all three.",
  },
  {
    id: "ranged-accurate",
    name: "Accurate",
    attackStyle: "ranged",
    levelBonus: { ranged: 3 },
    xpSkills: ["ranged"],
    description: "+3 Ranged. Trains Ranged.",
  },
  {
    id: "rapid",
    name: "Rapid",
    attackStyle: "ranged",
    levelBonus: {},
    speedBonusMs: 600,
    xpSkills: ["ranged"],
    description: "Shoots one tick (0.6s) faster. Trains Ranged.",
  },
  {
    id: "longrange",
    name: "Longrange",
    attackStyle: "ranged",
    levelBonus: { defence: 3 },
    xpSkills: ["ranged", "defence"],
    description: "+3 Defence. Trains Ranged and Defence.",
  },
  {
    id: "standard-casting",
    name: "Standard",
    attackStyle: "magic",
    levelBonus: {},
    xpSkills: ["magic"],
    description: "Trains Magic.",
  },
  {
    id: "defensive-casting",
    name: "Defensive",
    attackStyle: "magic",
    levelBonus: { defence: 3 },
    xpSkills: ["magic", "defence"],
    description: "+3 Defence. Trains Magic and Defence.",
  },
];

export const DEFAULT_COMBAT_STYLES: Record<AttackStyle, string> = {
  melee: "accurate",
  ranged: "ranged-accurate",
  magic: "standard-casting",
};

const STYLES_BY_ID = new Map(COMBAT_STYLES.map((s) => [s.id, s]));

/** The style to use for an attack style, falling back to its default when
 *  the saved id is missing or belongs to another attack style. */
export function resolveCombatStyle(attackStyle: AttackStyle, styleId: string | undefined): CombatStyleDefinition {
  const style = styleId ? STYLES_BY_ID.get(styleId) : undefined;
  if (style && style.attackStyle === attackStyle) return style;
  return STYLES_BY_ID.get(DEFAULT_COMBAT_STYLES[attackStyle])!;
}

export function stylesFor(attackStyle: AttackStyle): CombatStyleDefinition[] {
  return COMBAT_STYLES.filter((s) => s.attackStyle === attackStyle);
}
