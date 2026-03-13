-- ============================================================================
-- KLEEN — Migration 021: Job cancellation audit (cancelled_at, cancelled_by)
-- Customers can cancel until job has commenced; 48h from payment = full refund.
-- This migration ONLY adds columns; it does NOT delete or modify existing data.
-- Safe to re-run (idempotent).
-- ============================================================================

-- Add columns one at a time for compatibility
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_cancelled_at
  ON public.jobs (cancelled_at) WHERE cancelled_at IS NOT NULL;

COMMENT ON COLUMN public.jobs.cancelled_at IS 'When the job was cancelled (set when status → cancelled).';
COMMENT ON COLUMN public.jobs.cancelled_by IS 'User (customer or admin) who cancelled the job.';
