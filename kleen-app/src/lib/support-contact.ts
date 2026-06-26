/** Primary Kleen support inbox for customers and error reports. */
export const SUPPORT_EMAIL = "info@kleenapp.co.uk";

export function supportMailtoLink(subject: string, body: string): string {
  const params = new URLSearchParams();
  params.set("subject", subject);
  params.set("body", body);
  return `mailto:${SUPPORT_EMAIL}?${params.toString()}`;
}
