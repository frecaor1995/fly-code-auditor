import { describe, it, expect } from "vitest";
import {
  CRITICAL_TERMS,
  EQUIVALENCE_GROUPS,
  synonymsOf,
  pluralVariants,
  flexiblePhraseMatch,
  tokenize,
  STOPWORDS
} from "@/lib/knowledge/textNormalization";

// Sprint 3 (generalizacion semantica controlada): pruebas de las funciones
// puras de la capa de normalizacion, aisladas del motor de scoring
// (eso se prueba end-to-end en tests/unit/matchEngine.test.ts).

describe("textNormalization: pluralVariants (singular/plural)", () => {
  it("genera el singular a partir de un plural terminado en 'es'", () => {
    expect(pluralVariants("paneles")).toContain("panel");
    expect(pluralVariants("interruptores")).toContain("interruptor");
  });

  it("genera el singular a partir de un plural terminado en 's'", () => {
    expect(pluralVariants("receptaculos")).toContain("receptaculo");
    expect(pluralVariants("outlets")).toContain("outlet");
  });

  it("genera plurales a partir de una forma singular", () => {
    const variants = pluralVariants("breaker");
    expect(variants).toContain("breaker");
    expect(variants.some((v) => v === "breakers" || v === "breakeres")).toBe(true);
  });

  it("nunca genera variantes para palabras de 3 caracteres o menos (evita colisiones)", () => {
    expect(pluralVariants("gas")).toEqual(["gas"]);
    expect(pluralVariants("mas")).toEqual(["mas"]);
  });

  it("es determinista: la misma palabra siempre produce las mismas variantes", () => {
    expect(pluralVariants("garaje")).toEqual(pluralVariants("garaje"));
  });
});

describe("textNormalization: terminos criticos nunca se diluyen", () => {
  it.each(["gfci", "afci", "ev", "hvac", "neutral", "ground", "service", "panel"])(
    "%s no genera variantes de plural/singular (pluralVariants devuelve la palabra sin cambios)",
    (term) => {
      expect(pluralVariants(term)).toEqual([term]);
    }
  );

  it("los terminos criticos estan efectivamente en el set exportado", () => {
    for (const term of ["gfci", "afci", "ev", "hvac", "neutral", "ground", "service", "panel", "mca", "mocp", "tdlr"]) {
      expect(CRITICAL_TERMS.has(term)).toBe(true);
    }
  });

  it("un termino critico dentro de un grupo de equivalencia (ej. 'panel') sigue siendo un miembro valido del grupo, nunca se excluye del matching por sinonimos", () => {
    // "panel" SI participa del grupo tablero/panel/panelboard (pedido
    // explicito de Sprint 3): "preservar" un termino critico significa que
    // nunca se diluye/pierde peso, no que se le prohiba tener sinonimos
    // curados a mano.
    expect(synonymsOf("panel")).toContain("panel");
    expect(synonymsOf("panel")).toContain("tablero");
  });
});

describe("textNormalization: sinonimos ES/EN (mapa central)", () => {
  it("cada termino del pedido de Sprint 3 resuelve al mismo grupo que sus equivalentes", () => {
    const pairs: [string, string][] = [
      ["enchufe", "outlet"],
      ["tomacorriente", "receptacle"],
      ["tablero", "panelboard"],
      ["acometida", "service"],
      ["union", "bonding"],
      ["garaje", "garage"],
      ["dormitorio", "bedroom"],
      ["patio", "porch"],
      ["interruptor", "breaker"]
    ];
    for (const [a, b] of pairs) {
      expect(synonymsOf(a)).toContain(b);
      expect(synonymsOf(b)).toContain(a);
    }
  });

  it("cargador ev / ev charger son equivalentes (frase de 2 palabras dentro del mapa)", () => {
    expect(synonymsOf("cargador ev")).toContain("ev charger");
  });

  it("una palabra sin sinonimos conocidos devuelve solo si misma", () => {
    expect(synonymsOf("multimetro")).toEqual(["multimetro"]);
  });

  it("cada termino pertenece como maximo a un grupo (sin solapamiento accidental)", () => {
    const seen = new Map<string, string[]>();
    for (const group of EQUIVALENCE_GROUPS) {
      for (const term of group) {
        expect(seen.has(term)).toBe(false);
        seen.set(term, [...group]);
      }
    }
  });
});

describe("textNormalization: variaciones verbales comunes", () => {
  it("formas conjugadas de 'supervisar' resuelven al mismo grupo que el infinitivo y el verbo en ingles", () => {
    expect(synonymsOf("supervisa")).toContain("supervisar");
    expect(synonymsOf("supervision")).toContain("supervise");
    expect(synonymsOf("supervised")).toContain("supervisar");
  });

  it("formas de 'conectar'/'connect' resuelven al mismo grupo en ambos idiomas", () => {
    expect(synonymsOf("conectan")).toContain("connect");
    expect(synonymsOf("connected")).toContain("conexion");
  });

  it("formas de 'requerir'/'require' e 'instalar'/'install' resuelven al mismo grupo", () => {
    expect(synonymsOf("requiere")).toContain("required");
    expect(synonymsOf("instalado")).toContain("install");
  });
});

describe("textNormalization: tokenize y STOPWORDS", () => {
  it("tokenize separa por espacios y puntuacion, preservando acentos previos a normalizeForMatch", () => {
    expect(tokenize("necesito, un panel; nuevo.")).toEqual(["necesito", "un", "panel", "nuevo"]);
  });

  it("los articulos y conectores ES/EN comunes estan en STOPWORDS", () => {
    for (const w of ["el", "la", "de", "un", "the", "a", "of", "and"]) {
      expect(STOPWORDS.has(w)).toBe(true);
    }
  });
});

describe("textNormalization: flexiblePhraseMatch (orden flexible + palabras intermedias)", () => {
  it("reconoce una frase con el orden de palabras invertido", () => {
    const tokens = tokenize("is a switch required at every entrance of a room for lighting");
    expect(flexiblePhraseMatch(tokens, "entrance of a room")).toBe(true);
  });

  it("tolera palabras intermedias dentro de una ventana acotada", () => {
    // "cable" (idx3) ... "mc" (idx6): 2 palabras intermedias ("especial",
    // "tipo"), span=4, tolerancia para frase de 2 palabras = 2+2=4 -> pasa.
    const tokens = tokenize("necesito revisar el cable especial tipo mc");
    expect(flexiblePhraseMatch(tokens, "cable mc")).toBe(true);
  });

  it("NO matchea si falta una palabra significativa de la frase", () => {
    const tokens = tokenize("necesito un panel nuevo para mi casa");
    expect(flexiblePhraseMatch(tokens, "cable mc")).toBe(false);
  });

  it("NO matchea si las palabras estan demasiado dispersas (fuera de la ventana de tolerancia)", () => {
    // "cable" (idx1) ... "mc" (idx11): span=11, muy por encima de la
    // tolerancia (2+2=4 para una frase de 2 palabras).
    const tokens = tokenize(
      "el cable que se va a usar en este proyecto especifico es de un tipo especial llamado mc"
    );
    expect(flexiblePhraseMatch(tokens, "cable mc")).toBe(false);
  });

  it("frases de una sola palabra no usan este camino (siempre false, se resuelven por otro lado)", () => {
    const tokens = tokenize("necesito un panel");
    expect(flexiblePhraseMatch(tokens, "panel")).toBe(false);
  });
});
