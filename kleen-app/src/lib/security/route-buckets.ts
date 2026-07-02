export type RateLimitBucket = "default" | "auth" | "write" | "payment" | "sensitive" | "cron";

export type BucketConfig = {
  windowMs: number;
  maxIp: number;
  maxUser: number;
};

export const BUCKET_CONFIG: Record<RateLimitBucket, BucketConfig> = {
  default: { windowMs: 60_000, maxIp: 120, maxUser: 180 },
  auth: { windowMs: 60_000, maxIp: 10, maxUser: 15 },
  write: { windowMs: 60_000, maxIp: 20, maxUser: 30 },
  payment: { windowMs: 60_000, maxIp: 15, maxUser: 25 },
  sensitive: { windowMs: 60_000, maxIp: 8, maxUser: 12 },
  cron: { windowMs: 60_000, maxIp: 40, maxUser: 40 },
};

/** Map Kleen API paths to rate-limit buckets (stricter for expensive routes). */
export function resolveApiBucket(pathname: string): RateLimitBucket {
  if (pathname.startsWith("/api/site-access/unlock")) return "auth";
  if (pathname.startsWith("/api/jobs/submit")) return "write";
  if (pathname.startsWith("/api/support/report")) return "write";
  if (pathname.startsWith("/api/stripe/")) return "payment";
  if (pathname.startsWith("/api/diagnostics/")) return "sensitive";
  if (pathname.startsWith("/api/contractor/portal/")) return "sensitive";
  if (pathname.startsWith("/api/cron/")) return "cron";
  if (pathname.startsWith("/api/jobs/notify-admin")) return "write";
  return "default";
}

export function isPrivateApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/contractor/portal/");
}

export function isTestApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/test");
}
