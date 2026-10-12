import { useState } from "react";
import { useGame } from "../engine/GameEngineContext";
import { getDungeon } from "../content/dungeons";
import { getEnemy } from "../content/enemies";
import { getItemDef } from "../content/items";
import { AMENITY_ICON } from "../content/amenities";
import { CONDITION_LABELS, dungeonDescription, enemyLabel, itemName } from "../content/display";
import { getEquipmentBonuses } from "../content/combatStats";
import { describeUnmetCondition } from "../engine/unlockConditions";
import { getActiveCombat } from "../engine/activeAction";
import type { DungeonDefinition, LoadoutEntry } from "../engine/types";
import { ActionCard, LockedCard } from "./ui/ActionCard";
import ItemIcon from "./ItemIcon";
import HpBar from "./HpBar";
import CombatPanel from "./CombatPanel";
import LoadoutPicker from "./LoadoutPicker";

/** "Goblin (Level 6)" for a wave or the boss, by stage index. */
function stageLabel(dungeon: DungeonDefinition, stage: number): string {
  const id = stage < dungeon.waves.length ? dungeon.waves[stage] : dungeon.bossId;
  const enemy = getEnemy(id);
  if (!enemy) return id;
  return stage < dungeon.waves.length ? enemyLabel(enemy) : `${enemyLabel(enemy)}, the boss`;
}

