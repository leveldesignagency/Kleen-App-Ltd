# Full job flow: payments, emails, contractor (no portal)

Single reference for: **payment escrow**, **who gets which email when**, **contractor flow without a portal**, and **72-hour release**.

---

## 1. Customer submits a job

| System | Action |
|--------|--------|
| DB | Job created, `status = pending`. `on_job_created` runs (existing). |
| In-app | Customer gets notification: "Job submitted! We'll send you a quote shortly." |
| Email – **customer** | **Confirmation email**: "Booking received – ref X, preferred date/time. We'll send your quote shortly." (Already in `on_job_created`.) |
| Email – **admin(s)** | **New job alert**: "New job submitted – ref X, service, postcode. [Link to admin job]." *(To add: e.g. notify all admin profiles or a fixed admin email.)* |

---

## 2. Admin adds quotes and sends to customer

| System | Action |
|--------|--------|
| DB | Admin sets `customer_price_pence` on quote_responses, `job.status = sent_to_customer`, `quotes_sent_to_customer_at`. |
| In-app | Customer gets notification: "Quote ready – view in dashboard and choose." (Existing via `on_job_status_change`.) |
| Email – **customer** | **Quotes ready**: "Your quote for [service] is ready. [Link to dashboard/jobs/[id]/quotes]." *(Ensure status change to `sent_to_customer` queues this; 013 may already do it.)* |

---

## 3. Customer accepts a quote (payment + escrow start)

| System | Action |
|--------|--------|
| DB | `job.status = customer_accepted`, `accepted_quote_request_id`, `customer_accepted_at`. Trigger 017 creates `job_assignments` row for accepted contractor. Other quote_requests get `customer_declined_at`. |
| Payment | **Capture customer payment** (Stripe): charge `customer_price_pence` (incl. 17.5%). Store `stripe_payment_intent_id`, `payment_captured_at` on job. Platform keeps 17.5%; remainder is held in escrow for contractor. *(To implement: Stripe PaymentIntent on accept; fail accept if payment fails.)* |
| In-app | Customer: "Quote accepted." (Existing via status change.) |
| Email – **customer** | **Acceptance confirmation**: "You accepted a quote for [service]. Your contractor has been assigned. We'll notify you when the job is complete." *(Can be same as status-change email for `customer_accepted`.)* |
| Email – **admin(s)** | **Customer accepted**: "Customer accepted a quote for job [ref]. Contractor: [name]. [Link to admin job]." *(To add: new trigger or extend status change to email admins.)* |
| Email – **contractor** | **You got the job**: "You've been assigned job [ref] – [service], [date/time], [postcode only / area]. Confirm you're doing this job: [magic link]. Full address and details after confirmation." *(To add: queue email to `operatives.email` for accepted operative; link to tokenised confirm page – see contractor section below.)* |

---

## 4. Contractor told and “confirms” (no portal)

Options without a contractor portal:

- **A. Email with magic link (recommended)**  
  - Email contains a signed link, e.g. `https://app.kleen.co.uk/job/confirm?token=xxx&job=uuid`.  
  - Token is a short-lived signed payload (e.g. JWT or HMAC) containing `job_id`, `operative_id`, `action=confirm`.  
  - Page (public or minimal auth): "Confirm you're doing this job" → one click sets `job_assignments.confirmed_at` (and optionally `job.status = awaiting_completion` if not already).  
  - Same pattern later for "I've completed this job" → sets `contractor_confirmed_complete_at` and optionally status.

- **B. Admin does it**  
  - Admin contacts contractor (phone/email); when contractor says yes, admin clicks "Contractor confirmed" in admin → set `job_assignments.confirmed_at` and/or `contractor_confirmed_complete_at`.  
  - No email to contractor or magic link; manual.

- **C. Contractor replies to email**  
  - Outbound email says "Reply YES to confirm." Inbound handler (e.g. SendGrid Inbound Parse) parses reply and calls an API to set `confirmed_at`.  
  - More setup; magic link is usually simpler.

**Recommended:** A. Implement magic-link pages: **Confirm job** and **Mark job complete**. Store tokens in DB or sign with a secret (job_id + operative_id + expiry). Same operative gets email when job is assigned and when we want completion update.

---

## 5. Contractor does the job – whereabouts / updates

Without a portal:

- **Option 1 – Email only**  
  - Contractor emails or calls admin; admin updates job notes or a simple “contractor en route” / “completed” flag in admin if you add it.

- **Option 2 – Magic link “I’m on my way” / “Job done”**  
  - Same tokenised link in the “You got the job” email could have two buttons: **Confirm** and **Mark complete** (or two separate emails: one for confirm, one sent day-of: “Mark complete when done”).  
  - “Mark complete” → set `contractor_confirmed_complete_at`, maybe `job.status = pending_confirmation`.  
  - No live “whereabouts” map needed for MVP; optional later.

