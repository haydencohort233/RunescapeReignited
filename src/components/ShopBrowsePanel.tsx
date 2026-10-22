import { useCallback, useState, type MouseEvent, type ReactNode } from "react";
import { useGame } from "../engine/GameEngineContext";
import type { GameEngine } from "../engine/gameEngine";
import type { GameState, ItemDefinition, RecipeInput } from "../engine/types";
import type { ShopDefinition } from "../content/shops";
import { getItemDef, ITEM_CATALOG } from "../content/items";
import { formatAmounts, itemDescription, RARITY_CLASS, resourceName } from "../content/display";
import { formatNumber } from "../engine/format";
import { formatItemStats } from "./ItemActions";
import ItemIcon from "./ItemIcon";
import { GpAmount } from "./ui/GameIcons";
import { ItemTile } from "./ItemTile";
import type { CardAction } from "./ui/ActionCard";
import { quantityActions } from "./ui/quantity";
import { QuickMenu } from "./ui/QuickMenu";
import { Modal } from "./ui/Modal";
import { EmptyState } from "./ui/Page";
import GameImage from "./GameImage";
import { enemyImagePath } from "../content/assetPaths";

type Tab = "buy" | "sell" | "repair";
type Mode = "buy" | "sell";

/** The short price on a tile: "56 gp", "1.2K gp", or the first cost when
 *  something is priced in another resource. */
function shortPrice(price: RecipeInput[]): ReactNode {
  if (price.length === 0) return "Free";
  const first = price[0];
  return first.resource === "gp" ? <GpAmount amount={first.amount} size={11} bare /> : `${formatNumber(first.amount)} ${resourceName(first.resource)}`;
}

/** What the player could sell here: owned (and not worn) items with a
 *  value. */
function sellableItems(engine: GameEngine, state: GameState) {
  // Only count what's actually owned; calling getOwnedCount for every item
  // in the catalog would scan the inventory once per catalog entry.
  const ownedIds = new Set(Object.values(state.inventory).map((i) => i.itemDefId));
  for (const [id, r] of Object.entries(state.resources)) if (r.amount >= 1) ownedIds.add(id);
  return ITEM_CATALOG.filter((def) => ownedIds.has(def.id))
    .map((def) => ({ def, owned: Math.floor(engine.getOwnedCount(def.id)), unitPrice: engine.getShopSellPrice(def.id) }))
    .filter((e) => e.owned > 0 && e.unitPrice > 0);
}

/** Buy 1/5/10/all (or Sell) for one item: the same list powers the
 *  details panel and the right-click menu. */
function tradeActions(engine: GameEngine, shop: ShopDefinition, mode: Mode, def: ItemDefinition, refresh: () => void): CardAction[] {
  if (mode === "buy") {
    const entry = shop.items.find((i) => i.itemDefId === def.id);
    if (!entry) return [];
    const affordable = engine.getMaxAffordableQuantity(entry.price);
    return quantityActions(
      "Buy",
      affordable,
      (q) => {
        engine.buyFromShop(shop.id, def.id, q);
        refresh();
      },
      `Not enough to pay ${formatAmounts(entry.price)} each`
    );
  }
  const owned = Math.floor(engine.getOwnedCount(def.id));
  return quantityActions(
    "Sell",
    owned,
    (q) => {
      engine.sellToShop(shop.id, def.id, q);
      refresh();
    },
    "You don't have that many"
  );
}

function ActionButtons({ actions, inMenu = false, onDone }: { actions: CardAction[]; inMenu?: boolean; onDone?: () => void }) {
  return (
    <>
      {actions.map((action, i) => (
        <button
          key={i}
          type="button"
          role={inMenu ? "menuitem" : undefined}
          // The first usable action (Buy 1) is the obvious one in the panel.
          className={`btn${!inMenu && i === 0 && !action.disabled ? " btn-primary" : ""}`}
          disabled={action.disabled}
          title={action.disabled ? action.reason : undefined}
          onClick={() => {
            action.onClick();
            onDone?.();
          }}
        >
          {action.label}
        </button>
      ))}
    </>
  );
}

