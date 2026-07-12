import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createReview } from "@/lib/db/dbAdapter";

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (!hasPermission(user.role, "review.decide")) {
    return NextResponse.json({ error: "Solo el Master Electrician o Admin puede decidir revisiones." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const queryId = body?.queryId as string | undefined;
  const status = body?.status as "approved" | "needs_changes" | undefined;
  const comment = (body?.comment as string | undefined) ?? "";

  if (!queryId || !status) {
    return NextResponse.json({ error: "queryId y status son requeridos." }, { status: 400 });
  }

  try {
    const review = await createReview({ queryId, reviewedBy: user.id, status, comments: comment });
    return NextResponse.json({ review });
  } catch (error) {
    console.error("[api/reviews] Error guardando la revision:", error);
    return NextResponse.json({ error: "No se pudo guardar la revision en la base de datos." }, { status: 500 });
  }
}
