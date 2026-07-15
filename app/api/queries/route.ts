import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getQueries,
  createQuery,
  extractSourceCategory,
  extractSourceFile,
  findKnowledgeByQuestion,
  getOfficialSources,
  mapRiskLevelToDb,
  type KnowledgeEntryMatch,
  type OfficialSource
} from "@/lib/db/dbAdapter";
import { normalizeForMatch } from "@/lib/knowledge/electricalKnowledgeBase";
import { askAssistant } from "@/lib/ai";
import { isMetaSourceQuestion } from "@/lib/ai/mockAssistant";
import { standardWarning, verifyNecMessage } from "@/lib/ai/types";
import type { AssistantResponse, Language, QueryMode } from "@/lib/db/types";

const FALLBACK_SOURCE_USED = "Fly Electric Solutions LLC internal fallback";

export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  return NextResponse.json({ queries: await getQueries() });
}

// "Base usada para esta respuesta" con el mismo formato que
// lib/ai/mockAssistant.ts, para que la UI (AssistantResponseCard) se vea
// igual sin importar si la respuesta vino de knowledge_entries o del motor
// mock local.
function buildKnowledgeSourceInfo(entry: KnowledgeEntryMatch, language: Language): string {
  const es = [
    "Base usada para esta respuesta:",
    `- Fuente interna usada: ${entry.sourceUsed}`,
    `- Categoria detectada: ${entry.category}`,
    `- Referencia NEC/NFPA general (si aplica): ${entry.codeReferences ?? "No especificada"}`,
    `- Archivo interno: ${entry.sourceUsed}`,
    "- Nivel de confianza: alto",
    "- Que debe verificar el Master Electrician: Confirmar contra el NEC oficial vigente, la compania electrica, las condiciones del sitio y el AHJ local antes de proceder."
  ].join("\n");

  const en = [
    "Source used for this response:",
    `- Internal source used: ${entry.sourceUsed}`,
    `- Detected category: ${entry.category}`,
    `- General NEC/NFPA reference (if applicable): ${entry.codeReferences ?? "Not specified"}`,
    `- Internal file: ${entry.sourceUsed}`,
    "- Confidence level: alto",
    "- What the Master Electrician must verify: Confirm against the official NEC, the utility, site conditions, and the local AHJ before proceeding."
  ].join("\n");

  if (language === "es") return es;
  if (language === "en") return en;
  return `${es}\n\n${en}`;
}

function buildResponseFromKnowledgeMatch(entry: KnowledgeEntryMatch, language: Language): AssistantResponse {
  const useEnglish = language === "en";
  return {
    shortAnswer: useEnglish ? entry.answerEn : entry.answerEs,
    englishSummary: language !== "es" ? entry.answerEn : undefined,
    riskLevel: entry.riskLevel,
    codeReference: entry.codeReferences
      ? `${entry.codeReferences}. ${verifyNecMessage(language)}`
      : verifyNecMessage(language),
    checklist: [],
    missingQuestions: [],
    recommendation: useEnglish
      ? "Confirm final requirements with a NEC load calculation, the utility, and the local AHJ before proceeding."
      : "Confirmar los requisitos finales con un calculo de carga NEC, la compania electrica y el AHJ local antes de proceder.",
    warning: standardWarning(language),
    sourceInfo: buildKnowledgeSourceInfo(entry, language)
  };
}

// --- Deteccion de tema / modo de fuentes oficiales --------------------------
//
// Distingue entre "el tema toca NEC/TDLR/Houston" (usado para decidir que
// official_sources anexar en la seccion 3) y "la pregunta pide
// explicitamente una cita directa de norma" (forceOfficial: item 6 del
// pedido - la app debe priorizar official_sources y no responder como
// memoria generica cuando se detectan frases como "que dice el NEC",
// "que articulo aplica", "citame el NEC", "segun NEC", "TDLR", "Houston AHJ").
interface TopicFlags {
  nec: boolean;
  tdlr: boolean;
  houston: boolean;
  forceOfficial: boolean;
}

