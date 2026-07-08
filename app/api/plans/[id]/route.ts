import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getPlan } from "@/lib/db/repos/plans";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const plan = getPlan(params.id);
  if (!plan) return NextResponse.json({ error: "Plano no encontrado." }, { status: 404 });

  return NextResponse.json({ plan });
}
