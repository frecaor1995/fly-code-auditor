import { describe, it, expect, beforeEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/server";
import {
  mockGeminiSuccess,
  mockGeminiInvalidJsonContent,
  mockGeminiSchemaIncomplete,
  mockGeminiEmptyResponse,
  mockGeminiHttpError,
  mockGeminiMalformedHttpErrorBody,
  mockGeminiNetworkError,
  mockGeminiHangsForever
} from "../mocks/geminiHandlers";
import { geminiAskAssistant, pingGemini, isGeminiConfigured, getGeminiModel } from "@/lib/ai/providers/geminiProvider";

// FASE C.6: proveedor Gemini, 100% contra MSW (ninguna llamada real sale a
// generativelanguage.googleapis.com). Cubre exito, timeout, 400, 401/403,
// 404, 429, JSON invalido (a dos niveles: body HTTP no-JSON y texto del
// modelo no-JSON), schema_validation_failed, red caida, respuesta vacia, y
// que la API key nunca se filtra en el resultado devuelto.
const SECRET_KEY = "AIzaSy-TEST-SECRET-SHOULD-NEVER-LEAK-0000000";

// IMPORTANTE: usar un parametro por defecto aqui es una trampa real -
// llamar a withGeminiEnv(undefined) NO limpia la key (undefined explicito
// SIGUE activando el valor por defecto en JS/TS), asi que "sin API key" se
// debe pedir con withGeminiEnv("") explicitamente, nunca con undefined.
function withGeminiEnv(apiKey: string = SECRET_KEY, model = "gemini-test-model") {
  vi.stubEnv("GEMINI_API_KEY", apiKey);
  vi.stubEnv("GEMINI_MODEL", model);
}

describe("geminiProvider: configuracion", () => {
  it("isGeminiConfigured refleja la presencia de GEMINI_API_KEY", () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(isGeminiConfigured()).toBe(false);
    vi.stubEnv("GEMINI_API_KEY", "algo");
    expect(isGeminiConfigured()).toBe(true);
  });

  it("getGeminiModel usa GEMINI_MODEL si esta definido, o el default si no", () => {
    vi.stubEnv("GEMINI_MODEL", "custom-model");
    expect(getGeminiModel()).toBe("custom-model");
    vi.stubEnv("GEMINI_MODEL", "");
    expect(getGeminiModel()).toBe("gemini-3.5-flash");
  });
});

describe("geminiProvider: sin API key configurada", () => {
  it("devuelve ok:false con code='missing_api_key' SIN intentar ninguna llamada de red", async () => {
    withGeminiEnv("");
    // No se registra ningun handler MSW: si el codigo intentara fetch()
    // igual, onUnhandledRequest:"bypass" dejaria pasar una llamada real, que
    // fallaria/colgaria en este entorno de test y el test fallaria por
    // timeout, exponiendo el bug. Que el test pase confirma el early-return.
    const result = await geminiAskAssistant({ question: "hola", language: "es" });
    expect(result.ok).toBe(false);
    expect(result.providerErrorCode).toBe("missing_api_key");
    expect(result.response).toBeNull();
  });
});

describe("geminiProvider: exito", () => {
  beforeEach(() => withGeminiEnv());

  it("ok:true con AssistantResponse parseado y providerModel correcto", async () => {
    server.use(mockGeminiSuccess({ shortAnswer: "Respuesta tecnica exitosa." }));
    const result = await geminiAskAssistant({ question: "cual es el calibre del feeder", language: "es" });
    expect(result.ok).toBe(true);
    expect(result.response?.shortAnswer).toBe("Respuesta tecnica exitosa.");
    expect(result.providerModel).toBe("gemini-test-model");
    expect(result.providerErrorCode).toBeNull();
    expect(result.httpStatus).toBe(200);
  });

  it("envia la API key via header x-goog-api-key, nunca en la URL ni en el body", async () => {
    let capturedHeader: string | null = null;
    let capturedUrl = "";
    server.use(
      http.post("https://generativelanguage.googleapis.com/v1beta/models/*", ({ request }) => {
        capturedHeader = request.headers.get("x-goog-api-key");
        capturedUrl = request.url;
        return HttpResponse.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ shortAnswer: "ok" }) }] } }] });
      })
    );
    await geminiAskAssistant({ question: "hola", language: "es" });
    expect(capturedHeader).toBe(SECRET_KEY);
    expect(capturedUrl).not.toContain(SECRET_KEY);
  });
});

