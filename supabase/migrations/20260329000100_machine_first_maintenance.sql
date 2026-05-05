create table if not exists public.machine_catalog (
  id text primary key,
  brand text not null default 'fujimak',
  family text not null default 'jet-oven',
  series text not null,
  model_code text not null unique,
  display_name text not null,
  conveyor_width_mm integer null,
  levels integer null,
  power_source text not null default 'unknown',
  supports_steam boolean not null default false,
  source_page_nos integer[] not null default '{}'::integer[],
  fault_locations text[] not null default '{}'::text[],
  recommended_part_ids text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_machines (
  id uuid primary key default gen_random_uuid(),
  store_id text not null,
  machine_id text not null references public.machine_catalog(id) on delete restrict,
  machine_serial text not null,
  installed_at date null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, machine_serial)
);

alter table public.maintenance_requests
  alter column category_id drop not null,
  alter column item_id drop not null;

alter table public.maintenance_requests
  add column if not exists machine_id text null,
  add column if not exists machine_name text null,
  add column if not exists machine_model text null,
  add column if not exists machine_serial text null,
  add column if not exists fault_location text null,
  add column if not exists symptom text null,
  add column if not exists photo_urls jsonb not null default '[]'::jsonb,
  add column if not exists request_flow text not null default 'machine_first',
  add column if not exists machine_source_pages integer[] not null default '{}'::integer[];

create index if not exists idx_maintenance_requests_machine_id on public.maintenance_requests(machine_id);
create index if not exists idx_maintenance_requests_machine_serial on public.maintenance_requests(machine_serial);
create index if not exists idx_store_machines_store_active on public.store_machines(store_id, is_active);

alter table public.machine_catalog enable row level security;
alter table public.store_machines enable row level security;

drop policy if exists machine_catalog_auth_all on public.machine_catalog;
create policy machine_catalog_auth_all on public.machine_catalog
for all
to authenticated
using (true)
with check (true);

drop policy if exists store_machines_auth_all on public.store_machines;
create policy store_machines_auth_all on public.store_machines
for all
to authenticated
using (true)
with check (true);

