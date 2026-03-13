-- Add updated_at to addresses for consistency with other tables
alter table public.addresses
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_addresses_updated on public.addresses;
create trigger trg_addresses_updated
  before update on public.addresses
  for each row execute function update_updated_at();
