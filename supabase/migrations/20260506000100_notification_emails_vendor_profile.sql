-- Persist vendor display fields edited on Settings (previously only email survived reload).
alter table public.notification_emails
  add column if not exists display_name text null,
  add column if not exists phone text not null default '',
  add column if not exists is_active boolean not null default true,
  add column if not exists sort_order integer not null default 0;
