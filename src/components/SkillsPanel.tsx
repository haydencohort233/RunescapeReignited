import { useGame } from "../engine/GameEngineContext";
import { SKILL_CATALOG } from "../content/skills";
import { getLevelProgress } from "../engine/xpCurve";
import SkillProgress from "./SkillProgress";

export default function SkillsPanel() {
  const { engine } = useGame();

  return (
    <section style={{ maxWidth: 480 }}>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Skills</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {SKILL_CATALOG.map((skill) => {
          const xp = engine.getSkillXp(skill.id);
          const progress = getLevelProgress(xp);
          return (
            <div key={skill.id}>
              <SkillProgress skillId={skill.id} label={skill.name} />
              <div style={{ fontSize: 12, color: "#888" }}>
                {xp.toLocaleString()} xp
                {progress.xpForThisLevel > 0 &&
                  ` — ${(progress.xpForThisLevel - progress.xpIntoLevel).toLocaleString()} to next level`}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}