import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Config de Vitest para unit/integration/regression (NO e2e: eso es
// Playwright, ver playwright.config.ts; NO live: ver vitest.live.config.ts,
// que solo corre bajo demanda con npm run test:live).
//
// resolve.tsconfigPaths reusa el alias "@/*" ya definido en tsconfig.json en
// vez de duplicarlo aqui (evita que los dos queden desincronizados).
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.ts", "tests/regression/**/*.test.ts"],
    exclude: ["tests/e2e/**", "tests/live/**", "node_modules/**"],
    // Cada test debe poder correr solo, sin depender de estado dejado por
    // otro test: mocks y env stubs se restauran automaticamente despues de
    // cada test.
    restoreMocks: true,
    clearMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    testTimeout: 10000,
    coverage: {
      // HALLAZGO DE HERRAMIENTAS (documentado, no resuelto por completo):
      // al correr la suite completa (muchos archivos de test juntos),
      // lib/knowledge/matchEngine.ts y electricalKnowledgeBase.ts (968
      // lineas, un array de objetos muy grande) quedan mal medidos en el
      // reporte de cobertura combinado - con provider "v8" desaparecian por
      // completo; con "istanbul" (el actual) a veces aparecen truncados a
      // una fraccion minuscula del archivo real (ej. "2 de 2 lineas: 100%"
      // para un archivo de 968 lineas), mostrando 100% de forma enganosa.
      // Confirmado NO es un problema de mocks propios (se probo quitando
      // vi.importActual de todos los mocks que tocaban esos modulos, sin
      // cambios), ni de cache de Vite, ni del pool (threads/forks), ni de
      // test.isolate. Cada archivo de test, corrido en aislamiento o en
      // combinaciones pequenas, SI mide estos dos archivos correctamente
      // (ver docs/TESTING.md#como-interpretar-la-cobertura para los
      // numeros reales verificados). Por esto, matchEngine.ts NO tiene un
      // umbral critico por-archivo aqui abajo (se removio: no se puede
      // confiar en la medicion de "npm run test:coverage" para ese archivo
      // especifico todavia) - se debe verificar con el comando scoped que
      // documenta TESTING.md hasta que se resuelva esta limitacion de
      // Vitest/istanbul.
      provider: "istanbul",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      // El "Paso 2" (esta suite) tiene un alcance explicito: el subsistema
      // de consultas tecnicas (matching, clasificacion de intencion,
      // proveedores de IA, la ruta de consultas, autenticacion,
      // trazabilidad, AssistantResponseCard). NO cubre otros modulos del
      // repo construidos en otras iniciativas (carga de planos, catalogo
      // de simbolos, gestion de proyectos, storage) que nunca formaron
      // parte de esta tarea y no tienen pruebas escritas para ellos aqui.
      // El include se acota a ese alcance real en vez de dejarlo amplio y
      // con umbrales globales que nunca podrian cumplirse honestamente
      // (ver docs/TESTING.md#como-interpretar-la-cobertura). Esto NO es
      // "excluir archivos criticos para inflar el porcentaje": los
      // archivos criticos del alcance real (matchEngine, providers, la
      // ruta de consultas) tienen umbrales MAS estrictos que el global, no
      // menos (ver mas abajo).
      include: [
        "lib/knowledge/matchEngine.ts",
        "lib/knowledge/electricalKnowledgeBase.ts",
        "lib/ai/intentClassifier.ts",
        "lib/ai/mockAssistant.ts",
        "lib/ai/localFallback.ts",
        "lib/ai/index.ts",
        "lib/ai/providers/**",
        "lib/utils/resilience.ts",
        "lib/auth/session.ts",
        "lib/auth/permissions.ts",
        "app/api/queries/route.ts",
        "components/assistant/AssistantResponseCard.tsx"
      ],
      exclude: ["**/*.d.ts", "**/*.config.*", "lib/ai/prompts/**", "**/node_modules/**"],
      thresholds: {
        statements: 80,
        lines: 80,
        functions: 80,
        branches: 75,
        // Umbrales criticos mas exigentes (FASE I del pedido): los
        // proveedores de IA, la ruta de consultas y la validacion de
        // AssistantResponse (vive en lib/ai/providers/shared.ts) no pueden
        // esconder ramas sin cubrir detras del promedio global. Ver el
        // comentario arriba de "provider: istanbul" sobre por que
        // lib/knowledge/matchEngine.ts NO tiene un umbral aqui (limitacion
        // de medicion confirmada, no falta de pruebas: ver TESTING.md).
        "lib/ai/providers/**": { lines: 90, branches: 85 },
        "app/api/queries/route.ts": { lines: 90, branches: 85 }
      }
    }
  }
});
