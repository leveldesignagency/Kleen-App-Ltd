/** Redact email for logs and admin displays: j***@example.com */
export function redactEmail(email: string | null | undefined): string {
  if (!email?.trim()) return "—";
  const e = email.trim();
  const at = e.indexOf("@");
  if (at <= 0) return "***";
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  const show = local.length <= 1 ? "*" : `${local[0]}***`;
  return `${show}@${domain}`;
}

/** Redact free text — keep first/last few chars. */
export function redactText(text: string | null | undefined, maxVisible = 4): string {
  if (!text?.trim()) return "";
  const t = text.trim();
  if (t.length <= maxVisible * 2) return "***";
  return `${t.slice(0, maxVisible)}…${t.slice(-maxVisible)}`;
}
