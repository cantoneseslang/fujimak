alter table public.mechanics
  add column if not exists english_name text null,
  add column if not exists sir_name text null,
  add column if not exists family_name text null,
  add column if not exists phone_number text null;

update public.mechanics
set english_name = coalesce(nullif(trim(english_name), ''), nullif(trim(name), ''))
where coalesce(trim(english_name), '') = '';
