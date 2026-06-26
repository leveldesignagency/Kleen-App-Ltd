import { sanitizeEmailAddress } from "@/lib/resend-config";

export function getAdminNotifyEmail(): string {
  const raw = process.env.ADMIN_NOTIFY_EMAIL?.trim() || "info@kleenapp.co.uk";
  return sanitizeEmailAddress(raw);
}

export function getAdminAppUrl(): string {
  return (process.env.ADMIN_APP_URL || "https://admin.kleenapp.co.uk").replace(/\/$/, "");
}
