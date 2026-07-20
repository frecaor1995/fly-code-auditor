import { test, expect } from "@playwright/test";

// FASE G items 3-10, 12. Corre autenticado (storageState de
// tests/e2e/auth.setup.ts). El servidor de este entorno E2E tiene
// AI_PROVIDER=gemini SIN GEMINI_API_KEY (ver playwright.config.ts): CADA
// consulta tecnica real cae al fallback local de forma determinista, sin
// ninguna llamada de red saliente a Gemini/OpenAI/Supabase. Eso cubre el
// item 9 ("fallback simulado") de forma natural en todos los tests, no
// solo en uno dedicado.

const TECHNICAL_QUESTION = "necesito proteccion gfci en el bano cerca del fregadero";

test.describe("Consulta tecnica", () => {
  test("abre /consulta y muestra el formulario", async ({ page }) => {
    await page.goto("/consulta");
    await expect(page.locator("textarea")).toBeVisible();
    await expect(page.getByRole("button", { name: /Preguntar|Ask/ })).toBeVisible();
  });

  test("envia una consulta tecnica y muestra un indicador de carga mientras espera", async ({ page }) => {
    // Retrasa deliberadamente la respuesta real (sin alterar su contenido)
    // para poder observar el estado de carga de forma deterministica, sin
    // depender de que la red sea "lo bastante lenta" por casualidad.
    await page.route("**/api/queries", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.continue();
    });

    await page.goto("/consulta");
    await page.locator("textarea").fill(TECHNICAL_QUESTION);
    const submitButton = page.getByRole("button", { name: /Preguntar|Ask|\.\.\./ });
    await submitButton.click();
    await expect(submitButton).toHaveText("...");
    await expect(page.getByRole("heading", { name: "1. Respuesta corta" })).toBeVisible({ timeout: 10000 });
  });

  test("envia una consulta tecnica y ve la respuesta con trazabilidad del proveedor", async ({ page }) => {
    await page.goto("/consulta");
    await page.locator("textarea").fill(TECHNICAL_QUESTION);
    await page.getByRole("button", { name: /Preguntar/ }).click();

    await expect(page.getByRole("heading", { name: "1. Respuesta corta" })).toBeVisible({ timeout: 10000 });

    // Trazabilidad del proveedor (item 7): Gemini aparece como
    // seleccionado/intentado (fue honesto sobre el intento), pero la
    // respuesta la genero el motor tecnico local, NUNCA Gemini como autor
    // (sin GEMINI_API_KEY en este entorno, esto es el flujo real, no un
    // mock de UI).
    await expect(page.getByText("Proveedor seleccionado:")).toBeVisible();
    await expect(page.getByText("Gemini", { exact: true })).toBeVisible();
    await expect(page.getByText("Respuesta generada por:")).toBeVisible();
    // exact:true porque "Motor tecnico local" tambien aparece como
    // substring dentro del aviso informativo y de la nota de fallback
    // validado; esto apunta puntualmente al valor del campo de metadata.
    await expect(page.getByText("Motor tecnico local", { exact: true })).toBeVisible();
    await expect(page.getByText("Fallback validado", { exact: true })).toBeVisible();
  });

  test("cambia el idioma a ingles y la respuesta se genera en ingles", async ({ page }) => {
    await page.goto("/consulta");
    await page.getByRole("button", { name: "English" }).click();
    await page.locator("textarea").fill(TECHNICAL_QUESTION);
    await page.getByRole("button", { name: /Ask/ }).click();

    await expect(page.getByRole("heading", { name: "1. Short answer" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("gfci", { exact: false }).first()).toBeVisible();
  });

  test("cambia el idioma a bilingue y muestra ambos idiomas simultaneamente", async ({ page }) => {
    await page.goto("/consulta");
    await page.getByRole("button", { name: "Bilingue" }).click();
    await page.locator("textarea").fill(TECHNICAL_QUESTION);
    await page.getByRole("button", { name: /Preguntar/ }).click();

    await expect(page.getByRole("heading", { name: "1. Respuesta corta" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { name: "English summary" })).toBeVisible();
  });

  test("un error del servidor (sin conexion) muestra un fallback local, nunca una pantalla vacia", async ({ page }) => {
    // Simula una caida total de red hacia /api/queries (no una llamada real
    // a Gemini/OpenAI): el fetch del navegador falla por completo.
    await page.route("**/api/queries", (route) => route.abort());

    await page.goto("/consulta");
    await page.locator("textarea").fill(TECHNICAL_QUESTION);
    await page.getByRole("button", { name: /Preguntar/ }).click();

    await expect(page.getByText(/no se pudo conectar con el servidor/i)).toBeVisible({ timeout: 10000 });
    // Aun con el servidor inalcanzable, la UI siempre muestra un panel de
    // respuesta (modo local, "Sin informacion verificable"), nunca deja la
    // pantalla en blanco.
    await expect(page.getByText(/sin informacion verificable/i)).toBeVisible();
  });

  test("la respuesta persistida conserva la metadata de proveedor en el historial", async ({ page }) => {
    const uniqueQuestion = `necesito proteccion gfci en el bano, marca e2e ${Date.now()}`;
    await page.goto("/consulta");
    await page.locator("textarea").fill(uniqueQuestion);
    await page.getByRole("button", { name: /Preguntar/ }).click();
    await expect(page.getByRole("heading", { name: "1. Respuesta corta" })).toBeVisible({ timeout: 10000 });

    await page.goto("/historial");
    await page.getByText(uniqueQuestion, { exact: false }).first().click();

    await expect(page.getByRole("heading", { name: "Detalle de consulta" })).toBeVisible();
    await expect(page.getByText("Proveedor seleccionado:")).toBeVisible();
    await expect(page.getByText("Respuesta generada por:")).toBeVisible();
    await expect(page.getByText("Motor tecnico local")).toBeVisible();
  });
});
