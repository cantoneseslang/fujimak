-- Structured fields for Fujimak-style Maintenance Report PDF (filled on report-confirm, persisted on send).
alter table public.maintenance_requests
  add column if not exists mechanic_report_snapshot jsonb null;

comment on column public.maintenance_requests.mechanic_report_snapshot is
  'Mechanic maintenance report form payload for PDF (title block, checklist, rank, names, etc.).';
