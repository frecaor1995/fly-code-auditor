import type { AssistantResponse, Language } from "../db/types";
import { standardWarning, verifyNecMessage, type AskAssistantInput } from "./types";
import { searchKnowledgeEntries, listKnowledgeEntries } from "../db/repos/knowledgeBase";

type Confidence = "alto" | "medio" | "bajo";

interface CategoryDef {
  keywords: string[];
  categoria: string;
  referencia: string;
  tipo: string;
  confianza: Confidence;
  // Id de la entrada real en data/knowledgeBase.json que respalda esta
  // categoria, cuando existe. Se usa para armar el campo "Archivo interno"
  // apuntando a un registro concreto y verificable, no a un texto generico.
  kbId?: string;
}

// Fuente unica de verdad para deteccion de categoria: la misma lista de
// keywords se usa para (a) disparar la respuesta tecnica de cada tema y
// (b) identificar de que categoria habla una pregunta meta sobre la fuente
// interna (ver isSourceInfoQuestion / detectCategory mas abajo). Si estas
// listas viven duplicadas, terminan desincronizadas: por eso viven aqui una
// sola vez.
const CATEGORY_EV_CHARGER: CategoryDef = {
  keywords: ["ev charger", "cargador ev", "electric vehicle", "carro electrico", "coche electrico"],
  categoria: "EV charger",
  referencia: "NEC Article 625 (EV charging equipment) y regla general de 125% para carga continua",
  tipo: "regla tecnica general",
  confianza: "medio",
  kbId: "kb-5"
};

const CATEGORY_GFCI: CategoryDef = {
  keywords: ["gfci", "falla a tierra", "ground fault"],
  categoria: "GFCI / proteccion de personas",
  referencia: "NEC Article 210.8 (proteccion GFCI para personas)",
  tipo: "regla tecnica general",
  confianza: "medio"
};

const CATEGORY_PANEL_UPGRADE: CategoryDef = {
  keywords: ["panel upgrade", "cambiar panel", "upgrade de panel", "150a", "200a", "cambio de panel"],
  categoria: "Panel upgrade",
  referencia: "NEC Article 220 (load calculations), Article 250 (grounding and bonding), Article 110.26 (working space)",
  tipo: "checklist operativo",
  confianza: "medio",
  kbId: "kb-6"
};

const CATEGORY_GROUNDING: CategoryDef = {
  keywords: ["grounding", "bonding", "puesta a tierra", "union equipotencial"],
  categoria: "Grounding y bonding",
  referencia: "NEC Article 250 (grounding and bonding)",
  tipo: "regla tecnica general",
  confianza: "medio"
};

const CATEGORY_TDLR: CategoryDef = {
  keywords: ["tdlr", "licencia", "license", "supervision", "supervisor", "master electrician license"],
  categoria: "TDLR / licencias y supervision del Master Electrician",
  referencia: "Reglas de licenciamiento TDLR (Texas Department of Licensing and Regulation)",
  tipo: "guia interna general",
  confianza: "bajo",
  kbId: "kb-4"
};

const CATEGORY_AHJ: CategoryDef = {
  keywords: ["ahj", "houston permitting", "permitting center", "permiso", "permit"],
  categoria: "Houston AHJ / Permitting Center",
  referencia: "Houston Permitting Center / AHJ local",
  tipo: "guia interna general",
  confianza: "bajo",
  kbId: "kb-3"
};

const CATEGORY_LOTO: CategoryDef = {
  keywords: ["nfpa 70e", "loto", "bloqueo", "etiquetado", "lockout", "tagout", "arc flash", "epp"],
  categoria: "NFPA 70E / LOTO",
  referencia: "NFPA 70E (seguridad electrica en el lugar de trabajo)",
  tipo: "regla tecnica general",
  confianza: "medio",
  kbId: "kb-2"
};

const CATEGORY_SYMBOLS: CategoryDef = {
  keywords: ["simbologia", "simbolo", "symbol", "leyenda del plano", "legend"],
  categoria: "Simbologia electrica / lectura de planos",
  referencia: "Referencia interna de simbologia; confirmar siempre contra la leyenda especifica del set de planos",
  tipo: "guia interna general",
  confianza: "bajo",
  kbId: "kb-7"
};

