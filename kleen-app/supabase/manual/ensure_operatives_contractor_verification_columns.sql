-- Run once on the Supabase project you use for local + production testing.
-- Fixes "Could not find column ... operatives ... schema cache" when approving contractors.
-- Safe to re-run (IF NOT EXISTS).

-- Migration 034: verification + rejection + UK profile fields
alter table public.operatives
  add column if not exists verified_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_message text,
  add column if not exists trading_name text,
  add column if not exists registered_address text;

-- Migration 036: admin review queue
alter table public.operatives
  add column if not exists submitted_for_review_at timestamptz;

create index if not exists idx_operatives_submitted_for_review_at
  on public.operatives (submitted_for_review_at);
