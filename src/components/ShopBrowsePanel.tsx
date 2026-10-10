import { useGame } from "../engine/GameEngineContext";
import type { ShopDefinition, ShopItem } from "../content/shops";
import { getItemDef, ITEM_CATALOG } from "../content/items";
import { formatAmounts } from "../content/display";
import { formatNumber } from "../engine/format";
import ItemIcon from "./ItemIcon";
import { ActionCard } from "./ui/ActionCard";
import { quantityActions } from "./ui/quantity";
import { EmptyState, Section } from "./ui/Page";

function ShopItemCard({ shop, shopItem }: { shop: ShopDefinition; shopItem: ShopItem }) {
  const { engine } = useGame();
  const def = getItemDef(shopItem.itemDefId);
  if (!def) return null;
  const affordable = engine.getMaxAffordableQuantity(shopItem.price);
  return (
    <ActionCard
      icon={<ItemIcon def={def} size={24} />}
      title={def.name}
      meta={formatAmounts(shopItem.price)}
      description={def.description}
      actions={quantityActions(
        "Buy",
        affordable,
        (q) => engine.buyFromShop(shop.locationId, def.id, shopItem.price, q),
        `Not enough to pay ${formatAmounts(shopItem.price)} each`
      )}
    />
  );
}

/** Everything the player could sell here: owned (and not worn) items with
 *  a value. */
function ShopSellList({ shop }: { shop: ShopDefinition }) {
  const { engine, state } = useGame();
  // Only count what's actually owned; calling getOwnedCount for every item
  // in the catalog would scan the inventory once per catalog entry.
  const ownedIds = new Set(Object.values(state.inventory).map((i) => i.itemDefId));
  for (const [id, r] of Object.entries(state.resources)) if (r.amount >= 1) ownedIds.add(id);
  const sellable = ITEM_CATALOG.filter((def) => ownedIds.has(def.id))
    .map((def) => ({ def, owned: Math.floor(engine.getOwnedCount(def.id)), unitPrice: engine.getShopSellPrice(def.id) }))
    .filter((e) => e.owned > 0 && e.unitPrice > 0);

  if (sellable.length === 0) return <EmptyState>You have nothing this shop will buy.</EmptyState>;

  return (
    <div className="stack-sm">
      {sellable.map(({ def, owned, unitPrice }) => (
        <ActionCard
          key={def.id}
          icon={<ItemIcon def={def} size={24} />}
          title={`${def.name} x${formatNumber(owned)}`}
          meta={`${formatNumber(unitPrice)} GP each`}
          actions={quantityActions("Sell", owned, (q) => engine.sellToShop(shop.locationId, def.id, q), "You don't have that many")}
        />
      ))}
    </div>
  );
}

/** A shop's stock and (if it buys) the player's sellable items. Shown
 *  inside the shop's card on the Home tab. */
export default function ShopBrowsePanel({ shop }: { shop: ShopDefinition }) {
  return (
    <div className="stack">
      <Section title="Buy">
        <div className="stack-sm">
          {shop.items.map((shopItem) => (
            <ShopItemCard key={shopItem.itemDefId} shop={shop} shopItem={shopItem} />
          ))}
        </div>
      </Section>
      {shop.buysItems && (
        <Section title="Sell">
          <ShopSellList shop={shop} />
        </Section>
      )}
    </div>
  );
}
