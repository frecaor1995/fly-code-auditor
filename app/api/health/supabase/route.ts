import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured, getSupabaseServerClient } from "@/lib/db/supabaseServer";

// Diagnostico de la conexion a Supabase: prueba una lectura y un insert
// real (con limpieza inmediata) contra public.queries, sin mostrar nunca
// las claves. Requiere sesion iniciada (cualquier usuario) para evitar que
// quede abierto a internet como un endpoint que escribe en la base de datos.
export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const supabaseUrlPresent = Boolean(process.env.SUPABASE_URL);
  const serviceRolePresent = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

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
      error: "Supabase no esta configurado: faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY."
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
    error
  });
}
