import { normalizeForMatch } from "../knowledge/electricalKnowledgeBase";

// Clasificador de intencion UNICO y compartido entre app/api/queries/route.ts
// y lib/ai/mockAssistant.ts. Antes de este archivo, cada uno tenia su propia
// deteccion de "pregunta meta sobre la fuente" con listas de frases sueltas
// (algunas tan genericas como "que fuente") sin ningun chequeo de que la
// pregunta tuviera contenido tecnico real. Eso causaba el bug raiz: una
// consulta tecnica larga que en algun punto pedia "indica que fuente oficial
// fue consultada" se clasificaba como meta_source y la respuesta tecnica
// completa se descartaba, devolviendo solo la explicacion generica de la
// base interna.
//
// Regla de prioridad (root cause fix, no un parche de frase exacta):
//   1. Si la pregunta contiene CUALQUIER termino electrico concreto
//      (disconnect, feeder, alimentador, conductor, aluminio, voltaje,
//      distancia, etc.), la intencion SIEMPRE es "technical_electrical",
//      sin importar si la misma pregunta tambien pide articulos, fuentes o
//      citas. Pedir una fuente NO convierte una consulta tecnica en meta.
//   2. Solo si NO hay ningun termino tecnico Y la pregunta coincide con una
//      frase/patron que se refiere explicitamente al origen de las
//      respuestas del propio sistema ("tus respuestas", "tu base de
//      conocimiento", "el sistema consulta el NEC completo", etc.), la
//      intencion es "meta_source".
//   3. Cualquier otro caso es "general" (sin termino tecnico ni meta): cae
//      al fallback generico del motor de reglas.

export type Intent = "technical_electrical" | "meta_source" | "general";

export interface IntentClassification {
  intent: Intent;
  matchedRule: string;
  technicalTermsDetected: string[];
  metaSourceDetected: boolean;
}

// Terminos electricos concretos (item 2 del pedido). Bilingue, en minuscula
// y sin acentos porque se comparan contra el texto ya normalizado con
// normalizeForMatch. Deliberadamente NO incluye palabras genericas como
// "fuente", "articulo" o "norma": esas por si solas no indican una consulta
// tecnica, y son justamente el tipo de palabra que causaba falsos positivos
// de meta_source antes de este fix.
const TECHNICAL_TERMS = [
  "disconnect",
  "service disconnect",
  "main disconnect",
  "disconnect principal",
  "feeder",
  "alimentador",
  "acometida",
  "panel",
  "tablero",
  "subpanel",
  "sub panel",
  "conductor",
  "conductores",
  "aluminio",
  "aluminum",
  "cobre",
  "copper",
  "breaker",
  "neutral",
  "neutro",
  "ground",
  "grounding",
  "tierra",
  "conduit",
  "tuberia",
  "voltage",
  "voltaje",
  "amperage",
  "amperaje",
  "amperios",
  "distancia",
  "distance",
  "caida de voltaje",
  "voltage drop",
  "120/240",
  "120/208",
  "240v",
  "120v",
  "monofasico",
  "monofasica",
  "single-phase",
  "single phase",
  "trifasico",
  "trifasica",
  "three-phase",
  "three phase",
  "circuito",
  "circuit",
  "gfci",
  "afci",
  "calibre",
  "wire gauge",
  "receptaculo",
  "receptacle",
  "load calculation",
  "calculo de carga",
  // Ampliacion (hallazgo de la suite de regresion, FASE F): estos terminos
  // son 100% tecnicos-electricos pero no estaban reconocidos, causando que
  // preguntas reales sobre cable MC, licencia TDLR, iluminacion o proyectos
  // residenciales clasificaran como "general" en el campo informativo
  // detectedIntent (sin afectar el contenido real de la respuesta, que
  // depende de findKnowledgeBaseMatch, no de este clasificador). Se
  // almacenan en minuscula y sin acentos porque se comparan contra texto ya
  // normalizado con normalizeForMatch (que tambien quita acentos); el
  // matching es por subcadena, asi que la forma singular ya cubre su
  // plural regular (ej. "cable" cubre "cables", "licencia" cubre
  // "licencias"), pero se listan tambien las formas plurales/alternativas
  // explicitamente por claridad.
  "cable",
  "cables",
  "tdlr",
  "licencia",
  "license",
  "licenses",
  "iluminacion",
  "lighting",
  "residencial",
  "residential"
] as const;

