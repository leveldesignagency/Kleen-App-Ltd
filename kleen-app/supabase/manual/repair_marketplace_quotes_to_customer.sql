-- Repair jobs stuck at awaiting_quotes / quotes_received after contractor Find a Job bids
-- that never set sent_to_customer_at (pre-fix apply route).
-- Safe to re-run.

begin;

update public.quote_responses resp
set sent_to_customer_at = coalesce(resp.sent_to_customer_at, resp.created_at, now())
from public.quote_requests qr
where qr.id = resp.quote_request_id
  and qr.initiated_by in ('contractor', 'marketplace')
  and resp.sent_to_customer_at is null;

update public.jobs j
set
  status = 'sent_to_customer',
  quotes_sent_to_customer_at = coalesce(j.quotes_sent_to_customer_at, now())
where j.status in ('pending', 'awaiting_quotes', 'quotes_received')
  and exists (
    select 1
    from public.quote_requests qr
    join public.quote_responses resp on resp.quote_request_id = qr.id
    where qr.job_id = j.id
      and resp.sent_to_customer_at is not null
  );

commit;

-- Verify (optional):
-- select j.reference, j.status, resp.sent_to_customer_at, qr.initiated_by
-- from jobs j
-- join quote_requests qr on qr.job_id = j.id
-- join quote_responses resp on resp.quote_request_id = qr.id
-- order by j.created_at desc
-- limit 20;