const NEC_TRIGGER_PHRASES = [
  "que dice el nec",
  "que dice el nfpa 70",
  "que articulo aplica",
  "que articulo del nec aplica",
  "cual articulo aplica",
  "citame el nec",
  "cita el nec",
  "cita el articulo",
  "segun el nec",
  "segun nec",
  "according to the nec",
  "according to nec",
  "what does the nec say",
  "which nec article",
  "what nec article applies",
  "cite the nec"
];

const HOUSTON_TRIGGER_PHRASES = [
  "houston ahj",
  "ahj de houston",
  "houston permitting",
  "houston permitting center",
  "permit houston",
  "houston public works"
];

function detectTopics(question: string): TopicFlags {
  const q = normalizeForMatch(question);

  const necTriggered = NEC_TRIGGER_PHRASES.some((phrase) => q.includes(normalizeForMatch(phrase)));
  const tdlrTriggered = q.includes("tdlr");
  const houstonTriggered =
    HOUSTON_TRIGGER_PHRASES.some((phrase) => q.includes(normalizeForMatch(phrase))) ||
    (q.includes("ahj") && q.includes("houston"));

  return {
    nec: necTriggered || /\bnec\b/.test(q) || /\bnfpa\s*70\b/.test(q),
    tdlr: tdlrTriggered,
    houston: houstonTriggered,
    forceOfficial: necTriggered || tdlrTriggered || houstonTriggered
  };
}

function relevantSourceTypesFor(topics: TopicFlags): string[] {
  const types: string[] = [];
  if (topics.nec) types.push("nec", "nfpa_free_access", "nfpa_link");
  if (topics.tdlr) types.push("tdlr", "tdlr_rules");
  if (topics.houston) types.push("houston_ahj", "houston_public_works");
  // Base: casi toda pregunta electrica toca el NEC de alguna forma, asi que
  // si no se detecto ningun tema especifico igual se ancla a NEC/NFPA.
  if (types.length === 0) types.push("nec", "nfpa_free_access");
  return types;
}

// --- Seccion 3: fuente oficial consultada o recomendada ---------------------

function buildOfficialSourceNote(sources: OfficialSource[], language: Language): string {
  if (sources.length === 0) {
    const es =
      "Aun no hay fuentes oficiales configuradas en public.official_sources. Ejecute supabase/official_sources.sql en Supabase y verifique manualmente con NFPA 70 / NEC, TDLR y el AHJ local.";
    const en =
      "No official sources are configured yet in public.official_sources. Run supabase/official_sources.sql in Supabase and verify manually with NFPA 70 / NEC, TDLR, and the local AHJ.";
    if (language === "en") return en;
    if (language === "es") return es;
    return `${es}\n${en}`;
  }

  const lines = sources.map((s) => `- ${s.sourceName}${s.jurisdiction ? ` (${s.jurisdiction})` : ""}: ${s.officialUrl}`);
  const labelEs = "Fuente oficial consultada o recomendada:";
  const labelEn = "Official source consulted or recommended:";
  if (language === "en") return [labelEn, ...lines].join("\n");
  if (language === "es") return [labelEs, ...lines].join("\n");
  return [labelEs, ...lines, "", labelEn, ...lines].join("\n");
}

// --- Seccion 2: NEC aplicable / regulacion aplicable -------------------------
//
// Regla del item 7 del pedido: cita articulos/secciones conocidas desde
// knowledge_entries; si no tiene el articulo exacto cargado, lo dice
// explicitamente en vez de inventar una seccion NEC.
const NEC_NOT_LOADED_ES =
  "No tengo el articulo exacto cargado en la base interna. Verifique en NFPA 70 / NEC oficial y AHJ.";
const NEC_NOT_LOADED_EN =
  "I do not have the exact article loaded in the internal base. Verify in the official NFPA 70 / NEC and with the AHJ.";

