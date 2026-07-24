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
    // Solo "panel" matchea literalmente aqui; "paneles" queda deduplicada
    // contra la misma clave canonica (Sprint 3: no debe sumar dos veces por
    // una unica mencion de la misma palabra solo porque la entrada lista
    // ambas formas). Sigue por debajo del minimo -comportamiento identico
    // al anterior a Sprint 3-.
    expect(findBestMatch("necesito un panel nuevo", entries)).toBeNull();
  });

  // Sprint 3 (generalizacion semantica controlada): lib/knowledge/textNormalization.ts
  // agrega reconocimiento de plural/singular conservador. Nota: cuando la
  // KEYWORD es la forma singular (corta), el plural de la pregunta ya
  // matcheaba por subcadena antigua ("panel" es substring literal de
  // "paneles"). El caso genuinamente nuevo es el inverso: la keyword es
  // PLURAL y la pregunta usa la forma SINGULAR, que nunca es substring
  // literal del plural ("paneles" no es substring de "panel").
  it("Sprint 3: reconoce la forma singular de la pregunta aunque la keyword solo liste el plural", () => {
    const entries = [entry({ id: "a", matchCategory: "panels", keywords: ["paneles", "breakers"] })];
    const result = findBestMatch("necesito revisar el panel y el breaker", entries);
    expect(result?.id).toBe("a");
  });
});

describe("matchEngine: Sprint 3 - sinonimos ES/EN a traves del motor real", () => {
  it("reconoce un sinonimo (enchufe/outlet) sin que la keyword lo liste literalmente", () => {
    const entries = [entry({ id: "a", matchCategory: "receptacles", keywords: ["outlet", "gfci"] })];
    const result = findBestMatch("necesito gfci en el enchufe de la cocina", entries);
    expect(result?.id).toBe("a");
  });

  it("reconoce el sinonimo cruzado ES/EN inverso (garage/garaje)", () => {
    const entries = [entry({ id: "a", matchCategory: "receptacles", keywords: ["garage", "gfci"] })];
    const result = findBestMatch("se requiere gfci en el garaje", entries);
    expect(result?.id).toBe("a");
  });

  it("no duplica score cuando la entrada lista dos sinonimos del mismo grupo (patio/porch): una sola mencion cuenta una sola vez", () => {
    const entries = [entry({ id: "a", matchCategory: "exterior_wet_locations", keywords: ["patio", "porch", "terraza"] })];
    const result = findBestMatch("necesito una cubierta para el patio", entries);
    // Sin dedup por sinonimos esto puntuaria 3 (patio+porch+terraza, todos
    // resueltos por la misma mencion de "patio"); con dedup, 1 sola vez.
    expect(result).toBeNull(); // 1pt < MINIMUM_SCORE=2, comportamiento correcto (sin inflar)
  });
});

describe("matchEngine: Sprint 3 - orden flexible y palabras intermedias a traves del motor real", () => {
  it("una frase multi-palabra matchea aunque el orden este invertido en la pregunta", () => {
    const entries = [entry({ id: "a", matchCategory: "lighting", keywords: ["room entrance", "switch"] })];
    const result = findBestMatch("is a switch required at every entrance of a room", entries);
    expect(result?.id).toBe("a");
  });

  it("una frase multi-palabra matchea con palabras intermedias dentro de la tolerancia", () => {
    // "neutro" (idx1) ... "tierra" (idx4): 2 palabras intermedias ("y","la"
    // -"y" es stopword-, mas "conectados" no cuenta como intermedia real
    // para el span, que se mide sobre TODOS los tokens); span=4, tolerancia
    // para frase de 2 palabras significativas = 2+2=4 -> pasa.
    const entries = [entry({ id: "a", matchCategory: "feeders", keywords: ["neutro y tierra", "subpanel"] })];
    const result = findBestMatch("el neutro y la tierra van conectados en el subpanel", entries);
    expect(result?.id).toBe("a");
  });
});

describe("matchEngine: Sprint 3 - preguntas comparativas", () => {
  it("una pregunta comparativa (X vs Y) matchea la entrada cuya frase completa de comparacion esta explicitamente listada", () => {
    const entries = [
      entry({ id: "x", matchCategory: "grounding_bonding", keywords: ["grounding"] }),
      entry({ id: "y", matchCategory: "grounding_bonding", keywords: ["bonding", "diferencia entre grounding y bonding"] })
    ];
    const result = findBestMatch("¿Cuál es la diferencia entre grounding y bonding?", entries);
    expect(result?.id).toBe("y");
  });

  it("sin una frase comparativa explicita, una pregunta 'X vs Y' generica no favorece a ninguna entrada por encima del minimo (cada termino aislado pesa 1pt)", () => {
    const entries = [
      entry({ id: "x", matchCategory: "grounding_bonding", keywords: ["grounding"] }),
      entry({ id: "y", matchCategory: "grounding_bonding", keywords: ["bonding"] })
    ];
    const result = findBestMatch("¿Cuál es la diferencia entre grounding y bonding?", entries);
    expect(result).toBeNull();
  });
});

describe("matchEngine: Sprint 3 - preservacion de terminos criticos", () => {
  it.each(["GFCI", "AFCI", "EV", "HVAC", "neutral", "ground", "service", "panel"])(
    "%s sigue matcheando por coincidencia literal exacta, sin verse afectado por la capa flexible",
    (term) => {
      const entries = [entry({ id: "a", matchCategory: "panels", keywords: [term.toLowerCase(), "breaker"] })];
      const result = findBestMatch(`necesito revisar el ${term} y el breaker`, entries);
      expect(result?.id).toBe("a");
    }
  );

  it("un termino critico NUNCA se sustituye por una variante de plural inventada que colisione con otra palabra", () => {
    // "ev" (critico) tiene longitud <= 3: sin la proteccion de CRITICAL_TERMS
    // (y del filtro de longitud), podria generarse "eves"/"evs" y colisionar
    // con palabras no relacionadas. Se verifica que sigue exigiendo
    // coincidencia exacta.
    const entries = [entry({ id: "a", matchCategory: "ev_charging", keywords: ["ev", "cargador"] })];
    expect(findBestMatch("necesito instalar un cargador electrico cualquiera", entries)).toBeNull();
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
