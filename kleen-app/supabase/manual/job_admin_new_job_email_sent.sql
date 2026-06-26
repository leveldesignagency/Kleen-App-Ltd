-- Run in Supabase SQL editor if migration 046 is not applied yet.
alter table public.jobs
  add column if not exists admin_new_job_email_sent_at timestamptz;

update public.jobs
set admin_new_job_email_sent_at = coalesce(created_at, now())
where admin_new_job_email_sent_at is null;
