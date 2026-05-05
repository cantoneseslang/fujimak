create extension if not exists pgcrypto;

create table if not exists public.visitor_logs (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  page text not null,
  user_agent text not null default '',
  language text not null default '',
  screen_width integer not null default 0,
  screen_height integer not null default 0,
  referrer text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.notification_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  store_id text not null,
  store_name text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  urgency text null check (urgency in ('urgent', 'normal')),
  summary text null,
  contact jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  store_id text not null,
  store_name text not null,
  category_id text not null,
  item_id text not null,
  urgency text not null check (urgency in ('urgent', 'normal', 'estimate')),
  remarks text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  preferred_date date not null,
  preferred_start_time time null,
  preferred_end_time time null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  source text not null default 'staff_portal' check (source in ('staff_portal', 'customer_call', 'troubleshooting_escalation')),
  troubleshooting_summary text null,
  requested_by text null,
  requested_phone text null,
  requested_email text null,
  vendor_name text null,
  scheduled_date date null,
  scheduled_start_time time null,
  scheduled_end_time time null,
  vendor_proposed_date date null,
  vendor_proposed_start_time time null,
  vendor_proposed_end_time time null,
  schedule_change_status text not null default 'none' check (schedule_change_status in ('none', 'pending', 'approved', 'rescheduled')),
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maintenance_updates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.maintenance_requests(id) on delete cascade,
  from_status text null check (from_status in ('pending', 'in_progress', 'completed', 'cancelled')),
  to_status text not null check (to_status in ('pending', 'in_progress', 'completed', 'cancelled')),
  note text null,
  actor text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_threads_status_updated on public.support_threads(status, updated_at desc);
create index if not exists idx_support_messages_thread_created on public.support_messages(thread_id, created_at asc);
create index if not exists idx_maintenance_requests_store_created on public.maintenance_requests(store_id, created_at desc);
create index if not exists idx_maintenance_requests_status on public.maintenance_requests(status);
create index if not exists idx_maintenance_updates_request_created on public.maintenance_updates(request_id, created_at desc);

insert into public.notification_settings (setting_key, enabled)
values
  ('login_notification', true),
  ('store_select_notification', true),
  ('maintenance_notification', true)
on conflict (setting_key) do update
set enabled = excluded.enabled, updated_at = now();

alter table public.visitor_logs enable row level security;
alter table public.notification_settings enable row level security;
alter table public.notification_emails enable row level security;
alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.maintenance_updates enable row level security;

drop policy if exists visitor_logs_auth_all on public.visitor_logs;
create policy visitor_logs_auth_all on public.visitor_logs
for all
to authenticated
using (true)
with check (true);

drop policy if exists notification_settings_auth_all on public.notification_settings;
create policy notification_settings_auth_all on public.notification_settings
for all
to authenticated
using (true)
with check (true);

drop policy if exists notification_emails_auth_all on public.notification_emails;
create policy notification_emails_auth_all on public.notification_emails
for all
to authenticated
using (true)
with check (true);

drop policy if exists support_threads_auth_all on public.support_threads;
create policy support_threads_auth_all on public.support_threads
for all
to authenticated
using (true)
with check (true);

drop policy if exists support_messages_auth_all on public.support_messages;
create policy support_messages_auth_all on public.support_messages
for all
to authenticated
using (true)
with check (true);

drop policy if exists maintenance_requests_auth_all on public.maintenance_requests;
create policy maintenance_requests_auth_all on public.maintenance_requests
for all
to authenticated
using (true)
with check (true);

drop policy if exists maintenance_updates_auth_all on public.maintenance_updates;
create policy maintenance_updates_auth_all on public.maintenance_updates
for all
to authenticated
using (true)
with check (true);
