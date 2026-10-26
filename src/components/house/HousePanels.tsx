import { useEffect, useRef, useState, type ReactNode } from "react";
import { useGame } from "../../engine/GameEngineContext";
import type { FurnitureDefinition, HouseArea, HouseLookSlot, RoomCosmetic } from "../../engine/types";
import { areasOf } from "../../engine/systems/house";
import { formatDuration, formatXp } from "../../engine/format";
import { FURNITURE_CATALOG, PATH_CATALOG } from "../../content/house";
import { ItemChip } from "../ui/GameIcons";
import { FurnitureIcon } from "./houseParts";
import { ServantBody } from "./ServantPanel";
import { HouseRanking, MyHouseShare, VisitByCode } from "./SharePanel";
import { PANEL_TABS, type PaintTool, type PanelTab } from "./panelTabs";

// The house's panels (decided Oct 25): Build, Storage, Scenery, Houses and
// Servant. HouseView places them: a left bar and a bottom bar on wide
// screens; on phones, a panel always under the scene, with Houses behind
// the globe.

/** What the panels need from the house screen. */
export interface PanelContext {
  area: HouseArea;
  paint: PaintTool;
  onPaint: (tool: PaintTool) => void;
  /** Start putting a stored piece down. */
  onPlace: (uid: string, def: FurnitureDefinition) => void;
}

/** A panel with its own tabs, showing one at a time. */
export function HousePanel({ tabs, ctx, className = "", tab, onTab, horizontal = false }: { tabs: PanelTab[]; ctx: PanelContext; className?: string; tab?: PanelTab; onTab?: (t: PanelTab) => void; horizontal?: boolean }) {
  const [own, setOwn] = useState<PanelTab>(tabs[0]);
  const current = tab ?? own;
  const shown = tabs.includes(current) ? current : tabs[0];
  const pick = onTab ?? setOwn;
  return (
    <section className={`house-panel ${className}`}>
      {tabs.length > 1 && (
        <div className="house-panel-tabs" role="tablist">
          {PANEL_TABS.filter((t) => tabs.includes(t.id)).map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={t.id === shown} className={`house-panel-tab${t.id === shown ? " is-active" : ""}`} onClick={() => pick(t.id)}>
              <span aria-hidden="true">{t.id === "houses" ? "🌐" : t.icon}</span> {t.label}
            </button>
          ))}
        </div>
      )}
      <div className="house-panel-body">
        <PanelBody tab={shown} ctx={ctx} horizontal={horizontal} />
      </div>
    </section>
  );
}

export function PanelBody({ tab, ctx, horizontal = false }: { tab: PanelTab; ctx: PanelContext; horizontal?: boolean }) {
  switch (tab) {
    case "build":
      return <BuildCatalog ctx={ctx} />;
    case "storage":
      return <StorageList ctx={ctx} horizontal={horizontal} />;
    case "scenery":
      return <Scenery ctx={ctx} />;
    case "houses":
      return <Houses />;
    case "servant":
      return (
        <ScrollArea className={horizontal ? "is-wide-servant" : ""}>
          <ServantBody />
        </ScrollArea>
      );
  }
}

/**
 * A scrolling area that looks scrollable: a themed scrollbar, plus up and
 * down arrows that show while there's more that way.
 */
