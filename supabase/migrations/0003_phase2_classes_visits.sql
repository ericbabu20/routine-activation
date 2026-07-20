-- ============================================================================
-- Phase 2 (part): classes & sessions, bookings, waitlists, visits, QR access
-- tokens, and access events. Booking + waitlist promotion use row-locking
-- functions so capacity can never be exceeded (PRD §10, §12, §13).
-- ============================================================================

do $$ begin create type class_intensity as enum ('low','moderate','high'); exception when duplicate_object then null; end $$;
do $$ begin create type booking_status as enum ('booked','cancelled','completed','missed'); exception when duplicate_object then null; end $$;
do $$ begin create type visit_status as enum ('active','completed'); exception when duplicate_object then null; end $$;
do $$ begin create type access_event_type as enum ('entry','exit'); exception when duplicate_object then null; end $$;
do $$ begin create type access_result as enum ('granted','denied'); exception when duplicate_object then null; end $$;

-- ---- Classes (offering templates) -----------------------------------------
create table if not exists classes (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  format       text not null,
  intensity    class_intensity not null default 'moderate',
  duration_min integer not null default 45,
  trainer      text,
  created_at   timestamptz not null default now()
);

-- ---- Class sessions (scheduled instances at a centre) ----------------------
create table if not exists class_sessions (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references classes(id) on delete cascade,
  gym_id     uuid not null references gyms(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  capacity   integer not null default 20 check (capacity > 0),
  status     text not null default 'scheduled', -- scheduled | cancelled | completed
  created_at timestamptz not null default now()
);
create index if not exists idx_sessions_gym_start on class_sessions (gym_id, starts_at);
create index if not exists idx_sessions_start on class_sessions (starts_at);

-- ---- Bookings --------------------------------------------------------------
create table if not exists bookings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  class_session_id uuid not null references class_sessions(id) on delete cascade,
  status           booking_status not null default 'booked',
  created_at       timestamptz not null default now(),
  cancelled_at     timestamptz,
  updated_at       timestamptz not null default now()
);
create index if not exists idx_bookings_user on bookings (user_id);
create index if not exists idx_bookings_session on bookings (class_session_id);
-- At most one active booking per member per session.
create unique index if not exists uq_active_booking
  on bookings (user_id, class_session_id) where (status = 'booked');
create trigger trg_bookings_updated before update on bookings
  for each row execute function set_updated_at();

-- ---- Waitlist --------------------------------------------------------------
create table if not exists waitlist_entries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  class_session_id uuid not null references class_sessions(id) on delete cascade,
  position         integer not null,
  created_at       timestamptz not null default now(),
  unique (user_id, class_session_id)
);
create index if not exists idx_waitlist_session on waitlist_entries (class_session_id, position);

