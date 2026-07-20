-- ============================================================================
-- Phase 6: Trusted buddy (PRD §6.8). One optional, privacy-first accountability
-- partner — another Routine member connected by email with explicit consent.
--
-- Strict sharing matrix (enforced in the API, defended here with RLS):
--   A buddy MAY see:   the owner's proposed next workout, a support request,
--                      and the confirmation status.
--   A buddy MUST NOT see: attendance/miss history, health info, body
--                      measurements, private notes, nutrition, or visits.
-- The owner can mute prompts, adjust sharing, and disconnect / revoke at any time.
-- ============================================================================

do $$ begin create type buddy_status as enum ('pending','active','declined','revoked'); exception when duplicate_object then null; end $$;
do $$ begin create type buddy_request_status as enum ('sent','confirmed'); exception when duplicate_object then null; end $$;

-- ---- Buddy connection (owner receives support; buddy gives it) --------------
create table if not exists buddy_connections (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid not null references auth.users(id) on delete cascade,
  buddy_id               uuid references auth.users(id) on delete cascade,   -- set when matched to a member
  buddy_email            text not null,
  relationship           text,
  status                 buddy_status not null default 'pending',
  muted                  boolean not null default false,
  -- Sharing controls (privacy matrix). These are the ONLY things ever exposed.
  share_next_workout     boolean not null default true,
  share_support_requests boolean not null default true,
  share_confirmation     boolean not null default true,
  created_at             timestamptz not null default now(),
  responded_at           timestamptz,
  updated_at             timestamptz not null default now()
);
create index if not exists idx_buddy_owner on buddy_connections (owner_id);
create index if not exists idx_buddy_buddy on buddy_connections (buddy_id);
-- A member may have at most one non-terminal (pending/active) buddy at a time.
create unique index if not exists uq_owner_active_buddy
  on buddy_connections (owner_id) where (status in ('pending','active'));
create trigger trg_buddy_conn_updated before update on buddy_connections
  for each row execute function set_updated_at();

-- ---- Support requests (owner asks the buddy to cheer on a session) ---------
create table if not exists buddy_support_requests (
  id            uuid primary key default gen_random_uuid(),
  connection_id uuid not null references buddy_connections(id) on delete cascade,
  owner_id      uuid not null references auth.users(id) on delete cascade,
  buddy_id      uuid references auth.users(id) on delete set null,
  workout_title text,                       -- snapshot only; never full history
  workout_date  date,
  message       text,
  status        buddy_request_status not null default 'sent',
  created_at    timestamptz not null default now(),
  confirmed_at  timestamptz
);
create index if not exists idx_bsr_owner on buddy_support_requests (owner_id, created_at);
create index if not exists idx_bsr_buddy on buddy_support_requests (buddy_id, created_at);

-- ============================================================================
-- RLS (defence-in-depth; the server resolves identity and enforces the matrix)
-- ============================================================================
alter table buddy_connections     enable row level security;
alter table buddy_support_requests enable row level security;

-- Either party to a connection may read it; either party may act on it.
create policy "party can read connection" on buddy_connections for select
  using (auth.uid() = owner_id or auth.uid() = buddy_id);
create policy "party can write connection" on buddy_connections for all
  using (auth.uid() = owner_id or auth.uid() = buddy_id)
  with check (auth.uid() = owner_id or auth.uid() = buddy_id);

create policy "party can read support" on buddy_support_requests for select
  using (auth.uid() = owner_id or auth.uid() = buddy_id);
create policy "party can write support" on buddy_support_requests for all
  using (auth.uid() = owner_id or auth.uid() = buddy_id)
  with check (auth.uid() = owner_id or auth.uid() = buddy_id);
