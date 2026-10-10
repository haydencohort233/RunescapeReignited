import { useGame } from "../engine/GameEngineContext";
import { SKILL_CATALOG } from "../content/skills";
import { getLevelProgress } from "../engine/xpCurve";
import { formatNumber } from "../engine/format";
import SkillProgress from "./SkillProgress";
import { Page } from "./ui/Page";

export default function SkillsPanel() {
  const { engine, state } = useGame();
  return (
    <Page title="Skills" meta={`Total level ${formatNumber(state.statistics.totalLevel ?? 0)}`}>
      <div className="stack-sm">
        {SKILL_CATALOG.map((skill) => {
          const xp = engine.getSkillXp(skill.id);
          const progress = getLevelProgress(xp);
          return (
            <div key={skill.id} className="card">
              <SkillProgress skillId={skill.id} label={skill.name} />
              <span className="text-faint text-small">
                {formatNumber(xp)} XP
                {progress.xpForThisLevel > 0 &&
                  ` · ${formatNumber(progress.xpForThisLevel - progress.xpIntoLevel)} to next level`}
              </span>
            </div>
          );
        })}
      </div>
    </Page>
  );
}
