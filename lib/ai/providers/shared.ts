// Utilidades compartidas entre proveedores de IA reales (OpenAI, Gemini):
// mismo prompt de sistema, mismas instrucciones de formato JSON, mismo
// parser de la respuesta hacia AssistantResponse. Evita que los dos
// proveedores diverjan en el contrato que el resto de la app espera (ver
// lib/db/types.ts#AssistantResponse, consumido tal cual por
// components/assistant/AssistantResponseCard.tsx).

import type { AssistantResponse, Language } from "../../db/types";
import { standardWarning } from "../types";
import { SYSTEM_PROMPT_ES } from "../prompts/system.es";
import { SYSTEM_PROMPT_EN } from "../prompts/system.en";
import { SYSTEM_PROMPT_BILINGUAL } from "../prompts/system.bilingual";

export function systemPromptFor(language: Language): string {
  if (language === "en") return SYSTEM_PROMPT_EN;
  if (language === "bilingual") return SYSTEM_PROMPT_BILINGUAL;
  return SYSTEM_PROMPT_ES;
}

export const JSON_INSTRUCTIONS = `
Responde UNICAMENTE con un objeto JSON valido (sin markdown, sin backticks) con esta forma exacta:
{
  "shortAnswer": string,
  "englishSummary": string | null,
  "riskLevel": "bajo" | "medio" | "alto" | "critico",
  "codeReference": string,
  "planReading": {
    "sheet": string | null,
    "symbolsVisible": string[],
    "equipmentIdentified": string[],
    "panelsIdentified": string[],
    "circuitsVisible": string[],
    "notes": string[],
    "missingInfo": string[]
  } | null,
  "checklist": string[],
  "missingQuestions": string[],
  "recommendation": string
}
No incluyas el campo "warning": se agrega automaticamente fuera del modelo.
`;

// Error con .code="invalid_json_response" para distinguir "el modelo
// respondio pero el contenido no era JSON valido" de un error real de la
// API (401/403/429/etc) en el diagnostico de app/api/queries/route.ts.
export class InvalidModelJsonError extends Error {
  code = "invalid_json_response";
  constructor(message: string) {
    super(message);
    this.name = "InvalidModelJsonError";
  }
}

// Error con .code="schema_validation_failed": el modelo devolvio JSON
// sintacticamente valido, pero que NO tiene la forma minima de
// AssistantResponse (ej. shortAnswer vacio, un objeto envoltorio distinto,
// tipos incorrectos). Sin este chequeo, una respuesta asi se aceptaria como
// "ok: true" con contenido practicamente vacio en vez de caer al fallback
// local validado.
export class SchemaValidationError extends Error {
  code = "schema_validation_failed";
  constructor(message: string) {
    super(message);
    this.name = "SchemaValidationError";
  }
}

const VALID_RISK_LEVELS = new Set(["bajo", "medio", "alto", "critico"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function assertMinimalShape(parsed: any): void {
  if (!parsed || typeof parsed !== "object") {
    throw new SchemaValidationError("El modelo respondio JSON valido pero no es un objeto.");
  }
  if (typeof parsed.shortAnswer !== "string" || !parsed.shortAnswer.trim()) {
    throw new SchemaValidationError("El modelo respondio JSON valido pero sin 'shortAnswer' utilizable.");
  }
  if (parsed.riskLevel !== undefined && parsed.riskLevel !== null && !VALID_RISK_LEVELS.has(parsed.riskLevel)) {
    throw new SchemaValidationError(`El modelo devolvio un riskLevel invalido: "${parsed.riskLevel}".`);
  }
  if (parsed.checklist !== undefined && parsed.checklist !== null && !Array.isArray(parsed.checklist)) {
    throw new SchemaValidationError("El modelo devolvio 'checklist' con un tipo invalido (se esperaba array).");
  }
  if (parsed.missingQuestions !== undefined && parsed.missingQuestions !== null && !Array.isArray(parsed.missingQuestions)) {
    throw new SchemaValidationError("El modelo devolvio 'missingQuestions' con un tipo invalido (se esperaba array).");
  }
}

export function parseAssistantJson(content: string, language: Language): AssistantResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new InvalidModelJsonError("El modelo respondio con contenido que no es JSON valido.");
  }

  assertMinimalShape(parsed);

  return {
    shortAnswer: parsed.shortAnswer ?? "",
    englishSummary: parsed.englishSummary ?? undefined,
    riskLevel: parsed.riskLevel ?? "medio",
    codeReference: parsed.codeReference ?? "",
    planReading: parsed.planReading ?? undefined,
    checklist: Array.isArray(parsed.checklist) ? parsed.checklist : [],
    missingQuestions: Array.isArray(parsed.missingQuestions) ? parsed.missingQuestions : [],
    recommendation: parsed.recommendation ?? "",
    // La advertencia final SIEMPRE se fuerza aqui, nunca se confia en que el
    // modelo la incluya o la redacte igual cada vez.
    warning: standardWarning(language)
  };
}
