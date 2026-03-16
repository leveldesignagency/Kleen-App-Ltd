# Connect domains (Vercel + Wix DNS)

Do this **after** both Vercel projects (kleen-app and kleen-admin) are building and deployed.

## 1. Add domains in Vercel

- **kleen-app** (customer dashboard): **Settings → Domains** → Add **dashboard.kleenapp.co.uk**
- **kleen-admin** (admin portal): **Settings → Domains** → Add **admin.kleenapp.co.uk**

Vercel may show a target (e.g. `cname.vercel-dns.com` or a project-specific CNAME). Note it for the next step.

## 2. Add DNS records at Wix

In Wix: **Domains** → your domain (kleenapp.co.uk) → **Manage DNS** / **Advanced DNS**.

- **Do not change or remove** any **MX** or email-related records (email stays on Wix).
- Add these two records:

| Type  | Name (host)  | Value                     | TTL   |
|-------|--------------|---------------------------|-------|
| CNAME | `dashboard`  | `cname.vercel-dns.com`    | 3600  |
| CNAME | `admin`      | `cname.vercel-dns.com`    | 3600  |

If Vercel gave you a different target for each project, use the value Vercel shows in the Domains tab for that domain.

## 3. Wait for DNS

Propagation can take up to 48 hours (often minutes). Vercel will show a check when the domain is verified.

## 4. HTTPS

Vercel issues certificates automatically once DNS is correct. Use **https://dashboard.kleenapp.co.uk** and **https://admin.kleenapp.co.uk**.
