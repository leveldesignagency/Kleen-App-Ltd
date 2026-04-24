# Connect domains (Vercel + Wix DNS)

Do this **after** Vercel projects (**kleen-app**, **kleen-contractor**, **kleen-admin**) are building and deployed.

## 1. Add domains in Vercel

- **kleen-app** (customer dashboard): **Settings → Domains** → Add **dashboard.kleenapp.co.uk**
- **kleen-contractor** (contractor portal): **Settings → Domains** → Add e.g. **contractors.kleenapp.co.uk** (do not use the customer dashboard host for this app)
- **kleen-admin** (admin portal): **Settings → Domains** → Add **admin.kleenapp.co.uk**

Vercel may show a target (e.g. `cname.vercel-dns.com` or a project-specific CNAME). Note it for the next step.

## 2. Add DNS records at Wix

In Wix: **Domains** → your domain (kleenapp.co.uk) → **Manage DNS** / **Advanced DNS**.

- **Do not change or remove** any **MX** or email-related records (email stays on Wix).
- Add these records:

| Type  | Name (host)  | Value                     | TTL   |
|-------|--------------|---------------------------|-------|
| CNAME | `dashboard`    | `cname.vercel-dns.com`    | 3600  |
| CNAME | `contractors`  | `cname.vercel-dns.com`    | 3600  |
| CNAME | `admin`        | `cname.vercel-dns.com`    | 3600  |

If Vercel gave you a different target for each project, use the value Vercel shows in the Domains tab for that domain.

## 3. Wait for DNS

Propagation can take up to 48 hours (often minutes). Vercel will show a check when the domain is verified.

## 4. HTTPS

Vercel issues certificates automatically once DNS is correct. Use **https://dashboard.kleenapp.co.uk**, **https://contractors.kleenapp.co.uk** (or the hostname you chose), and **https://admin.kleenapp.co.uk**.

## 5. Supabase Auth redirect URLs

In Supabase **Authentication → URL configuration**, add the contractor portal origin (e.g. `https://contractors.kleenapp.co.uk`) to **Redirect URLs**, including `https://contractors.kleenapp.co.uk/auth/callback` if you use Google OAuth for contractors.

## 6. Environment variables after cutover

- **kleen-app**: `NEXT_PUBLIC_CONTRACTOR_PORTAL_URL` = contractor portal origin (enables redirects from old `/contractor` links on the customer app).
- **kleen-contractor**: `NEXT_PUBLIC_SITE_URL` = contractor portal origin; `NEXT_PUBLIC_CUSTOMER_APP_URL` = customer dashboard origin; same Supabase keys as kleen-app.
- **kleen-admin**: `CONTRACTOR_PORTAL_BASE_URL` = contractor portal origin (links in contractor emails).
