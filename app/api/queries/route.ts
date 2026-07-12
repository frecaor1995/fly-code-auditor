import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getQueries, createQuery, extractSourceCategory } from "@/lib/db/dbAdapter";
import { askAssistant } from "@/lib/ai";
import type { Language, QueryMode } from "@/lib/db/types";

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
  // electrica, sin red ni fs) es la parte critica y no deberia fallar
  // nunca. Si falla, es un error real y no hay nada util que mostrar.
  let response;
  try {
    response = await askAssistant({ question, language });
    console.log("[api/queries] Respuesta generada (motor local):", response.shortAnswer);
  } catch (error) {
    console.error("[api/queries] Error generando respuesta del asistente:", error);
    return NextResponse.json(
      {
        error: "No se pudo generar una respuesta. Intenta de nuevo en unos segundos.",
        answer: "No se pudo generar una respuesta. Intenta de nuevo en unos segundos."
      },
      { status: 500 }
    );
  }

  // Guardar en Supabase es "best effort": lib/db/dbAdapter.ts ya garantiza
  // que createQuery nunca lanza (si Supabase falla, registra el error en
  // los logs del servidor y devuelve la misma respuesta sin persistir). El
  // usuario siempre ve la respuesta generada, se haya podido guardar o no.
  const { query, persisted } = await createQuery({
    projectId,
    planId: null,
    userEmail: user.email,
    mode,
    language,
    question,
    response,
    sourceCategory: extractSourceCategory(response.sourceInfo)
  });

  if (!persisted) {
    console.error(
      `[api/queries] La consulta ${query.id} se respondio pero NO se pudo guardar en Supabase. Revisar SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY y los logs de [dbAdapter] arriba.`
    );
  }

  // "answer" se incluye plano ademas de "query" para cualquier consumidor
  // que solo necesite el texto de la respuesta sin el objeto completo.
  // "persisted" le dice al cliente si el guardado en Supabase funciono,
  // para poder avisar sin dejar la pantalla vacia.
  return NextResponse.json({ query, answer: response.shortAnswer, persisted }, { status: 201 });
}
