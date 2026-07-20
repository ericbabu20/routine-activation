-- ============================================================================
-- Phase 4: Workouts library + sessions, and the 45-Day Routine activation
-- system (PRD §5, §6). Members can discover workouts, run a guided session
-- (recoverable after refresh), and follow a flexible 45-day plan that tracks
-- planned / completed / skipped / rescheduled sessions without punishing misses.
--
-- Member identity is always resolved server-side; the service role performs
-- ownership-checked writes. RLS below is defence-in-depth so a member can only
-- ever read their OWN sessions, routine and scheduled workouts.
-- ============================================================================

do $$ begin create type workout_difficulty     as enum ('beginner','intermediate','advanced'); exception when duplicate_object then null; end $$;
do $$ begin create type workout_session_status as enum ('in_progress','completed','abandoned'); exception when duplicate_object then null; end $$;
do $$ begin create type scheduled_status       as enum ('planned','completed','skipped','rescheduled'); exception when duplicate_object then null; end $$;
do $$ begin create type routine_status         as enum ('active','completed','abandoned'); exception when duplicate_object then null; end $$;

-- ---- Workout library (reference / catalogue) -------------------------------
create table if not exists workouts (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  goal         text,                                  -- e.g. build_strength, lose_weight, mobility
  workout_type text not null,                          -- strength | cardio | hiit | mobility | yoga | recovery
  difficulty   workout_difficulty not null default 'beginner',
  duration_min integer not null default 30 check (duration_min > 0),
  equipment    text[] not null default '{}',
  is_short     boolean not null default false,         -- eligible as a Tired-Day short option
  created_at   timestamptz not null default now()
);
create index if not exists idx_workouts_type on workouts (workout_type);
create index if not exists idx_workouts_difficulty on workouts (difficulty);

-- ---- Exercises within a workout template (ordered) -------------------------
create table if not exists workout_exercises (
  id           uuid primary key default gen_random_uuid(),
  workout_id   uuid not null references workouts(id) on delete cascade,
  position     integer not null,
  name         text not null,
  instructions text,
  sets         integer,
  reps         integer,
  duration_sec integer,                                -- for time-based moves
  rest_sec     integer not null default 30,
  created_at   timestamptz not null default now(),
  unique (workout_id, position)
);
create index if not exists idx_wex_workout on workout_exercises (workout_id, position);

-- ---- A member performing a workout (guided session) ------------------------
create table if not exists workout_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  workout_id        uuid references workouts(id) on delete set null,
  title             text not null,
  status            workout_session_status not null default 'in_progress',
  started_at        timestamptz not null default now(),
  completed_at      timestamptz,
  total_duration_sec integer,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_sessions_user on workout_sessions (user_id, started_at desc);
-- At most one in-progress session per member (so it can be resumed).
create unique index if not exists uq_active_session
  on workout_sessions (user_id) where (status = 'in_progress');
create trigger trg_wsessions_updated before update on workout_sessions
  for each row execute function set_updated_at();

-- ---- Per-exercise progress within a session (persisted for resume) ---------
create table if not exists workout_session_exercises (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null references workout_sessions(id) on delete cascade,
  position           integer not null,
  name               text not null,
  instructions       text,
  target_sets        integer,
  target_reps        integer,
  target_duration_sec integer,
  rest_sec           integer not null default 30,
  completed          boolean not null default false,
  completed_at       timestamptz,
  unique (session_id, position)
);
create index if not exists idx_wsex_session on workout_session_exercises (session_id, position);

-- ---- 45-Day routine activation ---------------------------------------------
create table if not exists routines (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  title           text not null default '45-Day Activation',
  status          routine_status not null default 'active',
  target_workouts integer not null default 8,          -- success objective in first 4 weeks
  window_days     integer not null default 45,
  days_per_week   integer not null default 3,
  started_at      timestamptz not null default now(),
  ends_at         timestamptz not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_routines_user on routines (user_id);
-- One active routine per member.
create unique index if not exists uq_active_routine
  on routines (user_id) where (status = 'active');
create trigger trg_routines_updated before update on routines
  for each row execute function set_updated_at();

-- ---- Weekly targets for a routine (derived at creation) --------------------
create table if not exists routine_weeks (
  id            uuid primary key default gen_random_uuid(),
  routine_id    uuid not null references routines(id) on delete cascade,
  week_number   integer not null,                      -- 1-based
  starts_on     date not null,
  planned_count integer not null default 0,
  unique (routine_id, week_number)
);

-- ---- Planned / completed / skipped / rescheduled sessions ------------------
create table if not exists scheduled_workouts (
  id             uuid primary key default gen_random_uuid(),
  routine_id     uuid not null references routines(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  workout_id     uuid references workouts(id) on delete set null,
  scheduled_date date not null,
  status         scheduled_status not null default 'planned',
  session_id     uuid references workout_sessions(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_sched_user_date on scheduled_workouts (user_id, scheduled_date);
create index if not exists idx_sched_routine on scheduled_workouts (routine_id);
create trigger trg_sched_updated before update on scheduled_workouts
  for each row execute function set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
alter table workouts                  enable row level security;
alter table workout_exercises         enable row level security;
alter table workout_sessions          enable row level security;
alter table workout_session_exercises enable row level security;
alter table routines                  enable row level security;
alter table routine_weeks             enable row level security;
alter table scheduled_workouts        enable row level security;

-- Catalogue: any authenticated user may read.
create policy "read workouts"   on workouts          for select using (auth.role() = 'authenticated');
create policy "read wex"        on workout_exercises for select using (auth.role() = 'authenticated');

-- Owner-only: sessions, routine, schedule.
create policy "own sessions"    on workout_sessions  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own sched"       on scheduled_workouts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own routines"    on routines          for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Session exercises: owned through the parent session.
create policy "own session exercises" on workout_session_exercises for all
  using (exists (select 1 from workout_sessions ws where ws.id = session_id and ws.user_id = auth.uid()))
  with check (exists (select 1 from workout_sessions ws where ws.id = session_id and ws.user_id = auth.uid()));

-- Routine weeks: owned through the parent routine.
create policy "own routine weeks" on routine_weeks for all
  using (exists (select 1 from routines r where r.id = routine_id and r.user_id = auth.uid()))
  with check (exists (select 1 from routines r where r.id = routine_id and r.user_id = auth.uid()));
