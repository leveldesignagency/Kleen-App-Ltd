import { randomBytes } from "crypto";

/** Opaque token for contractor field portal URLs (no login). */
export function generateOperativePortalToken(): string {
  return randomBytes(24).toString("hex");
}
