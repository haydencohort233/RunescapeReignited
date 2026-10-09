import { useEffect, useRef, useState } from "react";
import { useGame } from "../engine/GameEngineContext";
import { getItemDef } from "../content/items";
import { formatNumber } from "../engine/format";
import { itemImagePath } from "../content/assetPaths";
import { preloadImages } from "../lib/imagePreloader";
import ItemActions from "./ItemActions";
import ItemIcon from "./ItemIcon";

const RARITY_COLOR: Record<string, string> = {
  common: "#333",
  uncommon: "#1a7a3a",
  rare: "#1a5fa8",
  legendary: "#b8860b",
};

export default function InventoryPanel() {
  const { engine, state } = useGame();
  const [openPanelId, setOpenPanelId] = useState<string | null>(null);
  const [quickMenu, setQuickMenu] = useState<{ instanceId: string; x: number; y: number } | null>(
    null
  );
  const quickMenuRef = useRef<HTMLDivElement | null>(null);

  // Closes the quick-menu on ANY click outside it — not just clicks inside
  // this panel. A bubble-based onClick on the section root (the old approach)
  // only catches clicks within this component's subtree; switching tabs,
  // clicking the navbar, etc. wouldn't have closed it. A document-level
  // listener catches all of those.
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

  const items = Object.values(state.inventory);

  // Fire every icon request in parallel as soon as the list is known,
  // rather than letting each <img> trigger its own fetch as it renders —
  // that staggered per-row fetching is what makes a big list pop in a
  // handful at a time. Keyed on the set of item ids so it re-runs when the
  // inventory actually changes, not on every render.
  const itemDefIds = items.map((i) => i.itemDefId).join(",");
  useEffect(() => {
    const paths = items
      .map((instance) => getItemDef(instance.itemDefId))
      .filter((def): def is NonNullable<typeof def> => !!def)
      .map((def) => itemImagePath(def.name, def.animated, def.assetFolder));
    void preloadImages(paths);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemDefIds]);

  return (
    <section style={{ maxWidth: 480, position: "relative" }}>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Inventory</h2>

      {items.length === 0 && <p style={{ fontSize: 13, color: "#888" }}>Nothing here yet.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((instance) => {
          const def = getItemDef(instance.itemDefId);
          if (!def) return null; // orphaned instance from removed content — skip rather than crash
          const equipped = engine.isEquipped(instance.instanceId);

          return (
            <div key={instance.instanceId}>
              <div
                onClick={() => {
                  setQuickMenu(null);
                  setOpenPanelId(openPanelId === instance.instanceId ? null : instance.instanceId);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setOpenPanelId(null);
                  setQuickMenu({ instanceId: instance.instanceId, x: e.clientX, y: e.clientY });
                }}
                style={{
                  border: "1px solid #ccc",
                  borderRadius: 6,
                  padding: 8,
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  color: RARITY_COLOR[def.rarity ?? "common"],
                }}
              >
                <span>
                  <ItemIcon def={def} /> {def.name}
                  {instance.quantity !== undefined && ` x${formatNumber(instance.quantity)}`}
                  {equipped && " (equipped)"}
                </span>
              </div>

              {openPanelId === instance.instanceId && (
                <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 8, marginTop: 2 }}>
                  <p style={{ fontSize: 13, color: "#666", marginTop: 0 }}>
                    {def.description}
                    {def.stats && Object.keys(def.stats).length > 0 && (
                      <span>
                        {" ("}
                        {Object.entries(def.stats)
                          .map(([s, v]) => `${s}: ${v >= 0 ? "+" : ""}${v}`)
                          .join(", ")}
                        {")"}
                      </span>
                    )}
                  </p>
                  <ItemActions
                    def={def}
                    instanceId={instance.instanceId}
                    equipped={equipped}
                    onAction={() => setOpenPanelId(null)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {quickMenu &&
        (() => {
          const instance = state.inventory[quickMenu.instanceId];
          const def = instance ? getItemDef(instance.itemDefId) : undefined;
          if (!instance || !def) return null;
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
              <ItemActions
                def={def}
                instanceId={instance.instanceId}
                equipped={engine.isEquipped(instance.instanceId)}
                onAction={() => setQuickMenu(null)}
              />
            </div>
          );
        })()}
    </section>
  );
}