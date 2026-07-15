-- Fly Code Auditor - referencias a fuentes oficiales en knowledge_entries
--
-- Que hace: agrega a public.knowledge_entries las columnas necesarias para
-- que cada entrada pueda declarar, de forma estructurada, que articulos
-- NEC/TDLR/AHJ respaldan la respuesta, enlaces de verificacion oficiales y
-- notas de aplicacion practica en campo. No copia el texto oficial: solo
-- guarda numeros de articulo/seccion, URLs oficiales y resumenes propios.
--
-- Seguro volver a ejecutar (usa "add column if not exists").

alter table public.knowledge_entries add column if not exists nec_articles text[];
alter table public.knowledge_entries add column if not exists tdlr_references text[];
alter table public.knowledge_entries add column if not exists ahj_references text[];
alter table public.knowledge_entries add column if not exists source_urls text[];
alter table public.knowledge_entries add column if not exists source_last_checked_at timestamptz;
alter table public.knowledge_entries add column if not exists applies_when text;
alter table public.knowledge_entries add column if not exists does_not_apply_when text;
alter table public.knowledge_entries add column if not exists field_notes text;
alter table public.knowledge_entries add column if not exists verification_steps text[];
alter table public.knowledge_entries add column if not exists official_reference text;
