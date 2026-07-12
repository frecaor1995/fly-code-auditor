# Fly Code Auditor

Asistente tecnico interno bilingue (ES/EN) de **Fly Electric Solutions LLC** para consultas
sobre NEC, seguridad electrica, inspecciones, permisos, paneles, breakers, GFCI/AFCI,
grounding/bonding, EV chargers, conduit fill, box fill, load calculation, troubleshooting y
revision preliminar de planos electricos.

> **Este sistema NO reemplaza al Master Electrician, al ingeniero diseñador, al inspector ni
> a la autoridad local (AHJ).** Toda respuesta es una revision preliminar de apoyo interno.

## MVP actual (modo local / sin API keys)

Esta version corre **sin necesidad de crear cuentas ni pagar ninguna API** si no defines
`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`:

- **Base de datos**: si Supabase esta configurado (ver "Conectar Supabase" abajo), es la
  fuente de verdad para proyectos, consultas y revisiones. Si NO esta configurado, la app usa
  automaticamente los archivos JSON locales en `data/` (modo demo, igual que antes). En
  Vercel, **Supabase es obligatorio** para que "Nueva consulta" y el historial funcionen: el
  filesystem del bundle es de solo lectura fuera de `/tmp`, asi que escribir en `data/*.json`
  en produccion no persiste nada entre peticiones.
- **Storage de archivos** (planos PDF/JPG/PNG): disco local en `storage/uploads/` (no
  migrado a Supabase Storage todavia; ver limitaciones abajo).
- **IA**: motor de reglas local (`lib/ai/mockAssistant.ts`, `lib/knowledge/electricalKnowledgeBase.ts`
  y `mockPlanAnalyzer.ts`) que sigue el formato bilingue obligatorio de 9 bloques y NUNCA
  inventa articulos NEC ni contenido de planos que no puede leer. No depende de Supabase ni
  de OpenAI: la respuesta siempre se genera localmente, y el guardado en Supabase es un paso
  aparte que nunca bloquea la respuesta (ver `app/api/queries/route.ts`).
- **Voz**: Web Speech API del navegador (Chrome/Edge en escritorio y Android). Si el
  navegador no la soporta, se muestra un aviso y se recomienda usar texto.

Todo esto vive detras de interfaces (`lib/db/dbAdapter.ts`, `lib/storage`, `lib/ai`) para que
conectar OpenAI real despues siga siendo un cambio de configuracion, no una reescritura.

## Conectar Supabase

Reemplaza el almacenamiento JSON local (`data/queries.json`, `data/projects.json`,
`data/reviews.json`, `data/plans.json`) por Supabase/PostgreSQL para que la app funcione
correctamente en Vercel.

