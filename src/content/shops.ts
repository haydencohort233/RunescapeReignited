import type { ShopDefinition, ShopItem } from "../engine/types";
import { ITEM_CATALOG } from "./items";
export type { ShopDefinition, ShopItem };

const gp = (amount: number) => [{ resource: "gp", amount }];
const ITEM_VALUE = new Map(ITEM_CATALOG.map((i) => [i.id, i.value]));

// Shop names, NPCs and prices beyond Bob's are proposed. Tool prices
// follow OSRS.
export const SHOP_CATALOG: ShopDefinition[] = [
  {
    id: "bobs-famous-axes",
    npcName: "Bob",
    title: "Bob's Famous Axes",
    locationId: "town",
    items: [
      ...["bronze", "iron", "steel", "mithril", "adamant", "rune"].map((m) => ({
        itemDefId: `${m}-axe`,
        price: gp({ bronze: 16, iron: 56, steel: 200, mithril: 520, adamant: 1280, rune: 12800 }[m]!),
      })),
      ...["bronze", "iron", "steel", "mithril", "adamant", "rune"].map((m) => ({
        itemDefId: `${m}-pickaxe`,
        price: gp({ bronze: 1, iron: 140, steel: 500, mithril: 1300, adamant: 3200, rune: 32000 }[m]!),
      })),
      { itemDefId: "tinderbox", price: gp(1) },
    ],
    buysItems: true,
    repairs: true,
    dialogue: [
      "Axes, pickaxes, the lot. And if your armour's falling apart, I can fix that too.",
      "Heard there's something nasty living in the den out in the Dark Forest. Wouldn't go in there without a decent weapon.",
      "Copper and tin from the Quarry make bronze. The furnace and anvil are right here in town.",
      "Aggie over in Draynor Village can put the magic back into a tired amulet. For a price.",
    ],
  },
  {
    id: "riverside-armoury",
    npcName: "Armourer",
    title: "Riverside Armoury",
    locationId: "town",
    items: [
      { itemDefId: "bronze-dagger", price: gp(50) },
      { itemDefId: "bronze-warhammer", price: gp(80) },
      { itemDefId: "wooden-shield", price: gp(20) },
      { itemDefId: "bronze-full-helm", price: gp(60) },
      { itemDefId: "bronze-arrow", price: gp(2) },
      // Every metal tier (added Oct 11, proposed): armour and arrows at
      // their item value; Defence and Ranged levels gate wearing them.
      ...["iron", "steel", "mithril", "adamant", "rune"].flatMap((m) =>
        ["full-helm", "platebody", "platelegs", "kiteshield", "arrow"].map((piece) => ({
          itemDefId: `${m}-${piece}`,
          price: gp(ITEM_VALUE.get(`${m}-${piece}`) ?? 1),
        }))
      ),
    ],
    buysItems: true,
    dialogue: ["A bow's no use without arrows. I sell those too.", "Bronze won't stop a dragon, but it'll stop a goblin."],
  },
  {
    id: "aubury-runes",
    npcName: "Aubury",
    title: "Aubury's Rune Shop",
    locationId: "town",
    items: [
      { itemDefId: "air-rune", price: gp(4) },
      { itemDefId: "water-rune", price: gp(4) },
      { itemDefId: "earth-rune", price: gp(4) },
      { itemDefId: "fire-rune", price: gp(4) },
      { itemDefId: "mind-rune", price: gp(3) },
      { itemDefId: "chaos-rune", price: gp(90) },
      { itemDefId: "death-rune", price: gp(180) },
      { itemDefId: "blood-rune", price: gp(400) },
      { itemDefId: "air-staff", price: gp(1500) },
    ],
    buysItems: true,
    dialogue: [
      "An Air Staff saves you carrying air runes. Every spell needs them.",
      "Strikes first, then bolts, blasts and waves as your Magic grows.",
    ],
  },
  {
    id: "gerrants-fishing",
    npcName: "Gerrant",
    title: "Gerrant's Fishy Business",
    locationId: "lake-shore",
    items: [
      { itemDefId: "fishing-net", price: gp(5) },
      { itemDefId: "fishing-rod", price: gp(5) },
      { itemDefId: "harpoon", price: gp(5) },
    ],
    buysItems: true,
    dialogue: ["Shrimps in the shallows, trout on a rod, tuna and sharks if you've got a harpoon."],
  },
];

export function getShop(id: string): ShopDefinition | undefined {
  return SHOP_CATALOG.find((s) => s.id === id);
}