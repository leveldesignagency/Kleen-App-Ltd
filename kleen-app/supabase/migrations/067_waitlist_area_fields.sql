-- ============================================================================
-- KLEEN — Migration 067: Area metadata on service-area waitlist
-- Enables admin filtering by county, district, region, and postcode area.
-- ============================================================================

alter table public.service_area_waitlist
  add column if not exists area_label text,
  add column if not exists admin_county text,
  add column if not exists admin_district text,
  add column if not exists region text,
  add column if not exists postcode_area text;

create index if not exists idx_service_area_waitlist_county
  on public.service_area_waitlist (admin_county);

create index if not exists idx_service_area_waitlist_district
  on public.service_area_waitlist (admin_district);

create index if not exists idx_service_area_waitlist_postcode_area
  on public.service_area_waitlist (postcode_area);

comment on column public.service_area_waitlist.area_label is
  'Human-readable place label from postcodes.io (parish / district / county).';
comment on column public.service_area_waitlist.postcode_area is
  'UK outward postcode area (e.g. SE1, ME4, TN23).';
