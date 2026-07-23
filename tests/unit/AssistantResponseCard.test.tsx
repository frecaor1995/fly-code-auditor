// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { AssistantResponseCard } from "@/components/assistant/AssistantResponseCard";
import type { AssistantResponse } from "@/lib/db/types";

// FASE E: pruebas de componente con React Testing Library. Assertions
// semanticas (texto visible, roles, cardinalidad de elementos) en vez de
// snapshots grandes: si el contenido tecnico cambia de redaccion pero
// preserva el contrato (que campo se muestra, bajo que etiqueta, con que
// valor), el test sigue siendo valido.

function baseResponse(overrides: Partial<AssistantResponse> = {}): AssistantResponse {
  return {
    shortAnswer: "Respuesta corta de prueba.",
    riskLevel: "medio",
    codeReference: "NEC 210.8 (prueba)",
    checklist: ["Paso de verificacion 1", "Paso de verificacion 2"],
    missingQuestions: [],
    recommendation: "Recomendacion de prueba.",
    warning: "Advertencia estandar de prueba.",
    ...overrides
  };
}

// Devuelve el <dd> (valor) inmediatamente asociado a una etiqueta <dt> por
// su texto exacto (ej. "Proveedor seleccionado:"), sin depender de
// snapshots del bloque completo de metadata.
function metaValueFor(label: string): string {
  const dt = screen.getByText(label);
  const dd = dt.nextElementSibling;
  expect(dd).not.toBeNull();
  return dd!.textContent ?? "";
}

describe("AssistantResponseCard: 1. Gemini genera la respuesta exitosamente", () => {
  it("muestra proveedor seleccionado=Gemini, autor=Gemini, modelo visible, sin fallback, con fuente interna", () => {
    const response = baseResponse({
      selectedProvider: "gemini",
      attemptedProvider: "gemini",
      actualProvider: "gemini",
      providerModel: "gemini-3.5-flash",
      providerFallback: false,
      answerKind: "backed",
      internalSourceUsed: "Fly Electric Solutions LLC internal knowledge base"
    });
    render(<AssistantResponseCard response={response} uiLang="es" />);

    expect(metaValueFor("Proveedor seleccionado:")).toBe("Gemini");
    expect(metaValueFor("Respuesta generada por:")).toBe("Gemini");
    expect(metaValueFor("Modelo intentado:")).toBe("gemini-3.5-flash");
    expect(metaValueFor("Fuente interna:")).toBe("Fly Electric Solutions LLC internal knowledge base");
    // Fallback: No -> la fila "Motivo del fallback" no debe existir en absoluto.
    expect(screen.queryByText("Motivo del fallback:")).toBeNull();
    // Estado debe reflejar "Respaldada" (answerKind=backed), no un estado de fallback.
    expect(metaValueFor("Estado:")).toBe("Respaldada");
  });
});

describe("AssistantResponseCard: 2. Gemini falla y responde el motor tecnico local", () => {
  it("nunca muestra a Gemini como autor real; el estado y el motivo quedan sanitizados", () => {
    const response = baseResponse({
      selectedProvider: "gemini",
      attemptedProvider: "gemini",
      actualProvider: "local_validated_fallback",
      providerModel: "gemini-3.5-flash",
      providerFallback: true,
      providerErrorCode: "timeout",
      answerKind: "validated_fallback"
    });
    render(<AssistantResponseCard response={response} uiLang="es" />);

    expect(metaValueFor("Proveedor seleccionado:")).toBe("Gemini");
    // "Respuesta generada por" NUNCA debe decir "Gemini" cuando Gemini fallo.
    const actualProviderValue = metaValueFor("Respuesta generada por:");
    expect(actualProviderValue).toBe("Motor tecnico local");
    expect(actualProviderValue).not.toBe("Gemini");
    expect(metaValueFor("Estado:")).toBe("Fallback validado");
    // El motivo del fallback es el CODIGO sanitizado (ej. "timeout"), nunca
    // un mensaje crudo del proveedor ni una traza de error.
    expect(metaValueFor("Motivo del fallback:")).toBe("timeout");
    // Gemini SI aparece como "proveedor seleccionado/intentado" (eso es
    // honesto: se intento llamar a Gemini), pero en NINGUN lugar del
    // documento aparece como autor de la respuesta.
    expect(screen.queryByText((_, el) => el?.textContent === "Gemini" && el.tagName === "DD" && el.previousElementSibling?.textContent === "Respuesta generada por:")).toBeNull();
  });
});

