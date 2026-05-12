-- Private bucket for prospectus PDFs. Run once in SQL Editor (or fold into a migration if you prefer).
-- Upload files via Dashboard → Storage, or Supabase client with service_role.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'prospectus',
  'prospectus',
  false,
  52428800,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
