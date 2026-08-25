# Kleen data retention matrix (UK GDPR / PECR)

**Controller:** Kleen App Ltd (trading as Kleen), contact `privacy@kleenapp.co.uk`  
**Governing law:** England and Wales  
**Last updated:** August 2026  

This matrix is implemented in product code (migration `051`, purge crons, legal holds).  
Have a solicitor review before relying on it for production customers.

## Principles

1. Keep personal data only as long as needed for the stated purpose.
2. After account erase: **anonymise** job/payment ledgers — do not keep full profiles indefinitely.
3. **Legal holds** (fraud, safety, legal claims, regulatory, dispute) pause deletion for that subject only — not a blanket “crime forever” rule.
4. Access to holds and ID documents: **admin / legal only**.

## Retention periods

| Data category | Examples | Retention | After period |
|---------------|----------|-----------|--------------|
| Active account profile | Name, email, phone, prefs | While account open | Soft-delete → 30-day grace → anonymise + erase login |
| Account deletion grace | Scheduled erase | **30 days** from request (cancelable) | Anonymise ledgers, delete auth user |
| Job location PII | Full address, notes | While needed for delivery + short aftercare | On erase: redact address; keep **outward postcode** + job reference |
| Job / payment ledger | Reference, status, amounts, Stripe IDs, timestamps | **6 years** from payment / tax year end (UK accounting) | Review archive; keep anonymised or delete if no hold |
| Disputes / chargebacks | Dispute reason, messages | **6 years** from closure / last relevant event | Anonymise parties; keep ledger if needed |
| Legal hold evidence | Hold record + linked job/operative | Until hold released + any related claim period | Release hold then apply normal retention |
| Contractor vetting ID docs | Photo ID in `contractor-documents` | **24 months** after leave/account erase (`documents_retain_until`), unless hold | Storage purge cron; clear paths |
| Contractor profile (ops) | Services, quotes, payouts | While active + ledger needs | Contact anonymised on erase; Stripe Connect remains with Stripe |
| Support / emails | Resend / inbox | **2–3 years** operational | Delete / archive |
| Marketing preferences | email_opt_in | Until withdrawn or account erased | Cleared on anonymise |
| Essential cookies | Auth, security, consent choice | Session / up to 12 months (consent) | Browser controls |
| Non-essential analytics | Only if enabled later | Per tool + consent | Not loaded without consent |

## Legal holds (narrow)

| Reason code | Use when | Access |
|-------------|----------|--------|
| `fraud` | Suspected payment / identity fraud | Admin + legal |
| `safety` | Threats, assault reports, serious safety incidents | Admin + legal |
| `legal_claim` | Live or reasonably anticipated claim | Admin + legal |
| `regulatory` | Regulator / law-enforcement request | Admin + legal |
| `dispute` | Escalated platform dispute needing records | Admin |
| `other` | Documented exception (notes required) | Superadmin preferred |

Holds block: account deletion RPC, purge cron, contractor document purge for that subject.

## Product steps (ops)

1. ~~Run migration `051_gdpr_retention_legal_holds.sql` on Supabase.~~ **Done** (confirm columns `legal_holds`, `jobs.customer_anonymised_at`, `operatives.documents_retain_until` exist if unsure).
2. Confirm crons: `purge-deleted-accounts` (05:00), `purge-contractor-documents` (06:00) — requires kleen-app redeploy with updated `vercel.json`.
3. Place/release holds in Admin → **Legal holds** — requires kleen-admin redeploy.
4. On contractor leave/erase, ensure `documents_retain_until` is set (purge cron sets on customer erase path; set automatically when deactivating contractors in admin).
5. Do **not** email full customer CSVs weekly; use admin tools or encrypted exports.
6. Redeploy **kleen-app** + **kleen-admin** so Privacy/Terms/Cookies, purge anonymisation, and Legal holds UI are live.
7. Solicitor review of Privacy/Terms before public launch (optional for closed beta, recommended).

## Related code

- `kleen-app/src/lib/gdpr/anonymise-account.ts`
- `kleen-app/src/lib/gdpr/purge-contractor-docs.ts`
- `kleen-app/src/app/api/cron/purge-deleted-accounts/route.ts`
- `kleen-app/src/app/api/cron/purge-contractor-documents/route.ts`
- Runbook: [`LEGAL_HOLDS_RUNBOOK.md`](./LEGAL_HOLDS_RUNBOOK.md)
- Admin: `/legal-holds` + `/api/legal-holds`
- Public: `/privacy`, `/terms`, `/cookies`
