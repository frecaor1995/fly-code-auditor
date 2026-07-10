import type { AssistantResponse, Language } from "../db/types";
import { standardWarning, verifyNecMessage, type AskAssistantInput } from "./types";
import { searchKnowledgeEntries, listKnowledgeEntries } from "../db/repos/knowledgeBase";
import { ELECTRICAL_KNOWLEDGE_BASE, type KnowledgeBaseEntry, type KnowledgeSourceType } from "../knowledge/electricalKnowledgeBase";

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

// Categorias que TODAVIA no viven en lib/knowledge/electricalKnowledgeBase.ts
// (son mas de "como usar la app" que de contenido tecnico electrico): lectura
// de simbolos, checklist pre-inspeccion, preguntas antes de cotizar, y
// resumen de plano sin archivo adjunto. Los temas tecnicos (EV charger,
// GFCI, panel upgrade, grounding, bonding, TDLR, Houston AHJ, NFPA 70E/99,
// hospitales, etc.) ahora se buscan primero en ELECTRICAL_KNOWLEDGE_BASE.
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

const CATEGORY_DEFS: CategoryDef[] = [CATEGORY_SYMBOLS, CATEGORY_CHECKLIST, CATEGORY_QUOTE, CATEGORY_PLAN_SUMMARY];

// Frases que identifican una pregunta META (sobre la fuente/base interna que
// respalda una respuesta) en vez de una pregunta tecnica electrica. Esta
// deteccion corre ANTES que cualquier categoria tecnica: de lo contrario,
// una pregunta como "¿esta respuesta viene de NEC, TDLR o Houston AHJ?"
// coincide con keywords tecnicas y dispara por error una respuesta tecnica
// de licencias o permisos en vez de explicar la fuente.
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
  return terms.some((term) => text.includes(normalize(term)));
}

function isSourceInfoQuestion(normalizedQuestion: string): boolean {
  return includesAny(normalizedQuestion, META_SOURCE_KEYWORDS);
}

// Busca una coincidencia por keywords en la base electrica interna
// (lib/knowledge/electricalKnowledgeBase.ts). Es la primera fuente de
// verdad para preguntas tecnicas: si hay coincidencia, se usa esa entrada;
// si no, el caller sigue con las categorias legacy y finalmente el
// fallback seguro de "no tengo suficiente informacion".
function findKnowledgeBaseEntry(normalizedQuestion: string): KnowledgeBaseEntry | undefined {
  return ELECTRICAL_KNOWLEDGE_BASE.find((entry) => includesAny(normalizedQuestion, entry.keywords));
}

function sourceTypeToConfidence(sourceType: KnowledgeSourceType): Confidence {
  if (sourceType === "regla_tecnica_general") return "medio";
  return "bajo";
}

type DetectedCategory = { source: "kb"; entry: KnowledgeBaseEntry } | { source: "legacy"; def: CategoryDef };

function detectCategory(normalizedQuestion: string): DetectedCategory | undefined {
  const kbEntry = findKnowledgeBaseEntry(normalizedQuestion);
  if (kbEntry) return { source: "kb", entry: kbEntry };
  const legacyDef = CATEGORY_DEFS.find((cat) => includesAny(normalizedQuestion, cat.keywords));
  if (legacyDef) return { source: "legacy", def: legacyDef };
  return undefined;
}

function categoryLabel(detected: DetectedCategory): string {
  return detected.source === "kb" ? detected.entry.category : detected.def.categoria;
}

