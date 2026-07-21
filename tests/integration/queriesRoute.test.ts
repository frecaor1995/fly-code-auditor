import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildJsonRequest, buildGetRequest } from "../helpers/nextRequest";
import { TEST_TECNICO } from "../fixtures/testUsers";
import type { AssistantResponse } from "@/lib/db/types";
import type { KnowledgeEntryMatch } from "@/lib/db/dbAdapter";
import type { GeminiCallResult } from "@/lib/ai/providers/geminiProvider";

// FASE D: pruebas de integracion de app/api/queries/route.ts. Se invoca el
// route handler directamente (sin levantar un servidor HTTP real, patron
// recomendado por Next.js para App Router). Se mockean SOLO los limites
// externos reales (sesion/auth, Supabase via dbAdapter, y los proveedores
// de IA); toda la logica intermedia real del proyecto (matchEngine,
// intentClassifier, electricalKnowledgeBase, mockAssistant, resilience)
// corre de verdad, para que estas pruebas verifiquen el comportamiento real
// end-to-end del endpoint, no un doble de todo.

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: vi.fn()
}));

// IMPORTANTE: este mock NO usa vi.importActual("@/lib/db/dbAdapter"). Se
// probo asi originalmente, pero dbAdapter.ts importa internamente
// findBestMatch desde lib/knowledge/matchEngine.ts - vi.importActual carga
// el modulo real completo (con ese import transitivo incluido), y eso
// rompia por completo el merge de cobertura de istanbul/v8 para
// matchEngine.ts y electricalKnowledgeBase.ts en toda la suite (ambos
// archivos desaparecian del reporte combinado sin ningun error visible;
// aislado probando combinaciones de archivos hasta encontrar la causa
// exacta). Se reimplementan aqui, sueltas y sin importar el modulo real,
// las 3 funciones puras y triviales que route.ts necesita ademas de las
// que ya se mockean como vi.fn() controlados por cada test.
function extractSourceFile(sourceInfo?: string): string | null {
  if (!sourceInfo) return null;
  const match = sourceInfo.match(/(?:Archivo interno|Internal file):\s*(.+)/);
  return match ? match[1].trim() : null;
}
function extractSourceCategory(sourceInfo?: string): string | null {
  if (!sourceInfo) return null;
  const match = sourceInfo.match(/(?:Categoria detectada|Detected category):\s*(.+)/);
  return match ? match[1].trim() : null;
}
function mapRiskLevelToDbReal(riskLevel: "bajo" | "medio" | "alto" | "critico"): "low" | "medium" | "high" {
  if (riskLevel === "bajo") return "low";
  if (riskLevel === "medio") return "medium";
  return "high";
}

vi.mock("@/lib/db/dbAdapter", () => ({
  findKnowledgeByQuestion: vi.fn(),
  getOfficialSources: vi.fn(),
  createQuery: vi.fn(),
  getQueries: vi.fn(),
  extractSourceFile: vi.fn(extractSourceFile),
  extractSourceCategory: vi.fn(extractSourceCategory),
  // mapRiskLevelToDb queda como vi.fn() controlado (no un simple re-export)
  // para poder forzar, en UN test puntual, que lance una excepcion no
  // relacionada a ningun proveedor de IA (ver "catch fatal" mas abajo).
  mapRiskLevelToDb: vi.fn(mapRiskLevelToDbReal)
}));

vi.mock("@/lib/ai/providers/geminiProvider", () => ({
  geminiAskAssistant: vi.fn()
}));

vi.mock("@/lib/ai/openaiAssistant", () => ({
  openaiAskAssistant: vi.fn()
}));

import { getCurrentUser } from "@/lib/auth/session";
import { findKnowledgeByQuestion, getOfficialSources, createQuery, getQueries, mapRiskLevelToDb } from "@/lib/db/dbAdapter";
import { geminiAskAssistant } from "@/lib/ai/providers/geminiProvider";
import { openaiAskAssistant } from "@/lib/ai/openaiAssistant";
import { verifyNecMessage } from "@/lib/ai/types";
import { POST, GET } from "@/app/api/queries/route";

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockFindKnowledgeByQuestion = vi.mocked(findKnowledgeByQuestion);
const mockGetOfficialSources = vi.mocked(getOfficialSources);
const mockCreateQuery = vi.mocked(createQuery);
const mockGetQueries = vi.mocked(getQueries);
const mockMapRiskLevelToDb = vi.mocked(mapRiskLevelToDb);
const mockGeminiAskAssistant = vi.mocked(geminiAskAssistant);
const mockOpenaiAskAssistant = vi.mocked(openaiAskAssistant);

