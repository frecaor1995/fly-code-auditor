// "npm run quality" debe correr lint SOLO "si existe" (paso 1 de FASE B).
// Este proyecto no tiene ESLint instalado ni configurado (no hay
// .eslintrc*/eslint.config.* ni el paquete "eslint" en node_modules):
// "next lint" sin eso intenta un setup interactivo, que se cuelga o falla
// en un runner no interactivo como CI.
//
// En vez de instalar/configurar ESLint (fuera del alcance de esta tarea de
// testing/QA) o silenciar un fallo real con "|| true" (lo que ocultaria un
// fallo de lint real el dia que si se configure), este script detecta si
// hay una configuracion real ANTES de decidir:
//   - Si "eslint" esta instalado Y existe un archivo de config: corre
//     "next lint" de verdad y propaga su exit code.
//   - Si no: imprime un mensaje claro y sale con codigo 0 (paso omitido,
//     no fallido).
const { existsSync } = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const CONFIG_CANDIDATES = [
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".eslintrc.yml",
  ".eslintrc.yaml",
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs"
];

function eslintIsInstalled() {
  try {
    require.resolve("eslint", { paths: [process.cwd()] });
    return true;
  } catch {
    return false;
  }
}

function hasConfigFile() {
  return CONFIG_CANDIDATES.some((file) => existsSync(path.join(process.cwd(), file)));
}

if (!eslintIsInstalled() || !hasConfigFile()) {
  console.log("[quality:lint] ESLint no esta instalado/configurado en este proyecto; se omite el paso de lint.");
  process.exit(0);
}

const result = spawnSync("npx", ["next", "lint"], { stdio: "inherit", shell: true });
process.exit(result.status ?? 1);
