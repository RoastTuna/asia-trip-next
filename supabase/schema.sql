-- Run this in Supabase SQL Editor (Project → SQL → New query).

create table if not exists trips (
  id text primary key,
  data jsonb not null,
  checks jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table trips enable row level security;

drop policy if exists "anyone read" on trips;
drop policy if exists "anyone insert" on trips;
drop policy if exists "anyone update" on trips;

create policy "anyone read"   on trips for select using (true);
create policy "anyone insert" on trips for insert with check (true);
create policy "anyone update" on trips for update using (true);

-- Enable Realtime on this table:
-- Database → Replication → enable for table "trips" (or run the line below)
alter publication supabase_realtime add table trips;

-- Auto-update updated_at on every UPDATE
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trips_set_updated_at on trips;
create trigger trips_set_updated_at
before update on trips
for each row execute function set_updated_at();
