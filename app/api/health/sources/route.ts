import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getOfficialSources } from "@/lib/db/dbAdapter";

// Diagnostico rapido de public.official_sources: cuantas fuentes hay
// configuradas y si las 3 fuentes criticas (NFPA/NEC, TDLR, Houston AHJ)
// estan presentes, sin exponer el contenido completo del catalogo (para
// eso esta GET /api/sources). Requiere sesion iniciada, igual que
// app/api/health/supabase/route.ts.
export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const sources = await getOfficialSources();

  const hasNfpaSource = sources.some(
    (s) => s.sourceType === "nec" || s.sourceType === "nfpa_free_access" || s.sourceType === "nfpa_link"
  );
  const hasTdlrSource = sources.some((s) => s.sourceType === "tdlr" || s.sourceType === "tdlr_rules");
  const hasHoustonAhjSource = sources.some((s) => s.sourceType.startsWith("houston"));

  const lastCheckedAt = sources.reduce<string | null>((latest, s) => {
    if (!s.lastCheckedAt) return latest;
    if (!latest || s.lastCheckedAt > latest) return s.lastCheckedAt;
    return latest;
  }, null);

  return NextResponse.json({
    totalOfficialSources: sources.length,
    nfpaSourcePresent: hasNfpaSource,
    tdlrSourcePresent: hasTdlrSource,
    houstonAhjSourcePresent: hasHoustonAhjSource,
    lastCheckedAt
  });
}
