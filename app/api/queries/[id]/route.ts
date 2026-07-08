import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getQuery, escalateQuery } from "@/lib/db/repos/queries";
import { getReviewByQuery } from "@/lib/db/repos/reviews";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const query = getQuery(params.id);
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
    const query = escalateQuery(params.id);
    if (!query) return NextResponse.json({ error: "Consulta no encontrada." }, { status: 404 });
    return NextResponse.json({ query });
  }

  return NextResponse.json({ error: "Accion no reconocida." }, { status: 400 });
}
