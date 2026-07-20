import { test as setup, expect } from "@playwright/test";

// Usuario demo ya versionado en data/users.json (no es una cuenta personal
// ni una credencial nueva agregada por esta suite; ver
// tests/fixtures/testUsers.ts para el equivalente usado en Vitest).
const TEST_EMAIL = "tecnico@flyelectric.com";
const TEST_PASSWORD = "demo1234";

const authFile = "playwright/.auth/tecnico.json";

// Inicia sesion UNA vez via la UI real de login y guarda el storageState
// (cookie de sesion HMAC) para que el resto de los specs (excepto
// auth.spec.ts, que prueba el login en si) arranquen ya autenticados.
setup("autenticar usuario de prueba", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("tecnico@flyelectric.com").fill(TEST_EMAIL);
  await page.getByPlaceholder("demo1234").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /Entrar/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.context().storageState({ path: authFile });
});
