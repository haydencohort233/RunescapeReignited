import { useCallback, useEffect, useState } from "react";
import { useGame } from "../engine/GameEngineContext";
import { getItemDef } from "../content/items";
import { formatNumber } from "../engine/format";
import { itemImagePath } from "../content/assetPaths";
import { preloadImages } from "../lib/imagePreloader";
import type { GameState, ItemDefinition } from "../engine/types";
import type { GameEngine } from "../engine/gameEngine";
import { itemActions, formatItemStats } from "./ItemActions";
import ItemIcon from "./ItemIcon";
import { ItemTile } from "./ItemTile";
import { stackEquipId } from "../engine/ledger";
import { RECIPE_CATALOG } from "../content/recipes";
import { SKILL_CATALOG } from "../content/skills";
import { ITEM_FILTERS, matchesSearch } from "../content/itemFilters";
import { itemDescription, itemName, RARITY_CLASS } from "../content/display";
import type { CardAction } from "./ui/ActionCard";
import { QuickMenu } from "./ui/QuickMenu";
import { Modal } from "./ui/Modal";
import { EmptyState, Page } from "./ui/Page";

/** One slot in the inventory: either a whole stack (wood x40) or one copy
 *  of a non-stackable item (a specific dagger, which may be worn). */
interface InventoryEntry {
  key: string;
  def: ItemDefinition;
  instanceId?: string;
  quantity?: number;
  equipped: boolean;
}

type SortId = "type" | "name" | "value";

/** Skills with a recipe that uses this item, for "Use in Firemaking" etc. */
function skillsUsing(itemDefId: string): { id: string; name: string }[] {
  const ids = new Set(RECIPE_CATALOG.filter((r) => r.inputs.some((i) => i.resource === itemDefId)).map((r) => r.skill));
  return SKILL_CATALOG.filter((s) => ids.has(s.id));
}

/** Where an item falls in "Type" order: the filter chips' order. */
function typeRank(def: ItemDefinition): number {
  const i = ITEM_FILTERS.findIndex((f) => f.id !== "equipped" && f.matches(def, false));
  return i === -1 ? ITEM_FILTERS.length : i;
}

function collectEntries(engine: GameEngine, state: GameState): InventoryEntry[] {
  const entries: InventoryEntry[] = [];
  for (const [id, resource] of Object.entries(state.resources)) {
    const def = getItemDef(id);
    const quantity = Math.floor(resource.amount);
    if (def && quantity >= 1) entries.push({ key: `stack:${id}`, def, quantity, equipped: engine.isEquipped(stackEquipId(id)) });
  }
  for (const instance of Object.values(state.inventory)) {
    const def = getItemDef(instance.itemDefId);
    // An orphaned instance from removed content is skipped rather than crashing.
    if (def) entries.push({ key: instance.instanceId, def, instanceId: instance.instanceId, equipped: engine.isEquipped(instance.instanceId) });
  }
  return entries;
}

/** Every action for one entry, "Use in <skill>" first. */
function entryActions(engine: GameEngine, entry: InventoryEntry, onOpenSkill: (skillId: string) => void): CardAction[] {
  return [
    ...skillsUsing(entry.def.id).map((skill) => ({
      label: `Use in ${skill.name}`,
      onClick: () => onOpenSkill(skill.id),
    })),
    ...itemActions(engine, entry.def, { instanceId: entry.instanceId, equipped: entry.equipped, quantity: entry.quantity }),
  ];
}

