# Kleen — Full Job Workflow Implementation Plan

> This document outlines every piece of work needed to bring the job lifecycle
> from customer submission through to fund release, disputes, and reviews.
> Each phase is independent enough to be tackled in order, tested, then moved on.

---

## Current State (what already exists)

| Area | Status |
|------|--------|
| Customer job submission flow | Done — jobs persist to Supabase |
| Customer dashboard (job list, cancel) | Done — cards only, no detail page |
| Admin job list + detail page | Done — workflow buttons exist |
| Admin quote request → contractor | Done — UI sends requests, stores responses |
| 17.5% service fee markup logic | Done — calculated in admin detail page |
| Database tables for disputes, reviews, notifications, email queue | Done — schema exists, no frontend wiring |
| Toast notifications (both apps) | Done |
| Stripe integration | Not started — schema columns exist, no SDK |
| Email sending | Not started — queue table exists, no provider |
| In-app notification inbox | Not started — DB table exists, no UI |
| Contractor portal / response UI | Not started |
| Customer job detail + quote view | Not started |
| Review system UI | Not started |

---

## Phase 1 — Customer Job Detail Page

**Goal:** When a customer clicks a job, it expands into a full detail page
showing the job spec, current status, and (when available) contractor quotes
to accept or decline.

### Tasks

1. **Create `/dashboard/jobs/[id]/page.tsx`** in `kleen-app`
   - Fetch job + job_details + quotes from Supabase by job ID
   - Display: service type, area details, cleaning depth, preferred date/time,
     address, operatives, status badge
   - Show a timeline/progress bar matching the job status

2. **Quotes section** (visible when status is `sent_to_customer` or later)
   - Fetch `quote_responses` for this job where `customer_price_pence` is set
   - Display each quote as a card: contractor rating (anonymised, e.g. "Contractor A"),
     customer price (includes our markup), estimated duration
   - **Do NOT reveal** contractor name, company, or raw price to the customer
   - "Accept" button on each quote — calls API to set `accepted_quote_request_id`,
     update job status to `customer_accepted`, record `customer_accepted_at`
   - "Decline All" button — sets status back or to `cancelled`

3. **Cancel button** (visible while status is `pending`, `awaiting_quotes`,
   `quotes_received`, `sent_to_customer`)
   - Confirmation modal
   - On cancel: update job status to `cancelled`
   - Trigger notification to admin + contractor (if quotes were in progress)

4. **Link from job cards** in `/dashboard/jobs` to `/dashboard/jobs/[id]`

---

## Phase 2 — In-App Notification System

**Goal:** Both customer and admin dashboards get a notification bell with
an inbox, backed by the existing `notifications` table.

### Tasks

1. **Notification bell component** (`NotificationBell.tsx`)
   - Sits in the dashboard header (both apps)
   - Shows unread count badge (uses `unread_notification_count` view)
   - On click, opens a dropdown/panel listing recent notifications
   - Each item: icon, title, body, relative timestamp, read/unread styling
   - "Mark all as read" action
   - Click a notification → navigate to relevant page (e.g. job detail)

2. **Supabase Realtime subscription**
   - Subscribe to `notifications` table filtered by `user_id`
   - On new row → increment badge, show toast, prepend to inbox list
   - This gives instant push without polling

3. **Notification triggers** (extend existing DB triggers or add new ones)
   - `quote_ready` — when admin sends marked-up quotes to customer
   - `quote_accepted` — when customer accepts a quote (notify admin)
   - `job_cancelled` — when customer cancels (notify admin + contractor)
   - `job_completed` — when both parties confirm completion
   - `funds_released` — when funds clear
   - `dispute_opened` — when either party opens a dispute
   - `dispute_resolved` — when admin resolves a dispute

4. **Admin notification bell** — same component, dark themed,
   in `kleen-admin` header

---

## Phase 3 — Full Quote Pipeline (Auto-feed to Customer)

