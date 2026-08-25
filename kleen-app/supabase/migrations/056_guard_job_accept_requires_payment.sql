-- Block setting accept / in-progress timestamps without customer payment (prevents admin UI regressions).

create or replace function public.guard_job_accept_requires_payment()
returns trigger
language plpgsql
as $$
begin
  if new.payment_authorized_at is null and new.payment_captured_at is null then
    if (new.customer_accepted_at is distinct from old.customer_accepted_at and new.customer_accepted_at is not null)
       or (new.actual_start is distinct from old.actual_start and new.actual_start is not null) then
      raise exception 'customer_accepted_at and actual_start require payment_authorized_at (customer must pay via dashboard)';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_job_accept_requires_payment on public.jobs;
create trigger trg_guard_job_accept_requires_payment
  before update on public.jobs
  for each row
  execute function public.guard_job_accept_requires_payment();
