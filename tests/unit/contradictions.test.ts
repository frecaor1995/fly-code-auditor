import { describe, it, expect } from "vitest";
import { findBestMatch, findContradiction, type ScorableEntry } from "@/lib/knowledge/matchEngine";
import { findKnowledgeBaseMatch } from "@/lib/knowledge/electricalKnowledgeBase";

// FASE C.3: casos obligatorios de deteccion de contradicciones. Combina
// pruebas sobre el motor generico (pares sinteticos, deterministas) con
// pruebas sobre la base electrica real (electricalKnowledgeBase.ts), para
// confirmar que la exclusividad de categorias tambien se sostiene con
// contenido real, no solo con fixtures de laboratorio.

function entry(id: string, matchCategory: ScorableEntry["matchCategory"], keywords: string[]): ScorableEntry {
  return { id, matchCategory, keywords };
}

describe("Contradicciones: residencial vs hospital", () => {
  it("una pregunta puramente residencial no activa healthcare (base real)", () => {
    const result = findKnowledgeBaseMatch("necesito iluminacion para una vivienda residencial unifamiliar");
    expect(result?.matchCategory).not.toBe("healthcare");
  });

  it("una pregunta con contexto hospitalario real SI activa healthcare", () => {
    const result = findKnowledgeBaseMatch("que receptaculos se requieren en un area de atencion al paciente del hospital");
    expect(result?.matchCategory).toBe("healthcare");
  });
});

describe("Contradicciones: feeder vs service", () => {
  it("un alimentador a subpanel con aluminio resuelve a 'feeders', no 'services' (base real)", () => {
    const result = findKnowledgeBaseMatch("necesito el calibre del alimentador de aluminio para el tablero secundario");
    expect(result?.matchCategory).toBe("feeders");
  });

  it("un load calculation de servicio resuelve a 'services', no 'feeders' (base real)", () => {
    const result = findKnowledgeBaseMatch("necesito el load calculation con el demand factor correcto");
    expect(result?.matchCategory).toBe("services");
  });
});

describe("Contradicciones: interior vs exterior", () => {
  it("iluminacion interior residencial no matchea exterior_wet_locations (base real)", () => {
    const result = findKnowledgeBaseMatch("necesito instalar un punto de luz interior en la sala de la casa");
    expect(result?.matchCategory).not.toBe("exterior_wet_locations");
  });

  it("un receptaculo claramente exterior SI matchea exterior_wet_locations (base real)", () => {
    const result = findKnowledgeBaseMatch("el receptaculo exterior necesita cubierta a prueba de intemperie");
    expect(result?.matchCategory).toBe("exterior_wet_locations");
  });
});

describe("Contradicciones: humedo vs mojado (no se tratan como sinonimos intercambiables)", () => {
  it("una pregunta sobre 'lugar humedo' matchea la entrada de humedo, no la de mojado", () => {
    const entries = [entry("damp", "installation_methods", ["lugar humedo cubierto"]), entry("wet", "exterior_wet_locations", ["lugar mojado expuesto"])];
    const result = findBestMatch("necesito instalar en un lugar humedo cubierto", entries);
    expect(result?.id).toBe("damp");
  });

  it("una pregunta sobre 'lugar mojado' matchea la entrada de mojado, no la de humedo", () => {
    const entries = [entry("damp", "installation_methods", ["lugar humedo cubierto"]), entry("wet", "exterior_wet_locations", ["lugar mojado expuesto"])];
    const result = findBestMatch("necesito instalar en un lugar mojado expuesto", entries);
    expect(result?.id).toBe("wet");
  });
});

describe("Contradicciones: cobre vs aluminio (no intercambiables)", () => {
  it("una pregunta sobre conductor de cobre no matchea la entrada especifica de aluminio", () => {
    const entries = [entry("cu", "feeders", ["conductor de cobre calibre"]), entry("al", "feeders", ["conductor de aluminio calibre"])];
    const result = findBestMatch("necesito el conductor de cobre calibre correcto", entries);
    expect(result?.id).toBe("cu");
  });

  it("una pregunta sobre conductor de aluminio no matchea la entrada especifica de cobre", () => {
    const entries = [entry("cu", "feeders", ["conductor de cobre calibre"]), entry("al", "feeders", ["conductor de aluminio calibre"])];
    const result = findBestMatch("necesito el conductor de aluminio calibre correcto", entries);
    expect(result?.id).toBe("al");
  });
});

describe("Contradicciones: panel principal vs tablero secundario (subpanel)", () => {
  it("un panel upgrade de servicio principal resuelve 'panels' (base real, sin mencionar subpanel)", () => {
    const result = findKnowledgeBaseMatch("quiero hacer un panel upgrade de 150a a 200a en el panel principal");
    expect(result?.matchCategory).toBe("panels");
  });

  it("un alimentador a tablero secundario resuelve 'feeders', no se confunde con panel upgrade (base real)", () => {
    const result = findKnowledgeBaseMatch("necesito alimentar el tablero secundario con conductor de aluminio, cual es el calibre");
    expect(result?.matchCategory).toBe("feeders");
  });
});

describe("Contradicciones: 'no usar X' nunca se interpreta como pedir X", () => {
  it("'no necesito hospitales' + iluminacion residencial resuelve lighting, no healthcare (base real)", () => {
    const result = findKnowledgeBaseMatch(
      "no necesito informacion de hospitales, dame guia de iluminacion general para una vivienda"
    );
    expect(result?.matchCategory).toBe("lighting");
    expect(result?.matchCategory).not.toBe("healthcare");
  });

  it("findContradiction generico: 'evitar aluminio' no cuenta como termino 'aluminio' presente", () => {
    expect(findContradiction("quiero evitar aluminio en este proyecto", ["aluminio"])).toBeNull();
  });
});
