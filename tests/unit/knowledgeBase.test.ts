import { describe, it, expect } from "vitest";
import { findKnowledgeBaseMatch } from "@/lib/knowledge/electricalKnowledgeBase";

// Pruebas de la base electrica REAL (lib/knowledge/electricalKnowledgeBase.ts)
// a traves de findKnowledgeBaseMatch, complementando tests/unit/matchEngine.test.ts
// (que prueba el motor generico con fixtures sinteticas) y
// tests/unit/contradictions.test.ts (pares de categorias mutuamente
// excluyentes). Aqui se cubre especificamente el requisito de FASE C.1:
// "receptaculo" no activa healthcare por si solo, y las categorias reales
// resuelven al kb-id esperado.

describe("knowledgeBase: 'receptaculo' no activa healthcare por si solo", () => {
  it("una pregunta generica sobre receptaculos, sin contexto hospitalario, no matchea healthcare", () => {
    const result = findKnowledgeBaseMatch("que es un receptaculo");
    expect(result?.matchCategory).not.toBe("healthcare");
  });

  it("'tomas' (alias de receptaculo en la entrada healthcare) tampoco activa healthcare sin contexto", () => {
    const result = findKnowledgeBaseMatch("cuantas tomas necesito para la cocina");
    expect(result?.matchCategory).not.toBe("healthcare");
  });
});

describe("knowledgeBase: aliases, mayusculas, acentos y puntuacion", () => {
  it("GFCI en mayusculas resuelve la misma entrada que en minusculas", () => {
    const lower = findKnowledgeBaseMatch("necesito proteccion gfci en el bano");
    const upper = findKnowledgeBaseMatch("NECESITO PROTECCION GFCI EN EL BAÑO");
    expect(lower?.id).toBe("kb-gfci");
    expect(upper?.id).toBe("kb-gfci");
  });

  it("acentos y signos de puntuacion no rompen el match ('¿Qué tomas se usan en hospitales?')", () => {
    const result = findKnowledgeBaseMatch("¿Qué tipo de tomas se usan en hospitales?");
    expect(result?.id).toBe("kb-healthcare-517");
  });
});

describe.each([
  ["feeders", "necesito el calibre del alimentador de aluminio para el tablero secundario de 200a", "kb-feeder-subpanel-aluminum"],
  ["services", "necesito el load calculation con demand factor", "kb-load-calculation"],
  ["grounding_bonding", "necesito el electrodo de puesta a tierra del sistema", "kb-grounding"],
  ["mc_cable", "como debo soportar el cable mc cada cuantos pies", "kb-mc-cable"],
  ["panels", "quiero hacer un panel upgrade de 150a a 200a", "kb-panel-upgrade"],
  ["receptacles", "necesito proteccion gfci en el receptaculo del garage", "kb-gfci"],
  ["exterior_wet_locations", "el receptaculo exterior necesita cubierta while-in-use extra-duty", "kb-exterior-wet-locations"],
  ["healthcare", "que receptaculos hospital grade se usan en el area de atencion al paciente", "kb-healthcare-517"],
  ["ev_charging", "necesito el breaker para un ev charger de carro electrico", "kb-ev-chargers"],
  ["tdlr", "necesito confirmar la licencia de electricista tdlr vigente", "kb-tdlr-texas"],
  ["houston_ahj", "necesito el permiso del houston permitting center", "kb-houston-ahj"],
  ["lighting", "necesito un circuito de iluminacion general para la sala", "kb-general-lighting"]
])("knowledgeBase: categoria real '%s'", (category, question, expectedId) => {
  it(`la pregunta resuelve a la entrada esperada (${expectedId})`, () => {
    const result = findKnowledgeBaseMatch(question);
    expect(result?.matchCategory).toBe(category);
    expect(result?.id).toBe(expectedId);
  });
});

describe("knowledgeBase: sin coincidencia confiable devuelve null (no contenido generico)", () => {
  it("una pregunta sin ningun termino tecnico especifico no matchea nada", () => {
    expect(findKnowledgeBaseMatch("hola, como estas hoy?")).toBeNull();
  });

  it("una sola palabra generica sola (sin combinarse con otra senal) no matchea", () => {
    expect(findKnowledgeBaseMatch("cable")).toBeNull();
  });
});
