create table if not exists public.access_policies (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  auth_type text not null check (auth_type in ('email_password', 'test_code')),
  access_type text not null check (access_type in ('trial_30d', 'permanent')),
  starts_at timestamptz null,
  expires_at timestamptz null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(identifier, auth_type),
  check (
    (access_type = 'permanent' and expires_at is null)
    or (access_type = 'trial_30d')
  )
);

create index if not exists idx_access_policies_auth_identifier
  on public.access_policies(auth_type, identifier);

alter table public.access_policies enable row level security;

drop policy if exists access_policies_auth_select_own on public.access_policies;
create policy access_policies_auth_select_own on public.access_policies
for select
to authenticated
using (
  auth_type = 'email_password'
  and identifier = lower(coalesce(auth.jwt() ->> 'email', ''))
);

insert into public.signup_allowlist (email)
values
  ('s_yoshizawa@fujimak.co.jp'),
  ('a_miura@fujimak.co.jp'),
  ('bestinksalesman@gmail.com'),
  ('info@lifesupporthk.com'),
  ('hsakon@lifesupporthk.com')
on conflict (email) do nothing;

insert into public.access_policies (identifier, auth_type, access_type, starts_at, expires_at, is_active)
values
  ('s_yoshizawa@fujimak.co.jp', 'email_password', 'trial_30d', null, null, true),
  ('a_miura@fujimak.co.jp', 'email_password', 'trial_30d', null, null, true),
  ('bestinksalesman@gmail.com', 'email_password', 'permanent', now(), null, true),
  ('info@lifesupporthk.com', 'email_password', 'permanent', now(), null, true),
  ('hsakon@lifesupporthk.com', 'email_password', 'permanent', now(), null, true),
  ('fujimak-test', 'test_code', 'permanent', now(), null, true)
on conflict (identifier, auth_type) do update
set
  access_type = excluded.access_type,
  is_active = true,
  starts_at = coalesce(public.access_policies.starts_at, excluded.starts_at),
  expires_at = coalesce(public.access_policies.expires_at, excluded.expires_at),
  updated_at = now();
