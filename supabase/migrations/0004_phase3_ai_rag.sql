-- ============================================================================
-- Phase 3 (AI): RAG document store (pgvector) + permission-filtered retrieval
-- and opt-in conversation history for the "cult.fit Routine Assistant"
-- (PRD §21–25). Private member data is NEVER embedded here; RAG holds only
-- approved unstructured content plus user-owned, user-approved summaries.
-- Embeddings use Google text-embedding-004 (768 dimensions).
-- ============================================================================

do $$ begin create type rag_visibility as enum ('public', 'member'); exception when duplicate_object then null; end $$;

create table if not exists rag_documents (
  id           uuid primary key default gen_random_uuid(),
  source       text not null,                 -- e.g. 'help_centre', 'safety', 'workout_library'
  title        text not null,
  content_type text not null,                 -- faq | policy | safety | workout | equipment | class | routine_summary
  visibility   rag_visibility not null default 'public',
  version      text not null default 'v1',
  owner_id     uuid references auth.users(id) on delete cascade,  -- set only for member-owned docs
  content      text not null,                 -- the chunk text
  embedding    vector(768),
  created_at   timestamptz not null default now()
);
create index if not exists idx_rag_source on rag_documents (source);
create index if not exists idx_rag_owner on rag_documents (owner_id);
-- Approximate nearest-neighbour index for cosine distance.
create index if not exists idx_rag_embedding on rag_documents
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Permission-filtered similarity search. Only public docs OR docs owned by the
-- requesting member are ever considered (PRD §24). Called server-side (service
-- role) with the verified member id.
create or replace function match_rag_documents(query_embedding vector(768), match_count int, p_user uuid)
returns table (id uuid, source text, title text, content_type text, content text, similarity float)
language sql stable as $$
  select d.id, d.source, d.title, d.content_type, d.content,
         1 - (d.embedding <=> query_embedding) as similarity
  from rag_documents d
  where d.embedding is not null
    and (d.visibility = 'public' or d.owner_id = p_user)
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

-- Opt-in conversation history (only written when the member consents, §25).
create table if not exists ai_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  sources    jsonb,                       -- source labels shown with an answer
  feedback   smallint,                    -- +1 / -1 / null
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_messages_user on ai_messages (user_id, created_at);

-- ---- RLS -------------------------------------------------------------------
alter table rag_documents enable row level security;
alter table ai_messages   enable row level security;

-- Members may read public docs or their own; server retrieval adds its own filter too.
create policy "read approved rag" on rag_documents
  for select using (auth.role() = 'authenticated' and (visibility = 'public' or owner_id = auth.uid()));

create policy "own ai messages" on ai_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
