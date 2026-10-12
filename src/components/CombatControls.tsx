import { useGame } from "../engine/GameEngineContext";
import { getActiveCombat } from "../engine/activeAction";
import { resolveCombatStyle, stylesFor } from "../engine/combatStyles";
import { getSpecialAttack } from "../engine/specialAttacks";
import { calculateMaxHit } from "../engine/combatMath";
import { getEquipmentBonuses } from "../content/combatStats";
import { SPELL_CATALOG, getSpell } from "../content/spells";
import { formatAmounts } from "../content/display";
import type { AttackStyle } from "../engine/types";

const STYLE_LABEL: Record<AttackStyle, string> = { melee: "Melee", ranged: "Ranged", magic: "Magic" };

/** Special attack energy, and (in a fight with a spec weapon) the button
 *  that arms it for the next swing. */
export function SpecialAttackBar({ showButton = true }: { showButton?: boolean }) {
  const { engine, state, actions } = useGame();
  const gear = getEquipmentBonuses(state);
  const session = getActiveCombat(state);
  const spec = getSpecialAttack(session?.specialAttackId ?? gear.specialAttack);
  const energy = Math.floor(state.specialEnergy);
  const armed = !!session?.specArmed;

  return (
    <div className="stack-sm">
      <div className="row row-between text-small">
        <span>
          Special attack{spec ? `: ${spec.name} (${spec.cost}%)` : ""}
          {armed && <span className="text-warning"> · armed</span>}
        </span>
        <span>{energy}%</span>
      </div>
      <div className={`progress-track spec-bar${armed ? " is-armed" : ""}`}>
        <div className="progress-fill" style={{ width: `${energy}%` }} />
      </div>
      {spec && <span className="text-faint text-small">{spec.description}</span>}
      {!spec && <span className="text-faint text-small">Your weapon has no special attack.</span>}
      {showButton && session && spec && (
        <div className="btn-row">
          <button
            type="button"
            className={`btn${armed ? " btn-primary" : ""}`}
            aria-pressed={armed}
            disabled={!armed && energy < spec.cost}
            title={!armed && energy < spec.cost ? `Needs ${spec.cost}% energy` : undefined}
            onClick={() => {
              engine.toggleSpecialAttack();
              actions.refresh();
            }}
          >
            {armed ? "Cancel special" : "Special attack"}
          </button>
        </div>
      )}
    </div>
  );
}

/** The combat style picker for the worn weapon's attack style. */
export function CombatStylePicker() {
  const { engine, state, actions } = useGame();
  const attackStyle = getEquipmentBonuses(state).attackStyle;
  const current = resolveCombatStyle(attackStyle, state.combatStyles[attackStyle]);
  return (
    <div className="stack-sm">
      <span className="text-small">{STYLE_LABEL[attackStyle]} style</span>
      <div className="segmented">
        {stylesFor(attackStyle).map((style) => (
          <button
            key={style.id}
            type="button"
            className="btn"
            aria-pressed={style.id === current.id}
            title={style.description}
            onClick={() => {
              engine.setCombatStyle(attackStyle, style.id);
              actions.refresh();
            }}
          >
            {style.name}
          </button>
        ))}
      </div>
      <span className="text-faint text-small">{current.description}</span>
    </div>
  );
}

/** Which spell a magic weapon casts. Locked in when a fight starts, so
 *  it's greyed out mid-fight. */
export function SpellPicker({ locked = false }: { locked?: boolean }) {
  const { engine, state, actions } = useGame();
  const gear = getEquipmentBonuses(state);
  const magic = engine.getSkillLevel("magic");
  const spell = getSpell(state.selectedSpellId);
  return (
    <div className="stack-sm">
      <label className="text-small" htmlFor="spell-select">
        Spell
      </label>
      <select
        id="spell-select"
        className="spell-select"
        disabled={locked}
        title={locked ? "Your spell is locked in until the fight ends" : undefined}
        value={state.selectedSpellId ?? ""}
        onChange={(e) => {
          engine.selectSpell(e.target.value);
          actions.refresh();
        }}
      >
        <option value="" disabled>
          Pick a spell
        </option>
        {SPELL_CATALOG.map((s) => (
          <option key={s.id} value={s.id} disabled={magic < s.levelRequired}>
            {s.name} (lvl {s.levelRequired}, max hit {s.maxHit})
          </option>
        ))}
      </select>
      {spell && (
        <span className="text-faint text-small">
          Each cast: {formatAmounts(spell.runes.filter((r) => !gear.infiniteRunes.includes(r.resource)), " + ") || "free"}
          {spell.runes.some((r) => gear.infiniteRunes.includes(r.resource)) && " (your staff covers the rest)"}
        </span>
      )}
    </div>
  );
}

/** Accuracy and damage at a glance for what's worn and the chosen style. */
export function CombatStats() {
  const { engine, state } = useGame();
  const gear = getEquipmentBonuses(state);
  const style = resolveCombatStyle(gear.attackStyle, state.combatStyles[gear.attackStyle]);
  const bonus = (skill: string) => style.levelBonus[skill] ?? 0;

  let maxHit: number;
  if (gear.attackStyle === "magic") maxHit = getSpell(state.selectedSpellId)?.maxHit ?? 0;
  else if (gear.attackStyle === "ranged")
    maxHit = calculateMaxHit({ level: engine.getSkillLevel("ranged") + bonus("ranged"), bonus: gear.rangedStrength });
  else maxHit = calculateMaxHit({ level: engine.getSkillLevel("strength") + bonus("strength"), bonus: gear.strength });

  const rows: [string, string][] = [
    ["Fighting with", STYLE_LABEL[gear.attackStyle]],
    ["Max hit", String(maxHit)],
    ["Attack speed", `${(Math.max(600, (gear.attackSpeedMs ?? 4000) - (style.speedBonusMs ?? 0)) / 1000).toFixed(1)}s`],
    ["Attack bonus", `+${gear.attack}`],
    ["Strength bonus", `+${gear.strength}`],
    ["Defence bonus", `+${gear.defence}`],
    ["Ranged bonus", `+${gear.ranged}`],
    ["Ranged strength", `+${gear.rangedStrength}`],
    ["Magic bonus", `+${gear.magic}`],
  ];
  return (
    <div className="stat-grid text-small">
      {rows.map(([label, value]) => (
        <div key={label} className="data-row">
          <span>{label}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
}
