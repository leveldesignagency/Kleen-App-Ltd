-- Private bucket for job report photos/videos. Uploads use service role (API routes).
-- Reads: customers (own job), assigned operatives, admins.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
  'job-evidence',
  'job-evidence',
  false,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
where not exists (select 1 from storage.buckets where id = 'job-evidence');

-- Path convention: {job_id}/{operative_id}/{filename}

drop policy if exists "job_evidence_select_customer" on storage.objects;
create policy "job_evidence_select_customer"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'job-evidence'
    and exists (
      select 1 from public.jobs j
      where j.id::text = split_part(name, '/', 1)
        and j.user_id = auth.uid()
    )
  );

drop policy if exists "job_evidence_select_operative" on storage.objects;
create policy "job_evidence_select_operative"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'job-evidence'
    and exists (
      select 1
      from public.operatives o
      join public.job_assignments ja on ja.operative_id = o.id
      where o.user_id = auth.uid()
        and ja.job_id::text = split_part(name, '/', 1)
        and o.id::text = split_part(name, '/', 2)
    )
  );

drop policy if exists "job_evidence_select_admin" on storage.objects;
create policy "job_evidence_select_admin"
  on storage.objects for select to authenticated
  using (bucket_id = 'job-evidence' and public.is_admin());
