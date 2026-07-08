import type { AssistantResponse, Language } from "../db/types";
import { standardWarning, verifyNecMessage, type AskAssistantInput } from "./types";
import { searchKnowledgeEntries } from "../db/repos/knowledgeBase";

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function base(language: Language, overrides: Partial<AssistantResponse>): AssistantResponse {
  return {
    shortAnswer: "",
    riskLevel: "medio",
    codeReference: verifyNecMessage(language),
    checklist: [],
    missingQuestions: [],
    recommendation: "",
    warning: standardWarning(language),
    ...overrides
  };
}

function withKnowledgeNote(question: string): string | undefined {
  const hits = searchKnowledgeEntries(question);
  if (hits.length === 0) return undefined;
  return `Referencia interna disponible: "${hits[0].title}" (${hits[0].category}). Consulta la Base de Conocimiento para el detalle completo.`;
}

export async function mockAskAssistant(input: AskAssistantInput): Promise<AssistantResponse> {
  const q = input.question.toLowerCase();
  const language = input.language;
  const kbNote = withKnowledgeNote(q);

  // EV charger
  if (includesAny(q, ["ev charger", "cargador ev", "electric vehicle", "carro electrico", "coche electrico"])) {
    return base(language, {
      shortAnswer:
        "Un EV charger de 48A es una carga continua: el breaker debe ser minimo 125% de la carga continua (48A x 1.25 = 60A), por lo que un breaker de 60A dedicado es el tamano tipico esperado para ese charger, siempre que el conductor y el circuito esten dimensionados igual para 125% de la carga continua.",
      englishSummary:
        "A 48A EV charger is a continuous load: the breaker must be at least 125% of the continuous load (48A x 1.25 = 60A), so a dedicated 60A breaker is the typical expected size, provided the conductor and circuit are also sized for 125% of the continuous load.",
      riskLevel: "alto",
      codeReference: `NEC Article 625 (EV charging equipment) y regla general de 125% para carga continua. ${verifyNecMessage(language)}`,
      checklist: [
        "Confirmar amperaje real de placa del EV charger",
        "Confirmar que el circuito es dedicado (sin otras cargas)",
        "Verificar calibre de conductor para 125% de la carga continua",
        "Verificar capacidad disponible en el panel (load calculation)",
        "Verificar si se requiere permiso local para EV charger",
        "Confirmar metodo de instalacion (conduit, distancia al panel)"
      ],
      missingQuestions: [
        "Ciudad / jurisdiccion (AHJ)",
        "Amperaje exacto de placa del cargador",
        "Calibre y tipo de conductor instalado",
        "Distancia entre el panel y el EV charger",
        "Capacidad disponible en el panel segun ultimo load calculation"
      ],
      recommendation:
        "Documentar los datos de placa del charger y el load calculation antes de continuar. Escalar al Master Electrician por ser un circuito de alto riesgo (feeder/EV charger)."
    });
  }

  // GFCI
  if (includesAny(q, ["gfci", "falla a tierra", "ground fault"])) {
    return base(language, {
      shortAnswer:
        "Los receptaculos en banos, cocinas (cerca de countertops), garajes, exteriores, sotanos no terminados, y a menos de 6 pies de un fregadero generalmente requieren proteccion GFCI. La ubicacion exacta y el tipo de ocupacion determinan el requisito final.",
      englishSummary:
        "Receptacles in bathrooms, kitchens (near countertops), garages, exteriors, unfinished basements, and within 6 feet of a sink generally require GFCI protection. The exact location and occupancy type determine the final requirement.",
      riskLevel: "medio",
      codeReference: `NEC Article 210.8 (proteccion GFCI para personas). ${verifyNecMessage(language)}`,
      checklist: [
        "Confirmar ubicacion exacta del receptaculo",
        "Confirmar distancia a fregadero o fuente de agua",
        "Verificar si el receptaculo es interior o exterior",
        "Probar el boton de test/reset del GFCI instalado"
      ],
      missingQuestions: [
        "Ubicacion exacta del receptaculo (bano, cocina, garage, exterior, etc.)",
        "Tipo de ocupacion (residencial o comercial)"
      ],
      recommendation: "Continuar con la instalacion aplicando GFCI si la ubicacion corresponde a un area requerida; documentar la ubicacion en el reporte."
    });
  }

  // Panel upgrade
  if (includesAny(q, ["panel upgrade", "cambiar panel", "upgrade de panel", "150a", "200a", "cambio de panel"])) {
    return base(language, {
      shortAnswer:
        "Antes de un panel upgrade de 150A a 200A debes verificar el load calculation actualizado, la capacidad del feeder/service entrance existente, el grounding electrode system, el bonding de tuberias de agua/gas, el clearance de trabajo frente al panel, y coordinar el corte de servicio con la utility.",
      englishSummary:
        "Before a 150A to 200A panel upgrade, verify the updated load calculation, existing feeder/service entrance capacity, grounding electrode system, water/gas pipe bonding, working clearance in front of the panel, and coordinate the service disconnect with the utility.",
      riskLevel: "alto",
      codeReference: `NEC Article 220 (load calculations), Article 250 (grounding and bonding), Article 110.26 (working space). ${verifyNecMessage(language)}`,
      checklist: [
        "Load calculation actualizado para 200A",
        "Verificar capacidad del feeder/conductor de acometida",
        "Revisar grounding electrode system (varilla, conexion a agua, bonding)",
        "Confirmar bonding de tuberia de agua y gas",
        "Verificar clearance de trabajo (30 in x 36 in minimo tipico)",
        "Coordinar corte de servicio con la utility",
        "Verificar permiso de Houston Permitting Center / AHJ correspondiente"
      ],
      missingQuestions: [
        "Ciudad / jurisdiccion (AHJ)",
        "Tipo de ocupacion (residencial/comercial)",
        "Calibre del conductor de acometida actual",
        "Ultimo load calculation disponible"
      ],
      recommendation: "Escalar al Master Electrician antes de cotizar o ejecutar: es un trabajo de servicio principal / alto riesgo."
    });
  }

  // Grounding / bonding
  if (includesAny(q, ["grounding", "bonding", "puesta a tierra", "union equipotencial"])) {
    return base(language, {
      shortAnswer:
        "En grounding y bonding debes verificar: electrodo de puesta a tierra (varilla, Ufer, o tuberia metalica de agua), conductor de grounding electrode con calibre correcto, bonding de tuberia de agua y gas, bonding de la estructura metalica del panel, y continuidad electrica en todo el sistema.",
      englishSummary:
        "For grounding and bonding, verify the grounding electrode (rod, Ufer, or metal water pipe), correctly sized grounding electrode conductor, water and gas pipe bonding, panel metal enclosure bonding, and electrical continuity throughout the system.",
      riskLevel: "alto",
      codeReference: `NEC Article 250 (grounding and bonding). ${verifyNecMessage(language)}`,
      checklist: [
        "Verificar electrodo de puesta a tierra presente y accesible",
        "Verificar calibre del grounding electrode conductor",
        "Confirmar bonding de tuberia de agua metalica",
        "Confirmar bonding de tuberia de gas si aplica",
        "Verificar continuidad electrica con multimetro",
        "Verificar bonding jumper en el panel si es subpanel"
      ],
      missingQuestions: ["Tipo de electrodo disponible en sitio", "Es panel principal o subpanel"],
      recommendation: "Riesgo alto (shock electrico / fire hazard si falla). Escalar al Master Electrician para verificacion final."
    });
  }

  // Checklist pre-inspeccion
  if (includesAny(q, ["checklist", "antes de inspeccion", "pre-inspeccion", "before inspection"])) {
    return base(language, {
      shortAnswer:
        "Checklist general antes de solicitar inspeccion: panel etiquetado y accesible, grounding/bonding completos, breakers correctamente dimensionados, GFCI/AFCI donde aplica, conduit fill y box fill dentro de limites, disconnects visibles y etiquetados, y permisos visibles en sitio.",
      englishSummary:
        "General pre-inspection checklist: labeled and accessible panel, complete grounding/bonding, correctly sized breakers, GFCI/AFCI where required, conduit fill and box fill within limits, visible and labeled disconnects, and permits visible on site.",
      riskLevel: "bajo",
      codeReference: `Buenas practicas internas + NEC general. ${verifyNecMessage(language)}`,
      checklist: [
        "Panel etiquetado y accesible",
        "Grounding y bonding completos",
        "Breakers dimensionados correctamente",
        "GFCI/AFCI donde aplica",
        "Conduit fill y box fill dentro de limites NEC",
        "Disconnects visibles y etiquetados",
        "Permiso visible en sitio"
      ],
      missingQuestions: [],
      recommendation: "Puedes continuar con la solicitud de inspeccion si todos los puntos del checklist estan completos y documentados."
    });
  }

  // Preguntas antes de cotizar
  if (includesAny(q, ["cotizar", "antes de cotizar", "quote", "cotizacion"])) {
    return base(language, {
      shortAnswer:
        "Antes de cotizar necesitas confirmar: ciudad/jurisdiccion (AHJ), tipo de servicio y amperaje actual, tipo de ocupacion, hoja(s) del set de planos disponibles, escala del dibujo, si el panel schedule esta completo, y si hay adendums posteriores al set original.",
      englishSummary:
        "Before quoting, confirm: city/jurisdiction (AHJ), current service type and amperage, occupancy type, available drawing sheet(s), drawing scale, whether the panel schedule is complete, and whether there are addenda after the original set.",
      riskLevel: "bajo",
      codeReference: verifyNecMessage(language),
      checklist: [
        "Confirmar ciudad y AHJ",
        "Confirmar tipo de servicio y amperaje",
        "Confirmar tipo de ocupacion",
        "Confirmar hoja(s) de plano disponibles",
        "Confirmar escala del dibujo",
        "Revisar si el panel schedule esta completo"
      ],
      missingQuestions: [
        "Ciudad / jurisdiccion (AHJ)",
        "Tipo de servicio y amperaje",
        "Tipo de ocupacion",
        "Hoja del plano a revisar",
        "Escala del dibujo"
      ],
      recommendation: "Pedir la informacion faltante al cliente o al diseñador antes de emitir una cotizacion formal."
    });
  }

  // Resumen/lectura de plano solicitada por texto sin archivo adjunto
  if (includesAny(q, ["resume este plano", "resumen del plano", "plano electrico", "hoja e", "panel schedule", "one-line"])) {
    return base(language, {
      shortAnswer:
        "Para resumir un plano electrico o revisar un panel schedule necesito que subas el archivo (PDF o imagen JPG/PNG) en la seccion 'Planos' y me indiques la hoja especifica (por ejemplo E2.1 Power Plan o E4.1 Panel Schedules).",
      englishSummary:
        "To summarize an electrical drawing or review a panel schedule, please upload the file (PDF or JPG/PNG image) in the 'Plans' section and tell me the specific sheet (e.g. E2.1 Power Plan or E4.1 Panel Schedules).",
      riskLevel: "bajo",
      codeReference: verifyNecMessage(language),
      checklist: ["Subir el plano en la seccion Planos", "Indicar la hoja especifica a revisar"],
      missingQuestions: ["Hoja del plano (E0.1, E1.1, E2.1, E3.1, E4.1, E5.1, etc.)", "Archivo PDF o imagen del plano"],
      recommendation: "Pedir mas informacion: sube el plano para poder hacer una lectura preliminar."
    });
  }

  // Fallback generico
  return base(language, {
    shortAnswer:
      "Entiendo tu consulta general. Con la informacion disponible no puedo dar un detalle tecnico especifico todavia: cuentame mas sobre el tipo de trabajo, ubicacion, amperaje y circuito involucrado para darte una revision preliminar mas precisa.",
    englishSummary:
      "I understand your general question. With the information available I cannot give a specific technical detail yet: tell me more about the type of work, location, amperage, and circuit involved so I can give a more precise preliminary review.",
    riskLevel: "bajo",
    codeReference: verifyNecMessage(language),
    checklist: ["Recopilar mas detalles tecnicos de la consulta", "Confirmar ubicacion y tipo de trabajo"],
    missingQuestions: [
      "Ciudad / tipo de servicio",
      "Amperaje / breaker involucrado",
      "Tipo de conductor",
      "Carga o equipo involucrado",
      "Distancia de instalacion",
      "Tipo de ocupacion"
    ],
    recommendation: kbNote
      ? `Pedir mas informacion antes de dar una recomendacion tecnica especifica. ${kbNote}`
      : "Pedir mas informacion antes de dar una recomendacion tecnica especifica."
  });
}
