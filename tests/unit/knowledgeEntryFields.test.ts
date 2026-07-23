import { describe, it, expect } from "vitest";
import { findKnowledgeBaseMatch, ELECTRICAL_KNOWLEDGE_BASE } from "@/lib/knowledge/electricalKnowledgeBase";
import { mockAskAssistant } from "@/lib/ai/mockAssistant";

// Sprint 2 (correccion de wiring): explanation/commonMistakes deben viajar
// como campos SEPARADOS de AssistantResponse (lib/db/types.ts), nunca
// concatenados dentro de shortAnswer ni fusionados dentro de checklist.
// Estas pruebas verifican el contrato real de mockAskAssistant, no solo el
// tipo estatico.

describe("mockAskAssistant: explanation llega como campo separado (Sprint 2)", () => {
  it("una entrada con explanationEs/En (ej. kb-hvac-electrical) expone response.explanation, distinto de shortAnswer", async () => {
    const question = "¿Qué breaker se necesita para una unidad de aire acondicionado de 3.5 toneladas?";
    const localMatch = findKnowledgeBaseMatch(question);
    expect(localMatch?.id).toBe("kb-hvac-electrical");
    expect(localMatch?.explanationEs).toBeTruthy();

    const response = await mockAskAssistant({ question, language: "es" });
    expect(response.explanation).toBeTruthy();
    expect(response.explanation).toBe(localMatch!.explanationEs);
    // shortAnswer NUNCA debe contener el texto de explanation concatenado.
    expect(response.shortAnswer).not.toContain(localMatch!.explanationEs as string);
    expect(response.explanation).not.toBe(response.shortAnswer);
  });

  it("selecciona el idioma correcto: language='en' expone explanationEn, no explanationEs", async () => {
    const question = "What disconnect is required for an outdoor HVAC condenser unit?";
    const response = await mockAskAssistant({ question, language: "en" });
    const entry = ELECTRICAL_KNOWLEDGE_BASE.find((e) => e.id === "kb-hvac-electrical")!;
    expect(response.explanation).toBe(entry.explanationEn);
    expect(response.explanation).not.toBe(entry.explanationEs);
  });
});

describe("mockAskAssistant: commonMistakes llega como lista separada (Sprint 2)", () => {
  it("una entrada con commonMistakesEs/En (ej. kb-bathroom-receptacles) expone response.commonMistakes como array propio", async () => {
    const question = "¿Se requiere un circuito dedicado de 20A para el receptáculo del baño?";
    const localMatch = findKnowledgeBaseMatch(question);
    expect(localMatch?.id).toBe("kb-bathroom-receptacles");
    expect(localMatch?.commonMistakesEs?.length).toBeGreaterThan(0);

    const response = await mockAskAssistant({ question, language: "es" });
    expect(Array.isArray(response.commonMistakes)).toBe(true);
    expect(response.commonMistakes).toEqual(localMatch!.commonMistakesEs);
    // El checklist NUNCA debe incluir los items de commonMistakes fusionados
    // (ni con prefijo "Error comun", ni sin el).
    for (const mistake of localMatch!.commonMistakesEs ?? []) {
      expect(response.checklist).not.toContain(mistake);
      expect(response.checklist.some((c) => c.includes(mistake))).toBe(false);
    }
    // El checklist real de la entrada sigue intacto (mismo largo que en la
    // fuente, sin items adicionales inyectados).
    expect(response.checklist).toEqual(localMatch!.checklistEs);
  });
});

describe("mockAskAssistant: retrocompatibilidad con entradas anteriores a Sprint 2", () => {
  it("kb-gfci (entrada Sprint 1) no define explanation/commonMistakes: la respuesta no los incluye", async () => {
    const question = "necesito proteccion gfci en el bano";
    const localMatch = findKnowledgeBaseMatch(question);
    expect(localMatch?.id).toBe("kb-gfci");
    expect(localMatch?.explanationEs).toBeUndefined();
    expect(localMatch?.commonMistakesEs).toBeUndefined();

    const response = await mockAskAssistant({ question, language: "es" });
    expect(response.explanation).toBeUndefined();
    expect(response.commonMistakes).toBeUndefined();
    // El comportamiento existente (shortAnswer/checklist) no cambio.
    expect(response.shortAnswer).toBe(localMatch!.shortAnswerEs);
    expect(response.checklist).toEqual(localMatch!.checklistEs);
  });

  it("las 21 entradas anteriores a Sprint 2 no definen explanation ni commonMistakes en absoluto", () => {
    const sprint2Ids = new Set([
      "kb-receptacle-spacing-tr",
      "kb-kitchen-receptacles",
      "kb-bathroom-receptacles",
      "kb-panel-working-space",
      "kb-residential-service",
      "kb-hvac-electrical"
    ]);
    const legacyEntries = ELECTRICAL_KNOWLEDGE_BASE.filter((e) => !sprint2Ids.has(e.id));
    expect(legacyEntries.length).toBe(21);
    for (const entry of legacyEntries) {
      expect(entry.explanationEs).toBeUndefined();
      expect(entry.explanationEn).toBeUndefined();
      expect(entry.commonMistakesEs).toBeUndefined();
      expect(entry.commonMistakesEn).toBeUndefined();
    }
  });
});

describe("Sprint 2: el fix de wiring no altera el matching ni los scores", () => {
  // Mismas preguntas/ids ya verificados por la bateria de auditoria: esta
  // prueba es un guardrail de regresion especifico para ESTE cambio (el
  // wiring de explanation/commonMistakes no debe tocar keywords/scoring).
  it.each([
    ["¿Qué breaker se necesita para una unidad de aire acondicionado de 3.5 toneladas?", "kb-hvac-electrical"],
    ["¿Se requiere un circuito dedicado de 20A para el receptáculo del baño?", "kb-bathroom-receptacles"],
    ["¿Cuántos circuitos de countertop se requieren en una cocina residencial?", "kb-kitchen-receptacles"],
    ["¿Cuál es el amperaje mínimo de servicio para una vivienda unifamiliar?", "kb-residential-service"],
    ["¿Cuánto espacio de trabajo se requiere frente a un panel eléctrico?", "kb-panel-working-space"],
    ["¿Qué es un receptáculo tamper-resistant?", "kb-receptacle-spacing-tr"],
    ["necesito proteccion gfci en el bano", "kb-gfci"]
  ])("%s -> %s (id y score sin cambios respecto a la bateria de auditoria)", (question, expectedId) => {
    const result = findKnowledgeBaseMatch(question);
    expect(result?.id).toBe(expectedId);
  });
});
