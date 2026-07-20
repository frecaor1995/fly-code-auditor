import { describe, it, expect } from "vitest";
import { authenticate, createSessionCookieValue, getSessionCookieName } from "@/lib/auth/session";
import { TEST_TECNICO } from "../fixtures/testUsers";

// "Autenticacion" esta explicitamente en el alcance de FASE M. getCurrentUser()
// necesita el contexto de request de Next (cookies() de next/headers) y ya
// se cubre indirectamente: mockeado en tests/integration/queriesRoute.test.ts
// y de forma conductual en tests/e2e/auth.spec.ts (login real, rutas
// protegidas). Aqui se cubre lo que SI es una funcion pura/aislada:
// authenticate() y el ida-y-vuelta de firma HMAC de la cookie de sesion.

describe("authenticate", () => {
  it("devuelve el usuario cuando el email y la contrasena son correctos", () => {
    const user = authenticate(TEST_TECNICO.email, TEST_TECNICO.password);
    expect(user?.id).toBe(TEST_TECNICO.id);
    expect(user?.role).toBe(TEST_TECNICO.role);
  });

  it("devuelve null con una contrasena incorrecta", () => {
    expect(authenticate(TEST_TECNICO.email, "contrasena-incorrecta")).toBeNull();
  });

  it("devuelve null con un email que no existe", () => {
    expect(authenticate("no-existe@flyelectric.com", TEST_TECNICO.password)).toBeNull();
  });

  it("nunca expone la contrasena en el objeto de error implicito (null no filtra nada)", () => {
    const result = authenticate(TEST_TECNICO.email, "cualquier-cosa");
    expect(result).toBeNull();
  });
});

describe("createSessionCookieValue / getSessionCookieName", () => {
  it("genera un valor de cookie con el formato userId.hmac", () => {
    const value = createSessionCookieValue(TEST_TECNICO.id);
    const [userId, hmac] = value.split(".");
    expect(userId).toBe(TEST_TECNICO.id);
    expect(hmac).toMatch(/^[0-9a-f]{64}$/); // sha256 hex digest
  });

  it("dos llamadas con el mismo userId producen el mismo HMAC (determinista, no depende de tiempo)", () => {
    expect(createSessionCookieValue(TEST_TECNICO.id)).toBe(createSessionCookieValue(TEST_TECNICO.id));
  });

  it("distintos userId producen distinto HMAC", () => {
    expect(createSessionCookieValue("u-a")).not.toBe(createSessionCookieValue("u-b"));
  });

  it("getSessionCookieName devuelve un nombre estable", () => {
    expect(getSessionCookieName()).toBe("fca_session");
  });
});
