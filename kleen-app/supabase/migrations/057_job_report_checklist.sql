-- Due-diligence checklist answers on each job report stage (pre / post / cannot start).

alter table public.job_reports
  add column if not exists checklist jsonb not null default '{}'::jsonb;

comment on column public.job_reports.checklist is
  'Map of checklist item keys → boolean (or { checked, note }). Required for job completion due diligence.';
