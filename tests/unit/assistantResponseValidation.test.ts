import { describe, it, expect } from "vitest";
import { parseAssistantJson, InvalidModelJsonError, SchemaValidationError } from "@/lib/ai/providers/shared";

// FASE C.4: validacion de AssistantResponse. parseAssistantJson (lib/ai/providers/shared.ts)
// es el punto unico donde el texto crudo de un proveedor de IA (Gemini/OpenAI)
// se convierte en un AssistantResponse: es el "esquema" real de este
// proyecto (no hay un schema Zod/JSON Schema separado para esto).
//
// answerKind e internalSourceUsed (mencionados en el pedido) se calculan en
// app/api/queries/route.ts (computeAnswerKind, no exportada), no en esta
// capa: se prueban en tests/integration/queriesRoute.test.ts contra el
// contrato HTTP completo, no aqui contra una funcion privada.

describe("parseAssistantJson: AssistantResponse valido y completo", () => {
  it("mapea todos los campos de un JSON completo al AssistantResponse esperado", () => {
    const raw = JSON.stringify({
      shortAnswer: "Respuesta corta de prueba.",
      englishSummary: "Short English summary.",
      riskLevel: "alto",
      codeReference: "NEC 210.8",
      planReading: { sheet: "E1.1", symbolsVisible: ["GFCI"], equipmentIdentified: [], panelsIdentified: [], circuitsVisible: [], notes: [], missingInfo: [] },
      checklist: ["paso 1", "paso 2"],
      missingQuestions: ["falta dato 1"],
      recommendation: "Recomendacion de prueba."
    });
    const result = parseAssistantJson(raw, "es");
    expect(result.shortAnswer).toBe("Respuesta corta de prueba.");
    expect(result.englishSummary).toBe("Short English summary.");
    expect(result.riskLevel).toBe("alto");
    expect(result.codeReference).toBe("NEC 210.8");
    expect(result.checklist).toEqual(["paso 1", "paso 2"]);
    expect(result.missingQuestions).toEqual(["falta dato 1"]);
    expect(result.recommendation).toBe("Recomendacion de prueba.");
    expect(result.planReading?.sheet).toBe("E1.1");
  });

  it("la advertencia (warning) SIEMPRE se fuerza segun el idioma, nunca se toma del modelo", () => {
    const raw = JSON.stringify({ shortAnswer: "ok", warning: "esto no deberia usarse" });
    const result = parseAssistantJson(raw, "en");
    expect(result.warning).not.toContain("esto no deberia usarse");
    expect(result.warning.length).toBeGreaterThan(0);
  });

  it("aplica defaults seguros para campos opcionales ausentes", () => {
    const raw = JSON.stringify({ shortAnswer: "solo esto" });
    const result = parseAssistantJson(raw, "es");
    expect(result.checklist).toEqual([]);
    expect(result.missingQuestions).toEqual([]);
    expect(result.codeReference).toBe("");
    expect(result.recommendation).toBe("");
    expect(result.englishSummary).toBeUndefined();
    expect(result.planReading).toBeUndefined();
  });
});

describe("parseAssistantJson: JSON invalido", () => {
  it("clasifica contenido no-JSON como InvalidModelJsonError con code='invalid_json_response'", () => {
    expect(() => parseAssistantJson("esto no es JSON {{{", "es")).toThrow(InvalidModelJsonError);
    try {
      parseAssistantJson("esto no es JSON {{{", "es");
    } catch (error) {
      expect((error as InvalidModelJsonError).code).toBe("invalid_json_response");
    }
  });

  it("clasifica una respuesta con markdown/backticks alrededor del JSON como invalida (no intenta limpiarla)", () => {
    expect(() => parseAssistantJson("```json\n{\"shortAnswer\":\"x\"}\n```", "es")).toThrow(InvalidModelJsonError);
  });
});

describe("parseAssistantJson: JSON valido pero incompleto -> schema_validation_failed", () => {
  it("un objeto JSON valido sin shortAnswer utilizable lanza SchemaValidationError", () => {
    expect(() => parseAssistantJson(JSON.stringify({ riskLevel: "medio" }), "es")).toThrow(SchemaValidationError);
  });

  it("no se aceptan respuestas vacias (shortAnswer vacio o solo espacios)", () => {
    expect(() => parseAssistantJson(JSON.stringify({ shortAnswer: "" }), "es")).toThrow(SchemaValidationError);
    expect(() => parseAssistantJson(JSON.stringify({ shortAnswer: "   " }), "es")).toThrow(SchemaValidationError);
  });

  it("un array JSON (no un objeto) se rechaza como forma invalida", () => {
    expect(() => parseAssistantJson(JSON.stringify(["shortAnswer", "x"]), "es")).toThrow(SchemaValidationError);
  });

  it("null como JSON valido se rechaza (no es un objeto utilizable)", () => {
    expect(() => parseAssistantJson("null", "es")).toThrow(SchemaValidationError);
  });

  it("riskLevel con un valor fuera del enum valido se rechaza", () => {
    expect(() => parseAssistantJson(JSON.stringify({ shortAnswer: "x", riskLevel: "extremo" }), "es")).toThrow(
      SchemaValidationError
    );
  });

  it("checklist con un tipo incorrecto (string en vez de array) se rechaza", () => {
    expect(() => parseAssistantJson(JSON.stringify({ shortAnswer: "x", checklist: "no es un array" }), "es")).toThrow(
      SchemaValidationError
    );
  });

  it("missingQuestions con un tipo incorrecto se rechaza", () => {
    expect(() =>
      parseAssistantJson(JSON.stringify({ shortAnswer: "x", missingQuestions: { foo: "bar" } }), "es")
    ).toThrow(SchemaValidationError);
  });

  const errorCode = (fn: () => unknown): string | null => {
    try {
      fn();
      return null;
    } catch (error) {
      return (error as SchemaValidationError).code ?? null;
    }
  };

  it("todas las variantes de esquema incompleto usan el mismo code='schema_validation_failed'", () => {
    expect(errorCode(() => parseAssistantJson(JSON.stringify({}), "es"))).toBe("schema_validation_failed");
    expect(errorCode(() => parseAssistantJson(JSON.stringify({ shortAnswer: "x", riskLevel: "bad" }), "es"))).toBe(
      "schema_validation_failed"
    );
  });
});

describe("parseAssistantJson: no se inventan campos silenciosamente", () => {
  it("un campo desconocido en el JSON del modelo no aparece en el AssistantResponse resultante", () => {
    const raw = JSON.stringify({ shortAnswer: "x", campoInventadoPorElModelo: "no deberia sobrevivir" });
    const result = parseAssistantJson(raw, "es") as unknown as Record<string, unknown>;
    expect(result.campoInventadoPorElModelo).toBeUndefined();
    // Solo los campos conocidos del contrato deben estar presentes.
    expect(Object.keys(result).sort()).toEqual(
      ["checklist", "codeReference", "missingQuestions", "planReading", "recommendation", "riskLevel", "shortAnswer", "warning", "englishSummary"].sort()
    );
  });
});
