-- ============================================================================
-- Phase 2 (part): payment records / invoices.
-- We NEVER store raw card data — only a provider reference + masked summary,
-- suitable for a payment provider's test mode (PRD §11).
-- ============================================================================
do $$ begin
  create type payment_status as enum ('paid', 'pending', 'failed', 'refunded');
exception when duplicate_object then null; end $$;

create table if not exists payment_records (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  membership_id uuid references memberships(id) on delete set null,
  amount_pence  integer not null default 0,
  currency      text not null default 'INR',
  status        payment_status not null default 'paid',
  description   text,
  provider      text,               -- e.g. 'test'
  provider_ref  text,               -- opaque provider id, NOT card data
  card_brand    text,               -- e.g. 'visa' (display only)
  card_last4    text,               -- last 4 only (display only)
  created_at    timestamptz not null default now()
);
create index if not exists idx_payments_user on payment_records (user_id);
create index if not exists idx_payments_created on payment_records (created_at);

alter table payment_records enable row level security;
create policy "own payments read" on payment_records
  for select using (auth.uid() = user_id);
