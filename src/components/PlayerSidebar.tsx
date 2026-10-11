import { useState } from "react";
import { useGame } from "../engine/GameEngineContext";
import type { GameEngine } from "../engine/gameEngine";
import type { GameState } from "../engine/types";
import { SKILL_CATALOG } from "../content/skills";
import { getResourceMeta } from "../content/resources";
import { getLocation } from "../content/mapLocations";
import { getLevelProgress, MAX_LEVEL } from "../engine/xpCurve";
import { activityLabel } from "../content/display";
import { SkillIcon } from "./ui/GameIcons";
import { formatNumber } from "../engine/format";
import HpBar from "./HpBar";

/** Placeholder until avatars exist: a plain silhouette in theme colors. */
function Avatar() {
  return (
    <svg className="avatar" viewBox="0 0 64 64" role="img" aria-label="Player avatar">
      <circle cx="32" cy="24" r="12" />
      <path d="M10 60c0-13 10-21 22-21s22 8 22 21z" />
    </svg>
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

/** The right-hand player summary on wide screens: who you are, health,
 *  gold and materials, and every skill. Clicking a skill opens it. */
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
          <span className="text-gold">{formatNumber(engine.getResourceAmount("gp"))} GP</span>
          <span className="text-muted text-small">
            {rateText(gpRate)} {showGold ? "▾" : "▸"}
          </span>
        </button>
        {showGold && <GoldBreakdown engine={engine} state={state} />}
      </div>

      {materials.length > 0 && (
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
      )}

      <div className="stack-sm">
        <h3 className="section-title">Skills</h3>
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
      </div>
    </div>
  );
}

/** The always-visible essentials on narrow screens, where there's no room
 *  for the full sidebar: health, gold and combat level. */
export function PlayerStrip() {
  const { engine } = useGame();
  const gpRate = engine.getEffectiveRatePerSecond("gp");
  return (
    <div className="player-strip card">
      <div className="row row-between text-small">
        <span className="text-gold">
          {formatNumber(engine.getResourceAmount("gp"))} GP <span className="text-faint">{rateText(gpRate)}</span>
        </span>
        <span className="text-faint">Combat {engine.getCombatLevel()}</span>
      </div>
      <HpBar current={engine.getCurrentHp()} max={engine.getMaxHp()} label="Health" />
    </div>
  );
}
