# Google sign-in (customer app – kleen-app)

The customer app already has a “Continue with Google” button. To make it work you need to enable Google in Supabase and add OAuth credentials.

## 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.
2. **APIs & Services → Credentials** → **Create credentials** → **OAuth client ID**.
3. If prompted, configure the **OAuth consent screen** (External user type is fine; add app name, support email).
4. Application type: **Web application**.
5. **Authorized redirect URIs** – add:
   - **Supabase callback** (from your Supabase project):
     - `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
   - Example: `https://lticdjufnasigivblsyg.supabase.co/auth/v1/callback` (replace with your project ref from Supabase URL).
6. **Authorized JavaScript origins** – add your live domains:
   - `https://www.kleenapp.co.uk`
   - `https://kleenapp.co.uk`
   - `https://dashboard.kleenapp.co.uk`
7. Create and copy the **Client ID** and **Client secret**.

## 2. Supabase Dashboard

1. **Authentication → Providers** → open **Google**.
2. Enable the provider.
3. Paste **Client ID** and **Client secret** from Google.
4. **Authentication → URL configuration** (required for sign-in to work):
   - **Site URL**: your main live app URL (e.g. `https://dashboard.kleenapp.co.uk` if that’s where the app lives).
   - **Redirect URLs** – add every URL where users can sign in (missing = redirect fails, no dashboard):
     - `https://dashboard.kleenapp.co.uk/**`
     - `https://www.kleenapp.co.uk/**`
     - `https://kleenapp.co.uk/**`

Save. The app uses the **current origin** so if users sign in from dashboard.kleenapp.co.uk they are sent back to dashboard.kleenapp.co.uk/dashboard.

## 3. Why does Google show “Sign in to lticdjufnasigivblsyg.supabase.co”?

Google’s consent screen shows the **OAuth redirect domain** (where the token is sent). With Supabase Auth that domain is your Supabase project (`*.supabase.co`). That’s expected and can’t be changed without moving off Supabase Auth.

To make it feel more like your app:

- In **Google Cloud Console → OAuth consent screen**, set a clear **App name** (e.g. “Kleen”) and **App logo**. Google will show that name and logo on the consent screen; the “Sign in to …” line may still show the Supabase domain for technical reasons.

## 4. Redirect URLs in Supabase

In **Supabase → Authentication → URL configuration**, **Redirect URLs** must include **every** domain where users can hit sign-in or job flow (so the OAuth callback is allowed):

- `https://dashboard.kleenapp.co.uk/**`
- `https://www.kleenapp.co.uk/**`
- `https://kleenapp.co.uk/**`

## 5. After login → dashboard.kleenapp.co.uk

Flow: user on **www.kleenapp.co.uk** or **kleenapp.co.uk** → Get started (job flow) or Log in (sign-in page) → Continue with Google → after OAuth they are sent to **dashboard.kleenapp.co.uk/dashboard**.

Set **NEXT_PUBLIC_SITE_URL** in Vercel (kleen-app) to **https://dashboard.kleenapp.co.uk**. The app uses this in two places:

- **OAuth redirectTo**: Sign-in and job-flow send Google to **dashboard.kleenapp.co.uk/auth/callback** (not www), so the session cookie is set on the dashboard subdomain. That way when we redirect to dashboard.kleenapp.co.uk/dashboard, the user is logged in.
- **Auth callback**: After exchanging the code for a session, the callback redirects to `NEXT_PUBLIC_SITE_URL` + `/dashboard` so users land on the dashboard with a valid session.

## 6. Stop redirects to localhost

If after Google sign-in users land on **localhost:3000** with a `?code=...` URL, fix these:

**Supabase → Authentication → URL configuration**
- **Site URL** must be a **live** URL, e.g. `https://dashboard.kleenapp.co.uk`. If it is `http://localhost:3000`, change it and save.
- **Redirect URLs**: remove `http://localhost:3000/**` if it is in the list. Keep only your live URLs (`https://dashboard.kleenapp.co.uk/**`, `https://www.kleenapp.co.uk/**`, `https://kleenapp.co.uk/**`).

**Vercel → kleen-app → Environment Variables**
- **NEXT_PUBLIC_SITE_URL** must be `https://dashboard.kleenapp.co.uk`. If it is `http://localhost:3000` or missing, set it and redeploy.

The app now blocks “Continue with Google” on localhost and forces the callback to redirect to the live dashboard when the request host is localhost.

## 7. Optional: restrict to your domain

In Google OAuth consent screen you can limit sign-in to users from your organisation, or leave it open for any Google account. Restrictive options can be added later.
