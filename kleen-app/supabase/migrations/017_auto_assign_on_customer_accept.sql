-- ============================================================================
-- KLEEN — Migration 017: Auto-assign contractor when customer accepts quote
-- When job.accepted_quote_request_id is set, create job_assignment for that
-- quote's operative so the accepted contractor sees the job without admin
-- having to click "Forward to contractor".
-- ============================================================================

-- Ensure columns exist (they may already exist from migration 008)
alter table public.jobs
  add column if not exists accepted_quote_request_id uuid references public.quote_requests on delete set null;
alter table public.jobs
  add column if not exists customer_accepted_at timestamptz;

create or replace function on_job_accepted_quote_set()
returns trigger language plpgsql security definer as $$
declare
  v_operative_id uuid;
begin
  if new.accepted_quote_request_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.accepted_quote_request_id = new.accepted_quote_request_id then
    return new;
  end if;

  select operative_id into v_operative_id
  from public.quote_requests
  where id = new.accepted_quote_request_id
  limit 1;

  if v_operative_id is not null then
    insert into public.job_assignments (job_id, operative_id, assigned_at)
    values (new.id, v_operative_id, coalesce(new.customer_accepted_at, now()))
    on conflict (job_id, operative_id) do update set
      assigned_at = coalesce(excluded.assigned_at, public.job_assignments.assigned_at);
  end if;

  return new;
end;
$$;

create trigger trg_job_accepted_quote_set
  after insert or update of accepted_quote_request_id on public.jobs
  for each row execute function on_job_accepted_quote_set();
