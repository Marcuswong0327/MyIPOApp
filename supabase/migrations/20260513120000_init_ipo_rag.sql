-- IPO RAG core schema: IPO catalogue, prospectus chunks + embeddings, synthesis reports.
-- Embedding dimension 1536 matches OpenAI text-embedding-3-small (change if you switch models).

create extension if not exists vector with schema extensions;

create table public.ipos (
  id uuid primary key default gen_random_uuid(),
  ticker text not null unique,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  storage_path text,
  indexed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prospectus_chunks (
  id uuid primary key default gen_random_uuid(),
  ipo_id uuid not null references public.ipos (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  unique (ipo_id, chunk_index)
);

create index prospectus_chunks_ipo_id_idx on public.prospectus_chunks (ipo_id);

-- Similarity search (cosine). Partial index skips rows not yet embedded.
create index prospectus_chunks_embedding_hnsw_idx on public.prospectus_chunks
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ipo_id uuid not null references public.ipos (id) on delete restrict,
  json_payload jsonb not null,
  markdown_report text not null,
  model text,
  prompt_version text,
  created_at timestamptz not null default now()
);

create index reports_user_id_created_at_idx on public.reports (user_id, created_at desc);
create index reports_ipo_id_idx on public.reports (ipo_id);

-- ---------------------------------------------------------------------------
-- Row level security: Expo may use anon/authenticated; Cloud Run uses service role (bypasses RLS).
-- ---------------------------------------------------------------------------

alter table public.ipos enable row level security;
alter table public.prospectus_chunks enable row level security;
alter table public.reports enable row level security;

create policy ipos_select_published_authenticated
  on public.ipos
  for select
  to authenticated
  using (status = 'published');

create policy reports_select_own
  on public.reports
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy reports_insert_own
  on public.reports
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- prospectus_chunks: no policy for authenticated/anon => deny via PostgREST; service role still full access.

comment on table public.ipos is 'IPO catalogue; storage_path points at Supabase Storage object for the prospectus PDF.';
comment on table public.prospectus_chunks is 'Chunked prospectus text + embedding for Auditor retrieval.';
comment on table public.reports is 'Synthesis output: structured json_payload plus markdown_report.';
