-- Job reporting (pre/post/cannot start) and mediated dispute messaging.

-- -----------------------------------------------------------------------------
-- 1) Contractor job reports
-- -----------------------------------------------------------------------------

create table if not exists public.job_reports (
  id              uuid primary key default gen_random_uuid(),
  job_id           uuid not null references public.jobs on delete cascade,
  operative_id     uuid not null references public.operatives on delete cascade,
  stage            text not null check (stage in ('pre_job', 'post_job', 'cannot_start')),
  job_outcome      text check (job_outcome in ('in_progress', 'completed', 'not_completed')),
  summary          text,
  submitted_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (job_id, operative_id, stage)
);

create index if not exists idx_job_reports_job on public.job_reports (job_id);
create index if not exists idx_job_reports_operative on public.job_reports (operative_id);

create table if not exists public.job_report_items (
  id              uuid primary key default gen_random_uuid(),
  report_id       uuid not null references public.job_reports on delete cascade,
  item_type       text not null check (item_type in ('damage', 'obstruction', 'note', 'completion_note')),
  note            text not null,
  photo_urls      text[] not null default '{}',
  created_at      timestamptz not null default now()
);

create index if not exists idx_job_report_items_report on public.job_report_items (report_id);

drop trigger if exists trg_job_reports_updated on public.job_reports;
create trigger trg_job_reports_updated
  before update on public.job_reports
  for each row execute function update_updated_at();

alter table public.job_reports enable row level security;
alter table public.job_report_items enable row level security;

drop policy if exists "Admins manage job reports" on public.job_reports;
create policy "Admins manage job reports"
  on public.job_reports for all using (is_admin());

drop policy if exists "Operatives manage own assigned job reports" on public.job_reports;
create policy "Operatives manage own assigned job reports"
  on public.job_reports for all
  using (
    exists (
      select 1
      from public.job_assignments ja
      join public.operatives o on o.id = ja.operative_id
      where ja.job_id = job_reports.job_id
        and o.id = job_reports.operative_id
        and o.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.job_assignments ja
      join public.operatives o on o.id = ja.operative_id
      where ja.job_id = job_reports.job_id
        and o.id = job_reports.operative_id
        and o.user_id = auth.uid()
    )
  );

drop policy if exists "Customers see reports for own jobs" on public.job_reports;
create policy "Customers see reports for own jobs"
  on public.job_reports for select
  using (
    exists (
      select 1 from public.jobs j
      where j.id = job_reports.job_id and j.user_id = auth.uid()
    )
  );

drop policy if exists "Admins manage job report items" on public.job_report_items;
create policy "Admins manage job report items"
  on public.job_report_items for all using (is_admin());

drop policy if exists "Operatives manage own job report items" on public.job_report_items;
create policy "Operatives manage own job report items"
  on public.job_report_items for all
  using (
    exists (
      select 1
      from public.job_reports r
      join public.job_assignments ja on ja.job_id = r.job_id and ja.operative_id = r.operative_id
      join public.operatives o on o.id = ja.operative_id
      where r.id = job_report_items.report_id
        and o.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.job_reports r
      join public.job_assignments ja on ja.job_id = r.job_id and ja.operative_id = r.operative_id
      join public.operatives o on o.id = ja.operative_id
      where r.id = job_report_items.report_id
        and o.user_id = auth.uid()
    )
  );

drop policy if exists "Customers see own job report items" on public.job_report_items;
create policy "Customers see own job report items"
  on public.job_report_items for select
  using (
    exists (
      select 1
      from public.job_reports r
      join public.jobs j on j.id = r.job_id
      where r.id = job_report_items.report_id
        and j.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 2) Mediated dispute messages
-- -----------------------------------------------------------------------------

alter table public.dispute_messages
  add column if not exists recipient_role text not null default 'admin'
  check (recipient_role in ('admin', 'customer', 'operative'));

create index if not exists idx_dispute_messages_recipient_role on public.dispute_messages (recipient_role);

create policy "Mediated dispute visibility"
  on public.dispute_messages for select
  using (
    is_admin()
    or exists (
      select 1
      from public.disputes d
      where d.id = dispute_id
        and (
          (
            d.user_id = auth.uid()
            and (
              sender_id = auth.uid()
              or recipient_role = 'customer'
            )
          )
          or (
            exists (
              select 1
              from public.job_assignments ja
              join public.operatives o on o.id = ja.operative_id
              where ja.job_id = d.job_id and o.user_id = auth.uid()
            )
            and (
              sender_id = auth.uid()
              or recipient_role = 'operative'
            )
          )
        )
    )
  );

create policy "Mediated dispute send to admin"
  on public.dispute_messages for insert
  with check (
    sender_id = auth.uid()
    and (
      is_admin()
      or (
        recipient_role = 'admin'
        and exists (
          select 1
          from public.disputes d
          where d.id = dispute_id
            and (
              d.user_id = auth.uid()
              or exists (
                select 1
                from public.job_assignments ja
                join public.operatives o on o.id = ja.operative_id
                where ja.job_id = d.job_id and o.user_id = auth.uid()
              )
            )
        )
      )
    )
  );
