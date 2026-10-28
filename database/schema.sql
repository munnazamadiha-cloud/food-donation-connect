-- Food Donation Connect
-- Run this entire script in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) >= 2),
  email text not null unique,
  password_hash text not null,
  role text not null default 'community'
    check (role in ('donor', 'community', 'admin')),
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.users(id) on delete cascade,
  food_name text not null check (char_length(trim(food_name)) >= 2),
  description text,
  quantity numeric(10,2) not null check (quantity > 0),
  unit text not null check (unit in ('kg', 'litres', 'packets', 'boxes', 'meals', 'items')),
  pickup_start timestamptz not null,
  pickup_end timestamptz not null,
  location text not null,
  status text not null default 'available'
    check (status in ('available', 'claimed', 'picked_up', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (pickup_end > pickup_start)
);

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations(id) on delete cascade,
  community_id uuid not null references public.users(id) on delete cascade,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (donation_id, community_id)
);

create index if not exists idx_donations_status on public.donations(status);
create index if not exists idx_donations_donor on public.donations(donor_id);
create index if not exists idx_donations_pickup on public.donations(pickup_start, pickup_end);
create index if not exists idx_claims_donation on public.claims(donation_id);
create index if not exists idx_claims_community on public.claims(community_id);
create index if not exists idx_users_role on public.users(role);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_updated_at on public.users;
create trigger users_updated_at before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists donations_updated_at on public.donations;
create trigger donations_updated_at before update on public.donations
for each row execute function public.set_updated_at();

drop trigger if exists claims_updated_at on public.claims;
create trigger claims_updated_at before update on public.claims
for each row execute function public.set_updated_at();

-- The application uses a server-only Supabase service-role key.
-- RLS is enabled so direct client access is not accidentally exposed.
-- The backend performs authorization before every data operation.
alter table public.users enable row level security;
alter table public.donations enable row level security;
alter table public.claims enable row level security;

-- No public/anon policies are created intentionally.
-- The service role used by the Express server bypasses RLS.
