# Testing — Fly Code Auditor

Infraestructura de pruebas automáticas, regresión y control de calidad ("Paso 2" del proyecto). Objetivo: ningún cambio futuro puede publicarse si rompe consultas técnicas, selección de proveedor, fallback validado, clasificación por categorías, referencias técnicas, trazabilidad, estructura de respuestas, autenticación o la interfaz de consulta.

## Arquitectura de pruebas

| Capa | Herramienta | Qué corre | Llamadas reales |
|---|---|---|---|
| Unit | Vitest (`environment: node`, jsdom por archivo vía `// @vitest-environment jsdom`) | `lib/`, componentes React (RTL) | Nunca |
| Integration | Vitest | `app/api/queries/route.ts` invocado directamente, con `@/lib/auth/session`, `@/lib/db/dbAdapter`, `geminiProvider`, `openaiAssistant` mockeados | Nunca |
| Regression | Vitest | 46 casos técnicos + seguridad contra `mockAskAssistant` (motor local real) | Nunca |
| E2E | Playwright, contra `next build` + `next start` | Login, consulta, dashboard, historial, móvil | Nunca (ver abajo) |
| Live | Vitest (config separada) | Smoke test contra un despliegue real | **Sí, deliberado** — solo bajo demanda |

Todas las capas salvo `live` corren en cada `npm run quality` / CI. `live` nunca corre automáticamente.

### Cómo se evita cualquier llamada real en CI

- **Vitest**: Gemini se simula con MSW (`tests/mocks/geminiHandlers.ts`) interceptando `https://generativelanguage.googleapis.com/*`. Ningún test de unit/integration/regression llama a Gemini/OpenAI/Supabase reales.
- **Playwright**: el servidor E2E (`playwright.config.ts`, `webServer.env`) corre con `AI_PROVIDER=gemini` y `GEMINI_API_KEY=""`. `geminiAskAssistant` revisa la key **antes** de cualquier `fetch()` y devuelve `missing_api_key` de forma síncrona — esto ejercita el camino real de fallback al motor local de punta a punta, sin tocar la red. Es más fiel a producción que forzar `USE_MOCK_AI=true`, y cubre el escenario de "fallback simulado" en todos los tests E2E, no solo en uno dedicado.
- Supabase no está configurado en ningún entorno de prueba: la app se degrada automáticamente a los archivos JSON locales de `data/` (comportamiento ya existente, no específico de esta suite).

## Comandos

```bash
npm run typecheck        # tsc --noEmit
npm run test:unit        # tests/unit
npm run test:integration # tests/integration
npm run test:regression  # tests/regression
npm run test             # unit + integration + regression juntos
npm run test:coverage    # igual que arriba + reporte + umbrales de cobertura
npm run test:e2e         # Playwright (build + start automático)
npm run test:e2e:ui      # Playwright en modo UI interactivo
npm run test:ci          # typecheck + test:coverage
npm run test:live        # smoke test real (ver abajo, requiere env vars)
npm run quality          # lint (si existe) -> typecheck -> unit -> integration -> regression -> build
```

`npm run quality` es el pipeline que debe pasar antes de mergear. No incluye E2E ni coverage por diseño (son pasos aparte, más lentos); CI los corre después en el mismo job.

### Lint

El proyecto no tiene ESLint instalado/configurado (no hay `.eslintrc*`/`eslint.config.*` ni el paquete `eslint`). `npm run quality` invoca `scripts/runLintIfConfigured.js`, que detecta esto y omite el paso con un mensaje claro en vez de fallar o intentar un setup interactivo de `next lint` (que se cuelga en un entorno no interactivo como CI). Si en el futuro se instala y configura ESLint, este script empieza a correrlo de verdad y a propagar su exit code.

## Qué simula cada suite

