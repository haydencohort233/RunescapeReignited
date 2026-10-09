import { useState } from "react";
import { useGame } from "../engine/GameEngineContext";
import { ACHIEVEMENT_CATALOG } from "../content/achivements";
import { describeUnmetCondition } from "../engine/unlockConditions";
import { formatNumber } from "../engine/format";
import { achievementIconPath } from "../content/assetPaths";
import GameImage from "./GameImage";

function formatReward(reward: (typeof ACHIEVEMENT_CATALOG)[number]["reward"]): string {
  if (!reward) return "";
  const parts: string[] = [];
  if (reward.gp) parts.push(`${reward.gp} GP`);
  if (reward.achievementPoints) parts.push(`${reward.achievementPoints} Achievement Points`);
  if (reward.items) {
    for (const item of reward.items) parts.push(`${item.quantity}x ${item.itemDefId}`);
  }
  return parts.join(", ");
}

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
    <section style={{ maxWidth: 480 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Achievements</h2>
        <span style={{ fontSize: 13, color: "#666" }}>
          {earnedCount}/{ACHIEVEMENT_CATALOG.length} Completed
        </span>
      </div>
      <p style={{ fontSize: 13, color: "#666" }}>Achievement Points: {formatNumber(achievementPoints)}</p>

      <label style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={hideCompleted}
          onChange={(e) => setHideCompleted(e.target.checked)}
        />{" "}
        Hide Completed Achievements
      </label>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((achievement) => {
          const earned = engine.isAchievementEarned(achievement.id);
          const claimed = engine.isAchievementClaimed(achievement.id);
          const unmetReason = earned ? null : describeUnmetCondition(achievement.condition, state);

          return (
            <div
              key={achievement.id}
              style={{
                border: "1px solid " + (earned ? "#d4af37" : "#ddd"),
                background: earned ? "#fff8e1" : undefined,
                borderRadius: 6,
                padding: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <GameImage
                    src={achievementIconPath(achievement.id)}
                    alt={achievement.name}
                    style={{ width: 24, height: 24, opacity: earned ? 1 : 0.4 }}
                    fallback={<span style={{ fontSize: 16 }}>{earned ? "🏆" : "🔒"}</span>}
                  />
                  {achievement.name}
                </strong>
                {earned && !claimed && (
                  <button onClick={() => engine.claimAchievementReward(achievement)}>Claim</button>
                )}
                {claimed && <span style={{ fontSize: 12, color: "#888" }}>Claimed ✓</span>}
              </div>
              <p style={{ fontSize: 13, color: "#666", margin: "4px 0" }}>{achievement.description}</p>
              {achievement.reward && (
                <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
                  Reward: {formatReward(achievement.reward)}
                </p>
              )}
              {!earned && unmetReason && (
                <p style={{ fontSize: 12, color: "#b91c1c", margin: "4px 0 0" }}>{unmetReason}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}