import { NextRequest } from "next/server";

// "signal" se omite deliberadamente: el RequestInit global de lib.dom
// permite "AbortSignal | null", pero el RequestInit que espera el
// constructor de NextRequest solo admite "AbortSignal | undefined". Ningun
// test de este proyecto necesita pasar un AbortSignal, asi que se excluye
// del tipo en vez de forzar un cast inseguro.
type TestRequestInit = Omit<RequestInit, "signal">;

// Construye un NextRequest real para invocar un route handler de App Router
// directamente (sin levantar un servidor HTTP), como recomienda Next.js
// para tests de integracion de app/api/**/route.ts.
export function buildJsonRequest(url: string, body: unknown, init: TestRequestInit = {}): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    body: JSON.stringify(body),
    ...init
  });
}

export function buildGetRequest(url: string, init: TestRequestInit = {}): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), { method: "GET", ...init });
}
