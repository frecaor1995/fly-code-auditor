// Sprint 3 - generalizacion semantica controlada.
//
// Capa de normalizacion central, reutilizable y bilingue para el motor de
// matching (lib/knowledge/matchEngine.ts). Complementa, sin reemplazar,
// normalizeForMatch() (acentos/mayusculas): aqui se agregan equivalencias de
// sinonimos, variantes conservadoras de plural/singular, y coincidencia de
// frase con orden flexible + tolerancia acotada a palabras intermedias.
//
// Deliberadamente NO es un stemmer generico sobre texto arbitrario:
// - Las variantes de plural/singular son reglas fijas y conservadoras,
//   aplicadas palabra por palabra (nunca a los terminos criticos de
//   CRITICAL_TERMS ni a palabras de 3 caracteres o menos).
// - Los sinonimos son un mapa CURADO y finito (EQUIVALENCE_GROUPS), no una
//   inferencia automatica: cada grupo fue revisado a mano.
// - La coincidencia de frase con orden flexible exige TODAS las palabras
//   significativas de la frase (ninguna es opcional) dentro de una ventana
//   acotada, nunca "bag of words" libre sin limite de dispersion.
// Esto acota el riesgo de falsos positivos: no se inventan coincidencias,
// solo se reconocen formas equivalentes ya conocidas del mismo vocabulario
// tecnico que ya usan las 27 entradas.

// Terminos que NUNCA deben diluirse: no se generan variantes de plural ni se
// sustituyen por sinonimos amplios. Siguen matcheando unicamente por
// coincidencia literal exacta (o como parte de una frase multi-palabra via
// flexiblePhraseMatch, con la MISMA exigencia de coincidencia exacta para
// ese termino puntual).
export const CRITICAL_TERMS: ReadonlySet<string> = new Set([
  "gfci",
  "afci",
  "ev",
  "hvac",
  "neutral",
  "ground",
  "service",
  "panel",
  "mca",
  "mocp",
  "tdlr",
  "nec",
  "nfpa",
  "ahj"
]);

// Grupos de equivalencia bilingues ES/EN curados a mano (item 3 del pedido
// de Sprint 3, mas gaps reales ya documentados en las auditorias previas:
// lavamanos/sink/basin, cocina/kitchen, bano/bathroom, vivienda/dwelling,
// licencia/license, nevera/refrigerator, y 4 grupos de variaciones
// verbales). Cada termino pertenece como maximo a un grupo.
export const EQUIVALENCE_GROUPS: readonly (readonly string[])[] = [
  ["enchufe", "tomacorriente", "receptaculo", "outlet", "receptacle"],
  ["tablero", "panel", "panelboard"],
  ["acometida", "servicio", "service"],
  ["puesta a tierra", "tierra", "grounding", "ground"],
  ["union", "bonding", "bonded"],
  ["garaje", "garage"],
  ["dormitorio", "recamara", "habitacion", "bedroom"],
  ["patio", "porch", "terraza"],
  ["interruptor", "breaker", "circuit breaker"],
  ["cargador ev", "ev charger"],
  ["lavamanos", "lavabo", "sink", "basin"],
  ["cocina", "kitchen"],
  ["bano", "bathroom"],
  ["vivienda", "casa", "dwelling", "residencia"],
  ["licencia", "license"],
  ["nevera", "refrigerador", "refrigerator", "fridge"],
  // Variaciones verbales comunes (mismo mecanismo de grupo, distinta
  // naturaleza: formas conjugadas/derivadas de un mismo verbo).
  ["supervisar", "supervisa", "supervision", "supervise", "supervised", "supervising"],
  ["conectar", "conecta", "conectan", "conexion", "connect", "connects", "connected", "connecting", "connection"],
  ["requerir", "requiere", "requerido", "require", "requires", "required"],
  ["instalar", "instala", "instalado", "install", "installs", "installed"],
  // Sprint 3 (ajuste tras primera ronda de bateria congelada): gaps reales
  // detectados al probar parafraseos genuinamente nuevos.
  ["diferencia", "diferenciarse", "difference", "differ", "differs"],
  ["condensadora", "condenser"],
  ["unidad", "unit"],
  ["spacing", "espaciamiento", "apart"]
];

