import { describe, it, expect } from "vitest";
import { mockAskAssistant } from "@/lib/ai/mockAssistant";

// FASE C.7: invariantes tecnicos criticos para un alimentador residencial de
// 200A a tablero secundario con conductores de aluminio (contenido real de
// lib/knowledge/electricalKnowledgeBase.ts, entrada kb-feeder-subpanel-aluminum).
//
// Por diseno explicito del pedido: se prueban INVARIANTES (presencia de
// condiciones, ausencia de afirmaciones absolutas peligrosas), NUNCA se
// compara el parrafo completo contra un texto fijo. Si el contenido de la
// entrada cambia de redaccion pero preserva estas garantias, el test sigue
// pasando; si alguna garantia de seguridad se pierde, el test debe fallar.

const QUESTION = "necesito el calibre del alimentador de aluminio para el tablero secundario de 200a que abastece parte de la vivienda";

async function getFeederResponse() {
  return mockAskAssistant({ question: QUESTION, language: "es" });
}

describe("Invariante: un alimentador downstream del service disconnect se clasifica como feeder", () => {
  it("la respuesta viene de la entrada de feeders (no de panels/services)", async () => {
    const response = await getFeederResponse();
    expect(response.sourceInfo).toContain("Alimentador a tablero secundario");
  });
});

describe("Invariante: 4 conductores, neutro y tierra separados en el subpanel", () => {
  it("la respuesta exige neutro aislado y EGC a barra de tierra separada (nunca bonded en el subpanel)", async () => {
    const response = await getFeederResponse();
    const fullText = `${response.shortAnswer} ${response.checklist.join(" ")}`;
    expect(fullText).toMatch(/neutro aislado/i);
    expect(fullText).toMatch(/barra de tierra separada/i);
    expect(fullText).toMatch(/4 conductores|cuatro conductores/i);
  });

  it("aclara que neutro y tierra solo se unen en el primer medio de desconexion del servicio, no en el subpanel", () => {
    return getFeederResponse().then((response) => {
      expect(response.shortAnswer).toMatch(/neutro y (la )?tierra solo se unen en el primer medio de desconexion/i);
    });
  });
});

describe("Invariante: NEC 310.12 se aplica de forma CONDICIONADA, nunca por defecto", () => {
  it("menciona 310.12 solo junto a la condicion de que el alimentador cubra la carga COMPLETA de la vivienda", async () => {
    const response = await getFeederResponse();
    expect(response.shortAnswer).toMatch(/310\.12/);
    expect(response.shortAnswer).toMatch(/SOLO se puede usar cuando el alimentador abastece la carga COMPLETA/);
  });

  it("el checklist exige confirmar explicitamente si el alimentador abastece la carga completa antes de aplicar 310.12", async () => {
    const response = await getFeederResponse();
    expect(response.checklist.join(" ")).toMatch(/confirmar si el alimentador abastece la carga completa/i);
  });
});

describe("Invariante: 4/0 Al vs 250 kcmil Al NUNCA se presentan como intercambiables", () => {
  it("el texto declara explicitamente que no son intercambiables", async () => {
    const response = await getFeederResponse();
    expect(response.shortAnswer).toMatch(/4\/0 AWG aluminio y 250 kcmil aluminio NO son intercambiables/);
  });

  it("el checklist refuerza programaticamente la misma regla (no solo el prompt)", async () => {
    const response = await getFeederResponse();
    expect(response.checklist.join(" ")).toMatch(/no presentar 4\/0 awg al y 250 kcmil al como intercambiables/i);
  });
});

describe("Invariante: no se calcula una caida de voltaje exacta sin carga real", () => {
  it("el checklist exige carga real, corriente, conductor exacto, temperatura y factor de potencia antes de calcular", async () => {
    const response = await getFeederResponse();
    const checklistText = response.checklist.join(" ").toLowerCase();
    expect(checklistText).toMatch(/calcular caida de voltaje con carga real, corriente, conductor exacto, temperatura y factor de potencia/);
  });

  it("missingQuestions incluye la carga calculada real como dato pendiente", async () => {
    const response = await getFeederResponse();
    expect(response.missingQuestions.join(" ").toLowerCase()).toMatch(/carga calculada real/);
  });

  it("aclara que el 3%/5% es una recomendacion (Informational Note), no una regla dura obligatoria por defecto", async () => {
    const response = await getFeederResponse();
    expect(response.shortAnswer).toMatch(/Informational Note/);
    expect(response.shortAnswer).not.toMatch(/el NEC exige un limite de caida de voltaje/i);
  });
});

describe("Invariante: el tamano de tuberia se calcula, nunca se asume", () => {
  it("no se prescribe un tamano fijo de tuberia como '2 pulgadas' de forma automatica", async () => {
    const response = await getFeederResponse();
    // La respuesta puede MENCIONAR "2 pulgadas" solo como ejemplo dentro de
    // una frase que dice que NO se selecciona asi; nunca debe aparecer como
    // una instruccion directa aislada tipo "usa tuberia de 2 pulgadas".
    expect(response.shortAnswer).not.toMatch(/\bus[ae]\s+tuberia de 2 pulgadas\b/i);
    expect(response.shortAnswer).toMatch(/no se selecciona un tamaño.*sin calcular el llenado real/i);
  });

  it("exige calcular conduit fill con NEC Chapter 9 Tables 1, 4 y 5 antes de dar un tamaño", async () => {
    const response = await getFeederResponse();
    expect(response.shortAnswer).toMatch(/NEC Chapter 9 Tables 1, 4 y 5/);
    expect(response.checklist.join(" ")).toMatch(/calcular conduit fill/i);
  });
});

describe("Invariante: PVC Schedule 80 se condiciona a exposicion a daño fisico", () => {
  it("Schedule 80 aparece condicionado, no como recomendacion general", async () => {
    const response = await getFeederResponse();
    expect(response.shortAnswer).toMatch(/donde la tuberia quede expuesta a daño fisico se requiere PVC Schedule 80/);
    // El texto declara explicitamente que NO recomienda Schedule 40 de forma
    // general (la negacion es la garantia de seguridad, no su ausencia).
    expect(response.shortAnswer).toMatch(/no se recomienda PVC Schedule 40 de forma general/i);
  });
});

describe("Invariante: el compuesto antioxidante se condiciona al listado/instrucciones del fabricante", () => {
  it("nunca se presenta como un paso automatico u obligatorio del NEC", async () => {
    const response = await getFeederResponse();
    expect(response.shortAnswer).toMatch(/compuesto antioxidante.*SOLO si las instrucciones o el listado del fabricante/i);
    expect(response.checklist.join(" ")).toMatch(/verificar si el fabricante de las terminales\/conectores exige o permite compuesto antioxidante/i);
  });
});

describe("Invariante: no se emite una lista final de materiales sin datos suficientes", () => {
  it("el checklist y las preguntas faltantes bloquean explicitamente una lista final de materiales", async () => {
    const response = await getFeederResponse();
    expect(response.checklist.join(" ").toLowerCase()).toMatch(/no emitir lista final de materiales hasta resolver todas las preguntas pendientes/);
    expect(response.missingQuestions.length).toBeGreaterThan(0);
  });

  // Nota de alcance (no es un test): el refuerzo adicional de "pendingNote"
  // sobre doNotAssume cuando hay missingQuestions vive en
  // app/api/queries/route.ts (fuera de mockAssistant.ts) y se cubre en
  // tests/integration/queriesRoute.test.ts, no aqui.
});
