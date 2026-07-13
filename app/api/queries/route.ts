import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getQueries, createQuery, extractSourceCategory } from "@/lib/db/dbAdapter";
import { askAssistant } from "@/lib/ai";
import { isMetaSourceQuestion } from "@/lib/ai/mockAssistant";
import type { AssistantResponse, Language, QueryMode } from "@/lib/db/types";

export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  return NextResponse.json({ queries: await getQueries() });
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

  // La generacion de la respuesta (motor mock + base de conocimiento
  // electrica, sin red ni fs) casi nunca deberia fallar, pero si falla NO
  // se corta el flujo: toda consulta enviada por el usuario debe quedar
  // guardada, incluyendo el caso de un error controlado del motor.
  let response: AssistantResponse;
  let generationErrorMessage: string | null = null;
  try {
    response = await askAssistant({ question, language });
    console.log("[api/queries] Respuesta generada (motor local):", response.shortAnswer);
  } catch (genError) {
    console.error("[api/queries] Error generando respuesta del asistente:", genError);
    generationErrorMessage = genError instanceof Error ? genError.message : "Error desconocido generando la respuesta.";
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
  // fuente interna (bajo que bases, de donde sale esta respuesta, que norma
  // usaste, etc.) se etiquetan aparte de las respuestas tecnicas normales.
  // Si no se detecta ninguna categoria especifica (fallback generico,
  // pregunta sin informacion suficiente, error controlado), se usa
  // "general_or_fallback" en vez de dejar la columna vacia.
  const rawCategory = isMetaSourceQuestion(question)
    ? "system_source_explanation"
    : extractSourceCategory(response.sourceInfo);
  const sourceCategory = rawCategory && rawCategory.trim() ? rawCategory : "general_or_fallback";

  // Guardar en Supabase es "best effort": lib/db/dbAdapter.ts ya garantiza
  // que createQuery nunca lanza (si Supabase falla, registra el error en
  // los logs del servidor y devuelve la misma respuesta sin persistir). El
  // usuario siempre ve la respuesta generada, se haya podido guardar o no.
  // Esta llamada se ejecuta SIEMPRE, tambien cuando la generacion fallo
  // arriba (para que el error controlado tambien quede registrado).
  const { query, persisted, error: saveError } = await createQuery({
    projectId,
    planId: null,
    userEmail: user.email,
    mode,
    language,
    question,
    response,
    sourceCategory,
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
    saveError
  };

  if (generationErrorMessage) {
    return NextResponse.json(
      { ...responseBody, error: "No se pudo generar una respuesta. Intenta de nuevo en unos segundos." },
      { status: 500 }
    );
  }

  return NextResponse.json(responseBody, { status: 201 });
}
