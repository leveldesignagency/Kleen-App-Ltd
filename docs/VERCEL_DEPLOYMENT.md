# Deploying Kleen on Vercel (DNS from Wix, email stays on Wix)

You have two Next.js apps in this repo: **kleen-app** (customer dashboard) and **kleen-admin** (admin portal). Deploy them as **two separate Vercel projects** from the same repo, each on its own subdomain of the same domain:

| App            | Subdomain                      | Vercel project |
|----------------|--------------------------------|----------------|
| Customer dashboard | **dashboard.kleenapp.co.uk** | kleen-app (Root: `kleen-app`) |
| Admin portal   | **admin.kleenapp.co.uk**       | kleen-admin (Root: `kleen-admin`) |

---

## 1. Connect the repo to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub/GitLab/Bitbucket).
2. Import the Kleen repository.
3. You’ll create **two projects** (see below), both pointing at the same repo but with different **Root Directory** and env vars.

---

## 2. Create the two Vercel projects

### Project 1: Customer app (kleen-app)

- **Project name:** e.g. `kleen-app`
- **Root Directory:** `kleen-app` (set in project settings after creation if needed)
- **Framework:** Next.js (auto-detected)
- **Build command:** `npm run build` (default)
- **Output directory:** (leave default)
- **Install command:** `npm install` (default)

Add the domain: **dashboard.kleenapp.co.uk** (in Vercel → Settings → Domains).

### Project 2: Admin (kleen-admin)

- **Project name:** e.g. `kleen-admin`
- **Root Directory:** `kleen-admin`
- **Framework:** Next.js
- **Build command:** `npm run build`
- Same as above for install/output.

Add the domain: **admin.kleenapp.co.uk** (in Vercel → Settings → Domains).

---

## 3. Environment variables (Vercel dashboard → each project → Settings → Environment Variables)

### kleen-app (customer)

| Variable | Notes |
|---------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server-only) |
| `NEXT_PUBLIC_SITE_URL` | **Production URL:** `https://dashboard.kleenapp.co.uk` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | From Stripe Dashboard → Webhooks → your **production** endpoint (see below) |

### kleen-admin (admin)

| Variable | Notes |
|---------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Same as kleen-app |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as kleen-app |
| `SUPABASE_SERVICE_ROLE_KEY` | Same as kleen-app |
| `STRIPE_SECRET_KEY` | Same Stripe account |
| `RESEND_API_KEY` | From Resend |
| `RESEND_FROM_EMAIL` | e.g. `Kleen <info@kleenapp.co.uk>` or `Kleen <noreply@kleenapp.co.uk>`. In Resend, verify kleenapp.co.uk (add the SPF/DKIM records they give you in Wix DNS). Incoming email can stay on Wix (keep MX); Resend only sends. |

Set each for **Production** (and optionally Preview if you use branch deploys).

---

## 4. Stripe webhook (production)

1. Stripe Dashboard → [Developers → Webhooks](https://dashboard.stripe.com/webhooks).
2. **Add endpoint**
   - **URL:** `https://dashboard.kleenapp.co.uk/api/stripe/webhook`
   - **Events:** `payment_intent.succeeded` (and any others you use).
3. Copy the **Signing secret** (`whsec_...`).
4. In Vercel, for the **kleen-app** project, set `STRIPE_WEBHOOK_SECRET` to that value and redeploy if needed.

---

## 5. DNS at Wix (domain points to Vercel, email stays on Wix)

You’re only changing **web (A/CNAME)** records so the site is served by Vercel. **Leave all MX and email-related records as they are** so email stays on Wix.

1. In Wix: go to your domain’s DNS settings (or “Manage DNS” / “Advanced DNS” for the connected domain).
2. **Do not remove or change** any **MX** records (they keep email on Wix).
3. Add or update records so the **web** traffic goes to Vercel:

   **Subdomains for Kleen (dashboard + admin on kleenapp.co.uk):**

   | Type | Name (host) | Value (points to) | TTL |
   |------|-------------|-------------------|-----|
   | CNAME | `dashboard` | `cname.vercel-dns.com` | 3600 (or default) |
   | CNAME | `admin` | `cname.vercel-dns.com` | 3600 |

   That gives you **dashboard.kleenapp.co.uk** and **admin.kleenapp.co.uk**. In Vercel, add each domain to the correct project (dashboard → kleen-app, admin → kleen-admin). If Vercel shows a different target (e.g. `*.vercel.app`); use what Vercel shows in the “Domains” tab.

4. **Leave MX (and any TXT for email) as Wix’s values** so mail keeps working with Wix. You’re only adding the two CNAME records above for the subdomains.

Propagation can take up to 48 hours; often it’s much faster.

---

## 6. Add domains in Vercel

- **kleen-app:** Settings → Domains → add **dashboard.kleenapp.co.uk**
- **kleen-admin:** Settings → Domains → add **admin.kleenapp.co.uk**

Each project will only serve its own subdomain.

---

## 7. After deploy

- Open the customer app URL and run through sign-in and a test payment (with Stripe test mode if needed).
- In Stripe Dashboard → Webhooks, check that the production endpoint is receiving events (e.g. `payment_intent.succeeded`).
- Open the admin app, sign in, and test “Forward to contractor” so the Resend email sends from your domain (if you set `RESEND_FROM_EMAIL`).

---

## Quick checklist

- [ ] Two Vercel projects created (Root: `kleen-app` and `kleen-admin`)
- [ ] All env vars set for both projects (production)
- [ ] Stripe webhook: `https://dashboard.kleenapp.co.uk/api/stripe/webhook`; `STRIPE_WEBHOOK_SECRET` set in kleen-app
- [ ] `NEXT_PUBLIC_SITE_URL` = `https://dashboard.kleenapp.co.uk`
- [ ] Wix DNS: CNAME `dashboard` and CNAME `admin` → `cname.vercel-dns.com`; MX unchanged (email stays on Wix)
- [ ] Vercel: dashboard.kleenapp.co.uk on kleen-app; admin.kleenapp.co.uk on kleen-admin
