/** Client-safe — no Node crypto imports. */
export function isSiteAccessGateEnabledPublic(): boolean {
  return process.env.NEXT_PUBLIC_SITE_ACCESS_GATE_ENABLED === "true";
}

/** Paths that require the private preview gate before navigation. */
export function isGatedCustomerHref(href: string): boolean {
  if (!href) return false;
  try {
    const path = href.startsWith("http")
      ? new URL(href).pathname
      : href.split("?")[0] ?? href;
    return (
      path === "/sign-in" ||
      path.startsWith("/sign-in/") ||
      path === "/job-flow" ||
      path.startsWith("/job-flow/")
    );
  } catch {
    return href.includes("/sign-in") || href.includes("/job-flow");
  }
}
