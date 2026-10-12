import { useEffect, useRef, useState } from "react";
import { useGame } from "../engine/GameEngineContext";
import { getEnemy } from "../content/enemies";
import { getActiveCombat } from "../engine/activeAction";
import { ITEM_CATALOG, getItemDef } from "../content/items";
import { confirmAndStartCombat } from "../engine/actionHelpers";
import { ActionCard } from "./ui/ActionCard";
import { getEquipmentBonuses } from "../content/combatStats";
import { enemyImagePath } from "../content/assetPaths";
import HpBar from "./HpBar";
import Hitsplat from "./Hitsplat";
import GameImage from "./GameImage";
import { SpecialAttackBar } from "./CombatControls";
import { getSpell } from "../content/spells";
import { formatAmounts, WEAKNESS_LABEL } from "../content/display";
import { npcCombatLevel } from "../engine/combatMath";

interface ActiveSplat {
  id: string;
  side: "player" | "enemy"; // which HP bar this floats over
  outcome: "miss" | "block" | "hit" | "bleed";
  damage: number;
}

const SPLAT_COLOR: Record<ActiveSplat["outcome"], string> = {
  hit: "var(--splat-hit)", // red — real damage, matches OSRS
  block: "var(--splat-block)", // blue — landed but rolled 0
  miss: "var(--splat-miss)", // gray — didn't land at all
  bleed: "var(--splat-bleed)", // crimson — the target bleeding
};

/** The fight card for a combatEncounter amenity. Collapsed like every other
 *  card until clicked; held open while you're fighting this enemy. Combat
 *  resolves on the engine's own tick — this only reflects it and offers
 *  Attack Now and Flee. */
