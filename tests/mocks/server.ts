import { setupServer } from "msw/node";

// Servidor MSW compartido por toda la suite (unit/integration/regression).
// Sin handlers por defecto: cada test que necesite simular una respuesta
// HTTP (ej. Gemini) los agrega con server.use(...) y vitest.setup.ts los
// limpia despues de cada test (server.resetHandlers()), para que ningun
// test dependa de handlers dejados por otro.
export const server = setupServer();
