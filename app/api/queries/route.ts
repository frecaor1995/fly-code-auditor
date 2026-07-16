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
import { isMockAiEnabled } from "@/lib/ai";
import { mockAskAssistant } from "@/lib/ai/mockAssistant";
import { openaiAskAssistant } from "@/lib/ai/openaiAssistant";
import { buildOfflineFallbackResponse } from "@/lib/ai/localFallback";
import { classifyIntent } from "@/lib/ai/intentClassifier";
import { standardWarning, verifyNecMessage } from "@/lib/ai/types";
import { withTimeout, safeErrorMessage } from "@/lib/utils/resilience";
import type { AssistantResponse, Language, QueryMode, QueryRecord } from "@/lib/db/types";

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
// explicitamente una cita directa de norma" (forceOfficial: la app prioriza
// official_sources y no responde como memoria generica cuando se detectan
// frases como "que dice el NEC", "que articulo aplica", "citame el NEC",
// "segun NEC", "TDLR", "Houston AHJ").
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
      "Aun no hay fuentes oficiales configuradas en public.official_sources (o no se pudieron leer en este momento). Ejecute supabase/official_sources.sql en Supabase y verifique manualmente con NFPA 70 / NEC, TDLR y el AHJ local.";
    const en =
      "No official sources are configured yet in public.official_sources (or they could not be read right now). Run supabase/official_sources.sql in Supabase and verify manually with NFPA 70 / NEC, TDLR, and the local AHJ.";
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
// Cita articulos/secciones conocidas desde knowledge_entries; si no tiene el
// articulo exacto cargado, lo dice explicitamente en vez de inventar una
// seccion NEC.
const NEC_NOT_LOADED_ES =
  "No tengo el articulo exacto cargado en la base interna. Verifique en NFPA 70 / NEC oficial y AHJ.";
const NEC_NOT_LOADED_EN =
  "I do not have the exact article loaded in the internal base. Verify in the official NFPA 70 / NEC and with the AHJ.";

// Una respuesta tiene una cita "especifica" cuando su codeReference trae
// algo mas que el disclaimer generico de verifyNecMessage (los matches de
// knowledge_entries local -lib/knowledge/electricalKnowledgeBase.ts- ya
// arman codeReference como "<articulos especificos>. <verifyNecMessage>").
// Sin este chequeo, necSectionText de abajo pisaria SIEMPRE ese contenido ya
// citado con el mensaje generico (o con NEC_NOT_LOADED), descartando una
// cita NEC real que la app si tenia cargada.
function hasSpecificCitation(codeReference: string, language: Language): boolean {
  const trimmed = codeReference.trim();
  if (!trimmed) return false;
  return trimmed !== verifyNecMessage(language);
}

