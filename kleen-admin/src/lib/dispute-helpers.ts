export const DISPUTE_STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "under_review", label: "Under review" },
  { value: "escalated", label: "Escalated" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
] as const;

export function isDisputeResolved(status: string): boolean {
  return status === "resolved" || status === "closed";
}

export function disputeStatusBadgeClass(status: string): string {
  switch (status) {
    case "resolved":
    case "closed":
      return "bg-emerald-500/20 text-emerald-300";
    case "under_review":
      return "bg-blue-500/20 text-blue-300";
    case "escalated":
      return "bg-red-500/20 text-red-300";
    case "open":
    default:
      return "bg-amber-500/20 text-amber-300";
  }
}
