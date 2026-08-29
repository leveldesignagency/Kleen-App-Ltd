-- Could-not-start flow: distinct status from disputes + structured reason code.
-- Also supports customer rebooking the same contractor after a blocked visit.

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'could_not_start'
      and enumtypid = 'job_status'::regtype
  ) then
    alter type job_status add value 'could_not_start';
  end if;
end $$;

alter table public.jobs
  add column if not exists cannot_start_reason_code text;

alter table public.job_reports
  add column if not exists cannot_start_reason_code text;

comment on column public.jobs.cannot_start_reason_code is
  'Structured reason code when contractor could not start (see cannot-start-reasons.ts).';

comment on column public.job_reports.cannot_start_reason_code is
  'Structured cannot-start reason for this report stage.';
