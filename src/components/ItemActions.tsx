import type { GameEngine } from "../engine/gameEngine";
import type { ItemDefinition, ItemActionId } from "../engine/types";
import { getLocation } from "../content/mapLocations";
import type { CardAction } from "./ui/ActionCard";

const ACTION_LABEL: Record<ItemActionId, string> = {
  equip: "Equip",
  unequip: "Unequip",
  drop: "Drop",
  examine: "Examine",
  eat: "Eat",
  craft: "Craft",
  teleport: "Teleport",
};

/** An item's actions as card actions — the same list powers the inline
 *  panel and the right-click menu, in the Inventory and Equipment tabs. */
export function itemActions(
  engine: GameEngine,
  def: ItemDefinition,
  opts: {
    /** Set for a non-stackable item (one specific copy); omitted for a stack. */
    instanceId?: string;
    equipped: boolean;
    /** Actions to hide — e.g. the Equipment tab hides "drop" since OSRS
     *  requires unequipping first. */
    exclude?: ItemActionId[];
  }
): CardAction[] {
  const { instanceId, equipped, exclude } = opts;
  const handlers: Partial<Record<ItemActionId, () => void>> = {
    equip: () => instanceId && engine.equipItem(def, instanceId),
    unequip: () => def.equipSlot && engine.unequipSlot(def.equipSlot),
    drop: () => (instanceId ? engine.dropItem(def, instanceId) : engine.dropStack(def.id)),
    examine: () => {
      const statEntries = Object.entries(def.stats ?? {});
      const statText =
        statEntries.length > 0
          ? " (" + statEntries.map(([s, v]) => `${capitalize(s)}: ${v >= 0 ? "+" : ""}${v}`).join(", ") + ")"
          : "";
      engine.notifications.push("status", `${def.description}${statText}`, { durationMs: null });
    },
    eat: () => engine.eatItem(def.id),
    craft: () => engine.notifications.push("status", "Nothing to craft with this yet.", { severity: "warning" }),
    teleport: () => {
      const destination = def.teleportTo ? getLocation(def.teleportTo) : undefined;
      if (destination && instanceId) engine.teleportTo(def, instanceId, destination);
    },
  };

  // "equip" becomes "unequip" once worn.
  return def.actions
    .filter((a) => !exclude?.includes(a))
    .map((a) => (a === "equip" && equipped ? "unequip" : a))
    .map((action) => ({
      label: ACTION_LABEL[action],
      variant: action === "drop" ? ("danger" as const) : undefined,
      onClick: () => handlers[action]?.(),
    }));
}

/** "Attack +67, Strength +66" for an item's description line. */
export function formatItemStats(def: ItemDefinition): string {
  return Object.entries(def.stats ?? {})
    .map(([s, v]) => `${capitalize(s)} ${v >= 0 ? "+" : ""}${v}`)
    .join(", ");
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
