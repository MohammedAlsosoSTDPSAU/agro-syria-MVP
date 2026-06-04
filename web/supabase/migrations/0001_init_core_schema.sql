-- ════════════════════════════════════════════════════════════════════════
-- Agro-Syria · Core production schema (P0)
-- Run order: this is migration 0001 — the foundational tables + RLS.
--
-- Apply via the Supabase SQL Editor, or the CLI:
--   supabase db push        (links to your project & runs pending migrations)
--
-- Design notes:
--  • `profiles.id` is a 1:1 FK to `auth.users.id` (Supabase Auth owns identity).
--  • Phone OTP is the primary login → `profiles.phone` mirrors auth.users.phone.
--  • Every row is owned by `user_id` and protected by Row-Level Security (RLS)
--    so a farmer can only ever read/write their own private field data.
-- ════════════════════════════════════════════════════════════════════════

-- Needed for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ── 1. profiles ─────────────────────────────────────────────────────────
-- One row per authenticated user. id == auth.users.id.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  phone       text unique,
  full_name   text,
  province    text,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own"   on public.profiles;
drop policy if exists "profiles: insert own" on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;

create policy "profiles: read own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: insert own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── 2. agro_fields ──────────────────────────────────────────────────────
-- A user's farm fields. Mirrors the front-end `Field` model (lib/fields.ts).
create table if not exists public.agro_fields (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  crop_type     text not null,
  province      text not null,
  area          numeric(10, 2) not null default 0,   -- hectares
  soil_type     text,
  planting_date date,
  latitude      double precision,                     -- precise GPS — never discarded
  longitude     double precision,                     -- precise GPS — never discarded
  created_at    timestamptz not null default now()
);

create index if not exists agro_fields_user_id_idx on public.agro_fields (user_id);

alter table public.agro_fields enable row level security;

drop policy if exists "fields: read own"   on public.agro_fields;
drop policy if exists "fields: insert own" on public.agro_fields;
drop policy if exists "fields: update own" on public.agro_fields;
drop policy if exists "fields: delete own" on public.agro_fields;

create policy "fields: read own"
  on public.agro_fields for select
  using (auth.uid() = user_id);

create policy "fields: insert own"
  on public.agro_fields for insert
  with check (auth.uid() = user_id);

create policy "fields: update own"
  on public.agro_fields for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "fields: delete own"
  on public.agro_fields for delete
  using (auth.uid() = user_id);

-- ── 3. community_posts ──────────────────────────────────────────────────
-- Public agricultural Q&A / field cases. Readable by everyone, writable by author.
create table if not exists public.community_posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  content     text not null,
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists community_posts_created_at_idx on public.community_posts (created_at desc);

alter table public.community_posts enable row level security;

drop policy if exists "posts: read all"    on public.community_posts;
drop policy if exists "posts: insert own"  on public.community_posts;
drop policy if exists "posts: update own"  on public.community_posts;
drop policy if exists "posts: delete own"  on public.community_posts;

-- Community is a shared knowledge base → any authenticated user can read.
create policy "posts: read all"
  on public.community_posts for select
  using (auth.role() = 'authenticated');

create policy "posts: insert own"
  on public.community_posts for insert
  with check (auth.uid() = user_id);

create policy "posts: update own"
  on public.community_posts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "posts: delete own"
  on public.community_posts for delete
  using (auth.uid() = user_id);

-- ── 4. auto-provision a profile row on signup ───────────────────────────
-- Keeps public.profiles in sync with auth.users without a client round-trip.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, phone, full_name, province)
  values (
    new.id,
    new.phone,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'province', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