1. Crea un proyecto en [supabase.com](https://supabase.com) (plan gratuito alcanza para esto).
2. Abre el **SQL Editor** del proyecto, pega el contenido completo de
   [`supabase/schema.sql`](supabase/schema.sql) y ejecutalo. Crea las tablas `app_users`,
   `projects`, `queries`, `plan_uploads`, `reviews` y `knowledge_entries`, mas el seed de los
   5 usuarios demo. Es seguro volver a ejecutarlo (usa `if not exists` / `on conflict do
   nothing`).
3. En **Project Settings → API**, copia:
   - **Project URL** → variable `SUPABASE_URL`
   - **service_role key** (seccion "Project API keys", NO la `anon public`) → variable
     `SUPABASE_SERVICE_ROLE_KEY`
4. Localmente: copia `.env.example` a `.env.local` y pega ahi ambos valores.
5. En Vercel: **Project Settings → Environment Variables**, agrega `SUPABASE_URL` y
   `SUPABASE_SERVICE_ROLE_KEY` (Production y Preview), y haz **Redeploy**.

**Importante:** `SUPABASE_SERVICE_ROLE_KEY` tiene permisos completos sobre la base de datos.
Nunca la agregues con el prefijo `NEXT_PUBLIC_` (eso la expondria al navegador) y nunca la
uses fuera de codigo server-side (`lib/db/supabaseServer.ts`, API routes, Server Components).
Las tablas se crean con Row Level Security activado y sin policies: solo el cliente
server-side con la service role key puede leer/escribir (bypassa RLS por diseno); cualquier
intento accidental con la anon key desde el navegador queda bloqueado.

**Que pasa si no configuras Supabase:** la app sigue funcionando en modo demo 100% local
(igual que antes de esta migracion), leyendo y escribiendo en `data/*.json`. Es la forma mas
rapida de probar la app sin crear una cuenta, pero en Vercel esas escrituras no persisten
entre peticiones (filesystem de solo lectura), por eso Supabase es obligatorio en produccion.

**Autenticacion:** el login demo (contrasena `demo1234`) sigue validandose contra
`data/users.json`, no contra Supabase. La tabla `app_users` sembrada por el schema es la base
para migrar a Supabase Auth mas adelante, pero eso no es parte de este cambio.

**Base de conocimiento electrica:** `lib/knowledge/electricalKnowledgeBase.ts` sigue siendo
la fuente real de las respuestas tecnicas (NEC 517, GFCI, EV chargers, etc.), no Supabase. La
tabla `knowledge_entries` queda creada y lista para una migracion futura de ese contenido; por
ahora `lib/db/dbAdapter.ts` la consulta primero y cae automaticamente a la base local mientras
la tabla este vacia.

## Requisitos

- Node.js 18 o superior
- npm

## Como correr el proyecto

```bash
cd fly-code-auditor
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador (o en el celular usando
la IP de tu red local, ej. `http://192.168.1.50:3000`).

## Usuarios de prueba (demo)

Todos con contrasena `demo1234`:

| Rol | Correo |
|---|---|
| Owner / Admin | admin@flyelectric.com |
| Master Electrician | master@flyelectric.com |
| Tecnico | tecnico@flyelectric.com |
| Ayudante | ayudante@flyelectric.com |
| Oficina / Administrativo | oficina@flyelectric.com |

**Estos usuarios y contrasenas en texto plano son solo para demo local.** Antes de usar la
app con datos reales de clientes, hay que migrar la autenticacion a un proveedor real
(Supabase Auth, Firebase Auth, Auth.js) con contrasenas hasheadas.

## Como conectar servicios reales despues

1. Copia `.env.example` a `.env.local`.
2. Para persistencia real: sigue "Conectar Supabase" arriba.
3. Para usar IA real: agrega `OPENAI_API_KEY`, pon `USE_MOCK_AI=false`. El analisis con
   vision (imagenes JPG/PNG de planos) queda conectado automaticamente
   (`lib/ai/openaiAssistant.ts`); el analisis de PDFs con vision real requiere aun convertir
   paginas a imagen (no incluido en este MVP).
4. Pendiente (no incluido en esta migracion): subir planos (PDF/JPG/PNG) todavia se guarda en
   `storage/uploads/` (disco local), que en Vercel tampoco persiste en produccion. El
   siguiente paso logico es moverlo a Supabase Storage; `lib/storage/localFileStorage.ts` ya
   expone las firmas de funcion pensadas para ese swap.
5. Para autenticacion real: sustituye `lib/auth/session.ts` por Supabase Auth / Firebase
   Auth / Auth.js, manteniendo `getCurrentUser()` como punto de entrada usado en toda la app.
   La tabla `app_users` (ver `supabase/schema.sql`) ya tiene los usuarios demo sembrados.

## Estructura del proyecto

```
app/                  Rutas y pantallas (Next.js App Router)
  login/               Pantalla de login
  (app)/               Rutas protegidas (dashboard, consulta, planos, historial, proyectos,
                       revision-master, reportes, configuracion, base-conocimiento)
  api/                 Endpoints (auth, projects, queries, plans, reviews, uploads)
components/            Componentes de UI reutilizables (nav, assistant, plans, projects, etc.)
lib/
  auth/                Sesion, permisos por rol (sigue usando data/users.json)
  db/                  dbAdapter.ts (Supabase con fallback local) + supabaseServer.ts +
                       repos/ (JSON local, usado como fallback y para lo aun no migrado)
  knowledge/           Base de conocimiento electrica (NEC 517, GFCI, EV chargers, etc.)
  ai/                  Prompts internos + motor mock + adaptador OpenAI real
  storage/             Guardado de archivos subidos (local, no migrado a Supabase todavia)
  i18n/                Diccionario ES/EN y hook de idioma
  utils/               Utilidades (riesgo, fechas, exportar resumen)
data/                  Archivos JSON semilla; fallback cuando Supabase no esta configurado
storage/uploads/       Planos subidos (PDF/JPG/PNG)
supabase/schema.sql    Esquema SQL para crear las tablas en un proyecto Supabase
```

## Formato obligatorio de respuesta del asistente

Cada respuesta del asistente (mock o real) sigue siempre esta estructura, reforzada en el
componente `components/assistant/AssistantResponseCard.tsx` (la advertencia final se muestra
siempre, sin depender de que el modelo la incluya):

1. Respuesta corta
2. English summary (si aplica)
3. Nivel de riesgo (bajo / medio / alto / critico)
4. Codigo o norma relacionada (NEC 2023 Texas cuando aplique, o mensaje de verificar con AHJ)
5. Lectura del plano (si aplica): hoja, simbolos, equipos, paneles, circuitos, notas,
   informacion faltante
6. Checklist de revision
7. Preguntas faltantes
8. Recomendacion
9. Advertencia: esta es una revision preliminar; la aprobacion final es del Master
   Electrician, el diseñador, el inspector y la AHJ.

Si el riesgo es **alto** o **critico**, la consulta se marca automaticamente como
"requiere revision del Master" (regla de negocio en `app/api/queries/route.ts`).

## Seguridad, privacidad y limites legales

- **No es una aprobacion oficial**: ninguna respuesta del sistema constituye aprobacion
  final de un trabajo electrico, permiso o inspeccion.
- **No inventa codigo NEC**: cuando no esta seguro del articulo exacto, el sistema pide
  verificar con el NEC oficial, el Master Electrician o la AHJ.
- **No adivina contenido de planos**: si un plano esta borroso, incompleto o de baja
  resolucion, el sistema lo dice explicitamente en vez de inventar simbolos o equipos.
- **Datos de clientes**: sin Supabase configurado, los datos quedan en archivos JSON en la
  maquina donde corre la app; no subas esa carpeta `data/` a repositorios publicos ni la
  compartas fuera de la red interna. Con Supabase configurado, los datos viven en tu proyecto
  Supabase (protegido por RLS + service role key server-side); revisa los permisos de acceso
  al dashboard de Supabase con el mismo criterio que le darias a una base de datos de clientes.
- **Autenticacion demo**: las contrasenas en `data/users.json` estan en texto plano
  unicamente para esta primera version local. Reemplazar antes de exponer la app fuera de
  un entorno controlado.
- **Escalamiento obligatorio**: trabajos de alto riesgo (servicio principal, paneles,
  feeders, EV chargers, grounding/bonding, riesgo de incendio o choque electrico) siempre
  deben escalarse al Master Electrician antes de ejecutar o cotizar.
- **Dependencia Next.js**: este MVP usa Next.js 14.2.x (LTS de esta linea, `npm audit`
  reporta advisories ya corregidos en versiones posteriores de la propia rama 14.2, y
  advisories adicionales que solo se resuelven saltando a Next 16, un cambio mayor con
  breaking changes). Mientras la app corra solo en la red interna, el riesgo es bajo; antes
  de exponerla a internet o a datos sensibles de clientes, evaluar y probar el upgrade a la
  ultima version estable de Next.js.
