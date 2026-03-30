# Environment variables

Configure these in Vercel (or your host) for each app. Values are examples — use your own secrets and URLs.

---

## Shared (same Supabase project)

| Variable | Where | Purpose |
| -------- | ----- | ------- |
| `NEXT_PUBLIC_SUPABASE_URL` | kleen-app, kleen-admin | Supabase project URL (public). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | kleen-app, kleen-admin | Supabase anonymous key (public; RLS applies). |
| `SUPABASE_SERVICE_ROLE_KEY` | kleen-app, kleen-admin | Supabase service role key — **server-only**. Never expose to the browser. |

---

## kleen-app (customer app + marketing + contractor portal)

### Public (`NEXT_PUBLIC_*`)

| Variable | Purpose |
| -------- | ------- |
| `NEXT_PUBLIC_SITE_URL` | Canonical dashboard/app URL (no trailing slash), e.g. `https://dashboard.kleenapp.co.uk`. Used for OAuth redirects (`/auth/callback`), Stripe return URLs, and checkout. |
| `NEXT_PUBLIC_MARKETING_URL` | Optional. When set, dashboard sidebars link “home” to your marketing site (e.g. `https://www.kleenapp.co.uk`). If unset, dashboard uses `window.location.origin`/`/` behaviour as coded. |
| `NEXT_PUBLIC_ENABLE_EMAIL_AUTH` | Set to `true` to enable email/password sign-up and sign-in (job flow, marketing sign-in, contractor join). |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe.js publishable key for customer card collection. |

### Server-only

| Variable | Purpose |
| -------- | ------- |
| `STRIPE_SECRET_KEY` | Stripe secret API key (payments, Connect onboarding, webhooks). |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `POST /api/stripe/webhook`. |
| `RESEND_API_KEY` | [Resend](https://resend.com) API key for transactional email. |
| `RESEND_FROM_EMAIL` | `From` address (must be verified in Resend). |
| `RESEND_FROM_VERIFIED` | Set to `true` when the domain/sender is verified in Resend. |
| `RESEND_REPLY_TO` | Optional reply-to address. |
| `RESEND_FORCE_ONBOARDING` | Optional; dev/testing flag read in `resend-config.ts`. |
| `ADMIN_NOTIFY_EMAIL` | Email for internal admin notifications (default `info@kleenapp.co.uk`). |
| `ADMIN_APP_URL` | Base URL of the admin app (default `https://admin.kleenapp.co.uk`). |
| `CRON_SECRET` | Bearer secret for `GET /api/cron/purge-deleted-accounts` (if you use Vercel Cron). |
| `DATABASE_URL` | PostgreSQL connection string for **Prisma** (`kleen-app/prisma/schema.prisma`). |

### Automatic (usually do not set manually)

| Variable | Purpose |
| -------- | ------- |
| `VERCEL_URL` | Fallback base URL for Stripe Connect URLs when `NEXT_PUBLIC_SITE_URL` is empty (Vercel injects this). |
| `NODE_ENV` | `development` / `production` (standard Node). |

---

## kleen-admin

### Public

| Variable | Purpose |
| -------- | ------- |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as kleen-app. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as kleen-app. |
| `NEXT_PUBLIC_CUSTOMER_APP_URL` | Optional fallback for links in emails when other contractor URL vars are unset. |

### Server-only

| Variable | Purpose |
| -------- | ------- |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role for admin API routes. |
| `STRIPE_SECRET_KEY` | Stripe (release funds, sync operative bank). |
| `RESEND_API_KEY` | Sending emails from admin. |
| `RESEND_FROM_EMAIL` | Verified sender. |
| `RESEND_FROM_VERIFIED` | Set to `true` when verified. |
| `CUSTOMER_DASHBOARD_URL` | Customer-facing dashboard base (default `https://dashboard.kleenapp.co.uk`). Used in customer emails. |
| `CONTRACTOR_PORTAL_BASE_URL` | Preferred base for contractor links in emails (e.g. `https://dashboard.kleenapp.co.uk`). Falls back to `NEXT_PUBLIC_CUSTOMER_APP_URL` then `CUSTOMER_DASHBOARD_URL` in `send-contractor-email`. |

---

## Supabase Auth (Google OAuth)

- Configure **redirect URLs** in the Supabase dashboard to include your app callback, e.g. `https://dashboard.kleenapp.co.uk/auth/callback`.
- The app uses `NEXT_PUBLIC_SITE_URL` for OAuth when not on localhost.

---

## Quick checklist

| App | Must have |
| --- | --------- |
| `kleen-app` | `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` (production), `STRIPE_*`, `DATABASE_URL` + Resend vars if you send mail |
| `kleen-admin` | `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, Resend vars, `CONTRACTOR_PORTAL_BASE_URL` or `CUSTOMER_DASHBOARD_URL` for contractor email links |
