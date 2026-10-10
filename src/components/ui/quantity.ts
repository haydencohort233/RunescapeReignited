import type { CardAction } from "./ActionCard";
import { formatNumber } from "../../engine/format";

/** The standard quantity set for buying, selling and crafting. */
export const QUANTITY_STEPS = [1, 5, 10] as const;

/** "Buy 1", "Buy 5", "Buy 10", "Buy all (n)" — each disabled with the
 *  reason when there isn't enough. Shared by every quantity-based action. */
export function quantityActions(
  verb: string,
  available: number,
  run: (quantity: number) => void,
  shortReason: string,
  opts: { includeAll?: boolean } = {}
): CardAction[] {
  const steps: CardAction[] = QUANTITY_STEPS.map((q) => ({
    label: `${verb} ${q}`,
    disabled: available < q,
    reason: shortReason,
    onClick: () => run(q),
  }));
  if (opts.includeAll === false) return steps;
  steps.push({
    label: `${verb} all (${formatNumber(available)})`,
    disabled: available < 1,
    reason: shortReason,
    onClick: () => run(available),
  });
  return steps;
}
