-- ============================================================================
-- KLEEN — Migration 034: Contractor verification (reject + message) + UK onboarding
-- ============================================================================

alter table public.operatives
  add column if not exists verified_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_message text,
  add column if not exists trading_name text,
  add column if not exists registered_address text;

comment on column public.operatives.verified_at is 'When Kleen approved this contractor in admin.';
comment on column public.operatives.rejected_at is 'When Kleen declined the application (see rejection_message).';
comment on column public.operatives.rejection_message is 'Reasons emailed to contractor and shown in portal; clear on approve.';
comment on column public.operatives.trading_name is 'UK trading name if different from company name.';
comment on column public.operatives.registered_address is 'UK registered or trading address (multi-line ok).';
