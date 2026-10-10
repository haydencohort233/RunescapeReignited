import { useEffect } from "react";
import { useGame } from "../engine/GameEngineContext";
import { getItemDef } from "../content/items";
import { formatNumber } from "../engine/format";
import { itemImagePath } from "../content/assetPaths";
import { preloadImages } from "../lib/imagePreloader";
import type { ItemDefinition } from "../engine/types";
import { itemActions, formatItemStats } from "./ItemActions";
import ItemIcon from "./ItemIcon";
import { ActionCard } from "./ui/ActionCard";
import { EmptyState, Page } from "./ui/Page";

/** One row in the inventory: either a whole stack (wood x40) or one copy
 *  of a non-stackable item (a specific dagger, which may be worn). */
interface InventoryEntry {
  key: string;
  def: ItemDefinition;
  instanceId?: string;
  quantity?: number;
}

const RARITY_CLASS: Record<string, string> = {
  uncommon: "text-success",
  rare: "text-info",
  legendary: "text-gold",
};

export default function InventoryPanel() {
  const { engine, state } = useGame();

  const entries: InventoryEntry[] = [];
  for (const [id, resource] of Object.entries(state.resources)) {
    const def = getItemDef(id);
    const quantity = Math.floor(resource.amount);
    if (def && quantity >= 1) entries.push({ key: `stack:${id}`, def, quantity });
  }
  for (const instance of Object.values(state.inventory)) {
    const def = getItemDef(instance.itemDefId);
    // An orphaned instance from removed content is skipped rather than crashing.
    if (def) entries.push({ key: instance.instanceId, def, instanceId: instance.instanceId });
  }

  // Request every icon at once instead of one fetch per row as it renders.
  const itemDefIds = entries.map((e) => e.def.id).join(",");
  useEffect(() => {
    void preloadImages(entries.map(({ def }) => itemImagePath(def.name, def.animated, def.assetFolder)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemDefIds]);

  return (
    <Page title="Inventory" meta={`${entries.length} ${entries.length === 1 ? "item" : "items"}`}>
      {entries.length === 0 ? (
        <EmptyState>Your inventory is empty.</EmptyState>
      ) : (
        <div className="stack-sm">
          {entries.map(({ key, def, instanceId, quantity }) => {
            const equipped = instanceId !== undefined && engine.isEquipped(instanceId);
            const stats = formatItemStats(def);
            return (
              <ActionCard
                key={key}
                icon={<ItemIcon def={def} size={24} />}
                title={<span className={RARITY_CLASS[def.rarity ?? "common"]}>{def.name}</span>}
                meta={
                  equipped ? (
                    <span className="tag tag-success">Equipped</span>
                  ) : quantity !== undefined ? (
                    `x${formatNumber(quantity)}`
                  ) : undefined
                }
                description={
                  <>
                    {def.description}
                    {stats && <div className="text-small">{stats}</div>}
                  </>
                }
                actions={itemActions(engine, def, { instanceId, equipped })}
              />
            );
          })}
        </div>
      )}
    </Page>
  );
}
