import { useGame } from "../engine/GameEngineContext";
import { EQUIPMENT_SLOTS } from "../content/equipmentSlots";
import { getItemDef } from "../content/items";
import ItemActions from "./ItemActions";
import ItemIcon from "./ItemIcon";

export default function EquipmentPanel() {
  const { state } = useGame();

  return (
    <section style={{ maxWidth: 480 }}>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Equipment</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {EQUIPMENT_SLOTS.map((slot) => {
          const instanceId = state.equipment[slot.id];
          const instance = instanceId ? state.inventory[instanceId] : undefined;
          const def = instance ? getItemDef(instance.itemDefId) : undefined;

          return (
            <div key={slot.id} style={{ border: "1px solid #ddd", borderRadius: 6, padding: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ fontSize: 13, color: "#888" }}>{slot.label}</strong>
                <span>
                  {def ? (
                    <>
                      <ItemIcon def={def} size={24} /> {def.name}
                    </>
                  ) : (
                    "(empty)"
                  )}
                </span>
              </div>
              {def && instance && (
                <div style={{ marginTop: 6 }}>
                  <ItemActions
                    def={def}
                    instanceId={instance.instanceId}
                    equipped={true}
                    excludeActions={["drop"]}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}