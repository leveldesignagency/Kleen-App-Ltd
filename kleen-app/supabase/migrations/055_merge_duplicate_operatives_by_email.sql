-- ============================================================================
-- KLEEN — Migration 055: Merge duplicate operatives (same email)
--
-- Admin-created contractor rows often exist alongside a self-signup row after
-- first Google sign-in. Quotes and assignments stay on the admin row while the
-- portal loads the self-signup row → contractor sees 0 jobs / 0 quotes.
-- ============================================================================

do $$
declare
  grp record;
  primary_id uuid;
  secondary_id uuid;
begin
  for grp in
    select lower(trim(email)) as em
    from public.operatives
    where email is not null and trim(email) <> ''
    group by lower(trim(email))
    having count(*) > 1
  loop
    select o.id into primary_id
    from public.operatives o
    where lower(trim(o.email)) = grp.em
    order by
      case when o.user_id is not null then 0 else 1 end,
      (select count(*) from public.quote_requests qr where qr.operative_id = o.id) desc,
      (select count(*) from public.job_assignments ja where ja.operative_id = o.id) desc,
      case when o.onboarding_source = 'admin_invite' then 0 else 1 end,
      o.created_at asc nulls last
    limit 1;

    for secondary_id in
      select o.id
      from public.operatives o
      where lower(trim(o.email)) = grp.em
        and o.id <> primary_id
    loop
      -- quote_requests (unique job_id, operative_id)
      update public.quote_requests qr
      set operative_id = primary_id
      where qr.operative_id = secondary_id
        and not exists (
          select 1
          from public.quote_requests existing
          where existing.job_id = qr.job_id
            and existing.operative_id = primary_id
        );

      delete from public.quote_requests
      where operative_id = secondary_id;

      -- job_assignments (unique job_id, operative_id)
      update public.job_assignments ja
      set operative_id = primary_id
      where ja.operative_id = secondary_id
        and not exists (
          select 1
          from public.job_assignments existing
          where existing.job_id = ja.job_id
            and existing.operative_id = primary_id
        );

      delete from public.job_assignments
      where operative_id = secondary_id;

      update public.operative_services os
      set operative_id = primary_id
      where os.operative_id = secondary_id
        and not exists (
          select 1
          from public.operative_services existing
          where existing.service_id = os.service_id
            and existing.operative_id = primary_id
        );

      delete from public.operative_services
      where operative_id = secondary_id;

      update public.availability_slots
      set operative_id = primary_id
      where operative_id = secondary_id;

      update public.operative_personnel
      set operative_id = primary_id
      where operative_id = secondary_id;

      update public.operatives
      set is_active = false, user_id = null
      where id = secondary_id;
    end loop;

    update public.operatives
    set email = lower(trim(email)), is_active = true
    where id = primary_id;
  end loop;
end $$;
