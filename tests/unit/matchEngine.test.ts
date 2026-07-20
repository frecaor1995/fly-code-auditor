import { describe, it, expect } from "vitest";
import { findBestMatch, findContradiction, normalizeForMatch, getCategoryExcludeTerms, type ScorableEntry } from "@/lib/knowledge/matchEngine";

// Motor generico (lib/knowledge/matchEngine.ts) probado con entradas
// sinteticas: aisla la mecanica de scoring/gates/negacion de cualquier
// contenido real de la base electrica (eso se prueba por separado en
// tests/unit/knowledgeBase.test.ts).
//
// NOTA (gap documentado, no es un bug de esta suite): el pedido original
// incluye "fire_alarm" como categoria a probar, pero MatchCategory (el tipo
// union en matchEngine.ts) NO define "fire_alarm" como valor valido hoy -
// solo existe como "scope" del catalogo de simbolos electricos (modulo
// distinto, no relacionado al motor de matching de consultas tecnicas). No
// se agrega aqui de forma artificial para "hacer pasar" una prueba: eso
// seria modificar produccion solo para maquillar un test. Se reporta como
// hallazgo en la entrega final.

function entry(overrides: Partial<ScorableEntry> & Pick<ScorableEntry, "id" | "matchCategory" | "keywords">): ScorableEntry {
  return { excludeTerms: [], ...overrides };
}

describe("matchEngine: score ponderado y umbral minimo", () => {
  it("una palabra generica sola no produce coincidencia (peso 1 < minimo)", () => {
    const entries = [entry({ id: "a", matchCategory: "panels", keywords: ["panel"] })];
    expect(findBestMatch("hablame de un panel", entries)).toBeNull();
  });

  it("dos palabras genericas combinadas SI superan el minimo (score aditivo)", () => {
    const entries = [entry({ id: "a", matchCategory: "panels", keywords: ["panel", "breaker"] })];
    const result = findBestMatch("necesito cambiar el panel y el breaker", entries);
    expect(result?.id).toBe("a");
  });

  it("una frase especifica de varias palabras pesa mas que una palabra suelta", () => {
    const entries = [
      entry({ id: "generic", matchCategory: "panels", keywords: ["panel"] }),
      entry({ id: "specific", matchCategory: "services", keywords: ["load calculation completo"] })
    ];
    const result = findBestMatch("necesito un load calculation completo para el panel", entries);
    expect(result?.id).toBe("specific");
  });

  it("deduplica terminos contradictorios repetidos en gate y en la entrada (una sola penalizacion)", () => {
    const entries = [
      entry({
        id: "a",
        matchCategory: "healthcare",
        keywords: ["hospital", "paciente", "cuidado"],
        excludeTerms: ["exterior", "exterior"]
      })
    ];
    // "exterior" aparece una sola vez en la pregunta: la penalizacion debe
    // aplicarse una sola vez (CONTRADICTION_PENALTY=5), no duplicarse por
    // tener "exterior" listado dos veces en excludeTerms.
    const result = findBestMatch("hospital paciente cuidado exterior", entries);
    // score = 1+1+1 (tres keywords de 1 palabra) - 5 = -2 < minimo(2)
    expect(result).toBeNull();
  });
});

describe("matchEngine: gates de categoria (requiredAnyOf)", () => {
  it("una categoria SIN gate fijo (ej. 'receptacles') no exige ningun termino de contexto", () => {
    // CATEGORY_GATES es interno al modulo y esta fijo por categoria real
    // (healthcare/exterior_wet_locations); "receptacles" no tiene gate
    // configurado, asi que dos keywords de 1 palabra ya alcanzan el minimo.
    const entries = [entry({ id: "r", matchCategory: "receptacles", keywords: ["receptaculo", "toma"] })];
    const result = findBestMatch("necesito un receptaculo con toma", entries);
    expect(result?.id).toBe("r");
  });

  it("'healthcare' SI tiene un gate fijo real: sin hospital/paciente/clinica, queda descalificada aunque sus keywords matcheen", () => {
    const entries = [entry({ id: "hc", matchCategory: "healthcare", keywords: ["receptaculo", "toma"] })];
    const result = findBestMatch("necesito un receptaculo con toma", entries);
    expect(result).toBeNull();
  });

  it("'healthcare' SI matchea cuando ademas de sus keywords hay contexto real (hospital/paciente/clinica)", () => {
    const entries = [entry({ id: "hc", matchCategory: "healthcare", keywords: ["receptaculo", "toma"] })];
    const result = findBestMatch("necesito un receptaculo con toma en el hospital", entries);
    expect(result?.id).toBe("hc");
  });

  it("getCategoryExcludeTerms expone los excludeTerms reales de healthcare (usados por app/api/queries/route.ts)", () => {
    const terms = getCategoryExcludeTerms("healthcare");
    expect(terms.length).toBeGreaterThan(0);
    expect(terms.some((t) => normalizeForMatch(t).includes("exterior"))).toBe(true);
  });

  it("getCategoryExcludeTerms devuelve vacio para una categoria sin gate configurado", () => {
    expect(getCategoryExcludeTerms("mc_cable")).toEqual([]);
  });
});