**Goal:** When contractors respond with quotes, the system automatically
marks up 17.5%, and once the admin is satisfied, pushes them to the
customer's dashboard with a notification.

### Tasks

1. **Admin "Send to Customer" action** (partially exists)
   - When admin clicks "Send Quotes to Customer":
     - For each `quote_response` with a price, calculate
       `customer_price_pence = contractor_price * 1.175`
     - Update `quote_responses` with `customer_price_pence`
     - Update job status → `sent_to_customer`
     - Set `quotes_sent_to_customer_at` on the job
     - Insert a `notifications` row for the customer:
       title "Quotes Ready", body "You have X quotes for your [service] job"
     - Queue an email to customer (optional, Phase 7)

2. **Customer accepts a quote** (from Phase 1 detail page)
   - Update `jobs.accepted_quote_request_id`
   - Update job status → `customer_accepted`
   - Insert notification for admin: "Customer accepted a quote for Job #X"
   - **Trigger Stripe payment capture** (Phase 5)
   - Queue email to winning contractor with full job description

3. **Customer declines all quotes**
   - Update job status → `cancelled` (or a new `declined` status)
   - Notify admin
   - Queue email to all contractors on this job: "Job is no longer available"

4. **Contractor notification on cancellation**
   - If a job is cancelled at any stage after quotes were requested,
     queue an email to each contractor who received a quote request

---

## Phase 4 — Job Completion & Dual Confirmation

**Goal:** Both the customer and the contractor must confirm the job is
complete before funds can be released.

### Tasks

1. **Contractor confirmation**
   - For now (no contractor portal): admin marks "Contractor confirmed"
     on the job detail page based on email/call from contractor
   - Future: contractor portal or email link to confirm
   - Sets `contractor_confirmed_complete_at`

2. **Customer confirmation**
   - On the customer job detail page, when status is `awaiting_completion`
     or `pending_confirmation`:
     - Show "Mark as Complete" button
     - Confirmation modal: "Confirm the job has been completed to your
       satisfaction?"
     - Sets `customer_confirmed_complete_at`

3. **Both confirmed → status `completed`**
   - When both timestamps are set, auto-update status to `completed`
   - Trigger: review request notification to customer
   - Start the 5-day escrow countdown (Phase 5)

4. **If customer is NOT satisfied**
   - Instead of "Mark as Complete", they click "Raise Dispute"
   - This opens the dispute flow (Phase 6)

---

## Phase 5 — Stripe Payments & Escrow

**Goal:** Capture payment from customer on quote acceptance, hold in escrow,
release to contractor after 5-day window (or hold if disputed).

### Tasks

