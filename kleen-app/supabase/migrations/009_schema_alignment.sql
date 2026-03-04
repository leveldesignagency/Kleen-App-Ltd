-- ============================================================================
-- KLEEN — Migration 009: Schema alignment for upcoming workflow phases
-- Adds evidence_urls to disputes, kleen_rating to reviews,
-- and escrow_release_date to jobs
-- ============================================================================

-- 1. Dispute evidence (photo uploads via Supabase Storage)
alter table public.disputes
  add column if not exists evidence_urls text[] default '{}';

-- 2. Separate Kleen platform rating (1–5) alongside the contractor rating
alter table public.reviews
  add column if not exists kleen_rating smallint check (kleen_rating between 1 and 5);

-- 3. Computed escrow release date (5 days after both parties confirm)
alter table public.jobs
  add column if not exists escrow_release_date timestamptz;