describe("AssistantResponseCard: 3. Respuesta respaldada por la base interna (Supabase)", () => {
  it("muestra trazabilidad correcta cuando la respuesta viene de knowledge_entries, sin intentar ningun proveedor", () => {
    const response = baseResponse({
      selectedProvider: "gemini",
      attemptedProvider: "none",
      actualProvider: "supabase_knowledge_entries",
      answerKind: "backed",
      internalSourceUsed: "public.knowledge_entries (Supabase catalog)"
    });
    render(<AssistantResponseCard response={response} uiLang="es" />);

    expect(metaValueFor("Respuesta generada por:")).toBe("Base de conocimiento (Supabase)");
    expect(metaValueFor("Fuente interna:")).toBe("public.knowledge_entries (Supabase catalog)");
    // attemptedProvider="none": no hay "Modelo intentado" que mostrar.
    expect(screen.queryByText("Modelo intentado:")).toBeNull();
  });
});

describe("AssistantResponseCard: 4. Ausencia de fuente interna, sin mostrar informacion enganosa", () => {
  it("si no hay ningun metadato de proveedor/fuente, el bloque de metadata no se renderiza en absoluto", () => {
    const response = baseResponse();
    render(<AssistantResponseCard response={response} uiLang="es" />);

    expect(screen.queryByText("Fuente interna:")).toBeNull();
    expect(screen.queryByText("Proveedor seleccionado:")).toBeNull();
    expect(screen.queryByText("Respuesta generada por:")).toBeNull();
    // Sin sourceInfo, tampoco se muestra la seccion de "Base interna usada
    // para esta respuesta": nunca se rellena con un placeholder generico.
    expect(screen.queryByText("Base interna usada para esta respuesta")).toBeNull();
  });
});

describe("AssistantResponseCard: 5. Idiomas (espanol, ingles, bilingue)", () => {
  it("uiLang='es' usa las etiquetas en espanol", () => {
    render(<AssistantResponseCard response={baseResponse()} uiLang="es" />);
    expect(screen.getByText("1. Respuesta corta")).toBeInTheDocument();
    expect(screen.getByText("2. NEC aplicable / regulacion aplicable")).toBeInTheDocument();
  });

  it("uiLang='en' usa las etiquetas en ingles", () => {
    render(<AssistantResponseCard response={baseResponse()} uiLang="en" />);
    expect(screen.getByText("1. Short answer")).toBeInTheDocument();
    expect(screen.getByText("2. Applicable NEC / applicable regulation")).toBeInTheDocument();
  });

  it("modo bilingue: shortAnswer en espanol + englishSummary visible simultaneamente bajo uiLang='es'", () => {
    const response = baseResponse({
      shortAnswer: "Respuesta en espanol.",
      englishSummary: "Summary in English."
    });
    render(<AssistantResponseCard response={response} uiLang="es" />);
    expect(screen.getByText("Respuesta en espanol.")).toBeInTheDocument();
    expect(screen.getByText("English summary")).toBeInTheDocument();
    expect(screen.getByText("Summary in English.")).toBeInTheDocument();
  });
});

describe("AssistantResponseCard: 6. Contenido extenso no rompe la interfaz", () => {
  it("renderiza un checklist largo y una fuente interna extensa sin lanzar y con la clase de wrap esperada", () => {
    const longChecklist = Array.from({ length: 40 }, (_, i) => `Paso de verificacion numero ${i + 1} con texto largo para probar overflow`);
    const longSource = "x".repeat(2000);
    const response = baseResponse({
      checklist: longChecklist,
      internalSourceUsed: longSource,
      actualProvider: "gemini",
      selectedProvider: "gemini"
    });
    render(<AssistantResponseCard response={response} uiLang="es" />);

    // Todos los items del checklist se renderizan (nada se trunca).
    expect(screen.getAllByRole("checkbox")).toHaveLength(40);
    expect(screen.getByText(longChecklist[0])).toBeInTheDocument();
    expect(screen.getByText(longChecklist[39])).toBeInTheDocument();

    // El contenedor de la fuente interna usa una clase de wrap explicita
    // (break-words) para que un texto largo sin espacios no desborde el
    // contenedor.
    const sourceDd = screen.getByText(longSource);
    expect(sourceDd.className).toContain("break-words");
  });
});

