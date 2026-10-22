import { useEffect, useState, type ReactNode } from "react";
import { setPreferences, usePreferences } from "../lib/preferences";
import { useGame } from "../engine/GameEngineContext";
import type { GameEngine } from "../engine/gameEngine";
import type { GameState } from "../engine/types";
import { SKILL_CATALOG } from "../content/skills";
import { getResourceMeta } from "../content/resources";
import { getLocation } from "../content/mapLocations";
import { getLevelProgress, MAX_LEVEL } from "../engine/xpCurve";
import { activityLabel } from "../content/display";
import { GpAmount, SkillIcon } from "./ui/GameIcons";
import { formatNumber } from "../engine/format";
import HpBar from "./HpBar";
import GameImage from "./GameImage";
import { enemyImagePath } from "../content/assetPaths";

/** The player's portrait (assets/npcs/adventurer), or a plain silhouette
 *  in theme colors until it loads. */
function Avatar() {
  return (
    <span className="avatar" role="img" aria-label="Player avatar">
      <GameImage
        src={enemyImagePath("Adventurer", 100)}
        alt=""
        style={{ width: "100%", height: "100%" }}
        fallback={
          <svg viewBox="0 0 64 64" aria-hidden="true" style={{ width: "100%", height: "100%" }}>
            <circle cx="32" cy="24" r="12" />
            <path d="M10 60c0-13 10-21 22-21s22 8 22 21z" />
          </svg>
        }
      />
    </span>
  );
}

/** "+1.50/s", or nothing for a resource that isn't being produced. */
function rateText(rate: number): string {
  return rate > 0 ? `+${rate.toFixed(2)}/s` : "";
}

/** Where gold comes from: each producing building, then any modifier
 *  that scales it. */
function GoldBreakdown({ engine, state }: { engine: GameEngine; state: GameState }) {
  const sources = engine.content.buildings
    .filter((b) => b.resource === "gp" && engine.getBuildingQuantity(b.id) > 0)
    .map((b) => ({ id: b.id, name: b.name, count: engine.getBuildingQuantity(b.id), rate: b.baseRatePerSecond * engine.getBuildingQuantity(b.id) }));
  const modifiers = Object.values(state.modifiers).filter((m) => m.target === "gp" || m.target === "all");

  return (
    <div className="sidebar-breakdown text-small">
      {sources.length === 0 && <span className="text-faint">No gold income yet.</span>}
      {sources.map((s) => (
        <div key={s.id} className="data-row">
          <span>
            {s.name} <span className="text-faint">x{s.count}</span>
          </span>
          <span>+{s.rate.toFixed(2)}/s</span>
        </div>
      ))}
      {modifiers.map((m) => (
        <div key={m.id} className="data-row">
          <span className={m.source === "debuff" ? "text-danger" : "text-success"}>{m.label}</span>
          <span>{m.type === "multiplicative" ? `x${m.value}` : `${m.value >= 0 ? "+" : ""}${m.value}/s`}</span>
        </div>
      ))}
    </div>
  );
}

/** A sidebar section whose title folds it away; remembered per browser. */
function FoldSection({ id, title, summary, children }: { id: string; title: string; summary?: string; children: ReactNode }) {
  const { collapsedSections } = usePreferences();
  const open = !collapsedSections.includes(id);
  return (
    <div className="stack-sm">
      <button
        type="button"
        className="sidebar-fold"
        aria-expanded={open}
        onClick={() =>
          setPreferences({ collapsedSections: open ? [...collapsedSections, id] : collapsedSections.filter((s) => s !== id) })
        }
      >
        <h3 className="section-title">{title}</h3>
        <span className="text-faint text-small">
          {!open && summary} {open ? "▾" : "▸"}
        </span>
      </button>
      {open && children}
    </div>
  );
}

/** The right-hand player summary on wide screens (and the drawer the top
 *  bar opens on phones): who you are, health, gold, resources, and every
 *  skill. Clicking a skill opens it. */
