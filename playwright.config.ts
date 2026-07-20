import { defineConfig, devices } from "@playwright/test";

// FASE G del pedido: E2E corre contra `next build` + `next start` (servidor
// de produccion local), nunca contra `next dev`. webServer.command incluye
// el build para que "npm run test:e2e" sea autosuficiente incluso si no se
// corrio "npm run build" antes (en CI, "npm run quality" ya lo corre antes,
// asi que el build de aqui reutiliza la cache de .next y es rapido).
//
// AI_PROVIDER=gemini SIN GEMINI_API_KEY (deliberado): geminiAskAssistant
// revisa la key ANTES de cualquier fetch (ver lib/ai/providers/geminiProvider.ts)
// y devuelve providerErrorCode="missing_api_key" de forma sincrona, sin
// tocar la red. Esto ejercita el camino REAL de fallback al motor local
// (app/api/queries/route.ts) de punta a punta contra el servidor de
// produccion real, sin ninguna llamada externa a Gemini/OpenAI/Supabase
// (que tampoco esta configurado aqui) - mas fiel a produccion que forzar
// USE_MOCK_AI=true, y es exactamente el escenario que pide FASE G #9
// ("fallback simulado").
const PORT = process.env.PLAYWRIGHT_PORT || "3100";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`;

// Decision documentada (FASE G): Chromium es obligatorio y siempre corre.
// Firefox y WebKit se habilitan solo si PLAYWRIGHT_ALL_BROWSERS=1, porque
// instalar y correr los 3 motores de forma estable no esta garantizado en
// cualquier runner/sandbox (dependencias de sistema de WebKit en Linux,
// tiempo de instalacion en el primer run). No bloquea esta entrega: ver
// docs/TESTING.md#playwright para como habilitarlos cuando el entorno lo
// soporte.
const ALL_BROWSERS = process.env.PLAYWRIGHT_ALL_BROWSERS === "1";

// Solo para verificacion local en entornos sin acceso de red para descargar
// el Chromium propio de Playwright (ej. este sandbox): reutiliza el Chrome
// del sistema via "channel". No se activa por defecto -CI usa el Chromium
// gestionado por Playwright, que es el path documentado/recomendado (ver
// docs/TESTING.md#playwright)-, asi que no afecta el comportamiento real de
// GitHub Actions.
const CHROME_OVERRIDE = process.env.PLAYWRIGHT_CHROME_CHANNEL ? { channel: "chrome" as const } : {};

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["html", { open: "never", outputFolder: "playwright-report" }], ["list"]],
  timeout: 30000,
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    // Proyecto de setup: inicia sesion UNA vez con un usuario de prueba
    // (tests/e2e/auth.setup.ts) y guarda el estado autenticado en disco.
    // Los demas proyectos lo reutilizan via storageState (mas rapido y mas
    // estable que repetir el login en cada spec), excepto auth.spec.ts, que
    // explicitamente resetea el storageState para probar el login real.
    { name: "setup", testMatch: /auth\.setup\.ts/, use: { ...CHROME_OVERRIDE } },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], ...CHROME_OVERRIDE, storageState: "playwright/.auth/tecnico.json" },
      dependencies: ["setup"]
    },
    ...(ALL_BROWSERS
      ? [
          {
            name: "firefox",
            use: { ...devices["Desktop Firefox"], storageState: "playwright/.auth/tecnico.json" },
            dependencies: ["setup"]
          },
          {
            name: "webkit",
            use: { ...devices["Desktop Safari"], storageState: "playwright/.auth/tecnico.json" },
            dependencies: ["setup"]
          }
        ]
      : []),
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], ...CHROME_OVERRIDE, storageState: "playwright/.auth/tecnico.json" },
      dependencies: ["setup"]
    }
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
    env: {
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "",
      SESSION_SECRET: "e2e-test-secret-do-not-use-in-prod"
    }
  }
});
