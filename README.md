# Fly Code Auditor

Asistente tecnico interno bilingue (ES/EN) de **Fly Electric Solutions LLC** para consultas
sobre NEC, seguridad electrica, inspecciones, permisos, paneles, breakers, GFCI/AFCI,
grounding/bonding, EV chargers, conduit fill, box fill, load calculation, troubleshooting y
revision preliminar de planos electricos.

> **Este sistema NO reemplaza al Master Electrician, al ingeniero diseñador, al inspector ni
> a la autoridad local (AHJ).** Toda respuesta es una revision preliminar de apoyo interno.

## MVP actual (modo local / sin API keys)

Esta primera version corre **100% en tu maquina, sin necesidad de crear cuentas ni pagar
ninguna API**:

- **Base de datos**: archivos JSON en `data/` (no una base real todavia).
- **Storage de archivos**: disco local en `storage/uploads/`.
- **IA**: motor de reglas local (`lib/ai/mockAssistant.ts` y `mockPlanAnalyzer.ts`) que sigue
  el formato bilingue obligatorio de 9 bloques y NUNCA inventa articulos NEC ni contenido de
  planos que no puede leer.
- **Voz**: Web Speech API del navegador (Chrome/Edge en escritorio y Android). Si el
  navegador no la soporta, se muestra un aviso y se recomienda usar texto.

Todo esto vive detras de interfaces (`lib/db`, `lib/storage`, `lib/ai`) para que conectar
Supabase y OpenAI reales despues sea un cambio de configuracion, no una reescritura.

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
2. Para usar IA real: agrega `OPENAI_API_KEY`, pon `USE_MOCK_AI=false`. El analisis con
   vision (imagenes JPG/PNG de planos) queda conectado automaticamente
   (`lib/ai/openaiAssistant.ts`); el analisis de PDFs con vision real requiere aun convertir
   paginas a imagen (no incluido en este MVP).
3. Para persistencia real y multiusuario: sustituye `lib/db/jsonStore.ts` y los repos en
   `lib/db/repos/` por llamadas a Supabase (o Firebase), y `lib/storage/localFileStorage.ts`
   por Supabase Storage. Las firmas de las funciones ya estan pensadas para ese swap.
4. Para autenticacion real: sustituye `lib/auth/session.ts` por Supabase Auth / Firebase
   Auth / Auth.js, manteniendo `getCurrentUser()` como punto de entrada usado en toda la app.

## Estructura del proyecto

```
app/                  Rutas y pantallas (Next.js App Router)
  login/               Pantalla de login
  (app)/               Rutas protegidas (dashboard, consulta, planos, historial, proyectos,
                       revision-master, reportes, configuracion, base-conocimiento)
  api/                 Endpoints (auth, projects, queries, plans, reviews, uploads)
components/            Componentes de UI reutilizables (nav, assistant, plans, projects, etc.)
lib/
  auth/                Sesion, permisos por rol
  db/                  "Base de datos" JSON + repositorios
  ai/                  Prompts internos + motor mock + adaptador OpenAI real
  storage/             Guardado de archivos subidos
  i18n/                Diccionario ES/EN y hook de idioma
  utils/               Utilidades (riesgo, fechas, exportar resumen)
data/                  Archivos JSON semilla (usuarios, proyectos, base de conocimiento, etc.)
storage/uploads/       Planos subidos (PDF/JPG/PNG)
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
- **Datos de clientes**: mientras el MVP corre en modo local (JSON + disco), los datos
  quedan en la maquina donde corre la app. No subas esta carpeta de datos a repositorios
  publicos ni la compartas fuera de la red interna de Fly Electric Solutions.
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