- **`tests/unit/matchEngine.test.ts`**: motor de matching genérico (`lib/knowledge/matchEngine.ts`) con fixtures sintéticas — pesos, gates de categoría, negación, deduplicación, las 15 categorías de `MatchCategory`.
- **`tests/unit/knowledgeBase.test.ts`**: lo mismo pero contra el contenido real de `lib/knowledge/electricalKnowledgeBase.ts`.
- **`tests/unit/contradictions.test.ts`**: pares mutuamente excluyentes (residencial/hospital, feeder/service, interior/exterior, húmedo/mojado, cobre/aluminio, panel principal/subpanel) y que "no usar X" nunca se lee como pedir X.
- **`tests/unit/intentClassifier.test.ts`**: clasificación técnica/meta/general, prioridad de lo técnico sobre lo meta, y el vocabulario ampliado (cable, TDLR, licencia, iluminación, residencial).
- **`tests/unit/assistantResponseValidation.test.ts`**: `parseAssistantJson` (`lib/ai/providers/shared.ts`) — JSON inválido, esquema incompleto, respuestas vacías, campos inventados.
- **`tests/unit/providerErrors.test.ts`**: `classifyProviderError`/`safeErrorMessage`/`withTimeout` (`lib/utils/resilience.ts`), timeout determinista con fake timers.
- **`tests/unit/geminiProvider.test.ts`**: `geminiAskAssistant`/`pingGemini` contra MSW — éxito, timeout, 400/401/403/404/429, JSON inválido a dos niveles, `schema_validation_failed`, red caída, y que la API key nunca se expone.
- **`tests/unit/criticalRules.feeder200A.test.ts`** / **`criticalRules.exteriorReceptacles.test.ts`**: invariantes técnicos críticos (NEC 310.12 condicionado, 4/0 Al vs 250 kcmil Al no intercambiables, caída de voltaje sin datos inventados, GFCI/WR/cubierta condicionada, healthcare bloqueado).
- **`tests/unit/AssistantResponseCard.test.tsx`**: React Testing Library — trazabilidad de proveedor, nunca muestra a Gemini como autor cuando falló, idiomas, contenido extenso, accesibilidad básica.
- **`tests/unit/meta/testHygiene.test.ts`**: guardas de FASE K (ver más abajo).
- **`tests/integration/queriesRoute.test.ts`**: `app/api/queries/route.ts` de punta a punta — auth, Gemini éxito/timeout/400/429/JSON inválido, Supabase disponible/caído, límite de longitud (`MAX_QUERY_LENGTH`), idiomas, guardado exitoso/fallido, `AI_PROVIDER=gemini` nunca llama OpenAI, nunca expone secretos.
- **`tests/regression/technicalRegression.test.ts`**: 46 casos fijos (`tests/fixtures/technical-regression-cases.ts`) contra el motor local real.
- **`tests/e2e/*.spec.ts`**: login, consulta (envío, carga, trazabilidad, idiomas, fallback, error de servidor, persistencia), dashboard, móvil.
- **`tests/live/liveSmoke.live.test.ts`**: health check y una consulta real contra un despliegue real.

## Cómo añadir un caso de regresión

Editar `tests/fixtures/technical-regression-cases.ts` y agregar un objeto `TechnicalRegressionCase`:

```ts
{
  id: "categoria-NN",             // único en todo el archivo
  category: "feeders_subpanels",  // agrupa el reporte, no es la matchCategory interna
  language: "es",                 // "es" | "en" | "bilingual"
  question: "...",
  requiredTerms: [],              // deben aparecer en shortAnswer+checklist+missingQuestions+recommendation
  forbiddenTerms: [],              // nunca deben aparecer
  requiredReferences: [],          // deben aparecer en codeReference (ej. "310.12")
  forbiddenReferences: [],         // nunca en codeReference
  expectedIntent: "technical_electrical", // ver classifyIntent
  expectedActualProvider: "mock", // siempre "mock": esta suite llama a mockAskAssistant directo
  mustAskForMissingData: true,    // missingQuestions.length > 0 esperado
  notes: "..."
}
```

Reglas:
- **Nunca comparar el párrafo completo.** Los invariantes son la unidad de verdad; si la redacción cambia pero la garantía de seguridad se preserva, el caso debe seguir pasando.
- Antes de fijar `forbiddenTerms`, revisar el texto real de la entrada: una frase segura como "NO son intercambiables" o "sin contexto hospitalario" puede contener por accidente la subcadena que se quería prohibir. Usar `npx vitest run tests/regression/technicalRegression.test.ts -t "<id>"` para ver el texto completo cuando falle.
- Si una pregunta no alcanza el score mínimo del motor (`MINIMUM_SCORE = 2` en `matchEngine.ts`), cae a la respuesta fija "unverified" — normalmente hay que agregar una segunda keyword real de la entrada objetivo, no bajar expectativas.

## Cómo interpretar la cobertura

`npm run test:coverage` genera `coverage/` (HTML navegable en `coverage/index.html`, y `lcov.info`/`coverage-summary.json` para herramientas externas). Umbrales (`vitest.config.ts`):

| Alcance | statements | lines | functions | branches |
|---|---|---|---|---|
| Global | 80% | 80% | 80% | 75% |
| `lib/ai/providers/**` | — | 90% | — | 85% |
| `app/api/queries/route.ts` | — | 90% | — | 85% |

Si `test:coverage` falla por umbral, Vitest imprime exactamente qué archivo/línea/rama quedó sin cubrir. Nunca bajar el umbral para "hacer pasar" el pipeline: agregar el caso de prueba que falte, o si el código es genuinamente inalcanzable (ej. una rama de defensa que nunca debería ejecutarse en la práctica), evaluarlo caso por caso con el equipo antes de excluirlo.

