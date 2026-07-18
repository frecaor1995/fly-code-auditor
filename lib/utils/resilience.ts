// Utilidades compartidas para que ninguna llamada a un servicio externo
// (Supabase, OpenAI, Gemini) pueda colgar una funcion serverless
// indefinidamente. Usadas por app/api/queries/route.ts,
// app/api/health/query-engine/route.ts, app/api/health/ai-providers/route.ts
// y lib/ai/providers/*.

// Error con .code="timeout" (en vez de un Error generico) para que
// classifyProviderError/quien capture el error de mas arriba pueda
// distinguir "el proveedor tardo demasiado" de un error real de la API
// (401/403/429/etc).
export class TimeoutError extends Error {
  code = "timeout";
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(`Tiempo de espera agotado (${label} > ${ms}ms).`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

// Solo expone error.message (nunca el objeto de error crudo): las librerias
// cliente de Supabase/OpenAI nunca ponen API keys ahi, pero el objeto
// completo si puede traer headers/config internos que no deben salir en una
// respuesta HTTP.
export function safeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

// Diagnostico estructurado de un error de CUALQUIER proveedor de IA
// (libreria OpenAI, fetch crudo a Gemini, withTimeout, JSON.parse
// envueltos alrededor de esa llamada). NUNCA incluye la API key: ninguno de
// los proveedores la pone en status/code/type/message, y de todas formas
// solo se leen esos 4 campos puntuales del objeto de error, nunca el
// objeto completo ni sus headers.
export interface ProviderErrorDiagnostics {
  status: number | null;
  code: string | null;
  type: string | null;
  message: string;
}

export function classifyProviderError(error: unknown): ProviderErrorDiagnostics {
  const apiError = error as { status?: number; code?: string | null; type?: string | null; message?: string };
  return {
    status: typeof apiError?.status === "number" ? apiError.status : null,
    code: apiError?.code ?? (error instanceof Error && error.name === "TimeoutError" ? "timeout" : null),
    type: apiError?.type ?? null,
    message: safeErrorMessage(error, "El proveedor de IA no respondio.")
  };
}
