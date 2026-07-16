import type { AssistantResponse } from "../db/types";
import type { AskAssistantInput, AnalyzePlanInput } from "./types";
import { mockAskAssistant } from "./mockAssistant";
import { mockAnalyzePlan } from "./mockPlanAnalyzer";
import { openaiAskAssistant, openaiAnalyzePlan } from "./openaiAssistant";

function useMock(): boolean {
  return process.env.USE_MOCK_AI !== "false";
}

// Expuesto para que app/api/queries/route.ts y app/api/health/query-engine/
// route.ts puedan decidir/diagnosticar el modo (mock vs OpenAI) sin duplicar
// la lectura de USE_MOCK_AI.
export function isMockAiEnabled(): boolean {
  return useMock();
}

// El motor local (mock) es siempre la ruta garantizada: no depende de ninguna
// API paga ni servicio externo. Si USE_MOCK_AI=false y el proveedor externo
// falla por cualquier razon (sin API key, error de red, rate limit), se cae
// automaticamente al motor local en vez de dejar la consulta sin respuesta.
export async function askAssistant(input: AskAssistantInput): Promise<AssistantResponse> {
  if (useMock()) return mockAskAssistant(input);
  try {
    return await openaiAskAssistant(input);
  } catch {
    return mockAskAssistant(input);
  }
}

export async function analyzePlan(input: AnalyzePlanInput): Promise<AssistantResponse> {
  if (useMock()) return mockAnalyzePlan(input);
  try {
    return await openaiAnalyzePlan(input);
  } catch {
    return mockAnalyzePlan(input);
  }
}
