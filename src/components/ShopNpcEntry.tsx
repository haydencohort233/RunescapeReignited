import { useEffect, useRef, useState } from "react";
import { useGame } from "../engine/GameEngineContext";
import type { ShopDefinition } from "../content/shops";

/** The clickable NPC line at a location that has a shop. Click opens an
 *  inline Talk/Browse Shop panel; right-click opens the same options as a
 *  floating quick-menu — same dual pattern InventoryPanel uses for items. */
export default function ShopNpcEntry({
  shop,
  onBrowse,
}: {
  shop: ShopDefinition;
  onBrowse: () => void;
}) {
  const { engine } = useGame();
  const [panelOpen, setPanelOpen] = useState(false);
  const [quickMenuPos, setQuickMenuPos] = useState<{ x: number; y: number } | null>(null);
  const quickMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!quickMenuPos) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (quickMenuRef.current && !quickMenuRef.current.contains(e.target as Node)) {
        setQuickMenuPos(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [quickMenuPos]);

  const actions = (
    <>
      <button
        onClick={() => {
          engine.notifications.push("status", `${shop.npcName} has nothing to say right now.`);
          setPanelOpen(false);
          setQuickMenuPos(null);
        }}
        style={{ textAlign: "left" }}
      >
        Talk
      </button>
      <button
        onClick={() => {
          onBrowse();
          setPanelOpen(false);
          setQuickMenuPos(null);
        }}
        style={{ textAlign: "left" }}
      >
        Browse Shop
      </button>
    </>
  );

  return (
    <div style={{ marginTop: 8 }}>
      <div
        onClick={() => {
          setQuickMenuPos(null);
          setPanelOpen((open) => !open);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setPanelOpen(false);
          setQuickMenuPos({ x: e.clientX, y: e.clientY });
        }}
        style={{
          border: "1px solid #ccc",
          borderRadius: 6,
          padding: 8,
          cursor: "pointer",
        }}
      >
        🧑 {shop.npcName} — {shop.title}
      </div>

      {panelOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>{actions}</div>
      )}

      {quickMenuPos && (
        <div
          ref={quickMenuRef}
          style={{
            position: "fixed",
            left: quickMenuPos.x,
            top: quickMenuPos.y,
            background: "white",
            border: "1px solid #999",
            borderRadius: 4,
            padding: 4,
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}