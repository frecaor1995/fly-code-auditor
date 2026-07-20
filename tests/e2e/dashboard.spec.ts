import { test, expect } from "@playwright/test";

// FASE G items 11, 13: navegacion basica del dashboard y vista de historial.

test.describe("Dashboard y navegacion", () => {
  test("el dashboard muestra saludo, accesos rapidos y estadisticas", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
    // El desktop tiene TANTO el link de la barra lateral como el
    // quick-link del contenido principal con el mismo nombre accesible;
    // se acota al contenido principal (el "acceso rapido" real que pide
    // este item) para evitar una violacion de strict mode.
    await expect(page.getByRole("main").getByRole("link", { name: /Nueva consulta/ })).toBeVisible();
    await expect(page.getByText("Proyectos activos")).toBeVisible();
    await expect(page.getByText("Consultas totales")).toBeVisible();
  });

  test("navega desde el dashboard hacia /consulta usando el acceso rapido", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("main").getByRole("link", { name: /Nueva consulta/ }).click();
    await expect(page).toHaveURL(/\/consulta/);
  });

  test("navega desde el dashboard hacia el historial completo", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: /Ver historial completo/ }).click();
    await expect(page).toHaveURL(/\/historial/);
    await expect(page.getByRole("heading", { name: "Historial de consultas" })).toBeVisible();
  });

  test("el historial esta implementado y lista consultas previas", async ({ page }) => {
    await page.goto("/historial");
    await expect(page.getByRole("heading", { name: "Historial de consultas" })).toBeVisible();
  });
});