/** Everything about one item in the shop, with Buy or Sell buttons. */
function ShopItemDetails({ shop, mode, def, onClose }: { shop: ShopDefinition; mode: Mode; def: ItemDefinition; onClose: () => void }) {
  const { engine, actions } = useGame();
  const owned = Math.floor(engine.getOwnedCount(def.id));
  const stats = formatItemStats(def);
  const entry = shop.items.find((i) => i.itemDefId === def.id);
  const list = tradeActions(engine, shop, mode, def, actions.refresh);
  const cantAfford = mode === "buy" && entry && engine.getMaxAffordableQuantity(entry.price) < 1;

  return (
    <Modal
      title={
        <span className="row" style={{ gap: 10 }}>
          <span className="inv-detail-icon">
            <ItemIcon def={def} size={36} />
          </span>
          <span className={RARITY_CLASS[def.rarity ?? "common"]}>{def.name}</span>
        </span>
      }
      onClose={onClose}
    >
      <div className="stack">
        <div className="row text-small">
          {mode === "buy" && entry && <span className="tag tag-gold">{formatAmounts(entry.price)} each</span>}
          {mode === "sell" && <span className="tag tag-gold">Pays {formatNumber(engine.getShopSellPrice(def.id))} GP each</span>}
          <span className="tag">You own {formatNumber(owned)}</span>
          {def.rarity && def.rarity !== "common" && <span className="tag">{def.rarity}</span>}
        </div>
        <p className="text-muted">{itemDescription(def)}</p>
        {stats && <p className="text-small">{stats}</p>}
        {def.healAmount && <p className="text-small">Heals {def.healAmount} HP.</p>}
        <div className="btn-row">
          <ActionButtons
            actions={list}
            // Selling the last one leaves nothing to look at.
            onDone={() => mode === "sell" && Math.floor(engine.getOwnedCount(def.id)) < 1 && onClose()}
          />
        </div>
        {/* A tooltip doesn't show on phones, so the reason is spelled out. */}
        {cantAfford && entry && <p className="text-warning text-small">You can't afford this yet. It costs {formatAmounts(entry.price)}.</p>}
      </div>
    </Modal>
  );
}

/**
 * A shop, opened from the town scene: the shopkeeper's greeting, your GP,
 * and Buy / Sell / Repair tabs. Items are inventory-style tiles with a
 * price tag; tap one for details, or right-click it for Buy 1/5/10/all.
 */
export default function ShopBrowsePanel({ shop, repairPanel }: { shop: ShopDefinition; repairPanel?: ReactNode }) {
  const { engine, state, actions } = useGame();
  const [tab, setTab] = useState<Tab>("buy");
  const [greeting] = useState(() =>
    shop.dialogue && shop.dialogue.length > 0 ? shop.dialogue[Math.floor(Math.random() * shop.dialogue.length)] : "Have a look around."
  );
  const [selected, setSelected] = useState<{ mode: Mode; id: string } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; mode: Mode; id: string } | null>(null);
  const closeDetails = useCallback(() => setSelected(null), []);
  const closeMenu = useCallback(() => setMenu(null), []);

  const tabs: { id: Tab; label: string }[] = [
    { id: "buy", label: "Buy" },
    ...(shop.buysItems ? [{ id: "sell" as const, label: "Sell" }] : []),
    ...(shop.repairs && repairPanel ? [{ id: "repair" as const, label: "Repair" }] : []),
  ];
  const selectedDef = selected ? getItemDef(selected.id) : undefined;
  const menuDef = menu ? getItemDef(menu.id) : undefined;
  const openMenu = (mode: Mode, id: string) => (e: MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, mode, id });
  };

  return (
    <div className="stack shop-view">
      <div className="shop-greeting">
        <span className="shop-keeper" aria-hidden="true">
          <GameImage src={enemyImagePath(shop.artName ?? shop.npcName, 100)} alt="" style={{ width: 34, height: 34 }} fallback={shop.npcName.charAt(0)} />
        </span>
        <div className="shop-bubble">
          <strong>{shop.npcName}</strong>
          <span>"{greeting}"</span>
        </div>
      </div>

      <div className="row row-between shop-bar">
        {tabs.length > 1 ? (
          <div className="segmented" role="tablist">
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" className="btn" aria-selected={tab === t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="section-title">For sale</span>
        )}
        <span className="shop-gp">
          <GpAmount amount={engine.getResourceAmount("gp")} />
        </span>
      </div>

      {tab === "buy" && (
        <div className="inv-grid">
          {shop.items.map((entry) => {
            const def = getItemDef(entry.itemDefId);
            if (!def) return null;
            return (
              <ItemTile
                key={def.id}
                def={def}
                price={shortPrice(entry.price)}
                priceShort={engine.getMaxAffordableQuantity(entry.price) < 1}
                onClick={() => setSelected({ mode: "buy", id: def.id })}
                onContextMenu={openMenu("buy", def.id)}
              />
            );
          })}
        </div>
      )}

      {tab === "sell" &&
        (() => {
          const sellable = sellableItems(engine, state);
          if (sellable.length === 0) return <EmptyState>You have nothing this shop will buy.</EmptyState>;
          return (
            <div className="inv-grid">
              {sellable.map(({ def, owned, unitPrice }) => (
                <ItemTile
                  key={def.id}
                  def={def}
                  quantity={owned}
                  price={<GpAmount amount={unitPrice} size={11} bare />}
                  onClick={() => setSelected({ mode: "sell", id: def.id })}
                  onContextMenu={openMenu("sell", def.id)}
                />
              ))}
            </div>
          );
        })()}

      {tab === "repair" && repairPanel}

      {menu && menuDef && (
        <QuickMenu x={menu.x} y={menu.y} onClose={closeMenu}>
          <ActionButtons actions={tradeActions(engine, shop, menu.mode, menuDef, actions.refresh)} inMenu onDone={closeMenu} />
          <button
            type="button"
            role="menuitem"
            className="btn"
            onClick={() => {
              setSelected({ mode: menu.mode, id: menu.id });
              closeMenu();
            }}
          >
            Details
          </button>
        </QuickMenu>
      )}

      {selected && selectedDef && <ShopItemDetails shop={shop} mode={selected.mode} def={selectedDef} onClose={closeDetails} />}
    </div>
  );
}
