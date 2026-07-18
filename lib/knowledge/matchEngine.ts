// Motor de coincidencia por score ponderado, compartido entre la base
// electrica local (lib/knowledge/electricalKnowledgeBase.ts) y
// public.knowledge_entries en Supabase (lib/db/dbAdapter.ts#findKnowledgeByQuestion).
//
// Reemplaza el modelo anterior (una sola palabra clave generica -ej.
// "receptaculos"- bastaba para disparar un match, sin importar el contexto),
// que causaba respuestas fuera de contexto: una pregunta sobre receptaculos
// exteriores en lugares humedos devolvia contenido de NEC 517 (hospitales)
// solo porque "receptaculos" tambien aparecia en esa entrada.
//
// Reglas de este motor:
//   1. Cada termino aporta un peso = numero de palabras que tiene. Una
//      palabra generica sola ("receptaculo", "cable", "panel", "tierra",
//      "iluminacion", "breaker") vale 1 punto: nunca alcanza minimumScore
//      por si sola. Frases especificas ("hospital grade", "wet location",
//      "conduit fill") valen mas y/o requieren que se combinen varias
//      senales para pasar el umbral.
//   2. Cada categoria puede tener un gate obligatorio (requiredAnyOf): si
//      NINGUNO de esos terminos aparece en la pregunta, la categoria queda
//      descalificada por completo sin importar cuantas keywords coincidan.
//      Usado para healthcare: exige mencionar hospital/paciente/clinica/
//      patient care o equivalente antes de considerar esa categoria.
//   3. Cada categoria y cada entrada pueden tener excludeTerms: si
//      aparecen en la pregunta, penalizan fuertemente el score (pueden
//      hacerlo caer por debajo de minimumScore aunque haya keywords
//      positivas).
//   4. Si ninguna entrada supera minimumScore (o todas quedan
//      descalificadas por su gate), el resultado es null: no se inventa ni
//      se reutiliza contenido generico o relacionado solo por una palabra.

export type MatchCategory =
  // Categorias obligatorias
  | "exterior_wet_locations"
  | "healthcare"
  | "feeders"
  | "services"
  | "grounding_bonding"
  | "mc_cable"
  | "panels"
  | "receptacles"
  | "ev_charging"
  | "tdlr"
  | "houston_ahj"
  // Categorias adicionales reales del contenido existente (no exigidas por
  // el pedido, pero necesarias para no perder cobertura de temas que ya
  // vive en la base interna).
  | "lighting"
  | "arc_flash_safety"
  | "installation_methods"
  | "operational_guide";

export interface ScorableEntry {
  id: string;
  matchCategory: MatchCategory;
  keywords: string[];
  excludeTerms?: string[];
}

interface CategoryGate {
  // La categoria completa queda descalificada si NINGUN termino de esta
  // lista aparece en la pregunta normalizada.
  requiredAnyOf?: string[];
  // Terminos contradictorios a nivel de categoria: penalizan el score de
  // CUALQUIER entrada de esta categoria si aparecen en la pregunta.
  excludeTerms?: string[];
}

const HEALTHCARE_CONTEXT_TERMS = [
  "hospital",
  "hospitales",
  "paciente",
  "pacientes",
  "patient",
  "patients",
  "clinica",
  "clinico",
  "clinical",
  "clinic",
  "healthcare",
  "health care",
  "patient care",
  "nec 517",
  "articulo 517",
  "nfpa 99",
  "hospital grade",
  "essential electrical system",
  "sistema electrico esencial",
  "medical gas",
  "gas medico"
];

const EXTERIOR_WET_LOCATION_TERMS = [
  "exterior",
  "exteriores",
  "outdoor",
  "outdoors",
  "a la intemperie",
  "intemperie",
  "wet location",
  "damp location",
  "lugares humedos",
  "lugares mojados",
  "humedo",
  "mojado",
  "weatherproof",
  "weather-resistant",
  "weather resistant"
];

const RESIDENTIAL_TERMS = [
  "residencial",
  "vivienda",
  "vivienda unifamiliar",
  "dwelling",
  "dwelling unit",
  "one family dwelling",
  "casa"
];

// Gates por categoria. Solo se listan las categorias que necesitan un gate
// o exclusiones especificas; las demas no tienen restricciones adicionales
// mas alla del score minimo general.
const CATEGORY_GATES: Partial<Record<MatchCategory, CategoryGate>> = {
  healthcare: {
    // Item 4 del pedido: una consulta healthcare debe requerir hospital,
    // paciente, clinica, patient care o equivalente.
    requiredAnyOf: HEALTHCARE_CONTEXT_TERMS,
    // Item 4: una consulta exterior o residencial (sin contexto de
    // hospital/paciente) debe excluir healthcare/patient care. El gate de
    // arriba ya lo garantiza (si no hay termino de contexto, la categoria
    // queda descalificada), pero se agrega tambien como penalizacion
    // explicita (item 5: "penalizar terminos contradictorios") por
    // redundancia defensiva.
    excludeTerms: [...EXTERIOR_WET_LOCATION_TERMS, ...RESIDENTIAL_TERMS]
  },
  exterior_wet_locations: {
    // Simetrico: una pregunta claramente de contexto hospitalario no debe
    // resolverse como guia generica de exteriores/humedad.
    excludeTerms: HEALTHCARE_CONTEXT_TERMS
  }
};

