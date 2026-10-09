import { useGame } from "../engine/GameEngineContext";
import { getLevelProgress, MAX_LEVEL } from "../engine/xpCurve";
import { skillIconPath } from "../content/assetPaths";
import GameImage from "./GameImage";

/** Compact single-skill display — level, XP, and a progress bar toward the
 *  next level. Meant to be dropped inline near whatever's training that
 *  skill (e.g. the Fletching crafting section), not just the full Skills tab. */
export default function SkillProgress({ skillId, label }: { skillId: string; label: string }) {
  const { engine } = useGame();
  const xp = engine.getSkillXp(skillId);
  const progress = getLevelProgress(xp);

  return (
    <div style={{ fontSize: 13, maxWidth: 220 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <GameImage
            src={skillIconPath(skillId)}
            alt={label}
            style={{ width: 16, height: 16 }}
            fallback={<span style={{ width: 16, height: 16, display: "inline-block" }} />}
          />
          {label}: level {progress.level}
        </span>
        {progress.level < MAX_LEVEL && (
          <span style={{ color: "#666" }}>{Math.round(progress.percent * 100)}%</span>
        )}
      </div>
      <div style={{ background: "#eee", borderRadius: 4, height: 6, overflow: "hidden" }}>
        <div
          style={{
            width: `${progress.percent * 100}%`,
            background: "#4b8",
            height: "100%",
          }}
        />
      </div>
    </div>
  );
}