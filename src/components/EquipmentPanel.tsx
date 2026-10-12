import { useState } from "react";
import { useGame } from "../engine/GameEngineContext";
import { EQUIPMENT_SLOTS } from "../content/equipmentSlots";
import { getItemDef } from "../content/items";
import { getEquipmentBonuses } from "../content/combatStats";
import { DUNGEON_CATALOG } from "../content/dungeons";
import { dungeonDescription, itemDescription, itemName } from "../content/display";
import { isUnlocked } from "../engine/unlockConditions";
import { wornItemDefId } from "../engine/ledger";
import { getActiveCombat } from "../engine/activeAction";
import { formatNumber } from "../engine/format";
import { itemActions, formatItemStats } from "./ItemActions";
import ItemIcon from "./ItemIcon";
import { ActionCard } from "./ui/ActionCard";
import { Page, Section } from "./ui/Page";
import { CombatStats, CombatStylePicker, SpecialAttackBar, SpellPicker } from "./CombatControls";
import CombatPanel from "./CombatPanel";
import DungeonCard from "./DungeonCard";
import LoadoutPicker from "./LoadoutPicker";

/** The combat hub, Melvor-style: the fight itself, style, spell, special
 *  attack, stats, then everything worn, including the food fights eat
 *  from and the ammo a bow uses. Clicking a combat skill in the sidebar
 *  opens it, and starting a fight switches here. */
export default function EquipmentPanel() {
  const { engine, state } = useGame();
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const gear = getEquipmentBonuses(state);
  const session = getActiveCombat(state);
  const fighting = !!session;
  const run = state.dungeonRun;

  return (
    <Page title="Equipment">
      {/* The fight is right here too. A dungeon run shows its own card
          (waves, what's next, the regear stop) with the fight inside it. */}
      {run ? (
        <DungeonCard dungeonId={run.dungeonId} description={dungeonDescription(run.dungeonId)} />
      ) : (
        session && <CombatPanel enemyId={session.enemyId} />
      )}

      <div className="card stack">
        <CombatStylePicker />
        {gear.attackStyle === "magic" && <SpellPicker locked={fighting} />}
        {gear.attackStyle === "ranged" && !gear.ammoItemId && (
          <p className="text-warning text-small">Equip arrows in the Ammo slot to fight with a bow.</p>
        )}
        <SpecialAttackBar />
        <CombatStats />
      </div>

      <Section title="Worn">
        {fighting ? (
          <p className="combat-alert text-small">
            🔒 You're fighting: weapons and armour are locked until the fight ends. Food can still be eaten and swapped.
          </p>
        ) : (
          <p className="text-faint text-small">
            Equip food from your inventory to bring it into fights; auto-eat uses it. Gear can't be changed mid-fight.
          </p>
        )}
        <div className="stack-sm">
          {EQUIPMENT_SLOTS.map((slot) => {
            const equipValue = state.equipment[slot.id];
            const itemDefId = equipValue ? wornItemDefId(state, equipValue) : undefined;
            const def = itemDefId ? getItemDef(itemDefId) : undefined;
            const locked = fighting && slot.id !== "food";

            if (!def || !equipValue) {
              return (
                <div key={slot.id} className={`card${locked ? " is-gear-locked" : ""}`}>
                  <div className="card-header">
                    <span className="card-title text-faint">{slot.label}</span>
                    <span className="card-meta">Empty</span>
                  </div>
                </div>
              );
            }
            const instance = def.stackable ? undefined : state.inventory[equipValue];
            const stats = formatItemStats(def);
            const wear =
              def.maxDurability !== undefined && instance
                ? ` · ${Math.round(((instance.durability ?? def.maxDurability) / def.maxDurability) * 100)}% condition`
                : "";
            return (
              <ActionCard
                key={slot.id}
                className={locked ? "is-gear-locked" : ""}
                icon={<ItemIcon def={def} size={24} />}
                title={itemName(def, instance)}
                meta={
                  (def.stackable ? `${slot.label} · x${formatNumber(engine.getResourceAmount(def.id))}` : slot.label) +
                  wear +
                  (locked ? " · 🔒" : "")
                }
                description={
                  <>
                    {itemDescription(def, instance)}
                    {stats && <div className="text-small">{stats}</div>}
                  </>
                }
                actions={itemActions(engine, def, {
                  instanceId: def.stackable ? undefined : equipValue,
                  equipped: true,
                  exclude: ["drop"],
                }).map((a) => (locked && a.label === "Unequip" ? { ...a, disabled: true, reason: "Gear is locked mid-fight" } : a))}
              />
            );
          })}
        </div>
      </Section>

      <Section title="Dungeon loadouts">
        <p className="text-faint text-small">
          Pack your dungeon gear ahead of time. Worn gear and your equipped food come along for free.
        </p>
        <div className="stack-sm">
          {DUNGEON_CATALOG.map((dungeon) => {
            const unlocked = !dungeon.unlockCondition || isUnlocked(dungeon.unlockCondition, state);
            const loadout = engine.getSavedLoadout(dungeon.id);
            return (
              <div key={dungeon.id} className="card">
                <div className="card-header">
                  <span className="card-title">{dungeon.name}</span>
                  <button
                    type="button"
                    className="btn"
                    disabled={!!run}
                    title={run ? "Not while you're in a dungeon" : undefined}
                    onClick={() => setPickingFor(dungeon.id)}
                  >
                    Select loadout ({loadout.length}/{dungeon.loadoutSlots})
                  </button>
                </div>
                {!unlocked && <span className="text-faint text-small">You haven't unlocked this dungeon yet.</span>}
                {loadout.length > 0 && (
                  <div className="row" style={{ gap: 6 }}>
                    {loadout.map((e) => {
                      const def = getItemDef(e.itemDefId);
                      return def ? (
                        <span key={e.instanceId ?? e.itemDefId} className="item-chip loadout-chip" title={def.name}>
                          <ItemIcon def={def} size={20} />
                          <span className="text-small">{def.name}</span>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>
      {pickingFor && <LoadoutPicker dungeonId={pickingFor} onClose={() => setPickingFor(null)} />}
    </Page>
  );
}
