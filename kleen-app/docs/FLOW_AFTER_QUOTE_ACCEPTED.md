# What happens after the customer accepts a quote

## 1. Immediately after accept

- **Job** → `status = customer_accepted`, `accepted_quote_request_id` set, `customer_accepted_at` set.
- **Trigger (migration 017)** → A row is created in `job_assignments` for the accepted contractor (operative), so the job is “assigned” without admin doing anything.
- **Other quotes** → All other quote_requests for that job get `customer_declined_at` set (so admin can see they were declined).

## 2. Admin

- Job appears as **“Customer Accepted”** in the admin job list and detail.
- On job detail, the workflow block shows **“Forward to contractor”** with a button per quoted contractor. The **accepted** contractor is the one whose quote the customer chose.
- **Optional:** Admin clicks **“Forward to [contractor name]”** → job `status` is set to `awaiting_completion`. (The assignment already exists from the trigger; this step is mainly to move the job into “In progress” and optionally notify the contractor.)
- If admin does **not** click Forward, the job stays in `customer_accepted`; the contractor is already assigned in `job_assignments`, but the job is not yet in “awaiting completion” from a workflow perspective.

## 3. Contractor (current setup)

- There is **no contractor/operative app** in this repo. Contractors are represented as **operatives** in the DB; they have RLS so they *could* see jobs where they have a `job_assignments` row, but there is no UI for that yet.
- **Today:** Admin is expected to contact the contractor (email/phone), send job details, and when the contractor says the job is done, admin marks **“Contractor confirmed completion”** on the job detail page. That sets `contractor_confirmed_complete_at`.

## 4. Customer

- On **job detail** (`/dashboard/jobs/[id]`), the customer sees status **“Accepted”** and the chosen quote.
- When the job is in **awaiting_completion** / **in_progress** / **pending_confirmation**, the customer sees **“Job finished?”** and a **“Mark as complete”** button. Clicking it sets `customer_confirmed_complete_at` (and, if the contractor already confirmed, status moves to `completed`).

## 5. Completion and funds

- When **both** `contractor_confirmed_complete_at` and `customer_confirmed_complete_at` are set, the job is treated as complete (status can be set to `completed` in the admin flow).
- Admin can then **“Release funds”** → sets `funds_released_at` and status `funds_released`. (Actual payment to the contractor would be done via Stripe Connect or similar; that integration is not implemented here.)

## Summary (order of events)

| Step | Who | Action | Result |
|------|-----|--------|--------|
| 1 | Customer | Accepts a quote | Job → `customer_accepted`, assignment created, others declined |
| 2 | Admin | (Optional) Clicks “Forward to contractor” | Job → `awaiting_completion` |
| 3 | Admin | Contacts contractor, gets confirmation | Admin clicks “Contractor confirmed” → `contractor_confirmed_complete_at` set |
| 4 | Customer | Confirms job done | Clicks “Mark as complete” → `customer_confirmed_complete_at` set |
| 5 | System / Admin | Both confirmed | Job can move to `completed`; admin can release funds |

## Possible next implementations

- **Contractor portal or link:** A way for the assigned operative to see the job (e.g. list of assigned jobs, job detail, “I’ve completed this job” button) so contractor confirmation doesn’t depend on admin data entry.
- **Notifications:** Notify admin when customer accepts; notify contractor when they’re assigned or when job is forwarded; notify customer when contractor confirms.
- **Auto “Forward”:** When customer accepts, optionally set status to `awaiting_completion` in the same flow so admin doesn’t have to click Forward (assignment already exists from 017).
