-- Run this in Supabase → SQL Editor

create table if not exists practice_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  data jsonb not null default '{}',
  updated_at timestamptz default now()
);

-- Only the owner can read/write their row
alter table practice_data enable row level security;

create policy "owner select" on practice_data for select using (auth.uid() = user_id);
create policy "owner insert" on practice_data for insert with check (auth.uid() = user_id);
create policy "owner update" on practice_data for update using (auth.uid() = user_id);
