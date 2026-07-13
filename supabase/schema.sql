-- Fly Code Auditor - esquema inicial de Supabase (Postgres)
--
-- Como usarlo:
--   1. Crea un proyecto en https://supabase.com
--   2. Abre el SQL Editor del proyecto
--   3. Pega este archivo completo y ejecutalo (es seguro volver a correrlo:
--      usa "if not exists" y "on conflict do nothing")
--
-- Reemplaza el almacenamiento local en data/*.json (queries, projects,
-- reviews, plans). El login demo (contrasena "demo1234") sigue viviendo en
-- data/users.json por ahora; app_users es la fuente de verdad para las
-- relaciones (queries.user_email, reviews.reviewed_by) y el paso previo
-- para migrar el login a Supabase Auth mas adelante.

create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  role text,
  created_at timestamptz default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_name text,
  location text,
  status text default 'active',
  created_at timestamptz default now()
);

create table if not exists queries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid null references projects(id) on delete set null,
  user_email text,
  question text not null,
  answer jsonb not null,
  language_mode text default 'bilingual',
  risk_level text,
  source_category text,
  -- Columnas agregadas sobre la estructura minima sugerida, para no perder
  -- funcionalidad que ya existia con el almacenamiento JSON local:
  plan_id uuid null,                              -- vincula la consulta a un plano (planos/[id])
  input_mode text default 'texto',                 -- 'texto' o 'voz' (badge del historial)
  requires_master_review boolean default false,    -- escalado manual, independiente del risk_level
  created_at timestamptz default now()
);

create table if not exists plan_uploads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid null references projects(id) on delete set null,
  file_name text,
  file_type text,
  file_url text,
  analysis jsonb,
  created_at timestamptz default now()
);

-- FK diferida: queries.plan_id apunta a plan_uploads, que se crea despues.
alter table queries
  drop constraint if exists queries_plan_id_fkey;
alter table queries
  add constraint queries_plan_id_fkey foreign key (plan_id) references plan_uploads(id) on delete set null;

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  query_id uuid references queries(id) on delete cascade,
  reviewed_by text,
  status text default 'pending',
  comments text,
  created_at timestamptz default now()
);

-- Base tecnica real consultada por app/api/queries/route.ts vía
-- lib/db/dbAdapter.ts#findKnowledgeByQuestion, ANTES del fallback generico.
-- lib/knowledge/electricalKnowledgeBase.ts (TypeScript local) sigue siendo
-- el fallback si esta tabla no tiene una coincidencia (ver README.md).
-- Nota: en un proyecto Supabase ya existente que se creo con la version
-- anterior de este archivo, faltaran title/answer_es/answer_en/
-- code_references/source_used/updated_at — usa
-- supabase/knowledge_entries_upgrade.sql para agregarlas sin borrar datos.
create table if not exists knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text,
  keywords text[] not null,
  answer_es text,
  answer_en text,
  code_references text,
  risk_level text,
  source_used text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists queries_project_id_idx on queries(project_id);
create index if not exists queries_plan_id_idx on queries(plan_id);
create index if not exists queries_created_at_idx on queries(created_at desc);
create index if not exists reviews_query_id_idx on reviews(query_id);
create index if not exists plan_uploads_project_id_idx on plan_uploads(project_id);

-- RLS habilitado sin policies: el acceso solo pasa por el cliente
-- server-side que usa la service role key (bypassa RLS por diseno). Esto
-- bloquea cualquier lectura/escritura accidental con la anon key desde el
-- navegador, en caso de que esa key llegara a usarse por error.
alter table app_users enable row level security;
alter table projects enable row level security;
alter table queries enable row level security;
alter table plan_uploads enable row level security;
alter table reviews enable row level security;
alter table knowledge_entries enable row level security;

-- Seed inicial de usuarios demo: deben existir en Supabase para dejar de
-- depender de data/users.json como unica fuente de identidades. La
-- contrasena demo1234 se sigue validando localmente por ahora (ver
-- lib/auth/session.ts); migrar a Supabase Auth es un paso posterior.
insert into app_users (email, name, role) values
  ('admin@flyelectric.com', 'Fly Admin', 'owner_admin'),
  ('master@flyelectric.com', 'Roberto Flores (Master Electrician)', 'master_electrician'),
  ('tecnico@flyelectric.com', 'Luis Martinez (Tecnico)', 'tecnico'),
  ('ayudante@flyelectric.com', 'Junior Perez (Ayudante)', 'ayudante'),
  ('oficina@flyelectric.com', 'Sandra Gomez (Oficina)', 'oficina')
on conflict (email) do nothing;
