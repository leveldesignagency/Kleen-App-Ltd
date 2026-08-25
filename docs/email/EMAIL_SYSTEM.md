# Kleen transactional email system

All three apps send via **Resend** using a shared HTML layout (`src/lib/email/layout.ts` + `send.ts`).

## Required env (every app that sends mail)

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Required to send |
| `RESEND_FROM_EMAIL` | e.g. `Kleen <info@kleenapp.co.uk>` |
| `RESEND_FROM_VERIFIED` | `true` once domain verified in Resend |
| `RESEND_REPLY_TO` | Optional reply address |
| `RESEND_FORCE_ONBOARDING` | Dev only — force `onboarding@resend.dev` |
| `ADMIN_NOTIFY_EMAIL` | Admin inbox (default `info@kleenapp.co.uk`) |
| `ADMIN_APP_URL` | Admin deep links |
| `NEXT_PUBLIC_CUSTOMER_APP_URL` / `CUSTOMER_DASHBOARD_URL` | Customer CTAs |
| `NEXT_PUBLIC_CONTRACTOR_PORTAL_URL` / `CONTRACTOR_PORTAL_BASE_URL` | Contractor CTAs |

Diagnostics (kleen-app): `GET/POST /api/diagnostics/email` with admin/cron secret.

## Event catalog

### Customer
| Event | Trigger | App |
|-------|---------|-----|
| Welcome | OAuth callback / email signup → `/api/auth/welcome` | kleen-app |
| Job received | `/api/jobs/submit` | kleen-app |
| Quotes ready | Admin “notify customer” | kleen-admin |
| Booking confirmed | Stripe accept / confirm-accept | kleen-app |
| Full contract | After accept | kleen-app |
| On the way / arrived / complete request / incomplete | Field portal + contractor field API | kleen-app, kleen-contractor |
| Payment released | Admin release funds | kleen-admin |

### Contractor
| Event | Trigger | App |
|-------|---------|-----|
| Welcome | Auth callback / notify-admin-signup | kleen-contractor |
| Application submitted | Submit for review | kleen-contractor |
| Approved / needs updates | Admin verification | kleen-admin |
| New job to quote | Broadcast after job submit | kleen-app |
| Job booked | Quote accept | kleen-app |
| Quote not selected | Other quotes declined on accept | kleen-app |
| Customer confirmed completion | `/api/jobs/confirm-complete` | kleen-app |
| Funds released | Admin release | kleen-admin |

### Admin
| Event | Trigger | App |
|-------|---------|-----|
| New job | Job submit (+ cron backfill) | kleen-app |
| Quote accepted | Stripe accept | kleen-app |
| Contractor signup | notify-admin-signup | kleen-contractor |
| Contractor ready for review | Submit for review | kleen-contractor |
| Dispute opened | Customer dispute → `/api/disputes/notify-opened` | kleen-app |
| Job incomplete (field) | Incomplete field action | kleen-app / kleen-contractor |
| Support report | `/api/support/report` | kleen-app |
| Funds released | Release funds | kleen-admin |

## Notes

- Welcome emails are one-shot via `user_metadata.welcome_email_sent_at` (15-minute signup window).
- Field emails fire only on the first transition of each status.
- Legacy `email_queue` DB table is unused; sends are direct via Resend.