function necSectionText(language: Language, knowledgeMatch: KnowledgeEntryMatch | null, topics: TopicFlags): string {
  if (knowledgeMatch?.necArticles.length) {
    return `${knowledgeMatch.necArticles.join(", ")}. ${verifyNecMessage(language)}`;
  }
  if (knowledgeMatch?.codeReferences) {
    return `${knowledgeMatch.codeReferences}. ${verifyNecMessage(language)}`;
  }
  if (topics.forceOfficial) {
    if (language === "en") return NEC_NOT_LOADED_EN;
    if (language === "es") return NEC_NOT_LOADED_ES;
    return `${NEC_NOT_LOADED_ES}\n${NEC_NOT_LOADED_EN}`;
  }
  return verifyNecMessage(language);
}

// --- Seccion 4: aplicacion practica ------------------------------------------

function practicalApplicationText(
  knowledgeMatch: KnowledgeEntryMatch | null,
  fallbackRecommendation: string
): string {
  if (knowledgeMatch?.fieldNotes) return knowledgeMatch.fieldNotes;
  if (knowledgeMatch?.appliesWhen) return knowledgeMatch.appliesWhen;
  return fallbackRecommendation;
}

// --- Seccion 5: cuando no asumir ---------------------------------------------

const DO_NOT_ASSUME_ES =
  "No asuma que esta guia aplica sin confirmar las condiciones especificas del proyecto, la edicion exacta del NEC adoptada por el AHJ, los requisitos de licencia de TDLR y las reglas de permisos del AHJ local (ej. Houston Permitting Center).";
const DO_NOT_ASSUME_EN =
  "Do not assume this guidance applies without confirming project-specific conditions, the exact NEC edition adopted by the AHJ, TDLR licensing requirements, and the local AHJ's permitting rules (e.g. Houston Permitting Center).";

function doNotAssumeText(language: Language, knowledgeMatch: KnowledgeEntryMatch | null): string {
  if (knowledgeMatch?.doesNotApplyWhen) return knowledgeMatch.doesNotApplyWhen;
  if (language === "en") return DO_NOT_ASSUME_EN;
  if (language === "es") return DO_NOT_ASSUME_ES;
  return `${DO_NOT_ASSUME_ES}\n${DO_NOT_ASSUME_EN}`;
}

// --- Seccion 8: verificacion final -------------------------------------------

function buildFinalVerification(language: Language, sources: OfficialSource[]): string {
  const baseEs =
    "Verificacion final requerida antes de proceder: confirmar contra el NEC oficial vigente (NFPA 70), TDLR (licencia y reglas de Texas), el AHJ correspondiente (ej. Houston Permitting Center) y obtener la aprobacion del Master Electrician.";
  const baseEn =
    "Final verification required before proceeding: confirm against the official current NEC (NFPA 70), TDLR (Texas license and rules), the applicable AHJ (e.g. Houston Permitting Center), and obtain Master Electrician approval.";
  const urls = sources
    .slice(0, 4)
    .map((s) => `${s.sourceName}: ${s.officialUrl}`)
    .join(" | ");
  const base = language === "en" ? baseEn : language === "es" ? baseEs : `${baseEs}\n${baseEn}`;
  return urls ? `${base}\n${urls}` : base;
}

// --- Checklist de campo: fusiona verification_steps de knowledge_entries ----

function mergedChecklist(base: string[], knowledgeMatch: KnowledgeEntryMatch | null): string[] {
  if (!knowledgeMatch?.verificationSteps.length) return base;
  return Array.from(new Set([...knowledgeMatch.verificationSteps, ...base]));
}

