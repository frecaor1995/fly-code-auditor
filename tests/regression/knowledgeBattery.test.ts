import { describe, it, expect } from "vitest";
import { ELECTRICAL_KNOWLEDGE_BASE, findKnowledgeBaseMatch, normalizeForMatch } from "@/lib/knowledge/electricalKnowledgeBase";
import { mockAskAssistant } from "@/lib/ai/mockAssistant";
import { synonymsOf, pluralVariants, flexiblePhraseMatch, tokenize, STOPWORDS, rootOf } from "@/lib/knowledge/textNormalization";
import { KNOWN_56 } from "../fixtures/knowledgeBattery/known56";
import { NEW_26 } from "../fixtures/knowledgeBattery/new26";
import { FROZEN_42 } from "../fixtures/knowledgeBattery/frozen42";
import type { KnowledgeBatteryCase } from "../fixtures/knowledgeBattery/types";

// Guardrail de regresion permanente para el motor de conocimiento (Sprint 3,
// verificacion documental). Ejecuta las 3 baterias completas (conocida 56 /
// nueva 26 / congelada 42) contra el codigo REAL de produccion
// (findKnowledgeBaseMatch / mockAskAssistant, ambos importados sin mocks) y
// reproduce los totales de la auditoria: 51/56, 18/26, 30/42, con 0 falsos
// positivos.
//
// "entrada obtenida", "score", "util" y "falso positivo" se CALCULAN aqui en
// cada corrida (no se leen de datos congelados en el fixture): asi el
// resultado siempre refleja el estado actual del codigo, no una foto vieja.
//
// Nota sobre "score": findKnowledgeBaseMatch (funcion real, exportada) es la
// UNICA fuente de verdad para "entrada obtenida" y, via mockAskAssistant,
// para "util". El numero de "score" es solo informativo para el reporte por
// pregunta; se calcula con una replica de solo-lectura del algoritmo real de
// lib/knowledge/matchEngine.ts#scoreEntry (que no se modifica ni se exporta
// para no alterar produccion). Si esta replica alguna vez diverge del motor
// real, los totales de useful/falsePositive (que SI usan las funciones
// reales) seguirian siendo correctos; solo el numero de score podria quedar
// desactualizado.
const MINIMUM_SCORE = 2;
const CONTRADICTION_PENALTY = 5;
const HEALTHCARE_CONTEXT_TERMS = [
  "hospital", "hospitales", "paciente", "pacientes", "patient", "patients",
  "clinica", "clinico", "clinical", "clinic", "healthcare", "health care",
  "patient care", "nec 517", "articulo 517", "nfpa 99", "hospital grade",
  "essential electrical system", "sistema electrico esencial", "medical gas", "gas medico"
];
const EXTERIOR_WET_LOCATION_TERMS = [
  "exterior", "exteriores", "outdoor", "outdoors", "a la intemperie", "intemperie",
  "wet location", "damp location", "lugares humedos", "lugares mojados",
  "humedo", "mojado", "weatherproof", "weather-resistant", "weather resistant"
];
const RESIDENTIAL_TERMS = ["residencial", "vivienda", "vivienda unifamiliar", "dwelling", "dwelling unit", "one family dwelling", "casa"];
const CATEGORY_GATES: Record<string, { requiredAnyOf?: string[]; excludeTerms?: string[] }> = {
  healthcare: { requiredAnyOf: HEALTHCARE_CONTEXT_TERMS, excludeTerms: [...EXTERIOR_WET_LOCATION_TERMS, ...RESIDENTIAL_TERMS] },
  exterior_wet_locations: { excludeTerms: HEALTHCARE_CONTEXT_TERMS }
};
const NEGATION_MARKERS = ["no ", "nunca ", "sin ", "ni ", "not ", "never ", "without ", "excluye", "excluir", "evita", "evitar"];

function weightOf(term: string): number {
  return Math.max(1, term.trim().split(/\s+/).length);
}
function isNegatedAt(nq: string, idx: number): boolean {
  const before = nq.slice(Math.max(0, idx - 30), idx);
  return NEGATION_MARKERS.some((m) => before.includes(m));
}
function findContradiction(question: string, terms: string[]): string | null {
  const nq = normalizeForMatch(question);
  for (const term of Array.from(new Set(terms))) {
    const idx = nq.indexOf(normalizeForMatch(term));
    if (idx !== -1 && !isNegatedAt(nq, idx)) return term;
  }
  return null;
}
function canonicalKey(word: string): string {
  return synonymsOf(rootOf(word))[0];
}

