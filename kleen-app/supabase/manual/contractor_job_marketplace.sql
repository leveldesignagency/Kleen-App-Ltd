-- Contractor job marketplace columns + policies.
-- If admin breaks with "infinite recursion" on jobs, run fix_jobs_rls_marketplace_recursion.sql instead of the policy section below.

alter table public.operatives
  add column if not exists base_postcode text,
  add column if not exists max_travel_radius_miles int not null default 25;

alter table public.quote_requests
  add column if not exists initiated_by text not null default 'admin';

alter table public.quote_requests
  alter column sent_by drop not null;

-- Prefer the full fix file for policies (includes SECURITY DEFINER helpers):
--   kleen-app/supabase/manual/fix_jobs_rls_marketplace_recursion.sql
