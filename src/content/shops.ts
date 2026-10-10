import type { RecipeInput } from "../engine/types";

export interface ShopItem {
  itemDefId: string;
  /** Cost per unit. Almost always just GP, but this is a RecipeInput[] (the
   *  same shape building/recipe costs use) rather than a single number, so
   *  a resource-priced or multi-resource-priced item — or trading — works
   *  without changing this shape later. */
  price: RecipeInput[];
}

export interface ShopDefinition {
  id: string;
  npcName: string;
  title: string;
  /** The MapLocation id this shop is accessible from — you have to
   *  physically be there, checked both here (for UI display) and inside
   *  GameEngine.buyFromShop (so it's enforced, not just hidden). */
  locationId: string;
  items: ShopItem[];
  /** Whether the shop buys items from the player (anything with a value,
   *  at SHOP_SELL_PRICE_FRACTION of it — see engine/tuning.ts). */
  buysItems?: boolean;
}

export const SHOP_CATALOG: ShopDefinition[] = [
  {
    id: "bobs-famous-axes",
    npcName: "Bob",
    title: "Bob's Famous Axes",
    locationId: "town",
    items: [{ itemDefId: "bronze-dagger", price: [{ resource: "gp", amount: 50 }] }],
    buysItems: true,
  },
];

export function getShop(id: string): ShopDefinition | undefined {
  return SHOP_CATALOG.find((s) => s.id === id);
}