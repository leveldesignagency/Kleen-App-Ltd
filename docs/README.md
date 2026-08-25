# Kleen documentation

Single place for project docs (legal, email, ops, auth, product).

## Legal & data protection
| Doc | Description |
|-----|-------------|
| [legal/DATA_RETENTION.md](./legal/DATA_RETENTION.md) | Retention matrix, anonymisation, legal holds principles |
| [legal/LEGAL_HOLDS_RUNBOOK.md](./legal/LEGAL_HOLDS_RUNBOOK.md) | How staff place/release holds in admin |

**Live customer-facing pages (in kleen-app):** `/privacy`, `/terms`, `/cookies`

**Migration:** `kleen-app/supabase/migrations/051_gdpr_retention_legal_holds.sql` (run in Supabase)

## Email
| Doc | Description |
|-----|-------------|
| [email/EMAIL_SYSTEM.md](./email/EMAIL_SYSTEM.md) | Resend event catalog + env checklist |

## Ops & environment
| Doc | Description |
|-----|-------------|
| [ops/ENVIRONMENT_VARIABLES.md](./ops/ENVIRONMENT_VARIABLES.md) | Env vars for all apps |
| [ops/VERCEL_DEPLOYMENT.md](./ops/VERCEL_DEPLOYMENT.md) | Vercel deploy notes |
| [ops/E2E_TESTING_FLOW.md](./ops/E2E_TESTING_FLOW.md) | End-to-end test flow |
| [ops/ADMIN_SETUP.md](./ops/ADMIN_SETUP.md) | Admin bootstrap |
| [ops/ADMIN_STAFF_ACCESS.md](./ops/ADMIN_STAFF_ACCESS.md) | Staff vs superadmin |
| [ops/CONTRACTOR_VERCEL_ENV.md](./ops/CONTRACTOR_VERCEL_ENV.md) | Contractor portal Vercel env |

## Auth & domains
| Doc | Description |
|-----|-------------|
| [auth/GOOGLE_AUTH_SETUP.md](./auth/GOOGLE_AUTH_SETUP.md) | Google OAuth |
| [auth/SUPABASE_AUTH_TROUBLESHOOTING.md](./auth/SUPABASE_AUTH_TROUBLESHOOTING.md) | Auth troubleshooting |
| [auth/CONNECT_DOMAINS.md](./auth/CONNECT_DOMAINS.md) | Domain wiring |
| [sql/FIX_ADMIN_LOGIN_NOW.sql](./sql/FIX_ADMIN_LOGIN_NOW.sql) | Emergency admin SQL |

## Product / marketplace
| Doc | Description |
|-----|-------------|
| [product/PLAN_job_workflow.md](./product/PLAN_job_workflow.md) | Job workflow plan |
| [product/FULL_JOB_FLOW_SPEC.md](./product/FULL_JOB_FLOW_SPEC.md) | Full job flow spec |
| [product/FULL_JOB_FLOW_IMPLEMENTED.md](./product/FULL_JOB_FLOW_IMPLEMENTED.md) | Implemented flow notes |
| [product/FLOW_AFTER_QUOTE_ACCEPTED.md](./product/FLOW_AFTER_QUOTE_ACCEPTED.md) | Post-accept flow |
| [product/JOB_MARKETPLACE_ALGORITHM.md](./product/JOB_MARKETPLACE_ALGORITHM.md) | Matching / broadcast |
| [product/MARKETPLACE_CONTRACT_FLOW.md](./product/MARKETPLACE_CONTRACT_FLOW.md) | Contracts |
| [product/SECURITY.md](./product/SECURITY.md) | App security notes |
| [product/STRIPE_WEBHOOK_LOCAL.md](./product/STRIPE_WEBHOOK_LOCAL.md) | Local Stripe webhooks |
| [product/QUOTES_DEBUG.md](./product/QUOTES_DEBUG.md) | Quotes debugging |