export default function CombatPanel({ enemyId, inDungeon = false }: { enemyId: string; inDungeon?: boolean }) {
  const { engine, state, actions } = useGame();
  const [splats, setSplats] = useState<ActiveSplat[]>([]);
  const [keepFighting, setKeepFighting] = useState(false);
  const lastLogCountRef = useRef(0);
  const splatTimersRef = useRef(new Set<number>());
  const enemy = getEnemy(enemyId);

  const session = getActiveCombat(state);

  // Spawns a hitsplat for every log entry that's new since the last render.
  // "attacker: player" means the PLAYER dealt it, so it floats over the
  // ENEMY's bar (and vice versa) — same as OSRS showing a splat on whoever
  // got hit, not whoever swung. The log itself is capped at 20 entries, so
  // its length stops changing; logCount keeps counting.
  const logCount = session ? (session.logCount ?? session.log.length) : 0;
  useEffect(() => {
    if (!session) {
      lastLogCountRef.current = 0;
      return;
    }
    const newCount = Math.min(logCount - lastLogCountRef.current, session.log.length);
    lastLogCountRef.current = logCount;
    if (newCount <= 0) return;
    const newEntries = session.log.slice(-newCount);

    const newSplats: ActiveSplat[] = newEntries.map((entry, i) => ({
      id: `${entry.timestamp}-${logCount}-${i}`,
      side: entry.attacker === "player" ? "enemy" : "player",
      outcome: entry.outcome,
      damage: entry.damage,
    }));
    setSplats((prev) => [...prev, ...newSplats]);

    // Not cleared when the next batch arrives: each batch removes itself
    // after its own animation. (Cancelling it on re-run left splats stuck
    // whenever two attacks landed within a second.)
    const timer = window.setTimeout(() => {
      splatTimersRef.current.delete(timer);
      setSplats((prev) => prev.filter((s) => !newSplats.some((n) => n.id === s.id)));
    }, 1000);
    splatTimersRef.current.add(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logCount]);

  useEffect(() => {
    const timers = splatTimersRef.current;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  if (!enemy) return null;

  // A dungeon wave is shown by the dungeon's card, not the overworld one
  // for the same enemy.
  const fightingThisEnemy = session?.enemyId === enemyId && !!session.dungeonId === inDungeon;
  const bossTag = enemy.isBoss ? <span className="tag tag-gold">Boss</span> : null;
  const title = (
    <>
      ⚔️ {enemy.name} <span className="text-muted">(Level {npcCombatLevel(enemy)})</span> {bossTag}
    </>
  );
  // What the player can learn about the enemy before and during a fight.
  const enemyInfo = (
    <span className="row text-small" style={{ gap: 6 }}>
      <span className="tag">Max HP {enemy.maxHp}</span>
      {enemy.weakness && <span className="tag tag-info">Weak to {WEAKNESS_LABEL[enemy.weakness]}</span>}
      {enemy.canFlee === false && <span className="tag tag-danger">No fleeing</span>}
    </span>
  );

  // Food counts whether it's in the inventory or worn in the food slot.
  const foods = ITEM_CATALOG.filter((def) => def.healAmount && engine.getFoodCount(def.id) >= 1);
  const foodOptions = foods.map((def) => (
    <option key={def.id} value={def.id}>
      {def.name} (x{Math.floor(engine.getFoodCount(def.id))})
    </option>
  ));
  const gear = getEquipmentBonuses(state);
  // The worn food first (Melvor-style preloading), else last fight's food.
  const rememberedFood =
    gear.foodItemId ?? (foods.some((def) => def.id === state.lastCombatFoodId) ? state.lastCombatFoodId! : "");
  // Picking food equips it to the food slot, so the Equipment tab agrees.
  const pickFood = (itemDefId: string) => {
    const def = itemDefId ? getItemDef(itemDefId) : undefined;
    if (def?.equipSlot === "food") engine.equipItem(def);
    else if (!itemDefId && state.equipment.food) engine.unequipSlot("food");
    engine.setCombatFood(itemDefId);
    actions.refresh();
  };
  const supplies =
    gear.attackStyle === "ranged"
      ? gear.ammoItemId
        ? `${getItemDef(gear.ammoItemId)?.name ?? "Arrows"}: ${Math.floor(engine.getResourceAmount(gear.ammoItemId))} left`
        : "No arrows equipped"
      : gear.attackStyle === "magic"
        ? (() => {
            const spell = getSpell(state.selectedSpellId);
            if (!spell) return "No spell picked";
            const runes = spell.runes.filter((r) => !gear.infiniteRunes.includes(r.resource));
            return `Casting ${spell.name}${runes.length ? ` (${formatAmounts(runes, " + ")} each)` : ""}`;
          })()
        : null;

  if (!fightingThisEnemy || !session) {
    const noHp = engine.getCurrentHp() <= 0;
    return (
      <ActionCard
        title={title}
        meta={enemy.weakness ? `Weak to ${WEAKNESS_LABEL[enemy.weakness]}` : `Max HP ${enemy.maxHp}`}
        description={
          <span className="stack-sm">
            {enemyInfo}
            <span className="text-small">
              Your gear is locked once the fight starts. Set it up in the Equipment tab first.
              {supplies && <> {supplies}.</>}
            </span>
          </span>
        }
        actions={[
          {
            label: "Fight",
            variant: "primary",
            disabled: noHp,
            reason: "Heal before fighting",
            onClick: () =>
              confirmAndStartCombat(engine, enemy, getEquipmentBonuses(state), {
                autoRepeat: keepFighting,
                autoEatItemId: rememberedFood || undefined,
              }),
          },
        ]}
      >
        <div className="row text-muted">
          <label>
            <input
              id={`keep-fighting-${enemy.id}`}
              type="checkbox"
              checked={keepFighting}
              onChange={(e) => setKeepFighting(e.target.checked)}
            />{" "}
            Keep fighting
          </label>
          <label>
            Auto-eat{" "}
            <select id={`auto-eat-${enemy.id}`} value={rememberedFood} onChange={(e) => pickFood(e.target.value)}>
              <option value="">None</option>
              {foodOptions}
            </select>
          </label>
        </div>
      </ActionCard>
    );
  }

  const now = Date.now();
  const nextPlayerAttackSeconds = Math.max(
    0,
    Math.ceil((session.playerStartedAt + (session.playerAttacksResolved + 1) * session.playerAttackSpeedMs - now) / 1000)
  );
  const nextEnemyAttackSeconds = Math.max(
    0,
    Math.ceil((session.enemyStartedAt + (session.enemyAttacksResolved + 1) * session.enemyAttackSpeedMs - now) / 1000)
  );

  const renderSplats = (side: "player" | "enemy") =>
    splats
      .filter((s) => s.side === side)
      .map((s, i) => <Hitsplat key={s.id} outcome={s.outcome} damage={s.damage} offsetIndex={i} />);

  const autoEatName = session.autoEatItemId ? getItemDef(session.autoEatItemId)?.name : undefined;
  // The food the Eat button uses: auto-eat's, else last picked, else any.
  const selectedFood = session.autoEatItemId && foods.some((d) => d.id === session.autoEatItemId)
    ? session.autoEatItemId
    : rememberedFood || foods[0]?.id || "";

  return (
    <ActionCard
      className="is-active"
      open
      title={title}
      meta={
        session.autoRepeat
          ? `${session.kills} defeated this trip${autoEatName ? ` · eating ${autoEatName}` : ""}`
          : "Fighting"
      }
      actions={[
        {
          label: "Attack now",
          variant: "primary",
          disabled: !!session.outOfSupplies,
          reason: "You have nothing to attack with",
          onClick: () => {
            engine.attackNow();
            actions.refresh();
          },
        },
        {
          label: selectedFood ? `Eat ${getItemDef(selectedFood)?.name ?? ""}` : "Eat",
          disabled: !selectedFood,
          reason: "You have no food",
          onClick: () => {
            engine.setCombatFood(selectedFood);
            engine.eatItem(selectedFood);
          },
        },
        {
          label: "Flee",
          disabled: !session.canFlee || engine.getCurrentHp() <= 0,
          reason: session.canFlee ? "You're out of HP" : `You can't flee from ${session.enemyName}`,
          onClick: () => engine.fleeCombat(),
        },
      ]}
    >
      <div className="combat-portrait">
        <GameImage
          src={enemyImagePath(
            session.enemyName,
            session.enemyMaxHp > 0 ? (session.enemyCurrentHp / session.enemyMaxHp) * 100 : 0,
            enemy.degradeStages
          )}
          alt={session.enemyName}
          style={{ width: 96, height: 96 }}
          fallback={<div className="combat-portrait-fallback">⚔️</div>}
        />
      </div>

      <div className="stack">
        <div className="splat-anchor">
          {renderSplats("player")}
          <HpBar current={engine.getCurrentHp()} max={engine.getMaxHp()} label="You" />
        </div>
        <div className="splat-anchor">
          {renderSplats("enemy")}
          <HpBar current={session.enemyCurrentHp} max={session.enemyMaxHp} label={session.enemyName} />
        </div>
      </div>

      <div className="row text-muted">
        <label>
          Food{" "}
          <select
            id={`combat-food-${enemy.id}`}
            value={selectedFood}
            disabled={foods.length === 0}
            onChange={(e) => pickFood(e.target.value)}
          >
            {foods.length === 0 && <option value="">None left</option>}
            {foodOptions}
          </select>
        </label>
        <label>
          <input
            id={`combat-auto-eat-${enemy.id}`}
            type="checkbox"
            checked={!!session.autoEatItemId}
            disabled={!selectedFood}
            onChange={(e) => {
              if (e.target.checked) engine.setCombatFood(selectedFood);
              engine.setAutoEat(e.target.checked);
              actions.refresh();
            }}
          />{" "}
          Auto-eat
        </label>
      </div>

      {enemyInfo}
      {session.outOfSupplies && (
        <p className="combat-alert text-small">
          Out of {session.attackStyle === "magic" ? "runes" : "arrows"}: you can't attack.{" "}
          {session.canFlee ? "Flee, or keep eating to hold on." : "There's no fleeing this fight."}
        </p>
      )}
      {session.specialAttackId && <SpecialAttackBar />}
      {supplies && <p className="text-muted text-small">{supplies}</p>}

      <p className="text-muted text-small">
        Your next attack in {nextPlayerAttackSeconds}s (every {(session.playerAttackSpeedMs / 1000).toFixed(1)}s) ·{" "}
        {session.enemyName} in {nextEnemyAttackSeconds}s (every {(session.enemyAttackSpeedMs / 1000).toFixed(1)}s)
      </p>

      {/* Compact log, newest first. */}
      <div className="combat-log">
        {session.log.length === 0 && <span className="text-faint">No attacks yet.</span>}
        {session.log.map((entry, i) => (
          <div key={i} className="combat-log-row">
            <span className={entry.attacker === "player" ? "text-info" : "text-danger"}>
              {entry.attacker === "player" ? "You" : "Foe"}
            </span>
            <span style={{ color: SPLAT_COLOR[entry.outcome] }}>
              {entry.outcome === "miss"
                ? "miss"
                : entry.outcome === "block"
                  ? "block"
                  : entry.outcome === "bleed"
                    ? `bleed ${entry.damage}`
                    : `hit ${entry.damage}`}
              {entry.special && " (special)"}
            </span>
          </div>
        ))}
      </div>
    </ActionCard>
  );
}
