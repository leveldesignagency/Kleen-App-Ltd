-- ============================================================================
-- Quote flow: are quotes stored? why aren't they sending to the customer?
-- Uses only base tables (jobs, quote_requests, quote_responses) — no
-- columns from migration 008.
-- ============================================================================

-- 1) Jobs (id, reference, status, customer user_id)
SELECT
  j.id AS job_id,
  j.reference,
  j.status AS job_status,
  j.user_id AS customer_user_id,
  j.created_at
FROM public.jobs j
ORDER BY j.created_at DESC
LIMIT 50;

-- 2) Quotes stored: one row per quote (request + response with price)
SELECT
  qr.job_id,
  qr.id AS quote_request_id,
  qr.operative_id,
  qr.status AS quote_request_status,
  qr.sent_at,
  qresp.id AS quote_response_id,
  qresp.price_pence,
  qresp.created_at AS response_created_at
FROM public.quote_requests qr
LEFT JOIN public.quote_responses qresp ON qresp.quote_request_id = qr.id
ORDER BY qr.job_id, qr.sent_at DESC;

-- 3) Answer: are quotes stored? why not sending?
SELECT
  (SELECT count(*) FROM public.quote_requests) AS quote_requests_stored,
  (SELECT count(*) FROM public.quote_responses) AS quote_responses_stored,
  'Quotes are in quote_requests + quote_responses. To send to customer the app needs: (1) job.status = sent_to_customer, (2) quote_responses.customer_price_pence set for each quote. Those columns come from migration 008. Run 008 if you get "column does not exist". Migration 016 lets the customer read quotes (RLS).' AS why_not_sending;