describe("geminiProvider: timeout (deterministico con fake timers)", () => {
  beforeEach(() => withGeminiEnv());

  it("devuelve code='timeout' si Gemini no responde antes del limite", async () => {
    server.use(mockGeminiHangsForever());
    vi.useFakeTimers();
    try {
      const pending = geminiAskAssistant({ question: "hola", language: "es" });
      await vi.advanceTimersByTimeAsync(15000);
      const result = await pending;
      expect(result.ok).toBe(false);
      expect(result.providerErrorCode).toBe("timeout");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("geminiProvider: errores HTTP clasificados", () => {
  beforeEach(() => withGeminiEnv());

  it("400 sin googleStatus -> code='invalid_request'", async () => {
    server.use(mockGeminiHttpError(400, null, "Bad request"));
    const result = await geminiAskAssistant({ question: "hola", language: "es" });
    expect(result.ok).toBe(false);
    expect(result.providerErrorCode).toBe("invalid_request");
    expect(result.httpStatus).toBe(400);
  });

  it("400 con googleStatus=INVALID_ARGUMENT -> code='invalid_argument'", async () => {
    server.use(mockGeminiHttpError(400, "INVALID_ARGUMENT", "Invalid argument"));
    const result = await geminiAskAssistant({ question: "hola", language: "es" });
    expect(result.providerErrorCode).toBe("invalid_argument");
  });

  it("401 -> code='invalid_api_key'", async () => {
    server.use(mockGeminiHttpError(401, null, "Unauthorized"));
    const result = await geminiAskAssistant({ question: "hola", language: "es" });
    expect(result.providerErrorCode).toBe("invalid_api_key");
    expect(result.httpStatus).toBe(401);
  });

  it("403 -> code='permission_denied'", async () => {
    server.use(mockGeminiHttpError(403, null, "Forbidden"));
    const result = await geminiAskAssistant({ question: "hola", language: "es" });
    expect(result.providerErrorCode).toBe("permission_denied");
    expect(result.httpStatus).toBe(403);
  });

  it("404 -> code='model_not_found'", async () => {
    server.use(mockGeminiHttpError(404, null, "Not found"));
    const result = await geminiAskAssistant({ question: "hola", language: "es" });
    expect(result.providerErrorCode).toBe("model_not_found");
    expect(result.httpStatus).toBe(404);
  });

  it("429 sin googleStatus -> code='rate_limit_or_quota'", async () => {
    server.use(mockGeminiHttpError(429, null, "Too many requests"));
    const result = await geminiAskAssistant({ question: "hola", language: "es" });
    expect(result.providerErrorCode).toBe("rate_limit_or_quota");
    expect(result.httpStatus).toBe(429);
  });

  it("429 con googleStatus=RESOURCE_EXHAUSTED -> code='resource_exhausted'", async () => {
    server.use(mockGeminiHttpError(429, "RESOURCE_EXHAUSTED", "Quota exceeded"));
    const result = await geminiAskAssistant({ question: "hola", language: "es" });
    expect(result.providerErrorCode).toBe("resource_exhausted");
  });
});

describe("geminiProvider: JSON invalido (dos niveles)", () => {
  beforeEach(() => withGeminiEnv());

  it("body HTTP no parseable como JSON -> code='invalid_json_response', con el status HTTP real", async () => {
    server.use(mockGeminiMalformedHttpErrorBody(500));
    const result = await geminiAskAssistant({ question: "hola", language: "es" });
    expect(result.ok).toBe(false);
    expect(result.providerErrorCode).toBe("invalid_json_response");
    expect(result.httpStatus).toBe(500);
  });

  it("HTTP 200 pero el TEXTO del modelo no es JSON -> code='invalid_json_response', httpStatus null (no es un error HTTP)", async () => {
    server.use(mockGeminiInvalidJsonContent());
    const result = await geminiAskAssistant({ question: "hola", language: "es" });
    expect(result.ok).toBe(false);
    expect(result.providerErrorCode).toBe("invalid_json_response");
    expect(result.httpStatus).toBeNull();
  });

  it("JSON del modelo valido pero incompleto -> code='schema_validation_failed'", async () => {
    server.use(mockGeminiSchemaIncomplete());
    const result = await geminiAskAssistant({ question: "hola", language: "es" });
    expect(result.ok).toBe(false);
    expect(result.providerErrorCode).toBe("schema_validation_failed");
    expect(result.httpStatus).toBeNull();
  });

  it("respuesta sin candidates/texto -> code='empty_response'", async () => {
    server.use(mockGeminiEmptyResponse());
    const result = await geminiAskAssistant({ question: "hola", language: "es" });
    expect(result.providerErrorCode).toBe("empty_response");
  });
});

describe("geminiProvider: red caida", () => {
  beforeEach(() => withGeminiEnv());

  it("un error de red -> code='network_error'", async () => {
    server.use(mockGeminiNetworkError());
    const result = await geminiAskAssistant({ question: "hola", language: "es" });
    expect(result.ok).toBe(false);
    expect(result.providerErrorCode).toBe("network_error");
  });
});

describe("geminiProvider: la API key NUNCA se expone en el resultado", () => {
  beforeEach(() => withGeminiEnv());

  it("ningun GeminiCallResult (exito o fallo) contiene la API key en texto plano", async () => {
    const scenarios = [
      mockGeminiSuccess({ shortAnswer: "ok" }),
      mockGeminiHttpError(401, null, "Unauthorized"),
      mockGeminiHttpError(429, "RESOURCE_EXHAUSTED", "Quota exceeded"),
      mockGeminiInvalidJsonContent(),
      mockGeminiNetworkError()
    ];
    for (const handler of scenarios) {
      server.use(handler);
      const result = await geminiAskAssistant({ question: "hola", language: "es" });
      expect(JSON.stringify(result)).not.toContain(SECRET_KEY);
    }
  });

  it("pingGemini tampoco expone la API key en ningun escenario", async () => {
    server.use(mockGeminiHttpError(403, null, "Forbidden"));
    const ping = await pingGemini();
    expect(JSON.stringify(ping)).not.toContain(SECRET_KEY);
    expect(ping.ok).toBe(false);
    expect(ping.code).toBe("permission_denied");
  });
});

describe("pingGemini: diagnostico minimo para app/api/health/ai-providers", () => {
  it("ok:false con code='missing_api_key' si no hay API key configurada, sin llamar a la red", async () => {
    withGeminiEnv("");
    const result = await pingGemini();
    expect(result).toEqual({ ok: false, code: "missing_api_key", message: expect.any(String) });
  });

  it("ok:true en un 200 exitoso", async () => {
    withGeminiEnv();
    server.use(mockGeminiSuccess());
    const result = await pingGemini();
    expect(result).toEqual({ ok: true, code: null, message: null });
  });

  it("ok:false con el code clasificado en un error HTTP", async () => {
    withGeminiEnv();
    server.use(mockGeminiHttpError(429, null, "Too many requests"));
    const result = await pingGemini();
    expect(result.ok).toBe(false);
    expect(result.code).toBe("rate_limit_or_quota");
  });

  it("ok:false con code='network_error' si la red falla", async () => {
    withGeminiEnv();
    server.use(mockGeminiNetworkError());
    const result = await pingGemini();
    expect(result.ok).toBe(false);
    expect(result.code).toBe("network_error");
  });

  it("ok:false con code='timeout' de forma deterministica (fake timers)", async () => {
    withGeminiEnv();
    server.use(mockGeminiHangsForever());
    vi.useFakeTimers();
    try {
      const pending = pingGemini();
      await vi.advanceTimersByTimeAsync(15000);
      const result = await pending;
      expect(result.ok).toBe(false);
      expect(result.code).toBe("timeout");
    } finally {
      vi.useRealTimers();
    }
  });
});
