import { useState } from "react";
import { useGame } from "../engine/GameEngineContext";
import { getItemDef } from "../content/items";
import { getDungeon } from "../content/dungeons";
import { getEquipmentBonuses } from "../content/combatStats";
import { matchesSearch } from "../content/itemFilters";
import { itemName } from "../content/display";
import type { ItemDefinition, LoadoutEntry } from "../engine/types";
import { ItemTile } from "./ItemTile";
import { Modal } from "./ui/Modal";
import { EmptyState } from "./ui/Page";

interface Candidate {
  key: string;
  def: ItemDefinition;
  entry: LoadoutEntry;
  quantity?: number;
}

/** Gear that can be packed: unworn equipment (one slot per piece) and
 *  unworn arrows (one slot for the stack). Food isn't packed: the food
 *  slot's stack comes along on its own. Worn gear is free. */
function useCandidates(): Candidate[] {
  const { state } = useGame();
  const worn = new Set(Object.values(state.equipment));
  const list: Candidate[] = [];
  for (const instance of Object.values(state.inventory)) {
    const def = getItemDef(instance.itemDefId);
    if (!def?.equipSlot || def.healAmount || worn.has(instance.instanceId)) continue;
    list.push({ key: instance.instanceId, def, entry: { itemDefId: def.id, instanceId: instance.instanceId, quantity: 1 } });
  }
  for (const [id, r] of Object.entries(state.resources)) {
    const def = getItemDef(id);
    const amount = Math.floor(r.amount);
    if (!def?.equipSlot || def.healAmount || amount < 1 || worn.has(`stack:${id}`)) continue;
    list.push({ key: `stack:${id}`, def, entry: { itemDefId: id, quantity: amount }, quantity: amount });
  }
  return list.sort((a, b) => a.def.name.localeCompare(b.def.name));
}

const entryKey = (e: LoadoutEntry) => e.instanceId ?? `stack:${e.itemDefId}`;

/** "Select loadout": pick up to the dungeon's slot count from your gear.
 *  Saved for that dungeon, so it's ready next time too. Used from the
 *  dungeon's card and the Equipment tab. */
export default function LoadoutPicker({ dungeonId, onClose }: { dungeonId: string; onClose: () => void }) {
  const { engine, state, actions } = useGame();
  const dungeon = getDungeon(dungeonId);
  const candidates = useCandidates();
  const [picked, setPicked] = useState<Set<string>>(() => new Set(engine.getSavedLoadout(dungeonId).map(entryKey)));
  const [query, setQuery] = useState("");
  if (!dungeon) return null;

  const full = picked.size >= dungeon.loadoutSlots;
  const toggle = (key: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (next.size < dungeon.loadoutSlots) next.add(key);
      return next;
    });
  const save = () => {
    const loadout = candidates.filter((c) => picked.has(c.key)).map((c) => c.entry);
    if (engine.setSavedLoadout(dungeonId, loadout)) {
      actions.refresh();
      onClose();
    }
  };
  const shown = candidates.filter((c) => matchesSearch(c.def, false, query));
  const foodId = getEquipmentBonuses(state).foodItemId;
  const food = foodId ? getItemDef(foodId) : undefined;

  return (
    <Modal
      title={`${dungeon.name} loadout`}
      onClose={onClose}
      wide
      footer={
        <div className="row row-between">
          <span className={full ? "text-warning text-small" : "text-muted text-small"}>
            {picked.size}/{dungeon.loadoutSlots} slots
          </span>
          <span className="btn-row">
            <button type="button" className="btn" onClick={() => setPicked(new Set())} disabled={picked.size === 0}>
              Clear
            </button>
            <button type="button" className="btn btn-primary" onClick={save}>
              Save loadout
            </button>
          </span>
        </div>
      }
    >
      <div className="stack">
        <p className="text-muted text-small">
          Worn gear comes along for free. Pick up to {dungeon.loadoutSlots} more pieces to swap to inside.{" "}
          {food
            ? `Your equipped food (${food.name}) comes too, and doesn't use a slot.`
            : "Equip food in the Equipment tab to bring it; it doesn't use a slot."}
        </p>
        <input
          id="loadout-search"
          type="search"
          className="input"
          placeholder="Search your gear"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search gear"
        />
        {candidates.length === 0 ? (
          <EmptyState>You have no spare gear to bring.</EmptyState>
        ) : (
          <div className="inv-grid">
            {shown.map((c) => {
              const on = picked.has(c.key);
              return (
                <ItemTile
                  key={c.key}
                  def={c.def}
                  name={itemName(c.def, c.entry.instanceId ? state.inventory[c.entry.instanceId] : undefined)}
                  quantity={c.quantity}
                  selected={on}
                  disabled={!on && full}
                  badge={on ? "✓" : undefined}
                  onClick={() => toggle(c.key)}
                />
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
