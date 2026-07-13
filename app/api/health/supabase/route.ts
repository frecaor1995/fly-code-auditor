import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured, getSupabaseServerClient } from "@/lib/db/supabaseServer";

// Diagnostico de la conexion a Supabase: prueba una lectura y un insert
// real (con limpieza inmediata) contra public.queries, sin mostrar nunca
// las claves. Requiere sesion iniciada (cualquier usuario) para evitar que
// quede abierto a internet como un endpoint que escribe en la base de datos.
// Diagnostico de SUPABASE_URL: SOLO metadatos derivados (host, pathname,
// longitud, si empieza con https, si termina en .supabase.co, y un preview
// parcial de 15+15 caracteres). SUPABASE_SERVICE_ROLE_KEY nunca se lee para
// diagnostico mas alla de Boolean(...) (presente/ausente) en ningun punto
// de este archivo.
function diagnoseSupabaseUrl(rawUrl: string) {
  let host: string | null = null;
  let pathname: string | null = null;
  try {
    if (rawUrl) {
      const parsed = new URL(rawUrl);
      host = parsed.host;
      pathname = parsed.pathname;
    }
  } catch {
    // URL invalida/malformada: se deja host/pathname en null sin romper el
    // endpoint, el resto de los campos (length, startsWith, etc.) igual
    // ayudan a diagnosticar que esta mal.
  }

  return {
    supabaseUrlHost: host,
    supabaseUrlPathname: pathname,
    supabaseUrlStartsWithHttps: rawUrl.startsWith("https://"),
    supabaseUrlEndsWithSupabaseCo: rawUrl.endsWith(".supabase.co"),
    supabaseUrlLength: rawUrl.length,
    rawSupabaseUrlPreview: rawUrl ? `${rawUrl.slice(0, 15)}...${rawUrl.slice(-15)}` : null
  };
}

export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const rawSupabaseUrl = process.env.SUPABASE_URL ?? "";
  const supabaseUrlPresent = Boolean(rawSupabaseUrl);
  const serviceRolePresent = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const urlDiagnosis = diagnoseSupabaseUrl(rawSupabaseUrl);

  let canReadQueries = false;
  let canInsertQueries = false;
  let error: string | null = null;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: false,
      supabaseUrlPresent,
      serviceRolePresent,
      canReadQueries,
      canInsertQueries,
      error: "Supabase no esta configurado: faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY.",
      ...urlDiagnosis
    });
  }

  try {
    const supabase = getSupabaseServerClient();

    const readResult = await supabase.from("queries").select("id").limit(1);
    if (readResult.error) throw readResult.error;
    canReadQueries = true;

    // Insert real (no simulado), con el mismo payload completo + columnas
    // opcionales que usa lib/db/dbAdapter.ts#createQuery, reintentando con
    // el set base de columnas si la tabla no tiene las opcionales. Se borra
    // la fila de prueba inmediatamente para no ensuciar el historial real.
    const fullPayload = {
      project_id: null,
      user_email: null,
      question: "[health-check] prueba de diagnostico automatica",
      answer: JSON.stringify({
        shortAnswer: "health-check",
        riskLevel: "bajo",
        codeReference: "",
        checklist: [],
        missingQuestions: [],
        recommendation: "",
        warning: ""
      }),
      language_mode: "es",
      language: "es",
      risk_level: "low",
      category: "health_check",
      source_used: "app/api/health/supabase/route.ts",
      saved_to_db: true,
      error_message: null
    };
    const corePayload = {
      project_id: fullPayload.project_id,
      user_email: fullPayload.user_email,
      question: fullPayload.question,
      answer: fullPayload.answer,
      language_mode: fullPayload.language_mode,
      risk_level: fullPayload.risk_level
    };

    let insertResult = await supabase.from("queries").insert(fullPayload).select("id").single();
    const isMissingColumn =
      insertResult.error?.code === "PGRST204" ||
      insertResult.error?.code === "42703" ||
      (insertResult.error?.message ?? "").toLowerCase().includes("column");
    if (insertResult.error && isMissingColumn) {
      insertResult = await supabase.from("queries").insert(corePayload).select("id").single();
    }
    if (insertResult.error) throw insertResult.error;
    canInsertQueries = true;

    if (insertResult.data?.id) {
      const { error: deleteError } = await supabase.from("queries").delete().eq("id", insertResult.data.id);
      if (deleteError) {
        console.error("[api/health/supabase] No se pudo borrar la fila de prueba:", {
          code: deleteError.code,
          message: deleteError.message,
          details: deleteError.details,
          hint: deleteError.hint
        });
      }
    }
  } catch (err) {
    const pgError = err as { code?: string; message?: string; details?: string; hint?: string };
    error = pgError.message ?? "Error desconocido al probar Supabase.";
    console.error("[api/health/supabase] Error probando Supabase:", {
      code: pgError.code,
      message: pgError.message,
      details: pgError.details,
      hint: pgError.hint
    });
  }

  return NextResponse.json({
    ok: canReadQueries && canInsertQueries,
    supabaseUrlPresent,
    serviceRolePresent,
    canReadQueries,
    canInsertQueries,
    error,
    ...urlDiagnosis
  });
}
