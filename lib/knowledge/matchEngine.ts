// Motor de coincidencia por score ponderado, compartido entre la base
// electrica local (lib/knowledge/electricalKnowledgeBase.ts) y
// public.knowledge_entries en Supabase (lib/db/dbAdapter.ts#findKnowledgeByQuestion).
//
// Sprint 3 (generalizacion semantica controlada): ademas de la coincidencia
// de subcadena literal historica, cada keyword ahora tambien puede matchear
// via lib/knowledge/textNormalization.ts (sinonimos ES/EN, plural/singular
// conservador, y orden flexible con tolerancia acotada a palabras
// intermedias para frases multi-palabra). El camino nuevo es ESTRICTAMENTE
// ADITIVO (ver scoreEntry): solo se evalua cuando la coincidencia literal ya
// fallo, y suma el mismo peso de siempre. Ningun score baja respecto al
// comportamiento anterior a Sprint 3; el unico riesgo de regresion es que
// una entrada COMPETIDORA gane mas terreno, verificado con las 3 baterias
// completas (conocida/nueva/congelada) y la suite de pruebas.
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

import { synonymsOf, pluralVariants, flexiblePhraseMatch, tokenize, STOPWORDS, rootOf } from "./textNormalization";

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

// Sprint 3: clave canonica de deduplicacion, que colapsa DOS ejes distintos
// a un mismo identificador: plural/singular (via rootOf) Y sinonimos (via
// synonymsOf, usando el primer termino del grupo como representante). Sin
// esto, una entrada que lista "patio", "porch" y "terraza" como keywords
// separadas (mismo grupo de equivalencia) acreditaba cada una por separado
// en cuanto "patio" aparecia una sola vez en la pregunta -hallazgo real de
// regresion durante Sprint 3-, igual que "panel"/"paneles" sin esto
// colapsarian a raices distintas si "panel" ademas pertenece a un grupo de
// sinonimos (tablero/panel/panelboard). Se usa para deduplicar credito de
// score entre keywords que son, en esencia, la misma senal (ver
// deduplicacion en scoreEntry).
function canonicalKey(word: string): string {
  const group = synonymsOf(rootOf(word));
  return group[0];
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

  const questionTokens = tokenize(normalizedQuestion);
  let score = 0;

  // Pase 1 (historico, SIN CAMBIOS): subcadena literal exacta. Se registra
  // ademas la clave canonica de cada palabra ya acreditada aqui, para el
  // pase 2.
  const creditedKeys = new Set<string>();
  for (const keyword of entry.keywords) {
    if (normalizedQuestion.includes(normalizeForMatch(keyword))) {
      score += weightOf(keyword);
      for (const w of keyword.trim().split(/\s+/)) {
        creditedKeys.add(canonicalKey(normalizeForMatch(w)));
      }
    }
  }

  // Pase 2 (Sprint 3, nuevo): sinonimos / plural-singular / orden flexible
  // con tolerancia a palabras intermedias. Solo se evalua para keywords que
  // el pase 1 NO matcheo. Deduplicado ESTRICTO contra las raices ya
  // acreditadas (pase 1 + lo que el propio pase 2 va acreditando en orden):
  // - Keyword de una sola palabra: se omite si su raiz ya fue acreditada
  //   (evita doble conteo cuando la entrada ya lista "exterior" +
  //   "exteriores" como keywords separadas).
  // - Keyword de varias palabras (frase): exige que TODAS sus palabras
  //   significativas sean nuevas (ninguna ya acreditada). No basta con que
  //   una sola palabra sea nueva: un hallazgo real de regresion durante
  //   Sprint 3 mostro que permitir "al menos una nueva" todavia dejaba
  //   pasar frases donde solo 1 de 2 palabras era realmente nueva (ej.
  //   "lugares humedos" con "humedo" ya acreditado por su propia keyword
  //   suelta), sumando el peso completo de la frase por una senal que en
  //   gran parte ya se habia contado. Exigir que TODAS sean nuevas cierra
  //   ese residual sin perder la capacidad de reconocer una frase
  //   genuinamente nueva (ninguna de sus palabras contada antes).
  for (const keyword of entry.keywords) {
    if (normalizedQuestion.includes(normalizeForMatch(keyword))) continue; // ya conto en el pase 1

    const keywordWords = keyword.trim().split(/\s+/);
    if (keywordWords.length === 1) {
      const word = normalizeForMatch(keywordWords[0]);
      if (creditedKeys.has(canonicalKey(word))) continue;

      // Hallazgo real durante Sprint 3: comparar por subcadena cruda
      // (normalizedQuestion.includes(synonym)) permitia coincidencias
      // ACCIDENTALES cuando un sinonimo corto es prefijo de una palabra no
      // relacionada de la pregunta (ej. el sinonimo "residencia" es
      // literalmente substring de "residencial", inflando de forma
      // espuria una entrada sin relacion real). Se compara por TOKEN
      // exacto (o sus propias variantes de plural) en vez de subcadena,
      // igual que ya hace flexiblePhraseMatch para sus palabras.
      const matchedFlexibly = synonymsOf(word).some((synonym) => {
        if (synonym.includes(" ")) return normalizedQuestion.includes(synonym); // frase curada multi-palabra
        const variants = new Set(pluralVariants(synonym));
        return questionTokens.some((t) => variants.has(t));
      });
      if (matchedFlexibly) {
        score += weightOf(keyword);
        creditedKeys.add(canonicalKey(word));
      }
    } else {
      const normalizedKeyword = normalizeForMatch(keyword);
      const significantWords = tokenize(normalizedKeyword).filter((t) => !STOPWORDS.has(t));
      const allWordsAreNew = significantWords.every((w) => !creditedKeys.has(canonicalKey(w)));
      if (allWordsAreNew && flexiblePhraseMatch(questionTokens, normalizedKeyword)) {
        score += weightOf(keyword);
        for (const w of significantWords) creditedKeys.add(canonicalKey(w));
      }
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
