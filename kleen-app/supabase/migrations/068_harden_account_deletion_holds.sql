-- Harden account deletion against legal holds (user / job / linked operative).
-- Also track contractor leave so portal identity resolution cannot resurrect deactivated ops.

alter table public.operatives
  add column if not exists left_at timestamptz;

comment on column public.operatives.left_at is
  'When the contractor left or was deactivated. Blocks re-link / reactivation via resolveOperativeIdentity.';

create or replace function public.request_account_deletion()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Direct user hold
  if exists (
    select 1 from public.legal_holds
    where subject_type = 'user'
      and subject_id = v_uid
      and released_at is null
  ) then
    raise exception 'Account deletion is blocked while a legal hold is active. Contact privacy@kleenapp.co.uk.';
  end if;

  -- Hold on any job owned by this user
  if exists (
    select 1
    from public.legal_holds lh
    join public.jobs j on j.id = lh.subject_id
    where lh.subject_type = 'job'
      and lh.released_at is null
      and j.user_id = v_uid
  ) then
    raise exception 'Account deletion is blocked while a legal hold is active on one of your jobs. Contact privacy@kleenapp.co.uk.';
  end if;

  -- Hold on linked contractor (operative) record
  if exists (
    select 1
    from public.legal_holds lh
    join public.operatives o on o.id = lh.subject_id
    where lh.subject_type = 'operative'
      and lh.released_at is null
      and o.user_id = v_uid
  ) then
    raise exception 'Account deletion is blocked while a legal hold is active on your contractor account. Contact privacy@kleenapp.co.uk.';
  end if;

  update public.profiles
  set
    account_deletion_requested_at = now(),
    account_deletion_scheduled_at = now() + interval '30 days',
    updated_at = now()
  where id = v_uid;
end;
$$;

grant execute on function public.request_account_deletion() to authenticated;
