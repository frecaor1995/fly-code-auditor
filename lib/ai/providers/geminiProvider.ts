// Proveedor Gemini (Google Generative Language API), server-side only.
//
// Implementado con fetch() crudo contra la REST API en vez de instalar un
// SDK nuevo: da control total sobre timeout, status HTTP y forma del error
// (necesario para el diagnostico pedido: 400/401/403/404/429/timeout/red/
// JSON invalido), sin agregar una dependencia mas al proyecto.
//
// Contrato de salida: geminiAskAssistant() NUNCA lanza. Siempre devuelve un
// GeminiCallResult con { ok, attemptedProvider, providerModel, response,
// providerErrorCode, providerErrorMessage, httpStatus, durationMs } para
// que el caller (app/api/queries/route.ts) no necesite try/catch propio
// por proveedor, y para que quede claro que "attemptedProvider: gemini" es
// SOLO a quien se llamo, no necesariamente quien produjo el texto (eso lo
// decide route.ts segun ok/response: si ok=false, el texto final sale del
// motor local, no de Gemini).

import type { AssistantResponse } from "../../db/types";
import type { AskAssistantInput } from "../types";
import { systemPromptFor, JSON_INSTRUCTIONS, parseAssistantJson } from "./shared";
import { withTimeout, safeErrorMessage, TimeoutError } from "../../utils/resilience";

const GEMINI_TIMEOUT_MS = 15000;
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiCallResult {
  ok: boolean;
  attemptedProvider: "gemini";
  providerModel: string;
  response: AssistantResponse | null;
  providerErrorCode: string | null;
  providerErrorMessage: string | null;
  httpStatus: number | null;
  durationMs: number;
}

