import type { MouseEvent, ReactNode } from "react";
import type { ItemDefinition } from "../engine/types";
import { formatNumber } from "../engine/format";
import ItemIcon from "./ItemIcon";
import { RARITY_CLASS } from "../content/display";

/** One square inventory slot, OSRS-style: the icon, the stack size in the
 *  corner and the name underneath. Worn items get an outline; `selected`
 *  marks picks in the loadout picker; shops add a price tag in the top
 *  right (red when you can't afford it). */
export function ItemTile({
  def,
  name,
  quantity,
  equipped = false,
  selected = false,
  disabled = false,
  badge,
  price,
  priceShort = false,
  onClick,
  onContextMenu,
}: {
  def: ItemDefinition;
  /** The copy's own name, when it differs ("Amulet of Glory (0)"). */
  name?: string;
  quantity?: number;
  equipped?: boolean;
  selected?: boolean;
  disabled?: boolean;
  badge?: ReactNode;
  /** A shop's price ("56 gp"), shown as a tag in the top right. */
  price?: ReactNode;
  /** Shows the price tag in red: the player can't afford one. */
  priceShort?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: MouseEvent) => void;
}) {
  const label = name ?? def.name;
  return (
    <button
      type="button"
      className={`inv-tile${equipped ? " is-equipped" : ""}${selected ? " is-selected" : ""}${price !== undefined ? " has-price" : ""}`}
      title={`${label}${quantity !== undefined ? ` x${quantity.toLocaleString()}` : ""}${equipped ? " (equipped)" : ""}`}
      aria-pressed={selected || undefined}
      disabled={disabled}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {quantity !== undefined && quantity > 1 && <span className="inv-qty">{formatNumber(quantity)}</span>}
      {badge && <span className="inv-badge">{badge}</span>}
      {price !== undefined && !badge && <span className={`inv-price${priceShort ? " is-short" : ""}`}>{price}</span>}
      <span className="inv-icon">
        <ItemIcon def={def} size={36} />
      </span>
      <span className={`inv-name ${RARITY_CLASS[def.rarity ?? "common"] ?? ""}`}>{label}</span>
    </button>
  );
}
