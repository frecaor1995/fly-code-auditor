import type { AssistantResponse, Language } from "@/lib/db/types";

// Fallback 100% cliente: sin red, sin fs. Solo se usa cuando la llamada a
// /api/queries falla por completo (red caida, funcion serverless sin
// responder, respuesta no-JSON, etc.). Garantiza que "Preguntar" siempre
// muestre un panel de respuesta en modo mock, incluso si el backend no
// esta disponible en ese momento.
export function buildOfflineFallbackResponse(language: Language): AssistantResponse {
  const es =
    "No se pudo contactar al servidor, asi que esta es una respuesta generica en modo local (sin conexion). Verifica el articulo NEC aplicable, documenta la pregunta y confirmala con el Master Electrician antes de proceder. Intenta de nuevo en unos segundos para obtener la respuesta completa del motor interno.";
  const en =
    "The server could not be reached, so this is a generic local (offline) answer. Check the applicable NEC article, document the question, and confirm with the Master Electrician before proceeding. Try again in a few seconds for the full answer from the internal engine.";

  return {
    shortAnswer: es,
    englishSummary: language !== "es" ? en : undefined,
    riskLevel: "medio",
    codeReference: "No disponible sin conexion al servidor. Verifique el NEC oficial y consulte al Master Electrician.",
    checklist: [
      "Reintentar la consulta cuando haya conexion",
      "Documentar la pregunta original",
      "Confirmar con el Master Electrician antes de proceder"
    ],
    missingQuestions: [],
    recommendation:
      "Reintentar en unos segundos. Si el problema persiste, avisa a soporte interno para revisar la conexion con el servidor.",
    warning:
      "Respuesta generada localmente sin conexion al servidor. No reemplaza la respuesta completa del motor interno ni el NEC oficial."
  };
}