insert into public.machine_catalog (
  id,
  series,
  model_code,
  display_name,
  conveyor_width_mm,
  levels,
  power_source,
  supports_steam,
  source_page_nos,
  fault_locations,
  recommended_part_ids
)
values
  (
    'jet-oven-fgjob5z',
    'energy-saving',
    'FGJOB5Z',
    'Jet Oven FGJOB5Z',
    457,
    1,
    'gas',
    false,
    array[8, 9],
    array['Conveyor inlet', 'Conveyor outlet', 'Conveyor belt', 'Finger nozzles', 'Touch panel', 'Combustion chamber', 'Steam nozzle', 'Drain connection', 'Gas connection', 'Power connection'],
    array['oven-pan-single', 'oven-pan-twin', 'grooved-pan-657', 'flat-grid-single']
  ),
  (
    'jet-oven-fgjob5dz',
    'energy-saving',
    'FGJOB5DZ',
    'Jet Oven FGJOB5DZ',
    457,
    2,
    'gas',
    false,
    array[8, 9],
    array['Conveyor inlet', 'Conveyor outlet', 'Conveyor belt', 'Finger nozzles', 'Touch panel', 'Combustion chamber', 'Steam nozzle', 'Drain connection', 'Gas connection', 'Power connection'],
    array['oven-pan-single', 'oven-pan-twin', 'grooved-pan-657', 'flat-grid-single']
  ),
  (
    'jet-oven-fgjob5wz',
    'energy-saving',
    'FGJOB5WZ',
    'Jet Oven FGJOB5WZ',
    812,
    1,
    'gas',
    false,
    array[8, 9],
    array['Conveyor inlet', 'Conveyor outlet', 'Conveyor belt', 'Finger nozzles', 'Touch panel', 'Combustion chamber', 'Steam nozzle', 'Drain connection', 'Gas connection', 'Power connection'],
    array['oven-pan-single', 'oven-pan-twin', 'grooved-pan-657', 'flat-grid-single']
  ),
  (
    'jet-oven-fgjob5wdz',
    'energy-saving',
    'FGJOB5WDZ',
    'Jet Oven FGJOB5WDZ',
    812,
    2,
    'gas',
    false,
    array[8, 9],
    array['Conveyor inlet', 'Conveyor outlet', 'Conveyor belt', 'Finger nozzles', 'Touch panel', 'Combustion chamber', 'Steam nozzle', 'Drain connection', 'Gas connection', 'Power connection'],
    array['oven-pan-single', 'oven-pan-twin', 'grooved-pan-657', 'flat-grid-single']
  ),
  (
    'jet-oven-fgjob7z',
    'energy-saving',
    'FGJOB7Z',
    'Jet Oven FGJOB7Z',
    457,
    1,
    'gas',
    false,
    array[10],
    array['Conveyor inlet', 'Conveyor outlet', 'Conveyor belt', 'Finger nozzles', 'Touch panel', 'Combustion chamber', 'Steam nozzle', 'Drain connection', 'Gas connection', 'Power connection'],
    array['oven-pan-single', 'oven-pan-twin', 'grooved-pan-657', 'flat-grid-single']
  ),
  (
    'jet-oven-fgjob7dz',
    'energy-saving',
    'FGJOB7DZ',
    'Jet Oven FGJOB7DZ',
    457,
    2,
    'gas',
    false,
    array[10],
    array['Conveyor inlet', 'Conveyor outlet', 'Conveyor belt', 'Finger nozzles', 'Touch panel', 'Combustion chamber', 'Steam nozzle', 'Drain connection', 'Gas connection', 'Power connection'],
    array['oven-pan-single', 'oven-pan-twin', 'grooved-pan-657', 'flat-grid-single']
  ),
  (
    'jet-oven-fgjoa9',
    'compact',
    'FGJOA9',
    'Jet Oven FGJOA9',
    456,
    1,
    'gas-or-electric',
    false,
    array[11, 12, 13],
    array['Conveyor inlet', 'Conveyor outlet', 'Conveyor belt', 'Finger nozzles', 'Touch panel', 'Combustion chamber', 'Steam nozzle', 'Drain connection', 'Gas connection', 'Power connection'],
    array['oven-pan-single', 'grooved-pan-single-twin', 'curved-grid', 'flat-grid-single']
  ),
  (
    'jet-oven-fgjoa9h',
    'compact',
    'FGJOA9H',
    'Jet Oven FGJOA9H',
    456,
    1,
    'gas',
    false,
    array[11, 13],
    array['Conveyor inlet', 'Conveyor outlet', 'Conveyor belt', 'Finger nozzles', 'Touch panel', 'Combustion chamber', 'Steam nozzle', 'Drain connection', 'Gas connection', 'Power connection'],
    array['oven-pan-single', 'grooved-pan-single-twin', 'curved-grid', 'flat-grid-single']
  ),
  (
    'jet-oven-fgjob10',
    'compact',
    'FGJOB10',
    'Jet Oven FGJOB10',
    456,
    1,
    'gas',
    false,
    array[11, 13],
    array['Conveyor inlet', 'Conveyor outlet', 'Conveyor belt', 'Finger nozzles', 'Touch panel', 'Combustion chamber', 'Steam nozzle', 'Drain connection', 'Gas connection', 'Power connection'],
    array['oven-pan-single', 'grooved-pan-single-twin', 'curved-grid', 'flat-grid-single']
  ),
  (
    'jet-oven-fgjoa5',
    'standard',
    'FGJOA5',
    'Jet Oven FGJOA5',
    457,
    1,
    'gas-or-electric',
    false,
    array[14, 16],
    array['Conveyor inlet', 'Conveyor outlet', 'Conveyor belt', 'Finger nozzles', 'Touch panel', 'Combustion chamber', 'Steam nozzle', 'Drain connection', 'Gas connection', 'Power connection'],
    array['oven-pan-single', 'oven-pan-657', 'grooved-pan-657-second', 'flat-grid-long']
  ),
  (
    'jet-oven-fgjoa5d',
    'standard',
    'FGJOA5D',
    'Jet Oven FGJOA5D',
    457,
    2,
    'gas-or-electric',
    false,
    array[14, 16],
    array['Conveyor inlet', 'Conveyor outlet', 'Conveyor belt', 'Finger nozzles', 'Touch panel', 'Combustion chamber', 'Steam nozzle', 'Drain connection', 'Gas connection', 'Power connection'],
    array['oven-pan-single', 'oven-pan-657', 'grooved-pan-657-second', 'flat-grid-long']
  ),
  (
    'jet-oven-fgjoa5w',
    'standard',
    'FGJOA5W',
    'Jet Oven FGJOA5W',
    812,
    1,
    'gas-or-electric',
    false,
    array[14, 17],
    array['Conveyor inlet', 'Conveyor outlet', 'Conveyor belt', 'Finger nozzles', 'Touch panel', 'Combustion chamber', 'Steam nozzle', 'Drain connection', 'Gas connection', 'Power connection'],
    array['oven-pan-single', 'oven-pan-657', 'grooved-pan-657-second', 'flat-grid-long']
  ),
  (
    'jet-oven-fgjoa5wd',
    'standard',
    'FGJOA5WD',
    'Jet Oven FGJOA5WD',
    812,
    2,
    'gas-or-electric',
    false,
    array[14, 17],
    array['Conveyor inlet', 'Conveyor outlet', 'Conveyor belt', 'Finger nozzles', 'Touch panel', 'Combustion chamber', 'Steam nozzle', 'Drain connection', 'Gas connection', 'Power connection'],
    array['oven-pan-single', 'oven-pan-657', 'grooved-pan-657-second', 'flat-grid-long']
  ),
  (
    'jet-oven-fgjoa7',
    'pizza',
    'FGJOA7',
    'Jet Oven FGJOA7',
    458,
    1,
    'gas',
    false,
    array[18],
    array['Conveyor inlet', 'Conveyor outlet', 'Conveyor belt', 'Finger nozzles', 'Touch panel', 'Combustion chamber', 'Steam nozzle', 'Drain connection', 'Gas connection', 'Power connection'],
    array['oven-pan-single', 'flat-grid-single', 'curved-grid']
  ),
  (
    'jet-oven-fgjoa7d',
    'pizza',
    'FGJOA7D',
    'Jet Oven FGJOA7D',
    458,
    2,
    'gas',
    false,
    array[18],
    array['Conveyor inlet', 'Conveyor outlet', 'Conveyor belt', 'Finger nozzles', 'Touch panel', 'Combustion chamber', 'Steam nozzle', 'Drain connection', 'Gas connection', 'Power connection'],
    array['oven-pan-single', 'flat-grid-single', 'curved-grid']
  ),
  (
    'jet-oven-fgjoa7w',
    'pizza',
    'FGJOA7W',
    'Jet Oven FGJOA7W',
    812,
    1,
    'gas',
    false,
    array[18],
    array['Conveyor inlet', 'Conveyor outlet', 'Conveyor belt', 'Finger nozzles', 'Touch panel', 'Combustion chamber', 'Steam nozzle', 'Drain connection', 'Gas connection', 'Power connection'],
    array['oven-pan-single', 'flat-grid-single', 'curved-grid']
  ),
  (
    'jet-oven-fgjoa7wd',
    'pizza',
    'FGJOA7WD',
    'Jet Oven FGJOA7WD',
    812,
    2,
    'gas',
    false,
    array[18],
    array['Conveyor inlet', 'Conveyor outlet', 'Conveyor belt', 'Finger nozzles', 'Touch panel', 'Combustion chamber', 'Steam nozzle', 'Drain connection', 'Gas connection', 'Power connection'],
    array['oven-pan-single', 'flat-grid-single', 'curved-grid']
  ),
  (
    'jet-oven-fgjoa30nr',
    'long',
    'FGJOA30NR',
    'Jet Oven FGJOA30NR',
    null,
    1,
    'gas',
    true,
    array[19, 20, 21],
    array['Conveyor inlet', 'Conveyor outlet', 'Conveyor belt', 'Finger nozzles', 'Touch panel', 'Combustion chamber', 'Steam nozzle', 'Drain connection', 'Gas connection', 'Power connection'],
    array['oven-pan-657', 'flat-grid-long', 'grooved-pan-657-second']
  ),
  (
    'jet-oven-fgjoa50nr',
    'long',
    'FGJOA50NR',
    'Jet Oven FGJOA50NR',
    null,
    2,
    'gas',
    true,
    array[19, 20, 21],
    array['Conveyor inlet', 'Conveyor outlet', 'Conveyor belt', 'Finger nozzles', 'Touch panel', 'Combustion chamber', 'Steam nozzle', 'Drain connection', 'Gas connection', 'Power connection'],
    array['oven-pan-657', 'flat-grid-long', 'grooved-pan-657-second']
  ),
  (
    'jet-oven-fgjoa70nr',
    'long',
    'FGJOA70NR',
    'Jet Oven FGJOA70NR',
    null,
    3,
    'gas',
    true,
    array[19, 20, 21],
    array['Conveyor inlet', 'Conveyor outlet', 'Conveyor belt', 'Finger nozzles', 'Touch panel', 'Combustion chamber', 'Steam nozzle', 'Drain connection', 'Gas connection', 'Power connection'],
    array['oven-pan-657', 'flat-grid-long', 'grooved-pan-657-second']
  )
on conflict (id) do update
set
  series = excluded.series,
  model_code = excluded.model_code,
  display_name = excluded.display_name,
  conveyor_width_mm = excluded.conveyor_width_mm,
  levels = excluded.levels,
  power_source = excluded.power_source,
  supports_steam = excluded.supports_steam,
  source_page_nos = excluded.source_page_nos,
  fault_locations = excluded.fault_locations,
  recommended_part_ids = excluded.recommended_part_ids,
  updated_at = now();