// Error interno con .code/.status ya clasificados; nunca se propaga fuera
// de este archivo (geminiAskAssistant lo captura y lo convierte en
// GeminiCallResult), pero se modela como Error para reusar
// safeErrorMessage/instanceof Error de forma consistente con el resto del
// codigo.
class GeminiProviderError extends Error {
  code: string;
  status: number | null;
  constructor(message: string, code: string, status: number | null) {
    super(message);
    this.name = "GeminiProviderError";
    this.code = code;
    this.status = status;
  }
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

// Mapea el status HTTP (y, cuando esta disponible, el "status" enum que
// devuelve la API de Google, ej. RESOURCE_EXHAUSTED/PERMISSION_DENIED) a un
// codigo corto y estable para el diagnostico, sin exponer la respuesta cruda.
function mapHttpStatusToCode(status: number, googleStatus: string | null): string {
  if (googleStatus) return googleStatus.toLowerCase();
  switch (status) {
    case 400:
      return "invalid_request";
    case 401:
      return "invalid_api_key";
    case 403:
      return "permission_denied";
    case 404:
      return "model_not_found";
    case 429:
      return "rate_limit_or_quota";
    default:
      return `http_${status}`;
  }
}

// Llamada HTTP cruda a generateContent. Lanza GeminiProviderError con
// .code/.status ya resueltos para 400/401/403/404/429/timeout/red/JSON
// invalido; nunca incluye la API key en el mensaje (se envia por header,
// nunca se interpola en texto de error).
async function callGenerateContent(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userText: string
): Promise<unknown> {
  const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`;

  let res: Response;
  try {
    res = await withTimeout(
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: userText }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      }),
      GEMINI_TIMEOUT_MS,
      "gemini"
    );
  } catch (error) {
    if (error instanceof TimeoutError) {
      throw new GeminiProviderError("Tiempo de espera agotado llamando a Gemini.", "timeout", null);
    }
    throw new GeminiProviderError(safeErrorMessage(error, "Error de red llamando a Gemini."), "network_error", null);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await res.json();
  } catch {
    throw new GeminiProviderError("Gemini respondio con contenido que no es JSON valido.", "invalid_json_response", res.status);
  }

  if (!res.ok) {
    const googleStatus: string | null = body?.error?.status ?? null;
    const code = mapHttpStatusToCode(res.status, googleStatus);
    const message: string = body?.error?.message ?? `Gemini respondio con error HTTP ${res.status}.`;
    throw new GeminiProviderError(message, code, res.status);
  }

  return body;
}

function extractText(body: unknown): string | null {
  const candidates = (body as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })?.candidates;
  const text = candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === "string" && text.trim() ? text : null;
}

// Extrae .code de CUALQUIER error conocido de este archivo o de
// parseAssistantJson (InvalidModelJsonError/SchemaValidationError en
// shared.ts), sin acoplar este archivo a esas clases via instanceof
// (duck-typing sobre .code, que ambas exponen).
function errorCodeOf(error: unknown): string {
  if (error instanceof GeminiProviderError) return error.code;
  const withCode = error as { code?: unknown };
  if (typeof withCode?.code === "string") return withCode.code;
  return "unknown_error";
}

// Punto de entrada usado por app/api/queries/route.ts. NUNCA lanza: toda
// falla (config faltante, 400/401/403/404/429, timeout, red, JSON invalido,
// JSON valido pero con forma incorrecta, respuesta vacia) se captura y se
// devuelve como { ok: false, providerErrorCode, providerErrorMessage }.
export async function geminiAskAssistant(input: AskAssistantInput): Promise<GeminiCallResult> {
  const model = getGeminiModel();
  const startedAt = Date.now();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new GeminiProviderError("GEMINI_API_KEY no esta configurada.", "missing_api_key", null);
    }

    const systemPrompt = systemPromptFor(input.language) + JSON_INSTRUCTIONS;
    const userText = input.projectContext
      ? `Contexto del proyecto: ${input.projectContext}\n\nPregunta: ${input.question}`
      : input.question;

    const body = await callGenerateContent(apiKey, model, systemPrompt, userText);
    const text = extractText(body);
    if (!text) {
      throw new GeminiProviderError("Gemini no devolvio contenido de texto en la respuesta.", "empty_response", null);
    }

    // parseAssistantJson puede lanzar InvalidModelJsonError o
    // SchemaValidationError (ver lib/ai/providers/shared.ts); ambas se
    // capturan abajo igual que un GeminiProviderError.
    const response = parseAssistantJson(text, input.language);
    return {
      ok: true,
      attemptedProvider: "gemini",
      providerModel: model,
      response,
      providerErrorCode: null,
      providerErrorMessage: null,
      httpStatus: 200,
      durationMs: Date.now() - startedAt
    };
  } catch (error) {
    const code = errorCodeOf(error);
    const status = error instanceof GeminiProviderError ? error.status : null;
    const message = safeErrorMessage(error, "Gemini no respondio.");
    return {
      ok: false,
      attemptedProvider: "gemini",
      providerModel: model,
      response: null,
      providerErrorCode: code,
      providerErrorMessage: message,
      httpStatus: status,
      durationMs: Date.now() - startedAt
    };
  }
}

// Ping minimo y barato para app/api/health/ai-providers/route.ts: confirma
// que la API key, el modelo configurado y la red hacia Gemini funcionan de
// verdad (no solo que la variable de entorno existe). Reusa
// callGenerateContent con un prompt trivial y sin exigir formato JSON (mas
// barato y menos propenso a fallar por parseo).
export async function pingGemini(): Promise<{ ok: boolean; code: string | null; message: string | null }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, code: "missing_api_key", message: "GEMINI_API_KEY no esta configurada." };

  const model = getGeminiModel();
  const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`;

  try {
    const res = await withTimeout(
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "ping" }] }],
          generationConfig: { maxOutputTokens: 5 }
        })
      }),
      GEMINI_TIMEOUT_MS,
      "gemini-health"
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      return { ok: false, code: "invalid_json_response", message: "Gemini respondio con contenido que no es JSON valido." };
    }

    if (!res.ok) {
      const googleStatus: string | null = body?.error?.status ?? null;
      const code = mapHttpStatusToCode(res.status, googleStatus);
      const message: string = body?.error?.message ?? `Gemini respondio con error HTTP ${res.status}.`;
      return { ok: false, code, message };
    }

    return { ok: true, code: null, message: null };
  } catch (error) {
    if (error instanceof TimeoutError) {
      return { ok: false, code: "timeout", message: "Tiempo de espera agotado llamando a Gemini." };
    }
    return { ok: false, code: "network_error", message: safeErrorMessage(error, "Error de red llamando a Gemini.") };
  }
}
