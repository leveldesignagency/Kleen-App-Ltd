/**
 * Pre-payment “service agreement” shown to every customer accepting a quote.
 * Full operative-authored contract text stays for post-payment email only (see resend-customer-contract).
 */

export const PLATFORM_SERVICE_AGREEMENT_VERSION = "1.0";

export function buildPlatformServiceAgreementText(params: {
  jobReference: string;
  totalFormatted: string;
  contractorLabel?: string | null;
}): string {
  const who = params.contractorLabel?.trim();
  return `
Kleen — service agreement (mutual understanding)

Job reference: ${params.jobReference}
Total you pay: ${params.totalFormatted}
${who ? `Contractor: ${who}` : ""}

You and the independent contractor agree that:

1. The job is to provide the agreed service at the price shown in your quote. Payment is taken through Kleen as set out in your quote breakdown.

2. Questions about quality, timing, or the work itself should be raised with Kleen support or the dispute process we publish on the platform, and otherwise handled under applicable law between you and the contractor.

3. Theft, violence, assault, harassment, trespass, or other criminal matters are not “platform disputes”. They must be reported to the police or other competent authorities. Kleen will cooperate with law enforcement when the law requires it and where we reasonably can.

4. The Kleen platform terms in the next step also apply.
`.trim();
}
