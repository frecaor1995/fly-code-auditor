import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./tests/mocks/server";

// Global para toda la suite unit/integration/regression:
// - cleanup() desmonta cualquier componente RTL montado en el test anterior
//   (evita fugas de estado/DOM entre tests de componentes).
// - restoreMocks/unstubEnvs/unstubGlobals ya se configuran en vitest.config.ts
//   (test.restoreMocks/unstubEnvs/unstubGlobals), asi que no se repiten aqui.
// - El servidor MSW se levanta una vez para toda la suite; "bypass" en
//   onUnhandledRequest evita que un test que no usa MSW falle solo por no
//   registrar handlers (server.use se llama solo en los tests que
//   efectivamente necesitan simular una respuesta HTTP, ej. Gemini).
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
