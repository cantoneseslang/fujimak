alter table public.support_threads
  add column if not exists workflow_state text not null default 'pending'
    check (workflow_state in ('pending', 'ready_for_dispatch', 'in_progress', 'awaiting_invoice', 'completed', 'closed')),
  add column if not exists maintenance_request_id uuid null references public.maintenance_requests(id) on delete set null,
  add column if not exists intake_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists dispatched_at timestamptz null,
  add column if not exists completed_at timestamptz null;

create index if not exists idx_support_threads_workflow_updated
  on public.support_threads(workflow_state, updated_at desc);

alter table public.maintenance_requests
  add column if not exists report_sent_at timestamptz null,
  add column if not exists report_sent_to text null,
  add column if not exists invoice_pdf_filename text null,
  add column if not exists invoice_issued_at timestamptz null,
  add column if not exists invoice_issued_by text null;

create table if not exists public.parts_order_workflows (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  store_id text not null,
  store_name text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'cancelled')),
  draft_payload jsonb not null default '{}'::jsonb,
  pdf_filename text null,
  email_recipients text[] not null default '{}'::text[],
  email_sent_at timestamptz null,
  invoice_filename text null,
  invoice_issued_at timestamptz null,
  invoice_issued_by text null,
  processed_at timestamptz null,
  processed_by text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_parts_order_workflows_status_created
  on public.parts_order_workflows(status, created_at desc);

create table if not exists public.parts_order_updates (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.parts_order_workflows(id) on delete cascade,
  from_status text null check (from_status in ('pending', 'processing', 'completed', 'cancelled')),
  to_status text not null check (to_status in ('pending', 'processing', 'completed', 'cancelled')),
  note text null,
  actor text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_parts_order_updates_workflow_created
  on public.parts_order_updates(workflow_id, created_at desc);

alter table public.parts_order_workflows enable row level security;
alter table public.parts_order_updates enable row level security;

drop policy if exists parts_order_workflows_auth_all on public.parts_order_workflows;
create policy parts_order_workflows_auth_all on public.parts_order_workflows
for all
to authenticated
using (true)
with check (true);

drop policy if exists parts_order_updates_auth_all on public.parts_order_updates;
create policy parts_order_updates_auth_all on public.parts_order_updates
for all
to authenticated
using (true)
with check (true);
