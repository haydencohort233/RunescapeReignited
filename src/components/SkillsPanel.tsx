import { useGame } from "../engine/GameEngineContext";
import { SKILL_CATALOG } from "../content/skills";
import { getLevelProgress } from "../engine/xpCurve";
import { formatNumber } from "../engine/format";
import SkillProgress from "./SkillProgress";
import SkillView from "./SkillView";
import { Page } from "./ui/Page";

/** Every skill; click one for its own page (also reachable from the player
 *  sidebar and from items in the inventory). */
export default function SkillsPanel({
  selectedSkillId,
  onSelectSkill,
}: {
  selectedSkillId?: string;
  onSelectSkill: (skillId: string | undefined) => void;
}) {
  const { engine, state } = useGame();
  if (selectedSkillId) return <SkillView skillId={selectedSkillId} onBack={() => onSelectSkill(undefined)} />;

  return (
    <Page title="Skills" meta={`Total level ${formatNumber(state.statistics.totalLevel ?? 0)}`}>
      <div className="stack-sm">
        {SKILL_CATALOG.map((skill) => {
          const xp = engine.getSkillXp(skill.id);
          const progress = getLevelProgress(xp);
          return (
            <button key={skill.id} type="button" className="card skill-card" onClick={() => onSelectSkill(skill.id)}>
              <SkillProgress skillId={skill.id} label={skill.name} />
              <span className="text-faint text-small">
                {formatNumber(xp)} XP
                {progress.xpForThisLevel > 0 &&
                  ` · ${formatNumber(progress.xpForThisLevel - progress.xpIntoLevel)} to next level`}
              </span>
            </button>
          );
        })}
      </div>
    </Page>
  );
}