-- ---- Visits ----------------------------------------------------------------
create table if not exists visits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  gym_id       uuid not null references gyms(id) on delete set null,
  check_in_at  timestamptz not null default now(),
  check_out_at timestamptz,
  duration_min integer,
  status       visit_status not null default 'active',
  booking_id   uuid references bookings(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_visits_user on visits (user_id, check_in_at);
-- One active (open) visit per member.
create unique index if not exists uq_active_visit
  on visits (user_id) where (status = 'active');

-- ---- QR access tokens (server-generated, short-lived, single-use) ----------
create table if not exists qr_access_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  token      text not null unique,          -- opaque random; contains no PII
  issued_at  timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_qr_token on qr_access_tokens (token);
create index if not exists idx_qr_user on qr_access_tokens (user_id, issued_at);

-- ---- Access events (from authorised access providers) ----------------------
create table if not exists access_events (
  id              uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,      -- replay / dedupe protection
  user_id         uuid references auth.users(id) on delete set null,
  gym_id          uuid references gyms(id) on delete set null,
  token_id        uuid references qr_access_tokens(id) on delete set null,
  type            access_event_type not null,
  result          access_result not null,
  device_id       text,                       -- anonymous device identifier
  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index if not exists idx_access_user on access_events (user_id, occurred_at);

-- ============================================================================
-- RLS
-- ============================================================================
alter table classes          enable row level security;
alter table class_sessions   enable row level security;
alter table bookings         enable row level security;
alter table waitlist_entries enable row level security;
alter table visits           enable row level security;
alter table qr_access_tokens enable row level security;
alter table access_events    enable row level security;

create policy "read classes"  on classes        for select using (auth.role() = 'authenticated');
create policy "read sessions" on class_sessions  for select using (auth.role() = 'authenticated');
create policy "own bookings"  on bookings        for select using (auth.uid() = user_id);
create policy "own waitlist"  on waitlist_entries for select using (auth.uid() = user_id);
create policy "own visits"    on visits          for select using (auth.uid() = user_id);
create policy "own qr"        on qr_access_tokens for select using (auth.uid() = user_id);
-- access_events: no client access; server (service role) only.

-- ============================================================================
-- Transactional booking functions (SECURITY DEFINER). The server passes the
-- verified member id (p_user) resolved from the session — never client input.
-- All return jsonb: { ok: bool, reason?: text, ... }.
-- ============================================================================

-- Eligibility helper: does the member's active membership cover this centre's classes?
create or replace function member_can_book(p_user uuid, p_gym uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare cls boolean; allc boolean; home uuid;
begin
  select pl.includes_classes, pl.includes_all_centres, m.home_gym_id
    into cls, allc, home
  from memberships m join membership_plans pl on pl.id = m.plan_id
  where m.user_id = p_user and m.status = 'active'
  limit 1;
  if cls is null then return false; end if;               -- no active membership
  if not cls then return false; end if;                   -- plan excludes classes
  if allc then return true; end if;
  return home is not distinct from p_gym;                 -- home-centre only plan
end $$;

create or replace function book_class_session(p_user uuid, p_session uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s class_sessions; booked int;
begin
  select * into s from class_sessions where id = p_session for update;
  if not found or s.status <> 'scheduled' then return jsonb_build_object('ok', false, 'reason', 'unavailable'); end if;
  if s.starts_at <= now() then return jsonb_build_object('ok', false, 'reason', 'past'); end if;
  if not member_can_book(p_user, s.gym_id) then return jsonb_build_object('ok', false, 'reason', 'ineligible'); end if;
  if exists (select 1 from bookings where user_id = p_user and class_session_id = p_session and status = 'booked') then
    return jsonb_build_object('ok', false, 'reason', 'duplicate');
  end if;
  if exists (
    select 1 from bookings b join class_sessions cs on cs.id = b.class_session_id
    where b.user_id = p_user and b.status = 'booked'
      and cs.starts_at < s.ends_at and cs.ends_at > s.starts_at
  ) then
    return jsonb_build_object('ok', false, 'reason', 'overlap');
  end if;
  select count(*) into booked from bookings where class_session_id = p_session and status = 'booked';
  if booked >= s.capacity then return jsonb_build_object('ok', false, 'reason', 'full'); end if;

  insert into bookings (user_id, class_session_id, status) values (p_user, p_session, 'booked');
  return jsonb_build_object('ok', true);
end $$;

create or replace function join_waitlist(p_user uuid, p_session uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s class_sessions; booked int; pos int;
begin
  select * into s from class_sessions where id = p_session for update;
  if not found or s.status <> 'scheduled' then return jsonb_build_object('ok', false, 'reason', 'unavailable'); end if;
  if not member_can_book(p_user, s.gym_id) then return jsonb_build_object('ok', false, 'reason', 'ineligible'); end if;
  if exists (select 1 from bookings where user_id = p_user and class_session_id = p_session and status = 'booked') then
    return jsonb_build_object('ok', false, 'reason', 'already_booked');
  end if;
  if exists (select 1 from waitlist_entries where user_id = p_user and class_session_id = p_session) then
    return jsonb_build_object('ok', false, 'reason', 'already_waitlisted');
  end if;
  select count(*) into booked from bookings where class_session_id = p_session and status = 'booked';
  if booked < s.capacity then return jsonb_build_object('ok', false, 'reason', 'not_full'); end if;

  select coalesce(max(position), 0) + 1 into pos from waitlist_entries where class_session_id = p_session;
  insert into waitlist_entries (user_id, class_session_id, position) values (p_user, p_session, pos);
  return jsonb_build_object('ok', true, 'position', pos);
end $$;

create or replace function leave_waitlist(p_user uuid, p_session uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  delete from waitlist_entries where user_id = p_user and class_session_id = p_session;
  return jsonb_build_object('ok', true);
end $$;

-- Cancel a booking and promote the first waitlisted member (transactional).
create or replace function cancel_booking(p_user uuid, p_booking uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b bookings; w waitlist_entries; promoted boolean := false;
begin
  select * into b from bookings where id = p_booking and user_id = p_user for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if b.status <> 'booked' then return jsonb_build_object('ok', false, 'reason', 'not_booked'); end if;

  update bookings set status = 'cancelled', cancelled_at = now() where id = p_booking;

  select * into w from waitlist_entries
    where class_session_id = b.class_session_id
    order by position asc limit 1 for update skip locked;
  if found then
    insert into bookings (user_id, class_session_id, status) values (w.user_id, b.class_session_id, 'booked')
      on conflict do nothing;
    delete from waitlist_entries where id = w.id;
    promoted := true;
  end if;

  return jsonb_build_object('ok', true, 'promoted', promoted);
end $$;