export function ScrollArea({ children, className = "", innerRef, horizontal = false }: { children: ReactNode; className?: string; innerRef?: (el: HTMLDivElement | null) => void; horizontal?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [more, setMore] = useState({ back: false, forward: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      const pos = horizontal ? el.scrollLeft : el.scrollTop;
      const max = horizontal ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight;
      setMore({ back: pos > 2, forward: pos < max - 2 });
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      el.removeEventListener("scroll", check);
      ro.disconnect();
    };
  });
  const step = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    if (horizontal) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
    else el.scrollBy({ top: dir * el.clientHeight * 0.5, behavior: "smooth" });
  };
  return (
    <div className={`scroll-area${horizontal ? " is-horizontal" : ""} ${className}`}>
      <div
        className="scroll-area-inner"
        ref={(el) => {
          ref.current = el;
          innerRef?.(el);
        }}
      >
        {children}
      </div>
      {more.back && (
        <button type="button" className="scroll-arrow is-back" aria-label={horizontal ? "Scroll left" : "Scroll up"} onClick={() => step(-1)}>
          {horizontal ? "◀" : "▲"}
        </button>
      )}
      {more.forward && (
        <button type="button" className="scroll-arrow is-forward" aria-label={horizontal ? "Scroll right" : "Scroll down"} onClick={() => step(1)}>
          {horizontal ? "▶" : "▼"}
        </button>
      )}
    </div>
  );
}

// ── Build ──

interface Category {
  id: string;
  label: string;
  icon: string;
  filter: (f: FurnitureDefinition) => boolean;
}

/** Catalog categories for where you are (inside or the yard). */
function categoriesFor(area: HouseArea): Category[] {
  const here = (f: FurnitureDefinition) => areasOf(f).includes(area);
  if (area === "yard") {
    return [
      { id: "garden", label: "Garden", icon: "🌳", filter: (f) => here(f) && f.kind === "furniture" },
      { id: "facilities", label: "Facilities", icon: "⚒️", filter: (f) => here(f) && f.kind === "facility" },
    ];
  }
  return [
    { id: "furniture", label: "Furniture", icon: "🪑", filter: (f) => here(f) && f.kind === "furniture" && f.slot === "floor" && !f.offlineCapBonusMs },
    { id: "facilities", label: "Facilities", icon: "⚒️", filter: (f) => here(f) && f.kind === "facility" },
    { id: "beds", label: "Beds", icon: "🛏️", filter: (f) => here(f) && !!f.offlineCapBonusMs },
    { id: "wall", label: "Wall", icon: "🖼️", filter: (f) => here(f) && f.slot === "wall" },
    { id: "surface", label: "Tabletop", icon: "🕯️", filter: (f) => here(f) && f.slot === "surface" },
    { id: "rugs", label: "Rugs", icon: "🧶", filter: (f) => here(f) && f.slot === "rug" },
  ];
}

/** The build in progress, with Finish now (dev) and Cancel. */
function BuildProgress() {
  const { engine, state, actions } = useGame();
  const build = state.house.build;
  const def = build ? engine.getFurnitureDef(build.furnitureId) : undefined;
  if (!build || !def) return null;
  const left = Math.max(0, build.startedAt + build.durationMs - engine.now());
  return (
    <div className="build-progress">
      <FurnitureIcon def={def} size={22} />
      <div className="build-progress-main">
        <span className="text-small">
          Building <strong>{def.name}</strong> · {formatDuration(left)}
        </span>
        <span className="build-progress-bar">
          <span style={{ width: `${Math.min(100, (1 - left / Math.max(1, build.durationMs)) * 100)}%` }} />
        </span>
      </div>
      <button
        type="button"
        className="btn btn-small"
        title="Dev tool for now: skips the time. Later a paid speed-up."
        onClick={() => {
          engine.devSkipTime(left + 1000);
          actions.refresh();
        }}
      >
        ⚡
      </button>
      <button
        type="button"
        className="btn btn-small btn-danger"
        title="Stop building and get the materials back"
        onClick={() => {
          engine.cancelFurnitureBuild();
          actions.refresh();
        }}
      >
        ✕
      </button>
    </div>
  );
}

/**
 * Everything you can build here: square category tiles (All first), then
 * every category's cards in one scrolling list. Picking a tile scrolls to
 * its section; scrolling lights up the section you're in.
 */
