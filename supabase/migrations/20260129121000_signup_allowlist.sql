-- Invite-only signup allowlist for this brand app.

create table if not exists public.signup_allowlist (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.signup_allowlist enable row level security;

drop policy if exists signup_allowlist_admin_all on public.signup_allowlist;
create policy signup_allowlist_admin_all on public.signup_allowlist
for all
using (true)
with check (true);