const CATEGORY_CHECKLIST: CategoryDef = {
  keywords: ["checklist", "antes de inspeccion", "pre-inspeccion", "before inspection"],
  categoria: "Checklist de inspeccion",
  referencia: "Buenas practicas internas + NEC general",
  tipo: "checklist operativo",
  confianza: "bajo",
  kbId: "kb-1"
};

const CATEGORY_QUOTE: CategoryDef = {
  keywords: ["cotizar", "antes de cotizar", "quote", "cotizacion"],
  categoria: "Preguntas previas a cotizar",
  referencia: "Procedimiento interno de cotizacion",
  tipo: "checklist operativo",
  confianza: "bajo",
  kbId: "kb-9"
};

const CATEGORY_PLAN_SUMMARY: CategoryDef = {
  keywords: ["resume este plano", "resumen del plano", "plano electrico", "hoja e", "panel schedule", "one-line"],
  categoria: "Lectura de planos (sin archivo adjunto)",
  referencia: "Procedimiento interno de lectura de planos",
  tipo: "guia interna general",
  confianza: "bajo",
  kbId: "kb-8"
};

const CATEGORY_DEFS: CategoryDef[] = [
  CATEGORY_EV_CHARGER,
  CATEGORY_GFCI,
  CATEGORY_PANEL_UPGRADE,
  CATEGORY_GROUNDING,
  CATEGORY_TDLR,
  CATEGORY_AHJ,
  CATEGORY_LOTO,
  CATEGORY_SYMBOLS,
  CATEGORY_CHECKLIST,
  CATEGORY_QUOTE,
  CATEGORY_PLAN_SUMMARY
];

// Frases que identifican una pregunta META (sobre la fuente/base interna que
// respalda una respuesta) en vez de una pregunta tecnica electrica. Esta
// deteccion corre ANTES que cualquier categoria tecnica: de lo contrario,
// una pregunta como "¿esta respuesta viene de NEC, TDLR o Houston AHJ?"
// coincide con las keywords de TDLR/AHJ y dispara por error una respuesta
// tecnica de licencias o permisos en vez de explicar la fuente.
const META_SOURCE_KEYWORDS = [
  "fuente interna",
  "base de conocimiento",
  "de donde sacas",
  "de donde obtienes",
  "de donde viene esta respuesta",
  "archivo interno",
  "categoria usaste",
  "categoria usada",
  "categoria detectada",
  "que categoria",
  "nivel de confianza",
  "viene de nec",
  "viene del nec",
  "viene de tdlr",
  "viene de houston ahj",
  "viene de ahj",
  "es guia general",
  "regla tecnica",
  "con base en que fuente",
  "cual es la fuente",
  "que fuente"
];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function isSourceInfoQuestion(normalizedQuestion: string): boolean {
  return includesAny(normalizedQuestion, META_SOURCE_KEYWORDS);
}