1. **Stripe setup**
   - Install `stripe` package in both apps
   - Add env vars: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`,
     `STRIPE_WEBHOOK_SECRET` to both `.env.local` files
   - Create Stripe account, enable Stripe Connect for contractor payouts

2. **Payment capture on quote acceptance**
   - When customer accepts a quote:
     - Create a Stripe PaymentIntent for the `customer_price_pence`
     - Use the customer's saved payment method (or prompt for one)
     - On success: store `stripe_payment_intent_id` on the job,
       set `payment_captured_at`
     - On failure: show error, don't update job status

3. **Escrow / hold logic**
   - Stripe captures funds immediately into the platform account
   - A server-side scheduled job (Supabase Edge Function or cron)
     checks daily for jobs where:
       - `status = 'completed'`
       - `customer_confirmed_complete_at` is > 5 days ago
       - `funds_released_at` is null
       - No open dispute
     - For qualifying jobs: trigger Stripe Transfer to contractor's
       connected account, set `funds_released_at`

4. **Stripe Connect onboarding for contractors**
   - When admin adds banking details for a contractor, use Stripe Connect
     "Custom" or "Express" account to create an account
   - Store `stripe_account_id` on the operative
   - Admin can trigger onboarding link from contractor detail page

5. **Fund release**
   - Auto after 5 days (cron), or manual via admin "Release Funds" button
   - Creates a Stripe Transfer from platform to contractor connected account
   - Updates `funds_released_at`, status → `funds_released`
   - Notifies both parties

6. **Refunds** (dispute scenario)
   - If a dispute is resolved in the customer's favour,
     issue a Stripe Refund on the PaymentIntent
   - If resolved in contractor's favour, proceed with normal fund release

---

## Phase 6 — Disputes System

**Goal:** Both customer and admin dashboards have a working disputes section
where evidence can be submitted and disputes managed.

### Tasks

1. **Customer dispute creation**
   - On job detail page (when status is `awaiting_completion`,
     `pending_confirmation`, or `completed`):
     - "Raise Dispute" button
     - Modal/form: select reason (from enum), describe the issue, upload
       evidence (photos — Supabase Storage)
     - Inserts into `disputes` table, status `open`
     - Updates job status to `disputed`
     - Notifies admin + contractor (email for contractor)

2. **Customer disputes page** (`/dashboard/disputes`)
   - Wire existing page to Supabase instead of mock data
   - List all disputes for the current user
   - Click to expand: shows dispute details, messages, resolution status
   - Customer can add follow-up messages via `dispute_messages`

3. **Admin disputes page** (`/disputes` in kleen-admin)
   - New page in admin sidebar
   - List all disputes: job reference, customer, contractor, status, date
   - Click to expand: full dispute detail with messages from both sides
   - Admin actions: "Resolve — Customer Favour" (refund),
     "Resolve — Contractor Favour" (release funds),
     "Resolve — Partial Refund" (split)
   - On resolution: update `disputes.status`, `disputes.resolution`,
     trigger fund action, notify both parties

4. **Contractor dispute interaction**
   - For now: email-based. Admin sends contractor the dispute details,
     contractor responds via email, admin logs their response as a
     `dispute_message` with `sender_role = 'operative'`
   - Future: contractor portal for direct dispute messaging

5. **Dispute holds**
   - If a dispute is open, the 5-day escrow timer pauses
   - Funds are not released until the dispute is resolved
   - Admin "Release Funds" button is disabled while disputed

---

## Phase 7 — Reviews & Ratings

**Goal:** After job completion, customers rate their contractor and the
Kleen service. Contractor ratings aggregate and display in the admin portal.

### Tasks

1. **Review prompt**
   - After both parties confirm completion (or after fund release),
     send notification to customer: "How was your experience?"
   - On job detail page, show a review form (if no review exists yet)

2. **Review form** (customer job detail page)
   - Star rating (1–5) for the contractor
   - Written comment (optional)
   - Separate star rating for Kleen service (1–5)
   - On submit: insert into `reviews` table
   - Optional: "Leave a Google Review" link/button that opens the
     Google Business review URL for Kleen

3. **Contractor rating display (admin)**
   - On contractor detail page and list: show average rating, total reviews
   - Already have `rating` and `total_jobs` fields — wire these to
     actual `reviews` table aggregation
   - Could use a Supabase function or computed view:
     `avg(rating)` from `reviews` where `operative_id = X`

4. **Contractor rating in quote cards** (customer side)
   - When customer views quotes, show the contractor's average rating
     (anonymised: "Contractor A — 4.7★")
   - Helps customer make informed decisions

5. **Review moderation (admin)**
   - Admin can view all reviews in a dedicated section or on the
     contractor detail page
   - Flag or remove inappropriate reviews
   - Contractor can respond to reviews (stored in `reviews.response`)

---

## Phase 8 — Email Notifications

**Goal:** Process the `email_queue` table and actually send emails at
key workflow points.

### Tasks

1. **Email provider setup**
   - Integrate Resend (recommended — simple, good free tier) or SendGrid
   - Add `RESEND_API_KEY` to env vars
   - Create a Supabase Edge Function or Next.js API route that:
     - Polls `email_queue` for `status = 'pending'`
     - Sends via provider
     - Updates `status = 'sent'` and `sent_at`

2. **Email templates** (use existing `email_templates` table)
   - `booking_confirmation` — customer submits job
   - `quote_ready` — quotes available for customer
   - `quote_accepted` — sent to winning contractor (includes full job spec)
   - `job_cancelled` — sent to contractors when customer cancels
   - `job_completed` — both parties confirmed
   - `funds_released` — payment sent to contractor
   - `dispute_opened` — sent to contractor when customer disputes
   - `dispute_resolved` — outcome notification to both parties
   - `review_request` — ask customer to leave a review

3. **Trigger integration**
   - Each workflow action (Phase 1–6) should call `queue_email()` with
     the appropriate template slug and data payload
   - The DB triggers partially do this already — verify and extend

---

## Phase 9 — Contractor Interaction (Future)

> For MVP, contractors interact via email and the admin enters data on
> their behalf. This phase is for future development.

### Tasks

1. **Simple contractor response page**
   - Public URL with signed token: `/quote/respond?token=xxx`
   - Shows anonymised job spec (no customer details)
   - Contractor enters their quote price + estimated duration
   - Submits → inserts into `quote_responses`
   - No login required, token-based auth

2. **Contractor portal** (future phase)
   - Separate app (`kleen-contractor`) or section within kleen-app
   - Login with contractor credentials
   - View assigned jobs, respond to quote requests
   - Confirm job completion
   - View disputes and respond
   - View their reviews and ratings

---

## Phase 10 — Schema Alignment & Data Fixes

**Goal:** Fix mismatches between current code and database schema to
ensure data flows correctly end-to-end.

### Tasks

1. **Admin job queries** — fix field mappings:
   - `service_name` → join `services.name` via `service_id`
   - `address` → use `jobs.address_line_1`, `address_line_2`, `city`, `postcode`
   - `scheduled_date/time` → use `preferred_date`, `preferred_time`
   - `price_estimate` → join from `quotes` table
   - `operatives_required` → join from `job_details`

2. **Customer job queries** — ensure dashboard fetches include:
   - Service name (via join)
   - All quote_responses with `customer_price_pence` when available

3. **Migration for any new columns** (if needed after implementation):
   - `disputes.evidence_urls` (text array for uploaded photos)
   - `reviews.kleen_rating` (separate star rating for the platform)
   - `jobs.escrow_release_date` (computed: `customer_confirmed_complete_at + 5 days`)

---

## Implementation Order

| Step | Phase | Effort | Dependencies |
|------|-------|--------|--------------|
| 1 | Phase 10 — Schema alignment | Small | None |
| 2 | Phase 1 — Customer job detail page | Medium | Phase 10 |
| 3 | Phase 2 — In-app notifications | Medium | None |
| 4 | Phase 3 — Quote pipeline auto-feed | Medium | Phase 1, 2 |
| 5 | Phase 4 — Dual completion confirmation | Small | Phase 1 |
| 6 | Phase 6 — Disputes system | Medium | Phase 1, 4 |
| 7 | Phase 7 — Reviews & ratings | Medium | Phase 4 |
| 8 | Phase 5 — Stripe payments & escrow | Large | Phase 3, 4 |
| 9 | Phase 8 — Email notifications | Medium | Phase 3–6 |
| 10 | Phase 9 — Contractor portal | Large | Phase 3, 8 |

---

## Key Business Rules (Reference)

- **Service fee:** 17.5% added to every contractor quote before showing customer
- **Contractor never sees** the marked-up customer price
- **Customer never sees** the contractor's raw price or personal details
- **Escrow period:** 5 calendar days from both-party completion confirmation
- **Escrow paused** if dispute is active
- **Cancellation propagation:** customer cancels → admin notified → all
  contractors on the job emailed that it's off
- **Accepted quote is locked** — customer cannot switch after accepting
- **Both parties must confirm** completion before fund release timer starts
- **Dispute resolution options:** full refund, full release, partial refund
- **Reviews:** customer rates contractor (1–5) + Kleen service (1–5),
  with optional Google Review redirect
