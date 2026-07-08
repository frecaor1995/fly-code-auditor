import type { AssistantResponse } from "../db/types";
import { standardWarning, verifyNecMessage, type AnalyzePlanInput } from "./types";

const CANNOT_CONFIRM_ES =
  "No se puede confirmar con la calidad actual del plano. Se recomienda revisar el PDF original, el set completo de planos o consultar al diseñador, Master Electrician o AHJ.";
const CANNOT_CONFIRM_EN =
  "This cannot be confirmed with the current drawing quality. Review of the original PDF, the full drawing set, or consultation with the designer, Master Electrician, or AHJ is recommended.";

// El motor mock NUNCA inventa simbolos, equipos o circuitos que "vio" en el
// archivo: no hay vision real conectada todavia (USE_MOCK_AI=true). Siempre
// responde con el mensaje honesto de limitacion y pide la hoja especifica,
// tal como exige el spec ("no debe inventar informacion").
export async function mockAnalyzePlan(input: AnalyzePlanInput): Promise<AssistantResponse> {
  const language = input.language;
  const cannotConfirm =
    language === "en" ? CANNOT_CONFIRM_EN : language === "bilingual" ? `${CANNOT_CONFIRM_ES}\n${CANNOT_CONFIRM_EN}` : CANNOT_CONFIRM_ES;

  return {
    shortAnswer: `Recibi el archivo "${input.fileName}"${input.sheet ? ` (hoja indicada: ${input.sheet})` : ""}. En este MVP el motor de analisis esta en modo de demostracion (sin vision de IA conectada). ${CANNOT_CONFIRM_ES}`,
    englishSummary:
      language !== "es"
        ? `Received file "${input.fileName}". This MVP's analysis engine is running in demo mode (no AI vision connected yet). ${CANNOT_CONFIRM_EN}`
        : undefined,
    riskLevel: "medio",
    codeReference: verifyNecMessage(language),
    planReading: {
      sheet: input.sheet,
      symbolsVisible: [],
      equipmentIdentified: [],
      panelsIdentified: [],
      circuitsVisible: [],
      notes: [cannotConfirm],
      missingInfo: [
        "Confirmar que el archivo tenga buena resolucion y este completo",
        "Indicar la hoja especifica (ej. E2.1 Power Plan, E4.1 Panel Schedules)",
        "Confirmar escala visible del dibujo"
      ]
    },
    checklist: [
      "Confirmar que el PDF/imagen tenga resolucion suficiente para leer notas y simbolos",
      "Confirmar la hoja especifica a revisar (E0.1 a E5.1)",
      "Verificar que el set de planos este completo (sin paginas faltantes)",
      "Solicitar el PDF original si la copia disponible esta recortada o borrosa"
    ],
    missingQuestions: [
      "Hoja especifica del plano (E0.1 General Notes, E1.1 Lighting Plan, E2.1 Power Plan, E3.1 One-Line Diagram, E4.1 Panel Schedules, E5.1 Details)",
      "Escala del dibujo",
      "Version o fecha del set de planos"
    ],
    recommendation:
      "Pedir mas informacion: sube el PDF original en buena resolucion e indica la hoja exacta para una lectura preliminar mas util. Conecta un proveedor de IA con vision (ver openaiAssistant.ts) para analisis real de imagenes.",
    warning: standardWarning(language)
  };
}