export default function InventoryPanel({ onOpenSkill }: { onOpenSkill: (skillId: string) => void }) {
  const { engine, state } = useGame();
  const [query, setQuery] = useState("");
  const [filterId, setFilterId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortId>("type");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; key: string } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const closeDetails = useCallback(() => setSelectedKey(null), []);

  const entries = collectEntries(engine, state);

  // Request every icon at once instead of one fetch per tile as it renders.
  const itemDefIds = entries.map((e) => e.def.id).join(",");
  useEffect(() => {
    void preloadImages(entries.map(({ def }) => itemImagePath(def.name, def.animated, def.assetFolder)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemDefIds]);

  const filter = ITEM_FILTERS.find((f) => f.id === filterId);
  const shown = entries
    .filter((e) => (!filter || filter.matches(e.def, e.equipped)) && matchesSearch(e.def, e.equipped, query))
    .sort((a, b) => {
      if (sort === "value") return (b.def.value ?? 0) * (b.quantity ?? 1) - (a.def.value ?? 0) * (a.quantity ?? 1);
      if (sort === "type") {
        const rank = typeRank(a.def) - typeRank(b.def);
        if (rank !== 0) return rank;
      }
      return a.def.name.localeCompare(b.def.name);
    });

  // Re-read from state each render: an action can change or remove it.
  const selected = selectedKey ? entries.find((e) => e.key === selectedKey) : undefined;
  const menuEntry = menu ? entries.find((e) => e.key === menu.key) : undefined;

  return (
    <Page title="Inventory" meta={`${entries.length} ${entries.length === 1 ? "item" : "items"}`}>
      <div className="stack-sm">
        <div className="row inv-toolbar">
          <input
            id="inventory-search"
            type="search"
            className="input inv-search"
            placeholder="Search items, or a type like Armour"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search inventory"
          />
          <select id="inventory-sort" value={sort} onChange={(e) => setSort(e.target.value as SortId)} aria-label="Sort by">
            <option value="type">Sort: Type</option>
            <option value="name">Sort: Name</option>
            <option value="value">Sort: Value</option>
          </select>
        </div>
        <div className="chip-row" role="group" aria-label="Filter">
          <button type="button" className="chip" aria-pressed={!filterId} onClick={() => setFilterId(null)}>
            All
          </button>
          {ITEM_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="chip"
              aria-pressed={filterId === f.id}
              onClick={() => setFilterId(filterId === f.id ? null : f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState>Your inventory is empty.</EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState>Nothing matches. Try another search or filter.</EmptyState>
      ) : (
        <div className="inv-grid">
          {shown.map((entry) => (
            <ItemTile
              key={entry.key}
              def={entry.def}
              name={itemName(entry.def, entry.instanceId ? state.inventory[entry.instanceId] : undefined)}
              quantity={entry.quantity}
              equipped={entry.equipped}
              onClick={() => setSelectedKey(entry.key)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, key: entry.key });
              }}
            />
          ))}
        </div>
      )}

      {menu && menuEntry && (
        <QuickMenu x={menu.x} y={menu.y} onClose={closeMenu}>
          {entryActions(engine, menuEntry, onOpenSkill).map((action, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              className={`btn${action.variant ? ` btn-${action.variant}` : ""}`}
              disabled={action.disabled}
              title={action.disabled ? action.reason : undefined}
              onClick={() => {
                action.onClick();
                closeMenu();
              }}
            >
              {action.label}
            </button>
          ))}
        </QuickMenu>
      )}

      {selected && <ItemDetails entry={selected} onClose={closeDetails} onOpenSkill={onOpenSkill} />}
    </Page>
  );
}

/** Everything about one item, and what can be done with it. */
function ItemDetails({
  entry,
  onClose,
  onOpenSkill,
}: {
  entry: InventoryEntry;
  onClose: () => void;
  onOpenSkill: (skillId: string) => void;
}) {
  const { engine, state } = useGame();
  const { def, instanceId, quantity, equipped } = entry;
  const instance = instanceId ? state.inventory[instanceId] : undefined;
  const stats = formatItemStats(def);
  const condition =
    def.maxDurability !== undefined && instance
      ? `${Math.round(((instance.durability ?? def.maxDurability) / def.maxDurability) * 100)}% condition`
      : null;
  const charges = def.maxCharges !== undefined && instance ? `${instance.charges ?? 0}/${def.maxCharges} charges` : null;
  const sellPrice = engine.getShopSellPrice(def.id);

  return (
    <Modal
      title={
        <span className="row" style={{ gap: 10 }}>
          <span className="inv-detail-icon">
            <ItemIcon def={def} size={36} />
          </span>
          <span className={RARITY_CLASS[def.rarity ?? "common"]}>{itemName(def, instance)}</span>
        </span>
      }
      onClose={onClose}
    >
      <div className="stack">
        <div className="row text-small">
          {equipped && <span className="tag tag-success">Equipped</span>}
          {quantity !== undefined && <span className="tag">x{formatNumber(quantity)}</span>}
          {def.rarity && def.rarity !== "common" && <span className="tag">{def.rarity}</span>}
          {condition && <span className="tag">{condition}</span>}
          {charges && <span className="tag">{charges}</span>}
        </div>
        <p className="text-muted">{itemDescription(def, instance)}</p>
        {stats && <p className="text-small">{stats}</p>}
        {def.healAmount && <p className="text-small">Heals {def.healAmount} HP.</p>}
        {sellPrice > 0 && <p className="text-faint text-small">Shops pay {formatNumber(sellPrice)} GP each.</p>}
        <div className="btn-row">
          {entryActions(engine, entry, (skillId) => {
            onClose();
            onOpenSkill(skillId);
          }).map((action, i) => (
            <button
              key={i}
              type="button"
              className={`btn${action.variant ? ` btn-${action.variant}` : ""}`}
              disabled={action.disabled}
              title={action.disabled ? action.reason : undefined}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
        {/* A tooltip doesn't show on phones, so the reason is spelled out. */}
        {entryActions(engine, entry, () => {})
          .filter((a) => a.disabled && a.reason)
          .map((a, i) => (
            <p key={i} className="text-warning text-small">
              {a.reason}
            </p>
          ))}
      </div>
    </Modal>
  );
}
