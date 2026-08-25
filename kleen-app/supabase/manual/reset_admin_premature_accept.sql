-- Reset jobs with FAKE admin accept (customer_accepted_at / actual_start set but no payment).
-- Safe: only touches rows where payment_authorized_at IS NULL.
-- Run preview first, then the DO block.

-- (1) Preview — jobs that look accepted/in-progress but customer never paid
select
  j.reference,
  j.status,
  j.accepted_quote_request_id,
  j.customer_accepted_at,
  j.actual_start,
  j.payment_authorized_at,
  resp.sent_to_customer_at
from public.jobs j
left join public.quote_requests qr on qr.id = j.accepted_quote_request_id
left join public.quote_responses resp on resp.quote_request_id = qr.id
where j.accepted_quote_request_id is not null
  and j.payment_authorized_at is null
  and j.customer_accepted_at is not null
order by j.reference;

-- (2) Fix KLN-00CA90 (or change reference below)
do $$
declare
  v_job_id uuid;
  v_ref text := 'KLN-00CA90';
begin
  select j.id into v_job_id
  from public.jobs j
  where j.reference = v_ref
    and j.payment_authorized_at is null
  limit 1;

  if v_job_id is null then
    raise notice 'Nothing to reset for % (not found or customer already paid).', v_ref;
    return;
  end if;

  delete from public.job_assignments where job_id = v_job_id;

  update public.jobs
  set
    status = case
      when exists (
        select 1 from public.quote_responses resp
        join public.quote_requests qr on qr.id = resp.quote_request_id
        where qr.job_id = v_job_id and resp.sent_to_customer_at is not null
      ) then 'sent_to_customer'::job_status
      when exists (
        select 1 from public.quote_requests where job_id = v_job_id
      ) then 'quotes_received'::job_status
      else 'pending'::job_status
    end,
    accepted_quote_request_id = null,
    customer_accepted_at = null,
    actual_start = null,
    payment_authorized_at = null,
    payment_captured_at = null,
    stripe_payment_intent_id = null
  where id = v_job_id
    and payment_authorized_at is null;

  raise notice 'Reset % — status set from quotes; customer can choose and pay.', v_ref;
end $$;

-- (3) Verify
select
  j.reference,
  j.status,
  j.accepted_quote_request_id,
  j.customer_accepted_at,
  j.actual_start,
  j.payment_authorized_at
from public.jobs j
where j.reference = 'KLN-00CA90';