### Limitación conocida: `lib/knowledge/matchEngine.ts` y `electricalKnowledgeBase.ts`

Estos dos archivos (el segundo tiene 968 líneas, con un array de objetos muy grande) **no tienen un umbral crítico por-archivo** en `vitest.config.ts`, a diferencia de los otros archivos críticos. No es porque falten pruebas — `tests/unit/matchEngine.test.ts`, `knowledgeBase.test.ts`, `contradictions.test.ts` y los dos `criticalRules.*.test.ts` los cubren extensamente — sino por un bug de herramientas confirmado: al correr la suite completa (muchos archivos de test en la misma corrida), el reporte de cobertura combinado de Vitest 4.1.10 mide mal estos dos archivos. Con el provider `v8` desaparecían por completo del reporte; con `istanbul` (el actual) a veces aparecen truncados a una fracción mínima del archivo real, mostrando un 100% engañoso. Se descartaron como causa: mocks propios del proyecto (se probó quitando todo `vi.importActual` que tocara estos módulos, sin cambios), el pool de workers (`threads` vs `forks`), `test.isolate`, y la caché de Vite.

**Números reales verificados** (corriendo cada archivo de test en aislamiento, donde la medición SÍ es confiable):

| Test file (solo) | `matchEngine.ts` lines | `matchEngine.ts` branches |
|---|---|---|
| `matchEngine.test.ts` | 100% | 89.28% |
| `knowledgeBase.test.ts` | 97.5% | 92.85% |
| `contradictions.test.ts` | 97.5% | 85.71% |

Como distintos archivos de test ejercitan ramas distintas, la cobertura real combinada de los 5 archivos que tocan este módulo es, con alta confianza, igual o mayor a la mejor cifra individual de la tabla — muy por encima del umbral de 90%/85% usado en el resto de archivos críticos. Para verificar esto manualmente:

```bash
npx vitest run tests/unit/matchEngine.test.ts --coverage
npx vitest run tests/unit/knowledgeBase.test.ts --coverage
```

Este hallazgo queda documentado como pendiente de investigación con una versión más nueva de Vitest/`@vitest/coverage-istanbul`, no como un umbral bajado para inflar el porcentaje.

## Cómo ejecutar Playwright

```bash
npm run test:e2e        # headless, reconstruye y levanta next start automáticamente
npm run test:e2e:ui     # modo UI interactivo (útil para depurar un test)
npx playwright show-report  # abre el ultimo reporte HTML generado
```

El servidor E2E corre en el puerto `3100` por defecto (`PLAYWRIGHT_PORT`). `tests/e2e/auth.setup.ts` inicia sesión una vez con el usuario demo `tecnico@flyelectric.com` (ya versionado en `data/users.json`, no es una cuenta personal ni una credencial nueva) y guarda el `storageState` en `playwright/.auth/tecnico.json` (gitignored); el resto de los specs lo reutilizan, excepto `auth.spec.ts`, que resetea el estado explícitamente para probar el login real.

**Navegadores**: Chromium es obligatorio y corre siempre. Firefox y WebKit están definidos pero deshabilitados por defecto — se habilitan con `PLAYWRIGHT_ALL_BROWSERS=1 npx playwright test`. Decisión documentada: instalar y correr los 3 motores de forma estable no está garantizado en cualquier runner (dependencias de sistema de WebKit en Linux, tiempo de instalación en el primer run); esto no bloquea la entrega. Habilitarlos en CI implica agregar `PLAYWRIGHT_ALL_BROWSERS=1` al step de `npx playwright install --with-deps` y al de `npm run test:e2e` en `.github/workflows/quality.yml`.

En sandboxes sin acceso de red para descargar el Chromium propio de Playwright, `PLAYWRIGHT_CHROME_CHANNEL=1 npx playwright test` reutiliza el Chrome del sistema (`channel: "chrome"`) en vez de intentar la descarga. Esto es solo para verificación local puntual — CI usa siempre el Chromium gestionado por Playwright (el path recomendado).

## Cómo ejecutar `test:live`

```bash
LIVE_TEST_BASE_URL=https://tu-deploy.example.com \
LIVE_TEST_EMAIL=usuario@dominio.com \
LIVE_TEST_PASSWORD='...' \
ALLOW_LIVE_AI_TESTS=true \
npm run test:live
```

`scripts/runLiveTests.js` verifica las 4 variables **antes** de invocar Vitest; si falta alguna, imprime cuáles y sale con código 0 (no falla el pipeline, simplemente omite la suite). Nunca se ejecuta automáticamente en `pull_request` — solo vía el job `live-smoke` de GitHub Actions, disparado manualmente (`workflow_dispatch`) y solo si los secrets están configurados en el repo.

