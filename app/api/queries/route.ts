import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createQuery, listQueries } from "@/lib/db/repos/queries";
import { askAssistant } from "@/lib/ai";
import type { Language, QueryMode } from "@/lib/db/types";

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
  if (!question || question.trim().length === 0) {
    return NextResponse.json({ error: "La pregunta no puede estar vacia." }, { status: 400 });
  }

  const language = (body?.language as Language) ?? user.preferredLanguage;
  const mode = (body?.mode as QueryMode) ?? "texto";
  const projectId = (body?.projectId as string | null) ?? null;

  try {
    const response = await askAssistant({ question, language });

    const query = createQuery({
      projectId,
      planId: null,
      userId: user.id,
      mode,
      language,
      question,
      response
    });

    return NextResponse.json({ query }, { status: 201 });
  } catch (error) {
    console.error("Error generando respuesta del asistente:", error);
    return NextResponse.json(
      { error: "No se pudo generar una respuesta. Intenta de nuevo en unos segundos." },
      { status: 500 }
    );
  }
}
