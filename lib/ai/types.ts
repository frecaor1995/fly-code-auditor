import type { AssistantResponse, Language } from "../db/types";

export type { AssistantResponse };

export interface AskAssistantInput {
  question: string;
  language: Language;
  projectContext?: string;
}

export interface AnalyzePlanInput {
  question: string;
  language: Language;
  fileName: string;
  fileType: "pdf" | "image";
  sheet?: string;
  imageBase64?: string;
}

export interface AiAdapter {
  askAssistant(input: AskAssistantInput): Promise<AssistantResponse>;
  analyzePlan(input: AnalyzePlanInput): Promise<AssistantResponse>;
}

export const STANDARD_WARNING_ES =
  "Esta respuesta es una guia interna. Verifique el articulo NEC aplicable, TDLR, Houston AHJ, permisos, inspecciones y aprobacion del Master Electrician.";

export const STANDARD_WARNING_EN =
  "This response is an internal guide. Verify the applicable NEC article, TDLR, Houston AHJ, permits, inspections, and Master Electrician approval.";

export function standardWarning(language: Language): string {
  if (language === "en") return STANDARD_WARNING_EN;
  if (language === "bilingual") return `${STANDARD_WARNING_ES}\n${STANDARD_WARNING_EN}`;
  return STANDARD_WARNING_ES;
}

export const VERIFY_NEC_ES = "Verificar articulo exacto con NEC oficial, Master Electrician o AHJ.";
export const VERIFY_NEC_EN = "Verify the exact article with the official NEC, Master Electrician, or AHJ.";

export function verifyNecMessage(language: Language): string {
  if (language === "en") return VERIFY_NEC_EN;
  if (language === "bilingual") return `${VERIFY_NEC_ES} / ${VERIFY_NEC_EN}`;
  return VERIFY_NEC_ES;
}