// Frases meta (item 3 del pedido): siempre hacen referencia explicita al
// asistente/sistema en si mismo ("tu", "tus", "el sistema", "generas"),
// nunca solo a "fuente" o "articulo" de forma aislada.
const META_SOURCE_PHRASES = [
  "de donde sacas tus respuestas",
  "de donde obtienes tus respuestas",
  "de donde sale esta respuesta",
  "de donde viene esta respuesta",
  "de donde sacas la informacion",
  "cual es tu base de conocimiento",
  "cual es tu base interna",
  "cual es tu fuente",
  "cuales son tus fuentes",
  "que fuentes utilizas",
  "que fuentes usas",
  "que base de datos usas",
  "que base usas",
  "el sistema consulta el nec completo",
  "consultas el nec completo",
  "como generas tus respuestas",
  "como generas la respuesta",
  "como generas tus respuestas",
  "en que te basas para responder",
  "where do you get your answers",
  "what is your knowledge base",
  "what sources do you use",
  "does the system consult the full nec",
  "how do you generate your answers",
  "how do you generate your response"
] as const;

// Patrones para variaciones de redaccion que la lista de frases exactas no
// cubre, pero que siguen exigiendo una referencia explicita al asistente/
// sistema (tu/tus/su/sus/the system/you) junto a base/fuente/generar.
const META_SOURCE_PATTERNS: RegExp[] = [
  /\b(tu|tus|su|sus)\b[\s\S]{0,20}\b(base|fuente)s?\b[\s\S]{0,20}\b(conocimiento|respuesta|interna)/,
  /\bde\s+donde\b[\s\S]{0,15}\b(sacas|sale|salen|saca|viene|vienen|obtienes|obtiene|obtienen)\b[\s\S]{0,15}\b(tu|tus|respuesta|informacion)\b/,
  /\bcomo\s+generas?\b[\s\S]{0,20}\b(tu|tus|respuesta)/,
  /\bel\s+sistema\s+consulta\b/,
  /\byour\s+knowledge\s*base\b/,
  /\bwhat\s+sources?\s+do\s+you\s+use\b/,
  /\bhow\s+do\s+you\s+generate\b/
];

function detectTechnicalTerms(normalizedQuestion: string): string[] {
  const found: string[] = [];
  for (const term of TECHNICAL_TERMS) {
    if (normalizedQuestion.includes(normalizeForMatch(term))) found.push(term);
  }
  return found;
}

function detectMetaSource(normalizedQuestion: string): boolean {
  if (META_SOURCE_PHRASES.some((phrase) => normalizedQuestion.includes(normalizeForMatch(phrase)))) return true;
  return META_SOURCE_PATTERNS.some((pattern) => pattern.test(normalizedQuestion));
}

export function classifyIntent(question: string): IntentClassification {
  const normalizedQuestion = normalizeForMatch(question);
  const technicalTermsDetected = detectTechnicalTerms(normalizedQuestion);
  const metaSourceDetected = detectMetaSource(normalizedQuestion);

  // Item 2: la intencion tecnica siempre gana si hay al menos un termino
  // electrico concreto, sin importar si metaSourceDetected tambien es true
  // (item 4: pedir articulos/fuentes/citas no convierte una consulta
  // tecnica en meta_source).
  if (technicalTermsDetected.length > 0) {
    return { intent: "technical_electrical", matchedRule: "technical_terms_priority", technicalTermsDetected, metaSourceDetected };
  }

  if (metaSourceDetected) {
    return { intent: "meta_source", matchedRule: "meta_source_explicit", technicalTermsDetected, metaSourceDetected };
  }

  return { intent: "general", matchedRule: "no_technical_terms_no_meta_phrase", technicalTermsDetected, metaSourceDetected };
}
