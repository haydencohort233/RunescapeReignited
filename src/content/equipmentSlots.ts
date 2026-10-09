import type { EquipSlot } from "../engine/types";

// OSRS's actual worn-equipment layout and ordering.
export const EQUIPMENT_SLOTS: { id: EquipSlot; label: string }[] = [
  { id: "head", label: "Helmet" },
  { id: "cape", label: "Cape" },
  { id: "neck", label: "Amulet" },
  { id: "weapon", label: "Weapon" },
  { id: "body", label: "Torso" },
  { id: "shield", label: "Shield" },
  { id: "legs", label: "Legs" },
  { id: "hands", label: "Gloves" },
  { id: "feet", label: "Boots" },
  { id: "ring", label: "Ring" },
  { id: "ammo", label: "Ammo" },
];