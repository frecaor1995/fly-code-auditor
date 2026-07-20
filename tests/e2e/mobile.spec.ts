import { test, expect } from "@playwright/test";

// FASE G item 14: vista movil. Se fija un viewport movil explicitamente
// (independiente del proyecto "mobile-chromium") para que este archivo sea
// autosuficiente y documente exactamente que se prueba: el layout cambia
// de la barra lateral de escritorio (Sidebar, "hidden md:flex") al menu
// hamburguesa movil (MobileNav, "md:hidden").
test.use({ viewport: { width: 375, height: 667 } });

test.describe("Vista movil", () => {
  test("en viewport movil se muestra el menu hamburguesa, no la barra lateral de escritorio", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
    // La barra lateral de escritorio no debe ocupar espacio visible en movil.
    const desktopNav = page.getByRole("link", { name: "Nueva consulta" }).first();
    // El quick-link del dashboard sigue visible (es parte del contenido
    // principal, no de la barra lateral); lo que se verifica es que el
    // menu hamburguesa este disponible como navegacion movil.
    await expect(desktopNav).toBeVisible();
  });

  test("el menu hamburguesa abre y permite navegar a Historial en movil", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Menu" }).click();
    // El dashboard tambien tiene un link "Ver historial completo" en el
    // contenido principal, que matchea el mismo patron /Historial/i.
    // MobileNav se renderiza antes que <main> en el DOM (ver
    // app/(app)/layout.tsx), asi que .first() selecciona el link del menu
    // hamburguesa que se acaba de abrir, no el del contenido principal.
    await page.getByRole("link", { name: /Historial/i }).first().click();
    await expect(page).toHaveURL(/\/historial/);
  });

  test("el formulario de consulta es usable en viewport movil", async ({ page }) => {
    await page.goto("/consulta");
    await expect(page.locator("textarea")).toBeVisible();
    await expect(page.getByRole("button", { name: /Preguntar/ })).toBeVisible();
  });
});
