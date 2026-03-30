-- Allow operatives assigned to a job to read disputes and thread messages for that job
-- (customer remains dispute.user_id; contractors see disputes via job_assignments.)
--
-- Additive only: do not drop or replace existing policies on dispute_messages.

create policy "Operatives see disputes for assigned jobs"
  on public.disputes for select using (
    exists (
      select 1
      from public.job_assignments ja
      inner join public.operatives o on o.id = ja.operative_id
      where ja.job_id = disputes.job_id
        and o.user_id = auth.uid()
    )
  );

create policy "Operatives see dispute messages for assigned jobs"
  on public.dispute_messages for select using (
    exists (
      select 1
      from public.disputes d
      where d.id = dispute_id
        and exists (
          select 1
          from public.job_assignments ja
          inner join public.operatives o on o.id = ja.operative_id
          where ja.job_id = d.job_id
            and o.user_id = auth.uid()
        )
    )
  );
