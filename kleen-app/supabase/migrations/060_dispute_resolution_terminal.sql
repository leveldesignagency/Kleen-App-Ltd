-- ============================================================================
-- KLEEN — Migration 060: Dispute resolution terminal
-- Structured outcomes, audit trail, staff notes, promo linkage
-- ============================================================================

alter table public.disputes
  add column if not exists resolution_type text,
  add column if not exists refund_amount_pence int,
  add column if not exists promo_code_id uuid references public.promo_codes (id) on delete set null,
  add column if not exists internal_notes text;

comment on column public.disputes.resolution_type is
  'Settlement outcome: documented_only, customer_full_refund, customer_partial_refund, cancel_authorization, contractor_upheld, split_settlement, goodwill_promo';

create table if not exists public.dispute_actions (
  id          uuid primary key default gen_random_uuid(),
  dispute_id  uuid not null references public.disputes (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  action_type text not null,
  summary     text not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_dispute_actions_dispute on public.dispute_actions (dispute_id, created_at desc);

alter table public.dispute_actions enable row level security;

drop policy if exists "Admins manage dispute actions" on public.dispute_actions;
create policy "Admins manage dispute actions"
  on public.dispute_actions for all
  using (public.is_admin())
  with check (public.is_admin());
