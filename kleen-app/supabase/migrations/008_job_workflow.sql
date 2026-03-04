-- ============================================================================
-- KLEEN — Migration 008: Full Job Workflow
-- Adds columns for the real business flow:
--   Customer submits → Admin sends to contractors → Contractors quote →
--   Admin marks up 17.5% and sends to customer → Customer accepts →
--   Contractor completes → Both confirm → Funds released
-- ============================================================================

-- 1. Service fee percentage (stored as basis points for precision)
alter table public.jobs
  add column if not exists service_fee_bps int not null default 1750;

-- 2. Track which quote the customer accepted
alter table public.jobs
  add column if not exists accepted_quote_request_id uuid references public.quote_requests on delete set null;

-- 3. Customer-facing quote tracking
alter table public.jobs
  add column if not exists quotes_sent_to_customer_at timestamptz,
  add column if not exists customer_accepted_at timestamptz;

-- 4. Completion confirmations
alter table public.jobs
  add column if not exists contractor_confirmed_complete_at timestamptz,
  add column if not exists customer_confirmed_complete_at timestamptz;

-- 5. Payment / fund release
alter table public.jobs
  add column if not exists payment_captured_at timestamptz,
  add column if not exists funds_released_at timestamptz,
  add column if not exists stripe_payment_intent_id text;

-- 6. Add customer-facing price (with markup) to quote_responses
alter table public.quote_responses
  add column if not exists customer_price_pence int;

-- 7. New job statuses for the workflow
-- The existing job_status enum may not have all values we need.
-- Add missing values if they don't exist.
do $$
begin
  -- awaiting_quotes: admin has sent to contractors, waiting for responses
  if not exists (select 1 from pg_enum where enumlabel = 'awaiting_quotes' and enumtypid = 'job_status'::regtype) then
    alter type job_status add value 'awaiting_quotes' after 'pending';
  end if;
  -- quotes_received: contractor quotes are back, admin reviewing
  if not exists (select 1 from pg_enum where enumlabel = 'quotes_received' and enumtypid = 'job_status'::regtype) then
    alter type job_status add value 'quotes_received' after 'awaiting_quotes';
  end if;
  -- sent_to_customer: marked-up quotes sent to customer for selection
  if not exists (select 1 from pg_enum where enumlabel = 'sent_to_customer' and enumtypid = 'job_status'::regtype) then
    alter type job_status add value 'sent_to_customer' after 'quotes_received';
  end if;
  -- customer_accepted: customer picked a quote
  if not exists (select 1 from pg_enum where enumlabel = 'customer_accepted' and enumtypid = 'job_status'::regtype) then
    alter type job_status add value 'customer_accepted' after 'sent_to_customer';
  end if;
  -- awaiting_completion: contractor is doing the work
  if not exists (select 1 from pg_enum where enumlabel = 'awaiting_completion' and enumtypid = 'job_status'::regtype) then
    alter type job_status add value 'awaiting_completion' after 'customer_accepted';
  end if;
  -- pending_confirmation: one party confirmed completion, waiting for the other
  if not exists (select 1 from pg_enum where enumlabel = 'pending_confirmation' and enumtypid = 'job_status'::regtype) then
    alter type job_status add value 'pending_confirmation' after 'awaiting_completion';
  end if;
  -- funds_released: payment sent to contractor
  if not exists (select 1 from pg_enum where enumlabel = 'funds_released' and enumtypid = 'job_status'::regtype) then
    alter type job_status add value 'funds_released' after 'completed';
  end if;
end $$;