// --- Item 6: modo "prioriza fuentes oficiales, no memoria generica" --------
//
// Cuando la pregunta pide explicitamente una cita directa de norma
// (forceOfficial) y no hay un articulo exacto cargado en knowledge_entries,
// la respuesta corta no debe sonar a "no tengo suficiente informacion"
// generico: debe explicar que se prioriza official_sources y remitir ahi.
function buildForcedOfficialShortAnswer(language: Language, knowledgeMatch: KnowledgeEntryMatch | null): string {
  const hasArticle = Boolean(knowledgeMatch?.necArticles.length || knowledgeMatch?.codeReferences);
  const es = hasArticle
    ? "Esta pregunta pide una cita directa de norma. Vea la seccion 'NEC aplicable / regulacion aplicable' para el articulo cargado en la base interna, y confirme el texto oficial en la fuente oficial listada abajo."
    : "Esta pregunta pide una cita directa de norma, pero no tengo el articulo exacto cargado en la base interna. Consulte directamente la fuente oficial listada abajo (NFPA 70 / NEC, TDLR o Houston AHJ segun corresponda) antes de proceder.";
  const en = hasArticle
    ? "This question asks for a direct code citation. See the 'NEC applicable / applicable regulation' section for the article loaded in the internal base, and confirm the official text in the official source listed below."
    : "This question asks for a direct code citation, but I do not have the exact article loaded in the internal base. Please consult the official source listed below (NFPA 70 / NEC, TDLR, or Houston AHJ as applicable) directly before proceeding.";
  if (language === "en") return en;
  if (language === "es") return es;
  return `${es}\n\n${en}`;
}

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (!hasPermission(user.role, "query.create")) {
    return NextResponse.json({ error: "No tienes permiso para crear consultas." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const question = body?.question as string | undefined;
  console.log("[api/queries] Pregunta recibida:", question);
  if (!question || question.trim().length === 0) {
    return NextResponse.json({ error: "La pregunta no puede estar vacia." }, { status: 400 });
  }

  const language = (body?.language as Language) ?? user.preferredLanguage;
  const mode = (body?.mode as QueryMode) ?? "texto";
  const projectId = (body?.projectId as string | null) ?? null;

  const topics = detectTopics(question);

  // 1) Base tecnica REAL primero: public.knowledge_entries en Supabase (ver
  // lib/db/dbAdapter.ts#findKnowledgeByQuestion). Solo si no hay coincidencia
  // ahi se usa el motor mock local como fallback controlado (que a su vez
  // tiene su propia base local + categorias legacy + "no tengo suficiente
  // informacion" como ultimo recurso).
  const knowledgeMatch = await findKnowledgeByQuestion(question);

  // Preguntas meta sobre la fuente interna se resuelven aparte (explicacion
  // fija de que arma la base interna), sin pasar por el flujo de fuentes
  // oficiales de abajo.
  const isMetaQuestion = isMetaSourceQuestion(question);

  let response: AssistantResponse;
  let generationErrorMessage: string | null = null;
  let category: string;
  let sourceUsed: string;

  if (isMetaQuestion) {
    try {
      response = await askAssistant({ question, language });
    } catch (genError) {
      console.error("[api/queries] Error generando respuesta del asistente (meta):", genError);
      generationErrorMessage =
        genError instanceof Error ? genError.message : "Error desconocido generando la respuesta.";
      response = {
        shortAnswer: "No se pudo generar una respuesta. Intenta de nuevo en unos segundos.",
        riskLevel: "bajo",
        codeReference: "",
        checklist: [],
        missingQuestions: [],
        recommendation: "Reintentar la consulta en unos segundos.",
        warning: "Error controlado del motor de respuestas; esta consulta quedo registrada para revision."
      };
    }
    category = "system_source_explanation";
    sourceUsed = extractSourceFile(response.sourceInfo) ?? FALLBACK_SOURCE_USED;
  } else if (knowledgeMatch) {
    response = buildResponseFromKnowledgeMatch(knowledgeMatch, language);
    category = knowledgeMatch.category;
    sourceUsed = knowledgeMatch.sourceUsed;
    console.log(`[api/queries] Respuesta desde knowledge_entries (Supabase): categoria=${category}`);
  } else {
    try {
      response = await askAssistant({ question, language });
      console.log("[api/queries] Respuesta generada (motor local, fallback):", response.shortAnswer);
    } catch (genError) {
      console.error("[api/queries] Error generando respuesta del asistente:", genError);
      generationErrorMessage =
        genError instanceof Error ? genError.message : "Error desconocido generando la respuesta.";
      response = {
        shortAnswer: "No se pudo generar una respuesta. Intenta de nuevo en unos segundos.",
        riskLevel: "bajo",
        codeReference: "",
        checklist: [],
        missingQuestions: [],
        recommendation: "Reintentar la consulta en unos segundos.",
        warning: "Error controlado del motor de respuestas; esta consulta quedo registrada para revision."
      };
    }

    // Item 6: si la pregunta prioriza fuentes oficiales explicitamente
    // (forceOfficial) y no hubo match en knowledge_entries, la respuesta no
    // debe sonar a fallback generico: se reemplaza la respuesta corta por
    // una que remite directamente a official_sources.
    if (topics.forceOfficial && !generationErrorMessage) {
      response = { ...response, shortAnswer: buildForcedOfficialShortAnswer(language, knowledgeMatch) };
    }

    // Clasificacion para la columna "category": las preguntas meta sobre la
    // fuente interna (bajo que bases, de donde sale esta respuesta, que
    // norma usaste, etc.) se etiquetan aparte de las respuestas tecnicas
    // normales. Si no se detecta ninguna categoria especifica (fallback
    // generico, pregunta sin informacion suficiente, error controlado), se
    // usa "general_or_fallback" en vez de dejar la columna vacia.
    const rawCategory = topics.forceOfficial
      ? "official_source_priority"
      : extractSourceCategory(response.sourceInfo);
    category = rawCategory && rawCategory.trim() ? rawCategory : "general_or_fallback";
    sourceUsed = topics.forceOfficial
      ? "public.official_sources (Supabase catalog)"
      : extractSourceFile(response.sourceInfo) ?? FALLBACK_SOURCE_USED;
  }

  // 2) Anexa fuentes oficiales relacionadas y arma el formato de 8 secciones
  // pedido (respuesta corta / NEC-regulacion aplicable / fuente oficial /
  // aplicacion practica / cuando no asumir / checklist de campo / riesgo /
  // verificacion final). No aplica a preguntas meta sobre la fuente interna,
  // que ya tienen su propia respuesta fija completa.
  if (!isMetaQuestion) {
    const allOfficialSources = await getOfficialSources();
    const sourceTypes = relevantSourceTypesFor(topics);
    const relevantSources = allOfficialSources.filter((s) => sourceTypes.includes(s.sourceType));
    const sourcesToShow = relevantSources.length > 0 ? relevantSources : allOfficialSources.slice(0, 3);

    response = {
      ...response,
      codeReference: necSectionText(language, knowledgeMatch, topics),
      officialSourceNote: buildOfficialSourceNote(sourcesToShow, language),
      practicalApplication: practicalApplicationText(knowledgeMatch, response.recommendation),
      doNotAssume: doNotAssumeText(language, knowledgeMatch),
      checklist: mergedChecklist(response.checklist, knowledgeMatch),
      finalVerification: buildFinalVerification(language, sourcesToShow)
    };
  }

  // Guardar en Supabase es "best effort": lib/db/dbAdapter.ts ya garantiza
  // que createQuery nunca lanza (si Supabase falla, registra el error en
  // los logs del servidor y devuelve la misma respuesta sin persistir). El
  // usuario siempre ve la respuesta generada, se haya podido guardar o no.
  // Esta llamada se ejecuta SIEMPRE (toda consulta se guarda), tambien
  // cuando la generacion fallo arriba (para que el error controlado tambien
  // quede registrado) y tambien cuando la respuesta vino de knowledge_entries.
  const { query, persisted, error: saveError } = await createQuery({
    projectId,
    planId: null,
    userEmail: user.email,
    mode,
    language,
    question,
    response,
    sourceCategory: category,
    errorMessage: generationErrorMessage
  });

  if (!persisted) {
    console.error(
      `[api/queries] La consulta ${query.id} se respondio pero NO se pudo guardar en Supabase (${saveError}). Revisar SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY y los logs de [dbAdapter] arriba.`
    );
  }

  const responseBody = {
    query,
    answer: response.shortAnswer,
    persisted,
    queryId: query.id,
    saveError,
    category,
    source_used: sourceUsed,
    risk_level: mapRiskLevelToDb(response.riskLevel)
  };

  if (generationErrorMessage) {
    return NextResponse.json(
      { ...responseBody, error: "No se pudo generar una respuesta. Intenta de nuevo en unos segundos." },
      { status: 500 }
    );
  }

  return NextResponse.json(responseBody, { status: 201 });
}
