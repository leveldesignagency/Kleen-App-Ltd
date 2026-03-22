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

## 5. Webhook → admin email (“quote accepted”)

1. After successful payment, Stripe sends **`payment_intent.succeeded`** (and/or checkout completed) to **kleen-app** `/api/stripe/webhook`.
2. **Expected:** `RESEND_API_KEY` on **kleen-app** sends an email to **`ADMIN_NOTIFY_EMAIL`** (default `info@kleenapp.co.uk`) with job ref, customer name, amount, link to admin job.

**Local:** Run `stripe listen --forward-to localhost:3100/api/stripe/webhook` and use the printed `whsec_` in `STRIPE_WEBHOOK_SECRET`.

**Production:** Stripe Dashboard → Webhooks → endpoint `https://dashboard.kleenapp.co.uk/api/stripe/webhook` with `payment_intent.succeeded` (and any other events you use).

---

## 6. Next: payment & escrow (study)

- **Held funds:** Job should show `payment_captured_at` after accept.
- **Admin:** “Forward to contractor”, completion confirmations, **Release funds** (Stripe Connect) — see `docs/FLOW_AFTER_QUOTE_ACCEPTED.md` and `kleen-app/docs/FULL_JOB_FLOW_SPEC.md`.

---

## Troubleshooting

| Issue | Check |
|-------|--------|
| No “quotes ready” email | kleen-admin `RESEND_API_KEY`; Resend recipient rules (verify domain or send only to `info@kleenapp.co.uk`). |
| No admin “quote accepted” email | kleen-app `RESEND_API_KEY`; webhook delivered (Stripe Dashboard → Webhooks → event logs); Vercel logs for `/api/stripe/webhook`. |
| Job stuck `sent_to_customer` after pay | Webhook not firing or wrong `STRIPE_WEBHOOK_SECRET`; metadata on PaymentIntent must include `job_id` and `quote_request_id`. |
