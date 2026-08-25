# Admin staff access (kleen-admin)

## Recommended setup

**Do not share one inbox login** (`info@kleenapp.co.uk`) across multiple people. Each Kleen employee should have:

1. Their own **Supabase Auth** user (unique email + strong password)
2. An entry on **`admin_email_allowlist`** (added by a superadmin in Settings → Team)
3. **`profiles.role = admin`** (automatic on first sign-in if allowlisted)

`info@kleenapp.co.uk` is seeded as **superadmin** for bootstrap. For production hardening:

- Create a dedicated superadmin e.g. `admin-<random>@kleenapp.co.uk` (or a personal `@kleenapp.co.uk` address)
- Add new hires as **staff** (not superadmin) unless they need team management
- Use Supabase **MFA** for admin accounts when available

## Roles

| Role | Access |
|------|--------|
| **superadmin** | Full portal + Settings → Team (add/remove allowlist, promote staff) |
| **staff** | Jobs, contractors, customers, disputes — no team management |

## Adding a new employee

1. Superadmin → **Settings → Team** → add email as **Staff**
2. Supabase Dashboard → **Authentication → Users** → Invite user (same email)
3. Employee signs in at **admin.kleenapp.co.uk** — profile is created with `role=admin`

If the user already exists as a customer, adding to allowlist + Team **Add** will promote their profile to admin.

## Per-staff profile data

Stored on `profiles` for each admin user:

- `full_name`, `phone`, `email` — profile tab
- `admin_role` — `superadmin` | `staff`
- `admin_preferences` (JSON) — display settings (compact tables, alert sounds, toasts)

## Migration

Run **`048_admin_staff_roles.sql`** on Supabase before deploying the updated kleen-admin.

## Header features

- **Search (⌘K)** — jobs, customers, contractors, disputes via `/api/admin/search`
- **Notifications** — realtime job/contractor alerts (same store as toast bell)
- **Settings** — link to display preferences
- **Profile** — staff details + team link (superadmin only)
