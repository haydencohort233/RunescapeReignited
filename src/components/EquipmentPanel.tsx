import { useGame } from "../engine/GameEngineContext";
import { EQUIPMENT_SLOTS } from "../content/equipmentSlots";
import { getItemDef } from "../content/items";
import { getEquipmentBonuses } from "../content/combatStats";
import { wornItemDefId } from "../engine/ledger";
import { getActiveCombat } from "../engine/activeAction";
import { formatNumber } from "../engine/format";
import { itemActions, formatItemStats } from "./ItemActions";
import ItemIcon from "./ItemIcon";
import { ActionCard } from "./ui/ActionCard";
import { Page, Section } from "./ui/Page";
import { CombatStats, CombatStylePicker, SpecialAttackBar, SpellPicker } from "./CombatControls";
import CombatPanel from "./CombatPanel";

/** The combat hub, Melvor-style: style, spell, special attack, stats,
 *  then everything worn, including the food fights eat from and the ammo
 *  a bow uses. Clicking a combat skill in the sidebar opens it. */
export default function EquipmentPanel() {
  const { engine, state } = useGame();
  const gear = getEquipmentBonuses(state);
  const session = getActiveCombat(state);
  const fighting = !!session;

  return (
    <Page title="Equipment">
      {/* Melvor-style: the fight itself is right here too. */}
      {session && <CombatPanel enemyId={session.enemyId} />}
      <div className="card stack">
        {fighting && (
          <p className="text-warning text-small">
            You're in a fight: gear is locked until it ends. You can still change style and swap food.
          </p>
        )}
        <CombatStylePicker />
        {gear.attackStyle === "magic" && <SpellPicker />}
        {gear.attackStyle === "ranged" && !gear.ammoItemId && (
          <p className="text-warning text-small">Equip arrows in the Ammo slot to fight with a bow.</p>
        )}
        <SpecialAttackBar />
        <CombatStats />
      </div>

      <Section title="Worn">
        <p className="text-faint text-small">
          Equip food from your inventory to bring it into fights; auto-eat uses it. Gear can't be changed mid-fight.
        </p>
        <div className="stack-sm">
          {EQUIPMENT_SLOTS.map((slot) => {
            const equipValue = state.equipment[slot.id];
            const itemDefId = equipValue ? wornItemDefId(state, equipValue) : undefined;
            const def = itemDefId ? getItemDef(itemDefId) : undefined;

            if (!def || !equipValue) {
              return (
                <div key={slot.id} className="card">
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
                : def.maxCharges !== undefined && instance
                  ? ` · ${instance.charges ?? 0}/${def.maxCharges} charges`
                  : "";
            return (
              <ActionCard
                key={slot.id}
                icon={<ItemIcon def={def} size={24} />}
                title={def.name}
                meta={
                  (def.stackable ? `${slot.label} · x${formatNumber(engine.getResourceAmount(def.id))}` : slot.label) + wear
                }
                description={
                  <>
                    {def.description}
                    {stats && <div className="text-small">{stats}</div>}
                  </>
                }
                actions={itemActions(engine, def, {
                  instanceId: def.stackable ? undefined : equipValue,
                  equipped: true,
                  exclude: ["drop"],
                })}
              />
            );
          })}
        </div>
      </Section>
    </Page>
  );
}
