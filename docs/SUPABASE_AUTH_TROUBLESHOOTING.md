# Supabase Auth troubleshooting

## Admin login (admin.kleenapp.co.uk) not working / 500 / "Invalid" / "Unable to process request"

Supabase only allows auth (including email/password) from **allowed origins**. If the admin portal URL isn’t listed, sign-in can fail with a generic error or 500.

**Fix:** In Supabase Dashboard → **Authentication** → **URL configuration** → **Redirect URLs**, add:

- `https://admin.kleenapp.co.uk/**`

(You can use the wildcard form `https://admin.kleenapp.co.uk/**` so all paths on that host are allowed.)

Save, then try signing in again at https://admin.kleenapp.co.uk/login. No need to change **Site URL** unless you want it to point at the admin app; Redirect URLs is what allows that origin to use Auth.

---

## "Database error querying schema" / 500 on admin.kleenapp.co.uk/login

This usually means **token columns on `auth.users` are NULL**. Supabase Auth requires `confirmation_token`, `recovery_token`, etc. to be empty strings `''`, not NULL, or sign-in returns 500.

**Do this first:** Open **`docs/FIX_ADMIN_LOGIN_NOW.sql`**, copy its contents into **Supabase Dashboard → SQL Editor**, run it, then try logging in again at https://admin.kleenapp.co.uk/login.

**Then:** Run migration **024** so the fix is applied in your migration history. If it still fails, in Supabase go to **Logs → Auth**, try signing in again, and check the exact error for that request.

---

## Admin vs customer role for new users

Users **added via Supabase Dashboard** (Authentication → Add user) should get **admin** role. Users who **sign up on the customer app** (dashboard.kleenapp.co.uk / Google) should get **customer** role.

**Migration 025** adds an **admin email allowlist** (`public.admin_email_allowlist`). When a new user is created, if their email is in this table they get `role = 'admin'`; otherwise they get `role = 'customer'`. The table is seeded with `info@kleenapp.co.uk`. To add more staff admins, insert their email (as an existing admin or via SQL): `insert into public.admin_email_allowlist (email) values ('staff@kleenapp.co.uk') on conflict (email) do nothing;`

## "Failed to send password recovery" / "Unable to process request" (500 on `/auth/v1/recover`)

- The recover endpoint looks up the user and sends an email. A 500 here is usually **server-side**, not the frontend.
- **1. Check Auth logs**  
  Dashboard → **Logs** → **Auth**. Look for the time you clicked “Send password recovery” and see the actual error (e.g. DB error, SMTP error).
- **2. Email / SMTP**  
  If you use **custom SMTP** (Project Settings → Auth → SMTP):
  - Ensure credentials and host/port are correct.
  - If using a provider like SES, ensure the **sending domain** is verified.
  - Try “Send test email” in the Dashboard if available.
  - If SMTP is wrong, Supabase can return a generic 500 on recover.
- **3. Use default Supabase email (no custom SMTP)**  
  Turn off custom SMTP so Supabase sends the recovery email. If recover works then, the problem is your SMTP config.
- **4. Create admin user without recovery**  
  If recover is still broken and you only need **info@kleenapp.co.uk** as admin:
  1. In **Authentication → Users**, delete **info@kleenapp.co.uk** if it exists (removes any bad row from earlier migrations).
  2. Click **Add user** → **Create new user**.
  3. Email: `info@kleenapp.co.uk`, Password: your chosen password (e.g. `#Robo123`). Create.
  4. Run migration **022** (or the SQL from it) so that user’s profile gets `role = 'admin'`.
  5. Log in to the admin app with that email and password (no recovery email needed).

After fixing, use **Send password recovery** again only if you need it; for the main admin account, setting the password in “Add user” is enough.
