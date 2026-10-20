import type { RefObject } from "react";
import type { AwaySummary } from "../engine/awaySummary";
import { formatDuration, formatNumber, formatXp } from "../engine/format";
import { skillName } from "../content/display";
import { getEnemy } from "../content/enemies";
import { ItemChip, SkillIcon } from "./ui/GameIcons";

/** Long lists stop here, with "and N more". */
const MAX_CHIPS = 12;

function Chips({ list }: { list: { id: string; amount: number }[] }) {
  const shown = list.slice(0, MAX_CHIPS);
  return (
    <div className="away-chips">
      {shown.map((i) => (
        <ItemChip key={i.id} id={i.id} amount={i.amount} size={18} />
      ))}
      {list.length > shown.length && <span className="text-faint text-small">and {list.length - shown.length} more</span>}
    </div>
  );
}

/** The "While you were away" popup: how long, XP and levels by skill,
 *  what was gained and used up, kills, and whether the activity stopped. */
export function AwaySummaryView({
  summary,
  onClose,
  primaryRef,
}: {
  summary: AwaySummary;
  onClose: () => void;
  primaryRef: RefObject<HTMLButtonElement | null>;
}) {
  const capped = summary.countedMs < summary.awayMs;
  return (
    <div className="away">
      <p className="away-kicker">While you were away</p>
      <h3 className="away-time">{formatDuration(summary.awayMs)}</h3>
      {capped && <p className="away-note">Only {formatDuration(summary.countedMs)} counted (the offline limit).</p>}

      <div className="away-body">
        {summary.skills.length > 0 && (
          <section className="away-section">
            <h4>Experience</h4>
            <ul className="away-skills">
              {summary.skills.map((s) => (
                <li key={s.skillId}>
                  <SkillIcon skillId={s.skillId} size={18} />
                  <span className="away-skill-name">{skillName(s.skillId)}</span>
                  {s.toLevel > s.fromLevel && (
                    <span className="away-level">
                      Lv {s.fromLevel} → {s.toLevel}
                    </span>
                  )}
                  <span className="away-xp">+{formatXp(s.xp)} XP</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {summary.gained.length > 0 && (
          <section className="away-section">
            <h4>Gained</h4>
            <Chips list={summary.gained} />
          </section>
        )}

        {summary.spent.length > 0 && (
          <section className="away-section is-spent">
            <h4>Used up</h4>
            <Chips list={summary.spent} />
          </section>
        )}

        {summary.kills.length > 0 && (
          <section className="away-section">
            <h4>Defeated</h4>
            <p className="away-kills">
              {summary.kills.map((k) => `${formatNumber(k.count)} ${getEnemy(k.enemyId)?.name ?? k.enemyId}`).join(", ")}
            </p>
          </section>
        )}

        {summary.deaths > 0 && (
          <p className="away-warn">
            You died{summary.deaths > 1 ? ` ${summary.deaths} times` : ""}.
          </p>
        )}
        {summary.stopped && <p className="away-warn">Your activity has finished or stopped. You're idle now.</p>}
      </div>

      <button ref={primaryRef} type="button" className="btn btn-primary" onClick={onClose}>
        Continue
      </button>
    </div>
  );
}