function BuildCatalog({ ctx }: { ctx: PanelContext }) {
  const { engine } = useGame();
  const cats = categoriesFor(ctx.area).map((c) => ({ ...c, items: FURNITURE_CATALOG.filter(c.filter).sort((a, b) => a.levelRequired - b.levelRequired) })).filter((c) => c.items.length > 0);
  const [active, setActive] = useState("all");
  const scroller = useRef<HTMLDivElement | null>(null);
  const sections = useRef(new Map<string, HTMLElement>());

  // Light up the section at the top of the list while scrolling.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop < 4) return setActive("all");
      const top = el.getBoundingClientRect().top;
      let current = "all";
      for (const [id, sec] of sections.current) if (sec.getBoundingClientRect().top - top <= 24) current = id;
      setActive(current);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [ctx.area]);

  const jump = (id: string) => {
    const el = scroller.current;
    if (!el) return;
    if (id === "all") el.scrollTo({ top: 0, behavior: "smooth" });
    else {
      const sec = sections.current.get(id);
      if (sec) el.scrollTo({ top: sec.offsetTop - el.offsetTop, behavior: "smooth" });
    }
    setActive(id);
  };

  return (
    <div className="build-catalog">
      <BuildProgress />
      {!engine.isAtHouse() && <p className="text-small text-warning">You're away from your house portal: you can look, but not build.</p>}
      <div className="cat-tiles" role="tablist" aria-label="Categories">
        {[{ id: "all", label: "All", icon: "✦" }, ...cats].map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={active === c.id} className={`cat-tile${active === c.id ? " is-active" : ""}`} onClick={() => jump(c.id)} title={c.label}>
            <span className="cat-tile-icon" aria-hidden="true">
              {c.icon}
            </span>
            <span className="cat-tile-label">{c.label}</span>
          </button>
        ))}
      </div>
      <ScrollArea className="build-scroll" innerRef={(el) => (scroller.current = el)}>
        {cats.map((c) => (
          <section
            key={c.id}
            className="build-section"
            ref={(el) => {
              if (el) sections.current.set(c.id, el);
              else sections.current.delete(c.id);
            }}
          >
            <h4 className="build-section-title">{c.label}</h4>
            <div className="build-cards">
              {c.items.map((def) => (
                <CatalogCard key={def.id} def={def} onPlace={ctx.onPlace} />
              ))}
            </div>
          </section>
        ))}
      </ScrollArea>
    </div>
  );
}