function necSectionText(
  language: Language,
  knowledgeMatch: KnowledgeEntryMatch | null,
  topics: TopicFlags,
  existingCodeReference: string
): string {
  if (knowledgeMatch?.necArticles.length) {
    return `${knowledgeMatch.necArticles.join(", ")}. ${verifyNecMessage(language)}`;
  }
  if (knowledgeMatch?.codeReferences) {
    return `${knowledgeMatch.codeReferences}. ${verifyNecMessage(language)}`;
  }
  // Preserva una cita especifica ya generada (ej. por un match de la base
  // electrica interna local) en vez de reemplazarla por un mensaje generico.
  if (hasSpecificCitation(existingCodeReference, language)) {
    return existingCodeReference;
  }
  if (topics.forceOfficial) {
    if (language === "en") return NEC_NOT_LOADED_EN;
    if (language === "es") return NEC_NOT_LOADED_ES;
    return `${NEC_NOT_LOADED_ES}\n${NEC_NOT_LOADED_EN}`;
  }
  return existingCodeReference || verifyNecMessage(language);
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

// --- Modo "prioriza fuentes oficiales, no memoria generica" ----------------
//
// Cuando la pregunta pide explicitamente una cita directa de norma
// (forceOfficial) y la respuesta generada NO trae ya una cita especifica
// (cayo en el fallback generico porque tampoco hubo match tecnico), se
// reemplaza la respuesta corta por una que remite directamente a
// official_sources. Si SI hubo match tecnico real, esa respuesta nunca se
// descarta (ver el guard de hasSpecificCitation en el caller).
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

// =============================================================================
// Resiliencia estructural: ninguna operacion externa (Supabase, OpenAI,
// guardado) puede tumbar la generacion ni el envio de la respuesta. Cada una
// se encapsula por separado con su propio try/catch y un timeout defensivo,
// para que un servicio lento/caido nunca deje la funcion serverless colgada
// (eso es lo que el cliente interpreta como "no se pudo conectar con el
// servidor": no es un error HTTP, es la conexion cayendose porque la
// funcion nunca respondio a tiempo).
// =============================================================================

const SUPABASE_READ_TIMEOUT_MS = 8000;
const OPENAI_TIMEOUT_MS = 15000;
const SAVE_TIMEOUT_MS = 8000;

interface AvailableKnowledge {
  knowledgeMatch: KnowledgeEntryMatch | null;
  officialSources: OfficialSource[];
}

// Paso (b) del flujo obligatorio: recupera todo el conocimiento disponible
// en Supabase. Cada lectura tiene su propio try/catch + timeout: si una
// falla o cuelga, la otra igual se intenta, y el flujo completo continua
// con lo que si se pudo obtener (o listas/null vacios) en vez de abortar.
async function fetchAvailableKnowledge(question: string): Promise<AvailableKnowledge> {
  let knowledgeMatch: KnowledgeEntryMatch | null = null;
  try {
    knowledgeMatch = await withTimeout(
      findKnowledgeByQuestion(question),
      SUPABASE_READ_TIMEOUT_MS,
      "supabase-read:knowledge_entries"
    );
  } catch (error) {
    console.error("[queries:supabase-read]", error);
    knowledgeMatch = null;
  }

  let officialSources: OfficialSource[] = [];
  try {
    officialSources = await withTimeout(getOfficialSources(), SUPABASE_READ_TIMEOUT_MS, "supabase-read:official_sources");
  } catch (error) {
    console.error("[queries:supabase-read]", error);
    officialSources = [];
  }

  return { knowledgeMatch, officialSources };
}

interface GeneratedAssistant {
  response: AssistantResponse;
  providerFallback: boolean;
  providerError: string | null;
}

// Paso (c) del flujo obligatorio: genera la respuesta tecnica SIN depender
// de Supabase en absoluto (ni de si el guardado, que ocurre despues, va a
// funcionar). Si USE_MOCK_AI esta activo, usa directamente el motor local.
// Si no, intenta OpenAI con timeout y, ante cualquier falla (timeout, sin
// API key, rate limit, red), cae al motor local (mockAskAssistant) y marca
// providerFallback/providerError para que el cliente pueda mostrar un aviso
// especifico en vez de un error generico de conexion.
async function generateAssistantResponse(question: string, language: Language): Promise<GeneratedAssistant> {
  if (isMockAiEnabled()) {
    const response = await mockAskAssistant({ question, language });
    return { response, providerFallback: false, providerError: null };
  }

  try {
    const response = await withTimeout(openaiAskAssistant({ question, language }), OPENAI_TIMEOUT_MS, "openai");
    return { response, providerFallback: false, providerError: null };
  } catch (error) {
    console.error("[queries:openai]", error);
    const providerError = safeErrorMessage(error, "El proveedor de IA no respondio.");
    try {
      const response = await mockAskAssistant({ question, language });
      return { response, providerFallback: true, providerError };
    } catch (mockError) {
      // El motor local no deberia fallar nunca (no depende de red ni de
      // ningun servicio externo): si de todas formas falla, es el ultimo
      // recurso real antes del catch fatal de mas abajo.
      console.error("[queries:fatal]", mockError);
      return { response: buildOfflineFallbackResponse(language), providerFallback: true, providerError };
    }
  }
}

// Fila "en memoria" (no persistida) usada cuando el guardado en Supabase
// falla o lanza de forma inesperada: la respuesta ya generada en el paso
// (c) SIEMPRE se devuelve al usuario, con o sin persistencia.
function buildUnsavedQueryRecord(input: {
  projectId: string | null;
  userEmail: string;
  mode: QueryMode;
  language: Language;
  question: string;
  response: AssistantResponse;
}): QueryRecord {
  return {
    id: `local-${Date.now()}`,
    projectId: input.projectId,
    planId: null,
    userId: input.userEmail,
    mode: input.mode,
    language: input.language,
    question: input.question,
    response: input.response,
    riskLevel: input.response.riskLevel,
    requiresMasterReview: input.response.riskLevel === "alto" || input.response.riskLevel === "critico",
    createdAt: new Date().toISOString()
  };
}

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (!hasPermission(user.role, "query.create")) {
    return NextResponse.json({ error: "No tienes permiso para crear consultas." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const question = body?.question as string | undefined;
  if (!question || question.trim().length === 0) {
    return NextResponse.json({ error: "La pregunta no puede estar vacia." }, { status: 400 });
  }

  const language = (body?.language as Language) ?? user.preferredLanguage;
  const mode = (body?.mode as QueryMode) ?? "texto";
  const projectId = (body?.projectId as string | null) ?? null;

  // Todo el procesamiento (pasos b-e del flujo obligatorio) va dentro de
  // este try/catch de ultimo recurso: si CUALQUIER cosa no anticipada
  // truena mas abajo (un bug, una libreria que lanza distinto a lo
  // esperado, etc.), este catch sigue produciendo una respuesta tecnica
  // local utilizable en vez de dejar que la funcion serverless termine sin
  // responder -que es lo que el cliente ve como "no se pudo conectar con
  // el servidor" (ver requisito de que solo se devuelva 500 cuando sea
  // imposible producir cualquier respuesta).
  try {
    // (a) Clasificar intencion: funcion pura, no toca red ni Supabase.
    const topics = detectTopics(question);
    const intentResult = classifyIntent(question);
    const isMetaQuestion = intentResult.intent === "meta_source";

    // (b) Recuperar conocimiento disponible (Supabase, con timeout y
    // try/catch propio por cada lectura; nunca lanza).
    const { knowledgeMatch, officialSources: allOfficialSources } = await fetchAvailableKnowledge(question);

    // (c) Generar la respuesta tecnica. Esta etapa NUNCA depende de si el
    // guardado (paso e) va a funcionar: la respuesta se genera y se
    // devuelve al usuario independientemente de eso.
    let response: AssistantResponse;
    let category: string;
    let sourceUsed: string;
    let providerFallback = false;
    let providerError: string | null = null;

    if (isMetaQuestion) {
      const generated = await generateAssistantResponse(question, language);
      response = generated.response;
      providerFallback = generated.providerFallback;
      providerError = generated.providerError;
      category = "system_source_explanation";
      sourceUsed = extractSourceFile(response.sourceInfo) ?? FALLBACK_SOURCE_USED;
    } else if (knowledgeMatch) {
      response = buildResponseFromKnowledgeMatch(knowledgeMatch, language);
      category = knowledgeMatch.category;
      sourceUsed = knowledgeMatch.sourceUsed;
    } else {
      const generated = await generateAssistantResponse(question, language);
      response = generated.response;
      providerFallback = generated.providerFallback;
      providerError = generated.providerError;

      // Si la pregunta prioriza fuentes oficiales explicitamente
      // (forceOfficial) y la respuesta generada NO trae ya una cita
      // especifica (cayo en el fallback generico porque tampoco hubo match
      // tecnico local), se reemplaza la respuesta corta por una que remite
      // directamente a official_sources. Si SI hubo match tecnico real
      // (ej. un feeder/subpanel con aluminio), esa respuesta nunca se
      // descarta, aunque la pregunta tambien mencione NEC/TDLR/Houston AHJ.
      if (topics.forceOfficial && !hasSpecificCitation(response.codeReference, language)) {
        response = { ...response, shortAnswer: buildForcedOfficialShortAnswer(language, knowledgeMatch) };
      }

      const rawCategory = topics.forceOfficial
        ? "official_source_priority"
        : extractSourceCategory(response.sourceInfo);
      category = rawCategory && rawCategory.trim() ? rawCategory : "general_or_fallback";
      sourceUsed = topics.forceOfficial
        ? "public.official_sources (Supabase catalog)"
        : extractSourceFile(response.sourceInfo) ?? FALLBACK_SOURCE_USED;
    }

    // Anexa fuentes oficiales relacionadas y arma el formato de 8 secciones
    // (respuesta corta / NEC-regulacion aplicable / fuente oficial /
    // aplicacion practica / cuando no asumir / checklist de campo / riesgo /
    // verificacion final). No aplica a preguntas meta sobre la fuente
    // interna, que ya tienen su propia respuesta fija completa.
    if (!isMetaQuestion) {
      const sourceTypes = relevantSourceTypesFor(topics);
      const relevantSources = allOfficialSources.filter((s) => sourceTypes.includes(s.sourceType));
      const sourcesToShow = relevantSources.length > 0 ? relevantSources : allOfficialSources.slice(0, 3);

      response = {
        ...response,
        codeReference: necSectionText(language, knowledgeMatch, topics, response.codeReference),
        officialSourceNote: buildOfficialSourceNote(sourcesToShow, language),
        practicalApplication: practicalApplicationText(knowledgeMatch, response.recommendation),
        doNotAssume: doNotAssumeText(language, knowledgeMatch),
        checklist: mergedChecklist(response.checklist, knowledgeMatch),
        finalVerification: buildFinalVerification(language, sourcesToShow)
      };
    }

    // (d) La respuesta ya esta lista para el usuario en este punto. (e) el
    // guardado ocurre a continuacion, pero envuelto en su propio try/catch:
    // si falla, la respuesta ya generada arriba se devuelve de todas formas.
    let query: QueryRecord;
    let persisted: boolean;
    let saveError: string | null;
    try {
      const saveResult = await withTimeout(
        createQuery({
          projectId,
          planId: null,
          userEmail: user.email,
          mode,
          language,
          question,
          response,
          sourceCategory: category,
          errorMessage: providerError
        }),
        SAVE_TIMEOUT_MS,
        "save"
      );
      query = saveResult.query;
      persisted = saveResult.persisted;
      saveError = saveResult.error;
      if (!persisted) {
        console.error("[queries:save]", new Error(saveError ?? "Guardado no persistido por una razon desconocida."));
      }
    } catch (error) {
      console.error("[queries:save]", error);
      saveError = safeErrorMessage(error, "No se pudo guardar la consulta.");
      persisted = false;
      query = buildUnsavedQueryRecord({ projectId, userEmail: user.email, mode, language, question, response });
    }

    // JSON siempre valido, con o sin persistencia y con o sin fallback de
    // proveedor: el usuario nunca se queda sin respuesta por un fallo
    // recuperable en Supabase u OpenAI (item 4, 5, 6, 7 del pedido).
    return NextResponse.json(
      {
        query,
        answer: response.shortAnswer,
        persisted,
        queryId: query.id,
        detectedIntent: intentResult.intent,
        sourceUsed,
        source_used: sourceUsed,
        providerFallback,
        saveError,
        providerError,
        category,
        risk_level: mapRiskLevelToDb(response.riskLevel),
        matchedRule: intentResult.matchedRule,
        technicalTermsDetected: intentResult.technicalTermsDetected,
        metaSourceDetected: intentResult.metaSourceDetected
      },
      { status: 201 }
    );
  } catch (fatalError) {
    // Ultimo recurso real: algo no anticipado fallo antes de poder generar
    // o devolver cualquier respuesta. Se intenta igual devolver una
    // respuesta tecnica local (buildOfflineFallbackResponse no depende de
    // red ni de Supabase, es texto estatico) en vez de un 500 desnudo. Solo
    // si construir ESO tambien falla se devuelve 500.
    console.error("[queries:fatal]", fatalError);
    try {
      const fallbackResponse = buildOfflineFallbackResponse(language);
      const query = buildUnsavedQueryRecord({ projectId, userEmail: user.email, mode, language, question, response: fallbackResponse });
      return NextResponse.json(
        {
          query,
          answer: fallbackResponse.shortAnswer,
          persisted: false,
          queryId: query.id,
          detectedIntent: "general",
          sourceUsed: FALLBACK_SOURCE_USED,
          source_used: FALLBACK_SOURCE_USED,
          providerFallback: true,
          saveError: "No se pudo completar el flujo normal; no se intento guardar esta consulta.",
          providerError: safeErrorMessage(fatalError, "Error interno inesperado."),
          category: "fatal_fallback",
          risk_level: mapRiskLevelToDb(fallbackResponse.riskLevel),
          matchedRule: "fatal_error_fallback",
          technicalTermsDetected: [],
          metaSourceDetected: false
        },
        { status: 200 }
      );
    } catch (unrecoverableError) {
      // Esto solo puede pasar si buildOfflineFallbackResponse (texto
      // estatico puro) o JSON.stringify fallan, lo cual no deberia ocurrir
      // nunca en la practica: es el unico caso legitimo para un 500.
      console.error("[queries:fatal]", unrecoverableError);
      return NextResponse.json(
        { error: "No se pudo producir ninguna respuesta. Intenta de nuevo en unos segundos." },
        { status: 500 }
      );
    }
  }
}
