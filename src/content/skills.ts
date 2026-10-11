export interface SkillDefinition {
  id: string;
  name: string;
  /** What the player is shown as doing while training it, when the recipe
   *  doesn't say something more specific ("Fletching", "Fishing"). */
  activity: string;
  /** The start button for its recipes ("Burn 5", "Cook 10"). Default "Make". */
  verb?: string;
}

export function getSkill(id: string): SkillDefinition | undefined {
  return SKILL_CATALOG.find((s) => s.id === id);
}

// Every known skill, so the Skills tab can show each at level 1 / 0xp from
// the start rather than only appearing once you've earned XP in it.
// Hitpoints levels like any other skill; its level is the player's max HP.
export const SKILL_CATALOG: SkillDefinition[] = [
  { id: "attack", name: "Attack", activity: "Fighting" },
  { id: "strength", name: "Strength", activity: "Fighting" },
  { id: "defence", name: "Defence", activity: "Fighting" },
  { id: "hitpoints", name: "Hitpoints", activity: "Fighting" },
  { id: "fishing", name: "Fishing", activity: "Fishing" },
  { id: "woodcutting", name: "Woodcutting", activity: "Chopping" },
  { id: "firemaking", name: "Firemaking", activity: "Firemaking", verb: "Burn" },
  { id: "fletching", name: "Fletching", activity: "Fletching", verb: "Fletch" },
  { id: "crafting", name: "Crafting", activity: "Crafting", verb: "Craft" },
  { id: "cooking", name: "Cooking", activity: "Cooking", verb: "Cook" },
  { id: "agility", name: "Agility", activity: "Training Agility" },
  { id: "farming", name: "Farming", activity: "Farming" },
  { id: "ranged", name: "Ranged", activity: "Fighting" },
  { id: "magic", name: "Magic", activity: "Casting" },
  { id: "prayer", name: "Prayer", activity: "Praying" },
  { id: "mining", name: "Mining", activity: "Mining" },
  { id: "smithing", name: "Smithing", activity: "Smithing", verb: "Smith" },
  { id: "construction", name: "Construction", activity: "Building" },
];