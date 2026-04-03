-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)

create table if not exists public.practice_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row-level security: users can only read/write their own row
alter table public.practice_data enable row level security;

create policy "Users can read own data"
  on public.practice_data for select
  using (auth.uid() = user_id);

create policy "Users can upsert own data"
  on public.practice_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update own data"
  on public.practice_data for update
  using (auth.uid() = user_id);
