-- STRATIFY CONNECT - MY RADAR
-- user_id is the Supabase auth.users.id UUID of the signed-in Google user.
--
-- Store only Google Place IDs plus Stratify-owned context. Current business
-- details are fetched live from Places when My Radar is opened.

create table if not exists public.my_radar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null,
  sector text,
  category text,
  created_at timestamptz not null default now(),
  constraint my_radar_user_place_unique unique (user_id, place_id)
);

create index if not exists my_radar_user_created_idx
  on public.my_radar (user_id, created_at desc);

create index if not exists my_radar_place_idx
  on public.my_radar (place_id);

alter table public.my_radar enable row level security;

drop policy if exists "my_radar_select_own" on public.my_radar;
create policy "my_radar_select_own"
on public.my_radar for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "my_radar_insert_own" on public.my_radar;
create policy "my_radar_insert_own"
on public.my_radar for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "my_radar_update_own" on public.my_radar;
create policy "my_radar_update_own"
on public.my_radar for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "my_radar_delete_own" on public.my_radar;
create policy "my_radar_delete_own"
on public.my_radar for delete to authenticated
using (auth.uid() = user_id);