import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured, getSupabaseServerClient } from "@/lib/db/supabaseServer";
import { isMockAiEnabled } from "@/lib/ai";
import { ELECTRICAL_KNOWLEDGE_BASE } from "@/lib/knowledge/electricalKnowledgeBase";
import { withTimeout } from "@/lib/utils/resilience";

// Diagnostico de las dos dependencias externas que puede usar
// app/api/queries/route.ts (Supabase, OpenAI) y del motor local de
// respaldo, para poder verificar en produccion por que una consulta cayo
// en un fallback sin tener que inspeccionar logs del servidor. Nunca
// revela ninguna clave: solo booleanos y metadatos no sensibles (host de
// Supabase no incluido a proposito; ver app/api/health/supabase/route.ts
// si se necesita ese detalle con sesion iniciada).
const HEALTH_TIMEOUT_MS = 5000;

export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const supabaseConfigured = isSupabaseConfigured();
  let supabaseReadable = false;
  if (supabaseConfigured) {
    try {
      const supabase = getSupabaseServerClient();
      const { error } = await withTimeout(
        Promise.resolve(supabase.from("knowledge_entries").select("id").limit(1)),
        HEALTH_TIMEOUT_MS,
        "health:supabase-read"
      );
      supabaseReadable = !error;
    } catch (error) {
      console.error("[health:query-engine:supabase]", error);
      supabaseReadable = false;
    }
  }

  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY);
  let openaiReachable = false;
  if (openaiConfigured) {
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      await withTimeout(client.models.list(), HEALTH_TIMEOUT_MS, "health:openai");
      openaiReachable = true;
    } catch (error) {
      console.error("[health:query-engine:openai]", error);
      openaiReachable = false;
    }
  }

  const mockEnabled = isMockAiEnabled();
  const selectedModel = mockEnabled ? "mock (local engine)" : process.env.OPENAI_MODEL || "gpt-4o";

  // El motor local (lib/ai/mockAssistant.ts + lib/knowledge/electricalKnowledgeBase.ts
  // + lib/ai/localFallback.ts) no depende de red: se considera disponible
  // si el bundle cargo con al menos una entrada en la base electrica.
  const localFallbackAvailable = ELECTRICAL_KNOWLEDGE_BASE.length > 0;

  return NextResponse.json({
    supabaseConfigured,
    supabaseReadable,
    openaiConfigured,
    openaiReachable,
    selectedModel,
    mockEnabled,
    localFallbackAvailable,
    queryRouteOperational: true
  });
}
