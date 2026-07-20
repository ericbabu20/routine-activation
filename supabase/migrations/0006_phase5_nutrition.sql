-- ============================================================================
-- Phase 5: Meal & calorie support (PRD §7, approved MVP scope). A member sets a
-- nutrition goal + dietary preference, gets calorie/macro targets, sees a daily
-- suggested plan from a meal catalogue, logs meals, and tracks totals over time.
--
-- This is general fitness guidance, NOT medical or clinical advice. RLS keeps
-- every member's profile and logged meals private to them; the meal catalogue
-- is read-only reference data.
-- ============================================================================

-- ---- Nutrition profile (1:1 with member) -----------------------------------
create table if not exists nutrition_profiles (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  goal               text not null default 'general',        -- lose_weight | maintain | gain_muscle | general
  dietary_preference text not null default 'no_preference',  -- no_preference | vegetarian | vegan | eggetarian | non_veg
  allergies          text[] not null default '{}',
  calorie_target     integer not null default 2000 check (calorie_target between 800 and 6000),
  protein_target_g   integer not null default 150,
  carbs_target_g     integer not null default 200,
  fat_target_g       integer not null default 67,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger trg_nutrition_profiles_updated before update on nutrition_profiles
  for each row execute function set_updated_at();

-- ---- Meal catalogue (reference data for the daily plan + swaps) -------------
create table if not exists meals (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  meal_type    text not null,                                -- breakfast | lunch | dinner | snack
  diet         text not null default 'vegetarian',            -- vegan | vegetarian | non_veg
  calories     integer not null default 0,
  protein_g    integer not null default 0,
  carbs_g      integer not null default 0,
  fat_g        integer not null default 0,
  high_protein boolean not null default false,                -- surfaced as post-workout suggestions
  created_at   timestamptz not null default now()
);
create index if not exists idx_meals_type on meals (meal_type);
create index if not exists idx_meals_diet on meals (diet);

-- ---- Logged meals (a member's actual intake) -------------------------------
create table if not exists meal_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  entry_date  date not null default current_date,
  meal_type   text not null,
  meal_id     uuid references meals(id) on delete set null,
  name        text not null,
  calories    integer not null default 0,
  protein_g   integer not null default 0,
  carbs_g     integer not null default 0,
  fat_g       integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_meal_entries_user_date on meal_entries (user_id, entry_date);

-- ============================================================================
-- RLS
-- ============================================================================
alter table nutrition_profiles enable row level security;
alter table meals              enable row level security;
alter table meal_entries       enable row level security;

create policy "own nutrition profile" on nutrition_profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "read meals"            on meals            for select using (auth.role() = 'authenticated');
create policy "own meal entries"      on meal_entries     for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