describe("AssistantResponseCard: 7. Accesibilidad basica de etiquetas y estados", () => {
  it("cada item del checklist es un checkbox real (input[type=checkbox])", () => {
    render(<AssistantResponseCard response={baseResponse()} uiLang="es" />);
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute("type", "checkbox"));
  });

  it("las secciones usan encabezados semanticos (heading) para cada titulo visible", () => {
    render(<AssistantResponseCard response={baseResponse()} uiLang="es" />);
    expect(screen.getByRole("heading", { name: "1. Respuesta corta" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "6. Checklist de campo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "7. Riesgo" })).toBeInTheDocument();
  });

  it("el control de 'Escuchar' es un boton real accesible por rol y nombre", () => {
    render(<AssistantResponseCard response={baseResponse()} uiLang="es" />);
    expect(screen.getByRole("button", { name: /Escuchar/ })).toBeInTheDocument();
  });

  it("el badge de riesgo muestra el estado como texto visible (no solo color)", () => {
    render(<AssistantResponseCard response={baseResponse({ riskLevel: "critico" })} uiLang="es" />);
    const riskSection = screen.getByRole("heading", { name: "7. Riesgo" }).closest("section")!;
    expect(within(riskSection).getByText("Critico")).toBeInTheDocument();
  });
});

describe("AssistantResponseCard: 8. explanation y commonMistakes (Sprint 2, campos separados)", () => {
  it("con explanation y commonMistakes presentes, ambas secciones se muestran con su propio contenido, distinto de shortAnswer/checklist", () => {
    const response = baseResponse({
      explanation: "Texto de explicacion extendida, distinto de la respuesta corta.",
      commonMistakes: ["Error comun uno", "Error comun dos"]
    });
    render(<AssistantResponseCard response={response} uiLang="es" />);

    expect(screen.getByRole("heading", { name: "Explicacion" })).toBeInTheDocument();
    expect(screen.getByText("Texto de explicacion extendida, distinto de la respuesta corta.")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Errores comunes" })).toBeInTheDocument();
    expect(screen.getByText("Error comun uno")).toBeInTheDocument();
    expect(screen.getByText("Error comun dos")).toBeInTheDocument();

    // El checklist original (baseResponse) sigue mostrandose intacto, sin
    // que los errores comunes se hayan fusionado dentro de el.
    expect(screen.getByText("Paso de verificacion 1")).toBeInTheDocument();
    expect(screen.queryByText(/Error comun.*Paso de verificacion/)).toBeNull();
  });

  it("uiLang='en' usa las etiquetas 'Explanation' y 'Common mistakes'", () => {
    const response = baseResponse({
      explanation: "Extended explanation text.",
      commonMistakes: ["Mistake one"]
    });
    render(<AssistantResponseCard response={response} uiLang="en" />);
    expect(screen.getByRole("heading", { name: "Explanation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Common mistakes" })).toBeInTheDocument();
  });

  it("sin explanation ni commonMistakes (las 21 entradas anteriores a Sprint 2), no aparece ningun encabezado vacio", () => {
    const response = baseResponse();
    render(<AssistantResponseCard response={response} uiLang="es" />);
    expect(screen.queryByRole("heading", { name: "Explicacion" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Errores comunes" })).toBeNull();
    expect(screen.queryByText("Explicacion")).toBeNull();
    expect(screen.queryByText("Errores comunes")).toBeNull();
  });

  it("con commonMistakes como array vacio (nunca se define asi en la practica, pero por contrato), tampoco muestra el encabezado", () => {
    const response = baseResponse({ commonMistakes: [] });
    render(<AssistantResponseCard response={response} uiLang="es" />);
    expect(screen.queryByRole("heading", { name: "Errores comunes" })).toBeNull();
  });
});
