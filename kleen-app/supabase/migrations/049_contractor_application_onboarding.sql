-- ============================================================================
-- KLEEN — Migration 049: Contractor application (per-job pricing, ID docs, personnel)
-- ============================================================================

-- Per-service default price per completed job (ex VAT, pence)
alter table public.operative_services
  add column if not exists default_price_pence int
    check (default_price_pence is null or default_price_pence >= 0);

comment on column public.operative_services.default_price_pence is
  'Contractor default price per job completion for this service (ex VAT, pence).';

-- Sole trader photo ID (private storage path)
alter table public.operatives
  add column if not exists id_document_storage_path text,
  add column if not exists id_document_uploaded_at timestamptz,
  add column if not exists contractor_terms_accepted_at timestamptz;

-- Limited company key personnel (directors / PSCs for verification)
create table if not exists public.operative_personnel (
  id uuid primary key default gen_random_uuid(),
  operative_id uuid not null references public.operatives(id) on delete cascade,
  full_name text not null,
  role text not null default 'director',
  id_document_storage_path text,
  id_document_uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_operative_personnel_operative
  on public.operative_personnel (operative_id);

drop trigger if exists trg_operative_personnel_updated on public.operative_personnel;
create trigger trg_operative_personnel_updated
  before update on public.operative_personnel
  for each row execute function update_updated_at();

alter table public.operative_personnel enable row level security;

drop policy if exists "Admins manage operative_personnel" on public.operative_personnel;
create policy "Admins manage operative_personnel"
  on public.operative_personnel for all using (is_admin());

drop policy if exists "Operatives see own personnel" on public.operative_personnel;
create policy "Operatives see own personnel"
  on public.operative_personnel for select using (
    exists (
      select 1 from public.operatives o
      where o.id = operative_id and o.user_id = auth.uid()
    )
  );

drop policy if exists "Operatives insert own personnel" on public.operative_personnel;
create policy "Operatives insert own personnel"
  on public.operative_personnel for insert with check (
    exists (
      select 1 from public.operatives o
      where o.id = operative_id and o.user_id = auth.uid()
    )
  );

drop policy if exists "Operatives update own personnel" on public.operative_personnel;
create policy "Operatives update own personnel"
  on public.operative_personnel for update using (
    exists (
      select 1 from public.operatives o
      where o.id = operative_id and o.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.operatives o
      where o.id = operative_id and o.user_id = auth.uid()
    )
  );

drop policy if exists "Operatives delete own personnel" on public.operative_personnel;
create policy "Operatives delete own personnel"
  on public.operative_personnel for delete using (
    exists (
      select 1 from public.operatives o
      where o.id = operative_id and o.user_id = auth.uid()
    )
  );

-- Private bucket for contractor onboarding documents (ID, etc.)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
  'contractor-documents',
  'contractor-documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
where not exists (select 1 from storage.buckets where id = 'contractor-documents');

-- Path: {operative_id}/id/{uuid}.ext  or  {operative_id}/personnel/{personnel_id}/{uuid}.ext

drop policy if exists "contractor_documents_select_operative" on storage.objects;
create policy "contractor_documents_select_operative"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'contractor-documents'
    and exists (
      select 1 from public.operatives o
      where o.user_id = auth.uid()
        and o.id::text = split_part(name, '/', 1)
    )
  );

drop policy if exists "contractor_documents_select_admin" on storage.objects;
create policy "contractor_documents_select_admin"
  on storage.objects for select to authenticated
  using (bucket_id = 'contractor-documents' and public.is_admin());
