import { useGame } from "../engine/GameEngineContext";
import { EQUIPMENT_SLOTS } from "../content/equipmentSlots";
import { getItemDef } from "../content/items";
import { getEquipmentBonuses } from "../content/combatStats";
import { UNARMED_ATTACK_SPEED_MS } from "../engine/tuning";
import { itemActions, formatItemStats } from "./ItemActions";
import ItemIcon from "./ItemIcon";
import { ActionCard } from "./ui/ActionCard";
import { Page, Section } from "./ui/Page";

export default function EquipmentPanel() {
  const { engine, state } = useGame();
  const bonuses = getEquipmentBonuses(state);

  return (
    <Page title="Equipment">
      <div className="card">
        <div className="data-row">
          <span>Attack bonus</span>
          <span>+{bonuses.attack}</span>
        </div>
        <div className="data-row">
          <span>Strength bonus</span>
          <span>+{bonuses.strength}</span>
        </div>
        <div className="data-row">
          <span>Defence bonus</span>
          <span>+{bonuses.defence}</span>
        </div>
        <div className="data-row">
          <span>Attack speed</span>
          <span>{((bonuses.attackSpeedMs ?? UNARMED_ATTACK_SPEED_MS) / 1000).toFixed(1)}s</span>
        </div>
      </div>

      <Section title="Worn">
        <div className="stack-sm">
          {EQUIPMENT_SLOTS.map((slot) => {
            const instanceId = state.equipment[slot.id];
            const instance = instanceId ? state.inventory[instanceId] : undefined;
            const def = instance ? getItemDef(instance.itemDefId) : undefined;

            if (!def || !instance) {
              return (
                <div key={slot.id} className="card">
                  <div className="card-header">
                    <span className="card-title text-faint">{slot.label}</span>
                    <span className="card-meta">Empty</span>
                  </div>
                </div>
              );
            }
            const stats = formatItemStats(def);
            return (
              <ActionCard
                key={slot.id}
                icon={<ItemIcon def={def} size={24} />}
                title={def.name}
                meta={slot.label}
                description={
                  <>
                    {def.description}
                    {stats && <div className="text-small">{stats}</div>}
                  </>
                }
                actions={itemActions(engine, def, { instanceId: instance.instanceId, equipped: true, exclude: ["drop"] })}
              />
            );
          })}
        </div>
      </Section>
    </Page>
  );
}
