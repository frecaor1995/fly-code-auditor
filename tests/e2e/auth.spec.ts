import { test, expect } from "@playwright/test";

// FASE G items 1-2: abrir login, iniciar sesion con usuario de prueba.
// Este archivo arranca SIN el storageState autenticado del proyecto (a
// diferencia del resto de los specs) para poder probar el flujo de login
// real de principio a fin.
test.use({ storageState: { cookies: [], origins: [] } });

const TEST_EMAIL = "tecnico@flyelectric.com";
const TEST_PASSWORD = "demo1234";

test.describe("Login", () => {
  test("abre la pagina de login y muestra el formulario", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Fly Code Auditor" })).toBeVisible();
    await expect(page.getByPlaceholder("tecnico@flyelectric.com")).toBeVisible();
    await expect(page.getByPlaceholder("demo1234")).toBeVisible();
  });

  test("inicia sesion con un usuario de prueba valido y redirige al dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("tecnico@flyelectric.com").fill(TEST_EMAIL);
    await page.getByPlaceholder("demo1234").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /Entrar/ }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
  });

  test("credenciales invalidas muestran un error y NO redirigen", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("tecnico@flyelectric.com").fill("tecnico@flyelectric.com");
    await page.getByPlaceholder("demo1234").fill("password-incorrecto");
    await page.getByRole("button", { name: /Entrar/ }).click();
    await expect(page.getByText(/incorrect/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  // Regresion: estas 4 rutas usaban "getCurrentUser()!" (asumian que el
  // layout siempre redirige antes de que la pagina corra su propio codigo).
  // Sin sesion, eso producia un TypeError sin manejar en el servidor
  // ("Cannot read properties of null (reading 'name')"), detectado
  // precisamente por esta prueba durante la corrida real de la suite E2E.
  // Ahora las 4 paginas tienen su propio guard explicito (ver
  // app/(app)/dashboard/page.tsx, configuracion/page.tsx, planos/page.tsx,
  // planos/[id]/page.tsx). Esta prueba confirma que las 4 redirigen limpio.
  for (const protectedPath of ["/dashboard", "/configuracion", "/planos", "/planos/00000000-0000-0000-0000-000000000000"]) {
    test(`ruta protegida sin sesion redirige a /login: ${protectedPath}`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("pageerror", (err) => consoleErrors.push(err.message));

      await page.goto(protectedPath);
      await expect(page).toHaveURL(/\/login/);
      expect(consoleErrors).toEqual([]);
    });
  }
});
