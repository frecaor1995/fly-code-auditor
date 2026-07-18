import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getGeminiModel, isGeminiConfigured, pingGemini } from "@/lib/ai/providers/geminiProvider";
import { ELECTRICAL_KNOWLEDGE_BASE } from "@/lib/knowledge/electricalKnowledgeBase";

// Diagnostico del proveedor de IA seleccionado (AI_PROVIDER) para
// app/api/queries/route.ts. geminiReachable SIEMPRE viene de una llamada
// real minima a generateContent (ver pingGemini en geminiProvider.ts):
// nunca se marca true solo porque GEMINI_API_KEY existe. Nunca revela
// ninguna clave.
export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const selectedProvider = (process.env.AI_PROVIDER || "").trim().toLowerCase() || "unset";
  const geminiConfigured = isGeminiConfigured();
  const geminiModel = getGeminiModel();

  let geminiReachable = false;
  if (geminiConfigured) {
    const ping = await pingGemini();
    geminiReachable = ping.ok;
    if (!ping.ok) {
      console.error("[health:ai-providers:gemini]", { code: ping.code, message: ping.message, model: geminiModel });
    }
  }

  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY);

  // El motor local (lib/ai/mockAssistant.ts + lib/knowledge/electricalKnowledgeBase.ts
  // + lib/ai/localFallback.ts) no depende de red: se considera disponible
  // si el bundle cargo con al menos una entrada en la base electrica.
  const localFallbackAvailable = ELECTRICAL_KNOWLEDGE_BASE.length > 0;

  return NextResponse.json({
    selectedProvider,
    geminiConfigured,
    geminiReachable,
    geminiModel,
    openaiConfigured,
    localFallbackAvailable
  });
}
