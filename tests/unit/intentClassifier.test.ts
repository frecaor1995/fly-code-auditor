import { describe, it, expect } from "vitest";
import { classifyIntent } from "@/lib/ai/intentClassifier";

describe("classifyIntent: pregunta tecnica", () => {
  it("clasifica una pregunta con terminos electricos concretos como technical_electrical", () => {
    const result = classifyIntent("Cual es el calibre de un feeder de 200A con conductores de aluminio?");
    expect(result.intent).toBe("technical_electrical");
    expect(result.technicalTermsDetected.length).toBeGreaterThan(0);
  });

  it("detecta terminos tecnicos en ingles igual que en espanol", () => {
    const es = classifyIntent("Necesito el calibre del conductor de aluminio para el subpanel");
    const en = classifyIntent("I need the aluminum conductor size for the subpanel");
    expect(es.intent).toBe("technical_electrical");
    expect(en.intent).toBe("technical_electrical");
  });
});

describe("classifyIntent: pregunta meta sobre la fuente", () => {
  it("clasifica una pregunta explicita sobre el origen de las respuestas como meta_source", () => {
    const result = classifyIntent("De donde sacas tus respuestas?");
    expect(result.intent).toBe("meta_source");
    expect(result.metaSourceDetected).toBe(true);
    expect(result.technicalTermsDetected).toHaveLength(0);
  });

  it("clasifica la variante en ingles como meta_source", () => {
    const result = classifyIntent("Where do you get your answers?");
    expect(result.intent).toBe("meta_source");
  });

  it("reconoce variaciones de redaccion via los patrones regex, no solo frases exactas", () => {
    const result = classifyIntent("oye, cual es tu base de conocimiento interna para responder?");
    expect(result.intent).toBe("meta_source");
  });
});

describe("classifyIntent: consulta general (ni tecnica ni meta)", () => {
  it("clasifica un saludo o pregunta sin contenido tecnico ni meta como general", () => {
    const result = classifyIntent("hola, como estas?");
    expect(result.intent).toBe("general");
    expect(result.technicalTermsDetected).toHaveLength(0);
    expect(result.metaSourceDetected).toBe(false);
  });
});

describe("classifyIntent: pregunta mixta (tecnica + meta en la misma frase)", () => {
  it("prioriza SIEMPRE technical_electrical cuando la pregunta tambien pide una fuente/articulo", () => {
    const result = classifyIntent(
      "Necesito el calibre del feeder de 200A y ademas indica que fuente oficial fue consultada"
    );
    expect(result.intent).toBe("technical_electrical");
    expect(result.matchedRule).toBe("technical_terms_priority");
    // metaSourceDetected puede ser true (la frase de fuente si esta), pero
    // eso NUNCA debe cambiar el intent resultante.
  });

  it("prioriza la tecnica aunque la meta-frase aparezca primero en el texto", () => {
    const result = classifyIntent("De donde sacas tus respuestas sobre el calibre de un feeder de aluminio?");
    expect(result.intent).toBe("technical_electrical");
  });
});

describe("classifyIntent: idiomas y variaciones de entrada", () => {
  it("funciona en preguntas cortas", () => {
    expect(classifyIntent("panel?").intent).toBe("technical_electrical");
    expect(classifyIntent("hola").intent).toBe("general");
  });

  it("es tolerante a mayusculas, acentos y signos de puntuacion", () => {
    const result = classifyIntent("¿CUÁL ES EL CALIBRE DEL FEEDER DE ALUMINIO?!");
    expect(result.intent).toBe("technical_electrical");
  });

  it("clasifica correctamente con errores ortograficos razonables que aun contienen el termino exacto", () => {
    // "conductorr" (typo) no coincide con ningun termino tecnico exacto, pero
    // "aluminio" si aparece intacto en la misma frase: sigue siendo suficiente.
    const result = classifyIntent("cual es el calibre del conductorr de aluminio para el feeder");
    expect(result.intent).toBe("technical_electrical");
  });

  it("funciona en modo bilingue (frase con espanol e ingles mezclados)", () => {
    const result = classifyIntent("necesito el feeder size para un panel de 200A");
    expect(result.intent).toBe("technical_electrical");
  });
});

// Ampliacion de TECHNICAL_TERMS (hallazgo de la suite de regresion, FASE F):
// cable/cables, TDLR, licencia/license, iluminacion/lighting,
// residencial/residential. Cubre mayusculas, acentos, singular y plural
// para cada termino, sin tocar el motor de matching ni el contenido de las
// respuestas (eso vive en lib/knowledge/electricalKnowledgeBase.ts).
describe("classifyIntent: vocabulario ampliado (cable, TDLR, licencia, iluminacion, residencial)", () => {
  it("reconoce 'cable' en singular", () => {
    expect(classifyIntent("necesito soportar el cable mc cada cuantos pies").intent).toBe("technical_electrical");
  });

  it("reconoce 'cables' en plural", () => {
    expect(classifyIntent("necesito varios cables en la misma tuberia").intent).toBe("technical_electrical");
  });

  it("reconoce 'Cable' en mayuscula", () => {
    expect(classifyIntent("Necesito informacion sobre el Cable MC").intent).toBe("technical_electrical");
  });

  it("reconoce 'TDLR' en mayusculas y 'tdlr' en minusculas", () => {
    expect(classifyIntent("necesito confirmar la licencia TDLR vigente").intent).toBe("technical_electrical");
    expect(classifyIntent("necesito confirmar la licencia tdlr vigente").intent).toBe("technical_electrical");
  });

  it("reconoce 'licencia' (es) y 'license' (en), singular y plural", () => {
    expect(classifyIntent("necesito verificar mi licencia de electricista").intent).toBe("technical_electrical");
    expect(classifyIntent("I need to verify my electrician license").intent).toBe("technical_electrical");
    expect(classifyIntent("do you track licenses for master electricians").intent).toBe("technical_electrical");
  });

  it("reconoce 'iluminacion' con y sin acento, y 'lighting' en ingles", () => {
    expect(classifyIntent("necesito un circuito de iluminacion general").intent).toBe("technical_electrical");
    expect(classifyIntent("necesito un circuito de iluminación general").intent).toBe("technical_electrical");
    expect(classifyIntent("I need a general lighting circuit").intent).toBe("technical_electrical");
  });

  it("reconoce 'residencial' con acento y 'residential' en ingles", () => {
    expect(classifyIntent("es un proyecto residencial de una sola vivienda").intent).toBe("technical_electrical");
    expect(classifyIntent("this is a residential project").intent).toBe("technical_electrical");
  });

  it("MAYUSCULAS y acentos combinados siguen clasificando correctamente", () => {
    const result = classifyIntent("¿NECESITO LICENCIA TDLR PARA UN PROYECTO RESIDENCIAL DE ILUMINACIÓN?");
    expect(result.intent).toBe("technical_electrical");
  });

  it("la prioridad tecnica-sobre-meta sigue aplicando con los nuevos terminos", () => {
    // Item 4 del clasificador: pedir la fuente NO convierte una pregunta
    // tecnica en meta_source, ahora tambien para los terminos nuevos.
    const result = classifyIntent("de donde sacas tus respuestas sobre la licencia TDLR para proyectos residenciales");
    expect(result.intent).toBe("technical_electrical");
  });
});
