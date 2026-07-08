import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createPlan, listPlans } from "@/lib/db/repos/plans";
import { saveUploadedFile } from "@/lib/storage/localFileStorage";

export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  return NextResponse.json({ plans: listPlans() });
}

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (!hasPermission(user.role, "plan.upload")) {
    return NextResponse.json({ error: "No tienes permiso para subir planos." }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const projectId = (form?.get("projectId") as string | null) ?? null;
  const sheet = (form?.get("sheet") as string | null) ?? undefined;

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Archivo requerido (PDF, JPG o PNG)." }, { status: 400 });
  }

  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isImage = file.type.startsWith("image/");
  if (!isPdf && !isImage) {
    return NextResponse.json({ error: "Formato no soportado. Usa PDF, JPG o PNG." }, { status: 400 });
  }

  const saved = await saveUploadedFile(file);

  const plan = createPlan({
    projectId,
    fileName: saved.fileName,
    fileUrl: saved.url,
    fileType: isPdf ? "pdf" : "image",
    sheet: sheet || undefined,
    uploadedBy: user.id
  });

  return NextResponse.json({ plan }, { status: 201 });
}
