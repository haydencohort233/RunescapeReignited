// Balance numbers in one place. These are starting values, not settled
// design: change them freely, nothing else needs to know.

/** Default cost multiplier per building already owned — the Nth purchase
 *  costs baseCost * factor^N. Buildings can override it per definition. */
export const DEFAULT_COST_SCALING_FACTOR = 1.15;

/** Selling a building refunds this fraction of what those units cost. */
export const BUILDING_SELL_REFUND_FRACTION = 0.5;
