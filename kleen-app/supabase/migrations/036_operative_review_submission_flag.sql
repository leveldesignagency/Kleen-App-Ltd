-- Contractor review queue: only show operatives who explicitly submit.
alter table public.operatives
  add column if not exists submitted_for_review_at timestamptz;

create index if not exists idx_operatives_submitted_for_review_at
  on public.operatives (submitted_for_review_at);
