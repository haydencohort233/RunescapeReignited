export interface SkillDefinition {
  id: string;
  name: string;
}

// Every known skill, so the Skills tab can show each at level 1 / 0xp from
// the start rather than only appearing once you've earned XP in it.
//
// Note on hitpoints: included here as a skill entry (levels/XP work the same
// as any other skill), but actual HP mechanics — current/max health as a
// combat resource, damage, regen — are NOT built yet. That's a meaningfully
// bigger system (ties into combat resolution) and belongs in its own pass
// once combat design starts, same reasoning as deferring equipment stats'
// actual combat math for now.
export const SKILL_CATALOG: SkillDefinition[] = [
  { id: "attack", name: "Attack" },
  { id: "strength", name: "Strength" },
  { id: "defence", name: "Defence" },
  { id: "hitpoints", name: "Hitpoints" },
  { id: "fishing", name: "Fishing" },
  { id: "woodcutting", name: "Woodcutting" },
  { id: "firemaking", name: "Firemaking" },
  { id: "fletching", name: "Fletching" },
  { id: "agility", name: "Agility" },
  { id: "farming", name: "Farming" },
  { id: "ranged", name: "Ranged" },
  { id: "magic", name: "Magic" },
];