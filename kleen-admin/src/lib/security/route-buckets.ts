export type RateLimitBucket = "default" | "auth" | "write" | "payment" | "sensitive" | "cron";

export type BucketConfig = {
  windowMs: number;
  maxIp: number;
  maxUser: number;
};

export const BUCKET_CONFIG: Record<RateLimitBucket, BucketConfig> = {
  default: { windowMs: 60_000, maxIp: 120, maxUser: 180 },
  auth: { windowMs: 60_000, maxIp: 10, maxUser: 15 },
  write: { windowMs: 60_000, maxIp: 25, maxUser: 40 },
  payment: { windowMs: 60_000, maxIp: 15, maxUser: 25 },
  sensitive: { windowMs: 60_000, maxIp: 8, maxUser: 15 },
  cron: { windowMs: 60_000, maxIp: 40, maxUser: 40 },
};

/** Map kleen-admin API paths to rate-limit buckets. */
export function resolveApiBucket(pathname: string): RateLimitBucket {
  if (pathname.startsWith("/api/admin/search")) return "sensitive";
  if (pathname.startsWith("/api/admin/team")) return "sensitive";
  if (pathname.startsWith("/api/stripe/")) return "payment";
  if (pathname.startsWith("/api/contractors/")) return "write";
  if (pathname.startsWith("/api/jobs/")) return "write";
  if (pathname.startsWith("/api/cron/")) return "cron";
  return "default";
}

export function isPrivateApiPath(_pathname: string): boolean {
  return false;
}

export function isTestApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/test");
}
