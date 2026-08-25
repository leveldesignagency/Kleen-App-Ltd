-- Reset jobs with stale admin assign fields (accepted / in-progress) before customer paid.
-- Run in Supabase SQL editor. Adjust reference as needed.

-- Preview
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
where j.reference = 'KLN-00CA90';

-- Fix KLN-00CA90 (clears fake accept / in-progress; keeps sent quotes if already sent)
do $$
declare
  v_job_id uuid;
  v_op_id uuid;
begin
  select j.id, qr.operative_id
  into v_job_id, v_op_id
  from public.jobs j
  left join public.quote_requests qr on qr.id = j.accepted_quote_request_id
  where j.reference = 'KLN-00CA90'
  limit 1;

  if v_job_id is null then
    raise notice 'Job KLN-00CA90 not found.';
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
  where id = v_job_id;

  raise notice 'Reset job % — customer should see Quotes Available only until they accept and pay.', v_job_id;
end $$;
