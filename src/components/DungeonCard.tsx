import { useState } from "react";
import { useGame } from "../engine/GameEngineContext";
import { getDungeon } from "../content/dungeons";
import { getEnemy } from "../content/enemies";
import { getItemDef } from "../content/items";
import { AMENITY_ICON } from "../content/amenities";
import { CONDITION_LABELS } from "../content/display";
import { describeUnmetCondition } from "../engine/unlockConditions";
import { getActiveCombat } from "../engine/activeAction";
import type { ItemDefinition, LoadoutEntry } from "../engine/types";
import { ActionCard, LockedCard } from "./ui/ActionCard";
import ItemIcon from "./ItemIcon";
import HpBar from "./HpBar";
import CombatPanel from "./CombatPanel";

/** What can be brought: unworn gear (one slot each), food (one slot per
 *  piece) and ammo or runes (one slot for the whole stack). */
function loadoutCandidates(state: ReturnType<typeof useGame>["state"], owned: (id: string) => number) {
  const worn = new Set(Object.values(state.equipment));
  const gear: { def: ItemDefinition; instanceId: string }[] = [];
  for (const instance of Object.values(state.inventory)) {
    const def = getItemDef(instance.itemDefId);
    if (def?.equipSlot && !worn.has(instance.instanceId)) gear.push({ def, instanceId: instance.instanceId });
  }
  const stacks: { def: ItemDefinition; amount: number }[] = [];
  for (const [id, r] of Object.entries(state.resources)) {
    const def = getItemDef(id);
    if (!def || r.amount < 1) continue;
    // Worn ammo already comes along; worn food doesn't (only loadout food is eaten).
    if (!def.healAmount && worn.has(`stack:${id}`)) continue;
    if (def.healAmount || def.equipSlot === "ammo" || id.endsWith("-rune")) stacks.push({ def, amount: Math.floor(owned(id)) });
  }
  return { gear, stacks };
}

export default function DungeonCard({ dungeonId, description }: { dungeonId: string; description: string }) {
  const { engine, state, actions } = useGame();
  const [picked, setPicked] = useState<Record<string, LoadoutEntry>>({});
  const dungeon = getDungeon(dungeonId);
  if (!dungeon) return null;

  const boss = getEnemy(dungeon.bossId);
  const plan = `${dungeon.waves.map((id) => getEnemy(id)?.name ?? id).join(", ")}, then ${boss?.name ?? "the boss"}`;
  const run = state.dungeonRun?.dungeonId === dungeonId ? state.dungeonRun : null;
  const icon = AMENITY_ICON.dungeonEntrance;

  if (!run) {
    const lock = dungeon.unlockCondition ? describeUnmetCondition(dungeon.unlockCondition, state, CONDITION_LABELS) : null;
    if (lock) return <LockedCard icon={icon} title={dungeon.name} reason={lock} />;

    const loadout = Object.values(picked).filter((e) => e.quantity > 0);
    const used = engine.getLoadoutSlotsUsed(loadout);
    const blocker = engine.getDungeonEnterBlocker(dungeonId, loadout);
    const { gear, stacks } = loadoutCandidates(state, (id) => engine.getResourceAmount(id));
    const set = (key: string, entry: LoadoutEntry | null) =>
      setPicked((prev) => {
        const next = { ...prev };
        if (entry) next[key] = entry;
        else delete next[key];
        return next;
      });

    return (
      <ActionCard
        icon={icon}
        title={dungeon.name}
        meta={`${dungeon.waves.length} waves + boss`}
        description={
          <>
            {description} You fight {plan}. Before the boss you can regear from what you brought. Worn gear comes along
            for free; everything else has to fit in {dungeon.loadoutSlots} slots.
          </>
        }
        actions={[
          {
            label: `Enter (${used}/${dungeon.loadoutSlots} slots)`,
            variant: "primary",
            disabled: !!blocker,
            reason: blocker ?? undefined,
            onClick: () => {
              if (engine.enterDungeon(dungeonId, loadout)) setPicked({});
              actions.refresh();
            },
          },
        ]}
      >
        <div className="stack-sm">
          <span className="text-small">Loadout</span>
          {gear.length === 0 && stacks.length === 0 && <span className="text-faint text-small">Nothing to bring.</span>}
          {stacks.map(({ def, amount }) => {
            const perPiece = !!def.healAmount;
            const qty = picked[def.id]?.quantity ?? 0;
            return (
              <div key={def.id} className="row row-between text-small">
                <span className="row" style={{ gap: 6 }}>
                  <ItemIcon def={def} size={20} />
                  {def.name} <span className="text-faint">x{amount}</span>
                </span>
                {perPiece ? (
                  <span className="btn-row">
                    <button type="button" className="btn" disabled={qty <= 0} onClick={() => set(def.id, qty > 1 ? { itemDefId: def.id, quantity: qty - 1 } : null)}>
                      -
                    </button>
                    <span>{qty}</span>
                    <button
                      type="button"
                      className="btn"
                      disabled={qty >= amount || used >= dungeon.loadoutSlots}
                      onClick={() => set(def.id, { itemDefId: def.id, quantity: qty + 1 })}
                    >
                      +
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn"
                    aria-pressed={qty > 0}
                    disabled={qty === 0 && used >= dungeon.loadoutSlots}
                    onClick={() => set(def.id, qty > 0 ? null : { itemDefId: def.id, quantity: amount })}
                  >
                    {qty > 0 ? "Brought" : "Bring"}
                  </button>
                )}
              </div>
            );
          })}
          {gear.map(({ def, instanceId }) => {
            const on = !!picked[instanceId];
            return (
              <div key={instanceId} className="row row-between text-small">
                <span className="row" style={{ gap: 6 }}>
                  <ItemIcon def={def} size={20} />
                  {def.name}
                </span>
                <button
                  type="button"
                  className="btn"
                  aria-pressed={on}
                  disabled={!on && used >= dungeon.loadoutSlots}
                  onClick={() => set(instanceId, on ? null : { itemDefId: def.id, instanceId, quantity: 1 })}
                >
                  {on ? "Brought" : "Bring"}
                </button>
              </div>
            );
          })}
        </div>
      </ActionCard>
    );
  }

  const session = getActiveCombat(state);
  const stage = run.wavesCleared < dungeon.waves.length ? `Wave ${run.wavesCleared + 1} of ${dungeon.waves.length}` : boss?.name ?? "Boss";

  if (!run.awaitingBoss) {
    return (
      <div className="stack-sm">
        <ActionCard
          className="is-active"
          open
          icon={icon}
          title={dungeon.name}
          meta={stage}
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
      description={`All ${dungeon.waves.length} waves cleared. Regear from what you brought, then face ${boss?.name ?? "the boss"}. Once the fight starts there's no fleeing.`}
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
                {def.name}
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