/** One piece in the catalog: build it, or place one you have. */
function CatalogCard({ def, onPlace }: { def: FurnitureDefinition; onPlace: (uid: string, def: FurnitureDefinition) => void }) {
  const { engine, state, actions } = useGame();
  const stored = state.house.storage.filter((s) => s.furnitureId === def.id);
  const building = state.house.build?.furnitureId === def.id;
  const locked = engine.getSkillLevel("construction") < def.levelRequired;
  const blocker = engine.getFurnitureBuildBlocker(def.id);
  const atHouse = engine.isAtHouse();
  const place = () => stored[0] && onPlace(stored[0].uid, def);
  const size = def.slot === "surface" ? "Tabletop" : `${def.width}x${def.depth}`;

  return (
    <div className={`build-card${locked ? " is-locked" : ""}${stored.length > 0 ? " is-ready" : ""}`} title={def.description}>
      <button type="button" className="build-card-art" disabled={stored.length === 0 || !atHouse} onClick={place} aria-label={stored.length > 0 ? `Place ${def.name}` : def.name}>
        <FurnitureIcon def={def} size={40} />
        {stored.length > 0 && <span className="build-card-count">x{stored.length}</span>}
      </button>
      <strong className="build-card-name">{def.name}</strong>
      <span className="build-card-meta">{locked ? `Level ${def.levelRequired}` : `${formatDuration(def.buildTimeMs).replace(/ 0s$/, "")} · ${formatXp(def.xp)} XP · ${size}`}</span>
      {!locked && (
        <span className="build-card-cost">
          {def.cost.map((c) => (
            <ItemChip key={c.resource} id={c.resource} amount={c.amount} size={14} />
          ))}
        </span>
      )}
      <div className="build-card-actions">
        {stored.length > 0 && (
          <button type="button" className="btn btn-primary btn-small" disabled={!atHouse} onClick={place}>
            Place
          </button>
        )}
        {building ? (
          <span className="text-small text-muted">Building</span>
        ) : (
          !locked && (
            <button
              type="button"
              className="btn btn-small"
              disabled={!!blocker}
              title={blocker ?? `Build a ${def.name}`}
              onClick={() => {
                engine.startFurnitureBuild(def.id);
                actions.refresh();
              }}
            >
              Build
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ── Storage ──

/** Built pieces waiting to be placed, grouped, with how many. In the
 *  bottom bar it runs sideways. */
function StorageList({ ctx, horizontal }: { ctx: PanelContext; horizontal: boolean }) {
  const { engine, state } = useGame();
  const groups = new Map<string, string[]>();
  for (const s of state.house.storage) groups.set(s.furnitureId, [...(groups.get(s.furnitureId) ?? []), s.uid]);
  const atHouse = engine.isAtHouse();
  const used = `${engine.getHouseStorageUsed()}/${engine.getHouseStorageCapacity()}`;
  if (groups.size === 0) return <p className="text-small text-muted">Storage {used}: empty. Build something, or store a piece from the house.</p>;
  return (
    <ScrollArea horizontal={horizontal} className="storage-scroll">
      <ul className={`storage-list${horizontal ? " is-horizontal" : ""}`} aria-label={`Storage, ${used} slots used`}>
        {[...groups].map(([furnitureId, uids]) => {
          const def = engine.getFurnitureDef(furnitureId);
          if (!def) return null;
          const fits = areasOf(def).includes(ctx.area);
          return (
            <li key={furnitureId}>
              <button type="button" className="storage-row" disabled={!atHouse || !fits} onClick={() => ctx.onPlace(uids[0], def)} title={fits ? `Place ${def.name}` : ctx.area === "yard" ? "Goes inside" : "Goes outside"}>
                <FurnitureIcon def={def} size={32} />
                <span className="storage-name">{def.name}</span>
                {uids.length > 1 && <span className="build-card-count is-inline">x{uids.length}</span>}
                <span className="storage-hint text-small">{fits ? "Place" : ctx.area === "yard" ? "Inside" : "Outside"}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}

// ── Scenery: looks, weather, paths ──

const LOOK_SLOTS: Record<HouseArea, { slot: HouseLookSlot; label: string }[]> = {
  inside: [
    { slot: "wallpaper", label: "Walls" },
    { slot: "floor", label: "Floor" },
  ],
  yard: [
    { slot: "front", label: "House front" },
    { slot: "roof", label: "Roof" },
    { slot: "ground", label: "Ground" },
    { slot: "sky", label: "Sky" },
  ],
};

function Scenery({ ctx }: { ctx: PanelContext }) {
  const { engine, state, actions } = useGame();
  const layout = state.house.layout;
  const atHouse = engine.isAtHouse();
  const current: Record<HouseLookSlot, string> = {
    wallpaper: layout.wallpaperId,
    floor: layout.floorId,
    front: layout.frontId,
    roof: layout.roofId,
    ground: layout.groundId,
    sky: layout.skyId,
  };
  return (
    <ScrollArea>
      <div className="stack-sm">
        <div className="build-looks">
          {LOOK_SLOTS[ctx.area].map(({ slot, label }) => (
            <div key={slot} className="build-look-row">
              <span className="build-look-label text-small">{label}</span>
              <div className="build-swatches">
                {engine.getHouseLooks(slot).map((look: RoomCosmetic) => (
                  <button
                    key={look.id}
                    type="button"
                    className={`build-swatch${current[slot] === look.id ? " is-active" : ""}`}
                    disabled={!atHouse}
                    onClick={() => {
                      engine.setHouseLook(slot, look.id);
                      actions.refresh();
                    }}
                    title={look.name}
                  >
                    <span className="build-swatch-chip" style={{ background: `linear-gradient(135deg, ${look.colors[0]} 55%, ${look.colors[1]} 55%)` }} />
                    <span className="build-swatch-name">{look.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {ctx.area === "yard" && (
          <>
            <label className="row row-between setting-row">
              <span>
                Weather <span className="text-faint text-small">· follows the ground</span>
              </span>
              <input
                type="checkbox"
                checked={layout.weather !== "off"}
                disabled={!atHouse}
                onChange={(e) => {
                  engine.setHouseWeather(e.target.checked ? "auto" : "off");
                  actions.refresh();
                }}
              />
            </label>
            <PathPainter paint={ctx.paint} onPaint={ctx.onPaint} />
          </>
        )}
        {ctx.area === "inside" && <p className="text-small text-muted">Go outside for the house front, roof, ground, sky, weather and paths.</p>}
      </div>
    </ScrollArea>
  );
}

/** Pick a path style (or Clear), then tap or drag across the yard. */
function PathPainter({ paint, onPaint }: { paint: PaintTool; onPaint: (tool: PaintTool) => void }) {
  const { engine, state } = useGame();
  return (
    <div className="stack-sm">
      <span className="build-look-label text-small">Paths</span>
      <span className="text-small text-muted">Pick one, then tap or drag across the yard. {state.house.layout.paths.length} tiles laid. Clearing gives materials back.</span>
      <div className="build-swatches">
        {PATH_CATALOG.map((p) => {
          const locked = engine.getSkillLevel("construction") < p.levelRequired;
          const on = paint?.kind === "path" && paint.pathId === p.id;
          return (
            <button key={p.id} type="button" className={`build-swatch${on ? " is-active" : ""}`} disabled={locked} onClick={() => onPaint(on ? null : { kind: "path", pathId: p.id })} title={locked ? `Construction level ${p.levelRequired}` : p.name}>
              <span className="build-swatch-chip" style={{ background: p.colors[0], borderColor: p.colors[1] }} />
              <span className="build-swatch-name">{p.name}</span>
              <span className="build-card-cost">
                {locked ? (
                  <span className="tag">Level {p.levelRequired}</span>
                ) : p.cost.length === 0 ? (
                  <span className="text-small text-muted">Free</span>
                ) : (
                  p.cost.map((c) => <ItemChip key={c.resource} id={c.resource} amount={c.amount} size={14} />)
                )}
              </span>
            </button>
          );
        })}
        <button type="button" className={`build-swatch${paint?.kind === "erase" ? " is-active" : ""}`} onClick={() => onPaint(paint?.kind === "erase" ? null : { kind: "erase" })}>
          <span className="build-swatch-chip is-eraser" />
          <span className="build-swatch-name">Clear</span>
        </button>
      </div>
    </div>
  );
}

// ── Houses ──

function Houses() {
  const { engine } = useGame();
  const [sub, setSub] = useState<"mine" | "all" | "week" | "code">("mine");
  const subs = [
    { id: "mine", label: "My house" },
    { id: "all", label: "Most liked" },
    { id: "week", label: "This week" },
    { id: "code", label: "By code" },
  ] as const;
  if (!engine.isAtHouse()) return <p className="text-small text-muted">Go to your house portal to share your house or visit others.</p>;
  return (
    <div className="houses-panel">
      <div className="build-tabs" role="tablist">
        {subs.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={s.id === sub} className={`build-tab${s.id === sub ? " is-active" : ""}`} onClick={() => setSub(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      <ScrollArea>
        {sub === "mine" && <MyHouseShare />}
        {sub === "all" && <HouseRanking period="all" />}
        {sub === "week" && <HouseRanking period="week" />}
        {sub === "code" && <VisitByCode />}
      </ScrollArea>
    </div>
  );
}
