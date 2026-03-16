# Admin dashboard – main admin (info@kleenapp.co.uk)

## Make info@kleenapp.co.uk an admin

Run the migrations (e.g. `npx supabase db push` from the `kleen-app` folder, or run the SQL in Supabase Dashboard → SQL Editor).

**Migration 022** does one of the following:

- **If info@kleenapp.co.uk does not exist:** creates the user with temporary password **`KleenAdmin1!`**. Sign in at the admin app and change the password immediately.
- **If info@kleenapp.co.uk already exists** (e.g. they signed up with Google or email): sets their profile role to `admin` so they can access the admin dashboard.

## Signing in to the admin app

1. Open **https://admin.kleenapp.co.uk** (or your admin URL).
2. Sign in with **info@kleenapp.co.uk** and the password (either the one they set when signing up, or **KleenAdmin1!** if the migration created the user).
3. Restrictive policies (IP, 2FA, etc.) can be added later.

## Existing admin (ryan@kleen.co.uk)

If you still have the seed admin **ryan@kleen.co.uk** from earlier migrations, you can leave it or remove it in Supabase (Auth → Users and/or run `DELETE FROM auth.users WHERE email = 'ryan@kleen.co.uk'`). info@kleenapp.co.uk is now the main admin.
