import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getQueries,
  createQuery,
  extractSourceCategory,
  extractSourceFile,
  findKnowledgeByQuestion,
  mapRiskLevelToDb,
  type KnowledgeEntryMatch
} from "@/lib/db/dbAdapter";
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

  // 1) Base tecnica REAL primero: public.knowledge_entries en Supabase (ver
  // lib/db/dbAdapter.ts#findKnowledgeByQuestion). Solo si no hay coincidencia
  // ahi se usa el motor mock local como fallback controlado (que a su vez
  // tiene su propia base local + categorias legacy + "no tengo suficiente
  // informacion" como ultimo recurso).
  const knowledgeMatch = await findKnowledgeByQuestion(question);

  let response: AssistantResponse;
  let generationErrorMessage: string | null = null;
  let category: string;
  let sourceUsed: string;

  if (knowledgeMatch) {
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

    // Clasificacion para la columna "category": las preguntas meta sobre la
    // fuente interna (bajo que bases, de donde sale esta respuesta, que
    // norma usaste, etc.) se etiquetan aparte de las respuestas tecnicas
    // normales. Si no se detecta ninguna categoria especifica (fallback
    // generico, pregunta sin informacion suficiente, error controlado), se
    // usa "general_or_fallback" en vez de dejar la columna vacia.
    const rawCategory = isMetaSourceQuestion(question)
      ? "system_source_explanation"
      : extractSourceCategory(response.sourceInfo);
    category = rawCategory && rawCategory.trim() ? rawCategory : "general_or_fallback";
    sourceUsed = extractSourceFile(response.sourceInfo) ?? FALLBACK_SOURCE_USED;
  }

  // Guardar en Supabase es "best effort": lib/db/dbAdapter.ts ya garantiza
  // que createQuery nunca lanza (si Supabase falla, registra el error en
  // los logs del servidor y devuelve la misma respuesta sin persistir). El
  // usuario siempre ve la respuesta generada, se haya podido guardar o no.
  // Esta llamada se ejecuta SIEMPRE, tambien cuando la generacion fallo
  // arriba (para que el error controlado tambien quede registrado) y
  // tambien cuando la respuesta vino de knowledge_entries.
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
