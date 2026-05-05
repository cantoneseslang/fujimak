-- Support chat schema for Sushiro Maintenance
-- Tables:
-- - support_threads: a conversation ticket per store/user context
-- - support_messages: messages belonging to a thread
--
-- Notes:
-- - This app currently relies on server-side API routes (Service Role) to write/read.
-- - Keep RLS enabled; do not expose these tables directly to anon clients.

-- Extensions
create extension if not exists pgcrypto;

-- support_threads
create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  store_id text not null,
  store_name text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  urgency text null check (urgency in ('urgent', 'normal')),
  summary text null,
  contact jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_threads_store_id_idx on public.support_threads (store_id);
create index if not exists support_threads_status_updated_at_idx on public.support_threads (status, updated_at desc);

-- support_messages
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  meta jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_thread_id_created_at_idx on public.support_messages (thread_id, created_at asc);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_support_threads_updated_at on public.support_threads;
create trigger trg_support_threads_updated_at
before update on public.support_threads
for each row execute function public.set_updated_at();

-- RLS
alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;

-- No public policies by default (server-side Service Role bypasses RLS)
-- If you later add authenticated users, define policies here.

