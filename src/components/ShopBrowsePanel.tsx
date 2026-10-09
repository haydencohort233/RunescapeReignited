import { useEffect, useRef, useState } from "react";
import { useGame } from "../engine/GameEngineContext";
import type { ShopDefinition, ShopItem } from "../content/shops";
import { getItemDef } from "../content/items";
import { formatNumber } from "../engine/format";
import ItemIcon from "./ItemIcon";

function ShopItemBuyActions({ shop, shopItem }: { shop: ShopDefinition; shopItem: ShopItem }) {
  const { engine } = useGame();
  const def = getItemDef(shopItem.itemDefId);
  if (!def) return null;

  const buy = (quantity: number) => {
    if (quantity <= 0) return;
    engine.buyFromShop(shop.locationId, def.id, shopItem.price, quantity, {
      stackable: def.stackable,
      itemName: def.name,
    });
  };

  const maxAffordable = engine.getMaxAffordableQuantity(shopItem.price);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <button onClick={() => buy(1)} style={{ textAlign: "left" }}>
        Buy 1
      </button>
      <button onClick={() => buy(5)} style={{ textAlign: "left" }}>
        Buy 5
      </button>
      <button onClick={() => buy(10)} style={{ textAlign: "left" }}>
        Buy 10
      </button>
      <button onClick={() => buy(maxAffordable)} disabled={maxAffordable === 0} style={{ textAlign: "left" }}>
        Buy All ({maxAffordable})
      </button>
    </div>
  );
}

export default function ShopBrowsePanel({ shop, onClose }: { shop: ShopDefinition; onClose: () => void }) {
  const [openPanelId, setOpenPanelId] = useState<string | null>(null);
  const [quickMenu, setQuickMenu] = useState<{ itemDefId: string; x: number; y: number } | null>(null);
  const quickMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!quickMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (quickMenuRef.current && !quickMenuRef.current.contains(e.target as Node)) {
        setQuickMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [quickMenu]);

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 10, marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>{shop.title}</strong>
        <button onClick={onClose}>Close Shop</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
        {shop.items.map((shopItem) => {
          const def = getItemDef(shopItem.itemDefId);
          if (!def) return null;
          const priceText = shopItem.price
            .map((p) => `${formatNumber(p.amount)} ${p.resource}`)
            .join(", ");

          return (
            <div key={shopItem.itemDefId}>
              <div
                onClick={() => {
                  setQuickMenu(null);
                  setOpenPanelId(openPanelId === shopItem.itemDefId ? null : shopItem.itemDefId);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setOpenPanelId(null);
                  setQuickMenu({ itemDefId: shopItem.itemDefId, x: e.clientX, y: e.clientY });
                }}
                style={{
                  border: "1px solid #ccc",
                  borderRadius: 6,
                  padding: 8,
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>
                  <ItemIcon def={def} size={24} /> {def.name}
                </span>
                <span style={{ fontSize: 13, color: "#666" }}>{priceText}</span>
              </div>

              {openPanelId === shopItem.itemDefId && (
                <div style={{ border: "1px solid #eee", borderRadius: 6, padding: 8, marginTop: 2 }}>
                  <p style={{ fontSize: 13, color: "#666", marginTop: 0 }}>{def.description}</p>
                  <ShopItemBuyActions shop={shop} shopItem={shopItem} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {quickMenu &&
        (() => {
          const shopItem = shop.items.find((i) => i.itemDefId === quickMenu.itemDefId);
          if (!shopItem) return null;
          return (
            <div
              ref={quickMenuRef}
              style={{
                position: "fixed",
                left: quickMenu.x,
                top: quickMenu.y,
                background: "white",
                border: "1px solid #999",
                borderRadius: 4,
                padding: 4,
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                zIndex: 1000,
              }}
            >
              <ShopItemBuyActions shop={shop} shopItem={shopItem} />
            </div>
          );
        })()}
    </div>
  );
}