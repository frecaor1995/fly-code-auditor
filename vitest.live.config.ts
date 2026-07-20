import { defineConfig } from "vitest/config";

// Config separada para la suite "live" (FASE H del pedido): pruebas reales
// contra un despliegue real (LIVE_TEST_BASE_URL) con IA real habilitada
// (ALLOW_LIVE_AI_TESTS=true). NUNCA se incluye en vitest.config.ts ni en
// "npm run quality"/CI normal: solo se invoca via "npm run test:live", que a
// su vez (ver scripts/runLiveTests.js) verifica las 4 variables requeridas
// ANTES de siquiera arrancar Vitest con esta config.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/live/**/*.live.test.ts"],
    testTimeout: 30000,
    // Sin coverage: esta suite mide disponibilidad real, no cobertura de
    // codigo, y no debe influir en los umbrales de FASE I.
    coverage: { enabled: false }
  }
});
