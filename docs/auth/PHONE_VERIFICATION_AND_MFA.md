# Phone verification & authentication security

## Current model (after migration 062)

| Identity | How it is verified | What it proves |
|----------|-------------------|----------------|
| **Customer / contractor email** | Google OAuth or email+password via Supabase Auth | User controls that email inbox |
| **Mobile number** | SMS OTP via Supabase Phone Auth (`updateUser` + `verifyOtp`) | User controls that handset |
| **Admin staff** | Email+password + optional **TOTP MFA** (authenticator app) | Staff credential + second factor |
| **Contractor marketplace access** | Kleen admin manual review (`operatives.is_verified`) | Business legitimacy, documents, bank details |

Phone numbers on `profiles.phone` and `operatives.phone` are **display fields**. Trust comes from `phone_verified_at` (set only after a successful OTP).

## Enable SMS (required for phone verification)

1. **Supabase Dashboard → Authentication → Providers → Phone** — enable Phone provider.
2. Connect **Twilio** (or another supported SMS provider) with account SID, auth token, and a UK-capable sender.
3. Apply migration `062_phone_verification.sql` on your Supabase project.
4. Test on staging: Profile → enter UK mobile → **Send verification code** → enter SMS code.

If Phone is not configured, APIs return `503` with `code: sms_not_configured`.

## User flows

### Customers (`kleen-app`)

- **Profile** and **Account** use `PhoneVerificationPanel` (not a free-text save).
- **Job submit** (`POST /api/jobs/submit`) returns `403` with `phone_not_verified` until the profile phone is verified.

### Contractors (`kleen-contractor`)

- **Company & profile** → Contact section uses SMS verification (`target=operative`).
- **Submit for review** and onboarding checklist require `phone_verified_at`.
- Verified phone syncs to both `profiles` and `operatives`.

### Admin (`kleen-admin`)

- **Settings → Security → Two-factor authentication** — enroll TOTP (Google Authenticator, 1Password, etc.).
- **Login** prompts for authenticator code when MFA is enrolled.
- Middleware blocks portal access until session reaches **AAL2** when TOTP is active.

## API routes

| App | Route | Methods |
|-----|-------|---------|
| kleen-app | `/api/auth/phone` | `GET` status, `POST` send OTP, `PUT` verify OTP |
| kleen-contractor | `/api/auth/phone` | same |

Rate-limited under the `auth` bucket (10 req/min per IP).

## Is Google OAuth safe for contractor sign-up?

**Yes for authentication** — Google has already verified email ownership and provides phishing-resistant sign-in for users who enable Google 2FA on their Google account.

**No as sole trust signal for contractors** — Google does **not** prove:

- UK business registration or sole-trader identity
- Right to work / DBS / insurance
- Ownership of a phone number (until Kleen SMS verify)
- That the person is not a banned identity (handled by `identity_blocklist` + enforcement)

**Defence in depth for contractors:**

1. Google (or email) sign-in — account identity
2. SMS phone verification — reachable mobile
3. Document upload + Companies House fields — onboarding data
4. Admin manual verification — `is_verified` before marketplace jobs
5. Account enforcement — bans, appeals, identity blocklist

Anyone with a Google account can **start** contractor onboarding; they cannot accept paid marketplace work until Kleen approves them.

## What we do *not* use phone verification for (yet)

- **Login 2FA for customers/contractors** — sign-in remains Google/email; phone verify is for account integrity and contactability, not step-up auth on every login.
- **SMS notifications** — `sms_opt_in` and notification channels exist separately; OTP uses Supabase Auth SMS only.

To add login-time SMS 2FA later, enable Supabase MFA phone factors or a custom step-up after password/OAuth.

## Ops checklist

- [ ] Apply migration 062
- [ ] Enable Phone provider + Twilio in Supabase
- [ ] Smoke-test customer profile verify + job submit
- [ ] Smoke-test contractor profile verify + submit for review
- [ ] Enroll TOTP on all admin staff accounts
- [ ] Keep `SITE_ACCESS_GATE` off for public launch

See also: [GOOGLE_AUTH_SETUP.md](./GOOGLE_AUTH_SETUP.md), [../product/SECURITY.md](../product/SECURITY.md).
