-- ============================================================================
-- KLEEN — Migration 052: Admin-invited contractor onboarding
-- ============================================================================
-- When staff add a contractor in admin, they are invited to confirm details
-- (claim the existing operatives row) rather than starting a fresh application.

alter table public.operatives
  add column if not exists onboarding_source text
    check (onboarding_source is null or onboarding_source in ('self_apply', 'admin_invite')),
  add column if not exists admin_invited_at timestamptz;

comment on column public.operatives.onboarding_source is
  'How the contractor record was created: self_apply (website) or admin_invite (staff add).';

comment on column public.operatives.admin_invited_at is
  'When staff last sent / created an admin invite for this unclaimed or invited operative.';

create index if not exists idx_operatives_email_lower
  on public.operatives (lower(email));

create index if not exists idx_operatives_admin_invited_at
  on public.operatives (admin_invited_at)
  where admin_invited_at is not null;
