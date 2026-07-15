import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getOfficialSources } from "@/lib/db/dbAdapter";

// Devuelve public.official_sources (ver supabase/official_sources.sql) para
// verificar que fuentes oficiales tiene configuradas la app. Requiere
// sesion iniciada, igual que el resto de las API routes de solo lectura
// (ver app/api/queries/route.ts GET).
export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const sources = await getOfficialSources();
  return NextResponse.json({ sources });
}
