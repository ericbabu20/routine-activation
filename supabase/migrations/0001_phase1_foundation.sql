-- ============================================================================
-- cult.fit-inspired Routine Activation App — Phase 1: Audit & Foundation
-- ----------------------------------------------------------------------------
-- Identity, gyms/centres, membership plans & memberships, member preferences,
-- analytics events, and an audit log. Row-Level Security (RLS) is enabled so a
-- member can only ever read/write their OWN data. Reference data (gyms, plans)
-- is readable by any authenticated user.
--
-- This is an independent cult.fit-INSPIRED product management case study.
-- It is NOT an official cult.fit product.
-- ============================================================================

-- ---- Extensions -----------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "vector";      -- pgvector, used later for RAG

-- ---- Enumerated types -----------------------------------------------------
do $$ begin
  create type fitness_experience as enum ('beginner', 'returning', 'intermediate', 'advanced');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fitness_goal as enum (
    'build_strength', 'improve_health', 'lose_weight',
    'reduce_stress', 'build_consistency', 'improve_general_fitness'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type membership_status as enum ('active', 'frozen', 'cancelled', 'pending');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ai_mode as enum ('personalised', 'faq_only', 'disabled');
exception when duplicate_object then null; end $$;

-- ---- Reusable updated_at trigger -----------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ============================================================================
-- profiles  (1:1 with auth.users — the member identity we resolve server-side)
-- ============================================================================
create table if not exists profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  name                text,
  date_of_birth       date,
  email               text,
  phone               text,
  fitness_experience  fitness_experience,
  primary_goal        fitness_goal,
  home_gym_id         uuid,                       -- FK added after gyms table
  onboarding_completed boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();

-- ============================================================================
-- gyms / centres (reference data)
-- ============================================================================
create table if not exists gyms (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  city          text not null,
  postcode      text,
  address       text,
  latitude      double precision,
  longitude     double precision,
  accessibility text,                              -- accessibility information
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_gyms_city on gyms (city);
create index if not exists idx_gyms_postcode on gyms (postcode);
create trigger trg_gyms_updated before update on gyms
  for each row execute function set_updated_at();

create table if not exists gym_hours (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid not null references gyms(id) on delete cascade,
  day_of_week  smallint not null check (day_of_week between 0 and 6), -- 0=Sunday
  open_time    time,
  close_time   time,
  is_closed    boolean not null default false,
  unique (gym_id, day_of_week)
);
create index if not exists idx_gym_hours_gym on gym_hours (gym_id);

create table if not exists gym_amenities (
  id       uuid primary key default gen_random_uuid(),
  gym_id   uuid not null references gyms(id) on delete cascade,
  amenity  text not null,
  unique (gym_id, amenity)
);
create index if not exists idx_gym_amenities_gym on gym_amenities (gym_id);

-- Now that gyms exists, wire up the home-centre FK on profiles.
alter table profiles
  drop constraint if exists profiles_home_gym_fk,
  add  constraint profiles_home_gym_fk
       foreign key (home_gym_id) references gyms(id) on delete set null;

-- ============================================================================
-- membership plans (reference data) & memberships (per member)
-- ============================================================================
create table if not exists membership_plans (
  id                  uuid primary key default gen_random_uuid(),
  code                text unique not null,        -- e.g. 'elite', 'pro', 'home'
  name                text not null,
  description         text,
  price_pence         integer not null default 0,  -- store minor units, no card data
  billing_period      text not null default 'monthly',
  includes_all_centres boolean not null default false,
  includes_classes    boolean not null default true,
  sort_order          integer not null default 0,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger trg_plans_updated before update on membership_plans
  for each row execute function set_updated_at();

-- Which centres a plan includes (empty + includes_all_centres=true means all).
create table if not exists membership_plan_gyms (
  plan_id uuid not null references membership_plans(id) on delete cascade,
  gym_id  uuid not null references gyms(id) on delete cascade,
  primary key (plan_id, gym_id)
);

create table if not exists memberships (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  plan_id        uuid not null references membership_plans(id),
  home_gym_id    uuid references gyms(id) on delete set null,
  status         membership_status not null default 'active',
  started_at     timestamptz not null default now(),
  next_billing_at timestamptz,
  frozen_until   timestamptz,
  cancelled_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_memberships_user on memberships (user_id);
-- A member has at most one non-cancelled membership at a time.
create unique index if not exists uq_membership_active_per_user
  on memberships (user_id) where (status <> 'cancelled');
create trigger trg_memberships_updated before update on memberships
  for each row execute function set_updated_at();

-- ============================================================================
-- member preferences: routine, notifications, and AI consent
-- ============================================================================
create table if not exists routine_preferences (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  preferred_formats  text[] not null default '{}',
  available_days     text[] not null default '{}',     -- e.g. {'Tuesday','Thursday'}
  preferred_time     text,                              -- e.g. '7:00 PM'
  workout_duration   integer,                           -- minutes
  low_energy_periods text,                              -- e.g. 'Weekday evenings'
  backup_plan_enabled boolean not null default true,
  updated_at         timestamptz not null default now()
);
create trigger trg_routine_prefs_updated before update on routine_preferences
  for each row execute function set_updated_at();

create table if not exists notification_preferences (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  workout_reminder    boolean not null default true,
  rebooking_confirmed boolean not null default true,
  recovery_reminder   boolean not null default true,
  buddy_confirmation  boolean not null default true,
  updated_at          timestamptz not null default now()
);
create trigger trg_notif_prefs_updated before update on notification_preferences
  for each row execute function set_updated_at();

create table if not exists ai_consent (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  mode              ai_mode not null default 'disabled',
  retain_history    boolean not null default false,
  consented_at      timestamptz,
  revoked_at        timestamptz,
  updated_at        timestamptz not null default now()
);
create trigger trg_ai_consent_updated before update on ai_consent
  for each row execute function set_updated_at();

-- ============================================================================
-- analytics events & audit log
-- ============================================================================
create table if not exists analytics_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  name       text not null,          -- e.g. 'account_created', 'membership_selected'
  detail     jsonb,                  -- NEVER stores sensitive free-text chat content
  created_at timestamptz not null default now()
);
create index if not exists idx_events_user on analytics_events (user_id);
create index if not exists idx_events_name on analytics_events (name);
create index if not exists idx_events_created on analytics_events (created_at);

create table if not exists audit_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  action     text not null,
  entity     text,
  entity_id  text,
  metadata   jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_user on audit_log (user_id);
create index if not exists idx_audit_created on audit_log (created_at);

-- ============================================================================
-- Row-Level Security (RLS)
-- Members can only touch their OWN rows. Reference data is read-only to users.
-- The server's service_role key bypasses RLS for privileged, ownership-checked
-- operations and for webhooks/analytics.
-- ============================================================================
alter table profiles                 enable row level security;
alter table memberships               enable row level security;
alter table routine_preferences       enable row level security;
alter table notification_preferences  enable row level security;
alter table ai_consent                enable row level security;
alter table analytics_events          enable row level security;
alter table gyms                      enable row level security;
alter table gym_hours                 enable row level security;
alter table gym_amenities             enable row level security;
alter table membership_plans          enable row level security;
alter table membership_plan_gyms      enable row level security;

-- Owner-only policies (self-service tables)
create policy "own profile"        on profiles                for all using (auth.uid() = id)      with check (auth.uid() = id);
create policy "own memberships"    on memberships             for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own routine prefs"  on routine_preferences     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own notif prefs"    on notification_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own ai consent"     on ai_consent              for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own events insert"  on analytics_events        for insert with check (auth.uid() = user_id);
create policy "own events read"    on analytics_events        for select using (auth.uid() = user_id);

-- Reference data: any authenticated user may read.
create policy "read gyms"          on gyms                for select using (auth.role() = 'authenticated');
create policy "read gym hours"     on gym_hours           for select using (auth.role() = 'authenticated');
create policy "read gym amenities" on gym_amenities       for select using (auth.role() = 'authenticated');
create policy "read plans"         on membership_plans    for select using (auth.role() = 'authenticated');
create policy "read plan gyms"     on membership_plan_gyms for select using (auth.role() = 'authenticated');

-- ============================================================================
-- Auto-provision member records on sign-up.
-- When Supabase Auth inserts a new user, create their profile + default
-- preference rows so the app always has something to read.
-- ============================================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', null))
    on conflict (id) do nothing;
  insert into public.notification_preferences (user_id) values (new.id)
    on conflict (user_id) do nothing;
  insert into public.ai_consent (user_id) values (new.id)
    on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
