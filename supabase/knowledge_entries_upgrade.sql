-- Fly Code Auditor - actualizacion de public.knowledge_entries
--
-- Que hace:
--   1. Agrega las columnas que faltan para que knowledge_entries sea la
--      base tecnica real consultada por app/api/queries/route.ts (no toca
--      ni borra columnas ni filas existentes).
--   2. Inserta la entrada inicial "residential_service_panel" una sola vez
--      (usa "where not exists", es seguro volver a ejecutar este archivo).
--
-- Como usarlo: pega este archivo completo en el SQL Editor de Supabase y
-- ejecutalo. Verificado contra la tabla real: ya tenia id, category,
-- keywords, risk_level, created_at (mas code_reference/source_type/
-- content_es/content_en/checklist_es/checklist_en de una version anterior,
-- que se dejan intactas sin uso). Solo faltaban las 6 columnas de abajo.

alter table public.knowledge_entries add column if not exists title text;
alter table public.knowledge_entries add column if not exists answer_es text;
alter table public.knowledge_entries add column if not exists answer_en text;
alter table public.knowledge_entries add column if not exists code_references text;
alter table public.knowledge_entries add column if not exists source_used text;
alter table public.knowledge_entries add column if not exists updated_at timestamptz not null default now();

-- Entrada inicial real (ver lib/knowledge/electricalKnowledgeBase.ts para
-- el equivalente local usado como fallback si esta tabla no tiene match).
insert into public.knowledge_entries
  (category, title, keywords, answer_es, answer_en, code_references, risk_level, source_used)
select
  'residential_service_panel',
  'Minimum residential service panel amperage',
  array[
    'panel residencial', 'amperaje minimo', 'mínimo amperaje', 'residential panel',
    'minimum amperage', 'service size', 'service disconnect', '100 amp', '100A',
    '200 amp', 'dwelling service', 'one family dwelling', 'panel upgrade', 'servicio residencial'
  ],
  'Para una vivienda unifamiliar, el mínimo típico de servicio o desconectador principal es 100 amperios, 3 hilos, conforme a NEC 230.79(C). Sin embargo, el tamaño final del panel o servicio no se define solo por una regla fija. Debe confirmarse mediante cálculo de carga conforme a NEC Article 220, requisitos de la compañía eléctrica, condiciones existentes del inmueble y aprobación del AHJ local. En viviendas modernas, remodelaciones grandes, EV chargers, HVAC eléctrico o nuevas cargas importantes, 200A puede ser recomendable o requerido según el caso.',
  'For a one-family dwelling, the typical minimum service disconnect rating is 100 amps, 3-wire, under NEC 230.79(C). The final panel or service size must be confirmed by a NEC Article 220 load calculation, utility requirements, existing site conditions, and local AHJ approval. For modern homes, major remodels, EV chargers, electric HVAC, or significant new loads, 200A may be recommended or required depending on the project.',
  'NEC 230.79(C), NEC Article 220, utility requirements, local AHJ',
  'medium',
  'Fly Electric Solutions LLC internal knowledge base - Residential service panel'
where not exists (
  select 1 from public.knowledge_entries where category = 'residential_service_panel'
);
