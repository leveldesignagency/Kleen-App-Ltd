# Connect domains (Vercel + Wix DNS)

Do this **after** Vercel projects (**kleen-app**, **kleen-contractor**, **kleen-admin**) are building and deployed.

## Contractor portal URL

**Canonical:** `https://contractor.kleenapp.co.uk`  
**Legacy:** `driver.kleenapp.co.uk` → automatically redirects to `contractor` (app middleware).

## 1. Add domains in Vercel

- **kleen-app** (customer dashboard): **Settings → Domains** → Add **dashboard.kleenapp.co.uk**
- **kleen-contractor** (contractor portal): **Settings → Domains** → Add **contractor.kleenapp.co.uk**
  - Keep **driver.kleenapp.co.uk** on the same project until DNS/email links are updated (redirects to contractor).
- **kleen-admin** (admin portal): **Settings → Domains** → Add **admin.kleenapp.co.uk**

Vercel may show a target (e.g. `cname.vercel-dns.com` or a project-specific CNAME). Note it for the next step.

## 2. Add DNS records at Wix

In Wix: **Domains** → your domain (kleenapp.co.uk) → **Manage DNS** / **Advanced DNS**.

- **Do not change or remove** any **MX** or email-related records (email stays on Wix).
- Add these records:

| Type  | Name (host)    | Value                     | TTL   |
|-------|----------------|---------------------------|-------|
| CNAME | `dashboard`    | `cname.vercel-dns.com`    | 3600  |
| CNAME | `contractor`   | `cname.vercel-dns.com`    | 3600  |
| CNAME | `admin`        | `cname.vercel-dns.com`    | 3600  |

Optional during migration (same Vercel project as contractor):

| Type  | Name (host) | Value                     | TTL   |
|-------|-------------|---------------------------|-------|
| CNAME | `driver`    | `cname.vercel-dns.com`    | 3600  |

If Vercel gave you a different target for each project, use the value Vercel shows in the Domains tab for that domain.

## 3. Wait for DNS

Propagation can take up to 48 hours (often minutes). Vercel will show a check when the domain is verified.

## 4. HTTPS

Vercel issues certificates automatically once DNS is correct. Use **https://dashboard.kleenapp.co.uk**, **https://contractor.kleenapp.co.uk**, and **https://admin.kleenapp.co.uk**.

## 5. Supabase Auth redirect URLs

In Supabase **Authentication → URL configuration**, add:

- `https://contractor.kleenapp.co.uk/**`
- `https://contractor.kleenapp.co.uk/auth/callback`

Keep `https://driver.kleenapp.co.uk/**` until you remove the old DNS record (optional during migration).

## 6. Environment variables after cutover

| Project | Variable | Value |
|---------|----------|--------|
| **kleen-contractor** | `NEXT_PUBLIC_SITE_URL` | `https://contractor.kleenapp.co.uk` |
| **kleen-app** | `NEXT_PUBLIC_CONTRACTOR_PORTAL_URL` | `https://contractor.kleenapp.co.uk` |
| **kleen-admin** | `CONTRACTOR_PORTAL_BASE_URL` | `https://contractor.kleenapp.co.uk` |

Also set `NEXT_PUBLIC_CUSTOMER_APP_URL` on kleen-contractor and `NEXT_PUBLIC_MARKETING_URL` as needed.
