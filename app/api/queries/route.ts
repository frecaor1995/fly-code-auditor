import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createQuery, listQueries } from "@/lib/db/repos/queries";
import { askAssistant } from "@/lib/ai";
import type { AssistantResponse, Language, QueryMode, QueryRecord } from "@/lib/db/types";

export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  return NextResponse.json({ queries: listQueries() });
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

  // La generacion de la respuesta (motor mock local, sin red ni fs) es la
  // parte critica y no deberia fallar nunca. Si falla, es un error real.
  let response: AssistantResponse;
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

  // Guardar el historial es "best effort": en produccion (Vercel) el
  // filesystem puede ser de solo lectura, y jsonStore ya degrada a memoria
  // en ese caso sin lanzar. Este try/catch es una segunda red de seguridad:
  // si por cualquier motivo createQuery fallara igual, el usuario debe ver
  // la respuesta que ya se genero en vez de un error generico.
  let query: QueryRecord;
  try {
    query = createQuery({ projectId, planId: null, userId: user.id, mode, language, question, response });
  } catch (error) {
    console.error("[api/queries] No se pudo guardar la consulta; se responde sin persistir:", error);
    query = {
      id: `local-${Date.now()}`,
      projectId,
      planId: null,
      userId: user.id,
      mode,
      language,
      question,
      response,
      riskLevel: response.riskLevel,
      requiresMasterReview: response.riskLevel === "alto" || response.riskLevel === "critico",
      createdAt: new Date().toISOString()
    };
  }

  // "answer" se incluye plano ademas de "query" para cualquier consumidor
  // que solo necesite el texto de la respuesta sin el objeto completo.
  return NextResponse.json({ query, answer: response.shortAnswer }, { status: 201 });
}