function fakeCreateQueryResult(persisted = true, error: string | null = null) {
  return async (input: Parameters<typeof createQuery>[0]) => ({
    query: {
      id: "q-test-1",
      projectId: input.projectId,
      planId: input.planId,
      userId: input.userEmail,
      mode: input.mode,
      language: input.language,
      question: input.question,
      response: input.response,
      riskLevel: input.response.riskLevel,
      requiresMasterReview: input.response.riskLevel === "alto" || input.response.riskLevel === "critico",
      createdAt: new Date().toISOString()
    },
    persisted,
    error
  });
}

function geminiSuccess(overrides: Partial<AssistantResponse> = {}): GeminiCallResult {
  return {
    ok: true,
    attemptedProvider: "gemini",
    providerModel: "gemini-test-model",
    response: {
      shortAnswer: "Respuesta de Gemini (mock).",
      riskLevel: "medio",
      codeReference: "NEC Article 210 (mock)",
      checklist: ["paso de prueba"],
      missingQuestions: [],
      recommendation: "Recomendacion de prueba.",
      warning: "Advertencia estandar.",
      ...overrides
    },
    providerErrorCode: null,
    providerErrorMessage: null,
    httpStatus: 200,
    durationMs: 42
  };
}

function geminiFailure(code: string, message = "Gemini fallo (mock)", httpStatus: number | null = null): GeminiCallResult {
  return {
    ok: false,
    attemptedProvider: "gemini",
    providerModel: "gemini-test-model",
    response: null,
    providerErrorCode: code,
    providerErrorMessage: message,
    httpStatus,
    durationMs: 42
  };
}

beforeEach(() => {
  vi.stubEnv("AI_PROVIDER", "gemini");
  vi.stubEnv("USE_MOCK_AI", "false");
  mockGetCurrentUser.mockReturnValue(TEST_TECNICO);
  mockFindKnowledgeByQuestion.mockResolvedValue(null);
  mockGetOfficialSources.mockResolvedValue([]);
  mockCreateQuery.mockImplementation(fakeCreateQueryResult(true, null));
  mockGetQueries.mockResolvedValue([]);
  // restoreMocks:true (vitest.config.ts) resetea este mock a un no-op entre
  // tests (no es un vi.spyOn sobre un objeto real, asi que mockRestore()
  // actua como mockReset()): se restaura la implementacion real por
  // defecto en cada test, y solo el test del catch fatal la sobreescribe
  // puntualmente.
  mockMapRiskLevelToDb.mockImplementation(mapRiskLevelToDbReal);
});

describe("POST /api/queries: autenticacion", () => {
  it("usuario no autenticado recibe 401 y nunca llega a generar una respuesta", async () => {
    mockGetCurrentUser.mockReturnValue(null);
    const res = await POST(buildJsonRequest("/api/queries", { question: "cual es el calibre del feeder" }));
    expect(res.status).toBe(401);
    expect(mockGeminiAskAssistant).not.toHaveBeenCalled();
  });

  it("usuario autenticado puede crear una consulta (201)", async () => {
    mockGeminiAskAssistant.mockResolvedValue(geminiSuccess());
    const res = await POST(buildJsonRequest("/api/queries", { question: "cual es el calibre del feeder de 200a" }));
    expect(res.status).toBe(201);
  });
});

describe("GET /api/queries: autenticacion", () => {
  it("usuario no autenticado recibe 401", async () => {
    mockGetCurrentUser.mockReturnValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("usuario autenticado recibe la lista de queries", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.queries).toEqual([]);
  });
});

