-- Fly Code Auditor - categoria obligatoria para el motor de score de
-- knowledge_entries (ver lib/knowledge/matchEngine.ts)
--
-- Por que: el matching anterior de public.knowledge_entries elegia una fila
-- si CUALQUIERA de sus keywords aparecia como substring en la pregunta (una
-- sola palabra generica bastaba). Eso causaba respuestas fuera de contexto
-- (ej. una pregunta sobre receptaculos exteriores podia devolver contenido
-- de un panel residencial solo porque ambos mencionan "receptaculos" o
-- "panel"). match_category permite aplicar el mismo gate de categoria que
-- ya usa la base electrica local (lib/knowledge/electricalKnowledgeBase.ts):
-- por ejemplo, la categoria "healthcare" exige que la pregunta mencione
-- hospital/paciente/clinica antes de considerar esa fila.
--
-- Valores validos (deben coincidir exactamente con MatchCategory en
-- lib/knowledge/matchEngine.ts): 'exterior_wet_locations', 'healthcare',
-- 'feeders', 'services', 'grounding_bonding', 'mc_cable', 'panels',
-- 'receptacles', 'ev_charging', 'tdlr', 'houston_ahj', 'lighting',
-- 'arc_flash_safety', 'installation_methods', 'operational_guide'.
--
-- Filas sin match_category (NULL) se tratan en runtime como
-- 'operational_guide' (categoria neutral sin gate): siguen pudiendo
-- matchear por score, pero nunca heredan por accidente el gate de otra
-- categoria. Aun asi, quedan sujetas al mismo minimo de score ponderado,
-- por lo que una sola palabra generica en sus keywords tampoco basta.
--
-- Seguro volver a ejecutar (usa "add column if not exists").

alter table public.knowledge_entries add column if not exists match_category text;

create index if not exists knowledge_entries_match_category_idx on public.knowledge_entries (match_category);

-- Clasifica la entrada semilla existente (ver supabase/knowledge_entries_upgrade.sql).
update public.knowledge_entries
set match_category = 'services'
where category = 'residential_service_panel' and match_category is null;
