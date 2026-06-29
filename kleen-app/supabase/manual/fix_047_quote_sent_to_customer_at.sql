-- Run in Supabase SQL editor if migration 047 failed partway (missing sent_to_customer_at).
-- Safe to re-run; then re-run the trigger section from 047 or this full patch.

alter table public.quote_responses
  add column if not exists sent_to_customer_at timestamptz;

alter table public.jobs
  add column if not exists quotes_sent_to_customer_at timestamptz;

create or replace function public.auto_promote_job_quotes_to_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
begin
  if NEW.sent_to_customer_at is null then
    return NEW;
  end if;

  select qr.job_id into v_job_id
  from public.quote_requests qr
  where qr.id = NEW.quote_request_id;

  if v_job_id is null then
    return NEW;
  end if;

  update public.jobs
  set
    status = 'sent_to_customer',
    quotes_sent_to_customer_at = coalesce(quotes_sent_to_customer_at, NEW.sent_to_customer_at)
  where id = v_job_id
    and status in ('pending', 'awaiting_quotes', 'quotes_received');

  return NEW;
end;
$$;

drop trigger if exists trg_auto_promote_job_quotes_to_customer on public.quote_responses;
create trigger trg_auto_promote_job_quotes_to_customer
  after insert or update of sent_to_customer_at on public.quote_responses
  for each row
  execute function public.auto_promote_job_quotes_to_customer();