function categoryReference(detected: DetectedCategory): string {
  return detected.source === "kb" ? detected.entry.codeReference : detected.def.referencia;
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

// Apunta el campo "Archivo interno" a un registro real y verificable
// (lib/knowledge/electricalKnowledgeBase.ts para temas tecnicos electricos,
// o data/knowledgeBase.json para las categorias legacy) en vez de inventar
// una referencia de archivo.
function archivoInternoForDetected(detected: DetectedCategory): string {
  if (detected.source === "kb") {
    return `lib/knowledge/electricalKnowledgeBase.ts (${detected.entry.id}: "${detected.entry.category}")`;
  }
  const kbId = detected.def.kbId;
  if (kbId) {
    const entry = listKnowledgeEntries().find((e) => e.id === kbId);
    if (entry) return `data/knowledgeBase.json (${entry.id}: "${entry.title}")`;
  }
  return GENERIC_INTERNAL_FILE;
}

// Bloque "Base usada para esta respuesta": deja explicito que la respuesta
// sale de la base interna (NEC 2023 / TDLR / Houston AHJ / NFPA 70E / NFPA
// 99 / procedimientos de Fly Electric Solutions LLC) y no de una consulta
// directa al NEC oficial. Se usa tanto como respuesta completa a preguntas
// META_SOURCE como pie de pagina automatico en cada respuesta tecnica.
function buildBaseUsadaBlock(
  language: Language,
  opts: { archivoInterno: string; categoria: string; referenciaNec: string; confianza: Confidence; masterDebeVerificar: string }
): string {
  const es = [
    "Base usada para esta respuesta:",
    `- Fuente interna usada: ${INTERNAL_SOURCE_DOMAIN_ES}`,
    `- Categoria detectada: ${opts.categoria}`,
    `- Referencia NEC/NFPA general (si aplica): ${opts.referenciaNec}`,
    `- Archivo interno: ${opts.archivoInterno}`,
    `- Nivel de confianza: ${opts.confianza}`,
    `- Que debe verificar el Master Electrician: ${opts.masterDebeVerificar}`
  ].join("\n");

  if (language === "es") return es;

  const en = [
    "Source used for this response:",
    `- Internal source used: ${INTERNAL_SOURCE_DOMAIN_EN}`,
    `- Detected category: ${opts.categoria}`,
    `- General NEC/NFPA reference (if applicable): ${opts.referenciaNec}`,
    `- Internal file: ${opts.archivoInterno}`,
    `- Confidence level: ${opts.confianza}`,
    `- What the Master Electrician must verify: ${opts.masterDebeVerificar}`
  ].join("\n");

  if (language === "en") return en;
  return `${es}\n\n${en}`;
}

function masterDebeVerificarForDetected(detected: DetectedCategory): string {
  const categoria = categoryLabel(detected);
  const referencia = categoryReference(detected);
  const extra = detected.source === "kb" ? ", el plano/panel schedule del proyecto" : "";
  return `Confirmar "${categoria}" contra ${referencia}${extra}, el NEC oficial vigente, TDLR, Houston AHJ, permisos e inspeccion antes de aprobar o cerrar el trabajo.`;
}

function sourceInfoForDetected(language: Language, detected: DetectedCategory): string {
  return buildBaseUsadaBlock(language, {
    archivoInterno: archivoInternoForDetected(detected),
    categoria: categoryLabel(detected),
    referenciaNec: categoryReference(detected),
    confianza: detected.source === "kb" ? sourceTypeToConfidence(detected.entry.sourceType) : detected.def.confianza,
    masterDebeVerificar: masterDebeVerificarForDetected(detected)
  });
}

const NO_SOURCE_ES =
  "No tengo suficiente informacion en la base interna para identificar la fuente exacta de una respuesta puntual. Esta base interna (lib/knowledge/electricalKnowledgeBase.ts, data/knowledgeBase.json y lib/ai/mockAssistant.ts) es una referencia de Fly Electric Solutions LLC basada en NEC 2023, TDLR, Houston AHJ, NFPA 70E y NFPA 99; no reemplaza el texto oficial completo de esos codigos. Verifique el NEC oficial, TDLR, Houston AHJ y la aprobacion del Master Electrician.";
const NO_SOURCE_EN =
  "I do not have enough information in the internal knowledge base to identify the exact source of a specific response. This internal base (lib/knowledge/electricalKnowledgeBase.ts, data/knowledgeBase.json, and lib/ai/mockAssistant.ts) is a Fly Electric Solutions LLC reference built from NEC 2023, TDLR, Houston AHJ, NFPA 70E, and NFPA 99; it does not replace the full official text of those codes. Please verify with the official NEC, TDLR, Houston AHJ, and the Master Electrician's approval.";

// Responde preguntas META sobre la fuente/base interna (no preguntas
// tecnicas electricas). Si la pregunta tambien menciona una categoria
// reconocible (base electrica nueva o categorias legacy) se explica esa
// categoria puntual; si no, se usa el mensaje fijo de "no puedo identificar
// la fuente".
function buildSourceInfoResponse(normalizedQuestion: string, language: Language): AssistantResponse {
  const detected = detectCategory(normalizedQuestion);

  if (!detected) {
    return base(language, {
      shortAnswer: NO_SOURCE_ES,
      englishSummary: language !== "es" ? NO_SOURCE_EN : undefined,
      riskLevel: "bajo",
      codeReference: verifyNecMessage(language),
      recommendation: NO_SOURCE_ES
    });
  }

  return base(language, {
    shortAnswer: sourceInfoForDetected(language, detected),
    riskLevel: "bajo",
    codeReference: categoryReference(detected),
    recommendation: "Esta es una explicacion de la fuente interna usada, no una respuesta tecnica de instalacion."
  });
}

// Construye la respuesta tecnica completa a partir de una entrada de
// lib/knowledge/electricalKnowledgeBase.ts, seleccionando el idioma segun
// "language": es -> todo en espanol; en -> todo en ingles; bilingual ->
// cuerpo principal en espanol + resumen en ingles (englishSummary), igual
// que el resto del motor mock.
function buildResponseFromKnowledgeEntry(entry: KnowledgeBaseEntry, language: Language): AssistantResponse {
  const useEnglish = language === "en";
  const shortAnswer = useEnglish ? entry.shortAnswerEn : entry.shortAnswerEs;
  const englishSummary = language !== "es" ? entry.shortAnswerEn : undefined;
  const checklist = useEnglish ? entry.checklistEn : entry.checklistEs;
  const missingQuestions = useEnglish ? entry.missingQuestionsEn : entry.missingQuestionsEs;
  const recommendation = useEnglish ? entry.recommendationEn : entry.recommendationEs;
  const warning = useEnglish ? entry.warningEn : entry.warningEs;
  const detected: DetectedCategory = { source: "kb", entry };

  return base(language, {
    shortAnswer,
    englishSummary,
    riskLevel: entry.riskLevel,
    codeReference: `${entry.codeReference}. ${verifyNecMessage(language)}`,
    checklist,
    missingQuestions,
    recommendation,
    warning,
    sourceInfo: sourceInfoForDetected(language, detected)
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

  // Base electrica interna (lib/knowledge/electricalKnowledgeBase.ts): primera
  // fuente de verdad para preguntas tecnicas por coincidencia de keywords
  // (hospitales/NEC 517, hospital grade receptacles, patient bed locations,
  // GFCI, AFCI, grounding, bonding, EV chargers, panel upgrade, load
  // calculation, conduit fill, box fill, Houston AHJ, TDLR, NFPA 70E, NFPA 99).
  const kbEntry = findKnowledgeBaseEntry(q);
  if (kbEntry) {
    return buildResponseFromKnowledgeEntry(kbEntry, language);
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
      sourceInfo: sourceInfoForDetected(language, { source: "legacy", def: CATEGORY_SYMBOLS })
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
      sourceInfo: sourceInfoForDetected(language, { source: "legacy", def: CATEGORY_CHECKLIST })
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
      sourceInfo: sourceInfoForDetected(language, { source: "legacy", def: CATEGORY_QUOTE })
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
      sourceInfo: sourceInfoForDetected(language, { source: "legacy", def: CATEGORY_PLAN_SUMMARY })
    });
  }

  // Fallback: la pregunta no coincide con ninguna categoria de la base interna.
  // No se inventa una respuesta tecnica; se informa la limitacion explicitamente
  // y se deja claro que la base interna no reemplaza el texto oficial completo.
  const NO_MATCH_ES =
    "No tengo suficiente informacion en la base interna de Fly Electric Solutions LLC (basada en NEC 2023, TDLR, Houston AHJ, NFPA 70E y NFPA 99) para responder esta pregunta con seguridad. Esta base interna no reemplaza el texto oficial completo de esos codigos: verifique el NEC oficial, TDLR, Houston AHJ o consulte directamente al Master Electrician.";
  const NO_MATCH_EN =
    "I do not have enough information in Fly Electric Solutions LLC's internal base (built from NEC 2023, TDLR, Houston AHJ, NFPA 70E, and NFPA 99) to answer this question safely. This internal base does not replace the full official text of those codes: please verify with the official NEC, TDLR, Houston AHJ, or consult the Master Electrician directly.";

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
      referenciaNec: "No aplica un articulo NEC/NFPA especifico para esta pregunta",
      confianza: "bajo",
      masterDebeVerificar: "Determinar junto con el Master Electrician cual es la regla NEC, TDLR, Houston AHJ o NFPA aplicable antes de proceder."
    })
  });
}