export default function PlayerSidebar({ onOpenSkill }: { onOpenSkill: (skillId: string) => void }) {
  const { engine, state } = useGame();
  const [showGold, setShowGold] = useState(false);

  const gpRate = engine.getEffectiveRatePerSecond("gp");
  const materials = Object.entries(state.resources)
    .map(([id, r]) => ({ id, amount: r.amount, meta: getResourceMeta(id), rate: engine.getEffectiveRatePerSecond(id) }))
    .filter(({ id, meta, amount, rate }) => id !== "gp" && meta.category !== "item" && (amount >= 1 || rate > 0));

  return (
    <div className="sidebar-body">
      <div className="sidebar-identity">
        <Avatar />
        <div className="stack-sm">
          <span className="sidebar-name">Adventurer</span>
          <span className="text-faint text-small">
            Combat {engine.getCombatLevel()} · Total {formatNumber(state.statistics.totalLevel ?? 0)}
          </span>
          <span className="text-faint text-small row" style={{ gap: 4 }}>
            {state.activeAction && (state.activeAction.kind === "craft" || state.activeAction.kind === "gather") && (
              <SkillIcon skillId={state.activeAction.skill} size={14} />
            )}
            {state.activeAction ? activityLabel(state.activeAction) : `At ${getLocation(state.currentLocationId)?.name ?? "?"}`}
          </span>
        </div>
      </div>

      <HpBar current={engine.getCurrentHp()} max={engine.getMaxHp()} label="Health" />

      <div className="stack-sm">
        <button
          type="button"
          className="sidebar-gold"
          aria-expanded={showGold}
          onClick={() => setShowGold((v) => !v)}
          title="Where your gold comes from"
        >
          <span className="text-gold">
            <GpAmount amount={engine.getResourceAmount("gp")} size={18} />
          </span>
          <span className="text-muted text-small">
            {rateText(gpRate)} {showGold ? "▾" : "▸"}
          </span>
        </button>
        {showGold && <GoldBreakdown engine={engine} state={state} />}
      </div>

      {/* Everything you hold that isn't an item (those are in Inventory).
          On phones this is what the top bar opens, so it's labelled. */}
      <FoldSection id="resources" title="Resources" summary={materials.length > 0 ? `${materials.length}` : undefined}>
        {materials.length === 0 && <span className="text-faint text-small">Nothing yet. Gather something or buy a building.</span>}
        <div>
          {materials.map(({ id, amount, meta, rate }) => (
            <div key={id} className="data-row text-small">
              <span>{meta.name}</span>
              <span>
                {formatNumber(amount)}
                {rate > 0 && <span className="text-faint"> {rateText(rate)}</span>}
              </span>
            </div>
          ))}
        </div>
      </FoldSection>

      <FoldSection id="skills" title="Skills" summary={`Total ${formatNumber(state.statistics.totalLevel ?? 0)}`}>
        <div className="sidebar-skills">
          {SKILL_CATALOG.map((skill) => {
            const progress = getLevelProgress(engine.getSkillXp(skill.id));
            const maxed = progress.level >= MAX_LEVEL;
            return (
              <button
                key={skill.id}
                type="button"
                className="sidebar-skill"
                onClick={() => onOpenSkill(skill.id)}
                title={maxed ? `${skill.name}: max level` : `${skill.name}: ${Math.round(progress.percent * 100)}% to level ${progress.level + 1}`}
              >
                <span className="row row-between">
                  <span className="row" style={{ gap: 6 }}>
                    <SkillIcon skillId={skill.id} size={16} />
                    {skill.name}
                  </span>
                  <span className="sidebar-skill-level">{progress.level}</span>
                </span>
                <span className="progress-track">
                  <span className="progress-fill" style={{ width: `${maxed ? 100 : progress.percent * 100}%` }} />
                </span>
              </button>
            );
          })}
        </div>
      </FoldSection>
    </div>
  );
}

/** The always-visible essentials on narrow screens, where there's no room
 *  for the full sidebar: health, gold and combat level. On phones it opens
 *  the player drawer (status, skills, and the other tabs). */
export function PlayerStrip({ onOpen, alert = false }: { onOpen?: () => void; alert?: boolean }) {
  const { engine } = useGame();
  const gpRate = engine.getEffectiveRatePerSecond("gp");
  const body = (
    <>
      <div className="row row-between text-small">
        <span className="text-gold">
          <GpAmount amount={engine.getResourceAmount("gp")} /> <span className="text-faint">{rateText(gpRate)}</span>
        </span>
        <span className="text-faint">
          Combat {engine.getCombatLevel()}
          {onOpen && (
            <span className={`strip-menu${alert ? " has-dot" : ""}`} aria-hidden="true">
              {" "}
              ☰
            </span>
          )}
        </span>
      </div>
      <HpBar current={engine.getCurrentHp()} max={engine.getMaxHp()} label="Health" />
    </>
  );
  if (!onOpen) return <div className="player-strip card">{body}</div>;
  return (
    <button type="button" className="player-strip card is-button" onClick={onOpen} aria-label="Open player menu">
      {body}
    </button>
  );
}

/** Phones: player status and skills in a drawer that slides in from the
 *  left, with Statistics, Achievements and Settings as icons in its
 *  header. */
export function PlayerDrawer({
  open,
  onClose,
  onOpenSkill,
  onOpenView,
  alerts,
}: {
  open: boolean;
  onClose: () => void;
  onOpenSkill: (skillId: string) => void;
  onOpenView: (view: "statistics" | "achievements" | "settings") => void;
  alerts?: { achievements?: boolean };
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const views = [
    { id: "statistics", icon: "📊", label: "Statistics" },
    { id: "achievements", icon: "🏆", label: "Achievements" },
    { id: "settings", icon: "⚙️", label: "Settings" },
  ] as const;

  return (
    <div className={`drawer-root${open ? " is-open" : ""}`} aria-hidden={!open}>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" aria-label="Player" role="dialog" aria-modal="true">
        <div className="drawer-header">
          <span className="app-title drawer-title">Idle Engine</span>
          <span className="row" style={{ gap: 2 }}>
            {views.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`btn btn-ghost drawer-icon${v.id === "achievements" && alerts?.achievements ? " has-dot" : ""}`}
                title={v.label}
                aria-label={v.label}
                tabIndex={open ? 0 : -1}
                onClick={() => {
                  onOpenView(v.id);
                  onClose();
                }}
              >
                {v.icon}
              </button>
            ))}
            <button type="button" className="btn btn-ghost drawer-icon" aria-label="Close" tabIndex={open ? 0 : -1} onClick={onClose}>
              ✕
            </button>
          </span>
        </div>
        {open && (
          <PlayerSidebar
            onOpenSkill={(id) => {
              onOpenSkill(id);
              onClose();
            }}
          />
        )}
      </aside>
    </div>
  );
}
