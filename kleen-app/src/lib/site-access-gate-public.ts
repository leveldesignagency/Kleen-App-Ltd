/** Client-safe — no Node crypto imports. */
export function isSiteAccessGateEnabledPublic(): boolean {
  return process.env.NEXT_PUBLIC_SITE_ACCESS_GATE_ENABLED === "true";
}
