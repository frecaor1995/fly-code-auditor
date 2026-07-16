import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured, getSupabaseServerClient } from "@/lib/db/supabaseServer";
import { isMockAiEnabled } from "@/lib/ai";
import { ELECTRICAL_KNOWLEDGE_BASE } from "@/lib/knowledge/electricalKnowledgeBase";
import { withTimeout, safeErrorMessage } from "@/lib/utils/resilience";

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
  const openaiModel = process.env.OPENAI_MODEL || "gpt-4o";

  // Diagnostico real: NUNCA se marca openaiReachable:true solo porque la
  // API key existe. Se ejecuta una llamada de chat completions real y
  // minima (max_tokens=1) contra el modelo configurado, que confirma
  // autenticacion, validez del modelo y disponibilidad del servicio en un
  // solo request. status/code/message vienen del error real de la libreria
  // OpenAI (nunca se expone la API key: solo esos 3 campos + el modelo).
  let openaiReachable = false;
  let openaiDiagnostics: { status: string; code: string | null; model: string; message: string | null } = {
    status: "not_configured",
    code: null,
    model: openaiModel,
    message: null
  };

  if (openaiConfigured) {
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await withTimeout(
        client.chat.completions.create({
          model: openaiModel,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1
        }),
        HEALTH_TIMEOUT_MS,
        "health:openai"
      );
      openaiReachable = Boolean(completion?.id);
      openaiDiagnostics = { status: "ok", code: null, model: openaiModel, message: null };
    } catch (error) {
      console.error("[health:query-engine:openai]", error);
      openaiReachable = false;
      const apiError = error as { status?: number; code?: string | null };
      openaiDiagnostics = {
        status: apiError?.status ? String(apiError.status) : "error",
        code: apiError?.code ?? null,
        model: openaiModel,
        message: safeErrorMessage(error, "OpenAI no respondio.")
      };
    }
  }

  const mockEnabled = isMockAiEnabled();
  const selectedModel = mockEnabled ? "mock (local engine)" : openaiModel;

  // El motor local (lib/ai/mockAssistant.ts + lib/knowledge/electricalKnowledgeBase.ts
  // + lib/ai/localFallback.ts) no depende de red: se considera disponible
  // si el bundle cargo con al menos una entrada en la base electrica.
  const localFallbackAvailable = ELECTRICAL_KNOWLEDGE_BASE.length > 0;

  return NextResponse.json({
    supabaseConfigured,
    supabaseReadable,
    openaiConfigured,
    openaiReachable,
    openaiDiagnostics,
    selectedModel,
    mockEnabled,
    localFallbackAvailable,
    queryRouteOperational: true
  });
}
