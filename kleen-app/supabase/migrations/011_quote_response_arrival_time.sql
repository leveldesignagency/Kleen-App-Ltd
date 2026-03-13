-- ============================================================================
-- KLEEN — Migration 011: Optional time of arrival on quote responses
-- When admin adds a quote, they can optionally set when the contractor will arrive.
-- ============================================================================

alter table public.quote_responses
  add column if not exists arrival_time time;
