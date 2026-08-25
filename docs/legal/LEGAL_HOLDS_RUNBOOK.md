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

- Blocks `request_account_deletion` for that user
- Skips purge cron for that user / jobs linked under hold checks
- Skips contractor document purge for that operative

## Release

Release when the investigation/claim ends. Then normal retention (30-day erase, 24-month docs, 6-year ledgers) resumes.

## Related

- `DATA_RETENTION.md`
- Privacy Policy §8
- Migration `051_gdpr_retention_legal_holds.sql` (must be applied on Supabase)
