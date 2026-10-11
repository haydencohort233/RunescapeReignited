import type { GameEngine } from "../engine/gameEngine";
import type { ItemDefinition, ItemActionId } from "../engine/types";
import { getLocation } from "../content/mapLocations";
import type { CardAction } from "./ui/ActionCard";
import { requestQuantity } from "../lib/dialog";

const ACTION_LABEL: Record<ItemActionId, string> = {
  equip: "Equip",
  unequip: "Unequip",
  drop: "Drop",
  examine: "Examine",
  eat: "Eat",
  craft: "Craft",
  teleport: "Teleport",
  bury: "Bury",
};

/** An item's actions as card actions — the same list powers the inline
 *  panel and the right-click menu, in the Inventory and Equipment tabs. */
export function itemActions(
  engine: GameEngine,
  def: ItemDefinition,
  opts: {
    /** Set for a non-stackable item (one specific copy); omitted for a stack. */
    instanceId?: string;
    /** A stack's size; above 1, dropping asks how many. */
    quantity?: number;
    equipped: boolean;
    /** Actions to hide — e.g. the Equipment tab hides "drop" since OSRS
     *  requires unequipping first. */
    exclude?: ItemActionId[];
  }
): CardAction[] {
  const { instanceId, equipped, exclude, quantity = 1 } = opts;
  const handlers: Partial<Record<ItemActionId, () => void>> = {
    equip: () => engine.equipItem(def, instanceId),
    unequip: () => def.equipSlot && engine.unequipSlot(def.equipSlot),
    drop: () => {
      if (instanceId) engine.dropItem(def, instanceId);
      else if (quantity <= 1) engine.dropStack(def.id);
      else
        void requestQuantity(`Drop how many ${def.name}?`, quantity, { confirmLabel: "Drop" }).then(
          (n) => n !== null && engine.dropStack(def.id, n)
        );
    },
    examine: () => {
      const statEntries = Object.entries(def.stats ?? {});
      const statText =
        statEntries.length > 0
          ? " (" + statEntries.map(([s, v]) => `${STAT_LABEL[s] ?? capitalize(s)}: ${v >= 0 ? "+" : ""}${v}`).join(", ") + ")"
          : "";
      engine.notifications.push("status", `${def.description}${statText}`, { durationMs: 10000 });
    },
    eat: () => engine.eatItem(def.id),
    bury: () => {
      const owned = Math.floor(engine.getOwnedCount(def.id));
      if (owned <= 1) engine.buryItem(def.id, 1);
      else
        void requestQuantity(`${def.id === "ashes" ? "Scatter" : "Bury"} how many ${def.name}?`, owned, {
          confirmLabel: def.id === "ashes" ? "Scatter" : "Bury",
        }).then((n) => n !== null && engine.buryItem(def.id, n));
    },
    craft: () => engine.notifications.push("status", "Nothing to craft with this yet.", { severity: "warning" }),
    teleport: () => {
      const destination = def.teleportTo ? getLocation(def.teleportTo) : undefined;
      if (destination && instanceId) engine.teleportTo(def, instanceId, destination);
    },
  };

  // "equip" becomes "unequip" once worn. A worn stack can't be dropped
  // (it comes off first, like any worn gear).
  return def.actions
    .filter((a) => !exclude?.includes(a))
    .filter((a) => !(a === "drop" && equipped && !instanceId))
    .map((a) => (a === "equip" && equipped ? "unequip" : a))
    .map((action) => ({
      label:
        action === "bury" && def.id === "ashes"
          ? "Scatter"
          : action === "equip" && def.equipSlot === "food"
            ? "Equip as food"
            : ACTION_LABEL[action],
      variant: action === "drop" ? ("danger" as const) : undefined,
      onClick: () => handlers[action]?.(),
    }));
}

const STAT_LABEL: Record<string, string> = { rangedStrength: "Ranged strength" };

/** "Attack +67, Strength +66" for an item's description line. */
export function formatItemStats(def: ItemDefinition): string {
  return Object.entries(def.stats ?? {})
    .map(([s, v]) => `${STAT_LABEL[s] ?? capitalize(s)} ${v >= 0 ? "+" : ""}${v}`)
    .join(", ");
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