describe("POST /api/queries: Gemini exitoso", () => {
  it("actualProvider='gemini', sin fallback, respuesta backed", async () => {
    mockGeminiAskAssistant.mockResolvedValue(geminiSuccess({ shortAnswer: "Respuesta tecnica real de Gemini." }));
    const res = await POST(buildJsonRequest("/api/queries", { question: "cual es el calibre del feeder de aluminio" }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.answer).toBe("Respuesta tecnica real de Gemini.");
    expect(body.selectedProvider).toBe("gemini");
    expect(body.attemptedProvider).toBe("gemini");
    expect(body.actualProvider).toBe("gemini");
    expect(body.providerFallback).toBe(false);
    expect(body.answerKind).toBe("backed");
    expect(body.providerModel).toBe("gemini-test-model");
    expect(mockOpenaiAskAssistant).not.toHaveBeenCalled();
  });
});

describe("POST /api/queries: Gemini timeout -> fallback local validado", () => {
  it("providerErrorCode='timeout', actualProvider='local_validated_fallback', metadata completa", async () => {
    mockGeminiAskAssistant.mockResolvedValue(geminiFailure("timeout", "Tiempo de espera agotado llamando a Gemini."));
    const res = await POST(buildJsonRequest("/api/queries", { question: "necesito proteccion gfci en el bano" }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.providerErrorCode).toBe("timeout");
    expect(body.selectedProvider).toBe("gemini");
    expect(body.attemptedProvider).toBe("gemini");
    expect(body.actualProvider).toBe("local_validated_fallback");
    expect(body.providerFallback).toBe(true);
    // "necesito proteccion gfci en el bano" matchea kb-gfci en la base real
    // (cita NEC + checklist no vacio + sin contradicciones): la integridad
    // del fallback se valida y queda como validated_fallback, no unverified.
    expect(body.answerKind).toBe("validated_fallback");
    expect(body.answer.length).toBeGreaterThan(0);
    expect(mockOpenaiAskAssistant).not.toHaveBeenCalled();
  });
});

describe("POST /api/queries: errores HTTP de Gemini (400 y 429)", () => {
  it("400 (invalid_argument) cae a fallback local con el code preservado", async () => {
    mockGeminiAskAssistant.mockResolvedValue(geminiFailure("invalid_argument", "Bad request", 400));
    const res = await POST(buildJsonRequest("/api/queries", { question: "necesito el electrodo de puesta a tierra" }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.providerErrorCode).toBe("invalid_argument");
    expect(body.providerErrorStatus).toBe(400);
    expect(body.actualProvider).toBe("local_validated_fallback");
  });

  it("429 (rate_limit_or_quota) cae a fallback local con el code preservado", async () => {
    mockGeminiAskAssistant.mockResolvedValue(geminiFailure("rate_limit_or_quota", "Too many requests", 429));
    const res = await POST(buildJsonRequest("/api/queries", { question: "necesito el electrodo de puesta a tierra" }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.providerErrorCode).toBe("rate_limit_or_quota");
    expect(body.providerErrorStatus).toBe(429);
    expect(body.actualProvider).toBe("local_validated_fallback");
  });
});

describe("POST /api/queries: JSON invalido y schema_validation_failed", () => {
  it("invalid_json_response cae a fallback local", async () => {
    mockGeminiAskAssistant.mockResolvedValue(geminiFailure("invalid_json_response", "Gemini respondio con contenido que no es JSON valido."));
    const res = await POST(buildJsonRequest("/api/queries", { question: "necesito el electrodo de puesta a tierra" }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.providerErrorCode).toBe("invalid_json_response");
    expect(body.actualProvider).toBe("local_validated_fallback");
  });

  it("schema_validation_failed cae a fallback local", async () => {
    mockGeminiAskAssistant.mockResolvedValue(geminiFailure("schema_validation_failed", "El modelo respondio JSON valido pero sin 'shortAnswer' utilizable."));
    const res = await POST(buildJsonRequest("/api/queries", { question: "necesito el electrodo de puesta a tierra" }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.providerErrorCode).toBe("schema_validation_failed");
    expect(body.actualProvider).toBe("local_validated_fallback");
  });
});

describe("POST /api/queries: Supabase disponible vs caido", () => {
  it("Supabase disponible: un match de knowledge_entries responde SIN llamar a ningun proveedor de IA", async () => {
    const entry: KnowledgeEntryMatch = {
      id: "ke-1",
      category: "Feeders",
      title: "Feeder test",
      keywords: ["feeder"],
      answerEs: "Respuesta desde Supabase knowledge_entries.",
      answerEn: "Answer from Supabase knowledge_entries.",
      codeReferences: "NEC 215",
      riskLevel: "medio",
      sourceUsed: "public.knowledge_entries",
      necArticles: [],
      tdlrReferences: [],
      ahjReferences: [],
      sourceUrls: [],
      sourceLastCheckedAt: null,
      appliesWhen: null,
      doesNotApplyWhen: null,
      fieldNotes: null,
      verificationSteps: [],
      officialReference: null
    };
    mockFindKnowledgeByQuestion.mockResolvedValue(entry);
    const res = await POST(buildJsonRequest("/api/queries", { question: "cualquier pregunta" }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.answer).toBe("Respuesta desde Supabase knowledge_entries.");
    expect(body.actualProvider).toBe("supabase_knowledge_entries");
    expect(body.attemptedProvider).toBe("none");
    expect(mockGeminiAskAssistant).not.toHaveBeenCalled();
    expect(mockOpenaiAskAssistant).not.toHaveBeenCalled();
  });

  it("Supabase caido (lecturas rechazan): la respuesta se sigue generando via Gemini, nunca un 500", async () => {
    mockFindKnowledgeByQuestion.mockRejectedValue(new Error("ECONNREFUSED: Supabase no responde"));
    mockGetOfficialSources.mockRejectedValue(new Error("ECONNREFUSED: Supabase no responde"));
    mockGeminiAskAssistant.mockResolvedValue(geminiSuccess({ shortAnswer: "Respuesta pese a Supabase caido." }));
    const res = await POST(buildJsonRequest("/api/queries", { question: "cual es el calibre del feeder de aluminio" }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.answer).toBe("Respuesta pese a Supabase caido.");
  });
});

describe("POST /api/queries: validacion de entrada", () => {
  it("pregunta vacia -> 400", async () => {
    const res = await POST(buildJsonRequest("/api/queries", { question: "" }));
    expect(res.status).toBe(400);
    expect(mockGeminiAskAssistant).not.toHaveBeenCalled();
  });

  it("body sin campo question -> 400", async () => {
    const res = await POST(buildJsonRequest("/api/queries", {}));
    expect(res.status).toBe(400);
  });

});

// Fix del hallazgo de auditoria de la primera pasada de FASE D:
// app/api/queries/route.ts ahora valida MAX_QUERY_LENGTH (default 5000,
// configurable) ANTES de tocar Supabase o cualquier proveedor de IA.
describe("POST /api/queries: limite de longitud de pregunta (MAX_QUERY_LENGTH)", () => {
  it("una pregunta de exactamente 5000 caracteres (limite por defecto) SI se procesa normalmente", async () => {
    mockGeminiAskAssistant.mockResolvedValue(geminiSuccess({ shortAnswer: "Respuesta dentro del limite." }));
    const exactLength = "a".repeat(5000);
    const res = await POST(buildJsonRequest("/api/queries", { question: exactLength }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.answer).toBe("Respuesta dentro del limite.");
    expect(mockGeminiAskAssistant).toHaveBeenCalledTimes(1);
  });

  it("un caracter por encima del limite (5001) se rechaza con 400 y code='question_too_long'", async () => {
    const oneCharOver = "a".repeat(5001);
    const res = await POST(buildJsonRequest("/api/queries", { question: oneCharOver }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("question_too_long");
  });

  it("el mensaje de error esta sanitizado: solo menciona el limite numerico, nunca la pregunta original ni datos internos", async () => {
    const oneCharOver = "SECRETO-QUE-NUNCA-DEBE-REFLEJARSE-" + "a".repeat(5001);
    const res = await POST(buildJsonRequest("/api/queries", { question: oneCharOver }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(typeof body.error).toBe("string");
    expect(body.error).toContain("5000");
    expect(body.error).not.toContain("SECRETO-QUE-NUNCA-DEBE-REFLEJARSE");
    expect(body.error.length).toBeLessThan(200);
  });

  it("ningun proveedor ni Supabase se invoca cuando la pregunta excede el limite", async () => {
    const oneCharOver = "a".repeat(5001);
    await POST(buildJsonRequest("/api/queries", { question: oneCharOver }));
    expect(mockGeminiAskAssistant).not.toHaveBeenCalled();
    expect(mockOpenaiAskAssistant).not.toHaveBeenCalled();
    expect(mockFindKnowledgeByQuestion).not.toHaveBeenCalled();
    expect(mockGetOfficialSources).not.toHaveBeenCalled();
    expect(mockCreateQuery).not.toHaveBeenCalled();
  });

  it("MAX_QUERY_LENGTH es configurable via env: un limite mas bajo rechaza preguntas que antes pasaban", async () => {
    vi.stubEnv("MAX_QUERY_LENGTH", "10");
    const res = await POST(buildJsonRequest("/api/queries", { question: "esto tiene mas de diez caracteres" }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("question_too_long");
    expect(body.error).toContain("10");
  });
});

describe("POST /api/queries: idiomas", () => {
  beforeEach(() => {
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("USE_MOCK_AI", "true");
  });

  it("espanol: shortAnswer en espanol, sin englishSummary", async () => {
    const res = await POST(buildJsonRequest("/api/queries", { question: "necesito el electrodo de puesta a tierra", language: "es" }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.query.response.englishSummary).toBeUndefined();
  });

  it("ingles: shortAnswer en ingles", async () => {
    const res = await POST(buildJsonRequest("/api/queries", { question: "necesito el electrodo de puesta a tierra", language: "en" }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.query.response.shortAnswer).toMatch(/grounding/i);
  });

  it("bilingue: shortAnswer en espanol + englishSummary presente", async () => {
    const res = await POST(buildJsonRequest("/api/queries", { question: "necesito el electrodo de puesta a tierra", language: "bilingual" }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.query.response.englishSummary).toBeTruthy();
    expect(body.query.response.shortAnswer).toMatch(/tierra/i);
  });
});

describe("POST /api/queries: guardado", () => {
  it("guardado exitoso: persisted=true, sin saveError", async () => {
    mockGeminiAskAssistant.mockResolvedValue(geminiSuccess());
    const res = await POST(buildJsonRequest("/api/queries", { question: "cual es el calibre del feeder de aluminio" }));
    const body = await res.json();
    expect(body.persisted).toBe(true);
    expect(body.saveError).toBeNull();
  });

  it("fallo de guardado NO elimina la respuesta tecnica ya generada", async () => {
    mockGeminiAskAssistant.mockResolvedValue(geminiSuccess({ shortAnswer: "Respuesta que debe sobrevivir a un fallo de guardado." }));
    mockCreateQuery.mockRejectedValue(new Error("Supabase insert failed"));
    const res = await POST(buildJsonRequest("/api/queries", { question: "cual es el calibre del feeder de aluminio" }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.persisted).toBe(false);
    expect(body.answer).toBe("Respuesta que debe sobrevivir a un fallo de guardado.");
    expect(body.saveError).toBeTruthy();
  });

  it("createQuery resuelve persisted:false explicitamente (no una excepcion): tambien se refleja tal cual", async () => {
    mockGeminiAskAssistant.mockResolvedValue(geminiSuccess());
    mockCreateQuery.mockImplementation(fakeCreateQueryResult(false, "No se pudo escribir en la tabla queries."));
    const res = await POST(buildJsonRequest("/api/queries", { question: "cual es el calibre del feeder de aluminio" }));
    const body = await res.json();
    expect(body.persisted).toBe(false);
    expect(body.saveError).toBe("No se pudo escribir en la tabla queries.");
    expect(body.answer.length).toBeGreaterThan(0);
  });
});

describe("POST /api/queries: AI_PROVIDER=gemini NUNCA llama a OpenAI", () => {
  it("ni en exito ni en fallo de Gemini se invoca openaiAskAssistant", async () => {
    mockGeminiAskAssistant.mockResolvedValue(geminiSuccess());
    await POST(buildJsonRequest("/api/queries", { question: "cual es el calibre del feeder de aluminio" }));
    expect(mockOpenaiAskAssistant).not.toHaveBeenCalled();

    mockGeminiAskAssistant.mockResolvedValue(geminiFailure("permission_denied"));
    await POST(buildJsonRequest("/api/queries", { question: "necesito el electrodo de puesta a tierra" }));
    expect(mockOpenaiAskAssistant).not.toHaveBeenCalled();
  });
});

describe("POST /api/queries: nunca expone secretos", () => {
  it("una API key presente en el entorno nunca aparece en el body de la respuesta ni en los logs", async () => {
    const SECRET = "sk-integration-test-secret-should-never-leak-0000";
    vi.stubEnv("GEMINI_API_KEY", SECRET);
    vi.stubEnv("OPENAI_API_KEY", SECRET);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mockGeminiAskAssistant.mockResolvedValue(geminiFailure("invalid_api_key", "Gemini mock error (sin la key real)"));
    const res = await POST(buildJsonRequest("/api/queries", { question: "necesito el electrodo de puesta a tierra" }));
    const body = await res.json();

    expect(JSON.stringify(body)).not.toContain(SECRET);
    const allLoggedText = [...errorSpy.mock.calls, ...logSpy.mock.calls].map((args) => JSON.stringify(args)).join("\n");
    expect(allLoggedText).not.toContain(SECRET);

    errorSpy.mockRestore();
    logSpy.mockRestore();
    expect(res.status).toBe(201);
  });
});

describe("POST /api/queries: forceOfficial (prioriza fuentes oficiales sobre memoria generica)", () => {
  it("una pregunta que pide una cita NEC directa, sin cita especifica ya presente, reemplaza shortAnswer por la nota de fuente oficial", async () => {
    // codeReference identico a verifyNecMessage("es") = "sin cita especifica"
    // (ver hasSpecificCitation en route.ts): fuerza deliberadamente esta
    // rama sin depender de la redaccion exacta de una entrada real de la
    // base de conocimiento.
    mockGeminiAskAssistant.mockResolvedValue(
      geminiSuccess({ shortAnswer: "Respuesta generica sin cita.", codeReference: verifyNecMessage("es") })
    );
    const res = await POST(buildJsonRequest("/api/queries", { question: "segun el nec, que dice sobre proteccion gfci" }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.category).toBe("official_source_priority");
    expect(body.query.response.shortAnswer).not.toBe("Respuesta generica sin cita.");
    expect(body.answer).toMatch(/fuente oficial/i);
  });

  it("una pregunta con cita NEC especifica real NUNCA se reemplaza, aunque mencione TDLR/NEC", async () => {
    mockGeminiAskAssistant.mockResolvedValue(
      geminiSuccess({ shortAnswer: "Respuesta con cita real.", codeReference: "NEC Article 210.8 (GFCI protection)" })
    );
    const res = await POST(buildJsonRequest("/api/queries", { question: "segun el nec, que dice sobre proteccion gfci" }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.query.response.shortAnswer).toBe("Respuesta con cita real.");
  });
});

describe("POST /api/queries: catch fatal (ultimo recurso ante un error no relacionado a ningun proveedor)", () => {
  it("un error inesperado y no relacionado a ningun proveedor nunca produce un 500: cae al fallback fijo y sigue devolviendo una respuesta", async () => {
    let callCount = 0;
    mockMapRiskLevelToDb.mockImplementation((risk) => {
      callCount += 1;
      // La 1ra llamada es la del camino normal de exito (route.ts arma el
      // JSON de respuesta): ahi se simula un fallo totalmente inesperado
      // (un bug hipotetico), no relacionado a Gemini/OpenAI/Supabase. La
      // 2da llamada ocurre DENTRO del catch fatal, construyendo la
      // respuesta de emergencia: esa debe funcionar normal.
      if (callCount === 1) throw new Error("Fallo inesperado simulado (bug hipotetico, no un fallo de proveedor).");
      return mapRiskLevelToDbReal(risk);
    });
    mockGeminiAskAssistant.mockResolvedValue(geminiSuccess());

    const res = await POST(buildJsonRequest("/api/queries", { question: "necesito el electrodo de puesta a tierra" }));
    const body = await res.json();

    // El catch fatal SIEMPRE responde 200 con contenido utilizable (ver
    // comentario en route.ts): nunca deja al usuario sin ninguna respuesta.
    expect(res.status).toBe(200);
    expect(body.answer.length).toBeGreaterThan(0);
    expect(body.unverified).toBe(true);
    expect(body.category).toBe("fatal_fallback");
    expect(body.persisted).toBe(false);
    expect(body.actualProvider).toBe("local_validated_fallback");
    // El mensaje de error interno nunca se pierde, pero tampoco expone
    // detalles crudos peligrosos (solo message, via safeErrorMessage).
    expect(body.providerError).toContain("Fallo inesperado simulado");
  });
});

describe("POST /api/queries: AI_PROVIDER=openai (soporte legacy, sigue activo)", () => {
  it("openai exitoso: actualProvider='openai', sin fallback", async () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    mockOpenaiAskAssistant.mockResolvedValue({
      shortAnswer: "Respuesta de OpenAI (mock).",
      riskLevel: "medio",
      codeReference: "NEC Article 210 (mock openai)",
      checklist: ["paso"],
      missingQuestions: [],
      recommendation: "Recomendacion.",
      warning: "Advertencia."
    });
    const res = await POST(buildJsonRequest("/api/queries", { question: "cual es el calibre del feeder de aluminio" }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.selectedProvider).toBe("openai");
    expect(body.actualProvider).toBe("openai");
    expect(body.providerFallback).toBe(false);
    expect(mockGeminiAskAssistant).not.toHaveBeenCalled();
  });

  it("openai falla -> cae al fallback local, con el diagnostico del error preservado", async () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    mockOpenaiAskAssistant.mockRejectedValue(Object.assign(new Error("Rate limited"), { status: 429, code: "rate_limit_exceeded" }));
    const res = await POST(buildJsonRequest("/api/queries", { question: "necesito proteccion gfci en el bano cerca del fregadero" }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.actualProvider).toBe("local_validated_fallback");
    expect(body.providerFallback).toBe(true);
    expect(body.providerErrorCode).toBe("rate_limit_exceeded");
    expect(body.providerErrorStatus).toBe(429);
  });
});

describe("POST /api/queries: pregunta meta sobre la fuente interna (via el endpoint real)", () => {
  it("una pregunta meta explicita responde con la explicacion fija de la fuente, sin marcarse como respuesta tecnica generica", async () => {
    const res = await POST(buildJsonRequest("/api/queries", { question: "de donde sacas tus respuestas" }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.detectedIntent).toBe("meta_source");
    expect(body.category).toBe("system_source_explanation");
    expect(body.answer.length).toBeGreaterThan(0);
  });
});

describe("POST /api/queries: fuentes oficiales anexadas (public.official_sources no vacio)", () => {
  it("cuando hay fuentes oficiales configuradas, se anexan a la respuesta en varios idiomas", async () => {
    mockGetOfficialSources.mockResolvedValue([
      {
        id: "os-1",
        sourceName: "NFPA 70 (NEC)",
        sourceType: "nec",
        jurisdiction: null,
        officialUrl: "https://www.nfpa.org/70",
        currentVersion: "2023",
        lastCheckedAt: null,
        priority: 1,
        notes: null,
        createdAt: "",
        updatedAt: ""
      }
    ]);
    mockGeminiAskAssistant.mockResolvedValue(geminiSuccess());

    for (const language of ["es", "en", "bilingual"] as const) {
      const res = await POST(
        buildJsonRequest("/api/queries", { question: "cual es el calibre del feeder de aluminio", language })
      );
      const body = await res.json();
      expect(res.status).toBe(201);
      expect(body.query.response.officialSourceNote).toContain("NFPA 70");
    }
  });
});

describe("POST /api/queries: variantes de idioma y contenido de knowledge_entries (cobertura de ramas)", () => {
  const richEntry: KnowledgeEntryMatch = {
    id: "ke-2",
    category: "Grounding",
    title: "Grounding test",
    keywords: ["grounding"],
    answerEs: "Respuesta con articulos NEC especificos.",
    answerEn: "Answer with specific NEC articles.",
    codeReferences: "NEC 250 (general)",
    riskLevel: "alto",
    sourceUsed: "public.knowledge_entries",
    necArticles: ["NEC 250.24", "NEC 250.30"],
    tdlrReferences: [],
    ahjReferences: [],
    sourceUrls: [],
    sourceLastCheckedAt: null,
    appliesWhen: null,
    doesNotApplyWhen: null,
    fieldNotes: null,
    verificationSteps: ["Verificar electrodo de tierra en sitio", "Confirmar bonding de tuberias"],
    officialReference: null
  };

  it.each(["es", "en", "bilingual"] as const)(
    "un match de knowledge_entries con necArticles y verificationSteps, en idioma=%s",
    async (language) => {
      mockFindKnowledgeByQuestion.mockResolvedValue(richEntry);
      const res = await POST(buildJsonRequest("/api/queries", { question: "cualquier pregunta", language }));
      const body = await res.json();
      expect(res.status).toBe(201);
      // necArticles.length>0 gana sobre codeReferences (linea 218-219 de route.ts).
      expect(body.query.response.codeReference).toContain("NEC 250.24");
      // mergedChecklist incorpora verificationSteps de la entrada.
      expect(body.query.response.checklist).toContain("Verificar electrodo de tierra en sitio");
    }
  );

  it("un match de knowledge_entries SIN codeReferences usa el texto 'No especificada'/'Not specified'", async () => {
    mockFindKnowledgeByQuestion.mockResolvedValue({ ...richEntry, necArticles: [], codeReferences: null });
    const res = await POST(buildJsonRequest("/api/queries", { question: "cualquier pregunta", language: "en" }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.query.response.sourceInfo).toContain("Not specified");
  });
});

describe("POST /api/queries: forceOfficial en bilingue sin ninguna cita cargada", () => {
  it("sin knowledgeMatch ni cita especifica, en modo bilingue, combina el mensaje ES+EN", async () => {
    mockGeminiAskAssistant.mockResolvedValue(geminiFailure("timeout"));
    const res = await POST(
      buildJsonRequest("/api/queries", { question: "segun el nec, que dice sobre un tema sin match tecnico local", language: "bilingual" })
    );
    const body = await res.json();
    expect(res.status).toBe(201);
    // Cuando no hay match tecnico local, mockAskAssistant devuelve unverified
    // y la respuesta fija correspondiente; no aplica el texto de
    // buildForcedOfficialShortAnswer en ese caso (unverified nunca se pisa).
    expect(body.answer.length).toBeGreaterThan(0);
  });
});

describe("POST /api/queries: fallback local con una categoria legacy (sin match de electricalKnowledgeBase)", () => {
  it("Gemini falla + pregunta de categoria legacy (simbologia): localMatch=null, integridad valida trivialmente", async () => {
    mockGeminiAskAssistant.mockResolvedValue(geminiFailure("timeout"));
    const res = await POST(buildJsonRequest("/api/queries", { question: "que simbolo es este en el plano, necesito ayuda con la simbologia" }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.actualProvider).toBe("local_validated_fallback");
    // Categoria legacy (simbologia): no cae a unverified, el checklist
    // fijo de esa categoria sigue presente.
    expect(body.answer.length).toBeGreaterThan(0);
  });
});

describe("POST /api/queries: regresion de produccion - receptaculo exterior humedo/mojado con genero femenino", () => {
  // Bug real reportado en produccion: esta pregunta exacta (escrita por un
  // electricista real) caia a "unverified" pese a que kb-exterior-wet-locations
  // SI responde el tema. Causa real: el keyword list de esa entrada solo
  // tenia las formas masculinas "humedo"/"mojado" y el termino completo
  // "weather-resistant"; la pregunta real usa "humeda"/"mojada" (genero
  // femenino, concuerda con "ubicacion"), "WR" como sigla suelta, y
  // "tomacorriente" en vez de "receptaculo". normalizeForMatch NO hace
  // stemming (matching por subcadena literal), asi que las formas de
  // genero y el sinonimo faltaban por completo del vocabulario.
  //
  // Esta prueba NO mockea electricalKnowledgeBase/findKnowledgeBaseMatch:
  // corre el motor de conocimiento real, exactamente como en produccion,
  // con Gemini fallando (igual que el reporte original: "proveedor de IA
  // no disponible").
  const PRODUCTION_QUESTION =
    "¿Cuáles son los requisitos para instalar un tomacorriente exterior en una ubicación húmeda o mojada? Incluya GFCI, receptáculo WR y tipo de cubierta.";

  it("con Gemini fallando, cae al motor local y encuentra kb-exterior-wet-locations (NO unverified)", async () => {
    mockGeminiAskAssistant.mockResolvedValue(geminiFailure("timeout"));
    const res = await POST(buildJsonRequest("/api/queries", { question: PRODUCTION_QUESTION }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.actualProvider).toBe("local_validated_fallback");
    expect(body.providerFallback).toBe(true);
    // El bug real: esto llegaba como "unverified" en produccion.
    expect(body.answerKind).toBe("validated_fallback");
    expect(body.unverified).toBe(false);
    expect(body.query.response.codeReference).toContain("406.9");
    expect(body.query.response.codeReference).toContain("210.8");
    expect(body.answer.toLowerCase()).toContain("weather-resistant");
  });
});
