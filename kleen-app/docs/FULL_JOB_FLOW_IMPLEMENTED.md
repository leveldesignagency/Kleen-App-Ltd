# End-to-end job flow (implemented)

## 1. New job → admin email

- After a customer submits a job (job flow confirmation step), the app calls `POST /api/jobs/notify-admin-new-job` with the new `jobId`.
- Requires `RESEND_API_KEY` on **kleen-app** (same as quote-accepted emails). Admin inbox: `ADMIN_NOTIFY_EMAIL` (default `info@kleenapp.co.uk`).

## 2. Quotes → customer email

- Unchanged: admin sends quotes from **kleen-admin** → `notify-customer-quotes` (Resend).

## 3. Customer accepts → escrow (authorized, not captured)

- Card payments use **manual capture** (`capture_method: manual`). The customer’s card is **authorised**; funds are held until you **Release funds** in admin.
- `payment_authorized_at` is set; `payment_captured_at` is set when you release (capture + transfer) or when Stripe sends `payment_intent.succeeded` after capture.
- Client calls `POST /api/jobs/confirm-accept` after `confirmCardPayment` so the UI updates even if the webhook is delayed.

## 4. Stripe webhooks (kleen-app)

Add these events for the dashboard endpoint:

- `checkout.session.completed` (if you use Checkout)
- `payment_intent.amount_capturable_updated` (manual authorisation)
- `payment_intent.succeeded` (capture completed / legacy automatic PI)

## 5. Release funds (admin)

- `POST /api/stripe/release-funds` (kleen-admin) now **captures** the PaymentIntent if it is still `requires_capture`, then transfers to the contractor Connect account (if `stripe_account_id` is set).

## 6. Contractor field portal

- Public URL: **`/o/[token]`** on the customer app (e.g. `https://dashboard.kleenapp.co.uk/o/<token>`).
- Token is stored on `jobs.operative_portal_token` (created when the customer’s payment is authorised, or when admin sends the contractor email if missing).
- Contractor email from admin includes **Open job status page** using `CONTRACTOR_PORTAL_BASE_URL` or `CUSTOMER_DASHBOARD_URL` / `NEXT_PUBLIC_CUSTOMER_APP_URL`.

## 7. Verified “from” address (Resend)

- Set **`RESEND_FROM_VERIFIED=true`** and **`RESEND_FROM_EMAIL`** (e.g. `Kleen <info@kleenapp.co.uk>`) once **kleenapp.co.uk** is verified in Resend so emails are not forced through `onboarding@resend.dev`.

## Database

- Apply migration **`028_full_flow_operative_portal_escrow.sql`** (adds operative portal columns, `payment_authorized_at`, and `payment_status` value `authorized` if needed).