function detectCategory(normalizedQuestion: string): CategoryDef | undefined {
  return CATEGORY_DEFS.find((cat) => includesAny(normalizedQuestion, cat.keywords));
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

// Deja explicito, en cada respuesta, que el motor NO consulta el texto
// oficial completo del NEC: consulta una base interna de referencia armada
// por Fly Electric Solutions LLC a partir de NEC 2023, TDLR y Houston AHJ.
const INTERNAL_SOURCE_DOMAIN_ES =
  "Base interna de referencia de Fly Electric Solutions LLC (elaborada a partir de NEC 2023, TDLR y Houston AHJ). No es el texto oficial completo del NEC.";
const INTERNAL_SOURCE_DOMAIN_EN =
  "Fly Electric Solutions LLC internal reference base (built from NEC 2023, TDLR, and Houston AHJ). This is not the full official NEC text.";

const GENERIC_INTERNAL_FILE = "lib/ai/mockAssistant.ts (regla interna del motor de reglas, sin entrada dedicada en data/knowledgeBase.json)";

// Apunta el campo "Archivo interno" a un registro real y verificable de
// data/knowledgeBase.json cuando la categoria tiene uno asociado (kbId). Si
// no existe entrada dedicada, se declara explicitamente en vez de inventar
// una referencia de archivo.
function archivoInternoFor(kbId?: string): string {
  if (kbId) {
    const entry = listKnowledgeEntries().find((e) => e.id === kbId);
    if (entry) {
      return `data/knowledgeBase.json (${entry.id}: "${entry.title}")`;
    }
  }
  return GENERIC_INTERNAL_FILE;
}

// Bloque "Base usada para esta respuesta": deja explicito que la respuesta
// sale de la base interna (NEC 2023 / TDLR / Houston AHJ / procedimientos de
// Fly Electric Solutions LLC) y no de una consulta directa al NEC oficial.
// Se usa tanto como respuesta completa a preguntas META_SOURCE como pie de
// pagina automatico en cada respuesta tecnica normal.
function buildBaseUsadaBlock(
  language: Language,
  opts: { archivoInterno: string; categoria: string; referenciaNec: string; confianza: Confidence; masterDebeVerificar: string }
): string {
  const es = [
    "Base usada para esta respuesta:",
    `- Fuente interna usada: ${INTERNAL_SOURCE_DOMAIN_ES}`,
    `- Categoria detectada: ${opts.categoria}`,
    `- Referencia NEC general (si aplica): ${opts.referenciaNec}`,
    `- Archivo interno: ${opts.archivoInterno}`,
    `- Nivel de confianza: ${opts.confianza}`,
    `- Que debe verificar el Master Electrician: ${opts.masterDebeVerificar}`
  ].join("\n");

  if (language === "es") return es;

  const en = [
    "Source used for this response:",
    `- Internal source used: ${INTERNAL_SOURCE_DOMAIN_EN}`,
    `- Detected category: ${opts.categoria}`,
    `- General NEC reference (if applicable): ${opts.referenciaNec}`,
    `- Internal file: ${opts.archivoInterno}`,
    `- Confidence level: ${opts.confianza}`,
    `- What the Master Electrician must verify: ${opts.masterDebeVerificar}`
  ].join("\n");

  if (language === "en") return en;
  return `${es}\n\n${en}`;
}

function masterDebeVerificarFor(cat: CategoryDef): string {
  return `Confirmar "${cat.categoria}" contra ${cat.referencia}, el NEC oficial vigente, TDLR, Houston AHJ, permisos e inspeccion antes de aprobar o cerrar el trabajo.`;
}

function sourceInfoFor(language: Language, cat: CategoryDef): string {
  return buildBaseUsadaBlock(language, {
    archivoInterno: archivoInternoFor(cat.kbId),
    categoria: cat.categoria,
    referenciaNec: cat.referencia,
    confianza: cat.confianza,
    masterDebeVerificar: masterDebeVerificarFor(cat)
  });
}

const NO_SOURCE_ES =
  "No tengo suficiente informacion en la base interna para identificar la fuente exacta de una respuesta puntual. Esta base interna (data/knowledgeBase.json y lib/ai/mockAssistant.ts) es una referencia de Fly Electric Solutions LLC basada en NEC 2023, TDLR y Houston AHJ; no reemplaza el texto oficial completo del NEC. Verifique el NEC oficial, TDLR, Houston AHJ y la aprobacion del Master Electrician.";
const NO_SOURCE_EN =
  "I do not have enough information in the internal knowledge base to identify the exact source of a specific response. This internal base (data/knowledgeBase.json and lib/ai/mockAssistant.ts) is a Fly Electric Solutions LLC reference built from NEC 2023, TDLR, and Houston AHJ; it does not replace the full official NEC text. Please verify with the official NEC, TDLR, Houston AHJ, and the Master Electrician's approval.";

// Responde preguntas META sobre la fuente/base interna (no preguntas
// tecnicas electricas). Si la pregunta tambien menciona una categoria
// reconocible (EV charger, TDLR, NFPA 70E, etc.) se explica esa categoria
// puntual; si no, se usa el mensaje fijo de "no puedo identificar la fuente".
function buildSourceInfoResponse(normalizedQuestion: string, language: Language): AssistantResponse {
  const category = detectCategory(normalizedQuestion);

  if (!category) {
    return base(language, {
      shortAnswer: NO_SOURCE_ES,
      englishSummary: language !== "es" ? NO_SOURCE_EN : undefined,
      riskLevel: "bajo",
      codeReference: verifyNecMessage(language),
      recommendation: NO_SOURCE_ES
    });
  }

  return base(language, {
    shortAnswer: sourceInfoFor(language, category),
    riskLevel: "bajo",
    codeReference: category.referencia,
    recommendation: "Esta es una explicacion de la fuente interna usada, no una respuesta tecnica de instalacion."
  });
}

export async function mockAskAssistant(input: AskAssistantInput): Promise<AssistantResponse> {
  const q = normalize(input.question);
  const language = input.language;
  const kbNote = withKnowledgeNote(q);

  // Preguntas sobre la fuente/base interna: deben resolverse ANTES que
  // cualquier categoria tecnica (ver comentario junto a META_SOURCE_KEYWORDS).
  if (isSourceInfoQuestion(q)) {
    return buildSourceInfoResponse(q, language);
  }

  // EV charger
  if (includesAny(q, CATEGORY_EV_CHARGER.keywords)) {
    return base(language, {
      shortAnswer:
        "Un EV charger de 48A es una carga continua: el breaker debe ser minimo 125% de la carga continua (48A x 1.25 = 60A), por lo que un breaker de 60A dedicado es el tamano tipico esperado para ese charger, siempre que el conductor y el circuito esten dimensionados igual para 125% de la carga continua.",
      englishSummary:
        "A 48A EV charger is a continuous load: the breaker must be at least 125% of the continuous load (48A x 1.25 = 60A), so a dedicated 60A breaker is the typical expected size, provided the conductor and circuit are also sized for 125% of the continuous load.",
      riskLevel: "alto",
      codeReference: `${CATEGORY_EV_CHARGER.referencia}. ${verifyNecMessage(language)}`,
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
        "Documentar los datos de placa del charger y el load calculation antes de continuar. Escalar al Master Electrician por ser un circuito de alto riesgo (feeder/EV charger).",
      sourceInfo: sourceInfoFor(language, CATEGORY_EV_CHARGER)
    });
  }

  // GFCI
  if (includesAny(q, CATEGORY_GFCI.keywords)) {
    return base(language, {
      shortAnswer:
        "Los receptaculos en banos, cocinas (cerca de countertops), garajes, exteriores, sotanos no terminados, y a menos de 6 pies de un fregadero generalmente requieren proteccion GFCI. La ubicacion exacta y el tipo de ocupacion determinan el requisito final.",
      englishSummary:
        "Receptacles in bathrooms, kitchens (near countertops), garages, exteriors, unfinished basements, and within 6 feet of a sink generally require GFCI protection. The exact location and occupancy type determine the final requirement.",
      riskLevel: "medio",
      codeReference: `${CATEGORY_GFCI.referencia}. ${verifyNecMessage(language)}`,
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
      recommendation: "Continuar con la instalacion aplicando GFCI si la ubicacion corresponde a un area requerida; documentar la ubicacion en el reporte.",
      sourceInfo: sourceInfoFor(language, CATEGORY_GFCI)
    });
  }

  // Panel upgrade
  if (includesAny(q, CATEGORY_PANEL_UPGRADE.keywords)) {
    return base(language, {
      shortAnswer:
        "Antes de un panel upgrade de 150A a 200A debes verificar el load calculation actualizado, la capacidad del feeder/service entrance existente, el grounding electrode system, el bonding de tuberias de agua/gas, el clearance de trabajo frente al panel, y coordinar el corte de servicio con la utility.",
      englishSummary:
        "Before a 150A to 200A panel upgrade, verify the updated load calculation, existing feeder/service entrance capacity, grounding electrode system, water/gas pipe bonding, working clearance in front of the panel, and coordinate the service disconnect with the utility.",
      riskLevel: "alto",
      codeReference: `${CATEGORY_PANEL_UPGRADE.referencia}. ${verifyNecMessage(language)}`,
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
      recommendation: "Escalar al Master Electrician antes de cotizar o ejecutar: es un trabajo de servicio principal / alto riesgo.",
      sourceInfo: sourceInfoFor(language, CATEGORY_PANEL_UPGRADE)
    });
  }

  // Grounding / bonding
  if (includesAny(q, CATEGORY_GROUNDING.keywords)) {
    return base(language, {
      shortAnswer:
        "En grounding y bonding debes verificar: electrodo de puesta a tierra (varilla, Ufer, o tuberia metalica de agua), conductor de grounding electrode con calibre correcto, bonding de tuberia de agua y gas, bonding de la estructura metalica del panel, y continuidad electrica en todo el sistema.",
      englishSummary:
        "For grounding and bonding, verify the grounding electrode (rod, Ufer, or metal water pipe), correctly sized grounding electrode conductor, water and gas pipe bonding, panel metal enclosure bonding, and electrical continuity throughout the system.",
      riskLevel: "alto",
      codeReference: `${CATEGORY_GROUNDING.referencia}. ${verifyNecMessage(language)}`,
      checklist: [
        "Verificar electrodo de puesta a tierra presente y accesible",
        "Verificar calibre del grounding electrode conductor",
        "Confirmar bonding de tuberia de agua metalica",
        "Confirmar bonding de tuberia de gas si aplica",
        "Verificar continuidad electrica con multimetro",
        "Verificar bonding jumper en el panel si es subpanel"
      ],
      missingQuestions: ["Tipo de electrodo disponible en sitio", "Es panel principal o subpanel"],
      recommendation: "Riesgo alto (shock electrico / fire hazard si falla). Escalar al Master Electrician para verificacion final.",
      sourceInfo: sourceInfoFor(language, CATEGORY_GROUNDING)
    });
  }

  // TDLR / licencias y supervision del Master Electrician
  if (includesAny(q, CATEGORY_TDLR.keywords)) {
    return base(language, {
      shortAnswer:
        "Todo trabajo electrico en Texas debe ser realizado o supervisado por personal con licencia TDLR vigente. El Master Electrician es responsable de la supervision final y de que el trabajo cumpla con el NEC adoptado y las reglas de TDLR antes de solicitar inspeccion.",
      englishSummary:
        "All electrical work in Texas must be performed or supervised by personnel with a valid TDLR license. The Master Electrician is responsible for final supervision and for ensuring the work complies with the adopted NEC and TDLR rules before requesting inspection.",
      riskLevel: "medio",
      codeReference: `${CATEGORY_TDLR.referencia}. ${verifyNecMessage(language)}`,
      checklist: [
        "Confirmar que la licencia TDLR del Master Electrician este vigente",
        "Confirmar que el nivel de licencia cubra el tipo de trabajo (residencial/comercial)",
        "Documentar quien supervisa el trabajo en sitio",
        "Verificar requisitos de continuing education si aplica"
      ],
      missingQuestions: ["Numero de licencia TDLR del Master Electrician", "Tipo de trabajo (residencial/comercial)"],
      recommendation: "Confirmar con el Master Electrician el numero de licencia y el alcance de supervision antes de continuar.",
      sourceInfo: sourceInfoFor(language, CATEGORY_TDLR)
    });
  }

  // Houston AHJ / Permitting Center
  if (includesAny(q, CATEGORY_AHJ.keywords)) {
    return base(language, {
      shortAnswer:
        "La autoridad local competente (AHJ) determina el codigo exacto adoptado, el proceso de permiso y los requisitos de inspeccion. En Houston, el Houston Permitting Center exige permiso para la mayoria de trabajos de panel upgrade, subpaneles y EV chargers.",
      englishSummary:
        "The local authority having jurisdiction (AHJ) determines the exact adopted code, permit process, and inspection requirements. In Houston, the Houston Permitting Center requires a permit for most panel upgrade, subpanel, and EV charger work.",
      riskLevel: "medio",
      codeReference: `${CATEGORY_AHJ.referencia}. ${verifyNecMessage(language)}`,
      checklist: [
        "Confirmar la ciudad / jurisdiccion exacta del proyecto",
        "Verificar si el trabajo requiere permiso antes de iniciar",
        "Confirmar el codigo edition adoptado por el AHJ",
        "Agendar la inspeccion una vez el trabajo este listo"
      ],
      missingQuestions: ["Ciudad / jurisdiccion (AHJ)", "Tipo de trabajo a permisar"],
      recommendation: "Verificar el requisito de permiso vigente directamente con Houston Permitting Center o el AHJ correspondiente antes de cotizar o ejecutar.",
      sourceInfo: sourceInfoFor(language, CATEGORY_AHJ)
    });
  }

  // NFPA 70E / LOTO / seguridad electrica
  if (includesAny(q, CATEGORY_LOTO.keywords)) {
    return base(language, {
      shortAnswer:
        "Todo trabajo en paneles, feeders o servicio principal requiere de-energizar el circuito, aplicar bloqueo/etiquetado (LOTO), verificar ausencia de voltaje con un multimetro calibrado, y usar el EPP correspondiente segun NFPA 70E antes de tocar cualquier componente.",
      englishSummary:
        "Any work on panels, feeders, or the main service requires de-energizing the circuit, applying lockout/tagout (LOTO), verifying absence of voltage with a calibrated multimeter, and using the appropriate PPE per NFPA 70E before touching any component.",
      riskLevel: "critico",
      codeReference: `${CATEGORY_LOTO.referencia}. ${verifyNecMessage(language)}`,
      checklist: [
        "De-energizar el circuito antes de trabajar",
        "Aplicar bloqueo/etiquetado (LOTO) visible",
        "Verificar ausencia de voltaje con multimetro calibrado",
        "Usar EPP adecuado segun el nivel de riesgo de arc flash",
        "Escalar al Master Electrician antes de volver a energizar"
      ],
      missingQuestions: ["Tipo de panel o equipo a intervenir", "Voltaje y amperaje del servicio"],
      recommendation: "Riesgo critico (shock electrico / arc flash). No energizar ni continuar sin LOTO completo y verificacion del Master Electrician.",
      sourceInfo: sourceInfoFor(language, CATEGORY_LOTO)
    });
  }

  // Simbologia electrica
  if (includesAny(q, CATEGORY_SYMBOLS.keywords)) {
    return base(language, {
      shortAnswer:
        "La simbologia electrica basica en planos incluye: receptaculo estandar, receptaculo GFCI, receptaculo weatherproof, luminaria de techo/pared, interruptor sencillo o de 3 vias, panel electrico, home run, disconnect, y transformador. Cada set de planos trae su propia leyenda: siempre confirmala antes de interpretar simbolos.",
      englishSummary:
        "Basic electrical drawing symbols include: standard receptacle, GFCI receptacle, weatherproof receptacle, ceiling/wall fixture, single-pole or 3-way switch, electrical panel, home run, disconnect, and transformer. Every drawing set has its own legend: always confirm it before interpreting symbols.",
      riskLevel: "bajo",
      codeReference: `${CATEGORY_SYMBOLS.referencia}. ${verifyNecMessage(language)}`,
      checklist: [
        "Localizar la leyenda de simbolos en la hoja de notas generales (E0.1)",
        "Confirmar que el simbolo interpretado coincide con la leyenda del set actual",
        "No asumir un simbolo estandar si el set trae una leyenda distinta"
      ],
      missingQuestions: ["Hoja donde aparece el simbolo", "Leyenda disponible en el set de planos"],
      recommendation: "Confirmar cada simbolo contra la leyenda oficial del set de planos antes de usarlo en una cotizacion o instalacion.",
      sourceInfo: sourceInfoFor(language, CATEGORY_SYMBOLS)
    });
  }

  // Checklist pre-inspeccion
  if (includesAny(q, CATEGORY_CHECKLIST.keywords)) {
    return base(language, {
      shortAnswer:
        "Checklist general antes de solicitar inspeccion: panel etiquetado y accesible, grounding/bonding completos, breakers correctamente dimensionados, GFCI/AFCI donde aplica, conduit fill y box fill dentro de limites, disconnects visibles y etiquetados, y permisos visibles en sitio.",
      englishSummary:
        "General pre-inspection checklist: labeled and accessible panel, complete grounding/bonding, correctly sized breakers, GFCI/AFCI where required, conduit fill and box fill within limits, visible and labeled disconnects, and permits visible on site.",
      riskLevel: "bajo",
      codeReference: `${CATEGORY_CHECKLIST.referencia}. ${verifyNecMessage(language)}`,
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
      recommendation: "Puedes continuar con la solicitud de inspeccion si todos los puntos del checklist estan completos y documentados.",
      sourceInfo: sourceInfoFor(language, CATEGORY_CHECKLIST)
    });
  }

  // Preguntas antes de cotizar
  if (includesAny(q, CATEGORY_QUOTE.keywords)) {
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
      recommendation: "Pedir la informacion faltante al cliente o al diseñador antes de emitir una cotizacion formal.",
      sourceInfo: sourceInfoFor(language, CATEGORY_QUOTE)
    });
  }

  // Resumen/lectura de plano solicitada por texto sin archivo adjunto
  if (includesAny(q, CATEGORY_PLAN_SUMMARY.keywords)) {
    return base(language, {
      shortAnswer:
        "Para resumir un plano electrico o revisar un panel schedule necesito que subas el archivo (PDF o imagen JPG/PNG) en la seccion 'Planos' y me indiques la hoja especifica (por ejemplo E2.1 Power Plan o E4.1 Panel Schedules).",
      englishSummary:
        "To summarize an electrical drawing or review a panel schedule, please upload the file (PDF or JPG/PNG image) in the 'Plans' section and tell me the specific sheet (e.g. E2.1 Power Plan or E4.1 Panel Schedules).",
      riskLevel: "bajo",
      codeReference: verifyNecMessage(language),
      checklist: ["Subir el plano en la seccion Planos", "Indicar la hoja especifica a revisar"],
      missingQuestions: ["Hoja del plano (E0.1, E1.1, E2.1, E3.1, E4.1, E5.1, etc.)", "Archivo PDF o imagen del plano"],
      recommendation: "Pedir mas informacion: sube el plano para poder hacer una lectura preliminar.",
      sourceInfo: sourceInfoFor(language, CATEGORY_PLAN_SUMMARY)
    });
  }

  // Fallback: la pregunta no coincide con ninguna categoria de la base interna.
  // No se inventa una respuesta tecnica; se informa la limitacion explicitamente
  // y se deja claro que la base interna no reemplaza el NEC oficial completo.
  const NO_MATCH_ES =
    "No tengo suficiente informacion en la base interna de Fly Electric Solutions LLC (basada en NEC 2023, TDLR y Houston AHJ) para responder esta pregunta con seguridad. Esta base interna no reemplaza el texto oficial completo del NEC: verifique el NEC oficial, TDLR, Houston AHJ o consulte directamente al Master Electrician.";
  const NO_MATCH_EN =
    "I do not have enough information in Fly Electric Solutions LLC's internal base (built from NEC 2023, TDLR, and Houston AHJ) to answer this question safely. This internal base does not replace the full official NEC text: please verify with the official NEC, TDLR, Houston AHJ, or consult the Master Electrician directly.";

  return base(language, {
    shortAnswer: NO_MATCH_ES,
    englishSummary: language !== "es" ? NO_MATCH_EN : undefined,
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
      : "Pedir mas informacion antes de dar una recomendacion tecnica especifica.",
    sourceInfo: buildBaseUsadaBlock(language, {
      archivoInterno: GENERIC_INTERNAL_FILE,
      categoria: "No identificada (pregunta general sin categoria especifica)",
      referenciaNec: "No aplica un articulo NEC especifico para esta pregunta",
      confianza: "bajo",
      masterDebeVerificar: "Determinar junto con el Master Electrician cual es la regla NEC, TDLR o Houston AHJ aplicable antes de proceder."
    })
  });
}
