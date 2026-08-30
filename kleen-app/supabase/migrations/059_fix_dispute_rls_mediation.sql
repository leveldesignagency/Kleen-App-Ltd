-- ============================================================================
-- KLEEN — Migration 059: Fix dispute RLS recursion + mediated visibility
--
-- Symptoms: PostgREST 500 on disputes / dispute_messages SELECT (customer,
-- contractor, and sometimes admin UIs show empty even though rows exist).
--
-- Cause: overlapping SELECT policies that subquery disputes ↔ job_assignments ↔
-- jobs, re-entering RLS (same class of bug as 033/044/053).
--
-- Fix: SECURITY DEFINER helpers (no SET LOCAL) + replace policies.
-- Mediation: contractors only see disputes once Kleen has engaged
-- (status != 'open'), and only messages addressed to them / their own sends.
-- ============================================================================

create or replace function public.is_dispute_customer(p_dispute_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.disputes d
    where d.id = p_dispute_id
      and d.user_id = auth.uid()
  );
$$;

create or replace function public.is_dispute_assigned_operative(p_dispute_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.disputes d
    join public.job_assignments ja on ja.job_id = d.job_id
    join public.operatives o on o.id = ja.operative_id
    where d.id = p_dispute_id
      and o.user_id = auth.uid()
  );
$$;

-- Contractor may see the dispute only after Kleen has messaged them,
-- or once the case is resolved/closed (so they can read the outcome).
create or replace function public.operative_can_see_dispute(p_dispute_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.disputes d
    join public.job_assignments ja on ja.job_id = d.job_id
    join public.operatives o on o.id = ja.operative_id
    where d.id = p_dispute_id
      and o.user_id = auth.uid()
      and (
        d.status in ('resolved', 'closed')
        or exists (
          select 1
          from public.dispute_messages m
          where m.dispute_id = d.id
            and m.recipient_role = 'operative'
        )
      )
  );
$$;

create or replace function public.operative_assigned_to_job(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.job_assignments ja
    join public.operatives o on o.id = ja.operative_id
    where ja.job_id = p_job_id
      and o.user_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- disputes policies
-- -----------------------------------------------------------------------------

drop policy if exists "Users see own disputes" on public.disputes;
drop policy if exists "Operatives see disputes for assigned jobs" on public.disputes;
drop policy if exists "Admins manage disputes" on public.disputes;
drop policy if exists "Users create disputes" on public.disputes;

create policy "Users see own disputes"
  on public.disputes for select
  using (user_id = auth.uid());

create policy "Operatives see engaged disputes for assigned jobs"
  on public.disputes for select
  using (public.operative_can_see_dispute(id));

create policy "Admins manage disputes"
  on public.disputes for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Users create disputes"
  on public.disputes for insert
  with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- dispute_messages policies
-- -----------------------------------------------------------------------------

drop policy if exists "Dispute participants see messages" on public.dispute_messages;
drop policy if exists "Operatives see dispute messages for assigned jobs" on public.dispute_messages;
drop policy if exists "Mediated dispute visibility" on public.dispute_messages;
drop policy if exists "Dispute participants send messages" on public.dispute_messages;
drop policy if exists "Mediated dispute send to admin" on public.dispute_messages;
drop policy if exists "Admins manage dispute messages" on public.dispute_messages;

create policy "Admins manage dispute messages"
  on public.dispute_messages for all
  using (public.is_admin())
  with check (public.is_admin());

-- Customer: own sends + messages Kleen addressed to customer
create policy "Customers see mediated dispute messages"
  on public.dispute_messages for select
  using (
    public.is_dispute_customer(dispute_id)
    and (
      sender_id = auth.uid()
      or recipient_role = 'customer'
    )
  );

-- Contractor: only after Kleen engaged; own sends + messages to operative
create policy "Operatives see mediated dispute messages"
  on public.dispute_messages for select
  using (
    public.operative_can_see_dispute(dispute_id)
    and (
      sender_id = auth.uid()
      or recipient_role = 'operative'
    )
  );

-- Parties may only message Kleen (admin), never each other
create policy "Parties send dispute messages to admin"
  on public.dispute_messages for insert
  with check (
    sender_id = auth.uid()
    and recipient_role = 'admin'
    and (
      public.is_dispute_customer(dispute_id)
      or public.operative_can_see_dispute(dispute_id)
    )
  );

comment on function public.operative_can_see_dispute is
  'Assigned contractor may see a dispute after Kleen messages them, or when resolved/closed.';
