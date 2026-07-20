import { describe, it, expect } from "vitest";
import { mockAskAssistant } from "@/lib/ai/mockAssistant";
import { findKnowledgeBaseMatch } from "@/lib/knowledge/electricalKnowledgeBase";

// FASE C.7: invariantes tecnicos criticos para receptaculos exteriores
// (contenido real de lib/knowledge/electricalKnowledgeBase.ts, entrada
// kb-exterior-wet-locations). Igual que en criticalRules.feeder200A.test.ts:
// se prueban invariantes (presencia de distinciones obligatorias, ausencia
// de contenido cruzado de otra categoria), no el parrafo completo.

const EXTERIOR_QUESTION = "el receptaculo exterior de la vivienda necesita cubierta while-in-use extra-duty, que debo confirmar";

async function getExteriorResponse() {
  return mockAskAssistant({ question: EXTERIOR_QUESTION, language: "es" });
}

describe("Invariante: distingue ubicacion humeda (damp) de mojada (wet)", () => {
  it("el texto explica ambas clasificaciones como conceptos distintos, no intercambiables", async () => {
    const response = await getExteriorResponse();
    expect(response.shortAnswer).toMatch(/lugar humedo es un area protegida de la lluvia directa/i);
    expect(response.shortAnswer).toMatch(/lugar mojado esta expuesto directamente a la lluvia/i);
  });

  it("el checklist exige confirmar explicitamente cual de las dos condiciones aplica", async () => {
    const response = await getExteriorResponse();
    expect(response.checklist.join(" ")).toMatch(/confirmar si la ubicacion es damp \(cubierta\) o wet \(expuesta directamente/i);
  });
});

describe("Invariante: contempla proteccion GFCI", () => {
  it("cita NEC 210.8 y exige verificar proteccion GFCI en el circuito", async () => {
    const response = await getExteriorResponse();
    expect(response.codeReference).toMatch(/210\.8/);
    expect(response.checklist.join(" ")).toMatch(/verificar proteccion gfci en el circuito/i);
  });
});

describe("Invariante: contempla receptaculo weather-resistant (WR)", () => {
  it("exige que el receptaculo este listado weather-resistant (marcado WR), no cualquier receptaculo", async () => {
    const response = await getExteriorResponse();
    expect(response.shortAnswer).toMatch(/weather-resistant/i);
    expect(response.checklist.join(" ")).toMatch(/tipo weather-resistant \(wr\) listado/i);
  });
});

describe("Invariante: la cubierta requerida depende de la condicion (damp vs wet)", () => {
  it("cubierta estandar (solo cerrada) para lugares humedos vs while-in-use extra-duty para mojados", async () => {
    const response = await getExteriorResponse();
    const fullText = `${response.shortAnswer} ${response.checklist.join(" ")}`;
    expect(fullText).toMatch(/cubierta.*(a prueba de intemperie|weatherproof).*solo cuando el receptaculo esta cerrado/i);
    expect(fullText).toMatch(/while-in-use.*extra-duty/i);
  });
});

describe("Invariante: nunca devuelve contenido hospitalario sin contexto real", () => {
  it("la respuesta a una consulta puramente exterior no menciona hospital/paciente ni cita NEC 517/NFPA 99", async () => {
    const response = await getExteriorResponse();
    const fullText = `${response.shortAnswer} ${response.codeReference}`.toLowerCase();
    expect(fullText).not.toMatch(/hospital/);
    expect(fullText).not.toMatch(/nec 517/);
    expect(fullText).not.toMatch(/nfpa 99/);
  });

  it("la categoria resuelta es exterior_wet_locations, nunca healthcare, para esta pregunta", () => {
    const match = findKnowledgeBaseMatch(EXTERIOR_QUESTION);
    expect(match?.matchCategory).toBe("exterior_wet_locations");
    expect(match?.matchCategory).not.toBe("healthcare");
  });
});

describe("Invariante: healthcare queda bloqueado en consultas puramente residenciales", () => {
  it("una consulta residencial sobre receptaculos exteriores no activa contenido hospitalario", async () => {
    const response = await mockAskAssistant({
      question: "en mi casa residencial necesito receptaculos exteriores con proteccion GFCI, sin nada de hospitales",
      language: "es"
    });
    const fullText = `${response.shortAnswer} ${response.sourceInfo ?? ""}`.toLowerCase();
    expect(fullText).not.toMatch(/patient care area/);
    expect(fullText).not.toMatch(/healthcare \/ hospitales/);
  });

  it("el gate de categoria (matchEngine) confirma que sin contexto hospitalario real, healthcare queda descalificada", () => {
    const match = findKnowledgeBaseMatch("necesito receptaculos exteriores para mi vivienda residencial, no hospitales");
    expect(match?.matchCategory).not.toBe("healthcare");
  });
});
