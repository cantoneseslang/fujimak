-- Mechanic before/after photos (API route uses bucket id maintenance-work-media).
-- Aligns with ensureWorkMediaBucket in src/app/api/mechanic/work-record/route.ts

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'maintenance-work-media',
  'maintenance-work-media',
  true,
  209715200,
  array['image/*', 'video/*']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
