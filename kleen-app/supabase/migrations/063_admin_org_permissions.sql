-- ============================================================================
-- KLEEN — Migration 063: Admin staff role enum extensions (PART 1 of 2)
-- PostgreSQL requires new enum values to be committed before use.
-- Run 064_admin_org_permissions_apply.sql immediately after this succeeds.
-- ============================================================================

do $$
declare
  v text;
begin
  foreach v in array array[
    'master_admin', 'director', 'manager', 'hiring_manager',
    'team_lead', 'senior_support', 'support', 'readonly'
  ]
  loop
    if not exists (
      select 1 from pg_enum e
      join pg_type t on e.enumtypid = t.oid
      where t.typname = 'admin_staff_role' and e.enumlabel = v
    ) then
      execute format('alter type public.admin_staff_role add value %L', v);
    end if;
  end loop;
end $$;
