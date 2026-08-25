-- Reset jobs wrongly marked accepted when admin used "Add & assign" (never sent to customer).
-- Run for a specific reference, or uncomment the broader WHERE for all affected jobs.

-- Preview affected jobs (accepted in DB but quote never sent to customer)
select
  j.reference,
  j.status,
  j.accepted_quote_request_id,
  j.customer_accepted_at,
  qr.operative_id,
  resp.sent_to_customer_at
from public.jobs j
join public.quote_requests qr on qr.id = j.accepted_quote_request_id
left join public.quote_responses resp on resp.quote_request_id = qr.id
where j.accepted_quote_request_id is not null
  and resp.sent_to_customer_at is null;

-- Fix one job by reference (e.g. KLN-00CA90)
do $$
declare
  v_job_id uuid;
  v_qr_id uuid;
  v_op_id uuid;
begin
  select j.id, j.accepted_quote_request_id, qr.operative_id
  into v_job_id, v_qr_id, v_op_id
  from public.jobs j
  join public.quote_requests qr on qr.id = j.accepted_quote_request_id
  left join public.quote_responses resp on resp.quote_request_id = qr.id
  where j.reference = 'KLN-00CA90'
    and resp.sent_to_customer_at is null
  limit 1;

  if v_job_id is null then
    raise notice 'No mis-assigned job found for KLN-00CA90 (or already sent to customer).';
    return;
  end if;

  delete from public.job_assignments
  where job_id = v_job_id and operative_id = v_op_id;

  update public.jobs
  set
    status = 'quotes_received',
    accepted_quote_request_id = null,
    customer_accepted_at = null,
    actual_start = null,
    payment_authorized_at = null,
    stripe_payment_intent_id = null
  where id = v_job_id;

  raise notice 'Reset job % — send quotes to customer from admin when ready.', v_job_id;
end $$;
