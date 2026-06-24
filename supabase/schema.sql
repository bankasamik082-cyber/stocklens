-- =====================================================================
-- StockLens — Supabase schema
-- Run this in the Supabase dashboard: SQL Editor -> New query -> Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. users  (profile row mirroring auth.users)
-- Supabase already manages credentials in the auth.users table.
-- This public.users table stores app-level profile data and is the
-- table the rest of the app reads from.
-- ---------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. analyses  (one generated report per row)
-- ---------------------------------------------------------------------
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ticker text not null,
  selected_sections jsonb not null default '[]'::jsonb,
  generated_report jsonb not null default '{}'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analyses_user_id_idx on public.analyses (user_id);
create index if not exists analyses_created_at_idx on public.analyses (created_at desc);

-- ---------------------------------------------------------------------
-- 3. saved_stocks  (a user's watchlist)
-- ---------------------------------------------------------------------
create table if not exists public.saved_stocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ticker text not null,
  created_at timestamptz not null default now(),
  unique (user_id, ticker)
);

create index if not exists saved_stocks_user_id_idx on public.saved_stocks (user_id);

-- =====================================================================
-- Row Level Security — every user can only touch their own rows.
-- =====================================================================
alter table public.users enable row level security;
alter table public.analyses enable row level security;
alter table public.saved_stocks enable row level security;

-- users
create policy "users can read own profile"
  on public.users for select using (auth.uid() = id);
create policy "users can insert own profile"
  on public.users for insert with check (auth.uid() = id);
create policy "users can update own profile"
  on public.users for update using (auth.uid() = id);

-- analyses
create policy "owner can read analyses"
  on public.analyses for select using (auth.uid() = user_id);
create policy "owner can insert analyses"
  on public.analyses for insert with check (auth.uid() = user_id);
create policy "owner can delete analyses"
  on public.analyses for delete using (auth.uid() = user_id);

-- saved_stocks
create policy "owner can read saved_stocks"
  on public.saved_stocks for select using (auth.uid() = user_id);
create policy "owner can insert saved_stocks"
  on public.saved_stocks for insert with check (auth.uid() = user_id);
create policy "owner can delete saved_stocks"
  on public.saved_stocks for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 4. alert_subscriptions  (users who want politician trade emails)
-- ---------------------------------------------------------------------
create table if not exists public.alert_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.alert_subscriptions enable row level security;

create policy "owner can read own subscription"
  on public.alert_subscriptions for select using (auth.uid() = user_id);
create policy "owner can insert own subscription"
  on public.alert_subscriptions for insert with check (auth.uid() = user_id);
create policy "owner can delete own subscription"
  on public.alert_subscriptions for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 5. seen_trades  (dedup log so cron never re-alerts on the same trade)
-- No user-level RLS policies — only the service-role cron can read/write.
-- ---------------------------------------------------------------------
create table if not exists public.seen_trades (
  id uuid primary key default gen_random_uuid(),
  trade_key text not null unique,
  created_at timestamptz not null default now()
);

alter table public.seen_trades enable row level security;

-- =====================================================================
-- Auto-create a public.users profile row whenever someone signs up.
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
