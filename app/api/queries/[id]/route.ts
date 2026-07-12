import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getQueryById, escalateQuery } from "@/lib/db/dbAdapter";
import { getReviewByQuery } from "@/lib/db/repos/reviews";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const query = await getQueryById(params.id);
  if (!query) return NextResponse.json({ error: "Consulta no encontrada." }, { status: 404 });

  return NextResponse.json({ query, review: getReviewByQuery(query.id) });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (body?.action === "escalate") {
    if (!hasPermission(user.role, "query.escalate")) {
      return NextResponse.json({ error: "No tienes permiso para escalar consultas." }, { status: 403 });
    }
    try {
      const query = await escalateQuery(params.id);
      if (!query) return NextResponse.json({ error: "Consulta no encontrada." }, { status: 404 });
      return NextResponse.json({ query });
    } catch (error) {
      console.error("[api/queries/[id]] Error escalando la consulta:", error);
      return NextResponse.json({ error: "No se pudo escalar la consulta en la base de datos." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Accion no reconocida." }, { status: 400 });
}
