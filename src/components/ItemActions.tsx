import { useGame } from "../engine/GameEngineContext";
import type { ItemDefinition, ItemActionId } from "../engine/types";
import { getLocation } from "../content/mapLocations";

/** Renders the buttons for one item's action list — same component powers
 *  both the click-panel and the right-click quick-menu, so the two never
 *  drift out of sync with each other. */
export default function ItemActions({
  def,
  instanceId,
  equipped,
  excludeActions,
  onAction,
}: {
  def: ItemDefinition;
  instanceId: string;
  equipped: boolean;
  /** Actions to hide regardless of what the item definition declares — e.g.
   *  the Equipment tab hides "drop" since OSRS requires unequipping first. */
  excludeActions?: ItemActionId[];
  onAction?: () => void; // called after any action, e.g. to close the menu
}) {
  const { engine } = useGame();

  const handlers: Partial<Record<ItemActionId, () => void>> = {
    equip: () => engine.equipItem(def, instanceId),
    unequip: () => def.equipSlot && engine.unequipSlot(def.equipSlot),
    drop: () => engine.dropItem(def, instanceId),
    examine: () => {
      const statEntries = Object.entries(def.stats ?? {});
      const statText =
        statEntries.length > 0
          ? " (" + statEntries.map(([s, v]) => `${capitalize(s)}: ${v >= 0 ? "+" : ""}${v}`).join(", ") + ")"
          : "";
      engine.notifications.push("status", `${def.description}${statText}`, { durationMs: null });
    },
    eat: () => engine.consumeItem(def, instanceId),
    craft: () => engine.notifications.push("status", "Nothing to craft with this yet.", { severity: "warning" }),
    teleport: () => {
      const destination = def.teleportTo ? getLocation(def.teleportTo) : undefined;
      if (destination) engine.teleportTo(def, instanceId, destination);
    },
  };

  // "equip" swaps to "unequip" once worn — remap the label, don't filter it out.
  const actions = def.actions
    .filter((a) => !excludeActions?.includes(a))
    .map((a) => (a === "equip" && equipped ? "unequip" : a)) as ItemActionId[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {actions.map((action) => (
        <button
          key={action}
          onClick={() => {
            handlers[action]?.();
            onAction?.();
          }}
          style={{ textAlign: "left" }}
        >
          {capitalize(action)}
        </button>
      ))}
    </div>
  );
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}