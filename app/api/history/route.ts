import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getQueries } from "@/lib/db/dbAdapter";

// Historial de consultas leido desde Supabase (via lib/db/dbAdapter.ts), con
// degradacion automatica a los datos locales si Supabase no esta
// configurado o falla. Las pantallas de Historial/Dashboard/Reportes son
// Server Components y llaman a dbAdapter directamente (no a este endpoint);
// esta ruta queda disponible para cualquier consumidor client-side que
// necesite el mismo historial via fetch.
export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  return NextResponse.json({ queries: await getQueries() });
}
