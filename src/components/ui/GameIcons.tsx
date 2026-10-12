import type { BonusDrop, CraftingRecipe, RecipeInput } from "../../engine/types";
import { getItemDef } from "../../content/items";
import { skillName, resourceName } from "../../content/display";
import { skillIconPath } from "../../content/assetPaths";
import { formatNumber, formatXp } from "../../engine/format";
import GameImage from "../GameImage";
import ItemIcon from "../ItemIcon";

// The small building blocks every skill screen uses, so a new skill
// (Runecrafting, Mining...) gets icons, yields and chances by adding
// content only: a skill's icon, an item with its icon and name, and a
// recipe's "inputs → output, plus chances" line.

/** A skill's icon, with its name as the tooltip. */
export function SkillIcon({ skillId, size = 18 }: { skillId: string; size?: number }) {
  return (
    <span title={skillName(skillId)} className="game-icon">
      <GameImage
        src={skillIconPath(skillId)}
        alt={skillName(skillId)}
        style={{ width: size, height: size }}
        fallback={<span style={{ width: size, height: size, display: "inline-block" }} />}
      />
    </span>
  );
}

/** An item (or currency) as icon + "3 Wood", named in the tooltip. */
export function ItemChip({ id, amount, size = 18, label }: { id: string; amount?: number; size?: number; label?: string }) {
  const def = getItemDef(id);
  const name = def?.name ?? resourceName(id);
  return (
    <span className="item-chip" title={name}>
      {def ? <ItemIcon def={def} size={size} /> : <span aria-hidden="true">🪙</span>}
      <span>{label ?? `${amount !== undefined ? `${formatNumber(amount)} ` : ""}${name}`}</span>
    </span>
  );
}

/** The item a recipe is pictured with: what it uses up (the log you burn),
 *  or for gathering, what it gives (the logs you chop). */
function recipeIconItemId(recipe: CraftingRecipe): string {
  return recipe.inputs[0]?.resource ?? recipe.output?.resource ?? "";
}

export function RecipeIcon({ recipe, size = 20 }: { recipe: CraftingRecipe; size?: number }) {
  const def = getItemDef(recipeIconItemId(recipe));
  return def ? (
    <span title={def.name} className="game-icon">
      <ItemIcon def={def} size={size} />
    </span>
  ) : (
    <SkillIcon skillId={recipe.skill} size={size} />
  );
}

function ChipList({ items }: { items: RecipeInput[] }) {
  return (
    <>
      {items.map((i, n) => (
        <span key={i.resource}>
          {n > 0 && " + "}
          <ItemChip id={i.resource} amount={i.amount} />
        </span>
      ))}
    </>
  );
}

/** "10% Coal" chips for a recipe's chance-based extras. */
export function BonusChips({ drops }: { drops: BonusDrop[] }) {
  return (
    <>
      {drops.map((d) => (
        <ItemChip
          key={d.resource}
          id={d.resource}
          label={`${formatChance(d.chance)} ${d.amount > 1 ? `${formatNumber(d.amount)} ` : ""}${getItemDef(d.resource)?.name ?? resourceName(d.resource)}`}
        />
      ))}
    </>
  );
}

/** "1% chance" reads better than "0.5%" rounding to "1%"; keep one
 *  decimal under 1%. */
function formatChance(chance: number): string {
  const pct = chance * 100;
  return `${pct < 1 ? pct.toFixed(1) : Math.round(pct)}%`;
}

/** What a recipe takes and gives, with icons: "1 Wood → 1 Ashes", then
 *  "Chance of: 10% Coal" when it has bonus drops. */
export function RecipeYield({ recipe }: { recipe: CraftingRecipe }) {
  return (
    <div className="recipe-yield">
      <div className="row" style={{ gap: 6 }}>
        {recipe.inputs.length > 0 && (
          <>
            <ChipList items={recipe.inputs} />
            <span aria-hidden="true">→</span>
          </>
        )}
        {recipe.output ? (
          <ItemChip id={recipe.output.resource} amount={recipe.output.amount} />
        ) : (
          <span className="item-chip">
            <SkillIcon skillId={recipe.skill} size={16} />
            {formatXp(recipe.xpPerItem)} {skillName(recipe.skill)} XP
          </span>
        )}
      </div>
      {recipe.bonusDrops && recipe.bonusDrops.length > 0 && (
        <div className="row text-small" style={{ gap: 6 }}>
          <span className="text-faint">Chance of:</span>
          <BonusChips drops={recipe.bonusDrops} />
        </div>
      )}
    </div>
  );
}
