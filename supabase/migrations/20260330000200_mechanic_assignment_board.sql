create table if not exists public.mechanics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  login_code text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mechanic_notifications (
  id uuid primary key default gen_random_uuid(),
  mechanic_id uuid not null references public.mechanics(id) on delete cascade,
  request_id uuid null references public.maintenance_requests(id) on delete set null,
  type text not null default 'assignment',
  title text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.maintenance_requests
  add column if not exists assigned_mechanic_id uuid null references public.mechanics(id) on delete set null,
  add column if not exists assignment_state text not null default 'unassigned'
    check (assignment_state in ('unassigned', 'assigned', 'working', 'awaiting_invoice', 'completed')),
  add column if not exists assigned_at timestamptz null;

create index if not exists idx_mechanics_active on public.mechanics(is_active, created_at desc);
create index if not exists idx_maintenance_requests_assigned_mechanic
  on public.maintenance_requests(assigned_mechanic_id, status, updated_at desc);
create index if not exists idx_mechanic_notifications_mechanic
  on public.mechanic_notifications(mechanic_id, is_read, created_at desc);

alter table public.mechanics enable row level security;
alter table public.mechanic_notifications enable row level security;

drop policy if exists mechanics_auth_all on public.mechanics;
create policy mechanics_auth_all on public.mechanics
for all
to authenticated
using (true)
with check (true);

drop policy if exists mechanic_notifications_auth_all on public.mechanic_notifications;
create policy mechanic_notifications_auth_all on public.mechanic_notifications
for all
to authenticated
using (true)
with check (true);