describe("matchEngine: findContradiction y negacion", () => {
  it("detecta un termino contradictorio presente sin negacion", () => {
    expect(findContradiction("dame informacion de hospitales", ["hospitales"])).toBe("hospitales");
  });

  it("una negacion explicita anula el termino contradictorio ('no uses hospitales')", () => {
    expect(findContradiction("no uses informacion de hospitales para esto", ["hospitales"])).toBeNull();
  });

  it("reconoce multiples marcadores de negacion (nunca, sin, evitar)", () => {
    expect(findContradiction("nunca menciones hospitales aqui", ["hospitales"])).toBeNull();
    expect(findContradiction("responde sin mencionar hospitales", ["hospitales"])).toBeNull();
    expect(findContradiction("quiero evitar hospitales en la respuesta", ["hospitales"])).toBeNull();
  });

  it("no confunde una mencion negada distante (fuera de la ventana de 30 caracteres) con no-negada", () => {
    const longPrefix = "no ".padEnd(35, "x ");
    expect(findContradiction(`${longPrefix}hospitales`, ["hospitales"])).toBe("hospitales");
  });

  it("deduplica terminos antes de buscar (Set interno), sin cambiar el resultado", () => {
    expect(findContradiction("mencion de hospitales", ["hospitales", "hospitales", "hospitales"])).toBe("hospitales");
  });
});

describe("matchEngine: categorias mutuamente incompatibles no se mezclan", () => {
  it("una entrada healthcare real queda penalizada si la pregunta trae terminos de exterior", () => {
    const entries = [
      entry({ id: "hc", matchCategory: "healthcare", keywords: ["hospital paciente"], excludeTerms: ["exterior", "humedo"] }),
      entry({ id: "ext", matchCategory: "exterior_wet_locations", keywords: ["exterior humedo"] })
    ];
    const result = findBestMatch("receptaculo exterior humedo, no es hospital paciente", entries);
    // "hospital paciente" (frase de 2 palabras = 2 puntos) - 5 (contradiccion
    // por "exterior"/"humedo" no negados) = -3, descalificada.
    // "exterior humedo" (2 puntos) sin contradiccion propia = 2, gana.
    expect(result?.id).toBe("ext");
  });
});

describe("matchEngine: normalizeForMatch", () => {
  it("normaliza acentos, mayusculas y no rompe con puntuacion", () => {
    expect(normalizeForMatch("Receptáculo")).toBe("receptaculo");
    expect(normalizeForMatch("HOSPITALES")).toBe("hospitales");
    expect(normalizeForMatch("¿Qué articulo aplica?")).toContain("que articulo aplica");
  });

  it("mismo resultado para singular/plural cuando ambas formas se buscan explicitamente", () => {
    const entries = [entry({ id: "a", matchCategory: "panels", keywords: ["panel", "paneles"] })];
    expect(findBestMatch("necesito paneles nuevos", entries)?.id).toBe("a");
    // Solo "panel" matchea aqui (no "paneles"): una sola keyword de 1
    // palabra = 1pt, por debajo del minimo de 2.
    expect(findBestMatch("necesito un panel nuevo", entries)).toBeNull();
  });
});

// Cobertura de las categorias reales de MatchCategory (item 1 del pedido).
// "fire_alarm" queda fuera (ver nota superior); "operational_guide" SI es un
// valor valido del tipo (aunque hoy no tenga entradas reales en
// electricalKnowledgeBase.ts: es el fallback de Supabase en dbAdapter.ts),
// por eso se prueba aqui a nivel generico.
const REQUIRED_CATEGORIES = [
  "feeders",
  "services",
  "grounding_bonding",
  "mc_cable",
  "panels",
  "receptacles",
  "exterior_wet_locations",
  "healthcare",
  "ev_charging",
  "tdlr",
  "houston_ahj",
  "lighting",
  "arc_flash_safety",
  "installation_methods",
  "operational_guide"
] as const;

describe.each(REQUIRED_CATEGORIES)("matchEngine: categoria '%s' es reconocida por el motor generico", (category) => {
  it("matchea cuando sus keywords especificas de dos palabras aparecen", () => {
    const uniqueKeyword = `keyword especifica de ${category}`;
    const entries = [entry({ id: category, matchCategory: category, keywords: [uniqueKeyword] })];
    const result = findBestMatch(`pregunta sobre ${uniqueKeyword}`, entries);
    expect(result?.matchCategory).toBe(category);
  });
});
