import { http, HttpResponse, delay } from "msw";
import type { AssistantResponse } from "@/lib/db/types";

// Handlers MSW para la Generative Language API de Gemini (usados por
// lib/ai/providers/geminiProvider.ts). Cubren exactamente los escenarios
// pedidos en FASE C.5/C.6: exito, 400/401/403/404/429, timeout, red caida,
// JSON invalido, JSON valido pero con forma incorrecta.
const GEMINI_URL_PATTERN = "https://generativelanguage.googleapis.com/v1beta/models/*";

function assistantResponseJson(overrides: Partial<AssistantResponse> = {}): string {
  return JSON.stringify({
    shortAnswer: "Respuesta tecnica de prueba generada por Gemini (mock).",
    riskLevel: "medio",
    codeReference: "NEC Article 210 (mock)",
    checklist: ["Paso de verificacion de prueba"],
    missingQuestions: [],
    recommendation: "Recomendacion de prueba.",
    ...overrides
  });
}

function candidatesBody(text: string) {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

export function mockGeminiSuccess(overrides: Partial<AssistantResponse> = {}) {
  return http.post(GEMINI_URL_PATTERN, () => HttpResponse.json(candidatesBody(assistantResponseJson(overrides))));
}

export function mockGeminiInvalidJsonContent() {
  // Gemini responde 200 pero el texto del modelo no es JSON parseable:
  // esto debe clasificarse como "invalid_json_response", no como un error
  // HTTP.
  return http.post(GEMINI_URL_PATTERN, () => HttpResponse.json(candidatesBody("esto no es JSON valido {{{")));
}

export function mockGeminiSchemaIncomplete() {
  // JSON sintacticamente valido pero sin shortAnswer utilizable: debe
  // clasificarse como "schema_validation_failed".
  return http.post(GEMINI_URL_PATTERN, () => HttpResponse.json(candidatesBody(JSON.stringify({ shortAnswer: "   " }))));
}

export function mockGeminiEmptyResponse() {
  return http.post(GEMINI_URL_PATTERN, () => HttpResponse.json({ candidates: [] }));
}

export function mockGeminiHttpError(status: number, googleStatus: string | null, message = "Gemini mock error") {
  return http.post(GEMINI_URL_PATTERN, () =>
    HttpResponse.json({ error: { status: googleStatus, message } }, { status })
  );
}

export function mockGeminiMalformedHttpErrorBody(status: number) {
  // Respuesta de error que ni siquiera es JSON valido: debe seguir
  // clasificando el error por status HTTP, sin lanzar una excepcion no
  // controlada al intentar parsear el body.
  return http.post(GEMINI_URL_PATTERN, () => new HttpResponse("<html>not json</html>", { status }));
}

export function mockGeminiNetworkError() {
  return http.post(GEMINI_URL_PATTERN, () => HttpResponse.error());
}

// Nunca resuelve: usado junto con vi.useFakeTimers() para probar el
// timeout de geminiProvider.ts de forma determinista (sin esperar los
// 15000ms reales). Ver tests/unit/geminiProvider.test.ts.
export function mockGeminiHangsForever() {
  return http.post(GEMINI_URL_PATTERN, async () => {
    await delay("infinite");
    return HttpResponse.json({});
  });
}
