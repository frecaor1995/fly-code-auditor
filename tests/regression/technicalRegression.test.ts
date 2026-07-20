import { describe, it, expect } from "vitest";
import { mockAskAssistant } from "@/lib/ai/mockAssistant";
import { classifyIntent } from "@/lib/ai/intentClassifier";
import { normalizeForMatch } from "@/lib/knowledge/matchEngine";
import type { AssistantResponse } from "@/lib/db/types";
import { TECHNICAL_REGRESSION_CASES } from "../fixtures/technical-regression-cases";

// FASE F: runner de la suite de regresion tecnica. Ejecuta cada caso de
// tests/fixtures/technical-regression-cases.ts contra el motor local real
// (lib/ai/mockAssistant.ts) - NUNCA contra Gemini/OpenAI/Supabase reales.
// Valida invariantes (terminos/referencias requeridas y prohibidas,
// intencion clasificada, si pide datos faltantes), nunca un parrafo
// completo comparado literal.

function combinedResponseText(response: AssistantResponse): string {
  return normalizeForMatch(
    [response.shortAnswer, response.englishSummary ?? "", response.checklist.join(" "), response.missingQuestions.join(" "), response.recommendation].join(
      " "
    )
  );
}

describe("Suite de regresion tecnica (fixtures)", () => {
  it(`hay al menos 40 casos tecnicos + casos de seguridad (total actual: ${TECHNICAL_REGRESSION_CASES.length})`, () => {
    const technicalCases = TECHNICAL_REGRESSION_CASES.filter((c) => c.category !== "security");
    const securityCases = TECHNICAL_REGRESSION_CASES.filter((c) => c.category === "security");
    expect(technicalCases.length).toBeGreaterThanOrEqual(40);
    expect(securityCases.length).toBeGreaterThan(0);
  });

  it("todos los ids de los casos son unicos", () => {
    const ids = TECHNICAL_REGRESSION_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const testCase of TECHNICAL_REGRESSION_CASES) {
    it(`[${testCase.category}] ${testCase.id}: ${testCase.notes}`, async () => {
      const response = await mockAskAssistant({ question: testCase.question, language: testCase.language });
      const intent = classifyIntent(testCase.question);
      const text = combinedResponseText(response);
      const codeRef = normalizeForMatch(response.codeReference);

      expect(intent.intent).toBe(testCase.expectedIntent);
      // Contrato de la suite (ver comentario de cabecera en el fixture):
      // se ejecuta siempre contra el motor local -> "mock" nunca es un
      // fallback, es el proveedor real usado por esta suite.
      expect(testCase.expectedActualProvider).toBe("mock");

      for (const term of testCase.requiredTerms) {
        expect(text, `esperaba encontrar el termino requerido "${term}"`).toContain(normalizeForMatch(term));
      }
      for (const term of testCase.forbiddenTerms) {
        expect(text, `el termino prohibido "${term}" no deberia aparecer`).not.toContain(normalizeForMatch(term));
      }
      for (const ref of testCase.requiredReferences) {
        expect(codeRef, `esperaba la referencia requerida "${ref}" en codeReference`).toContain(normalizeForMatch(ref));
      }
      for (const ref of testCase.forbiddenReferences) {
        expect(codeRef, `la referencia prohibida "${ref}" no deberia aparecer en codeReference`).not.toContain(normalizeForMatch(ref));
      }
      expect(response.missingQuestions.length > 0, "mustAskForMissingData no coincide con missingQuestions").toBe(
        testCase.mustAskForMissingData
      );
    });
  }
});