Pruebas incluidas (limitadas a 2 llamadas HTTP reales, una consulta técnica):
1. `GET /api/health/ai-providers` — `selectedProvider=gemini`, `geminiConfigured=true`, `geminiReachable=true`.
2. Una consulta técnica controlada — HTTP exitoso, respuesta no vacía, trazabilidad presente, sin secretos en el body.

### Variables/secrets requeridos para live

| Variable | Dónde vive en CI | Descripción |
|---|---|---|
| `LIVE_TEST_BASE_URL` | GitHub Secret (environment `live-smoke`) | URL del despliegue real a probar |
| `LIVE_TEST_EMAIL` | GitHub Secret | Usuario de prueba con permiso `query.create` |
| `LIVE_TEST_PASSWORD` | GitHub Secret | Contraseña del usuario de prueba |
| `ALLOW_LIVE_AI_TESTS` | Fijo en el workflow (`"true"`) | Confirmación explícita de que se autorizan llamadas reales/con costo |

## Cómo investigar un fallo

1. **Unit/integration/regression**: `npx vitest run <archivo> -t "<nombre del test>"` para aislarlo. El mensaje de `expect(..., "mensaje")` en la mayoría de los tests de esta suite ya indica qué invariante falló y por qué.
2. **Gemini/provider**: revisar `tests/mocks/geminiHandlers.ts` — confirmar que el escenario mockeado corresponde al código HTTP/`googleStatus` que se espera clasificar.
3. **E2E**: `npx playwright show-report` después de una corrida fallida muestra screenshot + trace + video (solo se generan en fallo). `npx playwright test --debug <archivo>` para modo paso a paso.
4. **Cobertura**: `coverage/index.html` señala línea por línea qué quedó sin ejecutar.
5. Antes de "arreglar" cualquier test cambiando una expectativa, confirmar primero si el fallo revela un defecto real de producción (ver política abajo) o un error en el propio fixture/test (wording de `forbiddenTerms`, empates de score, locators ambiguos en Playwright — todos casos reales encontrados y documentados durante la construcción de esta suite).

## Política de no llamadas reales en CI

Ningún test de `unit`/`integration`/`regression`/`e2e` puede hacer una llamada de red real a Gemini, OpenAI o Supabase. Esto se garantiza en 3 niveles distintos (no uno solo):
- Vitest: MSW intercepta cualquier request a `generativelanguage.googleapis.com`; el resto de dependencias externas (`@/lib/db/dbAdapter`, `@/lib/auth/session`) se mockean con `vi.mock`.
- Playwright: el servidor E2E nunca tiene una `GEMINI_API_KEY` real ni Supabase configurado.
- `test:live` es la única excepción deliberada, y está aislada en su propio `vitest.live.config.ts`, su propio script de precondición, y nunca se incluye en `vitest.config.ts` ni en `npm run quality`.

## Criterios para aprobar una versión

Una versión solo se considera lista para mergear cuando, **desde cero**:

1. `npm run typecheck` — 0 errores.
2. `npm run test:unit` — 0 fallos.
3. `npm run test:integration` — 0 fallos.
4. `npm run test:regression` — 0 fallos (los 46 casos, incluyendo los de seguridad).
5. `npm run test:coverage` — todos los umbrales (globales y por archivo crítico) superados.
6. `npm run build` — compila sin errores.
7. `npm run test:e2e` — 0 fallos en Chromium (obligatorio).
8. `npm run quality` — pasa de punta a punta.
9. Sin `.only`/`.skip` sin justificar en ningún archivo de prueba (`tests/unit/meta/testHygiene.test.ts` lo verifica automáticamente).
10. Ningún secreto (API key, token, contraseña) expuesto en logs, respuestas HTTP, o código fuente versionado.
11. Si el cambio tocó `lib/ai/`, `lib/knowledge/`, o `app/api/queries/route.ts`: la regresión hospital/residencial y el caso del feeder de 200A (`tests/unit/criticalRules.*.test.ts`, casos `healthcare-01` y `residential-no-healthcare-01` de la suite de regresión) deben seguir pasando sin modificar sus expectativas.

Nunca declarar una entrega completa si alguna de estas pruebas o el build falla. Un fallo real de producción se corrige en la causa (código de producción), no ajustando el test hasta que pase — la única excepción es cuando el propio test/fixture tiene un error (wording incorrecto, locator ambiguo, expectativa mal calculada), en cuyo caso se corrige el test y se documenta por qué en el mensaje de commit o en un comentario junto al caso.
