-- ============================================================================
-- KLEEN — Migration 031: Pre-payment contract preview + full contract email tracking
-- - contract_content_preview: optional safe text for customers before payment
--   (if null, kleen-app auto-redacts contact info from contract_content for display)
-- - full_contract_emailed_at: set when full agreement is emailed after escrow
-- ============================================================================

alter table public.operative_services
  add column if not exists contract_content_preview text;

alter table public.jobs
  add column if not exists full_contract_emailed_at timestamptz;

comment on column public.operative_services.contract_content_preview is
  'Optional text shown to customers before payment. Full contract_content is emailed after funds are held in escrow.';

comment on column public.jobs.full_contract_emailed_at is
  'When the full service agreement was emailed to the customer (after payment authorised).';
