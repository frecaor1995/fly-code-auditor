import { describe, it, expect, vi } from "vitest";
import { classifyProviderError, safeErrorMessage, withTimeout, TimeoutError } from "@/lib/utils/resilience";
import { InvalidModelJsonError, SchemaValidationError } from "@/lib/ai/providers/shared";

// FASE C.5: clasificacion de errores de proveedores. classifyProviderError
// (lib/utils/resilience.ts) es el punto compartido que usa la ruta OpenAI;
// geminiProvider.ts tiene su propio mapeo interno (mapHttpStatusToCode, no
// exportado) que se prueba indirectamente en tests/unit/geminiProvider.test.ts
// (Phase C.6) llamando a geminiAskAssistant/pingGemini con respuestas HTTP
// simuladas via MSW, que es la forma correcta de probar una funcion privada:
// a traves de su contrato publico, no exportandola solo para el test.

describe("classifyProviderError: diagnostico estructurado sin exponer secretos", () => {
  it("extrae status/code/type/message de un error con esa forma (estilo SDK de OpenAI)", () => {
    // Los errores reales del SDK de OpenAI extienden Error y agregan
    // status/code/type como propiedades adicionales; safeErrorMessage solo
    // lee .message cuando el valor es "instanceof Error" (ver
    // lib/utils/resilience.ts), asi que el fixture debe ser un Error real,
    // no un objeto plano.
    const error = Object.assign(new Error("Too many requests"), { status: 429, code: "rate_limit_exceeded", type: "rate_limit" });
    const result = classifyProviderError(error);
    expect(result).toEqual({ status: 429, code: "rate_limit_exceeded", type: "rate_limit", message: "Too many requests" });
  });

  it("clasifica un TimeoutError con code='timeout' aunque no traiga status/type", () => {
    const result = classifyProviderError(new TimeoutError("Tiempo de espera agotado (test > 100ms)."));
    expect(result.code).toBe("timeout");
    expect(result.status).toBeNull();
  });

  it("clasifica un Error generico (sin status/code/type) con message y campos null", () => {
    const result = classifyProviderError(new Error("fallo generico"));
    expect(result.status).toBeNull();
    expect(result.code).toBeNull();
    expect(result.type).toBeNull();
    expect(result.message).toBe("fallo generico");
  });

  it("clasifica un valor no-Error (string/undefined lanzado) sin lanzar excepcion propia", () => {
    expect(classifyProviderError("string lanzado directamente").message).toBe("El proveedor de IA no respondio.");
    expect(classifyProviderError(undefined).message).toBe("El proveedor de IA no respondio.");
  });

  it("NUNCA incluye una API key o token en el mensaje clasificado", () => {
    const secretLikeError = new Error("Unauthorized");
    (secretLikeError as unknown as { apiKey: string }).apiKey = "sk-super-secret-key-should-never-leak";
    const result = classifyProviderError(secretLikeError);
    expect(JSON.stringify(result)).not.toContain("sk-super-secret-key-should-never-leak");
  });

  it("reconoce por duck-typing los errores propios de shared.ts (invalid_json_response / schema_validation_failed)", () => {
    expect(classifyProviderError(new InvalidModelJsonError("bad json")).code).toBe("invalid_json_response");
    expect(classifyProviderError(new SchemaValidationError("bad schema")).code).toBe("schema_validation_failed");
  });
});

describe("safeErrorMessage: nunca expone el objeto de error crudo", () => {
  it("devuelve error.message cuando es un Error real", () => {
    expect(safeErrorMessage(new Error("mensaje real"), "fallback")).toBe("mensaje real");
  });

  it("devuelve el fallback cuando el error no es un Error o no tiene message", () => {
    expect(safeErrorMessage("no es un Error", "fallback")).toBe("fallback");
    expect(safeErrorMessage(null, "fallback")).toBe("fallback");
    expect(safeErrorMessage(new Error(""), "fallback")).toBe("fallback");
  });
});

describe("withTimeout: clasificacion de timeout de forma deterministica (fake timers)", () => {
  it("rechaza con TimeoutError(code='timeout') si la promesa no resuelve antes del limite", async () => {
    vi.useFakeTimers();
    try {
      const neverResolves = new Promise<never>(() => {});
      const timedOut = withTimeout(neverResolves, 5000, "test-op");
      const assertion = expect(timedOut).rejects.toBeInstanceOf(TimeoutError);
      await vi.advanceTimersByTimeAsync(5000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("resuelve normalmente si la promesa original gana antes del limite", async () => {
    const result = await withTimeout(Promise.resolve("ok"), 5000, "test-op");
    expect(result).toBe("ok");
  });

  it("propaga el error original (no un TimeoutError) si la promesa rechaza antes del limite", async () => {
    await expect(withTimeout(Promise.reject(new Error("fallo real")), 5000, "test-op")).rejects.toThrow("fallo real");
  });
});

// FASE C.5: cobertura explicita de todos los codigos de error pedidos. La
// mayoria se clasifican via classifyProviderError (forma OpenAI-like); los
// especificos de Gemini (mapHttpStatusToCode) se cubren en
// tests/unit/geminiProvider.test.ts porque esa funcion no esta exportada
// (se prueba a traves de geminiAskAssistant/pingGemini, su contrato real).
describe.each([
  ["missing_api_key", { code: "missing_api_key" }],
  ["invalid_argument", { code: "invalid_argument" }],
  ["invalid_api_key", { code: "invalid_api_key" }],
  ["permission_denied", { code: "permission_denied" }],
  ["model_not_found", { code: "model_not_found" }],
  ["rate_limit", { code: "rate_limit" }],
  ["insufficient_quota", { code: "insufficient_quota" }],
  ["network_error", { code: "network_error" }],
  ["invalid_json_response", { code: "invalid_json_response" }],
  ["schema_validation_failed", { code: "schema_validation_failed" }],
  ["unknown_provider_error", { code: "unknown_provider_error" }]
])("classifyProviderError: codigo '%s'", (_label, errorShape) => {
  it("se preserva tal cual en el diagnostico (duck-typing sobre .code)", () => {
    expect(classifyProviderError(errorShape).code).toBe(errorShape.code);
  });
});