const GROUP_BY_TERM = new Map<string, readonly string[]>();
for (const group of EQUIVALENCE_GROUPS) {
  for (const term of group) GROUP_BY_TERM.set(term, group);
}

// Devuelve el grupo completo de equivalencia de un termino normalizado
// (incluyendose a si mismo), o [termino] si no pertenece a ningun grupo.
export function synonymsOf(term: string): readonly string[] {
  return GROUP_BY_TERM.get(term) ?? [term];
}

// Variantes de plural/singular conservadoras. Nunca se aplican a terminos
// criticos (nunca se "diluyen" GFCI/AFCI/EV/HVAC/etc.) ni a palabras de 3
// caracteres o menos (evita colisiones como "gas"/"mas"/"los").
export function pluralVariants(word: string): string[] {
  const lower = word.toLowerCase();
  if (CRITICAL_TERMS.has(lower) || lower.length <= 3) return [lower];

  const variants = new Set<string>([lower]);
  if (lower.endsWith("es") && lower.length > 5) {
    // paneles -> panel, interruptores -> interruptor
    variants.add(lower.slice(0, -2));
  } else if (lower.endsWith("s") && !lower.endsWith("ss")) {
    // receptaculos -> receptaculo, outlets -> outlet
    variants.add(lower.slice(0, -1));
  } else if (/[bcdfghjklmnpqrstvwxyz]$/.test(lower)) {
    // panel -> paneles/panels (consonante final: espanol agrega "es",
    // ingles agrega "s"; se ofrecen ambas formas como variante valida)
    variants.add(`${lower}s`);
    variants.add(`${lower}es`);
  } else {
    variants.add(`${lower}s`);
  }
  return Array.from(variants);
}

// Articulos y conectores ES/EN, usados SOLO para identificar las palabras
// "significativas" de una frase de keyword al hacer matching flexible
// (nunca para alterar el texto de una respuesta ni las keywords guardadas).
export const STOPWORDS: ReadonlySet<string> = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "y", "o",
  "en", "para", "con", "que", "se", "su", "sus", "al", "a", "por", "es", "son", "esta", "estan", "entre",
  "the", "a", "an", "of", "in", "for", "with", "that", "to", "and", "or", "is", "are", "be", "between"
]);

export function tokenize(text: string): string[] {
  return text.split(/[^\p{L}\p{N}-]+/u).filter(Boolean);
}

function cartesianProduct(arrays: number[][]): number[][] {
  return arrays.reduce<number[][]>((acc, curr) => acc.flatMap((a) => curr.map((c) => [...a, c])), [[]]);
}

// Sprint 3: "raiz" canonica de una palabra por plural/singular (la mas corta
// entre sus variantes, tipicamente la forma singular). Fuente unica: tanto
// matchEngine.ts (deduplicacion de score) como flexiblePhraseMatch (abajo)
// la usan.
export function rootOf(word: string): string {
  const variants = pluralVariants(word);
  return variants.reduce((shortest, candidate) => (candidate.length < shortest.length ? candidate : shortest), word);
}

