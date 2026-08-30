export const RESOLUTION_TYPES = [
  { value: "documented_only", label: "Document only", description: "Close case with notes — no money movement" },
  {
    value: "customer_full_refund",
    label: "Customer favour — full refund",
    description: "Refund entire charge (or cancel uncaptured hold)",
  },
  {
    value: "customer_partial_refund",
    label: "Customer favour — partial refund",
    description: "Refund a specific amount; contractor may still be paid the remainder",
  },
  {
    value: "cancel_authorization",
    label: "Cancel card hold",
    description: "Payment not yet captured — release the authorisation",
  },
  {
    value: "contractor_upheld",
    label: "Contractor upheld",
    description: "No refund — release escrow to contractor when eligible",
  },
  {
    value: "split_settlement",
    label: "Split settlement",
    description: "Partial refund to customer, then release remaining to contractor",
  },
  {
    value: "goodwill_promo",
    label: "Goodwill promo code",
    description: "Issue a discount code for a future booking (no refund on this job)",
  },
] as const;

export type ResolutionType = (typeof RESOLUTION_TYPES)[number]["value"];

export const SETTLEMENT_ACTIONS = [
  { value: "none", label: "No payment action" },
  { value: "full_refund", label: "Full refund" },
  { value: "partial_refund", label: "Partial refund" },
  { value: "cancel_auth", label: "Cancel authorization" },
  { value: "release_funds", label: "Release to contractor" },
  { value: "goodwill_promo", label: "Issue promo code" },
] as const;

export type SettlementActionType = (typeof SETTLEMENT_ACTIONS)[number]["value"];

export function formatPence(pence: number | null | undefined): string {
  if (pence == null || Number.isNaN(pence)) return "—";
  return `£${(pence / 100).toFixed(2)}`;
}

export function poundsToPence(value: string): number | null {
  const n = parseFloat(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}
