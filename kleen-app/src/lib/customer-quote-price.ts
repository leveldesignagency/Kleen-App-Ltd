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

/** Line items for the accept-quote modal (totals align with payment amount). */
export function quoteBreakdownPence(resp: {
  customer_price_pence?: number | null;
  price_pence?: number | null;
}): { contractorPence: number; platformFeePence: number; totalPence: number } {
  const totalPence = customerDisplayPricePence(resp);
  let contractorPence: number;
  if (resp.price_pence != null && resp.price_pence > 0) {
    contractorPence = resp.price_pence;
  } else {
    contractorPence = Math.round(totalPence / (1 + CUSTOMER_SERVICE_FEE_RATE));
  }
  const platformFeePence = Math.max(0, totalPence - contractorPence);
  return { contractorPence, platformFeePence, totalPence };
}
