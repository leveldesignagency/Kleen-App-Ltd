-- ============================================================================
-- KLEEN — Full Supabase Schema
-- Run once in the Supabase SQL Editor (or via supabase db push)
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ──────────────────────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";       -- gen_random_uuid()
create extension if not exists "pg_trgm";        -- fuzzy text search on services


-- ──────────────────────────────────────────────────────────────────────────────
-- 1. ENUMS
-- ──────────────────────────────────────────────────────────────────────────────
create type user_role       as enum ('customer', 'operative', 'admin');
create type cleaning_type   as enum ('domestic', 'commercial');
create type room_size       as enum ('S', 'M', 'L');
create type job_complexity  as enum ('standard', 'deep');
create type job_status      as enum (
  'pending', 'quoted', 'accepted', 'scheduled',
  'in_progress', 'completed', 'disputed', 'cancelled'
);
create type payment_status  as enum ('pending', 'processing', 'succeeded', 'failed', 'refunded');
create type payment_method_type as enum ('card', 'paypal', 'klarna');
create type account_type as enum ('personal', 'business');
create type discount_type   as enum ('percentage', 'fixed');
create type dispute_status  as enum ('open', 'under_review', 'resolved', 'escalated', 'closed');
create type notification_channel as enum ('in_app', 'email', 'sms', 'push');
create type email_status    as enum ('queued', 'sending', 'sent', 'failed', 'bounced');


-- ──────────────────────────────────────────────────────────────────────────────
-- 2. CORE TABLES
-- ──────────────────────────────────────────────────────────────────────────────