---

## 6. Customer confirms job complete

| System | Action |
|--------|--------|
| DB | Customer clicks "Mark as complete" in dashboard → `customer_confirmed_complete_at` set. If contractor already confirmed → `job.status = completed`. |
| In-app | Customer: "Thanks for confirming. We'll release payment to the contractor after the security period." |
| Email – **customer** | **Completion confirmed**: "You confirmed completion for [ref]. If the contractor has also confirmed, payment will be released to them after 72 hours." |
| Email – **contractor** | **Customer confirmed**: "The customer has confirmed job [ref] as complete. Payment will be released to you in 72 hours." *(Optional.)* |
| Email – **admin** | **Both confirmed**: "Job [ref] – both parties confirmed. Funds will auto-release in 72h (or Release now)." *(Optional.)* |

---

## 7. Escrow period (72 hours) then release to contractor

| System | Action |
|--------|--------|
| Rule | **72 hours** after the *later* of `contractor_confirmed_complete_at` and `customer_confirmed_complete_at`, release contractor’s share (customer price minus 17.5%) to the contractor. |
| DB | Store `escrow_release_at` = that timestamp when both are set (or compute in cron). When releasing: set `funds_released_at`, `job.status = funds_released`. |
| Payment | **Stripe Transfer** (or payout) to contractor’s connected account: amount = customer payment minus 17.5% platform fee. *(Requires Stripe Connect for contractors.)* |
| Email – **contractor** | **Funds released**: "Payment for job [ref] has been sent to your account." |
| Email – **customer** | **Payment complete**: "Payment for [ref] has been released to your contractor. Thank you." |

If you need to **hold** (e.g. dispute): do not run release; resolve dispute first, then release or refund per resolution.

---

## 8. Emails checklist (who gets what)

| Event | Customer | Admin | Contractor |
|-------|----------|-------|------------|
| Customer submits job | ✓ Confirmation | ✓ New job alert | – |
| Quotes sent to customer | ✓ Quotes ready | – | – |
| Customer accepts quote | ✓ Accepted | ✓ Customer accepted | ✓ You got the job (with confirm link) |
| Contractor confirms job | (optional) Cleaner confirmed | ✓ Contractor confirmed | – |
| Contractor marks complete | (optional) | ✓ Contractor marked complete | – |
| Customer marks complete | ✓ Completion confirmed | (optional) Both confirmed | (optional) Customer confirmed |
| 72h passed, funds released | ✓ Payment complete | (optional) | ✓ Funds released |

---

## 9. Implementation order (suggested)

1. **Email sender**  
   - Worker or cron that processes `email_queue` (status = queued) and sends via Resend/SendGrid/etc. Mark sent/failed.

2. **Admin + customer emails**  
   - Ensure `on_job_created` and `on_job_status_change` queue the right emails.  
   - Add **admin new job** (on job insert) and **admin customer accepted** (on status → `customer_accepted`) – e.g. get admin emails from `profiles` where `role = 'admin'` and queue one each.

3. **Contractor “you got the job” email**  
   - On `customer_accepted`, look up accepted operative’s email, queue email with magic link to confirm page.

4. **Magic-link confirm page**  
   - Route: e.g. `/job/confirm?token=xxx`. Verify token, load job (anon), show "Confirm you're doing this job" → set `job_assignments.confirmed_at`, show success.

5. **Payment capture on accept**  
   - When customer accepts, create Stripe PaymentIntent for `customer_price_pence`, use customer’s default payment method; on success set `payment_captured_at` and complete accept; on failure show error and do not set accepted.

6. **Magic-link “mark complete” for contractor**  
   - Same token pattern; sets `contractor_confirmed_complete_at` and status.

7. **72h release job**  
   - Cron or scheduled function: find jobs where both confirmed, `escrow_release_at` ≤ now, `funds_released_at` is null; run Stripe transfer; set `funds_released_at` and status; queue “funds released” emails.

8. **Stripe Connect for contractors**  
   - Onboard contractors (Express or Custom); store `stripe_account_id` on operatives; use it for the transfer step.

---

## 10. Config / constants

- **Platform fee:** 17.5% (already in use).  
- **Escrow period:** 72 hours after both confirm.  
- **Magic link expiry:** e.g. 7 days for “confirm job”, 30 days for “mark complete”.

This doc is the single place for: payment escrow, who gets which email, and how the contractor receives the job and confirms/completes without a portal. Next step is implementing the email worker and the triggers/queues for each row in the table above, then payment capture, then magic links, then 72h release.
