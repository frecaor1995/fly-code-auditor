// "npm run test:live" (FASE H): solo debe ejecutarse cuando las 4 variables
// requeridas estan presentes. Este preflight corre ANTES de siquiera
// levantar Vitest, para que nunca haya un archivo de test usando
// it.skip/describe.skipIf condicionado a env vars (eso violaria la regla de
// FASE K de no usar .skip para esconder ejecucion condicional: aqui el
// "skip" ocurre a nivel de script npm, fuera de cualquier archivo de test).
const required = ["LIVE_TEST_BASE_URL", "LIVE_TEST_EMAIL", "LIVE_TEST_PASSWORD"];
const missing = required.filter((key) => !process.env[key]);
const allowed = process.env.ALLOW_LIVE_AI_TESTS === "true";

if (missing.length > 0 || !allowed) {
  console.log("[test:live] Suite live omitida: variables requeridas ausentes o ALLOW_LIVE_AI_TESTS != 'true'.");
  console.log(`[test:live] Faltantes: ${missing.length ? missing.join(", ") : "(ninguna)"}`);
  console.log(`[test:live] ALLOW_LIVE_AI_TESTS=${process.env.ALLOW_LIVE_AI_TESTS ?? "(no definida)"}`);
  process.exit(0);
}

const { spawnSync } = require("child_process");
const result = spawnSync("npx", ["vitest", "run", "--config", "vitest.live.config.ts"], {
  stdio: "inherit",
  shell: true
});
process.exit(result.status ?? 1);