function scoreOf(question: string, entry: { matchCategory: string; keywords: string[]; excludeTerms?: string[] }): number | null {
  const gate = CATEGORY_GATES[entry.matchCategory];
  const normalizedQuestion = normalizeForMatch(question);
  if (gate?.requiredAnyOf?.length) {
    const ok = gate.requiredAnyOf.some((t) => normalizedQuestion.includes(normalizeForMatch(t)));
    if (!ok) return null;
  }
  const questionTokens = tokenize(normalizedQuestion);
  let score = 0;
  const creditedKeys = new Set<string>();
  for (const keyword of entry.keywords) {
    if (normalizedQuestion.includes(normalizeForMatch(keyword))) {
      score += weightOf(keyword);
      for (const w of keyword.trim().split(/\s+/)) creditedKeys.add(canonicalKey(normalizeForMatch(w)));
    }
  }
  for (const keyword of entry.keywords) {
    if (normalizedQuestion.includes(normalizeForMatch(keyword))) continue;
    const kwWords = keyword.trim().split(/\s+/);
    if (kwWords.length === 1) {
      const word = normalizeForMatch(kwWords[0]);
      if (creditedKeys.has(canonicalKey(word))) continue;
      const matched = synonymsOf(word).some((synonym) => {
        if (synonym.includes(" ")) return normalizedQuestion.includes(synonym);
        const variants = new Set(pluralVariants(synonym));
        return questionTokens.some((t) => variants.has(t));
      });
      if (matched) {
        score += weightOf(keyword);
        creditedKeys.add(canonicalKey(word));
      }
    } else {
      const nk = normalizeForMatch(keyword);
      const sig = tokenize(nk).filter((t) => !STOPWORDS.has(t));
      const allNew = sig.every((w) => !creditedKeys.has(canonicalKey(w)));
      if (allNew && flexiblePhraseMatch(questionTokens, nk)) {
        score += weightOf(keyword);
        for (const w of sig) creditedKeys.add(canonicalKey(w));
      }
    }
  }
  const contradictoryTerms = [...(gate?.excludeTerms ?? []), ...(entry.excludeTerms ?? [])];
  if (findContradiction(question, contradictoryTerms)) score -= CONTRADICTION_PENALTY;
  return score;
}

function scoreOfWinner(question: string, winnerId: string | null): number {
  if (!winnerId) return 0;
  const entry = ELECTRICAL_KNOWLEDGE_BASE.find((e) => e.id === winnerId);
  if (!entry) return 0;
  return scoreOf(question, entry) ?? 0;
}

interface BatteryResult {
  id: string;
  bateria: string;
  idioma: string;
  texto: string;
  entradaEsperada: string | null;
  entradaObtenida: string | null;
  score: number;
  util: boolean;
  falsoPositivo: boolean;
}

async function runCase(c: KnowledgeBatteryCase): Promise<BatteryResult> {
  const winner = findKnowledgeBaseMatch(c.texto);
  const response = await mockAskAssistant({ question: c.texto, language: c.idioma });
  const util = !response.unverified;
  // Falso positivo: el motor SI produjo una respuesta util, pero para una
  // entrada distinta de la esperada (incluye el caso de preguntas de
  // control, entradaEsperada=null, que jamas deberian responderse).
  const falsoPositivo = util && winner?.id !== c.entradaEsperada;
  return {
    id: c.id,
    bateria: c.bateria,
    idioma: c.idioma,
    texto: c.texto,
    entradaEsperada: c.entradaEsperada,
    entradaObtenida: winner?.id ?? null,
    score: scoreOfWinner(c.texto, winner?.id ?? null),
    util,
    falsoPositivo
  };
}

async function runBattery(cases: KnowledgeBatteryCase[]): Promise<BatteryResult[]> {
  const results: BatteryResult[] = [];
  for (const c of cases) results.push(await runCase(c));
  return results;
}

function printReport(name: string, results: BatteryResult[]) {
  const useful = results.filter((r) => r.util).length;
  const falsePositives = results.filter((r) => r.falsoPositivo);
  console.log(`\n=== ${name}: ${useful}/${results.length} utiles, ${falsePositives.length} falsos positivos ===`);
  for (const r of results) {
    console.log(
      `${r.id} | ${r.idioma} | "${r.texto}" | esperada=${r.entradaEsperada ?? "-"} | obtenida=${r.entradaObtenida ?? "-"} | score=${r.score} | util=${r.util ? "SI" : "NO"} | falsoPositivo=${r.falsoPositivo ? "SI" : "NO"}`
    );
  }
}

describe("Bateria de conocimiento (fixtures versionados, motor real sin mocks)", () => {
  it("bateria conocida: reproduce 51/56 utiles, 0 falsos positivos", async () => {
    const results = await runBattery(KNOWN_56);
    printReport("CONOCIDA (56)", results);
    const useful = results.filter((r) => r.util).length;
    const falsePositives = results.filter((r) => r.falsoPositivo);
    expect(falsePositives, `falsos positivos: ${JSON.stringify(falsePositives.map((r) => r.id))}`).toHaveLength(0);
    expect(useful).toBe(51);
  });

  it("bateria nueva: reproduce 18/26 utiles, 0 falsos positivos", async () => {
    const results = await runBattery(NEW_26);
    printReport("NUEVA (26)", results);
    const useful = results.filter((r) => r.util).length;
    const falsePositives = results.filter((r) => r.falsoPositivo);
    expect(falsePositives, `falsos positivos: ${JSON.stringify(falsePositives.map((r) => r.id))}`).toHaveLength(0);
    expect(useful).toBe(18);
  });

  it("bateria congelada: reproduce 30/42 utiles, 0 falsos positivos", async () => {
    const results = await runBattery(FROZEN_42);
    printReport("CONGELADA (42)", results);
    const useful = results.filter((r) => r.util).length;
    const falsePositives = results.filter((r) => r.falsoPositivo);
    expect(falsePositives, `falsos positivos: ${JSON.stringify(falsePositives.map((r) => r.id))}`).toHaveLength(0);
    expect(useful).toBe(30);
  });

  it("totales combinados: 99/124 utiles (51+18+30), 0 falsos positivos", async () => {
    const all = [...KNOWN_56, ...NEW_26, ...FROZEN_42];
    expect(all).toHaveLength(124);
    const results = await runBattery(all);
    const useful = results.filter((r) => r.util).length;
    const falsePositives = results.filter((r) => r.falsoPositivo);
    expect(falsePositives).toHaveLength(0);
    expect(useful).toBe(99);
  });
});
