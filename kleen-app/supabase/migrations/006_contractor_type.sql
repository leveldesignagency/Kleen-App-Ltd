-- ============================================================================
-- KLEEN — Migration 006: Contractor Type (Sole Trader / Business)
-- Run on top of 001 + 002 + 003
-- Adds contractor_type enum and column to operatives
-- ============================================================================

create type contractor_type as enum ('sole_trader', 'business');

alter table public.operatives
  add column if not exists contractor_type contractor_type not null default 'sole_trader';
