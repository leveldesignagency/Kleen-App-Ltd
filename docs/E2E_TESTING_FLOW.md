# End-to-end testing: job → quotes → email → accept → payment → admin email

Use this checklist to test the flow up to payment and notifications. Adjust URLs for production (`www.kleenapp.co.uk`, `dashboard.kleenapp.co.uk`, `admin.kleenapp.co.uk`).

## Prerequisites

| Item | Notes |
|------|--------|
| **Resend** | `RESEND_API_KEY` on **kleen-admin** (customer “quotes ready” email). On **kleen-app** (customer accepts → admin email via Stripe webhook). |
| **Resend limits** | Until `kleenapp.co.uk` is verified in Resend, you can usually only send **to** `info@kleenapp.co.uk`. Use that address for test customer accounts or expect customer quote emails to fail until the domain is verified. |
| **Stripe** | Test mode keys; webhook must hit kleen-app (`STRIPE_WEBHOOK_SECRET`, `stripe listen` locally or production URL in Stripe Dashboard). |

---

## 1. Customer: login & create job

1. Open **https://www.kleenapp.co.uk** (or **https://dashboard.kleenapp.co.uk**).
2. **Log in** (Google or email).
3. Start **Get a quote** / job flow and submit a job so a row exists in `jobs` (status e.g. `pending` or as your flow sets).

---

## 2. Admin: add quotes & send to customer

1. **https://admin.kleenapp.co.uk** → log in as admin.
2. Open the **Jobs** list → select the job.
3. **Add quote(s)** (contractor + price) or use **View quotes** page.
4. Click **Send to customer** or **Send all** (with 17.5% fee).
5. **Expected:** Job status → `sent_to_customer`. Customer receives Resend email (“quotes ready”) if `RESEND_API_KEY` is set on kleen-admin and Resend allows the recipient.

---

## 3. Customer: see quotes & email

1. Log in as the **customer** on **dashboard.kleenapp.co.uk**.
2. **Dashboard → Jobs → [job] → Quotes** (or equivalent).
3. Confirm quotes are visible and prices look correct.
4. Check inbox for the “quotes ready” email (link to `/dashboard/jobs/[id]`).

---

## 4. Customer: accept quote & pay (Stripe)

1. On the quotes page, **Accept** a quote → complete contract/terms if shown → **Pay** with a **test card** (e.g. `4242 4242 4242 4242`).
2. **Expected:** Payment succeeds; job → `customer_accepted`; payment recorded.

---

## 5. After pay → admin email & job state

1. The client calls **`POST /api/jobs/confirm-accept`** right after `confirmCardPayment` (so the UI updates quickly).
2. Stripe also sends webhooks to **kleen-app** `/api/stripe/webhook`. For **manual capture (escrow)**, subscribe at least to:
   - **`payment_intent.amount_capturable_updated`** (authorisation held)
   - **`payment_intent.succeeded`** (after **Release funds** runs capture, or legacy automatic capture)
   - **`checkout.session.completed`** if you use Checkout
3. **Expected:** `RESEND_API_KEY` on **kleen-app** emails **`ADMIN_NOTIFY_EMAIL`** (quote accepted / payment authorised). Job → `customer_accepted`; **`payment_authorized_at`** set; **`payment_captured_at`** after admin **Release funds** (capture + transfer).

**Local:** `stripe listen --forward-to <your-app-url>/api/stripe/webhook` and set `STRIPE_WEBHOOK_SECRET` to the printed `whsec_`.

**Production:** Stripe → Webhooks → `https://dashboard.kleenapp.co.uk/api/stripe/webhook` with the events above.

---

## 6. Admin: contractor email & field portal

- **Forward / send contractor email** (kleen-admin) — email includes **`/o/<token>`** on the customer app if `CONTRACTOR_PORTAL_BASE_URL` / `CUSTOMER_DASHBOARD_URL` is set.
- **Release funds** captures the PaymentIntent if needed, then Connect transfer.

See **`kleen-app/docs/FULL_JOB_FLOW_IMPLEMENTED.md`** for detail.

---

## Troubleshooting

| Issue | Check |
|-------|--------|
| No “quotes ready” email | kleen-admin `RESEND_API_KEY`; Resend recipient rules (verify domain or send only to `info@kleenapp.co.uk`). |
| No admin “quote accepted” email | kleen-app `RESEND_API_KEY`; webhook delivered (Stripe Dashboard → Webhooks → event logs); Vercel logs for `/api/stripe/webhook`. |
| Job stuck `sent_to_customer` after pay | Webhook not firing or wrong `STRIPE_WEBHOOK_SECRET`; metadata on PaymentIntent must include `job_id` and `quote_request_id`. |