const MINIMUM_SCORE = 2;
const CONTRADICTION_PENALTY = 5;

// Usado por la validacion de integridad de app/api/queries/route.ts (una
// respuesta "validated_fallback" debe re-chequear, sobre la pregunta
// original, que ninguno de los terminos contradictorios de la categoria
// matcheada esta presente -defensa en profundidad ademas del gate que ya
// se aplico durante el matching).
export function getCategoryExcludeTerms(category: MatchCategory): string[] {
  return CATEGORY_GATES[category]?.excludeTerms ?? [];
}

export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function weightOf(term: string): number {
  return Math.max(1, term.trim().split(/\s+/).length);
}

// Marcadores de negacion: un termino "contradictorio" que aparece justo
// despues de uno de estos NO debe penalizar el score. Sin esto, una
// instruccion explicita como "no uses informacion de hospitales" penaliza
// la entrada CORRECTA (exterior_wet_locations) por contener "hospitales",
// exactamente al reves de la intencion de quien pregunta: pidio EVITAR
// hospitales, no preguntar sobre hospitales.
const NEGATION_MARKERS = [
  "no ",
  "nunca ",
  "sin ",
  "ni ",
  "not ",
  "never ",
  "without ",
  "excluye",
  "excluir",
  "evita",
  "evitar"
];

function isNegatedAt(normalizedQuestion: string, matchIndex: number): boolean {
  const windowStart = Math.max(0, matchIndex - 30);
  const before = normalizedQuestion.slice(windowStart, matchIndex);
  return NEGATION_MARKERS.some((marker) => before.includes(marker));
}

// Devuelve el primer termino contradictorio realmente presente (no negado)
// en la pregunta, o null si ninguno aplica. Exportado para que
// app/api/queries/route.ts pueda re-validar con la MISMA logica (incluyendo
// el chequeo de negacion) en vez de duplicar un chequeo mas ingenuo.
export function findContradiction(question: string, terms: string[]): string | null {
  const normalizedQuestion = normalizeForMatch(question);
  const uniqueTerms = Array.from(new Set(terms));
  for (const term of uniqueTerms) {
    const idx = normalizedQuestion.indexOf(normalizeForMatch(term));
    if (idx !== -1 && !isNegatedAt(normalizedQuestion, idx)) {
      return term;
    }
  }
  return null;
}

// Devuelve el score de una entrada, o null si su categoria queda
// descalificada por un gate (requiredAnyOf no satisfecho).
function scoreEntry(normalizedQuestion: string, rawQuestion: string, entry: ScorableEntry): number | null {
  const gate = CATEGORY_GATES[entry.matchCategory];

  if (gate?.requiredAnyOf?.length) {
    const hasRequiredContext = gate.requiredAnyOf.some((term) => normalizedQuestion.includes(normalizeForMatch(term)));
    if (!hasRequiredContext) return null;
  }

  let score = 0;
  for (const keyword of entry.keywords) {
    if (normalizedQuestion.includes(normalizeForMatch(keyword))) {
      score += weightOf(keyword);
    }
  }

  // Deduplicado (gate.excludeTerms y entry.excludeTerms suelen solaparse) y
  // consciente de negacion: cada termino contradictorio penaliza como
  // maximo una vez, y nunca si aparece justo despues de un marcador de
  // negacion ("no", "sin", "nunca", etc).
  const contradictoryTerms = [...(gate?.excludeTerms ?? []), ...(entry.excludeTerms ?? [])];
  if (findContradiction(rawQuestion, contradictoryTerms)) {
    score -= CONTRADICTION_PENALTY;
  }

  return score;
}

// Motor generico: recibe cualquier lista de entradas "puntuables" (locales
// o mapeadas desde filas de Supabase) y devuelve la de mayor score que
// supere minimumScore, o null si ninguna es confiable.
export function findBestMatch<T extends ScorableEntry>(question: string, entries: T[]): T | null {
  const normalizedQuestion = normalizeForMatch(question);
  let best: { entry: T; score: number } | null = null;

  for (const entry of entries) {
    const score = scoreEntry(normalizedQuestion, question, entry);
    if (score === null) continue;
    if (score < MINIMUM_SCORE) continue;
    if (!best || score > best.score) best = { entry, score };
  }

  return best?.entry ?? null;
}
