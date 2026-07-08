import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { readUploadedFile } from "@/lib/storage/localFileStorage";

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg"
};

export async function GET(_req: NextRequest, { params }: { params: { filename: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const buffer = readUploadedFile(params.filename);
  if (!buffer) return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });

  const ext = params.filename.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": contentType }
  });
}
