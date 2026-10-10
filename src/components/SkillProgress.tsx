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
    <div className="stack-sm text-small" style={{ maxWidth: 260 }}>
      <div className="row row-between">
        <span className="row" style={{ gap: 4 }}>
          <GameImage
            src={skillIconPath(skillId)}
            alt={label}
            style={{ width: 20, height: 20 }}
            fallback={<span style={{ width: 20, height: 20, display: "inline-block" }} />}
          />
          <span>
            {label}: level {progress.level}
          </span>
        </span>
        {progress.level < MAX_LEVEL && <span className="text-faint">{Math.round(progress.percent * 100)}%</span>}
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress.percent * 100}%` }} />
      </div>
    </div>
  );
}
