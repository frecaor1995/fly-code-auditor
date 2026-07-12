import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente Supabase SOLO para uso server-side (API routes y Server
// Components). Usa la service role key, que tiene permisos completos sobre
// las tablas y NUNCA debe llegar al bundle del cliente.
//
// Este modulo lee variables de entorno SIN el prefijo NEXT_PUBLIC_, que es
// justamente lo que evita que Next.js las incluya en el JavaScript que se
// envia al navegador. Por eso:
// - NUNCA importar este archivo desde un componente "use client".
// - NUNCA reexportar SUPABASE_SERVICE_ROLE_KEY ni el cliente hacia el cliente.
// - Toda lectura/escritura que use este cliente debe pasar por Server
//   Components o API routes (app/api/**), nunca por fetch directo desde el
//   navegador a Supabase.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

let cachedClient: SupabaseClient | null = null;

// Lanza si Supabase no esta configurado: los callers (lib/db/dbAdapter.ts)
// siempre deben verificar isSupabaseConfigured() antes de llamar a esta
// funcion, y degradar a la base local si no lo esta, en vez de dejar que
// esta excepcion rompa una peticion.
export function getSupabaseServerClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase no esta configurado: define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor."
    );
  }
  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return cachedClient;
}
