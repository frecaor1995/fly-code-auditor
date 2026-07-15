-- Fly Code Auditor - fuentes oficiales vivas (public.official_sources)
--
-- Que hace:
--   1. Crea public.official_sources si no existe: catalogo de fuentes
--      oficiales externas (NEC/NFPA, TDLR, Houston AHJ) que la app cita y
--      recomienda verificar, en vez de copiar su contenido.
--   2. Inserta las fuentes iniciales una sola vez cada una (por
--      source_name, "where not exists"), es seguro volver a ejecutar este
--      archivo.
--
-- Como usarlo: pega este archivo completo en el SQL Editor de Supabase y
-- ejecutalo.
--
-- Nota sobre official_url: apunta a los dominios oficiales conocidos de
-- cada organismo. Algunas rutas especificas (ej. la pagina exacta de
-- "Laws & Rules" dentro de tdlr.texas.gov) pueden cambiar con el tiempo:
-- revisa y actualiza la columna cuando corresponda, y usa
-- last_checked_at / updateSourceLastChecked() para llevar registro de la
-- ultima verificacion manual.

create extension if not exists pgcrypto;

create table if not exists public.official_sources (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_type text not null,
  jurisdiction text,
  official_url text not null,
  current_version text,
  last_checked_at timestamptz,
  priority int default 10,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists official_sources_source_name_key on public.official_sources (source_name);
create index if not exists official_sources_source_type_idx on public.official_sources (source_type);
create index if not exists official_sources_priority_idx on public.official_sources (priority);

alter table public.official_sources enable row level security;

-- Fuentes iniciales. source_type es el valor que usa
-- lib/db/dbAdapter.ts#findOfficialSourceByType() y app/api/queries/route.ts
-- para decidir que fuentes anexar segun el tema de la pregunta (NEC, Texas
-- / licencia, Houston / permitting).
insert into public.official_sources
  (source_name, source_type, jurisdiction, official_url, current_version, priority, notes)
select * from (values
  (
    'NFPA 70 / NEC',
    'nec',
    'national',
    'https://www.nfpa.org/codes-and-standards/all-codes-and-standards/list-of-codes-and-standards/detail?code=70',
    'NEC 2023',
    1,
    'Codigo electrico oficial. La app nunca copia su texto completo: solo cita numero de articulo/seccion y remite aqui para el texto oficial vigente.'
  ),
  (
    'NFPA Free Access',
    'nfpa_free_access',
    'national',
    'https://www.nfpa.org/codes-and-standards/all-codes-and-standards/free-access',
    null,
    2,
    'Acceso de solo lectura gratuito a NFPA 70 (NEC) y otros codigos NFPA (NFPA 99, NFPA 70E incluidos). Util para verificar el texto oficial de un articulo puntual.'
  ),
  (
    'NFPA LiNK',
    'nfpa_link',
    'national',
    'https://www.nfpa.org/link',
    null,
    3,
    'Plataforma paga/suscripcion de NFPA con codigos, busqueda y herramientas de cumplimiento. Alternativa mas completa a NFPA Free Access.'
  ),
  (
    'TDLR Electricians',
    'tdlr',
    'Texas',
    'https://www.tdlr.texas.gov/electricians/electricians.htm',
    null,
    4,
    'Pagina oficial del programa de licencias de electricistas de TDLR (Texas Department of Licensing and Regulation): tipos de licencia, requisitos, renovaciones.'
  ),
  (
    'TDLR Electricians Laws and Rules',
    'tdlr_rules',
    'Texas',
    'https://www.tdlr.texas.gov/electricians/electricians.htm',
    null,
    5,
    'Leyes y reglas administrativas del programa de electricistas de TDLR. Verificar dentro de esta pagina la seccion "Laws and Rules" / "Statutes and Rules" vigente, ya que la URL exacta de esa subpagina puede cambiar.'
  ),
  (
    'Houston Permitting Center',
    'houston_ahj',
    'Houston, TX',
    'https://www.houstonpermittingcenter.org/',
    null,
    6,
    'AHJ (Authority Having Jurisdiction) para permisos electricos e inspecciones dentro de la Ciudad de Houston.'
  ),
  (
    'Houston Public Works Permitting',
    'houston_public_works',
    'Houston, TX',
    'https://www.houstonpublicworks.org/',
    null,
    7,
    'Departamento de Obras Publicas de Houston; varios de sus tramites de permisos se procesan a traves de Houston Permitting Center.'
  )
) as v(source_name, source_type, jurisdiction, official_url, current_version, priority, notes)
where not exists (
  select 1 from public.official_sources s where s.source_name = v.source_name
);
