/** Matches kleen-admin SERVICE_FEE_RATE — customer price when only contractor price exists */
export const CUSTOMER_SERVICE_FEE_RATE = 0.175;

/**
 * Price shown to the customer: stored customer_price_pence, else contractor price + fee (same as admin).
 */
export function customerDisplayPricePence(resp: {
  customer_price_pence?: number | null;
  price_pence?: number | null;
}): number {
  const c = resp.customer_price_pence;
  if (c != null && c > 0) return c;
  const p = resp.price_pence;
  if (p != null && p > 0) return Math.round(p * (1 + CUSTOMER_SERVICE_FEE_RATE));
  return 0;
}
