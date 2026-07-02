# Kleen security (kleen-app + kleen-admin)

Adapted from production hardening checklist. Kleen uses **Supabase Auth** (not NextAuth) and has no AI/convert/share-download routes.

## Implemented

| Control | Where |
|---------|--------|
| Sliding-window rate limits per IP + per user | Middleware on all `/api/*` |
| Stricter buckets | `site-access/unlock`, `jobs/submit`, `support/report`, Stripe, diagnostics, contractor portal token, cron |
| 429 + `Retry-After` + `X-RateLimit-*` | `lib/security/rate-limit.ts` |
| `withSecureApiRoute()` | Expensive kleen-app handlers |
| Security headers | Middleware + `next.config.mjs` |
| Private portal token responses | `Cache-Control: private, no-store`, `X-Robots-Tag: noindex` |
| Production `/api/health` | `{ ok, service }` only — no env leakage |
| `/api/auth/status` | Minimal public probe; full snapshot with `ADMIN_SECRET` |
| Block `/api/test*` | Production middleware → 404 |
| PII redaction helpers | `redactEmail()`, `redactText()` |
| Admin Security tab | Settings → Security (`/api/admin/security`) |

## Not applicable to Kleen

- AI prompt injection / `wrapUserContent()` — no AI routes
- NEXTAUTH JWT / SHARE_LINK HMAC downloads — use Supabase sessions + `operative_portal_token` on jobs
- `ALLOW_DEV_AUTH` — not used; guarded env checks exist if added later

## Environment variables

```bash
# Strong secret for staff diagnostics (optional; falls back to CRON_SECRET)
ADMIN_SECRET=

# Optional separate signing secret for future share links
SHARE_LINK_SECRET=

# Must be UNSET in production (never "false")
# ALLOW_DEV_AUTH=
# NEXT_PUBLIC_ALLOW_DEV_AUTH=
# ALLOW_X_USER_EMAIL_HEADER=

# Customer preview gate — disable when launching publicly
SITE_ACCESS_GATE_ENABLED=
NEXT_PUBLIC_SITE_ACCESS_GATE_ENABLED=
```

## GitHub / ops

- Keep repo private, 2FA on GitHub
- Secrets only in Vercel/hosting env — never in git
- Unset dev bypass vars in production (omit entirely)
