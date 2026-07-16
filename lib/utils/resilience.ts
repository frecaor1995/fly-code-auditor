// Utilidades compartidas para que ninguna llamada a un servicio externo
// (Supabase, OpenAI) pueda colgar una funcion serverless indefinidamente.
// Usadas por app/api/queries/route.ts y app/api/health/query-engine/route.ts.

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Tiempo de espera agotado (${label} > ${ms}ms).`)), ms);
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
