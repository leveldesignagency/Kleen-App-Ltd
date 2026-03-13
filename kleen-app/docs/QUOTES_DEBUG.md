# Customer dashboard quotes – what to check

The customer sees quotes only when **all** of the following are true. Check these **3 tables** in Supabase (Table Editor or SQL).

---

## 1. `jobs`

- **Must have:** `status` = `sent_to_customer` (or `customer_accepted`, `accepted`, etc.).
- **Must have:** `user_id` = the **customer’s** auth user id (the person who submitted the job).

If the job is still `pending` or `quotes_received`, the dashboard won’t show the “Choose Your Quote” section.  
If `user_id` is wrong or empty, the customer won’t see the job at all.

**SQL (replace `YOUR_JOB_ID`):**
```sql
SELECT id, reference, status, user_id
FROM public.jobs
WHERE id = 'YOUR_JOB_ID';
```

---

## 2. `quote_requests`

- **Must have:** Rows with `job_id` = that job.
- **Must have:** `status` = `quoted` for each row you want to show.

**SQL:**
```sql
SELECT id, job_id, status, sent_at
FROM public.quote_requests
WHERE job_id = 'YOUR_JOB_ID';
```

---

## 3. `quote_responses`

- **Must have:** One row per `quote_request` (linked by `quote_request_id`).
- **Must have:** `customer_price_pence` **set** (not NULL). The app only shows quotes where this is set.

**SQL:**
```sql
SELECT qr.id AS quote_request_id, qr.status,
       qresp.id AS response_id, qresp.customer_price_pence, qresp.price_pence
FROM public.quote_requests qr
LEFT JOIN public.quote_responses qresp ON qresp.quote_request_id = qr.id
WHERE qr.job_id = 'YOUR_JOB_ID';
```

If `customer_price_pence` is NULL for a row, that quote will **not** appear on the customer dashboard.

---

## RLS (after migration 016)

Policies must exist so the **customer** can read their data:

- `quote_requests`: policy like “Customers see quote requests for own job” (customer can SELECT where `jobs.user_id = auth.uid()`).
- `quote_responses`: policy like “Customers see quote responses for own job” (customer can SELECT for those quote_requests).

In Supabase: **Authentication → Policies** for `quote_requests` and `quote_responses`, or run:

```sql
SELECT tablename, policyname
FROM pg_policies
WHERE tablename IN ('quote_requests', 'quote_responses')
  AND (policyname ILIKE '%customer%' OR policyname ILIKE '%own job%');
```

You should see the two customer policies above.

---

## Quick checklist

| Check | Table | What to verify |
|-------|--------|----------------|
| 1 | `jobs` | `status` = `sent_to_customer` (or later); `user_id` = customer’s auth uid |
| 2 | `quote_requests` | At least one row for the job with `status` = `quoted` |
| 3 | `quote_responses` | One row per quote_request, with `customer_price_pence` NOT NULL |
| 4 | RLS | Migration 016 applied: customer SELECT policies on `quote_requests` and `quote_responses` |

Most often the issue is **`quote_responses.customer_price_pence` is NULL** (admin “send to customer” didn’t run or failed) or **`jobs.user_id`** doesn’t match the logged-in customer.
