import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { setReviewDecision } from "@/lib/db/repos/reviews";

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

  const review = setReviewDecision(queryId, { status, comment, reviewedBy: user.id });
  return NextResponse.json({ review });
}
