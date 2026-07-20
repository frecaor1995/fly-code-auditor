import { describe, it, expect } from "vitest";

// FASE H: smoke test REAL contra un despliegue real, con IA real. Este
// archivo SOLO se ejecuta via "npm run test:live" (scripts/runLiveTests.js
// verifica las 4 variables requeridas ANTES de invocar Vitest con esta
// config: ver vitest.live.config.ts). Nunca corre en "npm run quality" ni
// en pull_request de CI. Limitado a UNA sola consulta tecnica para evitar
// gasto/consumo de cuota innecesario.

const BASE_URL = process.env.LIVE_TEST_BASE_URL as string;
const EMAIL = process.env.LIVE_TEST_EMAIL as string;
const PASSWORD = process.env.LIVE_TEST_PASSWORD as string;

async function loginAndGetCookie(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });
  if (!res.ok) {
    throw new Error(`Login live fallo con status ${res.status}. Verifica LIVE_TEST_EMAIL/LIVE_TEST_PASSWORD.`);
  }
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("El login live no devolvio cookie de sesion.");
  return setCookie.split(";")[0];
}

describe("Live smoke: GET /api/health/ai-providers", () => {
  it("selectedProvider=gemini, geminiConfigured=true, geminiReachable=true", async () => {
    const cookie = await loginAndGetCookie();
    const res = await fetch(`${BASE_URL}/api/health/ai-providers`, {
      headers: { Cookie: cookie }
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.selectedProvider).toBe("gemini");
    expect(body.geminiConfigured).toBe(true);
    expect(body.geminiReachable).toBe(true);

    // Nunca debe exponer la API key ni ningun secreto en este endpoint.
    const bodyText = JSON.stringify(body);
    expect(bodyText).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/); // patron tipico de API key de Google
  });
});

describe("Live smoke: una consulta tecnica controlada", () => {
  it("responde exitosamente, con trazabilidad y sin secretos (una sola consulta)", async () => {
    const cookie = await loginAndGetCookie();
    const res = await fetch(`${BASE_URL}/api/queries`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        question: "Cual es el proposito de la proteccion GFCI segun NEC 210.8?",
        language: "es"
      })
    });

    expect(res.status).toBe(201);
    const body = await res.json();

    expect(typeof body.answer).toBe("string");
    expect(body.answer.trim().length).toBeGreaterThan(0);

    // Trazabilidad presente (item obligatorio de FASE H).
    expect(body.selectedProvider).toBeTruthy();
    expect(body.actualProvider).toBeTruthy();
    expect(typeof body.providerFallback).toBe("boolean");

    // Nunca debe contener secretos (API keys, tokens) en la respuesta.
    const bodyText = JSON.stringify(body);
    expect(bodyText).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
    expect(bodyText).not.toMatch(/sk-[A-Za-z0-9]{20,}/);
  }, 30000);
});