// Conjunto de formas equivalentes a una palabra para efectos de matching:
// su grupo de sinonimos (resuelto sobre la raiz, para que "receptacles"
// tambien encuentre el grupo de "receptacle") expandido con las variantes
// de plural/singular de CADA sinonimo. Ej: "receptacles" -> raiz
// "receptacle" -> grupo [enchufe,tomacorriente,receptaculo,outlet,receptacle]
// -> variantes de cada uno, incluyendo "outlets".
// Grupos de equivalencia excluidos de la expansion por sinonimos DENTRO del
// matching de frases (flexiblePhraseMatch), aunque siguen disponibles para
// coincidencia de palabra unica (ver keywordMatchesFlexibly en
// matchEngine.ts). Hallazgo real durante la verificacion documental de
// Sprint 3: "receptaculos de cocina" (keyword de kb-kitchen-receptacles)
// empezo a matchear via "enchufe" (mismo grupo que "receptaculo") en la
// pregunta "necesito GFCI en el enchufe de la cocina", robandole el match a
// kb-gfci pese a que GFCI es la senal explicita y dominante de esa
// pregunta. El riesgo es estructural, no anecdotico: el grupo
// enchufe/tomacorriente/receptaculo/outlet/receptacle se usa como
// ingrediente de keywords en 5 entradas distintas (kb-gfci,
// kb-kitchen-receptacles, kb-bathroom-receptacles,
// kb-exterior-wet-locations, kb-receptacle-spacing-tr): expandir cualquiera
// de sus miembros dentro de una coincidencia de FRASE multi-palabra abre
// colisiones cruzadas impredecibles entre esas 5 entradas. Los demas
// grupos (acometida/servicio/service, condensadora/condenser, etc.) se
// usan cada uno dentro de UNA sola entrada, sin este riesgo.
const PHRASE_SYNONYM_EXPANSION_BLOCKLIST: ReadonlySet<string> = new Set(["enchufe", "tomacorriente", "receptaculo", "outlet", "receptacle"]);

function expandedFormsOf(word: string): Set<string> {
  const forms = new Set<string>(pluralVariants(word));
  const root = rootOf(word);
  if (PHRASE_SYNONYM_EXPANSION_BLOCKLIST.has(root)) return forms;
  for (const synonym of synonymsOf(root)) {
    for (const variant of pluralVariants(synonym)) forms.add(variant);
  }
  return forms;
}

// Coincidencia de frase con orden flexible y tolerancia acotada a palabras
// intermedias (items "orden flexible de terminos" y "tolerancia a palabras
// intermedias" del pedido de Sprint 3). Exige que TODAS las palabras
// significativas de la frase (sin stopwords) aparezcan en la pregunta -en
// cualquier orden- dentro de una ventana de como maximo
// (numero de palabras de la frase + tolerancia) posiciones. No es
// "bag of words" libre: si falta una sola palabra, o si las palabras
// encontradas estan demasiado dispersas, no matchea.
export function flexiblePhraseMatch(questionTokens: string[], phrase: string): boolean {
  const phraseWords = tokenize(phrase).filter((t) => !STOPWORDS.has(t));
  if (phraseWords.length < 2) return false;

  // Tolerancia de dispersion acotada: frases de 2 palabras significativas
  // permiten como maximo 2 palabras intermedias; frases de 3+ palabras
  // permiten 3. Deliberadamente conservador para minimizar falsos
  // positivos en frases cortas.
  const maxExtraGap = phraseWords.length <= 2 ? 2 : 3;

  const positionsPerWord = phraseWords.map((pw) => {
    // Sprint 3 (ajuste tras bateria congelada): cada palabra de la frase
    // tambien se busca via su grupo de sinonimos (ej. "servicio" en la
    // keyword encuentra "acometida" en la pregunta), ademas de sus propias
    // variantes de plural/singular. Antes solo se probaba plural/singular.
    const variants = expandedFormsOf(pw);
    const positions: number[] = [];
    questionTokens.forEach((qt, idx) => {
      if (variants.has(qt.toLowerCase())) positions.push(idx);
    });
    // Cota de seguridad: si una palabra aparece muchas veces (raro en una
    // pregunta corta), se limitan las combinaciones evaluadas.
    return positions.slice(0, 5);
  });
  if (positionsPerWord.some((positions) => positions.length === 0)) return false;

  let bestSpan = Infinity;
  for (const combo of cartesianProduct(positionsPerWord)) {
    const span = Math.max(...combo) - Math.min(...combo) + 1;
    if (span < bestSpan) bestSpan = span;
  }
  return bestSpan <= phraseWords.length + maxExtraGap;
}
