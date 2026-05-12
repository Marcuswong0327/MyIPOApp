-- Dev seed: one published IPO so POST /v1/reports can pass the IPO gate (returns 501 until pipeline is wired).
-- Run in Supabase → SQL Editor after migrations.

insert into public.ipos (ticker, name, status, storage_path, indexed_at)
values (
  'DEMO',
  'Demo IPO (development)',
  'published',
  'demo.pdf',
  null
)
on conflict (ticker) do update set
  status = excluded.status,
  name = excluded.name,
  storage_path = excluded.storage_path,
  updated_at = now();

-- Copy `id` from the result — you need it for POST /v1/reports body: { "ipoId": "<uuid>" }
select id, ticker, status from public.ipos where ticker = 'DEMO';
