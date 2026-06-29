-- ============================================================================
-- KLEEN — Migration 047: Marketplace auto-broadcast + contractor cancellation
-- 1. Track when a job was broadcast to matching contractors
-- 2. Contractor late-cancel penalty balance
-- 3. Auto-promote job → sent_to_customer when a quote is marked for customer
-- ============================================================================

alter table public.jobs
  add column if not exists marketplace_broadcast_at timestamptz,
  add column if not exists contractor_cancelled_at timestamptz,
  add column if not exists contractor_cancel_reason text,
  add column if not exists contractor_cancel_penalty_pence int;

comment on column public.jobs.marketplace_broadcast_at is 'When matching contractors were invited to quote (system broadcast).';
comment on column public.jobs.contractor_cancelled_at is 'When the assigned contractor cancelled after acceptance.';
comment on column public.jobs.contractor_cancel_reason is 'Reason given by contractor when cancelling.';
comment on column public.jobs.contractor_cancel_penalty_pence is 'Late-cancel penalty charged to contractor (pence).';

alter table public.operatives
  add column if not exists penalty_balance_pence int not null default 0;

comment on column public.operatives.penalty_balance_pence is 'Outstanding penalty balance from late job cancellations (deducted from future payouts).';

comment on column public.quote_requests.initiated_by is 'admin = Kleen invited; contractor = operative applied; marketplace = system broadcast on job submit.';

-- Depends on 026 in fresh installs; ensure column exists if 026 was skipped on this project.
alter table public.quote_responses
  add column if not exists sent_to_customer_at timestamptz;

comment on column public.quote_responses.sent_to_customer_at is 'When this quote was last sent to the customer. Null = not sent, or edited after send (can send again).';

alter table public.jobs
  add column if not exists quotes_sent_to_customer_at timestamptz;

-- When a contractor quote is marked sent_to_customer_at, surface quotes to the customer.
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