-- 2a. Profiles (extends auth.users) ──────────────────────────────────────────
create table public.profiles (
  id              uuid primary key references auth.users on delete cascade,
  email           text not null,
  full_name       text,
  phone           text,
  avatar_url      text,
  role            user_role not null default 'customer',
  account_type    account_type not null default 'personal',
  onboarded_at    timestamptz,
  email_opt_in    boolean not null default true,
  sms_opt_in      boolean not null default false,
  push_opt_in     boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_profiles_email on public.profiles (email);
create index idx_profiles_role  on public.profiles (role);
create index idx_profiles_account_type on public.profiles (account_type);

-- Business account details (linked 1:1 to profile when account_type = 'business')
create table public.business_profiles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique references public.profiles on delete cascade,
  company_name        text not null,
  company_number      text,
  vat_number          text,
  billing_email       text,
  billing_address_id  uuid,
  industry            text,
  employee_count      text,
  website             text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_bp_user on public.business_profiles (user_id);

create trigger trg_bp_updated
  before update on public.business_profiles
  for each row execute function update_updated_at();

-- 2b. Addresses ──────────────────────────────────────────────────────────────
create table public.addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles on delete cascade,
  label       text not null default 'Home',
  line_1      text not null,
  line_2      text,
  city        text,
  postcode    text not null,
  country     text not null default 'GB',
  lat         double precision,
  lng         double precision,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index idx_addresses_user on public.addresses (user_id);


-- ──────────────────────────────────────────────────────────────────────────────
-- 3. SERVICE CATALOGUE
-- ──────────────────────────────────────────────────────────────────────────────

create table public.service_categories (
  id              text primary key,
  name            text not null,
  slug            text not null unique,
  description     text,
  icon            text,
  display_order   int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create table public.services (
  id                      text primary key,
  category_id             text not null references public.service_categories on delete cascade,
  name                    text not null,
  slug                    text not null unique,
  description             text,
  base_price_pence        int not null,
  price_per_unit_pence    int not null default 0,
  estimated_duration_min  int not null default 60,
  min_operatives          int not null default 1,
  max_operatives          int not null default 1,
  is_active               boolean not null default true,
  created_at              timestamptz not null default now()
);

create index idx_services_category on public.services (category_id);
create index idx_services_name_trgm on public.services using gin (name gin_trgm_ops);


-- ──────────────────────────────────────────────────────────────────────────────
-- 4. JOBS & QUOTES
-- ──────────────────────────────────────────────────────────────────────────────

create table public.jobs (
  id                uuid primary key default gen_random_uuid(),
  reference         text not null unique,
  user_id           uuid not null references public.profiles on delete cascade,
  service_id        text not null references public.services on delete restrict,
  cleaning_type     cleaning_type not null,
  status            job_status not null default 'pending',

  -- location
  address_line_1    text not null,
  address_line_2    text,
  city              text,
  postcode          text not null,

  -- scheduling
  preferred_date    date not null,
  preferred_time    time not null,
  actual_start      timestamptz,
  actual_end        timestamptz,

  -- promo
  promo_code_id     uuid,

  notes             text,
  cancelled_reason  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_jobs_user     on public.jobs (user_id);
create index idx_jobs_status   on public.jobs (status);
create index idx_jobs_date     on public.jobs (preferred_date);
create index idx_jobs_ref      on public.jobs (reference);

-- Line items per job
create table public.job_details (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.jobs on delete cascade,
  service_id    text not null references public.services on delete restrict,
  size          room_size not null default 'M',
  quantity      int not null default 1,
  complexity    job_complexity not null default 'standard',
  notes         text,
  created_at    timestamptz not null default now()
);

create index idx_job_details_job on public.job_details (job_id);

-- Formal quotes
create table public.quotes (
  id                      uuid primary key default gen_random_uuid(),
  job_id                  uuid not null references public.jobs on delete cascade,
  min_price_pence         int not null,
  max_price_pence         int not null,
  final_price_pence       int,
  discount_pence          int not null default 0,
  estimated_duration_min  int not null,
  operatives_required     int not null default 1,
  valid_until             timestamptz,
  accepted_at             timestamptz,
  rejected_at             timestamptz,
  created_at              timestamptz not null default now()
);

create index idx_quotes_job on public.quotes (job_id);

-- Generates a human-readable reference like KLN-7A3F
create or replace function generate_job_reference()
returns trigger language plpgsql as $$
begin
  new.reference := 'KLN-' || upper(substr(md5(new.id::text), 1, 6));
  return new;
end;
$$;

create trigger trg_job_reference
  before insert on public.jobs
  for each row execute function generate_job_reference();


-- ──────────────────────────────────────────────────────────────────────────────
-- 5. PAYMENTS
-- ──────────────────────────────────────────────────────────────────────────────

create table public.payment_methods (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references public.profiles on delete cascade,
  type                      payment_method_type not null,
  label                     text not null,
  last_four                 char(4),
  brand                     text,
  is_default                boolean not null default false,
  stripe_payment_method_id  text,
  created_at                timestamptz not null default now()
);

create index idx_pm_user on public.payment_methods (user_id);

create table public.payments (
  id                        uuid primary key default gen_random_uuid(),
  job_id                    uuid not null references public.jobs on delete cascade,
  user_id                   uuid not null references public.profiles on delete cascade,
  payment_method_id         uuid references public.payment_methods on delete set null,
  amount_pence              int not null,
  currency                  char(3) not null default 'gbp',
  status                    payment_status not null default 'pending',
  stripe_payment_intent_id  text,
  stripe_charge_id          text,
  refund_amount_pence       int,
  refund_reason             text,
  paid_at                   timestamptz,
  failed_at                 timestamptz,
  created_at                timestamptz not null default now()
);

create index idx_payments_job  on public.payments (job_id);
create index idx_payments_user on public.payments (user_id);


-- ──────────────────────────────────────────────────────────────────────────────
-- 6. OPERATIVES & ASSIGNMENTS
-- ──────────────────────────────────────────────────────────────────────────────

create table public.operatives (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid unique references public.profiles on delete set null,
  full_name         text not null,
  email             text not null,
  phone             text,
  specialisations   text[] default '{}',
  avg_rating        numeric(3,2) default 0,
  total_jobs        int not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

create index idx_operatives_email on public.operatives (email);

create table public.job_assignments (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references public.jobs on delete cascade,
  operative_id    uuid not null references public.operatives on delete cascade,
  assigned_at     timestamptz not null default now(),
  confirmed_at    timestamptz,
  started_at      timestamptz,
  completed_at    timestamptz,
  notes           text,
  unique (job_id, operative_id)
);

create index idx_assignments_job on public.job_assignments (job_id);
create index idx_assignments_op  on public.job_assignments (operative_id);

-- Operative availability windows
create table public.availability_slots (
  id              uuid primary key default gen_random_uuid(),
  operative_id    uuid not null references public.operatives on delete cascade,
  day_of_week     smallint not null check (day_of_week between 0 and 6),
  start_time      time not null,
  end_time        time not null,
  is_recurring    boolean not null default true,
  specific_date   date,
  created_at      timestamptz not null default now()
);

create index idx_avail_operative on public.availability_slots (operative_id);


-- ──────────────────────────────────────────────────────────────────────────────
-- 7. REVIEWS
-- ──────────────────────────────────────────────────────────────────────────────

create table public.reviews (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null unique references public.jobs on delete cascade,
  user_id         uuid not null references public.profiles on delete cascade,
  operative_id    uuid references public.operatives on delete set null,
  rating          smallint not null check (rating between 1 and 5),
  comment         text,
  response        text,
  responded_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index idx_reviews_user on public.reviews (user_id);
create index idx_reviews_op   on public.reviews (operative_id);


-- ──────────────────────────────────────────────────────────────────────────────
-- 8. DISPUTES
-- ──────────────────────────────────────────────────────────────────────────────

create table public.disputes (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.jobs on delete cascade,
  user_id       uuid not null references public.profiles on delete cascade,
  status        dispute_status not null default 'open',
  reason        text not null,
  resolution    text,
  resolved_by   uuid references public.profiles on delete set null,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_disputes_job  on public.disputes (job_id);
create index idx_disputes_user on public.disputes (user_id);

create table public.dispute_messages (
  id            uuid primary key default gen_random_uuid(),
  dispute_id    uuid not null references public.disputes on delete cascade,
  sender_id     uuid not null references public.profiles on delete cascade,
  message       text not null,
  attachments   text[] default '{}',
  created_at    timestamptz not null default now()
);

create index idx_dm_dispute on public.dispute_messages (dispute_id);


-- ──────────────────────────────────────────────────────────────────────────────
-- 9. NOTIFICATIONS
-- ──────────────────────────────────────────────────────────────────────────────

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles on delete cascade,
  channel     notification_channel not null default 'in_app',
  title       text not null,
  body        text,
  data        jsonb default '{}',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index idx_notif_user      on public.notifications (user_id);
create index idx_notif_unread    on public.notifications (user_id) where read_at is null;
create index idx_notif_created   on public.notifications (created_at desc);


-- ──────────────────────────────────────────────────────────────────────────────
-- 10. EMAIL SYSTEM
-- ──────────────────────────────────────────────────────────────────────────────

create table public.email_templates (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  subject_template  text not null,
  body_template     text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.email_queue (
  id              uuid primary key default gen_random_uuid(),
  to_email        text not null,
  to_name         text,
  template_id     uuid references public.email_templates on delete set null,
  template_data   jsonb default '{}',
  subject         text not null,
  body_html       text,
  status          email_status not null default 'queued',
  attempts        int not null default 0,
  max_attempts    int not null default 3,
  last_error      text,
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index idx_email_status  on public.email_queue (status) where status = 'queued';
create index idx_email_created on public.email_queue (created_at desc);


-- ──────────────────────────────────────────────────────────────────────────────
-- 11. ACTIVITY LOG (audit trail)
-- ──────────────────────────────────────────────────────────────────────────────

create table public.activity_log (
  id            bigint generated always as identity primary key,
  user_id       uuid references public.profiles on delete set null,
  entity_type   text not null,
  entity_id     text not null,
  action        text not null,
  metadata      jsonb default '{}',
  ip_address    inet,
  created_at    timestamptz not null default now()
);

create index idx_activity_entity on public.activity_log (entity_type, entity_id);
create index idx_activity_user   on public.activity_log (user_id);
create index idx_activity_date   on public.activity_log (created_at desc);


-- ──────────────────────────────────────────────────────────────────────────────
-- 12. PROMO CODES
-- ──────────────────────────────────────────────────────────────────────────────

create table public.promo_codes (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  description       text,
  discount_kind     discount_type not null,
  discount_value    int not null,
  min_order_pence   int not null default 0,
  max_uses          int,
  current_uses      int not null default 0,
  per_user_limit    int not null default 1,
  valid_from        timestamptz not null default now(),
  valid_until       timestamptz,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

create index idx_promo_code on public.promo_codes (code);

create table public.promo_redemptions (
  id                uuid primary key default gen_random_uuid(),
  promo_code_id     uuid not null references public.promo_codes on delete cascade,
  user_id           uuid not null references public.profiles on delete cascade,
  job_id            uuid not null references public.jobs on delete cascade,
  discount_pence    int not null,
  redeemed_at       timestamptz not null default now()
);

create index idx_pr_user  on public.promo_redemptions (user_id);
create index idx_pr_promo on public.promo_redemptions (promo_code_id);

-- Add FK from jobs to promo_codes now that both exist
alter table public.jobs
  add constraint fk_jobs_promo
  foreign key (promo_code_id) references public.promo_codes (id) on delete set null;


-- ──────────────────────────────────────────────────────────────────────────────
-- 13. APP SETTINGS (key-value)
-- ──────────────────────────────────────────────────────────────────────────────

create table public.app_settings (
  key         text primary key,
  value       jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);


-- ══════════════════════════════════════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Auto-update updated_at ──────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated    before update on public.profiles      for each row execute function update_updated_at();
create trigger trg_jobs_updated        before update on public.jobs          for each row execute function update_updated_at();
create trigger trg_disputes_updated    before update on public.disputes      for each row execute function update_updated_at();
create trigger trg_email_tpl_updated   before update on public.email_templates for each row execute function update_updated_at();
create trigger trg_app_settings_updated before update on public.app_settings for each row execute function update_updated_at();


-- ── Auto-create profile on signup ───────────────────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'customer')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ── Notify user helper ──────────────────────────────────────────────────────
create or replace function notify_user(
  p_user_id uuid,
  p_title   text,
  p_body    text default null,
  p_data    jsonb default '{}'
)
returns uuid language plpgsql security definer as $$
declare
  v_id uuid;
begin
  insert into public.notifications (user_id, title, body, data)
  values (p_user_id, p_title, p_body, p_data)
  returning id into v_id;
  return v_id;
end;
$$;


-- ── Queue email helper ──────────────────────────────────────────────────────
create or replace function queue_email(
  p_to_email      text,
  p_to_name       text,
  p_subject       text,
  p_body_html     text default null,
  p_template_id   uuid default null,
  p_template_data jsonb default '{}'
)
returns uuid language plpgsql security definer as $$
declare
  v_id uuid;
begin
  insert into public.email_queue (to_email, to_name, subject, body_html, template_id, template_data)
  values (p_to_email, p_to_name, p_subject, p_body_html, p_template_id, p_template_data)
  returning id into v_id;
  return v_id;
end;
$$;


-- ── Log activity helper ─────────────────────────────────────────────────────
create or replace function log_activity(
  p_user_id     uuid,
  p_entity_type text,
  p_entity_id   text,
  p_action      text,
  p_metadata    jsonb default '{}'
)
returns bigint language plpgsql security definer as $$
declare
  v_id bigint;
begin
  insert into public.activity_log (user_id, entity_type, entity_id, action, metadata)
  values (p_user_id, p_entity_type, p_entity_id, p_action, p_metadata)
  returning id into v_id;
  return v_id;
end;
$$;


-- ── Job status change → notification + activity log + email ─────────────────
create or replace function on_job_status_change()
returns trigger language plpgsql security definer as $$
declare
  v_title    text;
  v_body     text;
  v_svc_name text;
  v_email    text;
  v_name     text;
begin
  if old.status = new.status then return new; end if;

  select s.name into v_svc_name from public.services s where s.id = new.service_id;
  select p.email, p.full_name into v_email, v_name from public.profiles p where p.id = new.user_id;

  case new.status
    when 'quoted' then
      v_title := 'Quote ready';
      v_body  := format('Your quote for %s is ready to review.', v_svc_name);
    when 'accepted' then
      v_title := 'Quote accepted';
      v_body  := format('You accepted the quote for %s. We''re scheduling your clean.', v_svc_name);
    when 'scheduled' then
      v_title := 'Job scheduled';
      v_body  := format('Your %s has been scheduled for %s.', v_svc_name, to_char(new.preferred_date, 'DD Mon YYYY'));
    when 'in_progress' then
      v_title := 'Cleaning in progress';
      v_body  := format('Your %s is now underway!', v_svc_name);
    when 'completed' then
      v_title := 'Job completed';
      v_body  := format('Your %s is finished. Please leave a review!', v_svc_name);
    when 'disputed' then
      v_title := 'Dispute opened';
      v_body  := format('A dispute has been opened for your %s. We''ll review it shortly.', v_svc_name);
    when 'cancelled' then
      v_title := 'Job cancelled';
      v_body  := format('Your %s booking has been cancelled.', v_svc_name);
    else
      v_title := 'Job updated';
      v_body  := format('Your %s status changed to %s.', v_svc_name, new.status);
  end case;

  -- In-app notification
  perform notify_user(
    new.user_id,
    v_title,
    v_body,
    jsonb_build_object('job_id', new.id, 'reference', new.reference, 'old_status', old.status, 'new_status', new.status)
  );

  -- Queue email
  perform queue_email(
    v_email,
    v_name,
    'KLEEN — ' || v_title,
    format('<h2>%s</h2><p>%s</p><p>Job ref: <strong>%s</strong></p>', v_title, v_body, new.reference)
  );

  -- Activity log
  perform log_activity(
    new.user_id,
    'job',
    new.id::text,
    'status_changed',
    jsonb_build_object('from', old.status, 'to', new.status)
  );

  return new;
end;
$$;

create trigger trg_job_status_change
  after update of status on public.jobs
  for each row execute function on_job_status_change();


-- ── New job → notification + activity + welcome email ───────────────────────
create or replace function on_job_created()
returns trigger language plpgsql security definer as $$
declare
  v_svc_name text;
  v_email    text;
  v_name     text;
begin
  select s.name into v_svc_name from public.services s where s.id = new.service_id;
  select p.email, p.full_name into v_email, v_name from public.profiles p where p.id = new.user_id;

  perform notify_user(
    new.user_id,
    'Job submitted!',
    format('Your %s booking (%s) has been received. We''ll send you a quote shortly.', v_svc_name, new.reference),
    jsonb_build_object('job_id', new.id, 'reference', new.reference)
  );

  perform queue_email(
    v_email,
    v_name,
    'KLEEN — Booking Confirmation',
    format(
      '<h2>Booking Received</h2><p>Hi %s,</p><p>Thanks for booking <strong>%s</strong> with KLEEN.</p><p>Job reference: <strong>%s</strong></p><p>Preferred date: %s at %s</p><p>We''ll send your quote shortly.</p>',
      coalesce(v_name, 'there'),
      v_svc_name,
      new.reference,
      to_char(new.preferred_date, 'DD Mon YYYY'),
      new.preferred_time::text
    )
  );

  perform log_activity(new.user_id, 'job', new.id::text, 'created', jsonb_build_object('service', v_svc_name));

  return new;
end;
$$;

create trigger trg_job_created
  after insert on public.jobs
  for each row execute function on_job_created();


-- ── Payment status change → notification + activity ─────────────────────────
create or replace function on_payment_status_change()
returns trigger language plpgsql security definer as $$
declare
  v_ref  text;
  v_name text;
  v_email text;
begin
  if old.status = new.status then return new; end if;

  select j.reference into v_ref from public.jobs j where j.id = new.job_id;
  select p.full_name, p.email into v_name, v_email from public.profiles p where p.id = new.user_id;

  if new.status = 'succeeded' then
    perform notify_user(
      new.user_id,
      'Payment received',
      format('£%.2f payment for job %s received.', new.amount_pence / 100.0, v_ref),
      jsonb_build_object('job_id', new.job_id, 'payment_id', new.id)
    );
    perform queue_email(
      v_email, v_name,
      'KLEEN — Payment Confirmation',
      format('<h2>Payment Confirmed</h2><p>We received £%.2f for job <strong>%s</strong>.</p>', new.amount_pence / 100.0, v_ref)
    );
  elsif new.status = 'failed' then
    perform notify_user(
      new.user_id,
      'Payment failed',
      format('Payment for job %s could not be processed. Please update your payment method.', v_ref),
      jsonb_build_object('job_id', new.job_id, 'payment_id', new.id)
    );
  elsif new.status = 'refunded' then
    perform notify_user(
      new.user_id,
      'Refund processed',
      format('£%.2f has been refunded for job %s.', coalesce(new.refund_amount_pence, new.amount_pence) / 100.0, v_ref),
      jsonb_build_object('job_id', new.job_id, 'payment_id', new.id)
    );
  end if;

  perform log_activity(new.user_id, 'payment', new.id::text, 'status_changed', jsonb_build_object('from', old.status, 'to', new.status, 'amount_pence', new.amount_pence));

  return new;
end;
$$;

create trigger trg_payment_status_change
  after update of status on public.payments
  for each row execute function on_payment_status_change();


-- ── Review created → update operative avg_rating ────────────────────────────
create or replace function on_review_created()
returns trigger language plpgsql security definer as $$
begin
  if new.operative_id is not null then
    update public.operatives
    set avg_rating = (
      select round(avg(rating)::numeric, 2)
      from public.reviews
      where operative_id = new.operative_id
    ),
    total_jobs = total_jobs  -- will be updated separately
    where id = new.operative_id;
  end if;

  perform log_activity(new.user_id, 'review', new.id::text, 'created', jsonb_build_object('job_id', new.job_id, 'rating', new.rating));

  return new;
end;
$$;

create trigger trg_review_created
  after insert on public.reviews
  for each row execute function on_review_created();


-- ── Dispute status change → notification ────────────────────────────────────
create or replace function on_dispute_status_change()
returns trigger language plpgsql security definer as $$
declare
  v_ref text;
begin
  if old.status = new.status then return new; end if;

  select j.reference into v_ref from public.jobs j where j.id = new.job_id;

  perform notify_user(
    new.user_id,
    'Dispute update — ' || new.status::text,
    format('Your dispute for job %s is now %s.', v_ref, new.status::text),
    jsonb_build_object('dispute_id', new.id, 'job_id', new.job_id, 'status', new.status)
  );

  perform log_activity(new.user_id, 'dispute', new.id::text, 'status_changed', jsonb_build_object('from', old.status, 'to', new.status));

  return new;
end;
$$;

create trigger trg_dispute_status_change
  after update of status on public.disputes
  for each row execute function on_dispute_status_change();


-- ══════════════════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

-- Helper: check if current user is admin
create or replace function is_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Helper: check if current user is operative
create or replace function is_operative()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'operative'
  );
$$;

-- ── profiles ────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (id = auth.uid() or is_admin());

create policy "Users can update own profile"
  on public.profiles for update using (id = auth.uid());

create policy "Admins can manage all profiles"
  on public.profiles for all using (is_admin());

-- ── business_profiles ──────────────────────────────────────────────────────
alter table public.business_profiles enable row level security;

create policy "Users can view own business profile"
  on public.business_profiles for select using (user_id = auth.uid() or is_admin());

create policy "Users can manage own business profile"
  on public.business_profiles for all using (user_id = auth.uid() or is_admin());

-- ── addresses ───────────────────────────────────────────────────────────────
alter table public.addresses enable row level security;

create policy "Users manage own addresses"
  on public.addresses for all using (user_id = auth.uid() or is_admin());

-- ── service_categories & services (public read, admin write) ────────────────
alter table public.service_categories enable row level security;
alter table public.services enable row level security;

create policy "Anyone can read categories"
  on public.service_categories for select using (true);

create policy "Admins manage categories"
  on public.service_categories for all using (is_admin());

create policy "Anyone can read services"
  on public.services for select using (true);

create policy "Admins manage services"
  on public.services for all using (is_admin());

-- ── jobs ────────────────────────────────────────────────────────────────────
alter table public.jobs enable row level security;

create policy "Users see own jobs"
  on public.jobs for select using (user_id = auth.uid() or is_admin());

create policy "Users create own jobs"
  on public.jobs for insert with check (user_id = auth.uid());

create policy "Users can update own pending jobs"
  on public.jobs for update using (user_id = auth.uid() or is_admin());

create policy "Admins manage all jobs"
  on public.jobs for all using (is_admin());

-- Operatives see jobs assigned to them
create policy "Operatives see assigned jobs"
  on public.jobs for select using (
    exists (
      select 1 from public.job_assignments ja
      join public.operatives o on o.id = ja.operative_id
      where ja.job_id = jobs.id and o.user_id = auth.uid()
    )
  );

-- ── job_details ─────────────────────────────────────────────────────────────
alter table public.job_details enable row level security;

create policy "Users see own job details"
  on public.job_details for select using (
    exists (select 1 from public.jobs j where j.id = job_id and (j.user_id = auth.uid() or is_admin()))
  );

create policy "Users create own job details"
  on public.job_details for insert with check (
    exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid())
  );

-- ── quotes ──────────────────────────────────────────────────────────────────
alter table public.quotes enable row level security;

create policy "Users see own quotes"
  on public.quotes for select using (
    exists (select 1 from public.jobs j where j.id = job_id and (j.user_id = auth.uid() or is_admin()))
  );

create policy "Admins manage quotes"
  on public.quotes for all using (is_admin());

-- ── payment_methods ─────────────────────────────────────────────────────────
alter table public.payment_methods enable row level security;

create policy "Users manage own payment methods"
  on public.payment_methods for all using (user_id = auth.uid() or is_admin());

-- ── payments ────────────────────────────────────────────────────────────────
alter table public.payments enable row level security;

create policy "Users see own payments"
  on public.payments for select using (user_id = auth.uid() or is_admin());

create policy "Admins manage payments"
  on public.payments for all using (is_admin());

-- ── operatives ──────────────────────────────────────────────────────────────
alter table public.operatives enable row level security;

create policy "Admins manage operatives"
  on public.operatives for all using (is_admin());

create policy "Operatives see own record"
  on public.operatives for select using (user_id = auth.uid());

-- ── job_assignments ─────────────────────────────────────────────────────────
alter table public.job_assignments enable row level security;

create policy "Admins manage assignments"
  on public.job_assignments for all using (is_admin());

create policy "Operatives see own assignments"
  on public.job_assignments for select using (
    exists (select 1 from public.operatives o where o.id = operative_id and o.user_id = auth.uid())
  );

-- ── availability_slots ──────────────────────────────────────────────────────
alter table public.availability_slots enable row level security;

create policy "Admins manage availability"
  on public.availability_slots for all using (is_admin());

create policy "Operatives manage own availability"
  on public.availability_slots for all using (
    exists (select 1 from public.operatives o where o.id = operative_id and o.user_id = auth.uid())
  );

-- ── reviews ─────────────────────────────────────────────────────────────────
alter table public.reviews enable row level security;

create policy "Anyone can read reviews"
  on public.reviews for select using (true);

create policy "Users create own reviews"
  on public.reviews for insert with check (user_id = auth.uid());

create policy "Admins manage reviews"
  on public.reviews for all using (is_admin());

-- ── disputes ────────────────────────────────────────────────────────────────
alter table public.disputes enable row level security;

create policy "Users see own disputes"
  on public.disputes for select using (user_id = auth.uid() or is_admin());

create policy "Users create disputes"
  on public.disputes for insert with check (user_id = auth.uid());

create policy "Admins manage disputes"
  on public.disputes for all using (is_admin());

-- ── dispute_messages ────────────────────────────────────────────────────────
alter table public.dispute_messages enable row level security;

create policy "Dispute participants see messages"
  on public.dispute_messages for select using (
    exists (
      select 1 from public.disputes d
      where d.id = dispute_id and (d.user_id = auth.uid() or is_admin())
    )
  );

create policy "Dispute participants send messages"
  on public.dispute_messages for insert with check (sender_id = auth.uid());

-- ── notifications ───────────────────────────────────────────────────────────
alter table public.notifications enable row level security;

create policy "Users see own notifications"
  on public.notifications for select using (user_id = auth.uid());

create policy "Users mark own as read"
  on public.notifications for update using (user_id = auth.uid());

create policy "System creates notifications"
  on public.notifications for insert with check (true);

-- ── email_queue ─────────────────────────────────────────────────────────────
alter table public.email_queue enable row level security;

create policy "Admins manage email queue"
  on public.email_queue for all using (is_admin());

-- ── email_templates ─────────────────────────────────────────────────────────
alter table public.email_templates enable row level security;

create policy "Admins manage templates"
  on public.email_templates for all using (is_admin());

-- ── activity_log ────────────────────────────────────────────────────────────
alter table public.activity_log enable row level security;

create policy "Users see own activity"
  on public.activity_log for select using (user_id = auth.uid() or is_admin());

create policy "System writes activity"
  on public.activity_log for insert with check (true);

-- ── promo_codes ─────────────────────────────────────────────────────────────
alter table public.promo_codes enable row level security;

create policy "Anyone can read active promos"
  on public.promo_codes for select using (is_active = true);

create policy "Admins manage promos"
  on public.promo_codes for all using (is_admin());

-- ── promo_redemptions ───────────────────────────────────────────────────────
alter table public.promo_redemptions enable row level security;

create policy "Users see own redemptions"
  on public.promo_redemptions for select using (user_id = auth.uid() or is_admin());

create policy "Users create redemptions"
  on public.promo_redemptions for insert with check (user_id = auth.uid());

-- ── app_settings ────────────────────────────────────────────────────────────
alter table public.app_settings enable row level security;

create policy "Anyone can read settings"
  on public.app_settings for select using (true);

create policy "Admins manage settings"
  on public.app_settings for all using (is_admin());


-- ══════════════════════════════════════════════════════════════════════════════
-- SEED DATA
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Service categories ──────────────────────────────────────────────────────
insert into public.service_categories (id, name, slug, description, icon, display_order) values
  ('exterior',   'Exterior Cleaning',    'exterior',   'Driveways, patios, decking, walls, and fences',              'Home',       1),
  ('interior',   'Interior Cleaning',    'interior',   'Full house, room-by-room, or specific area cleaning',        'Sparkles',   2),
  ('gutter',     'Gutter & Roofline',    'gutter',     'Gutter clearing, fascia, and soffit cleaning',               'CloudRain',  3),
  ('kitchen',    'Kitchen',              'kitchen',    'Oven, hob, extractor, and full kitchen deep cleans',          'ChefHat',    4),
  ('eot',        'End-of-Tenancy',       'eot',        'Move-out deep clean to landlord/agency standards',            'Key',        5),
  ('vehicle',    'Vehicle Cleaning',     'vehicle',    'Car valeting, interior, and exterior vehicle cleaning',       'Car',        6),
  ('garden',     'Garden',               'garden',     'Garden tidying, lawn care, and green waste removal',          'TreePine',   7),
  ('commercial', 'Commercial Cleaning',  'commercial', 'Office, retail, and commercial property cleaning',            'Building2',  8),
  ('waste',      'Waste Removal',        'waste',      'Rubbish clearance, recycling, and waste disposal',            'Trash2',     9);

-- ── Services ────────────────────────────────────────────────────────────────
insert into public.services (id, category_id, name, slug, description, base_price_pence, price_per_unit_pence, estimated_duration_min, min_operatives, max_operatives) values
  -- Exterior
  ('driveway',      'exterior', 'Driveway Cleaning',       'driveway',       'High-pressure wash for driveways and paths',                    8000,  3000, 120, 1, 2),
  ('patio',         'exterior', 'Patio Cleaning',          'patio',          'Deep clean for patios and outdoor seating areas',                6000,  2500,  90, 1, 2),
  ('decking',       'exterior', 'Decking Cleaning',        'decking',        'Specialist wood or composite decking treatment',                 7000,  2800, 100, 1, 2),
  ('wall-fence',    'exterior', 'Wall & Fence Cleaning',   'wall-fence',     'Exterior wall and fence cleaning and restoration',               5000,  2000,  90, 1, 2),
  -- Interior
  ('full-house',    'interior', 'Full House Clean',        'full-house',     'Comprehensive top-to-bottom house cleaning',                    12000,  4000, 180, 1, 3),
  ('room-clean',    'interior', 'Room Clean',              'room-clean',     'Individual room deep clean',                                     3500,  1500,  45, 1, 1),
  ('bathroom',      'interior', 'Bathroom Clean',          'bathroom',       'Specialist bathroom deep clean and sanitisation',                 4000,  1800,  60, 1, 1),
  -- Gutter
  ('gutter-clear',  'gutter',   'Gutter Clearing',         'gutter-clear',   'Remove debris and ensure proper drainage',                       8000,  2000,  90, 1, 2),
  ('fascia-soffit',  'gutter',  'Fascia & Soffit Clean',   'fascia-soffit',  'Restore roofline appearance',                                    9000,  2500, 120, 1, 2),
  -- Kitchen
  ('oven-clean',    'kitchen',  'Oven Clean',              'oven-clean',     'Professional oven and hob deep clean',                           5500,  2000,  75, 1, 1),
  ('kitchen-deep',  'kitchen',  'Full Kitchen Deep Clean', 'kitchen-deep',   'Complete kitchen including appliances and surfaces',              9000,  3500, 120, 1, 2),
  -- End of Tenancy
  ('eot-studio',    'eot',      'Studio / 1 Bed',          'eot-studio',     'End-of-tenancy clean for studio or 1-bed property',             15000,     0, 240, 1, 2),
  ('eot-2bed',      'eot',      ' 2–3 Bed Property',       'eot-2bed',       'End-of-tenancy clean for 2–3 bedroom property',                 22000,     0, 360, 2, 3),
  ('eot-4bed',      'eot',      '4+ Bed Property',         'eot-4bed',       'End-of-tenancy clean for larger properties',                    32000,     0, 480, 2, 4),
  -- Vehicle
  ('car-exterior',  'vehicle',  'Car Exterior Wash',       'car-exterior',   'Full exterior hand wash and dry',                                3000,  1000,  45, 1, 1),
  ('car-interior',  'vehicle',  'Car Interior Valet',      'car-interior',   'Full interior vacuum, wipe, and freshen',                        4500,  1500,  60, 1, 1),
  ('car-full',      'vehicle',  'Full Valet',              'car-full',       'Complete interior and exterior valet service',                    7000,  2000,  90, 1, 1),
  -- Garden
  ('garden-tidy',   'garden',   'Garden Tidy-Up',          'garden-tidy',    'General garden clearance and tidying',                           6000,  2000, 120, 1, 2),
  ('lawn-care',     'garden',   'Lawn Care',               'lawn-care',      'Mowing, edging, and lawn treatment',                             4000,  1500,  60, 1, 1),
  -- Commercial
  ('office-clean',    'commercial', 'Office Clean',           'office-clean',    'Regular or one-off office cleaning',                         10000,  4000, 120, 1, 3),
  ('retail-clean',    'commercial', 'Retail Premises Clean',  'retail-clean',    'Shopfront and retail unit cleaning',                          9000,  3500, 120, 1, 2),
  ('warehouse-clean', 'commercial', 'Warehouse / Industrial', 'warehouse-clean', 'Large-scale commercial space cleaning',                     20000,  6000, 300, 2, 6),
  -- Waste
  ('general-waste',  'waste',  'General Waste Removal',   'general-waste',  'Collection and disposal of household waste',                     8000,  3000,  60, 1, 2),
  ('garden-waste',   'waste',  'Garden Waste Removal',    'garden-waste',   'Green waste collection and disposal',                            6000,  2500,  45, 1, 2);


-- ── Email templates ─────────────────────────────────────────────────────────
insert into public.email_templates (slug, name, subject_template, body_template) values
  ('booking_confirmation', 'Booking Confirmation',
   'KLEEN — Booking Confirmed ({{reference}})',
   '<h2>Booking Confirmed</h2><p>Hi {{name}},</p><p>Your <strong>{{service}}</strong> booking has been received.</p><p>Reference: <strong>{{reference}}</strong></p><p>Date: {{date}} at {{time}}</p><p>We''ll send your quote shortly.</p>'),

  ('quote_ready', 'Quote Ready',
   'KLEEN — Your Quote is Ready ({{reference}})',
   '<h2>Your Quote</h2><p>Hi {{name}},</p><p>Your quote for <strong>{{service}}</strong> is ready:</p><p>Estimated: <strong>{{min_price}} – {{max_price}}</strong></p><p><a href="{{dashboard_url}}">Review your quote →</a></p>'),

  ('job_scheduled', 'Job Scheduled',
   'KLEEN — Job Scheduled ({{reference}})',
   '<h2>You''re All Set</h2><p>Hi {{name}},</p><p>Your <strong>{{service}}</strong> is confirmed for <strong>{{date}}</strong> at <strong>{{time}}</strong>.</p><p>Our team will arrive on time. You''ll get a notification when they''re on the way.</p>'),

  ('job_completed', 'Job Completed',
   'KLEEN — Job Complete! ({{reference}})',
   '<h2>All Done!</h2><p>Hi {{name}},</p><p>Your <strong>{{service}}</strong> is complete.</p><p>Total: <strong>{{total}}</strong></p><p><a href="{{review_url}}">Leave a review →</a></p>'),

  ('payment_confirmation', 'Payment Confirmation',
   'KLEEN — Payment Received ({{reference}})',
   '<h2>Payment Confirmed</h2><p>Hi {{name}},</p><p>We received your payment of <strong>{{amount}}</strong> for job <strong>{{reference}}</strong>.</p>'),

  ('payment_failed', 'Payment Failed',
   'KLEEN — Payment Issue ({{reference}})',
   '<h2>Payment Issue</h2><p>Hi {{name}},</p><p>We couldn''t process payment for job <strong>{{reference}}</strong>.</p><p><a href="{{payment_url}}">Update your payment method →</a></p>'),

  ('dispute_opened', 'Dispute Opened',
   'KLEEN — Dispute Opened ({{reference}})',
   '<h2>Dispute Received</h2><p>Hi {{name}},</p><p>We''ve received your dispute for job <strong>{{reference}}</strong>. Our team will review it within 48 hours.</p>'),

  ('dispute_resolved', 'Dispute Resolved',
   'KLEEN — Dispute Resolved ({{reference}})',
   '<h2>Dispute Resolved</h2><p>Hi {{name}},</p><p>Your dispute for job <strong>{{reference}}</strong> has been resolved.</p><p>Resolution: {{resolution}}</p>'),

  ('welcome', 'Welcome to KLEEN',
   'Welcome to KLEEN!',
   '<h2>Welcome to KLEEN</h2><p>Hi {{name}},</p><p>Thanks for joining KLEEN. You can now book professional cleaning services in just a few taps.</p><p><a href="{{app_url}}">Book your first clean →</a></p>'),

  ('password_reset', 'Password Reset',
   'KLEEN — Reset Your Password',
   '<h2>Password Reset</h2><p>Hi {{name}},</p><p>Click below to reset your password:</p><p><a href="{{reset_url}}">Reset Password →</a></p><p>If you didn''t request this, you can safely ignore this email.</p>');


-- ── Default app settings ────────────────────────────────────────────────────
insert into public.app_settings (key, value) values
  ('pricing', '{"size_multiplier": {"S": 0.75, "M": 1.0, "L": 1.5}, "complexity_multiplier": {"standard": 1.0, "deep": 1.4}, "variance": 0.15}'),
  ('business_hours', '{"weekdays": {"open": "08:00", "close": "18:00"}, "saturday": {"open": "09:00", "close": "16:00"}, "sunday": null}'),
  ('booking', '{"max_advance_days": 60, "min_notice_hours": 24, "cancellation_hours": 48}'),
  ('notifications', '{"email_from": "hello@kleenapp.co.uk", "email_reply_to": "support@kleenapp.co.uk"}');


-- ──────────────────────────────────────────────────────────────────────────────
-- 14. RECURRING BOOKINGS & QUICK REBOOK
-- ──────────────────────────────────────────────────────────────────────────────

create type recurrence_frequency as enum ('weekly', 'fortnightly', 'monthly');
create type schedule_status      as enum ('active', 'paused', 'cancelled');

-- Saved job templates (auto-created from completed jobs, or manually saved)
create table public.job_templates (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles on delete cascade,
  source_job_id   uuid references public.jobs on delete set null,
  label           text not null,
  service_id      text not null references public.services on delete restrict,
  cleaning_type   cleaning_type not null,
  size            room_size not null default 'M',
  quantity        int not null default 1,
  complexity      job_complexity not null default 'standard',
  address_line_1  text not null,
  address_line_2  text,
  city            text,
  postcode        text not null,
  preferred_time  time,
  notes           text,
  times_booked    int not null default 0,
  last_booked_at  timestamptz,
  is_favourite    boolean not null default false,
  created_at      timestamptz not null default now()
);

create index idx_templates_user      on public.job_templates (user_id);
create index idx_templates_frequency on public.job_templates (user_id, times_booked desc);

-- Recurring schedules (auto-generates jobs on a cadence)
create table public.recurring_schedules (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles on delete cascade,
  template_id       uuid not null references public.job_templates on delete cascade,
  frequency         recurrence_frequency not null,
  preferred_day     smallint not null check (preferred_day between 0 and 6),
  preferred_time    time not null default '09:00',
  status            schedule_status not null default 'active',
  next_run_date     date not null,
  last_run_date     date,
  total_runs        int not null default 0,
  max_runs          int,
  payment_method_id uuid references public.payment_methods on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_recurring_user   on public.recurring_schedules (user_id);
create index idx_recurring_next   on public.recurring_schedules (next_run_date) where status = 'active';

create trigger trg_recurring_updated
  before update on public.recurring_schedules
  for each row execute function update_updated_at();

-- Auto-create job template when a job is completed
create or replace function on_job_completed_save_template()
returns trigger language plpgsql security definer as $$
declare
  v_svc_name text;
  v_detail   record;
  v_existing uuid;
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  select s.name into v_svc_name from public.services s where s.id = new.service_id;
  select * into v_detail from public.job_details where job_id = new.id limit 1;

  select id into v_existing
  from public.job_templates
  where user_id = new.user_id
    and service_id = new.service_id
    and postcode = new.postcode
    and coalesce(v_detail.size, 'M') = size
    and coalesce(v_detail.complexity, 'standard') = complexity
  limit 1;

  if v_existing is not null then
    update public.job_templates
    set times_booked = times_booked + 1,
        last_booked_at = now(),
        source_job_id = new.id
    where id = v_existing;
  else
    insert into public.job_templates (
      user_id, source_job_id, label, service_id, cleaning_type,
      size, quantity, complexity,
      address_line_1, address_line_2, city, postcode,
      preferred_time, notes, times_booked, last_booked_at
    ) values (
      new.user_id, new.id, v_svc_name, new.service_id, new.cleaning_type,
      coalesce(v_detail.size, 'M'), coalesce(v_detail.quantity, 1), coalesce(v_detail.complexity, 'standard'),
      new.address_line_1, new.address_line_2, new.city, new.postcode,
      new.preferred_time, new.notes, 1, now()
    );
  end if;

  return new;
end;
$$;

create trigger trg_job_completed_template
  after update of status on public.jobs
  for each row execute function on_job_completed_save_template();

-- RLS for job_templates
alter table public.job_templates enable row level security;

create policy "Users manage own templates"
  on public.job_templates for all using (user_id = auth.uid() or is_admin());

-- RLS for recurring_schedules
alter table public.recurring_schedules enable row level security;

create policy "Users manage own schedules"
  on public.recurring_schedules for all using (user_id = auth.uid() or is_admin());


-- ══════════════════════════════════════════════════════════════════════════════
-- VIEWS (convenient read-only aggregations)
-- ══════════════════════════════════════════════════════════════════════════════

-- Dashboard stats per user
create or replace view public.user_dashboard_stats as
select
  j.user_id,
  count(*)                                                          as total_jobs,
  count(*) filter (where j.status in ('pending','quoted','accepted','scheduled','in_progress')) as active_jobs,
  count(*) filter (where j.status = 'completed')                    as completed_jobs,
  count(*) filter (where j.status = 'disputed')                     as disputed_jobs,
  coalesce(sum(p.amount_pence) filter (where p.status = 'succeeded'), 0) as total_spent_pence
from public.jobs j
left join public.payments p on p.job_id = j.id
group by j.user_id;

-- Unread notification count per user
create or replace view public.unread_notification_count as
select
  user_id,
  count(*) as unread_count
from public.notifications
where read_at is null
group by user_id;
