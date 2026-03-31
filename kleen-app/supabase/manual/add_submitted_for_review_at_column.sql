-- Prefer ensure_operatives_contractor_verification_columns.sql (adds this + 034 columns) if admin approve still errors.
--
-- Required for contractor "Send for review" and admin verification clearing the queue.
-- Run in Supabase SQL Editor if you see:
--   Could not find the 'submitted_for_review_at' column of 'operatives' in the schema cache
--
-- After running: Settings → API → (optional) reload PostgREST schema, or wait ~1 min.

alter table public.operatives
  add column if not exists submitted_for_review_at timestamptz;

create index if not exists idx_operatives_submitted_for_review_at
  on public.operatives (submitted_for_review_at);
