# Legal holds — ops runbook

Admin path: **Legal holds** (`/legal-holds`). API: `/api/legal-holds` (admin session).

## When to place a hold

| Reason | Examples |
|--------|----------|
| `fraud` | Stolen cards, fake accounts, payout abuse |
| `safety` | Assault/threat reports, serious safeguarding |
| `legal_claim` | Threatened or active civil claim |
| `regulatory` | ICO / police / regulator request |
| `dispute` | Escalated dispute needing intact records |
| `other` | Rare; **notes required** |

Do **not** place holds “just in case” for all users. Prefer anonymised ledgers.

## Subject IDs

- **user** — `profiles.id` (same as auth user id)
- **operative** — `operatives.id`
- **job** — `jobs.id`

## Effects

- Blocks `request_account_deletion` when hold is on:
  - that **user**, or
  - any **job** they own, or
  - their linked **operative** (contractor) row
- Skips daily purge cron (`purge-deleted-accounts`) for the same cases
- Skips contractor ID document purge for that operative
- Does **not** lock the user out of login by itself — use **Enforcement** bans for access control
- Admin contractor deactivate keeps PII + `user_id` so held evidence remains reachable

## Suspected illegal activity after delete request

1. Place a hold on **user** (and **job** / **operative** if relevant) immediately via Admin → Legal holds.
2. Even if the user already scheduled deletion, purge will skip until the hold is released.
3. If they have not scheduled yet, `request_account_deletion` will fail with a contact-privacy message.
4. Preserve evidence; do not manually hard-delete auth users while a hold is active.

## Release

Release when the investigation/claim ends. Then normal retention (30-day erase, 24-month docs, 6-year ledgers) resumes. If a scheduled deletion date already passed while held, the next purge run will erase once the hold is gone.

## Related

- `DATA_RETENTION.md`
- Privacy Policy §8
- Migrations `051_gdpr_retention_legal_holds.sql`, `068_harden_account_deletion_holds.sql`
