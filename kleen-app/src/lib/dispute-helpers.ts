export const DISPUTE_REASON_OPTIONS = [
  { value: "quality", label: "Quality not satisfactory" },
  { value: "missed", label: "Areas missed / incomplete" },
  { value: "damage", label: "Property damage" },
  { value: "noshow", label: "Contractor did not arrive" },
  { value: "late", label: "Significantly late" },
  { value: "behaviour", label: "Unprofessional behaviour" },
  { value: "pricing", label: "Pricing / charges dispute" },
  { value: "other", label: "Other" },
] as const;

export type DisputeReasonCode = (typeof DISPUTE_REASON_OPTIONS)[number]["value"];

export type DisputeStatus = "open" | "under_review" | "resolved" | "escalated" | "closed";

export const DISPUTE_STATUS_OPTIONS: { value: DisputeStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "under_review", label: "Under review" },
  { value: "escalated", label: "Escalated" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

/** Jobs a customer can still open a dispute against. */
export const DISPUTE_ELIGIBLE_JOB_STATUSES = [
  "customer_accepted",
  "accepted",
  "awaiting_completion",
  "in_progress",
  "pending_confirmation",
  "completed",
  "disputed",
] as const;

export const OPEN_DISPUTE_STATUSES: DisputeStatus[] = ["open", "under_review", "escalated"];

export function isDisputeResolved(status: string): boolean {
  return status === "resolved" || status === "closed";
}

export function isDisputeActive(status: string): boolean {
  return OPEN_DISPUTE_STATUSES.includes(status as DisputeStatus);
}

export function disputeStatusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case "resolved":
    case "closed":
      return { label: status === "closed" ? "Closed" : "Resolved", className: "bg-emerald-100 text-emerald-800" };
    case "under_review":
      return { label: "Under review", className: "bg-blue-100 text-blue-800" };
    case "escalated":
      return { label: "Escalated", className: "bg-red-100 text-red-800" };
    case "open":
    default:
      return { label: "Open", className: "bg-amber-100 text-amber-800" };
  }
}

export function disputeReasonLabel(code: string): string {
  return DISPUTE_REASON_OPTIONS.find((o) => o.value === code)?.label ?? code;
}

export function formatDisputeReason(code: string, details: string): string {
  return `${disputeReasonLabel(code)}: ${details.trim()}`;
}
