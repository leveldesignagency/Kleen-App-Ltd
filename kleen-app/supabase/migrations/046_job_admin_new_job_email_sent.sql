-- Track when admin was emailed about a new customer job (customer notify + cron/admin backup).
alter table public.jobs
  add column if not exists admin_new_job_email_sent_at timestamptz;

comment on column public.jobs.admin_new_job_email_sent_at is
  'Set when admin new-job email was sent (customer API, dashboard cron, or admin backup).';

-- Existing jobs: treat as already handled so cron does not re-email historical bookings.
update public.jobs
set admin_new_job_email_sent_at = coalesce(created_at, now())
where admin_new_job_email_sent_at is null;
