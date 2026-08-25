-- ============================================================================
-- KLEEN — Migration 053: Fix quotes/jobs SELECT 400
--
-- Error: code 0A000 — "SET is not allowed in a non-volatile function"
--
-- Cause: RLS helpers from 033/043/044 use `SET LOCAL row_security = off`
-- inside plpgsql. If those functions were (or became) STABLE — including via
-- CREATE OR REPLACE preserving prior volatility — Postgres rejects SET and
-- PostgREST returns 400 on customer quotes reads (fetchQuotePricesByJobId).
-- Customer "Users see own quotes" subqueries jobs, which evaluates every
-- permissive jobs SELECT policy, including the operative helpers.
--
-- Fix: rewrite helpers as SQL SECURITY DEFINER (no SET). Table owner bypasses
-- RLS unless FORCE ROW LEVEL SECURITY is on; predicates still require auth.uid().
-- ============================================================================

create or replace function public.operative_has_quote_request_for_job(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.quote_requests qr
    join public.operatives o on o.id = qr.operative_id
    where qr.job_id = p_job_id
      and o.user_id = auth.uid()
  );
$$;

create or replace function public.operative_can_browse_open_job(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.jobs j
    join public.operatives o on o.user_id = auth.uid()
    where j.id = p_job_id
      and j.status in ('pending', 'awaiting_quotes')
      and o.is_verified = true
      and o.is_active = true
      and not exists (
        select 1
        from public.quote_requests qr
        where qr.job_id = j.id and qr.operative_id = o.id
      )
  );
$$;

create or replace function public.job_is_open_for_quotes(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.jobs j
    where j.id = p_job_id
      and j.status in ('pending', 'awaiting_quotes')
  );
$$;

create or replace function public.operative_can_self_apply_quote(
  p_operative_id uuid,
  p_job_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.operatives o
    where o.id = p_operative_id
      and o.user_id = auth.uid()
      and o.is_verified = true
      and o.is_active = true
  )
  and public.job_is_open_for_quotes(p_job_id);
$$;
