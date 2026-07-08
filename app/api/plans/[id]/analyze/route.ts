import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getPlan, setPlanAnalysisSummary } from "@/lib/db/repos/plans";
import { createQuery } from "@/lib/db/repos/queries";
import { analyzePlan } from "@/lib/ai";
import { readUploadedFile } from "@/lib/storage/localFileStorage";
import type { Language } from "@/lib/db/types";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (!hasPermission(user.role, "plan.analyze")) {
    return NextResponse.json({ error: "No tienes permiso para analizar planos." }, { status: 403 });
  }

  const plan = getPlan(params.id);
  if (!plan) return NextResponse.json({ error: "Plano no encontrado." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const question = (body?.question as string) || "Resume este plano electrico.";
  const language = (body?.language as Language) ?? user.preferredLanguage;

  let imageBase64: string | undefined;
  if (plan.fileType === "image" && process.env.USE_MOCK_AI === "false") {
    const storedName = plan.fileUrl.split("/").pop() as string;
    const buffer = readUploadedFile(storedName);
    if (buffer) imageBase64 = buffer.toString("base64");
  }

  const response = await analyzePlan({
    question,
    language,
    fileName: plan.fileName,
    fileType: plan.fileType,
    sheet: plan.sheet,
    imageBase64
  });

  const query = createQuery({
    projectId: plan.projectId,
    planId: plan.id,
    userId: user.id,
    mode: "texto",
    language,
    question,
    response
  });

  setPlanAnalysisSummary(plan.id, response.shortAnswer);

  return NextResponse.json({ query }, { status: 201 });
}
