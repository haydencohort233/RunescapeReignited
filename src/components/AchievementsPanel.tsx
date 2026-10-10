import { useState } from "react";
import { useGame } from "../engine/GameEngineContext";
import { ACHIEVEMENT_CATALOG } from "../content/achivements";
import { CONDITION_LABELS, formatReward } from "../content/display";
import { describeUnmetCondition } from "../engine/unlockConditions";
import { formatNumber } from "../engine/format";
import { achievementIconPath } from "../content/assetPaths";
import GameImage from "./GameImage";
import { Page } from "./ui/Page";

export default function AchievementsPanel() {
  const { engine, state } = useGame();
  const [hideCompleted, setHideCompleted] = useState(false);
  const achievementPoints = state.resources["achievement-points"]?.amount ?? 0;
  const earnedCount = ACHIEVEMENT_CATALOG.filter((a) => engine.isAchievementEarned(a.id)).length;

  // Claimable-but-unclaimed first (nothing to scroll for), then everything
  // else in catalog order. "Completed" for the hide toggle means claimed —
  // an earned-but-unclaimed achievement stays visible even when hiding
  // completed ones, since there's still an action waiting on it.
  const sorted = [...ACHIEVEMENT_CATALOG].sort((a, b) => {
    const aClaimable = engine.isAchievementEarned(a.id) && !engine.isAchievementClaimed(a.id);
    const bClaimable = engine.isAchievementEarned(b.id) && !engine.isAchievementClaimed(b.id);
    if (aClaimable === bClaimable) return 0;
    return aClaimable ? -1 : 1;
  });
  const visible = hideCompleted ? sorted.filter((a) => !engine.isAchievementClaimed(a.id)) : sorted;

  return (
    <Page title="Achievements" meta={`${earnedCount}/${ACHIEVEMENT_CATALOG.length} completed`}>
      <div className="row row-between text-muted">
        <span>{formatNumber(achievementPoints)} achievement points</span>
        <label>
          <input
            id="hide-completed-achievements"
            type="checkbox"
            checked={hideCompleted}
            onChange={(e) => setHideCompleted(e.target.checked)}
          />{" "}
          Hide claimed
        </label>
      </div>

      <div className="stack-sm">
        {visible.map((achievement) => {
          const earned = engine.isAchievementEarned(achievement.id);
          const claimed = engine.isAchievementClaimed(achievement.id);
          const progress = earned ? null : describeUnmetCondition(achievement.condition, state, CONDITION_LABELS);

          return (
            <div key={achievement.id} className={`card${earned && !claimed ? " is-highlight" : ""}`}>
              <div className="card-header">
                <span className="card-title">
                  <GameImage
                    src={achievementIconPath(achievement.id)}
                    alt=""
                    style={{ width: 24, height: 24, opacity: earned ? 1 : 0.4 }}
                    fallback={<span aria-hidden="true">{earned ? "🏆" : "🔒"}</span>}
                  />
                  <span>{achievement.name}</span>
                </span>
                {claimed ? (
                  <span className="tag tag-success">Claimed</span>
                ) : earned ? (
                  <span className="tag tag-gold">Ready to claim</span>
                ) : null}
              </div>
              <p className="text-muted">{achievement.description}</p>
              {achievement.reward && <p className="text-small">Reward: {formatReward(achievement.reward)}</p>}
              {progress && <p className="text-small text-info">{progress}</p>}
              {earned && !claimed && (
                <div className="btn-row">
                  <button type="button" className="btn btn-primary" onClick={() => engine.claimAchievementReward(achievement)}>
                    Claim reward
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Page>
  );
}