/** The saved loadout as small chips, with the worn food. */
function LoadoutSummary({ loadout, slots }: { loadout: LoadoutEntry[]; slots: number }) {
  const { state } = useGame();
  const food = getEquipmentBonuses(state).foodItemId;
  const foodDef = food ? getItemDef(food) : undefined;
  return (
    <div className="stack-sm">
      <span className="text-small">
        Loadout {loadout.length}/{slots}
        {foodDef && (
          <span className="text-faint">
            {" "}
            · plus your food: {foodDef.name} x{Math.floor(state.resources[foodDef.id]?.amount ?? 0)}
          </span>
        )}
      </span>
      {loadout.length === 0 ? (
        <span className="text-faint text-small">Nothing packed yet. Worn gear comes along for free.</span>
      ) : (
        <div className="row" style={{ gap: 6 }}>
          {loadout.map((e) => {
            const def = getItemDef(e.itemDefId);
            if (!def) return null;
            return (
              <span key={e.instanceId ?? e.itemDefId} className="item-chip loadout-chip" title={def.name}>
                <ItemIcon def={def} size={20} />
                <span className="text-small">{itemName(def, e.instanceId ? state.inventory[e.instanceId] : undefined)}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DungeonCard({ dungeonId, description }: { dungeonId: string; description?: string }) {
  const { engine, state, actions } = useGame();
  const [picking, setPicking] = useState(false);
  const dungeon = getDungeon(dungeonId);
  if (!dungeon) return null;

  const boss = getEnemy(dungeon.bossId);
  const run = state.dungeonRun?.dungeonId === dungeonId ? state.dungeonRun : null;
  const icon = AMENITY_ICON.dungeonEntrance;
  const picker = picking && <LoadoutPicker dungeonId={dungeonId} onClose={() => setPicking(false)} />;

  if (!run) {
    const lock = dungeon.unlockCondition ? describeUnmetCondition(dungeon.unlockCondition, state, CONDITION_LABELS) : null;
    if (lock) return <LockedCard icon={icon} title={dungeon.name} reason={lock} />;

    const loadout = engine.getSavedLoadout(dungeonId);
    const blocker = engine.getDungeonEnterBlocker(dungeonId, loadout);
    const plan = [...dungeon.waves.map((_, i) => stageLabel(dungeon, i)), stageLabel(dungeon, dungeon.waves.length)];

    return (
      <>
        <ActionCard
          icon={icon}
          title={dungeon.name}
          meta={`${dungeon.waves.length} waves + boss`}
          description={
            <>
              {description ?? dungeonDescription(dungeonId)} Before the boss you can regear from what you brought.
              <ol className="dungeon-plan text-small">
                {plan.map((label, i) => (
                  <li key={i}>{label}</li>
                ))}
              </ol>
            </>
          }
          actions={[
            {
              label: "Enter",
              variant: "primary",
              disabled: !!blocker,
              reason: blocker ?? undefined,
              onClick: () => {
                engine.enterDungeon(dungeonId, loadout);
                actions.refresh();
              },
            },
            { label: "Select loadout", onClick: () => setPicking(true) },
          ]}
        >
          <LoadoutSummary loadout={loadout} slots={dungeon.loadoutSlots} />
        </ActionCard>
        {picker}
      </>
    );
  }

  const session = getActiveCombat(state);
  const stageIndex = run.wavesCleared;
  const onBoss = stageIndex >= dungeon.waves.length;
  const stage = onBoss ? `Boss: ${boss?.name ?? "Boss"}` : `Wave ${stageIndex + 1} of ${dungeon.waves.length}`;
  // What comes after the fight going on now (or, at the regear stop, the boss).
  const next = run.awaitingBoss ? stageLabel(dungeon, dungeon.waves.length) : !onBoss ? stageLabel(dungeon, stageIndex + 1) : null;

  if (!run.awaitingBoss) {
    return (
      <div className="stack-sm">
        <ActionCard
          className="is-active"
          open
          icon={icon}
          title={dungeon.name}
          meta={stage}
          description={
            <span className="dungeon-next">
              {session?.dungeonId === dungeonId && <span>Now: {stageLabel(dungeon, stageIndex)}</span>}
              {next && <span>Next: {next}</span>}
            </span>
          }
          actions={[{ label: "Leave dungeon", variant: "danger", onClick: () => engine.leaveDungeon() }]}
        />
        {session?.dungeonId === dungeonId && <CombatPanel enemyId={session.enemyId} inDungeon />}
      </div>
    );
  }

  // The regear stop before the boss.
  const brought = run.loadout.filter((e) => e.quantity > 0);
  return (
    <ActionCard
      className="is-active"
      open
      icon={icon}
      title={dungeon.name}
      meta="Before the boss"
      description={
        <>
          All {dungeon.waves.length} waves cleared. Regear from what you brought, then face {next}. Once the fight starts
          there's no fleeing.
        </>
      }
      actions={[
        {
          label: `Continue to ${boss?.name ?? "the boss"}`,
          variant: "primary",
          disabled: engine.getCurrentHp() <= 0,
          reason: "Heal first",
          onClick: () => {
            engine.continueToBoss();
            actions.refresh();
          },
        },
        { label: "Leave dungeon", onClick: () => engine.leaveDungeon() },
      ]}
    >
      <HpBar current={engine.getCurrentHp()} max={engine.getMaxHp()} label="You" />
      <div className="stack-sm">
        {brought.length === 0 && <span className="text-faint text-small">You brought nothing along.</span>}
        {brought.map((e) => {
          const def = getItemDef(e.itemDefId);
          if (!def) return null;
          const worn = e.instanceId ? Object.values(state.equipment).includes(e.instanceId) : false;
          const food = !!def.healAmount;
          return (
            <div key={e.instanceId ?? e.itemDefId} className="row row-between text-small">
              <span className="row" style={{ gap: 6 }}>
                <ItemIcon def={def} size={20} />
                {itemName(def, e.instanceId ? state.inventory[e.instanceId] : undefined)}
                {food && <span className="text-faint">x{engine.getFoodCount(def.id)}</span>}
                {worn && <span className="text-faint">(worn)</span>}
              </span>
              {food ? (
                <button
                  type="button"
                  className="btn"
                  disabled={engine.getFoodCount(def.id) < 1 || engine.getCurrentHp() >= engine.getMaxHp()}
                  onClick={() => {
                    engine.eatItem(def.id);
                    actions.refresh();
                  }}
                >
                  Eat
                </button>
              ) : def.equipSlot && !worn ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    engine.equipItem(def, e.instanceId);
                    actions.refresh();
                  }}
                >
                  Equip
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </ActionCard>
  );
}
