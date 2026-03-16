-- ============================================================================
-- KLEEN — Migration 026: Per-quote "sent to customer" tracking
-- When admin sends a quote (or send all) to the customer, we set sent_to_customer_at.
-- "Send to customer" / "Send all" are hidden until the quote is edited again,
-- at which point we clear sent_to_customer_at so they can re-send.
-- ============================================================================

alter table public.quote_responses
  add column if not exists sent_to_customer_at timestamptz;

comment on column public.quote_responses.sent_to_customer_at is 'When this quote was last sent to the customer. Null = not sent, or edited after send (can send again).';
