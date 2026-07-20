import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

// FASE K: protecciones contra pruebas enganosas. Este archivo escanea TODO
// el codigo fuente de pruebas del repo (unit/integration/regression/e2e/
// live) en busca de patrones prohibidos. Se excluye a si mismo del escaneo
// (relative(...) !== ownRelativePath) para no autodetectarse por contener
// las cadenas ".only(" / ".skip(" / "expect(true).toBe(true)" dentro de sus
// propios patrones de busqueda.

const REPO_ROOT = join(__dirname, "..", "..", "..");
const TEST_DIRS = ["tests/unit", "tests/integration", "tests/regression", "tests/e2e", "tests/live"];
const OWN_PATH = relative(REPO_ROOT, __filename).replace(/\\/g, "/");

function listTestFiles(dir: string): string[] {
  const abs = join(REPO_ROOT, dir);
  let entries: string[];
  try {
    entries = readdirSync(abs);
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const entryAbs = join(abs, entry);
    const rel = `${dir}/${entry}`;
    if (statSync(entryAbs).isDirectory()) {
      files.push(...listTestFiles(rel));
    } else if (/\.(test|spec)\.(ts|tsx)$/.test(entry) || /\.setup\.ts$/.test(entry)) {
      files.push(rel);
    }
  }
  return files;
}

function readAllTestFiles(): { path: string; content: string }[] {
  const files = TEST_DIRS.flatMap(listTestFiles).filter((f) => f !== OWN_PATH);
  return files.map((f) => ({ path: f, content: readFileSync(join(REPO_ROOT, f), "utf8") }));
}

// Detecta ".only(" / ".skip(" como llamada de metodo real (it.only, test.only,
// describe.only, etc.), no como texto suelto dentro de un comentario o string
// que hable DEL patron (ej. este mismo archivo, ya excluido arriba).
const ONLY_PATTERN = /\.only\s*\(/;
const SKIP_PATTERN = /\.skip\s*\(/;
// Une "expect", espacio opcional, "(true)", espacio opcional, ".toBe(true)"
// para detectar el anti-patron exacto, sin falsos positivos sobre
// "expect(someRealCondition).toBe(true)" (una assertion real que evalua
// una condicion real, no un valor hardcodeado).
const FAKE_ASSERTION_PATTERN = /expect\s*\(\s*true\s*\)\s*\.toBe\s*\(\s*true\s*\)/;

describe("Higiene de pruebas (FASE K): sin .only, sin .skip sin justificar, sin assertions falsas", () => {
  const testFiles = readAllTestFiles();

  it("se encontraron archivos de prueba para escanear (el escaneo mismo no esta vacio)", () => {
    expect(testFiles.length).toBeGreaterThan(10);
  });

  it("ningun archivo de prueba usa .only (fallaria la suite completa por accidente en CI)", () => {
    const violations = testFiles.filter((f) => ONLY_PATTERN.test(f.content)).map((f) => f.path);
    expect(violations, `Archivos con .only(): ${violations.join(", ")}`).toEqual([]);
  });

  it("ningun archivo de prueba reemplaza una assertion real por expect(true).toBe(true)", () => {
    const violations = testFiles.filter((f) => FAKE_ASSERTION_PATTERN.test(f.content)).map((f) => f.path);
    expect(violations, `Archivos con expect(true).toBe(true): ${violations.join(", ")}`).toEqual([]);
  });

  it("reporta y valida cualquier uso de .skip: debe tener un comentario SKIP-JUSTIFIED en la linea anterior", () => {
    const report: { path: string; line: number; justified: boolean }[] = [];
    for (const file of testFiles) {
      const lines = file.content.split("\n");
      lines.forEach((line, idx) => {
        if (SKIP_PATTERN.test(line)) {
          const previousLine = lines[idx - 1] ?? "";
          const justified = previousLine.includes("SKIP-JUSTIFIED");
          report.push({ path: file.path, line: idx + 1, justified });
        }
      });
    }

    // "Comprobacion que reporte tests omitidos" (item explicito de FASE K):
    // siempre se imprime el reporte, incluso cuando esta vacio (confirma
    // que el escaneo corrio).
    // eslint-disable-next-line no-console
    console.log(`[test-hygiene] .skip() encontrados: ${report.length}`, report);

    const unjustified = report.filter((r) => !r.justified);
    expect(unjustified, `.skip() sin comentario SKIP-JUSTIFIED: ${JSON.stringify(unjustified)}`).toEqual([]);
  });
});
